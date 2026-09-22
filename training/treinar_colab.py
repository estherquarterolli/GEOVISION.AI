"""Treinamento 660 x 600: extração congelada + épocas limitadas pelo relógio.

Execute no notebook GeoVision_660x600.ipynb. Não apaga o dataset do Drive.
O prazo é cooperativo: download/IO/kernel travado não têm limite rígido.
"""
from pathlib import Path
import csv
import hashlib
import json
import math
import shutil
import sys
import time
from datetime import datetime, timezone

import numpy as np

if "__file__" in globals():
    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "ai-service/app/services"))
from contrato_modelo import (
    ALTURA, LARGURA, CLASSES, PERSPECTIVAS, VOCABULARIO,
    codificar_triagem, preparar_imagem, metadados_modelo,
)


def ler_manifesto(raiz, modo, avaliacao_exploratoria=False):
    """Exige edifícios conhecidos, salvo experimento visual explicitamente habilitado."""
    nome = "casos.csv" if modo == "multimodal" else "imagens.csv"
    arquivo = raiz / nome
    if avaliacao_exploratoria and modo != "visual":
        raise ValueError("Origem desconhecida só é permitida no modo visual experimental.")
    if not arquivo.exists():
        ajuda = "Execute a célula 'Preparar a lista de imagens', preencha edificio_id no inventário e salve como imagens.csv." if modo == "visual" else "Prepare casos.csv com fotos e triagem de casos reais revisados."
        raise ValueError(f"Arquivo não encontrado: {arquivo}. {ajuda}")
    with arquivo.open(encoding="utf-8-sig", newline="") as f:
        linhas = list(csv.DictReader(f))
    fotos = PERSPECTIVAS if modo == "multimodal" else ["imagem"]
    obrigatorias = ["caso_id", "edificio_id", "rotulo", *fotos]
    if modo == "multimodal":
        obrigatorias += ["revisor", *VOCABULARIO]
    if not linhas or any(c not in linhas[0] for c in obrigatorias):
        raise ValueError(f"CSV vazio ou sem colunas: {obrigatorias}")
    vistos, hashes, rotulos_hash = set(), {}, {}
    for row in linhas:
        if not (row["caso_id"] or "").strip() or row["caso_id"] in vistos or (not avaliacao_exploratoria and not (row["edificio_id"] or "").strip()):
            raise ValueError("caso_id deve ser único e edificio_id obrigatório.")
        if avaliacao_exploratoria and (row["edificio_id"] or "").strip():
            raise ValueError("Modo exploratório é para origem desconhecida. Para IDs conhecidos, desative a opção; não misture origens conhecidas e desconhecidas.")
        vistos.add(row["caso_id"])
        if row["rotulo"] not in CLASSES:
            raise ValueError(f"Rótulo inválido: {row['rotulo']}")
        if modo == "multimodal" and not row["revisor"].strip():
            raise ValueError("Casos multimodais exigem identificação do revisor técnico.")
        if modo == "multimodal":
            codificar_triagem(row)  # Rejeita medições inválidas antes de consumir GPU.
        for campo, opcoes in VOCABULARIO.items():
            if row.get(campo) and row[campo] not in opcoes:
                raise ValueError(f"Categoria inválida em {campo}: {row[campo]}")
        hashes_caso = set()
        for campo in fotos:
            caminho = (raiz / row[campo]).resolve()
            if not caminho.is_relative_to(raiz.resolve()) or not caminho.is_file():
                raise ValueError(f"Imagem ausente ou fora do dataset: {row[campo]}")
            digest = hashlib.sha256(caminho.read_bytes()).hexdigest()
            if digest in rotulos_hash and rotulos_hash[digest] != row["rotulo"]:
                raise ValueError("Foto idêntica com rótulos diferentes. Revise as classes antes de treinar.")
            rotulos_hash[digest] = row["rotulo"]
            if avaliacao_exploratoria:
                row["_grupo_split"] = digest
            if digest in hashes_caso:
                raise ValueError(f"Perspectivas repetidas no caso {row['caso_id']}")
            hashes_caso.add(digest)
            if digest in hashes and hashes[digest] != row["edificio_id"]:
                raise ValueError("Foto duplicada atribuída a edifícios distintos. Corrija a origem.")
            hashes[digest] = row["edificio_id"]
    if avaliacao_exploratoria:
        # Uma cópia por conteúdo evita inflar métricas com arquivos repetidos.
        unicas = {}
        for row in linhas:
            unicas.setdefault(row["_grupo_split"], row)
        print(f"Avaliação EXPLORATÓRIA: {len(linhas)} arquivos, {len(unicas)} conteúdos únicos. Origem dos imóveis desconhecida.")
        linhas = list(unicas.values())
    return linhas, fotos


def dividir(linhas):
    from sklearn.model_selection import StratifiedGroupKFold
    y = np.array([CLASSES.index(r["rotulo"]) for r in linhas])
    grupos = np.array([r.get("_grupo_split", r["edificio_id"]) for r in linhas])
    unidade = "conteúdos únicos" if any("_grupo_split" in r for r in linhas) else "edifícios"
    for classe in range(len(CLASSES)):
        if len(set(grupos[y == classe])) < 5:
            raise ValueError(f"{CLASSES[classe]} precisa aparecer em ao menos 5 {unidade} para separar treino/val/teste; isso é um mínimo operacional, não suficiência estatística.")
    # Aproximadamente 60/20/20 por edifício ou conteúdo no experimento visual.
    # Teste nunca escolhe épocas.
    folds = list(StratifiedGroupKFold(5, shuffle=True, random_state=42).split(y, y, grupos))
    teste, val = folds[0][1], folds[1][1]
    treino = np.setdiff1d(np.arange(len(y)), np.concatenate([teste, val]))
    for indices in (treino, val, teste):
        if set(y[indices]) != set(range(len(CLASSES))):
            raise ValueError(f"Split por {unidade} ficou sem alguma classe. Amplie/reorganize o dataset mantendo os grupos.")
    return y, treino, val, teste


def treinar(raiz, modo="multimodal", horas=3.0, epocas=1_000_000, batch_imagens=8, avaliacao_exploratoria=False):
    inicio = time.monotonic()
    prazo = inicio + horas * 3600
    # Reserva para teste, remontagem, salvamento local e cópia ao Drive.
    fim_treino = prazo - 20 * 60
    if not math.isfinite(horas) or not 1 / 3 < horas <= 3 or epocas < 1 or batch_imagens < 1:
        raise ValueError("Orçamento deve superar 20 min e ser no máximo 3h; épocas e batch positivos.")
    if modo not in {"visual", "multimodal"}:
        raise ValueError("Modo inválido")
    import tensorflow as tf
    from sklearn.metrics import classification_report, confusion_matrix
    tf.keras.utils.set_random_seed(42)
    if not tf.config.list_physical_devices("GPU"):
        raise RuntimeError("Ative GPU no Colab antes de iniciar; não prometemos 3 horas em CPU.")
    raiz = Path(raiz)
    linhas, fotos = ler_manifesto(raiz, modo, avaliacao_exploratoria=avaliacao_exploratoria)
    y, treino, val, teste = dividir(linhas)
    sessao = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%f")
    local = Path("/content") / f"geovision_{sessao}"
    local.mkdir(parents=True)
    destino = raiz / "treinamentos" / sessao
    destino.mkdir(parents=True)
    manifesto = [{"caso_id": r["caso_id"], "edificio_id": r["edificio_id"], "grupo_split": r.get("_grupo_split", r["edificio_id"]), "imagem": r.get("imagem"), "split": "treino" if i in treino else "val" if i in val else "teste"} for i, r in enumerate(linhas)]
    (destino / "split.json").write_text(json.dumps(manifesto, indent=2), encoding="utf-8")

    # Entrada em pixels 0..255; normalização exportada dentro do modelo.
    entrada = tf.keras.Input((ALTURA, LARGURA, 3), name="imagem")
    pixels = tf.keras.layers.Rescaling(1 / 127.5, offset=-1)(entrada)
    base = tf.keras.applications.MobileNetV2(include_top=False, weights="imagenet", input_shape=(ALTURA, LARGURA, 3), pooling="avg")
    base.trainable = False
    extrator = tf.keras.Model(entrada, base(pixels, training=False), name="extrator")

    # Copia só os arquivos do manifesto para disco local; nenhuma remoção no Drive.
    caminhos = []
    for row in linhas:
        lista = []
        for campo in fotos:
            origem = raiz / row[campo]
            alvo = local / "imagens" / row[campo]
            alvo.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(origem, alvo)
            lista.append(alvo)
        caminhos.append(lista)
        if time.monotonic() >= fim_treino:
            raise TimeoutError("Cópia consumiu o orçamento; nenhum modelo foi publicado.")

    n, vistas = len(linhas), len(fotos)
    features = np.zeros((n, vistas * 1280), dtype=np.float32)
    # Uma passagem pela CNN. Batch pequeno e redução automática se faltar VRAM.
    itens = [(i, j, p) for i, paths in enumerate(caminhos) for j, p in enumerate(paths)]
    cursor, lote, tempos = 0, batch_imagens, []
    while cursor < len(itens):
        if time.monotonic() >= fim_treino:
            raise TimeoutError("Extração excedeu orçamento; reduza dataset ou resolução. Não exportado modelo incompleto.")
        selecao = itens[cursor:cursor + lote]
        batch = np.stack([preparar_imagem(p.read_bytes()) for _, _, p in selecao])
        t = time.monotonic()
        try:
            valores = extrator(batch, training=False).numpy()
        except tf.errors.ResourceExhaustedError:
            if lote == 1:
                raise RuntimeError("GPU sem memória para 600x660; use resolução menor em treino E API.")
            lote = max(1, lote // 2)
            continue
        tempos.append((time.monotonic() - t) / len(selecao))
        for (i, j, _), vetor in zip(selecao, valores):
            features[i, j * 1280:(j + 1) * 1280] = vetor
        cursor += len(selecao)
        if cursor == len(selecao) or cursor % (lote * 20) == 0:
            estimativa = np.median(tempos[-10:]) * (len(itens) - cursor)
            print(f"Extração {cursor}/{len(itens)}; restante estimado CNN: {estimativa / 60:.1f} min", flush=True)
    np.save(local / "features.npy", features)
    entradas_head = [tf.keras.Input((vistas * 1280,), name="features")]
    x = entradas_head[0]
    dados = {"features": features}
    if modo == "multimodal":
        triagem = np.stack([codificar_triagem(r) for r in linhas])
        entrada_triagem = tf.keras.Input((triagem.shape[1],), name="triagem")
        entradas_head.append(entrada_triagem)
        x = tf.keras.layers.Concatenate()([x, entrada_triagem])
        dados["triagem"] = triagem
    x = tf.keras.layers.Dense(64, activation="relu", kernel_regularizer=tf.keras.regularizers.l2(1e-3))(x)
    x = tf.keras.layers.Dropout(.4)(x)
    saida = tf.keras.layers.Dense(len(CLASSES), activation="softmax", dtype="float32")(x)
    head = tf.keras.Model(entradas_head, saida, name="decisor")
    head.compile(optimizer=tf.keras.optimizers.Adam(1e-3), loss="sparse_categorical_crossentropy", metrics=["accuracy"])
    contar = np.bincount(y[treino], minlength=len(CLASSES))
    pesos = {i: len(treino) / (len(CLASSES) * int(q)) for i, q in enumerate(contar)}

    class Orcamento(tf.keras.callbacks.Callback):
        def __init__(self):
            super().__init__()
            self.tempos = []
        def on_epoch_begin(self, epoch, logs=None):
            self.inicio_epoca = time.monotonic()
            self.interrompida = False
        def on_train_batch_end(self, batch, logs=None):
            if time.monotonic() >= fim_treino:
                self.model.stop_training = True
                self.interrompida = batch + 1 < self.params["steps"]
        def on_epoch_end(self, epoch, logs=None):
            # Não promover um checkpoint de uma época incompleta/não finita.
            if not self.interrompida and logs and math.isfinite(logs.get("val_loss", float("nan"))):
                if logs["val_loss"] < self.melhor_loss:
                    self.model.save_weights(str(melhor))
                    self.melhor_loss = logs["val_loss"]
                    self.melhor_epoca = epoch + 1
            self.tempos.append(time.monotonic() - self.inicio_epoca)
            restante = fim_treino - time.monotonic()
            if epoch == 0:
                print(f"Estimativa para {epocas} épocas da cabeça: {self.tempos[-1] * epocas / 60:.1f} min")
            if restante < 1.3 * max(self.tempos[-3:]):
                self.model.stop_training = True

    melhor = local / "melhor.weights.h5"
    orcamento = Orcamento()
    orcamento.melhor_loss = float("inf")
    orcamento.melhor_epoca = None
    if time.monotonic() >= fim_treino:
        raise TimeoutError("Sem tempo restante para treinar.")
    historico = head.fit(
        {k: v[treino] for k, v in dados.items()}, y[treino],
        validation_data=({k: v[val] for k, v in dados.items()}, y[val]),
        epochs=epocas, batch_size=32, class_weight=pesos,
        callbacks=[orcamento, tf.keras.callbacks.TerminateOnNaN(),
                   tf.keras.callbacks.ReduceLROnPlateau(monitor="val_loss", patience=8, factor=.5, min_lr=1e-5)],
        verbose=2,
    )
    if not melhor.exists():
        raise RuntimeError("Nenhum checkpoint válido; não exportar.")
    head.load_weights(melhor)
    previsoes = head.predict({k: v[teste] for k, v in dados.items()}, verbose=0)
    relatorio = classification_report(y[teste], previsoes.argmax(1), labels=list(range(4)), target_names=CLASSES, output_dict=True, zero_division=0)
    relatorio["matriz_confusao"] = confusion_matrix(y[teste], previsoes.argmax(1), labels=list(range(4))).tolist()
    relatorio["epocas_executadas"] = len(historico.epoch)
    relatorio["melhor_epoca"] = orcamento.melhor_epoca
    relatorio["orcamento_horas"] = horas
    relatorio["reserva_finalizacao_minutos"] = 20
    relatorio["tipo_avaliacao"] = "exploratoria_por_conteudo" if avaliacao_exploratoria else "por_edificio"
    relatorio["origem_imoveis_conhecida"] = not avaliacao_exploratoria
    relatorio["segundos_ate_avaliacao"] = time.monotonic() - inicio
    # Artefato final recebe as fotos, não embeddings pré-computados do cliente.
    novas = [tf.keras.Input((ALTURA, LARGURA, 3), name=nome) for nome in fotos]
    vetores = [extrator(foto, training=False) for foto in novas]
    vetor = tf.keras.layers.Concatenate()(vetores) if len(vetores) > 1 else vetores[0]
    entrada_final = {"features": vetor}
    if modo == "multimodal":
        t = tf.keras.Input((dados["triagem"].shape[1],), name="triagem")
        novas.append(t)
        entrada_final["triagem"] = t
    modelo = tf.keras.Model(novas, head(entrada_final, training=False))
    artefato = local / "geovision_model_pronto.keras"
    modelo.save(artefato)
    meta = metadados_modelo(modo)
    meta["tipo_avaliacao"] = relatorio["tipo_avaliacao"]
    if avaliacao_exploratoria:
        meta["limitacao_avaliacao"] = "Fotos diferentes do mesmo imóvel podem estar em splits distintos; não demonstra generalização para outros imóveis."
    meta.update({"versao": sessao, "tensorflow": tf.__version__, "sha256": hashlib.sha256(artefato.read_bytes()).hexdigest()})
    (local / "geovision_model_pronto.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    (local / "avaliacao.json").write_text(json.dumps(relatorio, ensure_ascii=False, indent=2), encoding="utf-8")
    (local / "historico.json").write_text(json.dumps(historico.history, indent=2), encoding="utf-8")
    # Confere serialização e equivalência entre treino em features e inferência.
    recarregado = tf.keras.models.load_model(artefato, compile=False)
    idx = int(teste[0])
    amostra = [np.expand_dims(preparar_imagem(p.read_bytes()), 0) for p in caminhos[idx]]
    if modo == "multimodal":
        amostra.append(dados["triagem"][idx:idx + 1])
    np.testing.assert_allclose(recarregado(amostra, training=False).numpy(), previsoes[:1], atol=1e-5, rtol=1e-4)
    for nome in [artefato.name, "geovision_model_pronto.json", "avaliacao.json", "historico.json"]:
        shutil.copy2(local / nome, destino / nome)
    print(f"Concluído em {(time.monotonic() - inicio) / 60:.1f} min. Artefatos experimentais: {destino}")
    print("Avalie recall crítico, erros crítico->baixo e tamanho do teste com o revisor antes de homologar.")
    return destino


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--raiz", default="/content/drive/MyDrive/GeoVision-IA")
    parser.add_argument("--modo", choices=["visual", "multimodal"], default="multimodal")
    parser.add_argument("--epocas", type=int, default=1_000_000)
    parser.add_argument("--horas", type=float, default=3.0)
    parser.add_argument("--avaliacao-exploratoria", action="store_true")
    args = parser.parse_args()
    treinar(args.raiz, modo=args.modo, epocas=args.epocas, horas=args.horas, avaliacao_exploratoria=args.avaliacao_exploratoria)

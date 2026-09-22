"""Inventário de imagens sem inventar identidade de edifícios.

São aceitas três estruturas, nesta ordem: ``01_imagens_brutas/<classe>``, o
dataset já separado em ``02_dataset_limpo/<split>/<classe>`` e uma pasta que
contenha as quatro classes diretamente. A última forma é a recebida quando a
pasta compartilhada do Drive é adicionada ao Meu Drive como atalho.
"""
import csv
from pathlib import Path

CLASSES = ("baixo", "critico", "medio", "sem_risco")
EXTENSOES = {".jpg", ".jpeg", ".png", ".bmp", ".webp", ".tif", ".tiff"}


def preparar_manifesto(raiz, exploratoria=False):
    raiz = Path(raiz).resolve()
    final = raiz / "imagens.csv"
    if final.exists():
        return final
    rascunho = raiz / "imagens.preencher.csv"
    if rascunho.exists() and not exploratoria:
        return rascunho
    destino = final if exploratoria else rascunho

    def inventariar(pastas):
        linhas = []
        for pasta in pastas:
            if not pasta.is_dir():
                continue
            for classe in sorted(pasta.iterdir()):
                if not classe.is_dir():
                    continue
                fotos = sorted(p for p in classe.rglob("*") if p.is_file() and p.suffix.lower() in EXTENSOES)
                if fotos and classe.name not in CLASSES:
                    raise ValueError(f"Pasta de classe não reconhecida: {classe.name}. Esperado: {CLASSES}")
                for foto in fotos:
                    if not foto.resolve().is_relative_to(raiz):
                        raise ValueError(f"Imagem fora da raiz: {foto}")
                    linhas.append({"caso_id": f"foto_{len(linhas)+1:06d}", "edificio_id": "",
                                   "rotulo": classe.name, "imagem": foto.relative_to(raiz).as_posix()})
        return linhas

    # Não juntar fontes diferentes: cópias do mesmo arquivo inflariam o
    # inventário, mesmo que a validação posterior elimine hashes repetidos.
    linhas = inventariar([raiz / "01_imagens_brutas"])
    if not linhas:
        linhas = inventariar([raiz / "02_dataset_limpo" / split for split in ("train", "val", "test")])
    if not linhas:
        # A pasta compartilhada pode ser a própria raiz do dataset, com as
        # quatro classes logo abaixo. Isso evita obrigar a recriar/mover o
        # acervo apenas para atender ao layout de uma versão antiga.
        linhas = inventariar([raiz])
    if not linhas:
        raise ValueError(
            "Nenhuma imagem encontrada em 01_imagens_brutas/<classe>, "
            "02_dataset_limpo/train|val|test/<classe> ou RAIZ/<classe>. "
            "Confira RAIZ e adicione a pasta compartilhada ao Meu Drive."
        )
    with destino.open("x", encoding="utf-8-sig", newline="") as arquivo:
        writer = csv.DictWriter(arquivo, fieldnames=["caso_id", "edificio_id", "rotulo", "imagem"])
        writer.writeheader()
        writer.writerows(linhas)
    return destino


def conferir_manifesto(raiz, exploratoria=False):
    """Verificação curta antes da GPU; a validação completa permanece no treino."""
    arquivo = preparar_manifesto(raiz, exploratoria=exploratoria)
    if arquivo.name != "imagens.csv":
        raise ValueError(f"Inventário pronto: {arquivo}. Preencha edificio_id com o mesmo código para fotos do mesmo imóvel e salve como imagens.csv na mesma pasta. Não use um código diferente para cada foto sem conhecer a origem.")
    with arquivo.open(encoding="utf-8-sig", newline="") as origem:
        leitor = csv.DictReader(origem)
        if not {"caso_id", "edificio_id", "rotulo", "imagem"}.issubset(leitor.fieldnames or []):
            raise ValueError("imagens.csv deve ter caso_id,edificio_id,rotulo,imagem, separados por vírgula.")
        linhas = list(leitor)
    if not linhas:
        raise ValueError("imagens.csv está vazio.")
    faltantes = [i + 2 for i, linha in enumerate(linhas) if not (linha.get("edificio_id") or "").strip()]
    if faltantes and not exploratoria:
        raise ValueError(f"Preencha edificio_id em imagens.csv. Linhas pendentes: {faltantes[:10]}")
    return arquivo

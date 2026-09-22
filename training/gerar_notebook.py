"""Empacota fontes locais no notebook; executar novamente após alterar módulos."""
import csv
import ast
import json
from pathlib import Path

PASTA = Path(__file__).resolve().parent
CONTRATO = PASTA.parent / "ai-service/app/services/contrato_modelo.py"


def constantes_do_contrato():
    """Lê os dois literais sem exigir TensorFlow, NumPy ou Pillow localmente."""
    arvore = ast.parse(CONTRATO.read_text(encoding="utf-8"))
    valores = {}
    for no in arvore.body:
        if isinstance(no, ast.Assign):
            for alvo in no.targets:
                if isinstance(alvo, ast.Name) and alvo.id in {"VOCABULARIO", "MEDICOES"}:
                    valores[alvo.id] = ast.literal_eval(no.value)
    return valores["VOCABULARIO"], valores["MEDICOES"]


VOCABULARIO, MEDICOES = constantes_do_contrato()


def markdown(texto):
    return {"cell_type": "markdown", "metadata": {}, "source": texto.splitlines(keepends=True)}


def codigo(texto):
    return {"cell_type": "code", "metadata": {}, "execution_count": None, "outputs": [], "source": texto.splitlines(keepends=True)}


celulas = [markdown("""# GeoVision: 660 × 600, até três horas

Ative **Ambiente de execução → Alterar tipo → GPU** e execute na ordem.
Este notebook contém os módulos necessários. Não apaga dados do Drive.
Treina uma cabeça sobre MobileNetV2 congelada, com teto alto de épocas e parada por tempo.
Reserva 20 minutos das 3h para finalizar. O limite é cooperativo; operações bloqueadas podem excedê-lo.
Instalação e montagem do Drive ficam fora do relógio.

Use `visual` para fotos rotuladas ou `multimodal` para casos reais com três fotos,
triagem e revisor. Não preencha triagem fictícia. As células antigas de clone,
extração de ZIP e `split-folders` não fazem parte deste notebook.

No modo visual, o resultado é um `.keras` 600 × 660; a API deste projeto já o
aceita quando `CAMINHO_MODELO` aponta para esse arquivo. O modo multimodal ainda
exige uma integração própria, pois recebe quatro entradas.
"""), codigo("""%pip -q install scikit-learn pillow
from google.colab import drive
drive.mount('/content/drive')
import tensorflow as tf
print('TensorFlow:', tf.__version__)
assert tf.config.list_physical_devices('GPU'), 'Selecione GPU no Colab e reconecte.'
""")]
fontes = {"contrato_modelo.py": CONTRATO.read_text(encoding="utf-8"),
          "treinar_colab.py": (PASTA / "treinar_colab.py").read_text(encoding="utf-8"),
          "preparar_manifesto.py": (PASTA / "preparar_manifesto.py").read_text(encoding="utf-8"),
          "calculos_observacionais.py": (PASTA / "calculos_observacionais.py").read_text(encoding="utf-8")}
celulas.append(codigo("from pathlib import Path\nimport sys\n" +
                      "FONTES = " + repr(fontes) + "\n" +
                      "for nome, fonte in FONTES.items():\n    Path('/content', nome).write_text(fonte, encoding='utf-8')\n" +
                      "sys.path.insert(0, '/content')\n" +
                      "import importlib\nimportlib.invalidate_caches()\n" +
                      "for nome in FONTES:\n    sys.modules.pop(Path(nome).stem, None)\n"))
celulas.append(markdown("""## Configuração e dados

`imagens.csv`: caso_id, edificio_id, rotulo, imagem.

`casos.csv`: caso_id, edificio_id, rotulo, geral, detalhe, escala, revisor e
todos os campos categóricos abaixo. Medições são opcionais e só devem ser
preenchidas quando verificadas. Caminhos relativos à pasta GeoVision-IA.

Classes: baixo, critico, medio, sem_risco. `sem_risco` não atesta segurança.
Para imagens sem origem identificável, use avaliação exploratória: pelo menos cinco
arquivos de conteúdo diferente por classe. Ela não demonstra desempenho em novos imóveis.
Quando houver identificação, desative a opção exploratória e use pelo menos cinco
edifícios por classe. Nenhum desses mínimos garante suficiência estatística.
"""))
celulas.append(codigo("""from contrato_modelo import VOCABULARIO, MEDICOES
# No Drive, use “Organizar > Adicionar atalho ao Drive” na pasta compartilhada
# e selecione Meu Drive. Informe abaixo a pasta que contém baixo/critico/medio/sem_risco.
RAIZ = '/content/drive/MyDrive/GeoVision-IA'
MODO = 'visual'  # altere para 'multimodal' se já houver casos.csv revisado
AVALIACAO_EXPLORATORIA = True  # fotos sem identificação do imóvel; somente modo visual
HORAS = 3.0
MAX_EPOCAS = 1_000_000  # teto; quem controla a parada é o relógio
print('Categorias aceitas:', VOCABULARIO)
print('Medições opcionais e escalas numéricas (não limites):', MEDICOES)
if not Path(RAIZ).is_dir():
    raise FileNotFoundError(
        f'RAIZ não encontrada: {RAIZ}. Adicione a pasta compartilhada ao Meu Drive '
        'e informe aqui o caminho dela no Colab.'
    )
"""))
celulas.append(markdown("""## Preparar a lista de imagens

Com `AVALIACAO_EXPLORATORIA=True`, cria `imagens.csv` automaticamente, com origem
do edifício em branco. Arquivos idênticos são deduplicados antes da separação.
Fotos diferentes do mesmo imóvel ainda podem vazar entre os conjuntos.
Com a opção desligada, cria `imagens.preencher.csv` para preencher os edifícios.
Usa `01_imagens_brutas/<classe>`; se não houver fotos nessa pasta, recupera as imagens
de `02_dataset_limpo/train|val|test/<classe>` ou de `RAIZ/<classe>`, que é a estrutura
da pasta compartilhada atual. Não mistura as fontes, não apaga arquivos e não extrai ZIPs.

Abra o CSV, preencha `edificio_id` com um identificador real de agrupamento (por exemplo,
`imovel_001` em todas as fotos do mesmo imóvel) e salve como `imagens.csv`, separado por
vírgulas, na mesma pasta. Não é necessário escrever endereços. O ID da foto não identifica
o edifício. Só preencha esse dado quando a origem for conhecida.
"""))
celulas.append(codigo("""from preparar_manifesto import preparar_manifesto
if MODO == 'visual':
    arquivo = preparar_manifesto(RAIZ, exploratoria=AVALIACAO_EXPLORATORIA)
    print('Arquivo:', arquivo)
    if arquivo.name != 'imagens.csv':
        print('Preencha edificio_id e salve como imagens.csv antes de treinar.')
else:
    print('Modo multimodal: prepare casos.csv com fotos, triagem e revisor dos casos reais.')
"""))
celulas.append(codigo("""from preparar_manifesto import conferir_manifesto
if MODO == 'visual':
    conferir_manifesto(RAIZ, exploratoria=AVALIACAO_EXPLORATORIA)
if AVALIACAO_EXPLORATORIA and MODO != 'visual':
    raise ValueError('Desative AVALIACAO_EXPLORATORIA para treinar casos multimodais revisados.')
from treinar_colab import treinar
destino = treinar(RAIZ, modo=MODO, horas=HORAS, epocas=MAX_EPOCAS, batch_imagens=8,
                 avaliacao_exploratoria=AVALIACAO_EXPLORATORIA)
"""))
celulas.append(codigo("""import json
print(json.dumps(json.loads((destino / 'avaliacao.json').read_text()), indent=2, ensure_ascii=False))
print('Modelo experimental salvo em:', destino)
"""))
celulas.append(markdown("""## Cálculos observacionais: exemplo aritmético

Não são classificação de risco nem verificação resistente. Resultados verificados podem
preencher as colunas opcionais do CSV em uma execução futura. A escala da foto deve estar
no mesmo plano, com perspectiva corrigida; nunca se aproximar de risco para medir.
"""))
celulas.append(codigo("""from calculos_observacionais import evolucao_mm_dia, desaprumo_mm_m, distorcao_angular
print('Exemplo de evolução (mm/dia):', evolucao_mm_dia(0.4, 0.7, 48))
print('Exemplo de desaprumo (mm/m):', desaprumo_mm_m(6, 3))
print('Exemplo de distorção (adimensional):', distorcao_angular(5, 5))
"""))
notebook = {"cells": celulas, "metadata": {"accelerator": "GPU", "colab": {"name": "GeoVision_660x600.ipynb"},
            "kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"},
            "language_info": {"name": "python"}}, "nbformat": 4, "nbformat_minor": 5}
for indice, celula in enumerate(celulas):
    celula["id"] = f"geovision-{indice}"
(PASTA / "GeoVision_660x600.ipynb").write_text(json.dumps(notebook, ensure_ascii=False, indent=2), encoding="utf-8")
for nome, campos in [("imagens.exemplo.csv", ["caso_id", "edificio_id", "rotulo", "imagem"]),
                     ("casos.exemplo.csv", ["caso_id", "edificio_id", "rotulo", "geral", "detalhe", "escala", "revisor", *VOCABULARIO, *MEDICOES])]:
    with (PASTA / nome).open("w", encoding="utf-8", newline="") as arquivo:
        csv.writer(arquivo).writerow(campos)
print("Notebook e cabeçalhos CSV gerados.")

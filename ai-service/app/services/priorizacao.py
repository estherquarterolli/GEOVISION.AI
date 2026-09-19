"""Priorização da fila de triagem pelo método GUT (Gravidade × Urgência × Tendência).

Fonte: adaptação do método GUT para inspeção predial de
GOMIDE, T. L. F.; PUJADAS, F. Z. A.; FAGUNDES NETO, J. C. P. "Engenharia
diagnóstica em edificações". São Paulo: Pini, 2009 — citada e aplicada em
CARVALHO, E. M.; ALMEIDA, L. S. "Check-list para inspeções prediais
residenciais de múltiplos pavimentos: desenvolvimento e aplicação". XIX
COBREAP, Foz do Iguaçu, 2017. A tabela de pesos original e a justificativa
completa da adoção estão em docs/metodologia-priorizacao-gut.md.

Por que GUT, e não a fórmula peso×confiança×área nem o SWOT da engenheira
consultora:

- A fórmula peso×confiança×área em pixels (app/services/risco.py) decide SE
  um alerta é baixo/médio/crítico — é uma decisão de visão computacional
  (peso da classe detectada pelo Roboflow, confiança do modelo, tamanho do
  bounding box) e está fora do escopo deste módulo. Continua como está até
  uma avaliação técnica de sistemas (ver docs/relatorio-treinamento-ia.md,
  seção 7) — a própria engenheira consultora disse não ter como validar
  esse parâmetro, por não ser da área dela.
- O problema que sobrou, levantado por ela em 16/09/2026, é diferente: com
  centenas ou milhares de alertas "crítico" por dia, o que desempata quem a
  Defesa Civil vê primeiro? O SWOT que ela usa em laudos próprios não é
  público nem foi pensado para triagem em massa — ela mesma recomendou
  deixar isso para uma segunda ou terceira etapa. GUT preenche essa lacuna
  agora porque é (a) um método publicado e citável, (b) já usado em
  inspeção predial no Brasil justamente para transformar uma lista de
  anomalias em uma ORDEM de prioridade, e (c) pode ser alimentado pelos
  dados que o cidadão já informa no formulário de alerta (gravidade
  percebida, evolução), sem exigir nova vistoria.

Como no resto do GeoVision.AI, isto é apoio à priorização da fila — não um
laudo de engenharia nem substituto de vistoria técnica.
"""

from __future__ import annotations

from typing import TypedDict

# Pesos das faixas do método GUT, na tabela original (Gomide, Pujadas e
# Fagundes Neto, 2009): Total=10, Alta=8, Média=6, Baixa=3, Nenhuma=1.
_PESO_TOTAL = 10
_PESO_ALTA = 8
_PESO_MEDIA = 6
_PESO_BAIXA = 3
_PESO_NENHUMA = 1

# Quando o cidadão não respondeu a uma das perguntas, usamos um peso neutro
# (nem "Nenhuma" nem "Total") em vez de tratar silêncio como ausência de
# risco — um campo em branco não deveria empurrar o alerta para o fim da
# fila.
_PESO_NAO_INFORMADO = 5

# Ordem de prioridade por nível de risco. O GUT nunca decide *entre*
# níveis — um alerta médio jamais passa na frente de um crítico só por ter
# G×U×T mais alto. Ele só desempata *dentro* de cada nível, que é
# exatamente o problema que a engenheira descreveu ("de 300 críticos, qual
# é o mais crítico?").
ORDEM_NIVEL_RISCO = {"critico": 0, "medio": 1, "baixo": 2}
_ORDEM_NIVEL_RISCO_DESCONHECIDO = 3


def _gravidade(nivel_risco: str | None) -> int:
    """G — Gravidade: dano potencial se nada for feito.

    Vem da classificação da IA (Roboflow), que já pondera tipo de
    patologia, confiança e área na foto (ver risco.py). Aqui só traduzimos
    baixo/médio/crítico para a escala 1–10 do GUT, nos mesmos três degraus
    que a Norma de Inspeção Predial do IBAPE/NA usa para "grau de
    criticidade" (crítico/médio/mínimo).
    """
    return {
        "critico": _PESO_TOTAL,
        "medio": _PESO_MEDIA,
        "baixo": _PESO_NENHUMA,
    }.get(nivel_risco or "", _PESO_NAO_INFORMADO)


def _urgencia(evolucao: str | None) -> int:
    """U — Urgência: o quanto o evento já está em curso.

    Vem da resposta do cidadão a "qual a evolução percebida?" (ver
    NovoAlerta.tsx) — é o dado do formulário mais próximo do "evento em
    ocorrência" da tabela original do GUT.
    """
    return {
        "rapido": _PESO_TOTAL,       # "Aumentando rápido"   ~ evento em ocorrência
        "aumentando": _PESO_MEDIA,   # "Aumentando devagar"  ~ evento prestes a ocorrer
        "estavel": _PESO_BAIXA,      # "Estável"             ~ evento prognosticado p/ adiante
    }.get(evolucao or "", _PESO_NAO_INFORMADO)


def _tendencia(gravidade_percebida: str | None) -> int:
    """T — Tendência: para onde o problema caminha se nada for feito.

    A Norma do IBAPE mede tendência por avaliação técnica; sem vistoria,
    usamos a leitura sensorial do próprio morador (alto/médio/baixo) —
    exatamente o tipo de sinal que a engenheira consultora descreveu como
    insubstituível por uma foto (cheiro, vibração ao pisar, som ouvido),
    coletado como pergunta fechada porque a IA não tem como inferir isso
    de uma imagem.
    """
    return {
        "alto": _PESO_TOTAL,
        "medio": _PESO_MEDIA,
        "baixo": _PESO_NENHUMA,
    }.get(gravidade_percebida or "", _PESO_NAO_INFORMADO)


class PontuacaoGUT(TypedDict):
    gravidade: int
    urgencia: int
    tendencia: int
    pontuacao: int


def calcular_pontuacao_gut(
    nivel_risco: str | None,
    evolucao: str | None,
    gravidade_percebida: str | None,
) -> PontuacaoGUT:
    """Calcula G, U, T e a pontuação final (G × U × T) de um alerta."""
    g = _gravidade(nivel_risco)
    u = _urgencia(evolucao)
    t = _tendencia(gravidade_percebida)
    return {"gravidade": g, "urgencia": u, "tendencia": t, "pontuacao": g * u * t}


def ordenar_fila_por_prioridade(alertas: list[dict]) -> list[dict]:
    """Ordena a fila de triagem da Defesa Civil.

    Critério primário: nível de risco (crítico > médio > baixo) — não é
    negociável, é a garantia de segurança que o resto do sistema já
    documenta (README/relatorio.md: "crítico primeiro").

    Critério de desempate, dentro do mesmo nível: pontuação GUT (maior
    primeiro), depois data de criação (mais antigo primeiro), para que
    dois alertas com o mesmo GUT não fiquem em ordem arbitrária.

    Os campos gut_gravidade/gut_urgencia/gut_tendencia/pontuacao_gut são
    gravados em cada dict de alerta (mutação in-place) para que o painel
    possa exibir o cálculo — transparência é parte do motivo de usar um
    método citável em vez de uma fórmula fechada.
    """
    def chave(alerta: dict):
        gut = calcular_pontuacao_gut(
            alerta.get("nivel_risco"),
            alerta.get("evolucao"),
            alerta.get("gravidade_percebida"),
        )
        alerta["gut_gravidade"] = gut["gravidade"]
        alerta["gut_urgencia"] = gut["urgencia"]
        alerta["gut_tendencia"] = gut["tendencia"]
        alerta["pontuacao_gut"] = gut["pontuacao"]

        ordem_risco = ORDEM_NIVEL_RISCO.get(
            alerta.get("nivel_risco") or "", _ORDEM_NIVEL_RISCO_DESCONHECIDO
        )
        # criado_em é ISO 8601 (`...Z`), então ordena como string sem
        # precisar fazer parse de data.
        return (ordem_risco, -gut["pontuacao"], alerta.get("criado_em") or "")

    return sorted(alertas, key=chave)

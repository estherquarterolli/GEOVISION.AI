import logging
from inference_sdk import InferenceHTTPClient
from app.config import obter_config

logger = logging.getLogger(__name__)

# Configurações de pesos por classe de defeito
# exposed_rebar e spalling já existem na ontologia do projeto no Roboflow,
# mas em 18/09/2026 ainda tinham 0 exemplos de treino (ver investigação da
# pasta ai-service/dataset/) — então não aparecem em predicoes_brutas até
# que o dataset seja curado e um novo treino rode. Pesos calibrados de
# acordo com docs/relatorio-treinamento-ia.md (seção 5.1) e o checklist
# IBAPE citado em docs/metodologia-priorizacao-gut.md (seção 5) — manter
# em sincronia com PESO_POR_CLASSE em classificador_roboflow.py.
PESO_POR_CLASSE = {
    "exposed_rebar": 4,  # armadura exposta — achado estrutural (IBAPE)
    "crack": 3,          # rachadura
    "deterioration": 3,  # deterioração
    "spalling": 3,       # desplacamento — mesma severidade de deterioration
    "corrosion": 2,      # corrosão
    "moisture": 2,       # umidade
    "mold": 1,           # mofo
    "stain": 1,          # mancha
}

def obter_cliente_roboflow():
    """Inicializa de forma lazy o cliente de inferência do Roboflow."""
    config = obter_config()
    if not config.roboflow_api_key:
        logger.warning("Classificador Risco: Chave ROBOFLOW_API_KEY não configurada. Roboflow inativo.")
        return None
    return InferenceHTTPClient(
        api_url="https://serverless.roboflow.com",
        api_key=config.roboflow_api_key
    )

def detectar_defeitos(caminho_imagem: str) -> list[dict]:
    """
    Envia uma imagem local para a API do Roboflow e retorna a lista de anomalias detectadas.
    """
    cliente = obter_cliente_roboflow()
    if not cliente:
        logger.warning("Serviço de análise Roboflow desativado por falta de credenciais. Retornando lista vazia.")
        return []

    config = obter_config()
    try:
        resultado = cliente.run_workflow(
            workspace_name=config.roboflow_workspace,
            workflow_id=config.roboflow_workflow_id,
            images={"image": caminho_imagem},
            parameters={"classes": "crack, corrosion, stain, mold, deterioration, moisture, exposed_rebar, spalling"},
            use_cache=True,
        )

        predicoes_brutas = resultado[0].get("predictions", {}).get("predictions", [])

        defeitos = []
        for predicao in predicoes_brutas:
            confianca = predicao.get("confidence", 0)

            # Filtro de confiança mínima (50%)
            if confianca < 0.5:
                continue

            area = predicao.get("width", 0) * predicao.get("height", 0)

            defeitos.append({
                "classe": predicao.get("class", "desconhecido"),
                "confianca": confianca,
                "area": area,
            })

        return defeitos
    except Exception as e:
        logger.error(f"Erro ao detectar defeitos via Roboflow para {caminho_imagem}: {e}")
        return []

def detectar_defeitos_das_3_fotos(caminhos_das_3_fotos: list[str]) -> list[list[dict]]:
    """
    Roda a detecção de defeitos para cada uma das 3 fotos informadas.
    """
    resultados = []
    for caminho in caminhos_das_3_fotos:
        defeitos_da_foto = detectar_defeitos(caminho)
        resultados.append(defeitos_da_foto)
    return resultados

def calcular_risco_da_foto(defeitos: list[dict]) -> str:
    """
    Calcula o risco estrutural de uma foto: "baixo", "medio" ou "critico".
    """
    if not defeitos:
        return "baixo"

    pontuacao_total = 0.0
    tem_defeito_grave_e_grande = False

    for defeito in defeitos:
        peso = PESO_POR_CLASSE.get(defeito["classe"], 1)
        area = defeito["area"]
        confianca = defeito["confianca"]

        # Fator de tamanho: caixas muito pequenas contribuem menos para o risco total
        # Se a área for menor que 10.000 pixels (~100x100), reduzimos o peso pela metade
        fator_tamanho = 0.5 if area < 10000 else 1.0

        # Acumula pontuação com base na confiança e no tamanho
        pontuacao_total += peso * confianca * fator_tamanho

        # Regra para Crítico automático:
        # Se for uma classe grave (peso >= 3: crack, deterioration, spalling
        # ou exposed_rebar — este último com peso 4, tratado pelo IBAPE como
        # achado estrutural, ver docs/relatorio-treinamento-ia.md seção 5.1),
        # com alta confiança (>80%) e uma área realmente significativa
        # (>= 60.000 pixels, ex: >245x245px).
        if peso >= 3 and confianca > 0.8 and area >= 60000:
            tem_defeito_grave_e_grande = True

    # Limites de risco mais adequados:
    # Crítico: se houver um defeito grave e grande, ou se a soma das pontuações atingir 4.5.
    if tem_defeito_grave_e_grande or pontuacao_total >= 4.5:
        return "critico"
    # Médio: se a soma atingir 2.0.
    elif pontuacao_total >= 2.0:
        return "medio"
    else:
        return "baixo"

def analisar_caso(caminhos_das_3_fotos: list[str]) -> dict:
    """
    Analisa o caso completo das 3 fotos e retorna o risco consolidado (pior risco).
    """
    ORDEM_RISCO = {"baixo": 0, "medio": 1, "critico": 2}

    defeitos_das_3_fotos = detectar_defeitos_das_3_fotos(caminhos_das_3_fotos)
    riscos_por_foto = [calcular_risco_da_foto(d) for d in defeitos_das_3_fotos]

    risco_final = max(riscos_por_foto, key=lambda r: ORDEM_RISCO[r])

    return {
        "risco_final": risco_final,
        "risco_por_foto": riscos_por_foto,
        "defeitos_por_foto": defeitos_das_3_fotos,
    }

def calcular_prioridade(
    risco_final: str,
    piorando_rapido: bool,
    tem_moradores_no_local: bool,
    tempo_percebido_dias: int
) -> str:
    """
    Calcula a prioridade de atendimento na Defesa Civil: "alta", "media" ou "baixa".
    """
    if risco_final == "critico":
        return "alta"
    elif risco_final == "medio":
        if piorando_rapido and tem_moradores_no_local:
            return "alta"
        if piorando_rapido or tem_moradores_no_local or tempo_percebido_dias > 30:
            return "media"
        return "media"
    else:  # baixo
        if piorando_rapido:
            return "media"
        return "baixa"

import logging
from typing import TypedDict
from inference_sdk import InferenceHTTPClient
from app.schemas import NivelRisco, RespostaClassificacao

logger = logging.getLogger(__name__)

# Regras de severidade das classes
# exposed_rebar e spalling já existem na ontologia do projeto no Roboflow,
# mas em 18/09/2026 ainda tinham 0 exemplos de treino (ver investigação da
# pasta ai-service/dataset/) — então não aparecem em predicoes_brutas até
# que o dataset seja curado e um novo treino rode. Pesos calibrados aqui
# de acordo com docs/relatorio-treinamento-ia.md (seção 5.1) e o checklist
# IBAPE citado em docs/metodologia-priorizacao-gut.md (seção 5): armadura
# exposta é achado estrutural (peso 4, igual ou maior que crack), e
# desplacamento é tratado como a mesma família de deterioration (peso 3).
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

class Defeito(TypedDict):
    classe: str
    confianca: float
    area: float

class ClassificadorRoboflow:
    def __init__(self, api_key: str, workspace: str, workflow_id: str, confianca_minima: float = 0.5) -> None:
        self.api_key = api_key
        self.workspace = workspace
        self.workflow_id = workflow_id
        self.confianca_minima = confianca_minima
        self._client = None

    def carregar(self) -> None:
        if not self.api_key:
            logger.warning("ClassificadorRoboflow: Chave ROBOFLOW_API_KEY não informada. Desativado.")
            return

        try:
            self._client = InferenceHTTPClient(
                api_url="https://serverless.roboflow.com",
                api_key=self.api_key
            )
            logger.info("ClassificadorRoboflow carregado com sucesso (workspace: %s)", self.workspace)
        except Exception as e:
            logger.error("Erro ao inicializar InferenceHTTPClient do Roboflow: %s", e)

    @property
    def carregado(self) -> bool:
        return self._client is not None

    def detectar_defeitos(self, caminho_imagem: str) -> list[Defeito]:
        if not self.carregado:
            return []

        try:
            # Envia a imagem local para o workflow do Roboflow
            resultado = self._client.run_workflow(
                workspace_name=self.workspace,
                workflow_id=self.workflow_id,
                images={"image": caminho_imagem},
                parameters={"classes": "crack, corrosion, stain, mold, deterioration, moisture, exposed_rebar, spalling"},
                use_cache=True,
            )

            # De acordo com a resposta padrão do Roboflow workflow para previsões
            predicoes_brutas = resultado[0].get("predictions", {}).get("predictions", [])

            defeitos = []
            for predicao in predicoes_brutas:
                confianca = predicao.get("confidence", 0)
                classe = predicao.get("class", "desconhecido")

                # Ignora baixa confiança
                if confianca < self.confianca_minima:
                    continue

                # "no crack" é o modelo confirmando que aquele trecho está
                # íntegro — não é um defeito, então não deve virar item na
                # lista nem contar na pontuação de risco.
                if classe == "no crack":
                    continue

                # width * height = área aproximada na imagem
                area = predicao.get("width", 0) * predicao.get("height", 0)

                defeitos.append({
                    "classe": classe,
                    "confianca": confianca,
                    "area": area,
                })

            return defeitos
        except Exception as e:
            logger.error("Erro ao rodar workflow no Roboflow para %s: %s", caminho_imagem, e)
            raise e

    def calcular_risco_da_foto(self, defeitos: list[Defeito]) -> NivelRisco:
        if not defeitos:
            return NivelRisco.BAIXO

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
            return NivelRisco.CRITICO
        # Médio: se a soma atingir 2.0.
        elif pontuacao_total >= 2.0:
            return NivelRisco.MEDIO
        else:
            return NivelRisco.BAIXO

    def analisar_caso(self, caminhos_das_3_fotos: list[str]) -> RespostaClassificacao:
        if not self.carregado:
            raise RuntimeError("ClassificadorRoboflow não está carregado.")

        ORDEM_RISCO = {NivelRisco.BAIXO: 0, NivelRisco.MEDIO: 1, NivelRisco.CRITICO: 2}

        defeitos_por_foto = []
        riscos_por_foto = []

        for caminho in caminhos_das_3_fotos:
            defeitos = self.detectar_defeitos(caminho)
            defeitos_por_foto.append(defeitos)
            risco = self.calcular_risco_da_foto(defeitos)
            riscos_por_foto.append(risco)

        # Seleciona o pior risco entre as fotos
        risco_final = max(riscos_por_foto, key=lambda risco: ORDEM_RISCO[risco])

        # Calcula a confiança final baseado no maior nível de confiança de anomalia, ou 1.0 se limpo
        confiancas = [d["confianca"] for sublist in defeitos_por_foto for d in sublist]
        confianca_final = max(confiancas) if confiancas else 1.0

        return RespostaClassificacao(
            risco=risco_final,
            confianca=confianca_final,
            incerto=False,
            versao_modelo=f"roboflow-{self.workflow_id}",
            probabilidades={
                r.value: 1.0 if r == risco_final else 0.0 for r in NivelRisco
            }
        )

"""Classificação local com MobileNetV2 e consolidação de três perspectivas.

O percentual softmax mede confiança da rede, não risco estrutural. O nível
final é calculado separadamente, combinando as três fotos e sinais observáveis
informados pelo cidadão. Uma foto macro isolada nunca promove o caso a crítico.
"""

from __future__ import annotations

import io
import logging
from pathlib import Path
from threading import Lock

import numpy as np
from PIL import Image, ImageOps

from app.schemas import NivelRisco, RespostaClassificacao

logger = logging.getLogger(__name__)

TAMANHO_ENTRADA = (224, 224)
CLASSES_MODELO = ("baixo", "critico", "medio", "sem_risco")

# A visão geral vale mais porque preserva o contexto. O close-up vale menos:
# nele uma fissura milimétrica pode ocupar quase toda a imagem.
PESOS_PERSPECTIVAS = (0.45, 0.35, 0.20)
PESO_SEVERIDADE = {"sem_risco": 0.0, "baixo": 1.0, "medio": 2.0, "critico": 3.0}

TIPOS_COM_SINAL_ESTRUTURAL = {
    "inclinacao_muro",
    "armadura_exposta",
    "afundamento_recalque",
    "desplacamento",
}
LOCAIS_ESTRUTURAIS = {"viga_pilar", "muro_arrimo", "solo_talude"}
RUIDOS_DE_ALERTA = {"estalos", "vibracao_ao_pisar"}


class ModeloIndisponivelError(RuntimeError):
    """O modelo não foi carregado e o serviço não pode classificar."""


def preprocessar(bytes_imagem: bytes) -> np.ndarray:
    """Aplica o mesmo pré-processamento usado na API MobileNetV2 atual."""

    with Image.open(io.BytesIO(bytes_imagem)) as imagem:
        imagem = ImageOps.exif_transpose(imagem)
        imagem = imagem.convert("RGB").resize(TAMANHO_ENTRADA)
        tensor = np.asarray(imagem, dtype=np.float32) / 255.0
    return np.expand_dims(tensor, axis=0)


def _softmax(x: np.ndarray) -> np.ndarray:
    exp = np.exp(x - np.max(x))
    return exp / exp.sum()


class Classificador:
    """Carrega o `.h5` uma vez e classifica uma ou três fotos localmente."""

    def __init__(self, caminho: Path, versao: str, limiar: float) -> None:
        self.caminho = caminho
        self.versao = versao
        self.limiar = limiar
        self._modelo = None
        self._bloqueio = Lock()

    @property
    def carregado(self) -> bool:
        return self._modelo is not None

    def carregar(self) -> None:
        if not self.caminho.exists():
            logger.warning(
                "Modelo MobileNetV2 não encontrado em %s. Classificação local indisponível.",
                self.caminho,
            )
            return

        try:
            import tensorflow as tf

            self._modelo = tf.keras.models.load_model(self.caminho, compile=False)
        except ImportError:
            logger.warning(
                "TensorFlow não está instalado. Use Python 3.12 e instale requirements.txt."
            )
            return

        logger.info("MobileNetV2 %s carregada de %s", self.versao, self.caminho)

    def _prever(self, bytes_imagem: bytes) -> dict[str, float]:
        if self._modelo is None:
            raise ModeloIndisponivelError("Nenhum modelo MobileNetV2 foi carregado.")

        entrada = preprocessar(bytes_imagem)
        with self._bloqueio:
            saida = np.asarray(self._modelo.predict(entrada, verbose=0))[0]

        if saida.shape != (len(CLASSES_MODELO),):
            raise RuntimeError(
                f"Saída inesperada do modelo: {saida.shape}; esperado (4,)."
            )

        # O artefato atual termina em softmax. A proteção mantém o serviço
        # correto caso uma versão futura seja exportada com logits.
        if np.any(saida < 0) or not np.isclose(float(saida.sum()), 1.0, atol=1e-3):
            saida = _softmax(saida)

        return {classe: float(valor) for classe, valor in zip(CLASSES_MODELO, saida)}

    def classificar(self, bytes_imagem: bytes) -> RespostaClassificacao:
        """Mantém o contrato do endpoint de classificação de uma foto."""

        probabilidades = self._prever(bytes_imagem)
        classe, confianca = max(probabilidades.items(), key=lambda item: item[1])
        incerto = confianca < self.limiar

        if incerto:
            risco = None
        elif classe == "sem_risco":
            # O domínio persistido possui baixo/médio/crítico. Sem risco é
            # tratado como baixo para compatibilidade, sem inventar um enum novo.
            risco = NivelRisco.BAIXO
        else:
            risco = NivelRisco(classe)

        return RespostaClassificacao(
            risco=risco,
            confianca=confianca,
            incerto=incerto,
            versao_modelo=self.versao,
            probabilidades=probabilidades,
        )

    def analisar_caso(
        self,
        imagens: list[bytes],
        *,
        tipo_anomalia: str | None = None,
        evolucao: str | None = None,
        local_anomalia: str | None = None,
        ruido_percebido: str | None = None,
        gravidade_percebida: str | None = None,
    ) -> RespostaClassificacao:
        """Consolida três fotos sem confundir zoom com severidade física.

        Crítico exige evidência visual forte em pelo menos duas perspectivas e
        ao menos um sinal contextual de alerta. Sem essa confirmação, o nível
        visual é limitado a médio e segue para revisão humana.
        """

        if len(imagens) != 3:
            raise ValueError("A análise consolidada exige exatamente três fotos.")

        probabilidades_fotos = [self._prever(imagem) for imagem in imagens]

        probabilidades_agregadas = {
            classe: sum(
                peso * probabilidades[classe]
                for peso, probabilidades in zip(PESOS_PERSPECTIVAS, probabilidades_fotos)
            )
            for classe in CLASSES_MODELO
        }
        score_visual = sum(
            probabilidades_agregadas[classe] * PESO_SEVERIDADE[classe]
            for classe in CLASSES_MODELO
        )
        confianca = sum(
            peso * max(probabilidades.values())
            for peso, probabilidades in zip(PESOS_PERSPECTIVAS, probabilidades_fotos)
        )

        votos_criticos_fortes = sum(
            probabilidades["critico"] >= 0.80
            for probabilidades in probabilidades_fotos
        )
        sinais_contextuais = sum(
            (
                evolucao == "rapido",
                ruido_percebido in RUIDOS_DE_ALERTA,
                tipo_anomalia in TIPOS_COM_SINAL_ESTRUTURAL,
                local_anomalia in LOCAIS_ESTRUTURAIS,
                gravidade_percebida == "alto",
            )
        )

        incerto = confianca < self.limiar
        if incerto:
            risco = None
        elif (
            score_visual >= 2.45
            and votos_criticos_fortes >= 2
            and sinais_contextuais >= 1
        ):
            risco = NivelRisco.CRITICO
        elif score_visual >= 1.35:
            risco = NivelRisco.MEDIO
        else:
            risco = NivelRisco.BAIXO

        logger.info(
            "Triagem local: score_visual=%.3f, confianca=%.3f, "
            "votos_criticos=%d, sinais_contextuais=%d, risco=%s",
            score_visual,
            confianca,
            votos_criticos_fortes,
            sinais_contextuais,
            risco.value if risco else "incerto",
        )

        return RespostaClassificacao(
            risco=risco,
            confianca=confianca,
            incerto=incerto,
            versao_modelo=f"{self.versao}-3v-contexto-v1",
            probabilidades=probabilidades_agregadas,
        )

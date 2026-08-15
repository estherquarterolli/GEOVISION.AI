"""Classificação de risco estrutural a partir de uma imagem.

ESTADO ATUAL (Sprint 1): esqueleto sem modelo treinado.

O modelo MobileNetV2 é treinado no Sprint 5, sobre o dataset rotulado do
Sprint 3. Até lá, `Classificador.carregar()` não encontra o arquivo .onnx e o
serviço opera em modo degradado: `/classify` responde 503 explicitamente em
vez de devolver um número inventado.

Essa escolha é deliberada. Um stub que retorna risco aleatório ou fixo
atravessaria o pipeline inteiro parecendo funcionar, e o erro só apareceria na
validação em campo — quando já estaria integrado ao painel da Defesa Civil.
Falhar alto é mais barato agora.

O pré-processamento abaixo já está no formato que o MobileNetV2 espera, então
o Sprint 6 só precisa colocar o arquivo do modelo no lugar.
"""

from __future__ import annotations

import io
import logging
from pathlib import Path

import numpy as np
from PIL import Image

from app.schemas import NivelRisco, RespostaClassificacao

logger = logging.getLogger(__name__)

# MobileNetV2 espera 224×224 RGB.
TAMANHO_ENTRADA = (224, 224)

# A ordem precisa ser idêntica à usada no treino. Se o notebook do Sprint 5
# ordenar as classes de outro jeito, as predições saem trocadas de forma
# silenciosa — verificar antes de exportar o ONNX.
CLASSES: tuple[NivelRisco, ...] = (
    NivelRisco.BAIXO,
    NivelRisco.MEDIO,
    NivelRisco.CRITICO,
)


class ModeloIndisponivelError(RuntimeError):
    """O modelo não foi carregado — o serviço não pode classificar."""


def preprocessar(bytes_imagem: bytes) -> np.ndarray:
    """Converte bytes de imagem no tensor de entrada do MobileNetV2.

    Aplica a mesma normalização do treino: escala para [-1, 1].
    """
    imagem = Image.open(io.BytesIO(bytes_imagem))

    # Fotos de celular vêm com rotação em metadado EXIF; sem corrigir, uma
    # rachadura vertical chega ao modelo deitada.
    try:
        from PIL import ImageOps

        imagem = ImageOps.exif_transpose(imagem)
    except Exception:  # metadado ausente ou corrompido não deve derrubar o envio
        logger.debug("Falha ao aplicar rotação EXIF; seguindo com a imagem original.")

    imagem = imagem.convert("RGB").resize(TAMANHO_ENTRADA, Image.Resampling.BILINEAR)

    tensor = np.asarray(imagem, dtype=np.float32)
    tensor = (tensor / 127.5) - 1.0
    return np.expand_dims(tensor, axis=0)  # (1, 224, 224, 3)


class Classificador:
    """Carrega o modelo ONNX uma vez e serve predições."""

    def __init__(self, caminho: Path, versao: str, limiar: float) -> None:
        self.caminho = caminho
        self.versao = versao
        self.limiar = limiar
        self._sessao = None

    @property
    def carregado(self) -> bool:
        return self._sessao is not None

    def carregar(self) -> None:
        """Carrega o modelo, se existir.

        Não levanta exceção quando o arquivo falta: o serviço precisa subir
        mesmo sem modelo para que /health e os webhooks continuem funcionando
        durante os Sprints 1 a 5.
        """
        if not self.caminho.exists():
            logger.warning(
                "Modelo não encontrado em %s. /classify responderá 503 até o "
                "Sprint 5 exportar o arquivo treinado.",
                self.caminho,
            )
            return

        import onnxruntime as ort

        self._sessao = ort.InferenceSession(
            str(self.caminho), providers=["CPUExecutionProvider"]
        )
        logger.info("Modelo %s carregado de %s", self.versao, self.caminho)

    def classificar(self, bytes_imagem: bytes) -> RespostaClassificacao:
        if self._sessao is None:
            raise ModeloIndisponivelError(
                "Nenhum modelo treinado carregado neste serviço."
            )

        entrada = preprocessar(bytes_imagem)
        nome_entrada = self._sessao.get_inputs()[0].name
        saida = self._sessao.run(None, {nome_entrada: entrada})[0][0]

        probabilidades = _softmax(saida)
        indice = int(np.argmax(probabilidades))
        confianca = float(probabilidades[indice])
        incerto = confianca < self.limiar

        return RespostaClassificacao(
            # Abaixo do limiar não devolvemos palpite: a Defesa Civil recebe o
            # alerta sem sugestão de risco e decide na triagem humana.
            risco=None if incerto else CLASSES[indice],
            confianca=confianca,
            incerto=incerto,
            versao_modelo=self.versao,
            probabilidades={
                classe.value: float(p) for classe, p in zip(CLASSES, probabilidades)
            },
        )


def _softmax(x: np.ndarray) -> np.ndarray:
    """Softmax numericamente estável.

    Aplicado aqui porque o modelo exportado termina em logits. Se o Sprint 5
    exportar o ONNX já com camada softmax, esta função vira redundante —
    conferir na integração.
    """
    exp = np.exp(x - np.max(x))
    return exp / exp.sum()

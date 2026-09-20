"""API de triagem de fissuras do GeoVision.AI.

Executar em desenvolvimento, a partir da raiz do projeto:
    uvicorn main:app --reload
"""

from __future__ import annotations

from io import BytesIO
from pathlib import Path
from threading import Lock
from typing import Annotated, Final, Literal

import numpy as np
import tensorflow as tf
from fastapi import FastAPI, File, HTTPException, UploadFile, status
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool


TipoRisco = Literal["baixo", "critico", "medio", "sem_risco"]
TipoAcao = Literal["ACIONAR_DEFESA_CIVIL", "MONITORAMENTO_COMUNITARIO"]

CAMINHO_MODELO: Final[Path] = (
    Path(__file__).resolve().parent / "geovision_model_pronto.h5"
)
TAMANHO_IMAGEM: Final[tuple[int, int]] = (224, 224)
LIMITE_ARQUIVO_BYTES: Final[int] = 15 * 1024 * 1024  # 15 MiB por imagem

# O ImageDataGenerator/Keras ordenou as pastas de classes alfabeticamente.
indice_para_nome: Final[dict[int, TipoRisco]] = {
    0: "baixo",
    1: "critico",
    2: "medio",
    3: "sem_risco",
}

# Regra do pior cenário: quanto maior o peso, maior o risco estrutural.
peso_risco: Final[dict[TipoRisco, int]] = {
    "sem_risco": 0,
    "baixo": 1,
    "medio": 2,
    "critico": 3,
}


class AnaliseDetalhada(BaseModel):
    """Classificação individual de cada perspectiva enviada."""

    vista_3_metros: TipoRisco
    vista_1_metro: TipoRisco
    macro_30_centimetros: TipoRisco


class RespostaTriagem(BaseModel):
    """Contrato de sucesso do endpoint de triagem."""

    status: Literal["sucesso"]
    classificacao_geral: TipoRisco
    acao_recomendada: TipoAcao
    analise_detalhada: AnaliseDetalhada


class ImagemInvalidaError(ValueError):
    """Indica que os bytes recebidos não representam uma imagem válida."""


if not CAMINHO_MODELO.is_file():
    raise FileNotFoundError(
        f"Modelo não encontrado em '{CAMINHO_MODELO}'. "
        "Coloque geovision_model_pronto.h5 na mesma pasta de main.py."
    )

# O modelo é carregado uma única vez, durante a importação/inicialização da API.
# compile=False evita carregar estado de treino desnecessário para inferência.
modelo = tf.keras.models.load_model(CAMINHO_MODELO, compile=False)

# Serializa chamadas concorrentes ao mesmo modelo TensorFlow.
_bloqueio_inferencia = Lock()

app = FastAPI(
    title="GeoVision.AI — Triagem de Anomalias Estruturais",
    description=(
        "Classifica três perspectivas de uma fissura e aplica a regra do pior "
        "cenário para apoiar a triagem da Defesa Civil. O resultado não "
        "substitui uma vistoria técnica."
    ),
    version="1.0.0",
)


def preparar_imagem(arquivo_bytes: bytes) -> np.ndarray:
    """Converte bytes de imagem no batch normalizado esperado pela MobileNetV2.

    Args:
        arquivo_bytes: Conteúdo binário integral do arquivo enviado.

    Returns:
        Array ``float32`` com formato ``(1, 224, 224, 3)``.

    Raises:
        ImagemInvalidaError: Se os bytes não puderem ser decodificados como imagem.
    """

    try:
        with Image.open(BytesIO(arquivo_bytes)) as imagem:
            imagem_rgb = imagem.convert("RGB")
            imagem_redimensionada = imagem_rgb.resize(TAMANHO_IMAGEM)
            img = np.asarray(imagem_redimensionada, dtype=np.float32) / 255.0
    except (UnidentifiedImageError, OSError, ValueError) as erro:
        raise ImagemInvalidaError("O arquivo enviado não é uma imagem válida.") from erro

    return np.expand_dims(img, axis=0)


def _classificar_imagem(arquivo_bytes: bytes) -> TipoRisco:
    """Pré-processa uma imagem e traduz a classe vencedora do modelo."""

    imagem_preparada = preparar_imagem(arquivo_bytes)

    with _bloqueio_inferencia:
        previsoes = modelo.predict(imagem_preparada, verbose=0)

    indice_vencedor = int(np.argmax(previsoes[0]))
    try:
        return indice_para_nome[indice_vencedor]
    except KeyError as erro:
        raise RuntimeError(
            f"O modelo retornou o índice de classe inesperado {indice_vencedor}."
        ) from erro


async def _ler_upload(arquivo: UploadFile, nome_campo: str) -> bytes:
    """Lê um upload com limite de tamanho para proteger a memória da API."""

    conteudo = await arquivo.read(LIMITE_ARQUIVO_BYTES + 1)

    if not conteudo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"O campo '{nome_campo}' está vazio.",
        )

    if len(conteudo) > LIMITE_ARQUIVO_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"O campo '{nome_campo}' excede o limite de 15 MiB.",
        )

    return conteudo


@app.post(
    "/api/triagem/analisar-fissura",
    response_model=RespostaTriagem,
    status_code=status.HTTP_200_OK,
    tags=["triagem"],
    summary="Analisa três perspectivas de uma fissura",
)
async def analisar_fissura(
    foto_3m: Annotated[UploadFile, File(description="Foto tirada a 3 metros")],
    foto_1m: Annotated[UploadFile, File(description="Foto tirada a 1 metro")],
    foto_30cm: Annotated[
        UploadFile, File(description="Foto macro tirada a 30 centímetros")
    ],
) -> RespostaTriagem:
    """Classifica as três fotos e retorna a perspectiva de maior risco."""

    uploads = (
        ("foto_3m", "vista_3_metros", foto_3m),
        ("foto_1m", "vista_1_metro", foto_1m),
        ("foto_30cm", "macro_30_centimetros", foto_30cm),
    )
    resultados: dict[str, TipoRisco] = {}

    for nome_campo, chave_resposta, arquivo in uploads:
        try:
            arquivo_bytes = await _ler_upload(arquivo, nome_campo)
            resultado = await run_in_threadpool(_classificar_imagem, arquivo_bytes)
        except ImagemInvalidaError as erro:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"O campo '{nome_campo}' não contém uma imagem válida.",
            ) from erro
        finally:
            await arquivo.close()

        resultados[chave_resposta] = resultado

    analise_detalhada = AnaliseDetalhada(**resultados)
    classificacao_geral = max(
        resultados.values(),
        key=lambda classificacao: peso_risco[classificacao],
    )

    acao_recomendada: TipoAcao = (
        "ACIONAR_DEFESA_CIVIL"
        if classificacao_geral in {"medio", "critico"}
        else "MONITORAMENTO_COMUNITARIO"
    )

    return RespostaTriagem(
        status="sucesso",
        classificacao_geral=classificacao_geral,
        acao_recomendada=acao_recomendada,
        analise_detalhada=analise_detalhada,
    )

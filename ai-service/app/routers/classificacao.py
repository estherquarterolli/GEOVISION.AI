"""Endpoint de classificação de risco."""

from __future__ import annotations

import logging

from fastapi import APIRouter, File, HTTPException, Request, UploadFile, status

from app.schemas import RespostaClassificacao
from app.services.classificador import ModeloIndisponivelError

logger = logging.getLogger(__name__)

roteador = APIRouter(tags=["classificação"])

# Fotos de celular passam de 5 MB com facilidade. O limite protege a memória
# do plano gratuito de hospedagem; o frontend deve comprimir antes de enviar.
TAMANHO_MAXIMO_BYTES = 8 * 1024 * 1024

TIPOS_ACEITOS = {"image/jpeg", "image/png", "image/webp", "image/heic"}


@roteador.post(
    "/classify",
    response_model=RespostaClassificacao,
    summary="Classifica o risco estrutural de uma foto",
)
async def classificar(
    request: Request, imagem: UploadFile = File(..., description="Foto da anomalia")
) -> RespostaClassificacao:
    if imagem.content_type not in TIPOS_ACEITOS:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Formato não suportado: {imagem.content_type}. "
            f"Aceitos: {', '.join(sorted(TIPOS_ACEITOS))}.",
        )

    conteudo = await imagem.read()

    if not conteudo:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Arquivo vazio.")

    if len(conteudo) > TAMANHO_MAXIMO_BYTES:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Imagem acima de {TAMANHO_MAXIMO_BYTES // 1024 // 1024} MB.",
        )

    classificador = request.app.state.classificador

    try:
        return classificador.classificar(conteudo)
    except ModeloIndisponivelError as erro:
        # 503, não 500: é indisponibilidade conhecida e temporária (o modelo
        # chega no Sprint 5), e o cliente pode tentar de novo depois.
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Serviço de classificação indisponível: {erro}",
        ) from erro
    except Exception as erro:
        logger.exception("Erro inesperado ao classificar imagem.")
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Falha ao processar a imagem.",
        ) from erro

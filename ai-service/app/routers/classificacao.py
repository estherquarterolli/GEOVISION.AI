"""Endpoint de classificação de risco."""

from __future__ import annotations

import logging

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile, status

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


@roteador.post(
    "/analisar",
    summary="Analisa o risco estrutural e a prioridade de um caso a partir de 3 fotos",
)
async def analisar(
    request: Request,
    imagem1: UploadFile = File(..., description="Foto 1: Visão Geral"),
    imagem2: UploadFile = File(..., description="Foto 2: Detalhe"),
    imagem3: UploadFile = File(..., description="Foto 3: Close-up com escala"),
    piorando_rapido: bool = Form(..., description="Se a anomalia está progredindo rapidamente"),
    tem_moradores_no_local: bool = Form(..., description="Se há moradores residindo no local afetado"),
    tempo_percebido_dias: int = Form(..., description="Tempo de percepção da anomalia em dias"),
):
    import os
    import uuid
    from app.db import UPLOADS_DIR
    from app.services.risco import analisar_caso, calcular_prioridade

    imagens = [imagem1, imagem2, imagem3]
    for imagem in imagens:
        if imagem.content_type not in TIPOS_ACEITOS:
            raise HTTPException(
                status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail=f"Formato não suportado: {imagem.content_type}. "
                f"Aceitos: {', '.join(sorted(TIPOS_ACEITOS))}.",
            )

    pasta_temp = UPLOADS_DIR / "temp"
    pasta_temp.mkdir(parents=True, exist_ok=True)

    caminhos_locais = []
    try:
        # Salva temporariamente os 3 arquivos
        for imagem in imagens:
            conteudo = await imagem.read()
            if not conteudo:
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    detail="Uma ou mais imagens enviadas estão vazias.",
                )

            nome_unico = f"temp_{uuid.uuid4()}.jpg"
            caminho_local = pasta_temp / nome_unico
            with open(caminho_local, "wb") as f:
                f.write(conteudo)
            caminhos_locais.append(str(caminho_local))

        # Roda a análise de defeitos e riscos
        resultado = analisar_caso(caminhos_locais)
        risco_final = resultado["risco_final"]

        # Calcula a prioridade da vistoria
        prioridade = calcular_prioridade(
            risco_final=risco_final,
            piorando_rapido=piorando_rapido,
            tem_moradores_no_local=tem_moradores_no_local,
            tempo_percebido_dias=tempo_percebido_dias,
        )

        return {
            "risco_final": risco_final,
            "prioridade": prioridade,
            "risco_por_foto": resultado["risco_por_foto"],
            "defeitos_por_foto": resultado["defeitos_por_foto"],
        }
    except Exception as erro:
        logger.exception("Erro inesperado na análise de risco múltipla.")
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Falha na análise: {erro}",
        ) from erro
    finally:
        # Garante a limpeza dos arquivos temporários
        for caminho in caminhos_locais:
            try:
                if os.path.exists(caminho):
                    os.remove(caminho)
            except Exception as erro_clean:
                logger.error(f"Erro ao limpar arquivo temporário {caminho}: {erro_clean}")


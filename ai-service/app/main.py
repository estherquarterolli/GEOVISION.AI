"""GeoVision.AI — serviço de classificação de risco estrutural.

Mantido separado do backend principal (Supabase) porque inferência de IA tem
perfil de recurso diferente do resto do sistema e precisa escalar sozinha.

Executar em desenvolvimento:
    uvicorn app.main:app --reload
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import obter_config
from app.routers import classificacao, webhooks, auth, alertas, admin
from app.schemas import RespostaSaude
from app.services.classificador import Classificador
from app.db import inicializar_banco, UPLOADS_DIR

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def ciclo_de_vida(app: FastAPI):
    """Carrega o modelo uma vez, na subida.

    Carregar por requisição adicionaria centenas de milissegundos a cada foto
    enviada.
    """
    # Inicializa banco de dados local SQLite
    inicializar_banco()
    logger.info("Banco de dados SQLite inicializado.")

    config = obter_config()
    app.state.config = config

    classificador = Classificador(
        caminho=config.caminho_modelo,
        versao=config.versao_modelo,
        limiar=config.limiar_confianca,
    )
    classificador.carregar()
    app.state.classificador = classificador

    from app.services.classificador_roboflow import ClassificadorRoboflow
    classificador_roboflow = ClassificadorRoboflow(
        api_key=config.roboflow_api_key,
        workspace=config.roboflow_workspace,
        workflow_id=config.roboflow_workflow_id,
        confianca_minima=0.5
    )
    classificador_roboflow.carregar()
    app.state.classificador_roboflow = classificador_roboflow

    logger.info(
        "Serviço iniciado (ambiente=%s, modelo_carregado=%s, roboflow_carregado=%s)",
        config.ambiente,
        classificador.carregado,
        classificador_roboflow.carregado,
    )
    yield
    logger.info("Serviço encerrado.")


app = FastAPI(
    title="GeoVision.AI — Serviço de Classificação",
    description=(
        "Classifica o risco estrutural (baixo/médio/crítico) de fotos enviadas "
        "por cidadãos e notifica a Defesa Civil em casos críticos.\n\n"
        "A classificação é estimativa de apoio à priorização e **não substitui** "
        "vistoria técnica oficial."
    ),
    version="0.1.0",
    lifespan=ciclo_de_vida,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=obter_config().origens_permitidas,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Servir fotos locais estaticamente
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

app.include_router(classificacao.roteador)
app.include_router(webhooks.roteador)
app.include_router(auth.roteador)
app.include_router(alertas.roteador)
app.include_router(admin.roteador)



@app.get("/health", response_model=RespostaSaude, tags=["infra"])
async def saude() -> RespostaSaude:
    """Checagem de saúde para a hospedagem e para depuração local.

    Expõe modelo_carregado porque o serviço sobe de propósito mesmo sem
    modelo (Sprints 1–4) — sem esse campo não daria para distinguir "no ar e
    pronto" de "no ar mas sem classificar".
    """
    config = obter_config()
    classificador = app.state.classificador
    return RespostaSaude(
        status="ok",
        ambiente=config.ambiente,
        modelo_carregado=classificador.carregado,
        versao_modelo=config.versao_modelo,
    )

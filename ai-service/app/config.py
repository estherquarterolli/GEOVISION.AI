"""Configuração do serviço, lida do ambiente."""

import logging
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)

RAIZ = Path(__file__).resolve().parent.parent

# Usado só quando SEGREDO_JWT está vazio fora de produção, para que
# `uvicorn app.main:app --reload` continue funcionando sem configuração.
# É público por definição — está aqui, no repositório.
_SEGREDO_DESENVOLVIMENTO = "geovision-desenvolvimento-nao-use-em-producao"


class Config(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    ambiente: str = "desenvolvimento"

    # --- Modelo --------------------------------------------------------------
    caminho_modelo: Path = RAIZ / "models" / "geovision_model_pronto.h5"
    # Gravado junto de cada classificação em alertas.modelo_versao. Sem isso,
    # um erro de classificação vira impossível de auditar depois de um retreino.
    versao_modelo: str = "sem-modelo"
    # Abaixo deste limiar a predição é considerada incerta e o alerta segue
    # para triagem humana sem sugestão de risco, em vez de exibir um palpite
    # fraco como se fosse conclusão.
    limiar_confianca: float = 0.60

    # --- Sessão --------------------------------------------------------------
    # Assina os JWTs de login. Vazio só é tolerado em desenvolvimento: em
    # produção o serviço se recusa a subir, porque um segredo vazio deixaria
    # qualquer pessoa forjar um token de Defesa Civil.
    segredo_jwt: str = ""
    expiracao_token_horas: int = 72

    # --- Supabase ------------------------------------------------------------
    supabase_url: str = ""
    # Chave service_role: ignora RLS. Só pode existir no servidor, nunca no
    # frontend.
    supabase_service_key: str = ""

    # --- Webhooks ------------------------------------------------------------
    # Segredo compartilhado com o Database Webhook do Supabase. Sem ele,
    # qualquer pessoa poderia disparar notificação de alerta crítico.
    webhook_secret: str = ""

    # --- Notificações --------------------------------------------------------
    resend_api_key: str = ""
    email_remetente: str = "alertas@geovision.ai"
    email_defesa_civil: str = ""
    whatsapp_token: str = ""
    whatsapp_phone_id: str = ""
    whatsapp_destino: str = ""

    # --- CORS ----------------------------------------------------------------
    # Em produção o nginx serve o frontend e a API na mesma origem, então a
    # lista fica vazia e nenhuma origem externa é liberada. Só preencha se
    # algum cliente for hospedado em outro domínio.
    origens_permitidas: list[str] = [
        "http://localhost:5180",
        "http://127.0.0.1:5180",
    ]

    @property
    def em_producao(self) -> bool:
        return self.ambiente.lower() in ("producao", "produção", "production")


class ConfiguracaoInvalidaError(RuntimeError):
    """Configuração insegura ou incompleta — o serviço não deve subir."""


@lru_cache
def obter_config() -> Config:
    config = Config()

    # Falhar na subida, não na primeira requisição: um deploy que sobe "ok" e
    # só quebra quando o primeiro cidadão tenta entrar é pior de diagnosticar
    # do que um container que se recusa a iniciar com a causa no log.
    if not config.segredo_jwt:
        if config.em_producao:
            raise ConfiguracaoInvalidaError(
                "SEGREDO_JWT vazio com AMBIENTE=producao. Gere um segredo longo "
                "(openssl rand -hex 32) e defina-o no .env do servidor."
            )
        logger.warning(
            "SEGREDO_JWT vazio — usando o segredo de desenvolvimento. "
            "Qualquer pessoa pode forjar um token. Nunca use assim em produção."
        )
        config = config.model_copy(update={"segredo_jwt": _SEGREDO_DESENVOLVIMENTO})

    return config

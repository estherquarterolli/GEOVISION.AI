"""Configuração do serviço, lida do ambiente."""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

RAIZ = Path(__file__).resolve().parent.parent


class Config(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    ambiente: str = "desenvolvimento"

    # --- Modelo --------------------------------------------------------------
    caminho_modelo: Path = RAIZ / "models" / "geovision-risco.onnx"
    # Gravado junto de cada classificação em alertas.modelo_versao. Sem isso,
    # um erro de classificação vira impossível de auditar depois de um retreino.
    versao_modelo: str = "sem-modelo"
    # Abaixo deste limiar a predição é considerada incerta e o alerta segue
    # para triagem humana sem sugestão de risco, em vez de exibir um palpite
    # fraco como se fosse conclusão.
    limiar_confianca: float = 0.60

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
    origens_permitidas: list[str] = ["http://localhost:5180"]


@lru_cache
def obter_config() -> Config:
    return Config()

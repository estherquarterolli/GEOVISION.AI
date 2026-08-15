"""Webhooks disparados pelo banco (Supabase Database Webhooks).

Fluxo 1 — alerta crítico: trigger no INSERT/UPDATE de `alertas` chama
`/webhooks/alerta-critico`, que notifica a Defesa Civil por e-mail/WhatsApp.

Fluxo 2 — mudança de status: o cidadão é notificado dentro do próprio app via
Supabase Realtime, sem canal externo. O endpoint existe para registrar o
evento e permitir acrescentar e-mail depois, se a validação em campo mostrar
que a notificação in-app não basta.
"""

from __future__ import annotations

import hmac
import logging

from fastapi import APIRouter, BackgroundTasks, Header, HTTPException, Request, status

from app.schemas import EntradaWebhookAlerta, NivelRisco
from app.services.notificacoes import notificar_alerta_critico

logger = logging.getLogger(__name__)

roteador = APIRouter(prefix="/webhooks", tags=["webhooks"])


def _conferir_segredo(config, recebido: str | None) -> None:
    """Valida o segredo compartilhado.

    Usa compare_digest para não vazar o segredo por tempo de resposta.
    """
    if not config.webhook_secret:
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="WEBHOOK_SECRET não configurado no serviço.",
        )

    if not recebido or not hmac.compare_digest(recebido, config.webhook_secret):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Segredo inválido.")


@roteador.post("/alerta-critico", status_code=status.HTTP_202_ACCEPTED)
async def alerta_critico(
    request: Request,
    corpo: EntradaWebhookAlerta,
    tarefas: BackgroundTasks,
    x_webhook_secret: str | None = Header(default=None),
) -> dict[str, str]:
    config = request.app.state.config
    _conferir_segredo(config, x_webhook_secret)

    if corpo.nivel_risco is not None and corpo.nivel_risco != NivelRisco.CRITICO:
        return {"status": "ignorado", "motivo": "alerta não é crítico"}

    # Responde 202 imediatamente e envia em segundo plano: o webhook do
    # Supabase tem timeout curto, e um provedor de e-mail lento não pode
    # causar retry em cascata do banco.
    tarefas.add_task(
        notificar_alerta_critico,
        config,
        corpo.alerta_id,
        None,
        None,
    )

    logger.info("Notificação de alerta crítico agendada: %s", corpo.alerta_id)
    return {"status": "agendado", "alerta_id": corpo.alerta_id}


@roteador.post("/status-atualizado", status_code=status.HTTP_202_ACCEPTED)
async def status_atualizado(
    request: Request,
    corpo: EntradaWebhookAlerta,
    x_webhook_secret: str | None = Header(default=None),
) -> dict[str, str]:
    config = request.app.state.config
    _conferir_segredo(config, x_webhook_secret)

    # O app do cidadão já recebe a mudança por Supabase Realtime; aqui apenas
    # registramos. Ponto de extensão para e-mail, se o teste de usabilidade do
    # Sprint 10 indicar necessidade.
    logger.info(
        "Status do alerta %s mudou para %s", corpo.alerta_id, corpo.status
    )
    return {"status": "registrado", "alerta_id": corpo.alerta_id}

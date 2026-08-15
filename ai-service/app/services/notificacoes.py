"""Envio de notificações para a Defesa Civil.

Substitui o n8n previsto originalmente: o gatilho vem do próprio banco
(Database Webhook do Supabase) e o envio acontece aqui, dentro do serviço
FastAPI que já existe para hospedar o modelo. Uma peça de infraestrutura a
menos para manter.

Canais:
  - E-mail (Resend) — canal principal, funciona desde o primeiro dia.
  - WhatsApp (Cloud API da Meta) — opcional; a aprovação da conta comercial
    costuma demorar, então o serviço trata a ausência de credencial como
    configuração válida e segue só com e-mail, em vez de falhar.
"""

from __future__ import annotations

import logging

import httpx

from app.config import Config

logger = logging.getLogger(__name__)

TIMEOUT = httpx.Timeout(10.0)


async def notificar_alerta_critico(
    config: Config, alerta_id: str, bairro: str | None, confianca: float | None
) -> dict[str, bool]:
    """Dispara os canais configurados. Retorna o que efetivamente foi enviado.

    Uma falha de canal não derruba os outros: se o WhatsApp cair, o e-mail
    ainda precisa sair. Por isso cada envio é isolado.
    """
    local = bairro or "localização não identificada"
    pct = f"{confianca:.0%}" if confianca is not None else "n/d"

    assunto = f"[GeoVision.AI] Alerta CRÍTICO em {local}"
    corpo = (
        f"Um novo alerta classificado como CRÍTICO foi registrado.\n\n"
        f"Alerta: {alerta_id}\n"
        f"Local: {local}\n"
        f"Confiança da IA: {pct}\n\n"
        f"Acesse o painel para triagem.\n\n"
        f"— Classificação automática, sujeita a erro. Não substitui vistoria técnica."
    )

    return {
        "email": await _enviar_email(config, assunto, corpo),
        "whatsapp": await _enviar_whatsapp(config, assunto),
    }


async def _enviar_email(config: Config, assunto: str, corpo: str) -> bool:
    if not config.resend_api_key or not config.email_defesa_civil:
        logger.info("E-mail não configurado; envio ignorado.")
        return False

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as cliente:
            resposta = await cliente.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {config.resend_api_key}"},
                json={
                    "from": config.email_remetente,
                    "to": [config.email_defesa_civil],
                    "subject": assunto,
                    "text": corpo,
                },
            )
            resposta.raise_for_status()
            return True
    except httpx.HTTPError:
        logger.exception("Falha ao enviar e-mail de alerta crítico.")
        return False


async def _enviar_whatsapp(config: Config, texto: str) -> bool:
    if not (config.whatsapp_token and config.whatsapp_phone_id and config.whatsapp_destino):
        logger.info("WhatsApp não configurado; envio ignorado.")
        return False

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as cliente:
            resposta = await cliente.post(
                f"https://graph.facebook.com/v21.0/{config.whatsapp_phone_id}/messages",
                headers={"Authorization": f"Bearer {config.whatsapp_token}"},
                json={
                    "messaging_product": "whatsapp",
                    "to": config.whatsapp_destino,
                    "type": "text",
                    "text": {"body": texto},
                },
            )
            resposta.raise_for_status()
            return True
    except httpx.HTTPError:
        logger.exception("Falha ao enviar WhatsApp de alerta crítico.")
        return False

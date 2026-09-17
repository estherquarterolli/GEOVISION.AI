"""Autenticação: hash de senha e tokens de sessão.

Antes do deploy o "token" devolvido pelo login era o próprio UUID do usuário,
gravado em claro no localStorage. Qualquer pessoa que descobrisse um id de
usuário — eles aparecem em `alertas.usuario_id` e no caminho das fotos em
/uploads/<usuario_id>/<foto>.jpg — assumia a sessão daquele usuário. O token
também não expirava nunca.

Aqui o token vira um JWT assinado com SEGREDO_JWT, com expiração, e o papel
do usuário viaja dentro dele assinado, para que as rotas da Defesa Civil
possam confiar no papel sem reconsultar o banco a cada requisição.
"""

from __future__ import annotations

import datetime
import logging
from dataclasses import dataclass

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import obter_config

logger = logging.getLogger(__name__)

ALGORITMO = "HS256"

PAPEIS_DEFESA_CIVIL = ("defesa_civil", "admin")


@dataclass(frozen=True)
class Sessao:
    """Identidade extraída do token, já validada."""

    usuario_id: str
    papel: str


def criar_token(usuario_id: str, papel: str) -> str:
    config = obter_config()
    agora = datetime.datetime.now(datetime.timezone.utc)
    carga = {
        "sub": usuario_id,
        "papel": papel,
        "iat": agora,
        "exp": agora + datetime.timedelta(hours=config.expiracao_token_horas),
    }
    return jwt.encode(carga, config.segredo_jwt, algorithm=ALGORITMO)


def decodificar_token(token: str) -> Sessao:
    config = obter_config()
    try:
        carga = jwt.decode(token, config.segredo_jwt, algorithms=[ALGORITMO])
    except jwt.ExpiredSignatureError as erro:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            detail="Sessão expirada. Entre novamente.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from erro
    except jwt.InvalidTokenError as erro:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            detail="Sessão inválida.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from erro

    usuario_id = carga.get("sub")
    if not usuario_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Sessão inválida.")

    return Sessao(usuario_id=usuario_id, papel=carga.get("papel", "cidadao"))


_esquema_bearer = HTTPBearer(auto_error=False)


def sessao_atual(
    credenciais: HTTPAuthorizationCredentials | None = Depends(_esquema_bearer),
) -> Sessao:
    """Exige um Bearer token válido. Use como dependência das rotas privadas."""
    if credenciais is None:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            detail="Autenticação necessária.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return decodificar_token(credenciais.credentials)


def exigir_defesa_civil(sessao: Sessao = Depends(sessao_atual)) -> Sessao:
    """Restringe a rota à equipe da Defesa Civil.

    403 e não 404: o usuário está autenticado e a rota existe — esconder isso
    só dificultaria o suporte, já que a existência do painel é pública.
    """
    if sessao.papel not in PAPEIS_DEFESA_CIVIL:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="Esta área é exclusiva da equipe da Defesa Civil.",
        )
    return sessao

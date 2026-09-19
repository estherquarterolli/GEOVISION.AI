"""Roteador de Governança, Gestão de Usuários e Painel Super Admin.

Recursos exclusivos para administradores e para a Super Administradora
Master (estherquarterollii@gmail.com).
"""

from __future__ import annotations

import datetime
import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr

from app.db import (
    gerar_hash_senha,
    obter_conexao,
    registrar_log_auditoria,
)
from app.security import Sessao, exigir_defesa_civil, sessao_atual

SUPER_ADMIN_EMAIL = "estherquarterollii@gmail.com"

roteador = APIRouter(prefix="/api/admin", tags=["admin"])


class UsuarioItem(BaseModel):
    id: str
    nome: str
    email: str
    papel: str
    bairro_texto: str | None = None
    termos_aceitos_em: str | None = None
    criado_em: str


class CriarUsuarioRequisicao(BaseModel):
    nome: str
    email: EmailStr
    senha: str
    papel: Literal["cidadao", "defesa_civil", "admin"] = "admin"
    bairro_texto: str | None = None


class AlterarPapelRequisicao(BaseModel):
    papel: Literal["cidadao", "defesa_civil", "admin"]


class LogAuditoriaItem(BaseModel):
    id: str
    usuario_id: str | None = None
    usuario_email: str | None = None
    acao: str
    detalhes: str | None = None
    ip_origem: str | None = None
    criado_em: str


async def exigir_super_admin(sessao: Sessao = Depends(sessao_atual)) -> Sessao:
    """Garante que a ação só pode ser executada pela Super Administradora Master."""
    with obter_conexao() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT email, papel FROM usuarios WHERE id = ?", (sessao.usuario_id,))
        usuario = cursor.fetchone()

        if not usuario or usuario["email"].strip().lower() != SUPER_ADMIN_EMAIL.lower():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acesso negado: Ação exclusiva da Super Administradora Master.",
            )
    return sessao


@roteador.get("/usuarios", response_model=list[UsuarioItem])
async def listar_usuarios(
    sessao: Sessao = Depends(exigir_defesa_civil),
) -> list[UsuarioItem]:
    """Lista todos os usuários cadastrados no sistema."""
    with obter_conexao() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, nome, email, papel, bairro_texto, termos_aceitos_em, criado_em
            FROM usuarios
            ORDER BY criado_em DESC
            """
        )
        return [UsuarioItem(**dict(row)) for row in cursor.fetchall()]


@roteador.post("/usuarios", response_model=UsuarioItem, status_code=status.HTTP_201_CREATED)
async def criar_usuario_admin(
    req: Request,
    dados: CriarUsuarioRequisicao,
    sessao: Sessao = Depends(exigir_super_admin),
) -> UsuarioItem:
    """Super Admin cria um novo usuário com papel administrativo ou operacional."""
    if len(dados.senha) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A senha deve ter pelo menos 8 caracteres.",
        )

    email_formatado = dados.email.strip().lower()
    agora = datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
    novo_id = str(uuid.uuid4())

    with obter_conexao() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM usuarios WHERE lower(email) = ?", (email_formatado,))
        if cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"O e-mail {email_formatado} já está cadastrado no sistema.",
            )

        cursor.execute(
            """
            INSERT INTO usuarios (id, nome, email, senha_hash, papel, bairro_texto, termos_aceitos_em, criado_em)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                novo_id,
                dados.nome.strip(),
                email_formatado,
                gerar_hash_senha(dados.senha),
                dados.papel,
                dados.bairro_texto,
                agora,
                agora,
            ),
        )
        conn.commit()

    # Log de Auditoria
    ip = req.client.host if req.client else None
    registrar_log_auditoria(
        acao="CRIAR_USUARIO",
        usuario_id=sessao.usuario_id,
        usuario_email=SUPER_ADMIN_EMAIL,
        detalhes=f"Criou usuário {email_formatado} com papel '{dados.papel}'",
        ip_origem=ip,
    )

    return UsuarioItem(
        id=novo_id,
        nome=dados.nome.strip(),
        email=email_formatado,
        papel=dados.papel,
        bairro_texto=dados.bairro_texto,
        termos_aceitos_em=agora,
        criado_em=agora,
    )


@roteador.patch("/usuarios/{usuario_id}/papel", response_model=UsuarioItem)
async def alterar_papel(
    usuario_id: str,
    dados: AlterarPapelRequisicao,
    req: Request,
    sessao: Sessao = Depends(exigir_super_admin),
) -> UsuarioItem:
    """Super Admin concede ou revoga funções/papéis de qualquer usuário."""
    with obter_conexao() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, nome, email, papel, bairro_texto, termos_aceitos_em, criado_em FROM usuarios WHERE id = ?",
            (usuario_id,),
        )
        usuario = cursor.fetchone()
        if not usuario:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Usuário não encontrado.",
            )

        # Não permitir que a Super Admin altere seu próprio papel para não perder o acesso
        if usuario["email"].strip().lower() == SUPER_ADMIN_EMAIL.lower() and dados.papel != "admin":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A conta da Super Administradora Master deve permanecer como 'admin'.",
            )

        papel_anterior = usuario["papel"]
        cursor.execute("UPDATE usuarios SET papel = ? WHERE id = ?", (dados.papel, usuario_id))
        conn.commit()

    ip = req.client.host if req.client else None
    registrar_log_auditoria(
        acao="ALTERAR_PAPEL",
        usuario_id=sessao.usuario_id,
        usuario_email=SUPER_ADMIN_EMAIL,
        detalhes=f"Alterou papel de {usuario['email']} de '{papel_anterior}' para '{dados.papel}'",
        ip_origem=ip,
    )

    return UsuarioItem(
        id=usuario["id"],
        nome=usuario["nome"],
        email=usuario["email"],
        papel=dados.papel,
        bairro_texto=usuario["bairro_texto"],
        termos_aceitos_em=usuario["termos_aceitos_em"],
        criado_em=usuario["criado_em"],
    )


@roteador.delete("/usuarios/{usuario_id}", status_code=status.HTTP_204_NO_CONTENT)
async def excluir_usuario(
    usuario_id: str,
    req: Request,
    sessao: Sessao = Depends(exigir_super_admin),
) -> None:
    """Super Admin exclui um usuário do sistema."""
    with obter_conexao() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, email FROM usuarios WHERE id = ?", (usuario_id,))
        usuario = cursor.fetchone()
        if not usuario:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado.")

        if usuario["email"].strip().lower() == SUPER_ADMIN_EMAIL.lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A conta da Super Administradora Master não pode ser excluída.",
            )

        cursor.execute("DELETE FROM alertas WHERE usuario_id = ?", (usuario_id,))
        cursor.execute("DELETE FROM usuarios WHERE id = ?", (usuario_id,))
        conn.commit()

    ip = req.client.host if req.client else None
    registrar_log_auditoria(
        acao="EXCLUIR_USUARIO",
        usuario_id=sessao.usuario_id,
        usuario_email=SUPER_ADMIN_EMAIL,
        detalhes=f"Excluiu conta de {usuario['email']} e seus dados associados",
        ip_origem=ip,
    )


@roteador.get("/logs", response_model=list[LogAuditoriaItem])
async def listar_logs(
    limite: int = 100,
    sessao: Sessao = Depends(exigir_defesa_civil),
) -> list[LogAuditoriaItem]:
    """Retorna os últimos logs de auditoria do sistema."""
    with obter_conexao() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, usuario_id, usuario_email, acao, detalhes, ip_origem, criado_em
            FROM logs_auditoria
            ORDER BY criado_em DESC
            LIMIT ?
            """,
            (limite,),
        )
        return [LogAuditoriaItem(**dict(row)) for row in cursor.fetchall()]

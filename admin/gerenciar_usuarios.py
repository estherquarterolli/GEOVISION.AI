#!/usr/bin/env python3
"""Utilitário de Administração: Gerenciamento de Usuários do GEOVISION.AI.

Permite listar, criar, promover papéis (admin, defesa_civil, cidadao),
redefinir senhas e excluir usuários diretamente no banco de dados.
"""

from __future__ import annotations

import argparse
import datetime
import getpass
import os
import sys
import uuid
from pathlib import Path

# Ajusta path para importar módulos do ai-service/app
_RAIZ_PROJETO = Path(__file__).resolve().parent.parent
_AI_SERVICE_DIR = _RAIZ_PROJETO / "ai-service"
if str(_AI_SERVICE_DIR) not in sys.path:
    sys.path.insert(0, str(_AI_SERVICE_DIR))

from app.db import (  # noqa: E402
    gerar_hash_senha,
    inicializar_banco,
    obter_conexao,
)

PAPEIS = ("cidadao", "defesa_civil", "admin")


def listar_usuarios(termo_busca: str | None = None) -> list[dict]:
    """Retorna lista de usuários cadastrados com filtros opcionais."""
    inicializar_banco()
    with obter_conexao() as conn:
        cursor = conn.cursor()
        if termo_busca:
            busca = f"%{termo_busca.strip().lower()}%"
            cursor.execute(
                """
                SELECT id, nome, email, papel, bairro_texto, criado_em, termos_aceitos_em
                FROM usuarios
                WHERE lower(email) LIKE ? OR lower(nome) LIKE ?
                ORDER BY criado_em DESC
                """,
                (busca, busca),
            )
        else:
            cursor.execute(
                """
                SELECT id, nome, email, papel, bairro_texto, criado_em, termos_aceitos_em
                FROM usuarios
                ORDER BY criado_em DESC
                """
            )
        return [dict(row) for row in cursor.fetchall()]


def criar_ou_atualizar_usuario(
    email: str,
    nome: str,
    papel: str,
    senha: str,
    bairro: str | None = None,
) -> str:
    """Cria um novo usuário ou atualiza dados/papel se o e-mail já existir."""
    if papel not in PAPEIS:
        raise ValueError(f"Papel inválido. Escolha entre: {', '.join(PAPEIS)}")
    if len(senha) < 8:
        raise ValueError("A senha deve ter pelo menos 8 caracteres.")

    email_formatado = email.strip().lower()
    agora = datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
    senha_hash = gerar_hash_senha(senha)

    inicializar_banco()
    with obter_conexao() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM usuarios WHERE lower(email) = ?", (email_formatado,))
        existente = cursor.fetchone()

        if existente:
            cursor.execute(
                """
                UPDATE usuarios
                SET nome = ?, senha_hash = ?, papel = ?, bairro_texto = coalesce(?, bairro_texto)
                WHERE id = ?
                """,
                (nome.strip(), senha_hash, papel, bairro, existente["id"]),
            )
            conn.commit()
            return f"Usuário {email_formatado} atualizado com sucesso (Papel: {papel})."
        else:
            novo_id = str(uuid.uuid4())
            cursor.execute(
                """
                INSERT INTO usuarios (id, nome, email, senha_hash, papel, bairro_texto, termos_aceitos_em, criado_em)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (novo_id, nome.strip(), email_formatado, senha_hash, papel, bairro, agora, agora),
            )
            conn.commit()
            return f"Usuário {email_formatado} criado com sucesso (ID: {novo_id}, Papel: {papel})."


def alterar_papel_usuario(email_ou_id: str, novo_papel: str) -> bool:
    """Modifica o papel de um usuário existente."""
    if novo_papel not in PAPEIS:
        raise ValueError(f"Papel inválido. Escolha entre: {', '.join(PAPEIS)}")

    identificador = email_ou_id.strip().lower()
    inicializar_banco()
    with obter_conexao() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            UPDATE usuarios
            SET papel = ?
            WHERE lower(email) = ? OR id = ?
            """,
            (novo_papel, identificador, identificador),
        )
        conn.commit()
        return cursor.rowcount > 0


def alterar_senha_usuario(email_ou_id: str, nova_senha: str) -> bool:
    """Atualiza a senha de um usuário."""
    if len(nova_senha) < 8:
        raise ValueError("A senha deve ter pelo menos 8 caracteres.")

    identificador = email_ou_id.strip().lower()
    senha_hash = gerar_hash_senha(nova_senha)

    inicializar_banco()
    with obter_conexao() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            UPDATE usuarios
            SET senha_hash = ?
            WHERE lower(email) = ? OR id = ?
            """,
            (senha_hash, identificador, identificador),
        )
        conn.commit()
        return cursor.rowcount > 0


def excluir_usuario(email_ou_id: str, excluir_alertas: bool = False) -> bool:
    """Exclui um usuário do sistema."""
    identificador = email_ou_id.strip().lower()
    inicializar_banco()
    with obter_conexao() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, email FROM usuarios WHERE lower(email) = ? OR id = ?",
            (identificador, identificador),
        )
        user = cursor.fetchone()
        if not user:
            return False

        user_id = user["id"]
        if excluir_alertas:
            cursor.execute("DELETE FROM alertas WHERE usuario_id = ?", (user_id,))

        cursor.execute("DELETE FROM usuarios WHERE id = ?", (user_id,))
        conn.commit()
        return True


def formatar_tabela_usuarios(usuarios: list[dict]) -> str:
    """Formata lista de usuários em tabela legível no terminal."""
    if not usuarios:
        return "Nenhum usuário encontrado."

    linhas = []
    linhas.append("=" * 95)
    linhas.append(f"{'NOME':<25} | {'EMAIL':<30} | {'PAPEL':<12} | {'CRIADO EM':<20}")
    linhas.append("-" * 95)
    for u in usuarios:
        nome = (u['nome'][:22] + '...') if len(u['nome']) > 25 else u['nome']
        email = (u['email'][:27] + '...') if len(u['email']) > 30 else u['email']
        papel = u.get('papel') or 'cidadao'
        criado = (u.get('criado_em') or '')[:19].replace('T', ' ')
        linhas.append(f"{nome:<25} | {email:<30} | {papel:<12} | {criado:<20}")
    linhas.append("=" * 95)
    linhas.append(f"Total: {len(usuarios)} usuário(s)")
    return "\n".join(linhas)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="comando", help="Comando a executar")

    # Listar
    p_listar = subparsers.add_parser("listar", help="Listar usuários cadastrados")
    p_listar.add_argument("--busca", "-b", help="Filtrar por nome ou e-mail")

    # Criar / Atualizar
    p_criar = subparsers.add_parser("salvar", help="Criar ou atualizar usuário")
    p_criar.add_argument("--email", "-e", required=True, help="E-mail do usuário")
    p_criar.add_argument("--nome", "-n", default="Administrador", help="Nome completo")
    p_criar.add_argument("--papel", "-p", choices=PAPEIS, default="admin", help="Papel de acesso")
    p_criar.add_argument("--bairro", help="Bairro (opcional)")

    # Promover papel
    p_papel = subparsers.add_parser("papel", help="Alterar papel de um usuário")
    p_papel.add_argument("identificador", help="E-mail ou ID do usuário")
    p_papel.add_argument("novo_papel", choices=PAPEIS, help="Novo papel")

    # Mudar senha
    p_senha = subparsers.add_parser("senha", help="Redefinir senha de usuário")
    p_senha.add_argument("identificador", help="E-mail ou ID do usuário")

    # Excluir
    p_del = subparsers.add_parser("excluir", help="Excluir usuário")
    p_del.add_argument("identificador", help="E-mail ou ID do usuário")
    p_del.add_argument("--com-alertas", action="store_true", help="Excluir também alertas vinculados")

    args = parser.parse_args()

    if not args.comando or args.comando == "listar":
        termo = getattr(args, "busca", None)
        usuarios = listar_usuarios(termo)
        print(formatar_tabela_usuarios(usuarios))
        return 0

    if args.comando == "salvar":
        senha = getpass.getpass("Digite a senha (mínimo 8 caracteres): ")
        if len(senha) < 8:
            print("Erro: A senha precisa ter pelo menos 8 caracteres.", file=sys.stderr)
            return 1
        confirma = getpass.getpass("Confirme a senha: ")
        if senha != confirma:
            print("Erro: As senhas não conferem.", file=sys.stderr)
            return 1

        msg = criar_ou_atualizar_usuario(args.email, args.nome, args.papel, senha, args.bairro)
        print(msg)
        return 0

    if args.comando == "papel":
        sucesso = alterar_papel_usuario(args.identificador, args.novo_papel)
        if sucesso:
            print(f"Papel do usuário '{args.identificador}' alterado para '{args.novo_papel}'.")
            return 0
        print(f"Erro: Usuário '{args.identificador}' não encontrado.", file=sys.stderr)
        return 1

    if args.comando == "senha":
        senha = getpass.getpass("Nova senha (mínimo 8 caracteres): ")
        if len(senha) < 8:
            print("Erro: A senha precisa ter pelo menos 8 caracteres.", file=sys.stderr)
            return 1
        confirma = getpass.getpass("Confirme a nova senha: ")
        if senha != confirma:
            print("Erro: As senhas não conferem.", file=sys.stderr)
            return 1

        sucesso = alterar_senha_usuario(args.identificador, senha)
        if sucesso:
            print(f"Senha do usuário '{args.identificador}' atualizada com sucesso.")
            return 0
        print(f"Erro: Usuário '{args.identificador}' não encontrado.", file=sys.stderr)
        return 1

    if args.comando == "excluir":
        sucesso = excluir_usuario(args.identificador, args.com_alertas)
        if sucesso:
            print(f"Usuário '{args.identificador}' excluído com sucesso.")
            return 0
        print(f"Erro: Usuário '{args.identificador}' não encontrado.", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

"""Cria ou promove um usuário da Defesa Civil.

O cadastro público só cria cidadãos — de propósito. Quem opera o painel
precisa ser criado aqui, por alguém com acesso ao servidor.

Uso (dentro do container):
    docker compose exec api python criar_usuario.py \
        --email defesa@prefeitura.gov.br --nome "Defesa Civil" --papel defesa_civil

A senha é pedida no terminal e nunca passa por argumento de linha de comando,
que ficaria gravado no histórico do shell e visível em `ps`.
"""

from __future__ import annotations

import argparse
import datetime
import getpass
import sys
import uuid

from app.db import gerar_hash_senha, inicializar_banco, obter_conexao

PAPEIS = ("cidadao", "defesa_civil", "admin")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--email", required=True)
    parser.add_argument("--nome", default="Defesa Civil")
    parser.add_argument("--papel", default="defesa_civil", choices=PAPEIS)
    args = parser.parse_args()

    email = args.email.strip().lower()

    senha = getpass.getpass("Senha: ")
    if len(senha) < 8:
        print("Senha precisa ter ao menos 8 caracteres.", file=sys.stderr)
        return 1
    if senha != getpass.getpass("Confirme a senha: "):
        print("As senhas não conferem.", file=sys.stderr)
        return 1

    inicializar_banco()
    agora = datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")

    with obter_conexao() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM usuarios WHERE lower(email) = ?", (email,))
        existente = cursor.fetchone()

        if existente:
            cursor.execute(
                "UPDATE usuarios SET nome = ?, senha_hash = ?, papel = ? WHERE id = ?",
                (args.nome, gerar_hash_senha(senha), args.papel, existente["id"]),
            )
            acao = "atualizado"
        else:
            cursor.execute(
                """
                INSERT INTO usuarios (id, nome, email, senha_hash, papel, termos_aceitos_em, criado_em)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (str(uuid.uuid4()), args.nome, email, gerar_hash_senha(senha), args.papel, agora, agora),
            )
            acao = "criado"
        conn.commit()

    print(f"Usuário {email} {acao} com papel '{args.papel}'.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

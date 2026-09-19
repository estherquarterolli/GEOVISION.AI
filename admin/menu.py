#!/usr/bin/env python3
"""Painel Administrativo Interativo (CLI) - GEOVISION.AI.

Centraliza todas as operações administrativas em um menu simples no terminal.
Execute:
    python admin/menu.py
"""

from __future__ import annotations

import getpass
import os
import sys
from pathlib import Path

# Ajusta path
_RAIZ_PROJETO = Path(__file__).resolve().parent.parent
_ADMIN_DIR = _RAIZ_PROJETO / "admin"
_AI_SERVICE_DIR = _RAIZ_PROJETO / "ai-service"

if str(_ADMIN_DIR) not in sys.path:
    sys.path.insert(0, str(_ADMIN_DIR))
if str(_AI_SERVICE_DIR) not in sys.path:
    sys.path.insert(0, str(_AI_SERVICE_DIR))

import backup_e_limpeza  # noqa: E402
import gerenciar_alertas  # noqa: E402
import gerenciar_usuarios  # noqa: E402
from app.db import (  # noqa: E402
    inicializar_banco,
    obter_conexao,
    verificar_senha,
)


def limpar_tela():
    os.system("cls" if os.name == "nt" else "clear")


def cabecalho(usuario_ativo: dict | None = None):
    print("=" * 65)
    print("      🛰️  GEOVISION.AI - CONSOLE ADMINISTRATIVO PRINCIPAL  🛰️")
    if usuario_ativo:
        print(f"      Autenticado: {usuario_ativo['nome']} ({usuario_ativo['papel'].upper()})")
    print("=" * 65)


def autenticar_admin() -> dict | None:
    """Valida credenciais de administrador antes de liberar o console."""
    inicializar_banco()

    with obter_conexao() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT count(*) as total FROM usuarios WHERE papel IN ('admin', 'defesa_civil')")
        total_admins = cursor.fetchone()["total"]

    # Se ainda não existir nenhuma conta com papel admin ou defesa civil
    if total_admins == 0:
        limpar_tela()
        cabecalho()
        print("\n⚠️  NENHUM ADMINISTRADOR CONFIGURADO NO SISTEMA!")
        print("Vamos criar a sua primeira conta Master Admin para acesso.\n")
        email = input("E-mail do administrador: ").strip().lower()
        nome = input("Nome completo: ").strip() or "Administrador Master"
        senha = getpass.getpass("Senha (mínimo 8 caracteres): ")
        if len(senha) < 8:
            print("\n❌ A senha precisa ter pelo menos 8 caracteres.")
            return None
        conf = getpass.getpass("Confirme a senha: ")
        if senha != conf:
            print("\n❌ As senhas não conferem.")
            return None

        gerenciar_usuarios.criar_ou_atualizar_usuario(email, nome, "admin", senha)
        print("\n✅ Conta de Administrador Master configurada com sucesso!")
        input("Pressione [Enter] para continuar...")
        return {"nome": nome, "email": email, "papel": "admin"}

    # Fluxo de login com limite de tentativas
    tentativas = 0
    max_tentativas = 3

    while tentativas < max_tentativas:
        limpar_tela()
        cabecalho()
        print("\n🔒 AUTENTICAÇÃO DE SEGURANÇA OBRIGATÓRIA")
        print(f"Tentativa {tentativas + 1} de {max_tentativas}\n")

        email = input("E-mail: ").strip().lower()
        if not email:
            continue

        senha = getpass.getpass("Senha: ")

        with obter_conexao() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT id, nome, email, senha_hash, papel FROM usuarios WHERE lower(email) = ?",
                (email,),
            )
            usuario = cursor.fetchone()

            if usuario and verificar_senha(senha, usuario["senha_hash"]):
                if usuario["papel"] in ("admin", "defesa_civil"):
                    print(f"\n✅ Acesso autorizado! Bem-vindo(a), {usuario['nome']}.")
                    return dict(usuario)
                else:
                    print("\n⛔ ACESSO NEGADO: Este usuário não possui privilégios de administrador.")
                    input("\nPressione [Enter] para tentar novamente...")
            else:
                print("\n❌ E-mail ou senha incorretos.")
                input("\nPressione [Enter] para tentar novamente...")

        tentativas += 1

    print("\n🚨 LIMITE DE TENTATIVAS EXCEDIDO. O console foi bloqueado por segurança.\n")
    return None


def pausar():
    input("\nPressione [Enter] para continuar...")


def menu_usuarios():
    while True:
        limpar_tela()
        cabecalho()
        print("\n [ GESTÃO DE USUÁRIOS ]")
        print("  1. Listar todos os usuários")
        print("  2. Buscar usuário por nome/e-mail")
        print("  3. Criar novo usuário (Admin / Defesa Civil / Cidadão)")
        print("  4. Alterar papel de usuário existente")
        print("  5. Redefinir senha de usuário")
        print("  6. Excluir usuário")
        print("  0. Voltar ao menu principal")
        print("-" * 65)

        opcao = input("Escolha uma opção: ").strip()

        if opcao == "0":
            break
        elif opcao == "1":
            print("\nCarregando usuários...\n")
            usuarios = gerenciar_usuarios.listar_usuarios()
            print(gerenciar_usuarios.formatar_tabela_usuarios(usuarios))
            pausar()
        elif opcao == "2":
            busca = input("\nDigite o termo para buscar (nome ou e-mail): ").strip()
            if busca:
                usuarios = gerenciar_usuarios.listar_usuarios(busca)
                print(gerenciar_usuarios.formatar_tabela_usuarios(usuarios))
            pausar()
        elif opcao == "3":
            print("\n-- Novo Usuário --")
            email = input("E-mail: ").strip()
            if not email:
                print("E-mail não pode ser vazio.")
                pausar()
                continue
            nome = input("Nome completo: ").strip() or "Administrador"
            print("Papéis disponíveis: admin, defesa_civil, cidadao")
            papel = input("Papel [padrão: admin]: ").strip() or "admin"
            bairro = input("Bairro (opcional): ").strip() or None
            senha = getpass.getpass("Senha (mínimo 8 caracteres): ")
            if len(senha) < 8:
                print("Erro: A senha precisa de no mínimo 8 caracteres.")
                pausar()
                continue
            confirma = getpass.getpass("Confirmar senha: ")
            if senha != confirma:
                print("Erro: As senhas não conferem.")
                pausar()
                continue
            try:
                msg = gerenciar_usuarios.criar_ou_atualizar_usuario(email, nome, papel, senha, bairro)
                print(f"\n{msg}")
            except Exception as e:
                print(f"Erro: {e}")
            pausar()
        elif opcao == "4":
            print("\n-- Alterar Papel --")
            ident = input("E-mail ou ID do usuário: ").strip()
            print("Papéis disponíveis: admin, defesa_civil, cidadao")
            papel = input("Novo papel: ").strip()
            try:
                ok = gerenciar_usuarios.alterar_papel_usuario(ident, papel)
                if ok:
                    print(f"\nPapel alterado para '{papel}' com sucesso.")
                else:
                    print(f"\nUsuário '{ident}' não encontrado.")
            except Exception as e:
                print(f"Erro: {e}")
            pausar()
        elif opcao == "5":
            print("\n-- Redefinir Senha --")
            ident = input("E-mail ou ID do usuário: ").strip()
            senha = getpass.getpass("Nova senha (mínimo 8 caracteres): ")
            if len(senha) < 8:
                print("Erro: A senha precisa de no mínimo 8 caracteres.")
                pausar()
                continue
            confirma = getpass.getpass("Confirmar nova senha: ")
            if senha != confirma:
                print("Erro: As senhas não conferem.")
                pausar()
                continue
            try:
                ok = gerenciar_usuarios.alterar_senha_usuario(ident, senha)
                if ok:
                    print("\nSenha alterada com sucesso.")
                else:
                    print(f"\nUsuário '{ident}' não encontrado.")
            except Exception as e:
                print(f"Erro: {e}")
            pausar()
        elif opcao == "6":
            print("\n-- Excluir Usuário --")
            ident = input("E-mail ou ID do usuário: ").strip()
            confirma = input(f"Tem certeza que deseja excluir '{ident}'? (s/N): ").strip().lower()
            if confirma == "s":
                del_alertas = input("Deseja apagar também todos os alertas desse usuário? (s/N): ").strip().lower() == "s"
                ok = gerenciar_usuarios.excluir_usuario(ident, del_alertas)
                if ok:
                    print("\nUsuário excluído com sucesso.")
                else:
                    print(f"\nUsuário '{ident}' não encontrado.")
            else:
                print("Operação cancelada.")
            pausar()


def menu_alertas():
    while True:
        limpar_tela()
        cabecalho()
        print("\n [ GESTÃO DE ALERTAS ]")
        print("  1. Listar últimos alertas recebidos")
        print("  2. Filtrar alertas por status")
        print("  3. Filtrar alertas por nível de risco")
        print("  4. Inspecionar alerta por ID")
        print("  5. Atualizar status de um alerta")
        print("  6. Exportar alertas (CSV / JSON)")
        print("  7. Excluir alerta")
        print("  0. Voltar ao menu principal")
        print("-" * 65)

        opcao = input("Escolha uma opção: ").strip()

        if opcao == "0":
            break
        elif opcao == "1":
            alertas = gerenciar_alertas.listar_alertas(limite=50)
            print("\n" + gerenciar_alertas.formatar_tabela_alertas(alertas))
            pausar()
        elif opcao == "2":
            print("Status válidos: processando, recebido, em_vistoria, resolvido, nao_procede")
            st = input("Digite o status: ").strip()
            alertas = gerenciar_alertas.listar_alertas(status=st)
            print("\n" + gerenciar_alertas.formatar_tabela_alertas(alertas))
            pausar()
        elif opcao == "3":
            print("Riscos válidos: alto, medio, baixo, critico")
            r = input("Digite o risco: ").strip()
            alertas = gerenciar_alertas.listar_alertas(risco=r)
            print("\n" + gerenciar_alertas.formatar_tabela_alertas(alertas))
            pausar()
        elif opcao == "4":
            alerta_id = input("\nDigite o ID do alerta: ").strip()
            alerta = gerenciar_alertas.obter_alerta_detalhado(alerta_id)
            if alerta:
                print("\n" + "=" * 65)
                for k, v in alerta.items():
                    print(f"{k:<25}: {v}")
                print("=" * 65)
            else:
                print(f"Alerta '{alerta_id}' não encontrado.")
            pausar()
        elif opcao == "5":
            alerta_id = input("\nDigite o ID do alerta: ").strip()
            print("Status: recebido, em_vistoria, resolvido, nao_procede")
            novo_st = input("Novo status: ").strip()
            obs = input("Observação da Defesa Civil (opcional): ").strip() or None
            try:
                ok = gerenciar_alertas.atualizar_status_alerta(alerta_id, novo_st, obs)
                if ok:
                    print(f"\nStatus do alerta {alerta_id} atualizado para '{novo_st}'.")
                else:
                    print(f"\nAlerta '{alerta_id}' não encontrado.")
            except Exception as e:
                print(f"Erro: {e}")
            pausar()
        elif opcao == "6":
            formato = input("\nFormato (csv / json) [padrão: csv]: ").strip().lower() or "csv"
            caminho = input("Caminho do arquivo [padrão: admin/alertas_exportados.csv]: ").strip() or "admin/alertas_exportados.csv"
            try:
                dest = gerenciar_alertas.exportar_alertas(caminho, formato)
                print(f"\nArquivo salvo em:\n{dest}")
            except Exception as e:
                print(f"Erro ao exportar: {e}")
            pausar()
        elif opcao == "7":
            alerta_id = input("\nDigite o ID do alerta a excluir: ").strip()
            confirma = input(f"Tem certeza que deseja apagar o alerta {alerta_id}? (s/N): ").strip().lower()
            if confirma == "s":
                ok = gerenciar_alertas.excluir_alerta(alerta_id)
                if ok:
                    print("Alerta excluído com sucesso.")
                else:
                    print(f"Alerta '{alerta_id}' não encontrado.")
            pausar()


def menu_sistema():
    while True:
        limpar_tela()
        cabecalho()
        print("\n [ MANUTENÇÃO & SISTEMA ]")
        print("  1. Ver estatísticas completas do sistema")
        print("  2. Criar backup imediato do banco SQLite")
        print("  3. Verificar integridade do banco de dados")
        print("  4. Identificar e limpar fotos órfãs")
        print("  0. Voltar ao menu principal")
        print("-" * 65)

        opcao = input("Escolha uma opção: ").strip()

        if opcao == "0":
            break
        elif opcao == "1":
            stats = backup_e_limpeza.obter_estatisticas_sistema()
            print("\n" + backup_e_limpeza.formatar_painel_metricas(stats))
            pausar()
        elif opcao == "2":
            print("\nGerando backup consistente do SQLite...")
            try:
                caminho = backup_e_limpeza.realizar_backup_banco()
                print(f"\nBackup concluído com sucesso:\n{caminho}")
            except Exception as e:
                print(f"Erro ao gerar backup: {e}")
            pausar()
        elif opcao == "3":
            print("\nExecutando PRAGMA integrity_check...")
            ok, msgs = backup_e_limpeza.verificar_integridade()
            if ok:
                print("\nResultado: OK - O banco de dados está íntegro e sem inconsistências.")
            else:
                print("\nInconsistências encontradas:")
                for m in msgs:
                    print(f" - {m}")
            pausar()
        elif opcao == "4":
            qtd, lista = backup_e_limpeza.limpar_arquivos_orfaos(remover=False)
            print(f"\nTotal de fotos órfãs encontradas: {qtd}")
            if qtd > 0:
                for f in lista[:5]:
                    print(f" - {f}")
                if qtd > 5:
                    print(f" ... e mais {qtd - 5} foto(s).")
                conf = input("\nDeseja deletar esses arquivos órfãos do disco? (s/N): ").strip().lower()
                if conf == "s":
                    backup_e_limpeza.limpar_arquivos_orfaos(remover=True)
                    print("Arquivos órfãos removidos com sucesso.")
            pausar()


def main():
    usuario_ativo = autenticar_admin()
    if not usuario_ativo:
        return 1

    while True:
        limpar_tela()
        cabecalho(usuario_ativo)
        print("\nEscolha um módulo para gerenciar:")
        print("  1. 👤 Usuários e Permissões (Admin / Defesa Civil / Cidadão)")
        print("  2. 🚨 Alertas e Ocorrências da Defesa Civil")
        print("  3. 🛠️  Manutenção, Backups e Estatísticas")
        print("  0. 🚪 Sair")
        print("=" * 65)

        opcao = input("Opção desejada: ").strip()

        if opcao == "0":
            print(f"\nEncerrando sessão de {usuario_ativo['nome']}. Até logo!\n")
            break
        elif opcao == "1":
            menu_usuarios()
        elif opcao == "2":
            menu_alertas()
        elif opcao == "3":
            menu_sistema()

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("\n\nOperação cancelada pelo usuário.")
        raise SystemExit(0)

#!/usr/bin/env python3
"""Utilitário de Administração: Backup, Manutenção e Limpeza do GEOVISION.AI.

Permite realizar backup do banco de dados SQLite e uploads, inspecionar integridade,
visualizar estatísticas completas e limpar fotos órfãs.
"""

from __future__ import annotations

import argparse
import datetime
import os
import shutil
import sqlite3
import sys
from pathlib import Path

_RAIZ_PROJETO = Path(__file__).resolve().parent.parent
_AI_SERVICE_DIR = _RAIZ_PROJETO / "ai-service"
if str(_AI_SERVICE_DIR) not in sys.path:
    sys.path.insert(0, str(_AI_SERVICE_DIR))

from app.db import (  # noqa: E402
    DB_FILE,
    UPLOADS_DIR,
    inicializar_banco,
    obter_conexao,
)

DIR_BACKUPS = _RAIZ_PROJETO / "admin" / "backups"


def realizar_backup_banco() -> str:
    """Cria cópia pontual e consistente do banco SQLite usando a API de backup nativa."""
    inicializar_banco()
    DIR_BACKUPS.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    arquivo_destino = DIR_BACKUPS / f"geovision_backup_{timestamp}.db"

    # Conexão de origem (com WAL)
    with obter_conexao() as conn_origem:
        # Abre conexão de destino para cópia limpa
        conn_destino = sqlite3.connect(str(arquivo_destino))
        with conn_destino:
            conn_origem.backup(conn_destino, pages=50)
        conn_destino.close()

    return str(arquivo_destino.resolve())


def verificar_integridade() -> tuple[bool, list[str]]:
    """Executa PRAGMA integrity_check no banco de dados."""
    inicializar_banco()
    with obter_conexao() as conn:
        cursor = conn.cursor()
        cursor.execute("PRAGMA integrity_check")
        linhas = [row[0] for row in cursor.fetchall()]
        ok = len(linhas) == 1 and linhas[0].lower() == "ok"
        return ok, linhas


def obter_estatisticas_sistema() -> dict:
    """Calcula estatísticas gerais de usuários, alertas e armazenamento."""
    inicializar_banco()
    with obter_conexao() as conn:
        cursor = conn.cursor()

        # Usuários por papel
        cursor.execute("SELECT papel, count(*) as qtd FROM usuarios GROUP BY papel")
        usuarios_papel = {row["papel"] or "cidadao": row["qtd"] for row in cursor.fetchall()}
        cursor.execute("SELECT count(*) as total FROM usuarios")
        total_usuarios = cursor.fetchone()["total"]

        # Alertas por status
        cursor.execute("SELECT status, count(*) as qtd FROM alertas GROUP BY status")
        alertas_status = {row["status"]: row["qtd"] for row in cursor.fetchall()}

        # Alertas por risco
        cursor.execute("SELECT nivel_risco, count(*) as qtd FROM alertas GROUP BY nivel_risco")
        alertas_risco = {row["nivel_risco"] or "sem_risco": row["qtd"] for row in cursor.fetchall()}

        # Alertas por tipo
        cursor.execute("SELECT tipo_anomalia, count(*) as qtd FROM alertas GROUP BY tipo_anomalia")
        alertas_tipo = {row["tipo_anomalia"] or "indefinido": row["qtd"] for row in cursor.fetchall()}

        cursor.execute("SELECT count(*) as total FROM alertas")
        total_alertas = cursor.fetchone()["total"]

    # Tamanho do banco e uploads
    tamanho_db = DB_FILE.stat().st_size if DB_FILE.exists() else 0
    tamanho_uploads = 0
    qtd_fotos = 0
    if UPLOADS_DIR.exists():
        for p in UPLOADS_DIR.rglob("*"):
            if p.is_file():
                qtd_fotos += 1
                tamanho_uploads += p.stat().st_size

    return {
        "usuarios": {
            "total": total_usuarios,
            "por_papel": usuarios_papel,
        },
        "alertas": {
            "total": total_alertas,
            "por_status": alertas_status,
            "por_risco": alertas_risco,
            "por_tipo": alertas_tipo,
        },
        "armazenamento": {
            "caminho_db": str(DB_FILE),
            "tamanho_db_mb": round(tamanho_db / (1024 * 1024), 2),
            "caminho_uploads": str(UPLOADS_DIR),
            "qtd_arquivos_uploads": qtd_fotos,
            "tamanho_uploads_mb": round(tamanho_uploads / (1024 * 1024), 2),
        },
    }


def limpar_arquivos_orfaos(remover: bool = False) -> tuple[int, list[str]]:
    """Identifica (e opcionalmente remove) arquivos de fotos na pasta uploads que não estão em nenhum alerta."""
    inicializar_banco()
    if not UPLOADS_DIR.exists():
        return 0, []

    with obter_conexao() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT foto_path FROM alertas")
        linhas = cursor.fetchall()

    arquivos_no_banco = set()
    for row in linhas:
        caminhos = (row["foto_path"] or "").split(",")
        for c in caminhos:
            nome_limpo = c.strip().replace("uploads/", "").replace("\\", "/")
            if nome_limpo:
                arquivos_no_banco.add(nome_limpo)

    orfaos = []
    for arquivo in UPLOADS_DIR.rglob("*"):
        if arquivo.is_file():
            relativo = arquivo.relative_to(UPLOADS_DIR).as_posix()
            if relativo not in arquivos_no_banco:
                orfaos.append(str(arquivo))
                if remover:
                    try:
                        arquivo.unlink()
                    except Exception:
                        pass

    return len(orfaos), orfaos


def formatar_painel_metricas(stats: dict) -> str:
    """Formata as estatísticas em texto limpo para o console."""
    linhas = []
    linhas.append("=" * 65)
    linhas.append("          PAINEL DE ESTATÍSTICAS DO GEOVISION.AI          ")
    linhas.append("=" * 65)

    linhas.append("\n[1] USUÁRIOS")
    linhas.append(f"  • Total Cadastrado : {stats['usuarios']['total']}")
    for papel, qtd in stats['usuarios']['por_papel'].items():
        linhas.append(f"    - {papel:<15}: {qtd}")

    linhas.append("\n[2] ALERTAS")
    linhas.append(f"  • Total de Alertas : {stats['alertas']['total']}")
    linhas.append("  • Por Status:")
    for st, qtd in stats['alertas']['por_status'].items():
        linhas.append(f"    - {st:<15}: {qtd}")
    linhas.append("  • Por Risco:")
    for r, qtd in stats['alertas']['por_risco'].items():
        linhas.append(f"    - {r:<15}: {qtd}")

    linhas.append("\n[3] ARMAZENAMENTO")
    arm = stats['armazenamento']
    linhas.append(f"  • Banco SQLite     : {arm['tamanho_db_mb']} MB ({arm['caminho_db']})")
    linhas.append(f"  • Pasta Uploads    : {arm['tamanho_uploads_mb']} MB ({arm['qtd_arquivos_uploads']} fotos)")
    linhas.append("=" * 65)
    return "\n".join(linhas)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="comando", help="Comando a executar")

    # Estatísticas
    subparsers.add_parser("stats", help="Exibir estatísticas completas do sistema")

    # Backup
    subparsers.add_parser("backup", help="Gerar backup do banco de dados SQLite")

    # Integridade
    subparsers.add_parser("checar", help="Verificar integridade do banco de dados")

    # Limpeza de órfãos
    p_limpar = subparsers.add_parser("limpar", help="Procurar ou remover fotos órfãs")
    p_limpar.add_argument("--executar", action="store_true", help="Efetivamente deletar os arquivos órfãos")

    args = parser.parse_args()

    if not args.comando or args.comando == "stats":
        stats = obter_estatisticas_sistema()
        print(formatar_painel_metricas(stats))
        return 0

    if args.comando == "backup":
        destino = realizar_backup_banco()
        print(f"Backup gerado com sucesso em:\n{destino}")
        return 0

    if args.comando == "checar":
        ok, msgs = verificar_integridade()
        if ok:
            print("Integridade do banco de dados: OK (Nenhum erro encontrado).")
            return 0
        print("Avisos de integridade:", file=sys.stderr)
        for m in msgs:
            print(f" - {m}", file=sys.stderr)
        return 1

    if args.comando == "limpar":
        qtd, lista = limpar_arquivos_orfaos(args.executar)
        if args.executar:
            print(f"{qtd} foto(s) órfã(s) removida(s) com sucesso.")
        else:
            print(f"{qtd} foto(s) órfã(s) encontrada(s) (Use --executar para apagá-las).")
            for f in lista[:10]:
                print(f" - {f}")
            if qtd > 10:
                print(f" ... e mais {qtd - 10} arquivo(s).")
        return 0

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

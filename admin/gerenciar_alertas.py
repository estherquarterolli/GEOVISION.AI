#!/usr/bin/env python3
"""Utilitário de Administração: Gerenciamento de Alertas do GEOVISION.AI.

Permite listar alertas com filtros (status, risco, anomalia), inspecionar detalhes,
atualizar status/observações, exportar para CSV/JSON e limpar alertas de teste.
"""

from __future__ import annotations

import argparse
import csv
import datetime
import json
import os
import sys
from pathlib import Path

_RAIZ_PROJETO = Path(__file__).resolve().parent.parent
_AI_SERVICE_DIR = _RAIZ_PROJETO / "ai-service"
if str(_AI_SERVICE_DIR) not in sys.path:
    sys.path.insert(0, str(_AI_SERVICE_DIR))

from app.db import (  # noqa: E402
    inicializar_banco,
    obter_conexao,
    UPLOADS_DIR,
)

STATUS_VALIDOS = ("processando", "recebido", "em_vistoria", "resolvido", "nao_procede")


def listar_alertas(
    status: str | None = None,
    risco: str | None = None,
    limite: int = 50,
) -> list[dict]:
    """Lista alertas cadastrados com filtros e junção com dados do usuário."""
    inicializar_banco()
    query = """
    SELECT 
        a.id, a.usuario_id, u.nome AS usuario_nome, u.email AS usuario_email,
        a.foto_path, a.endereco_manual, a.latitude, a.longitude,
        a.tipo_anomalia, a.descricao, a.nivel_risco, a.confianca_ia,
        a.status, a.observacao_defesa_civil, a.criado_em, a.classificado_em, a.resolvido_em
    FROM alertas a
    LEFT JOIN usuarios u ON a.usuario_id = u.id
    WHERE 1=1
    """
    params = []
    if status:
        query += " AND a.status = ?"
        params.append(status)
    if risco:
        query += " AND a.nivel_risco = ?"
        params.append(risco)

    query += " ORDER BY a.criado_em DESC LIMIT ?"
    params.append(limite)

    with obter_conexao() as conn:
        cursor = conn.cursor()
        cursor.execute(query, tuple(params))
        return [dict(row) for row in cursor.fetchall()]


def obter_alerta_detalhado(alerta_id: str) -> dict | None:
    """Busca detalhes completos de um alerta específico."""
    inicializar_banco()
    with obter_conexao() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT 
                a.*, u.nome AS usuario_nome, u.email AS usuario_email, u.bairro_texto AS usuario_bairro
            FROM alertas a
            LEFT JOIN usuarios u ON a.usuario_id = u.id
            WHERE a.id = ?
            """,
            (alerta_id,),
        )
        row = cursor.fetchone()
        return dict(row) if row else None


def atualizar_status_alerta(alerta_id: str, novo_status: str, observacao: str | None = None) -> bool:
    """Atualiza o status de um alerta e registra data de resolução se aplicável."""
    if novo_status not in STATUS_VALIDOS:
        raise ValueError(f"Status inválido. Escolha entre: {', '.join(STATUS_VALIDOS)}")

    agora = datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
    resolvido_em = agora if novo_status in ("resolvido", "nao_procede") else None

    inicializar_banco()
    with obter_conexao() as conn:
        cursor = conn.cursor()
        if observacao:
            cursor.execute(
                """
                UPDATE alertas
                SET status = ?, observacao_defesa_civil = ?, resolvido_em = coalesce(?, resolvido_em)
                WHERE id = ?
                """,
                (novo_status, observacao, resolvido_em, alerta_id),
            )
        else:
            cursor.execute(
                """
                UPDATE alertas
                SET status = ?, resolvido_em = coalesce(?, resolvido_em)
                WHERE id = ?
                """,
                (novo_status, resolvido_em, alerta_id),
            )
        conn.commit()
        return cursor.rowcount > 0


def excluir_alerta(alerta_id: str, remover_fotos: bool = True) -> bool:
    """Exclui um alerta do banco e opcionalmente remove os arquivos de fotos associados."""
    inicializar_banco()
    with obter_conexao() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT foto_path FROM alertas WHERE id = ?", (alerta_id,))
        row = cursor.fetchone()
        if not row:
            return False

        foto_path = row["foto_path"]
        cursor.execute("DELETE FROM alertas WHERE id = ?", (alerta_id,))
        conn.commit()

        if remover_fotos and foto_path:
            for caminho_rel in foto_path.split(","):
                caminho_abs = UPLOADS_DIR / caminho_rel.strip().replace("uploads/", "")
                if caminho_abs.exists() and caminho_abs.is_file():
                    try:
                        caminho_abs.unlink()
                    except Exception:
                        pass
        return True


def exportar_alertas(caminho_saida: str, formato: str = "csv") -> str:
    """Exporta todos os alertas para um arquivo CSV ou JSON."""
    alertas = listar_alertas(limite=100000)
    destino = Path(caminho_saida)
    destino.parent.mkdir(parents=True, exist_ok=True)

    if formato.lower() == "json":
        with open(destino, "w", encoding="utf-8") as f:
            json.dump(alertas, f, ensure_ascii=False, indent=2)
    else:
        if not alertas:
            with open(destino, "w", encoding="utf-8", newline="") as f:
                f.write("id,usuario_id,tipo_anomalia,nivel_risco,status,criado_em\n")
        else:
            chaves = alertas[0].keys()
            with open(destino, "w", encoding="utf-8", newline="") as f:
                writer = csv.DictWriter(f, fieldnames=chaves)
                writer.writeheader()
                writer.writerows(alertas)

    return str(destino.resolve())


def formatar_tabela_alertas(alertas: list[dict]) -> str:
    """Formata lista de alertas em tabela legível no terminal."""
    if not alertas:
        return "Nenhum alerta encontrado."

    linhas = []
    linhas.append("=" * 110)
    linhas.append(f"{'ID':<8} | {'DATA':<16} | {'ANOMALIA':<18} | {'RISCO':<10} | {'STATUS':<14} | {'SOLICITANTE':<25}")
    linhas.append("-" * 110)
    for a in alertas:
        id_curto = a['id'][:8]
        data = (a.get('criado_em') or '')[:16].replace('T', ' ')
        anomalia = (a.get('tipo_anomalia') or 'N/A')[:18]
        risco = (a.get('nivel_risco') or 'N/A')[:10]
        st = (a.get('status') or 'N/A')[:14]
        usuario = (a.get('usuario_nome') or a.get('usuario_email') or 'Desconhecido')[:25]
        linhas.append(f"{id_curto:<8} | {data:<16} | {anomalia:<18} | {risco:<10} | {st:<14} | {usuario:<25}")
    linhas.append("=" * 110)
    linhas.append(f"Total: {len(alertas)} alerta(s)")
    return "\n".join(linhas)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="comando", help="Comando a executar")

    # Listar
    p_listar = subparsers.add_parser("listar", help="Listar alertas")
    p_listar.add_argument("--status", "-s", choices=STATUS_VALIDOS, help="Filtrar por status")
    p_listar.add_argument("--risco", "-r", help="Filtrar por risco (alto, medio, baixo, critico)")
    p_listar.add_argument("--limite", "-l", type=int, default=50, help="Limite de registros")

    # Detalhes
    p_detalhes = subparsers.add_parser("ver", help="Ver detalhes completos de um alerta")
    p_detalhes.add_argument("id", help="ID completo ou inicial do alerta")

    # Alterar Status
    p_status = subparsers.add_parser("status", help="Atualizar status de um alerta")
    p_status.add_argument("id", help="ID do alerta")
    p_status.add_argument("novo_status", choices=STATUS_VALIDOS, help="Novo status")
    p_status.add_argument("--obs", "-o", help="Observação da Defesa Civil / Admin")

    # Excluir
    p_del = subparsers.add_parser("excluir", help="Excluir alerta")
    p_del.add_argument("id", help="ID do alerta")
    p_del.add_argument("--manter-fotos", action="store_true", help="Não apagar arquivos de imagem do disco")

    # Exportar
    p_exp = subparsers.add_parser("exportar", help="Exportar alertas para CSV ou JSON")
    p_exp.add_argument("--saida", "-o", default="admin/export_alertas.csv", help="Caminho do arquivo de saída")
    p_exp.add_argument("--formato", "-f", choices=["csv", "json"], default="csv", help="Formato de exportação")

    args = parser.parse_args()

    if not args.comando or args.comando == "listar":
        alertas = listar_alertas(getattr(args, "status", None), getattr(args, "risco", None), getattr(args, "limite", 50))
        print(formatar_tabela_alertas(alertas))
        return 0

    if args.comando == "ver":
        alerta = obter_alerta_detalhado(args.id)
        if not alerta:
            # Tenta busca parcial se não achou por ID exato
            alertas = listar_alertas(limite=1000)
            candidatos = [a for a in alertas if a["id"].startswith(args.id)]
            if len(candidatos) == 1:
                alerta = obter_alerta_detalhado(candidatos[0]["id"])

        if not alerta:
            print(f"Erro: Alerta '{args.id}' não encontrado.", file=sys.stderr)
            return 1

        print("=" * 70)
        print(f"DETALHES DO ALERTA: {alerta['id']}")
        print("=" * 70)
        for k, v in alerta.items():
            print(f"{k:<25}: {v}")
        print("=" * 70)
        return 0

    if args.comando == "status":
        sucesso = atualizar_status_alerta(args.id, args.novo_status, args.obs)
        if sucesso:
            print(f"Status do alerta {args.id} atualizado para '{args.novo_status}'.")
            return 0
        print(f"Erro: Alerta '{args.id}' não encontrado.", file=sys.stderr)
        return 1

    if args.comando == "excluir":
        sucesso = excluir_alerta(args.id, remover_fotos=not args.manter_fotos)
        if sucesso:
            print(f"Alerta {args.id} excluído com sucesso.")
            return 0
        print(f"Erro: Alerta '{args.id}' não encontrado.", file=sys.stderr)
        return 1

    if args.comando == "exportar":
        caminho = exportar_alertas(args.saida, args.formato)
        print(f"Alertas exportados com sucesso para: {caminho}")
        return 0

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

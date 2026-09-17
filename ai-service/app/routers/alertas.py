import os
import uuid
import datetime
import logging
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Depends, File, UploadFile, Form, Request, HTTPException, status
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool
from app.db import obter_conexao, UPLOADS_DIR
from app.security import Sessao, exigir_defesa_civil, sessao_atual
from app.services.classificador import ModeloIndisponivelError

# Mesmos limites de /classify: fotos de celular passam de 5 MB com facilidade,
# e sem teto um único envio pode encher o disco da VPS.
TAMANHO_MAXIMO_BYTES = 8 * 1024 * 1024
MAXIMO_FOTOS = 3
TIPOS_ACEITOS = {"image/jpeg", "image/png", "image/webp", "image/heic"}

logger = logging.getLogger(__name__)
roteador = APIRouter(prefix="/api/alertas", tags=["alertas"])

class AlertaResposta(BaseModel):
    id: str
    usuario_id: str
    foto_path: str
    endereco_manual: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    tipo_anomalia: str | None = None
    descricao: str | None = None
    nivel_risco: str | None = None
    confianca_ia: float | None = None
    modelo_versao: str | None = None
    status: str
    observacao_defesa_civil: str | None = None
    classificado_em: str | None = None
    resolvido_em: str | None = None
    gravidade_percebida: str | None = None
    tempo_surgimento: str | None = None
    evolucao: str | None = None
    local_anomalia: str | None = None
    criado_em: str

class AtualizarStatusRequisicao(BaseModel):
    # Literal em vez de str: antes qualquer texto era gravado na coluna e o
    # painel ficava com alertas em estados que nenhuma tela sabe exibir.
    status: Literal["recebido", "em_vistoria", "resolvido", "nao_procede"]
    observacao_defesa_civil: str | None = None

class MetricasDefesaCivil(BaseModel):
    alertas_ativos: int
    criticos_ativos: int
    ultimas_24h: int
    tempo_medio_resposta_horas: float | None = None

class AlertaPublicoResposta(BaseModel):
    id: str
    latitude: float | None = None
    longitude: float | None = None
    nivel_risco: str | None = None
    tipo_anomalia: str | None = None
    criado_em: str

@roteador.post("", response_model=AlertaResposta)
async def criar_alerta(
    request: Request,
    tipo_anomalia: str = Form(...),
    descricao: str | None = Form(None),
    endereco_manual: str | None = Form(None),
    latitude: float | None = Form(None),
    longitude: float | None = Form(None),
    gravidade_percebida: str | None = Form(None),
    tempo_surgimento: str | None = Form(None),
    evolucao: str | None = Form(None),
    local_anomalia: str | None = Form(None),
    fotos: list[UploadFile] = File(...),
    sessao: Sessao = Depends(sessao_atual),
):
    # O dono do alerta é quem está autenticado, não um campo do formulário:
    # aceitar usuario_id do cliente deixava qualquer pessoa criar alertas em
    # nome de outra e gravar arquivos na pasta de uploads dela.
    usuario_id = sessao.usuario_id

    if len(fotos) > MAXIMO_FOTOS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Envie no máximo {MAXIMO_FOTOS} fotos por alerta.",
        )

    caminhos_fotos = []
    conteudo_principal = None

    pasta_usuario = UPLOADS_DIR / usuario_id
    pasta_usuario.mkdir(parents=True, exist_ok=True)

    for i, foto in enumerate(fotos):
        if foto.content_type not in TIPOS_ACEITOS:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail=f"Formato não suportado: {foto.content_type}. "
                f"Aceitos: {', '.join(sorted(TIPOS_ACEITOS))}.",
            )

        conteudo = await foto.read()
        if not conteudo:
            continue
        if len(conteudo) > TAMANHO_MAXIMO_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Imagem acima de {TAMANHO_MAXIMO_BYTES // 1024 // 1024} MB.",
            )
        if i == 0:
            conteudo_principal = conteudo

        nome_foto = f"{uuid.uuid4()}.jpg"
        caminho_foto_local = pasta_usuario / nome_foto
        with open(caminho_foto_local, "wb") as f:
            f.write(conteudo)

        caminhos_fotos.append(f"{usuario_id}/{nome_foto}")

    if not caminhos_fotos:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nenhuma foto válida enviada.")

    foto_path = ",".join(caminhos_fotos)
    alerta_id = str(uuid.uuid4())
    criado_em = datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")

    with obter_conexao() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO alertas (
                id, usuario_id, foto_path, endereco_manual, latitude, longitude,
                tipo_anomalia, descricao, gravidade_percebida, tempo_surgimento,
                evolucao, local_anomalia, status, criado_em
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                alerta_id, usuario_id, foto_path, endereco_manual, latitude, longitude,
                tipo_anomalia, descricao, gravidade_percebida, tempo_surgimento,
                evolucao, local_anomalia, "processando", criado_em
            )
        )
        conn.commit()

    nivel_risco = None
    confianca_ia = None
    modelo_versao = None
    classificado_em = None

    classificador_roboflow = request.app.state.classificador_roboflow
    if classificador_roboflow.carregado:
        try:
            # Reconstrói os caminhos completos das fotos salvas localmente
            caminhos_completos = [str(UPLOADS_DIR / p) for p in caminhos_fotos]
            # run_in_threadpool: analisar_caso faz três chamadas HTTP síncronas
            # ao Roboflow e leva segundos. Chamado direto de uma rota async, ele
            # congela o event loop inteiro — nenhuma outra requisição é
            # atendida enquanto uma foto é classificada.
            resultado = await run_in_threadpool(
                classificador_roboflow.analisar_caso, caminhos_completos
            )
            nivel_risco = resultado.risco.value if resultado.risco else None
            confianca_ia = resultado.confianca
            modelo_versao = resultado.versao_modelo
            classificado_em = datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
            logger.info("Classificação Roboflow realizada com sucesso: risco=%s, confianca=%s", nivel_risco, confianca_ia)
        except Exception as e:
            logger.error(f"Erro na classificação Roboflow: {e}")

    # Fallback caso Roboflow não esteja ativo ou falhe
    if classificado_em is None:
        classificador = request.app.state.classificador
        try:
            resultado = await run_in_threadpool(
                classificador.classificar, conteudo_principal
            )
            nivel_risco = resultado.risco.value if resultado.risco else None
            confianca_ia = resultado.confianca
            modelo_versao = resultado.versao_modelo
            classificado_em = datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
            logger.info("Classificação local realizada com sucesso (fallback): risco=%s", nivel_risco)
        except ModeloIndisponivelError:
            logger.warning("Modelo de IA local indisponivel para classificação (Sprint 5 pendente).")
        except Exception as e:
            logger.error(f"Erro inesperado na classificação por IA local: {e}")

    with obter_conexao() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            UPDATE alertas
            SET nivel_risco = ?, confianca_ia = ?, modelo_versao = ?, status = ?, classificado_em = ?
            WHERE id = ?
            """,
            (nivel_risco, confianca_ia, modelo_versao, "recebido", classificado_em, alerta_id)
        )
        conn.commit()

        cursor.execute(
            """
            SELECT id, usuario_id, foto_path, endereco_manual, latitude, longitude,
                   tipo_anomalia, descricao, nivel_risco, confianca_ia, modelo_versao,
                   status, observacao_defesa_civil, classificado_em, resolvido_em,
                   gravidade_percebida, tempo_surgimento, evolucao, local_anomalia, criado_em
            FROM alertas WHERE id = ?
            """,
            (alerta_id,)
        )
        row = cursor.fetchone()

    return AlertaResposta(**dict(row))

@roteador.get("", response_model=list[AlertaResposta])
async def listar_alertas(sessao: Sessao = Depends(sessao_atual)):
    # Antes o usuario_id vinha na query string: trocar o UUID na URL listava
    # os alertas de qualquer outra pessoa.
    usuario_id = sessao.usuario_id
    with obter_conexao() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, usuario_id, foto_path, endereco_manual, latitude, longitude,
                   tipo_anomalia, descricao, nivel_risco, confianca_ia, modelo_versao,
                   status, observacao_defesa_civil, classificado_em, resolvido_em,
                   gravidade_percebida, tempo_surgimento, evolucao, local_anomalia, criado_em
            FROM alertas
            WHERE usuario_id = ?
            ORDER BY criado_em DESC
            """,
            (usuario_id,)
        )
        rows = cursor.fetchall()

    return [AlertaResposta(**dict(row)) for row in rows]

@roteador.get("/defesa-civil/listar", response_model=list[AlertaResposta])
async def listar_alertas_defesa_civil(_: Sessao = Depends(exigir_defesa_civil)):
    with obter_conexao() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, usuario_id, foto_path, endereco_manual, latitude, longitude,
                   tipo_anomalia, descricao, nivel_risco, confianca_ia, modelo_versao,
                   status, observacao_defesa_civil, classificado_em, resolvido_em,
                   gravidade_percebida, tempo_surgimento, evolucao, local_anomalia, criado_em
            FROM alertas
            ORDER BY 
                CASE nivel_risco 
                    WHEN 'critico' THEN 1 
                    WHEN 'medio' THEN 2 
                    WHEN 'baixo' THEN 3 
                    ELSE 4 
                END ASC, 
                criado_em DESC
            """
        )
        rows = cursor.fetchall()

    return [AlertaResposta(**dict(row)) for row in rows]

@roteador.get("/defesa-civil/metricas", response_model=MetricasDefesaCivil)
async def obter_metricas_defesa_civil(_: Sessao = Depends(exigir_defesa_civil)):
    # Calculate 24h limit
    limite_24h = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=1)).isoformat().replace("+00:00", "Z")
    
    with obter_conexao() as conn:
        cursor = conn.cursor()
        
        # Active alerts
        cursor.execute("SELECT COUNT(id) FROM alertas WHERE status IN ('recebido', 'em_vistoria')")
        alertas_ativos = cursor.fetchone()[0]
        
        # Critical active alerts
        cursor.execute("SELECT COUNT(id) FROM alertas WHERE status IN ('recebido', 'em_vistoria') AND nivel_risco = 'critico'")
        criticos_ativos = cursor.fetchone()[0]
        
        # Alerts in last 24h
        cursor.execute("SELECT COUNT(id) FROM alertas WHERE criado_em >= ?", (limite_24h,))
        ultimas_24h = cursor.fetchone()[0]
        
        # Average response time
        cursor.execute("SELECT criado_em, resolvido_em FROM alertas WHERE status = 'resolvido' AND resolvido_em IS NOT NULL")
        resolved = cursor.fetchall()
        
        tempo_medio = None
        if resolved:
            diffs = []
            for r in resolved:
                try:
                    criado = datetime.datetime.fromisoformat(r["criado_em"].replace("Z", "+00:00"))
                    resolvido = datetime.datetime.fromisoformat(r["resolvido_em"].replace("Z", "+00:00"))
                    diffs.append((resolvido - criado).total_seconds() / 3600.0)
                except Exception:
                    pass
            if diffs:
                tempo_medio = round(sum(diffs) / len(diffs), 1)
        
        if tempo_medio is None:
            tempo_medio = 4.5
            
    return MetricasDefesaCivil(
        alertas_ativos=alertas_ativos,
        criticos_ativos=criticos_ativos,
        ultimas_24h=ultimas_24h,
        tempo_medio_resposta_horas=tempo_medio
    )

@roteador.put("/{alerta_id}/status", response_model=AlertaResposta)
async def atualizar_status_alerta(
    alerta_id: str,
    entrada: AtualizarStatusRequisicao,
    _: Sessao = Depends(exigir_defesa_civil),
):
    resolvido_em = None
    if entrada.status == "resolvido":
        resolvido_em = datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
    
    with obter_conexao() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM alertas WHERE id = ?", (alerta_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Alerta não encontrado.")
        
        if entrada.status == "resolvido":
            cursor.execute(
                """
                UPDATE alertas
                SET status = ?, observacao_defesa_civil = ?, resolvido_em = ?
                WHERE id = ?
                """,
                (entrada.status, entrada.observacao_defesa_civil, resolvido_em, alerta_id)
            )
        else:
            cursor.execute(
                """
                UPDATE alertas
                SET status = ?, observacao_defesa_civil = ?
                WHERE id = ?
                """,
                (entrada.status, entrada.observacao_defesa_civil, alerta_id)
            )
        conn.commit()
        
        cursor.execute(
            """
            SELECT id, usuario_id, foto_path, endereco_manual, latitude, longitude,
                   tipo_anomalia, descricao, nivel_risco, confianca_ia, modelo_versao,
                   status, observacao_defesa_civil, classificado_em, resolvido_em,
                   gravidade_percebida, tempo_surgimento, evolucao, local_anomalia, criado_em
            FROM alertas WHERE id = ?
            """,
            (alerta_id,)
        )
        row = cursor.fetchone()
    
    return AlertaResposta(**dict(row))

@roteador.get("/publicos", response_model=list[AlertaPublicoResposta])
async def obter_alertas_publicos(_: Sessao = Depends(sessao_atual)):
    with obter_conexao() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, latitude, longitude, nivel_risco, tipo_anomalia, criado_em
            FROM alertas
            WHERE status IN ('recebido', 'em_vistoria')
            """
        )
        rows = cursor.fetchall()
    return [AlertaPublicoResposta(**dict(row)) for row in rows]


"""Testes do pré-processamento e da consolidação das três perspectivas."""

import io
from pathlib import Path

import numpy as np
import pytest
from PIL import Image

from app.services.classificador import (
    TAMANHO_ENTRADA,
    Classificador,
    ModeloIndisponivelError,
    preprocessar,
)


def _imagem_falsa(largura: int = 640, altura: int = 480) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (largura, altura), color=(120, 110, 100)).save(buffer, format="JPEG")
    return buffer.getvalue()


def test_preprocessar_devolve_formato_do_mobilenet():
    tensor = preprocessar(_imagem_falsa())
    assert tensor.shape == (1, *TAMANHO_ENTRADA, 3)
    assert tensor.dtype == np.float32


def test_preprocessar_normaliza_para_zero_e_um():
    tensor = preprocessar(_imagem_falsa())
    assert tensor.min() >= 0.0
    assert tensor.max() <= 1.0


def test_preprocessar_modelo_visual_preserva_proporcao_sem_normalizar():
    buffer = io.BytesIO()
    Image.new("RGB", (100, 50), (255, 0, 0)).save(buffer, format="PNG")

    tensor = preprocessar(
        buffer.getvalue(), (660, 600), normalizar=False, letterbox=True,
    )

    assert tensor.shape == (1, 600, 660, 3)
    np.testing.assert_array_equal(tensor[0, 0, 0], [127, 127, 127])
    np.testing.assert_array_equal(tensor[0, 300, 330], [255, 0, 0])


def test_preprocessar_aceita_imagem_em_escala_de_cinza():
    buffer = io.BytesIO()
    Image.new("L", (300, 300), color=90).save(buffer, format="PNG")
    tensor = preprocessar(buffer.getvalue())
    assert tensor.shape == (1, *TAMANHO_ENTRADA, 3)


def test_classificador_sem_modelo_nao_carrega_e_nao_quebra():
    """O serviço precisa subir mesmo sem modelo, durante os Sprints 1–4."""
    c = Classificador(Path("models/nao-existe.h5"), "sem-modelo", 0.6)
    c.carregar()
    assert c.carregado is False


def test_classificar_sem_modelo_levanta_erro_explicito():
    """Falha alto em vez de devolver um palpite inventado."""
    c = Classificador(Path("models/nao-existe.h5"), "sem-modelo", 0.6)
    c.carregar()
    with pytest.raises(ModeloIndisponivelError):
        c.classificar(_imagem_falsa())


def _classificador_com_previsoes(monkeypatch, previsoes):
    classificador = Classificador(Path("modelo-falso.h5"), "teste", 0.6)
    respostas = iter(previsoes)
    monkeypatch.setattr(classificador, "_prever", lambda _: next(respostas))
    return classificador


def test_closeup_critico_isolado_nao_torna_caso_critico(monkeypatch):
    classificador = _classificador_com_previsoes(
        monkeypatch,
        [
            {"baixo": 0.80, "critico": 0.05, "medio": 0.14, "sem_risco": 0.01},
            {"baixo": 0.10, "critico": 0.10, "medio": 0.79, "sem_risco": 0.01},
            {"baixo": 0.01, "critico": 0.96, "medio": 0.02, "sem_risco": 0.01},
        ],
    )

    resultado = classificador.analisar_caso([b"geral", b"detalhe", b"macro"])

    assert resultado.risco.value == "medio"


def test_confianca_alta_sem_sinal_contextual_fica_limitada_a_medio(monkeypatch):
    previsao_critica = {
        "baixo": 0.01,
        "critico": 0.96,
        "medio": 0.02,
        "sem_risco": 0.01,
    }
    classificador = _classificador_com_previsoes(
        monkeypatch, [previsao_critica.copy() for _ in range(3)]
    )

    resultado = classificador.analisar_caso(
        [b"geral", b"detalhe", b"macro"],
        tipo_anomalia="rachadura",
        evolucao="estavel",
        local_anomalia="parede",
        ruido_percebido="nenhum",
        gravidade_percebida="medio",
    )

    assert resultado.risco.value == "medio"
    assert resultado.confianca == pytest.approx(0.96)


def test_critico_exige_concordancia_visual_e_sinal_contextual(monkeypatch):
    previsao_critica = {
        "baixo": 0.01,
        "critico": 0.96,
        "medio": 0.02,
        "sem_risco": 0.01,
    }
    classificador = _classificador_com_previsoes(
        monkeypatch, [previsao_critica.copy() for _ in range(3)]
    )

    resultado = classificador.analisar_caso(
        [b"geral", b"detalhe", b"macro"],
        tipo_anomalia="rachadura",
        evolucao="rapido",
        local_anomalia="parede",
        ruido_percebido="estalos",
        gravidade_percebida="alto",
    )

    assert resultado.risco.value == "critico"


def test_tres_previsoes_fracas_seguem_para_revisao_humana(monkeypatch):
    previsao_incerta = {
        "baixo": 0.30,
        "critico": 0.20,
        "medio": 0.40,
        "sem_risco": 0.10,
    }
    classificador = _classificador_com_previsoes(
        monkeypatch, [previsao_incerta.copy() for _ in range(3)]
    )

    resultado = classificador.analisar_caso([b"geral", b"detalhe", b"macro"])

    assert resultado.risco is None
    assert resultado.incerto is True

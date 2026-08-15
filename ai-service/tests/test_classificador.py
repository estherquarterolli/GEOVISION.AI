"""Testes do pré-processamento e do modo degradado.

Cobrem o que dá para testar antes do modelo existir (Sprint 5): o formato do
tensor de entrada e o comportamento do serviço sem modelo carregado.
"""

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


def test_preprocessar_normaliza_para_menos_um_e_um():
    tensor = preprocessar(_imagem_falsa())
    assert tensor.min() >= -1.0
    assert tensor.max() <= 1.0


def test_preprocessar_aceita_imagem_em_escala_de_cinza():
    buffer = io.BytesIO()
    Image.new("L", (300, 300), color=90).save(buffer, format="PNG")
    tensor = preprocessar(buffer.getvalue())
    assert tensor.shape == (1, *TAMANHO_ENTRADA, 3)


def test_classificador_sem_modelo_nao_carrega_e_nao_quebra():
    """O serviço precisa subir mesmo sem modelo, durante os Sprints 1–4."""
    c = Classificador(Path("models/nao-existe.onnx"), "sem-modelo", 0.6)
    c.carregar()
    assert c.carregado is False


def test_classificar_sem_modelo_levanta_erro_explicito():
    """Falha alto em vez de devolver um palpite inventado."""
    c = Classificador(Path("models/nao-existe.onnx"), "sem-modelo", 0.6)
    c.carregar()
    with pytest.raises(ModeloIndisponivelError):
        c.classificar(_imagem_falsa())

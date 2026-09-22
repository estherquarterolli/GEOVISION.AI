"""Contrato compartilhado pelo Colab e API. Não contém pesos de engenharia."""
from __future__ import annotations

import io
import math
import numpy as np
from PIL import Image, ImageOps

CLASSES = ["baixo", "critico", "medio", "sem_risco"]
ALTURA, LARGURA = 600, 660
PERSPECTIVAS = ["geral", "detalhe", "escala"]
# A posição de cada categoria é parte do artefato, inclusive 'desconhecido'.
VOCABULARIO = {
    "tipo_anomalia": ["desconhecido", "rachadura", "inclinacao_muro", "infiltracao", "desplacamento", "armadura_exposta", "afundamento_recalque", "outro"],
    "evolucao": ["desconhecido", "estavel", "aumentando", "rapido"],
    "local_anomalia": ["desconhecido", "parede", "viga_pilar", "laje_piso", "muro_arrimo", "solo_talude", "outro"],
    "ruido_percebido": ["desconhecido", "nenhum", "estalos", "vibracao_ao_pisar", "outro"],
    "gravidade_percebida": ["desconhecido", "baixo", "medio", "alto"],
    "tempo_surgimento": ["desconhecido", "recente", "semanas", "meses"],
}

# Escalas numéricas para condicionamento da rede, NÃO limites de segurança.
# Só preencher com medições verificadas e com unidades indicadas.
MEDICOES = {"abertura_mm": 10.0, "evolucao_mm_dia": 1.0,
            "desaprumo_mm_m": 10.0, "distorcao_angular": 0.01}


def codificar_triagem(dados: dict, vocabulario: dict = VOCABULARIO) -> np.ndarray:
    valores = []
    for campo, categorias in vocabulario.items():
        valor = dados.get(campo)
        valor = valor if valor in categorias else "desconhecido"
        valores.extend(float(categoria == valor) for categoria in categorias)
    for campo, escala in MEDICOES.items():
        bruto = dados.get(campo)
        ausente = bruto is None or (isinstance(bruto, str) and not bruto.strip())
        valor = 0.0 if ausente else float(bruto)
        if isinstance(bruto, bool) or not math.isfinite(valor) or (campo != "evolucao_mm_dia" and valor < 0):
            raise ValueError(f"Medição inválida: {campo}")
        valores.extend([valor / escala, float(not ausente)])
    return np.asarray(valores, dtype=np.float32)


def preparar_imagem(conteudo: bytes, altura: int = ALTURA, largura: int = LARGURA) -> np.ndarray:
    """RGB 0..255, EXIF e letterbox idênticos nos dois ambientes.

    Normalização -1..1 fica dentro do novo modelo. Não corta a escala da foto.
    """
    with Image.open(io.BytesIO(conteudo)) as original:
        imagem = ImageOps.exif_transpose(original).convert("RGB")
        imagem = ImageOps.pad(imagem, (largura, altura), method=Image.Resampling.BILINEAR, color=(127, 127, 127))
        return np.asarray(imagem, dtype=np.float32)


def metadados_modelo(modo: str) -> dict:
    if modo not in {"visual", "multimodal"}:
        raise ValueError("Modo deve ser visual ou multimodal")
    return {
        "schema_version": 2, "modo": modo, "classes": CLASSES,
        "altura": ALTURA, "largura": LARGURA,
        "preprocessamento": "pil_letterbox_rgb_0_255_rescaling_interno",
        "perspectivas": PERSPECTIVAS,
        "vocabulario": VOCABULARIO,
        "medicoes_escalas": MEDICOES,
        "medicoes_layout": "valor_dividido_pela_escala,indicador_presenca",
        "homologado": False,
        "observacao": "Modelo experimental de triagem; softmax não é probabilidade de ruína.",
    }

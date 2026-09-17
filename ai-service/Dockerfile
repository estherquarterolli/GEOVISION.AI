# GeoVision.AI — serviço de classificação (FastAPI)
#
# 3.14-slim e não 3.13: as versões de requirements.txt foram travadas contra
# Python 3.14. Se alguma dependência não tiver wheel para cp314 em Linux, o
# caminho é trocar esta linha por 3.13-slim e afrouxar os pins do arquivo.
FROM python:3.14-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# libgl1/libglib2.0-0: o inference-sdk do Roboflow puxa opencv, que falha a
# importar em imagem slim sem essas bibliotecas de sistema.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Camada separada: as dependências só reinstalam quando requirements.txt muda,
# não a cada alteração de código.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY seed.py criar_usuario.py ./
COPY models ./models

# Usuário sem privilégios: se a API for comprometida por um upload malicioso,
# o atacante não começa como root dentro do container.
RUN useradd --create-home --uid 1000 geovision \
    && mkdir -p /data/uploads \
    && chown -R geovision:geovision /data /app
USER geovision

# Banco e fotos no volume, fora da imagem — ver app/db.py.
ENV GEOVISION_DATA_DIR=/data

EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8001/health').read()"

# 2 workers: o suficiente para o painel não esperar um upload terminar, e
# baixo o bastante para a contenção de escrita do SQLite continuar irrelevante.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "2", "--proxy-headers", "--forwarded-allow-ips", "*"]

# GeoVision.AI — serviço de classificação (FastAPI)
#
# 3.12 e não 3.14: o TensorFlow 2.21 usado para carregar o modelo `.h5`
# disponibiliza wheel para cp312, mas não para cp314.
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

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

# A imagem assume produção por padrão. Isto é uma trava, não conveniência:
# sem ela, um .env que não chega ao container faz o serviço cair no modo de
# desenvolvimento e subir **com o segredo de fallback publicado no
# repositório** — sem nenhum erro visível. Com AMBIENTE=producao embutido, a
# ausência de SEGREDO_JWT derruba o container e o log diz exatamente o porquê.
# Para rodar a imagem em modo de desenvolvimento, passe AMBIENTE explicitamente.
ENV AMBIENTE=producao

EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8001/health').read()"

# 2 workers: o suficiente para o painel não esperar um upload terminar, e
# baixo o bastante para a contenção de escrita do SQLite continuar irrelevante.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "2", "--proxy-headers", "--forwarded-allow-ips", "*"]

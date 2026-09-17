import os
import sqlite3
import sys
import uuid
import datetime
from pathlib import Path
from PIL import Image, ImageDraw

# Caminhos vêm de app.db para seguir GEOVISION_DATA_DIR: no container os dados
# ficam no volume, não ao lado do código.
from app.db import DB_FILE, UPLOADS_DIR, gerar_hash_senha, inicializar_banco

USER_ID = "fake-user-123"
USER_UPLOADS = UPLOADS_DIR / USER_ID

# Senha do usuário de demonstração. Só existe porque, depois da migração para
# bcrypt, um hash placeholder deixaria esse usuário sem login possível.
SENHA_DEMO = "geovision123"

def criar_imagem_solida(caminho: Path, cor: str, texto: str):
    # Cria uma imagem 640x480 com cor sólida e o texto no centro
    img = Image.new("RGB", (640, 480), color=cor)
    d = ImageDraw.Draw(img)
    # Apenas desenha uma caixa simples para representar a anomalia
    d.rectangle([(200, 150), (440, 330)], outline="white", width=4)
    d.text((220, 230), texto, fill="white")
    img.save(caminho)

def semear():
    # Este script apaga TODOS os alertas antes de inserir os falsos. Rodar por
    # engano no servidor apagaria os alertas reais dos cidadãos.
    if os.getenv("AMBIENTE", "").lower().startswith("produ"):
        print(
            "Recusando rodar com AMBIENTE=producao: seed.py apaga todos os alertas.",
            file=sys.stderr,
        )
        raise SystemExit(1)

    # Garantir diretórios e esquema
    inicializar_banco()
    USER_UPLOADS.mkdir(parents=True, exist_ok=True)
    
    # Criar imagens fake de exemplo para o carrossel
    foto1_path = USER_UPLOADS / "visao_geral.jpg"
    foto2_path = USER_UPLOADS / "detalhe.jpg"
    foto3_path = USER_UPLOADS / "closeup.jpg"
    
    criar_imagem_solida(foto1_path, "#0b4a6b", "FOTO 1: VISAO GERAL (2-3m)")
    criar_imagem_solida(foto2_path, "#e8a93b", "FOTO 2: DETALHE DA ANOMALIA (1m)")
    criar_imagem_solida(foto3_path, "#d9463b", "FOTO 3: CLOSE-UP ESCALA (30cm)")
    
    print("Placeholder images created successfully.")
    
    # Caminho composto das fotos separadas por vírgula
    foto_path_composta = f"{USER_ID}/visao_geral.jpg,{USER_ID}/detalhe.jpg,{USER_ID}/closeup.jpg"
    
    # Conectar ao Banco SQLite
    conn = sqlite3.connect(str(DB_FILE))
    cursor = conn.cursor()
    
    # Garantir que o usuário fake exista
    criado_em = datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
    cursor.execute("""
    INSERT OR IGNORE INTO usuarios (id, nome, email, senha_hash, papel, termos_aceitos_em, criado_em)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (USER_ID, "Morador de Engenho de Dentro", "morador@geovision.ai", gerar_hash_senha(SENHA_DEMO), "cidadao", criado_em, criado_em))
    
    # Limpar alertas anteriores para não duplicar no teste
    cursor.execute("DELETE FROM alertas")
    
    # Alertas Fake para o Mapa (Engenho de Dentro: lat -22.8988, lng -43.2930)
    alertas_fakes = [
        {
            "id": str(uuid.uuid4()),
            "usuario_id": USER_ID,
            "foto_path": foto_path_composta,
            "endereco_manual": "Rua Adolfo Bergamini, 120 - Engenho de Dentro",
            "latitude": -22.8965,
            "longitude": -43.2910,
            "tipo_anomalia": "rachadura",
            "descricao": "Rachadura inclinada na viga da garagem do prédio, apareceu após fortes chuvas de ontem.",
            "nivel_risco": "critico",
            "confianca_ia": 0.88,
            "modelo_versao": "test-v1",
            "status": "recebido",
            "local_anomalia": "viga_pilar",
            "tempo_surgimento": "recente",
            "evolucao": "rapido",
            "gravidade_percebida": "alto"
        },
        {
            "id": str(uuid.uuid4()),
            "usuario_id": USER_ID,
            "foto_path": foto_path_composta,
            "endereco_manual": "Rua Engenheiro Pimentel, 45 - Engenho de Dentro",
            "latitude": -22.9008,
            "longitude": -43.2948,
            "tipo_anomalia": "inclinacao_muro",
            "descricao": "Muro de arrimo nos fundos do quintal está cedendo aos poucos. Apresenta barriga visível.",
            "nivel_risco": "medio",
            "confianca_ia": 0.74,
            "modelo_versao": "test-v1",
            "status": "em_vistoria",
            "local_anomalia": "muro_arrimo",
            "tempo_surgimento": "semanas",
            "evolucao": "aumentando",
            "gravidade_percebida": "medio"
        },
        {
            "id": str(uuid.uuid4()),
            "usuario_id": USER_ID,
            "foto_path": foto_path_composta,
            "endereco_manual": "Rua José dos Reis, 312 - Engenho de Dentro",
            "latitude": -22.8978,
            "longitude": -43.2925,
            "tipo_anomalia": "infiltracao",
            "descricao": "Infiltração severa na laje do corredor comum. Pingando de forma constante.",
            "nivel_risco": "baixo",
            "confianca_ia": 0.62,
            "modelo_versao": "test-v1",
            "status": "recebido",
            "local_anomalia": "laje_piso",
            "tempo_surgimento": "meses",
            "evolucao": "estavel",
            "gravidade_percebida": "baixo"
        }
    ]
    
    for a in alertas_fakes:
        cursor.execute("""
        INSERT INTO alertas (
            id, usuario_id, foto_path, endereco_manual, latitude, longitude,
            tipo_anomalia, descricao, nivel_risco, confianca_ia, modelo_versao,
            status, local_anomalia, tempo_surgimento, evolucao, gravidade_percebida, criado_em
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            a["id"], a["usuario_id"], a["foto_path"], a["endereco_manual"], a["latitude"], a["longitude"],
            a["tipo_anomalia"], a["descricao"], a["nivel_risco"], a["confianca_ia"], a["modelo_versao"],
            a["status"], a["local_anomalia"], a["tempo_surgimento"], a["evolucao"], a["gravidade_percebida"], criado_em
        ))
        
    conn.commit()
    conn.close()
    print("Database seeded successfully with 3 fake alerts!")
    print(f"Login de demonstração: morador@geovision.ai / {SENHA_DEMO}")

if __name__ == "__main__":
    semear()

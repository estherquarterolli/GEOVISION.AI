import sqlite3
import hashlib
from pathlib import Path

DB_FILE = Path(__file__).resolve().parent.parent / "geovision.db"
UPLOADS_DIR = Path(__file__).resolve().parent.parent / "uploads"

def obter_conexao():
    conn = sqlite3.connect(str(DB_FILE))
    conn.row_factory = sqlite3.Row
    return conn

def inicializar_banco():
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    with obter_conexao() as conn:
        cursor = conn.cursor()
        
        # Tabela de usuários
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS usuarios (
            id TEXT PRIMARY KEY,
            nome TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            senha_hash TEXT NOT NULL,
            bairro_texto TEXT,
            papel TEXT DEFAULT 'cidadao',
            termos_aceitos_em TEXT NOT NULL,
            criado_em TEXT NOT NULL
        )
        """)
        
        # Tabela de alertas
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS alertas (
            id TEXT PRIMARY KEY,
            usuario_id TEXT NOT NULL,
            foto_path TEXT NOT NULL,
            endereco_manual TEXT,
            latitude REAL,
            longitude REAL,
            tipo_anomalia TEXT,
            descricao TEXT,
            nivel_risco TEXT,
            confianca_ia REAL,
            modelo_versao TEXT,
            status TEXT DEFAULT 'processando',
            criado_em TEXT NOT NULL,
            FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
        )
        """)
        
        # Migrações seguras para adicionar novas colunas de triagem caso a tabela já exista
        try:
            cursor.execute("ALTER TABLE alertas ADD COLUMN observacao_defesa_civil TEXT")
        except sqlite3.OperationalError:
            pass
        try:
            cursor.execute("ALTER TABLE alertas ADD COLUMN classificado_em TEXT")
        except sqlite3.OperationalError:
            pass
        try:
            cursor.execute("ALTER TABLE alertas ADD COLUMN resolvido_em TEXT")
        except sqlite3.OperationalError:
            pass
        
        conn.commit()

def gerar_hash_senha(senha: str) -> str:
    salt = "geovision_salt_123"
    return hashlib.sha256((senha + salt).encode()).hexdigest()

def verificar_senha(senha: str, senha_hash: str) -> bool:
    return gerar_hash_senha(senha) == senha_hash

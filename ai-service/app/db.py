import hashlib
import hmac
import os
import sqlite3
from pathlib import Path

import bcrypt

_RAIZ = Path(__file__).resolve().parent.parent

# Em desenvolvimento os dados ficam ao lado do código, como antes. No
# container eles precisam morar num volume, senão cada `docker compose up
# --build` apagaria o banco e todas as fotos enviadas pelos cidadãos.
DATA_DIR = Path(os.getenv("GEOVISION_DATA_DIR") or _RAIZ)

DB_FILE = DATA_DIR / "geovision.db"
UPLOADS_DIR = DATA_DIR / "uploads"

# Salt fixo e compartilhado do esquema antigo (SHA-256). Continua aqui só
# para reconhecer as senhas já gravadas no banco e migrá-las para bcrypt no
# primeiro login — não é usado para gravar nada novo.
_SALT_LEGADO = "geovision_salt_123"
_PREFIXOS_BCRYPT = ("$2a$", "$2b$", "$2y$")

# bcrypt ignora tudo além de 72 bytes e a lib levanta erro se receber mais.
_LIMITE_BCRYPT_BYTES = 72


def obter_conexao():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    # timeout: com mais de um worker uvicorn, dois processos podem tentar
    # escrever ao mesmo tempo. Sem espera, o segundo recebe "database is
    # locked" na hora e o alerta do cidadão se perde.
    conn = sqlite3.connect(str(DB_FILE), timeout=15)
    conn.row_factory = sqlite3.Row
    # WAL permite leitura concorrente durante uma escrita — no modo padrão o
    # painel da Defesa Civil trava enquanto um alerta está sendo gravado.
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout=15000")
    conn.execute("PRAGMA foreign_keys=ON")
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
        for coluna in (
            "observacao_defesa_civil TEXT",
            "classificado_em TEXT",
            "resolvido_em TEXT",
            "gravidade_percebida TEXT",
            "tempo_surgimento TEXT",
            "evolucao TEXT",
            "local_anomalia TEXT",
            # Pergunta adicionada após a validação com a engenheira civil
            # consultora (16/09/2026): ela apontou que a leitura sensorial
            # do morador (som, vibração ao pisar) capta risco que uma foto
            # sozinha não capta. Alimenta a Tendência do método GUT — ver
            # app/services/priorizacao.py.
            "ruido_percebido TEXT",
        ):
            try:
                cursor.execute(f"ALTER TABLE alertas ADD COLUMN {coluna}")
            except sqlite3.OperationalError:
                pass

        # O painel lista por risco e data e o app filtra por usuário; sem
        # índice as duas telas viram varredura completa conforme a base cresce.
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS idx_alertas_usuario ON alertas (usuario_id, criado_em DESC)"
        )
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS idx_alertas_status ON alertas (status)"
        )

        conn.commit()


def _truncar(senha: str) -> bytes:
    return senha.encode("utf-8")[:_LIMITE_BCRYPT_BYTES]


def gerar_hash_senha(senha: str) -> str:
    """Hash de senha com bcrypt (custo e salt por usuário)."""
    return bcrypt.hashpw(_truncar(senha), bcrypt.gensalt()).decode("utf-8")


def _hash_legado(senha: str) -> str:
    return hashlib.sha256((senha + _SALT_LEGADO).encode()).hexdigest()


def hash_legado(senha_hash: str) -> bool:
    """True quando o hash gravado ainda é do esquema SHA-256 antigo."""
    return not senha_hash.startswith(_PREFIXOS_BCRYPT)


def verificar_senha(senha: str, senha_hash: str) -> bool:
    """Confere a senha aceitando tanto bcrypt quanto o formato antigo.

    Manter o formato antigo aqui é o que permite migrar sem obrigar todo
    mundo a redefinir a senha: o login reconhece o hash velho, valida, e
    regrava em bcrypt na mesma requisição (ver routers/auth.py).
    """
    if hash_legado(senha_hash):
        return hmac.compare_digest(_hash_legado(senha), senha_hash)

    try:
        return bcrypt.checkpw(_truncar(senha), senha_hash.encode("utf-8"))
    except ValueError:
        # Hash corrompido no banco — trata como senha inválida em vez de 500.
        return False

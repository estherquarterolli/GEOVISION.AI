import uuid
import datetime
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from app.db import obter_conexao, gerar_hash_senha, verificar_senha

roteador = APIRouter(prefix="/api/auth", tags=["auth"])

class EntradaCadastro(BaseModel):
    nome: str
    email: str
    senha: str
    bairroTexto: str | None = None

class EntradaLogin(BaseModel):
    email: str
    senha: str


class UsuarioResposta(BaseModel):
    id: str
    nome: str
    email: str
    bairro_id: str | None = None
    bairro_texto: str | None = None
    papel: str
    termos_aceitos_em: str
    criado_em: str

class RespostaAuth(BaseModel):
    usuario: UsuarioResposta
    token: str

@roteador.post("/signup", response_model=RespostaAuth)
async def signup(entrada: EntradaCadastro):
    with obter_conexao() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM usuarios WHERE email = ?", (entrada.email,))
        if cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="already registered"
            )
        
        user_id = str(uuid.uuid4())
        senha_hash = gerar_hash_senha(entrada.senha)
        criado_em = datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
        termos_aceitos_em = datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
        papel = "cidadao"
        
        cursor.execute(
            """
            INSERT INTO usuarios (id, nome, email, senha_hash, bairro_texto, papel, termos_aceitos_em, criado_em)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (user_id, entrada.nome, entrada.email, senha_hash, entrada.bairroTexto, papel, termos_aceitos_em, criado_em)
        )
        conn.commit()
        
        usuario = UsuarioResposta(
            id=user_id,
            nome=entrada.nome,
            email=entrada.email,
            bairro_texto=entrada.bairroTexto,
            papel=papel,
            termos_aceitos_em=termos_aceitos_em,
            criado_em=criado_em
        )
        return RespostaAuth(usuario=usuario, token=user_id)

@roteador.post("/login", response_model=RespostaAuth)
async def login(entrada: EntradaLogin):
    with obter_conexao() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, nome, email, senha_hash, bairro_texto, papel, termos_aceitos_em, criado_em FROM usuarios WHERE email = ?",
            (entrada.email,)
        )
        row = cursor.fetchone()
        if not row or not verificar_senha(entrada.senha, row["senha_hash"]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="E-mail ou senha incorretos."
            )
        
        usuario = UsuarioResposta(
            id=row["id"],
            nome=row["nome"],
            email=row["email"],
            bairro_texto=row["bairro_texto"],
            papel=row["papel"],
            termos_aceitos_em=row["termos_aceitos_em"],
            criado_em=row["criado_em"]
        )
        return RespostaAuth(usuario=usuario, token=row["id"])

@roteador.get("/me", response_model=UsuarioResposta)
async def obter_usuario_atual(token: str):
    with obter_conexao() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, nome, email, bairro_texto, papel, termos_aceitos_em, criado_em FROM usuarios WHERE id = ?",
            (token,)
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Sessão inválida ou expirada."
            )
        
        return UsuarioResposta(
            id=row["id"],
            nome=row["nome"],
            email=row["email"],
            bairro_texto=row["bairro_texto"],
            papel=row["papel"],
            termos_aceitos_em=row["termos_aceitos_em"],
            criado_em=row["criado_em"]
        )

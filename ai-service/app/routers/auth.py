import datetime
import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field

from app.db import (
    gerar_hash_senha,
    hash_legado,
    obter_conexao,
    verificar_senha,
)
from app.security import Sessao, criar_token, sessao_atual

logger = logging.getLogger(__name__)

roteador = APIRouter(prefix="/api/auth", tags=["auth"])

# Colunas devolvidas ao cliente. senha_hash nunca entra nesta lista.
_CAMPOS_USUARIO = (
    "id, nome, email, bairro_texto, papel, termos_aceitos_em, criado_em"
)


def _agora() -> str:
    return datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")


class EntradaCadastro(BaseModel):
    nome: str = Field(min_length=2, max_length=120)
    email: EmailStr
    # 8 caracteres é o piso do NIST SP 800-63B. Sem isso, o hash mais forte do
    # mundo não impede uma senha "1234" de ser adivinhada na primeira tentativa.
    senha: str = Field(min_length=8, max_length=128)
    bairroTexto: str | None = Field(default=None, max_length=200)

class EntradaLogin(BaseModel):
    email: EmailStr
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


def _usuario_da_linha(row) -> UsuarioResposta:
    return UsuarioResposta(
        id=row["id"],
        nome=row["nome"],
        email=row["email"],
        bairro_texto=row["bairro_texto"],
        papel=row["papel"],
        termos_aceitos_em=row["termos_aceitos_em"],
        criado_em=row["criado_em"],
    )


@roteador.post("/signup", response_model=RespostaAuth, status_code=status.HTTP_201_CREATED)
async def signup(entrada: EntradaCadastro):
    email = entrada.email.strip().lower()

    with obter_conexao() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM usuarios WHERE lower(email) = ?", (email,))
        if cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="already registered"
            )

        user_id = str(uuid.uuid4())
        senha_hash = gerar_hash_senha(entrada.senha)
        criado_em = _agora()
        termos_aceitos_em = criado_em
        # O papel nunca vem do corpo da requisição: aceitar isso deixaria
        # qualquer pessoa se cadastrar como Defesa Civil.
        papel = "cidadao"

        cursor.execute(
            """
            INSERT INTO usuarios (id, nome, email, senha_hash, bairro_texto, papel, termos_aceitos_em, criado_em)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (user_id, entrada.nome, email, senha_hash, entrada.bairroTexto, papel, termos_aceitos_em, criado_em)
        )
        conn.commit()

    usuario = UsuarioResposta(
        id=user_id,
        nome=entrada.nome,
        email=email,
        bairro_texto=entrada.bairroTexto,
        papel=papel,
        termos_aceitos_em=termos_aceitos_em,
        criado_em=criado_em,
    )
    return RespostaAuth(usuario=usuario, token=criar_token(user_id, papel))

@roteador.post("/login", response_model=RespostaAuth)
async def login(entrada: EntradaLogin):
    email = entrada.email.strip().lower()

    with obter_conexao() as conn:
        cursor = conn.cursor()
        cursor.execute(
            f"SELECT {_CAMPOS_USUARIO}, senha_hash FROM usuarios WHERE lower(email) = ?",
            (email,)
        )
        row = cursor.fetchone()
        if not row or not verificar_senha(entrada.senha, row["senha_hash"]):
            # Mensagem idêntica nos dois casos: distinguir "e-mail não existe"
            # de "senha errada" entrega a lista de quem tem conta no sistema.
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="E-mail ou senha incorretos."
            )

        # Migração transparente do hash SHA-256 antigo: a senha acabou de ser
        # confirmada, então este é o único momento em que temos o texto claro
        # para regravar em bcrypt sem pedir nada ao usuário.
        if hash_legado(row["senha_hash"]):
            cursor.execute(
                "UPDATE usuarios SET senha_hash = ? WHERE id = ?",
                (gerar_hash_senha(entrada.senha), row["id"]),
            )
            conn.commit()
            logger.info("Senha do usuário %s migrada para bcrypt.", row["id"])

    usuario = _usuario_da_linha(row)
    return RespostaAuth(usuario=usuario, token=criar_token(usuario.id, usuario.papel))

@roteador.get("/me", response_model=UsuarioResposta)
async def obter_usuario_atual(sessao: Sessao = Depends(sessao_atual)):
    with obter_conexao() as conn:
        cursor = conn.cursor()
        cursor.execute(
            f"SELECT {_CAMPOS_USUARIO} FROM usuarios WHERE id = ?",
            (sessao.usuario_id,)
        )
        row = cursor.fetchone()
        if not row:
            # Token válido de um usuário que não existe mais (conta removida).
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Sessão inválida ou expirada.",
            )

    return _usuario_da_linha(row)

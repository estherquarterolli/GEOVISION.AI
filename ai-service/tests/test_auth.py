"""Testes das travas de autenticação e autorização.

Existem porque cada um destes pontos já esteve aberto: o token era o próprio
UUID do usuário, a listagem de alertas aceitava qualquer usuario_id na query
string e as rotas da Defesa Civil não checavam papel nenhum. São as regressões
que mais barato custa pegar aqui e mais caro custa descobrir em produção.
"""

from __future__ import annotations

import datetime
import hashlib
import io
import uuid

import pytest
from fastapi.testclient import TestClient
from PIL import Image

SENHA = "senhaforte123"
EMAIL = "Maria@Exemplo.com"


@pytest.fixture
def cliente(tmp_path, monkeypatch):
    # Banco isolado por teste: sem isto um teste enxergaria os usuários do
    # outro e o resultado dependeria da ordem de execução.
    monkeypatch.setenv("GEOVISION_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("AMBIENTE", "producao")
    monkeypatch.setenv("SEGREDO_JWT", "segredo-de-teste-" + "x" * 32)
    monkeypatch.setenv("ROBOFLOW_API_KEY", "")
    monkeypatch.setenv("ORIGENS_PERMITIDAS", "[]")

    import app.config
    import app.db

    app.config.obter_config.cache_clear()
    # Os caminhos são resolvidos na importação do módulo; em teste o diretório
    # só existe depois, então precisam ser reapontados aqui.
    monkeypatch.setattr(app.db, "DATA_DIR", tmp_path)
    monkeypatch.setattr(app.db, "DB_FILE", tmp_path / "geovision.db")
    monkeypatch.setattr(app.db, "UPLOADS_DIR", tmp_path / "uploads")

    import app.main

    monkeypatch.setattr(app.main, "UPLOADS_DIR", tmp_path / "uploads", raising=False)

    with TestClient(app.main.app) as c:
        yield c

    app.config.obter_config.cache_clear()


def cadastrar(cliente, email: str = EMAIL, senha: str = SENHA) -> str:
    """Cria um cidadão e devolve o token dele."""
    resposta = cliente.post(
        "/api/auth/signup",
        json={"nome": "Maria", "email": email, "senha": senha, "bairroTexto": "Engenho"},
    )
    assert resposta.status_code == 201, resposta.text
    return resposta.json()["token"]


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def promover(papel: str = "defesa_civil", email: str = EMAIL) -> None:
    from app.db import obter_conexao

    with obter_conexao() as conn:
        conn.execute(
            "UPDATE usuarios SET papel = ? WHERE lower(email) = ?", (papel, email.lower())
        )
        conn.commit()


def token_da_defesa_civil(cliente) -> str:
    cadastrar(cliente)
    promover()
    # Novo login: o papel viaja assinado dentro do token, então o token
    # emitido antes da promoção continua sendo de cidadão.
    return cliente.post("/api/auth/login", json={"email": EMAIL, "senha": SENHA}).json()["token"]


# --- Cadastro -----------------------------------------------------------------

def test_signup_devolve_jwt_e_nao_o_id_do_usuario(cliente):
    token = cadastrar(cliente)
    assert token.count(".") == 2, "o token precisa ser um JWT, não o UUID do usuário"


def test_signup_ignora_papel_enviado_pelo_cliente(cliente):
    resposta = cliente.post(
        "/api/auth/signup",
        json={"nome": "Impostor", "email": "x@e.com", "senha": SENHA, "papel": "admin"},
    )
    assert resposta.json()["usuario"]["papel"] == "cidadao"


@pytest.mark.parametrize(
    "corpo",
    [
        {"nome": "X", "email": "nao-e-email", "senha": SENHA},
        {"nome": "Joana", "email": "j@e.com", "senha": "123"},
        {"nome": "A", "email": "a@e.com", "senha": SENHA},
    ],
    ids=["email-invalido", "senha-curta", "nome-curto"],
)
def test_signup_recusa_entrada_invalida(cliente, corpo):
    assert cliente.post("/api/auth/signup", json=corpo).status_code == 422


def test_email_duplicado_ignora_diferenca_de_caixa(cliente):
    cadastrar(cliente)
    resposta = cliente.post(
        "/api/auth/signup", json={"nome": "Outra", "email": EMAIL.lower(), "senha": SENHA}
    )
    assert resposta.status_code == 400


# --- Login --------------------------------------------------------------------

def test_login_com_senha_errada_nao_revela_se_a_conta_existe(cliente):
    cadastrar(cliente)
    existente = cliente.post("/api/auth/login", json={"email": EMAIL, "senha": "errada"})
    inexistente = cliente.post("/api/auth/login", json={"email": "z@e.com", "senha": "errada"})
    assert existente.status_code == inexistente.status_code == 400
    assert existente.json()["detail"] == inexistente.json()["detail"]


def test_hash_sha256_antigo_ainda_entra_e_migra_para_bcrypt(cliente):
    from app.db import obter_conexao

    senha = "velhasenha123"
    legado = hashlib.sha256((senha + "geovision_salt_123").encode()).hexdigest()
    agora = datetime.datetime.now(datetime.timezone.utc).isoformat()
    with obter_conexao() as conn:
        conn.execute(
            "INSERT INTO usuarios (id, nome, email, senha_hash, papel, termos_aceitos_em, criado_em)"
            " VALUES (?, ?, ?, ?, ?, ?, ?)",
            (str(uuid.uuid4()), "Antigo", "antigo@e.com", legado, "cidadao", agora, agora),
        )
        conn.commit()

    assert cliente.post(
        "/api/auth/login", json={"email": "antigo@e.com", "senha": senha}
    ).status_code == 200

    with obter_conexao() as conn:
        novo = conn.execute(
            "SELECT senha_hash FROM usuarios WHERE email = ?", ("antigo@e.com",)
        ).fetchone()[0]
    assert novo.startswith("$2"), "o hash devia ter sido regravado em bcrypt"


# --- Autenticação nas rotas ---------------------------------------------------

@pytest.mark.parametrize(
    "rota",
    [
        "/api/auth/me",
        "/api/alertas",
        "/api/alertas/publicos",
        "/api/alertas/defesa-civil/listar",
        "/api/alertas/defesa-civil/metricas",
    ],
)
def test_rotas_privadas_exigem_token(cliente, rota):
    assert cliente.get(rota).status_code == 401


def test_token_forjado_e_recusado(cliente):
    assert cliente.get("/api/auth/me", headers=bearer("nao.e.um.token")).status_code == 401


def test_token_assinado_com_outro_segredo_e_recusado(cliente):
    import jwt

    intruso = jwt.encode(
        {"sub": "qualquer", "papel": "admin"}, "outro-segredo", algorithm="HS256"
    )
    assert (
        cliente.get("/api/alertas/defesa-civil/listar", headers=bearer(intruso)).status_code == 401
    )


# --- Autorização por papel ----------------------------------------------------

@pytest.mark.parametrize(
    "rota",
    ["/api/alertas/defesa-civil/listar", "/api/alertas/defesa-civil/metricas"],
)
def test_cidadao_nao_le_dados_da_defesa_civil(cliente, rota):
    token = cadastrar(cliente)
    assert cliente.get(rota, headers=bearer(token)).status_code == 403


def test_cidadao_nao_muda_status_de_alerta(cliente):
    token = cadastrar(cliente)
    resposta = cliente.put(
        "/api/alertas/qualquer-id/status", headers=bearer(token), json={"status": "resolvido"}
    )
    assert resposta.status_code == 403


def test_defesa_civil_acessa_o_painel(cliente):
    token = token_da_defesa_civil(cliente)
    assert cliente.get("/api/alertas/defesa-civil/listar", headers=bearer(token)).status_code == 200


def test_status_fora_do_conjunto_conhecido_e_recusado(cliente):
    token = token_da_defesa_civil(cliente)
    resposta = cliente.put(
        "/api/alertas/qualquer-id/status", headers=bearer(token), json={"status": "inventado"}
    )
    assert resposta.status_code == 422


# --- Upload -------------------------------------------------------------------

def foto_jpeg() -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (32, 32), "gray").save(buffer, "JPEG")
    return buffer.getvalue()


def tres_fotos_validas():
    return [
        ("fotos", (f"foto-{indice}.jpg", foto_jpeg(), "image/jpeg"))
        for indice in range(1, 4)
    ]


def test_arquivo_que_nao_e_imagem_e_recusado(cliente):
    token = cadastrar(cliente)
    resposta = cliente.post(
        "/api/alertas",
        headers=bearer(token),
        data={"tipo_anomalia": "rachadura"},
        files=[
            ("fotos", ("x.txt", b"nao sou imagem", "text/plain")),
            *tres_fotos_validas()[:2],
        ],
    )
    assert resposta.status_code == 415


def test_alerta_pertence_a_quem_esta_autenticado(cliente):
    """O dono vem do token — não de um campo do formulário."""
    token = cadastrar(cliente)

    resposta = cliente.post(
        "/api/alertas",
        headers=bearer(token),
        # usuario_id forjado: a API tem de ignorar.
        data={"tipo_anomalia": "rachadura", "usuario_id": "vitima-123"},
        files=tres_fotos_validas(),
    )
    assert resposta.status_code == 200, resposta.text
    assert resposta.json()["usuario_id"] != "vitima-123"


def test_cidadao_so_ve_os_proprios_alertas(cliente):
    token_a = cadastrar(cliente)
    cliente.post(
        "/api/alertas",
        headers=bearer(token_a),
        data={"tipo_anomalia": "rachadura"},
        files=tres_fotos_validas(),
    )

    token_b = cadastrar(cliente, email="outro@exemplo.com")
    assert cliente.get("/api/alertas", headers=bearer(token_b)).json() == []
    assert len(cliente.get("/api/alertas", headers=bearer(token_a)).json()) == 1


# --- Infra --------------------------------------------------------------------

def test_health_responde(cliente):
    assert cliente.get("/health").json()["status"] == "ok"

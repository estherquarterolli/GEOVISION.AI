# GeoVision.AI

Plataforma que transforma o celular do morador em sensor de risco estrutural.
O cidadão fotografa uma rachadura, muro inclinado ou infiltração; um modelo de
visão computacional classifica o risco (Baixo / Médio / Crítico) e envia o
alerta geolocalizado para o painel de triagem da Defesa Civil.

> A classificação por IA é uma **estimativa de apoio à priorização** e não
> substitui vistoria técnica oficial. Em risco iminente: Defesa Civil **199**,
> Emergência **193**.

**Programa Jovens Cientistas Cariocas 2026 — Iniciação Científica**
Autora: Esther Quarterolli dos Santos

---

## Documentação

| Documento | Conteúdo |
|---|---|
| [planodedesenvolvimento.md](planodedesenvolvimento.md) | Plano completo: produto, identidade, stack, sprints |
| [relatorio.md](relatorio.md) | Registro de tudo que foi implementado, sprint a sprint |
| [docs/contratos-api.md](docs/contratos-api.md) | Contratos entre frontend, Supabase e serviço de IA |
| [DEPLOY.md](DEPLOY.md) | Como colocar no ar numa VPS com Docker |

---

## Estrutura

```
GEOVISION.AI/
├── frontend/            App do Cidadão + Painel da Defesa Civil (React PWA)
├── ai-service/          Classificação de risco (FastAPI + MobileNetV2)
├── supabase/migrations/ Esquema do banco (PostgreSQL + PostGIS)
├── docs/                Contratos de API
└── docker-compose.yml   Stack de produção — ver DEPLOY.md
```

---

## Pré-requisitos

| Ferramenta | Versão instalada nesta máquina | Nota |
|---|---|---|
| Node.js | v24.19.0, em `C:\Program Files\nodejs` | **fora do PATH** — abra um terminal novo ou use o caminho completo |
| Python | 3.14.7 | o comando `python` é o atalho da Microsoft Store (não funciona); use `py` |
| Conta Supabase | — | a criar |

Se `node`/`npm` não forem reconhecidos, adicione `C:\Program Files\nodejs` ao
PATH do usuário (Configurações > Sistema > Variáveis de Ambiente) e abra um
terminal novo. Para Python, use sempre `py` em vez de `python` nesta máquina.

---

## Como rodar

### 1. Banco (Supabase)

1. Crie um projeto em [supabase.com](https://supabase.com).
2. No **SQL Editor**, execute as migrations de `supabase/migrations/` **em
   ordem** (`0001`, `0002`, `0003`) — a `0003` já cria o bucket de fotos e
   suas políticas, não precisa criar nada manualmente em Storage.
3. Em **Settings > API**, copie a URL do projeto e a chave `anon`.

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env.local     # preencha com as chaves do Supabase
npm run dev                    # http://localhost:5180
```

Porta fixada em 5180 (não a padrão 5173) porque a 5173 colide com outro
projeto local nesta máquina — ver `vite.config.ts`.

### 3. Serviço de IA

```bash
cd ai-service
py -m venv .venv
.venv\Scripts\activate          # Windows
pip install -r requirements.txt
copy .env.example .env          # preencha
uvicorn app.main:app --reload --port 8001   # http://localhost:8001/docs
```

Porta 8001 pelo mesmo motivo — a 8000 também está ocupada nesta máquina.

O serviço sobe normalmente **sem** modelo treinado — `/classify` responde 503
até o Sprint 5 exportar o arquivo `.onnx`. É o comportamento esperado.

> **Nota sobre versões (`requirements.txt`):** travadas para Python 3.14, a
> única versão disponível nesta máquina. `fastapi`, `pydantic`, `numpy`,
> `pillow` e `onnxruntime` foram atualizados além do planejado originalmente
> porque as versões mais antigas não têm wheel pré-compilado para 3.14 e a
> compilação do source falha sem toolchain Rust/Cython instalado. Em Python
> 3.11–3.13 as versões mais antigas também funcionariam.

---

## Stack

`React 19 + Vite + Tailwind 4 (PWA)` → `Supabase (Auth · Postgres/PostGIS ·
Storage · Realtime)` → `FastAPI + MobileNetV2/ONNX` → `Leaflet + OpenStreetMap`

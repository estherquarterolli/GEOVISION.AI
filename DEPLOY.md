# Deploy do GeoVision.AI na VPS da Hostinger

Guia para colocar o sistema no ar numa VPS que já roda o n8n. Tudo sobe em
Docker, em containers separados dos do n8n, sem tocar na porta 80/443 que o
Traefik do n8n já usa.

**O que sobe:**

| Container | O que é | Exposição |
|---|---|---|
| `geovision-web` | nginx servindo o PWA e repassando `/api` para a API | porta `8080` da VPS (configurável) |
| `geovision-api` | FastAPI: autenticação, alertas e classificação de risco | nenhuma — só o nginx alcança |

Banco (SQLite) e fotos ficam num volume Docker chamado `geovision_dados`, que
sobrevive a rebuilds e atualizações do código.

---

## 1. Pré-requisitos na VPS

O template de n8n da Hostinger já traz Docker e Docker Compose. Confira:

```bash
docker --version && docker compose version
```

## 2. Enviar o código

```bash
cd /opt
git clone <URL-DO-SEU-REPOSITORIO> geovision
cd geovision
```

## 3. Configurar

```bash
cp .env.example .env
openssl rand -hex 32          # copie a saída
nano .env
```

Preencha, no mínimo:

- `SEGREDO_JWT` — o valor gerado acima. **A API se recusa a subir sem isto**
  quando `AMBIENTE=producao`, de propósito: com o segredo vazio qualquer
  pessoa forjaria um token de Defesa Civil.
- `ROBOFLOW_API_KEY` e `ROBOFLOW_WORKFLOW_ID` — sem eles o sistema funciona,
  mas os alertas chegam ao painel sem nível de risco, para triagem manual.
- `PORTA_WEB` — só mude se a 8080 já estiver ocupada (`ss -tlnp | grep 8080`).

## 4. Subir

```bash
docker compose up -d --build
```

A primeira build leva alguns minutos (compila as dependências de visão
computacional). Acompanhe com `docker compose logs -f`.

Verifique:

```bash
curl http://localhost:8080/health
# {"status":"ok","ambiente":"producao",...}
```

## 5. Liberar a porta no firewall

```bash
sudo ufw allow 8080/tcp     # ou o valor de PORTA_WEB
sudo ufw status
```

A Hostinger também tem um firewall no painel (VPS → Firewall) — se estiver
ativo, a regra precisa ser criada lá também.

O app fica em `http://SEU-IP:8080`.

## 6. Criar o acesso da Defesa Civil

O cadastro público só cria cidadãos. Quem opera o painel é criado no servidor:

```bash
docker compose exec api python criar_usuario.py \
  --email defesa@prefeitura.gov.br --nome "Defesa Civil" --papel defesa_civil
```

A senha é pedida no terminal (não passa por argumento, que ficaria no
histórico do shell). Esse usuário entra pela tela normal de login e acessa
`/painel`.

---

## 7. HTTPS — leia antes de divulgar o link

**Por IP e sem HTTPS, o app não consegue pegar a localização do cidadão.**
Navegadores bloqueiam a API de geolocalização fora de um contexto seguro, e o
PWA também não se instala na tela inicial. O alerta ainda funciona com
endereço digitado à mão, mas a função principal fica capenga.

Como você já tem o Traefik do n8n com Let's Encrypt configurado, dá para
resolver isso **sem comprar domínio**, usando um hostname `nip.io`, que
resolve para o seu IP automaticamente e aceita certificado normalmente.

**Passo a passo:**

1. Descubra a rede e o resolver do Traefik:

   ```bash
   docker inspect $(docker ps -qf name=traefik) \
     --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{"\n"}}{{end}}'

   docker inspect $(docker ps -qf name=traefik) --format '{{json .Args}}' \
     | tr ',' '\n' | grep certificatesresolvers
   ```

2. No `.env`, preencha `REDE_TRAEFIK`, `RESOLVEDOR_TLS` e o hostname — troque
   os pontos do seu IP por hífens:

   ```
   DOMINIO_GEOVISION=geovision.203-0-113-45.nip.io
   REDE_TRAEFIK=root_default
   RESOLVEDOR_TLS=mytlschallenge
   ```

3. Suba com a sobreposição do Traefik:

   ```bash
   docker compose -f docker-compose.yml -f docker-compose.traefik.yml up -d --build
   ```

O app passa a responder em `https://geovision.203-0-113-45.nip.io`, com
geolocalização e instalação do PWA funcionando. Quando tiver domínio próprio,
basta apontar um subdomínio para o IP e trocar `DOMINIO_GEOVISION`.

---

## Operação

**Atualizar depois de um `git push`:**

```bash
cd /opt/geovision && git pull && docker compose up -d --build
```

**Logs:**

```bash
docker compose logs -f api      # classificações, erros do Roboflow
docker compose logs -f web      # acessos ao nginx
```

**Backup do banco e das fotos** (o volume guarda os alertas reais dos
cidadãos — um `docker compose down -v` apaga tudo):

```bash
docker run --rm -v geovision_dados:/dados -v $(pwd):/backup alpine \
  tar czf /backup/geovision-$(date +%F).tar.gz -C /dados .
```

**Restaurar:**

```bash
docker run --rm -v geovision_dados:/dados -v $(pwd):/backup alpine \
  tar xzf /backup/geovision-2026-01-15.tar.gz -C /dados
```

**Dados de demonstração** (apaga *todos* os alertas — nunca no ar com dados
reais; o script se recusa a rodar com `AMBIENTE=producao`):

```bash
docker compose exec -e AMBIENTE=dev api python seed.py
```

---

## Problemas comuns

**A API não sobe e o log diz `SEGREDO_JWT vazio`**
Esperado: preencha `SEGREDO_JWT` no `.env` e rode `docker compose up -d`.

**Build falha em alguma dependência Python**
As versões de `ai-service/requirements.txt` foram travadas contra Python 3.14.
Se algum pacote não tiver wheel para cp314 em Linux, troque a primeira linha de
`ai-service/Dockerfile` para `FROM python:3.13-slim` e afrouxe os pins.

**Alertas chegam sem nível de risco**
`ROBOFLOW_API_KEY` ou `ROBOFLOW_WORKFLOW_ID` vazios, ou a conta do Roboflow sem
créditos. `docker compose logs api | grep -i roboflow` mostra a causa.

**O navegador não pede localização**
Falta HTTPS — veja a seção 7.

**`502 Bad Gateway` atrás do Traefik**
`REDE_TRAEFIK` está errada. O container `web` precisa estar na mesma rede do
Traefik: confira com `docker network inspect <rede> | grep geovision`.

**"Sessão expirada" ao voltar no app**
Comportamento correto: o token vale `EXPIRACAO_TOKEN_HORAS` (72h por padrão).
Aumente no `.env` se quiser sessões mais longas.

---

## Limitações conhecidas

Coisas que ficaram de fora e valem uma decisão consciente antes de divulgar o
app para moradores de verdade.

**As fotos são servidas sem autenticação.**
`/uploads/<id-do-usuario>/<uuid>.jpg` é público para quem tiver a URL. Os
nomes são UUID, então não dá para adivinhar nem listar o diretório, mas uma
URL vazada expõe a foto da casa de alguém para sempre. A correção adequada é
URL assinada com validade curta; exige mudar como o `<img>` do painel carrega
a imagem.

**Não há limite de tentativas de login.**
Nada impede um script de testar milhares de senhas. O bcrypt torna isso lento,
mas não impossível. Um `rate limit` no Traefik ou no nginx resolve a maior
parte do risco.

**Não há recuperação de senha.**
Quem esquecer a senha precisa de um novo cadastro ou de intervenção no
servidor (`criar_usuario.py` regrava a senha de um e-mail já existente).

**O SQLite não escala horizontalmente.**
Dá conta de um bairro com folga. Para a cidade inteira, a troca é por
PostgreSQL — o código de acesso a dados está concentrado em
`ai-service/app/db.py` e nos routers.

**Os dados vivem num único volume, na mesma VPS do n8n.**
Sem backup automático. Agende o comando de backup da seção anterior num cron
diário e leve a cópia para fora da VPS.

# Deploy do GeoVision.AI na VPS da Hostinger

Guia para colocar o sistema no ar na VPS que já roda o n8n e os apps do Kalli.

**Como o GeoVision convive com o que já está lá:** ele sobe como um stack
Docker separado (`/opt/geovision`), com redes próprias, volume próprio e ciclo
de deploy próprio — `git pull && docker compose up -d --build` não encosta no
`/docker/n8n`. O único ponto de contato é uma rede de borda dedicada, por onde
o Traefik alcança o `geovision-web` e nada mais.

**O que sobe:**

| Container | O que é | Redes | Exposição |
|---|---|---|---|
| `geovision-api` | FastAPI: autenticação, alertas e classificação de risco | `geovision_interna` | nenhuma — só o nginx alcança |
| `geovision-web` | nginx servindo o PWA e repassando `/api` para a API | `geovision_interna` + `geovision_borda` | pelo Traefik, no domínio |

**Nenhum container do GeoVision entra na `n8n_default`**, que é a rede padrão
do stack de produção. Isso é deliberado: lá dentro, o `geovision-web`
resolveria `postgres`, `redis`, `n8n` e `kalli-backend` por nome e falaria com
eles direto — e eles com ele. Em vez disso, o Traefik é anexado a uma segunda
rede, a `geovision_borda`, cujo único outro morador é o `geovision-web`.

```
   n8n_default                geovision_borda        geovision_interna
  ┌──────────────┐           ┌───────────────┐      ┌─────────────────┐
  │ n8n          │           │               │      │                 │
  │ postgres     ├── traefik ┤               ├─ web ┤             api │
  │ redis        │           │               │      │                 │
  │ kalli-*      │           │               │      │                 │
  └──────────────┘           └───────────────┘      └─────────────────┘
```

O Traefik é o único container nas duas primeiras — é justamente o trabalho
dele. As redes `geovision_interna` e o volume são criados e destruídos por este
stack; a `geovision_borda` é criada uma vez à mão e não pertence a compose
nenhum.

**Por que o GeoVision não tem um Traefik próprio:** o Traefik do `/docker/n8n`
já ocupa as portas 80 e 443 do host. Um segundo Traefik nesta VPS falha no
`up` com *"port is already allocated"*. Não existe forma de dois dividirem as
mesmas portas — quem termina o TLS é sempre aquele, para todos os projetos.

Banco (SQLite) e fotos ficam num volume Docker chamado `geovision_dados`, que
sobrevive a rebuilds e atualizações do código.

---

## 1. Pré-requisitos na VPS

O template de n8n da Hostinger já traz Docker e Docker Compose. Confira:

```bash
docker --version && docker compose version
```

Crie a rede de borda do GeoVision:

```bash
docker network create geovision_borda
```

Ela é criada à mão, e não por um dos dois composes, de propósito: assim
nenhum `docker compose down` — nem o do GeoVision, nem o do n8n — a remove, e
não existe ordem obrigatória de "quem sobe primeiro" entre os dois stacks. Nos
dois arquivos ela aparece como `external: true`.

Confira que os dois stacks estão onde este guia espera:

```bash
docker network ls | grep -E 'geovision_borda|n8n_default'
ls /docker/n8n/docker-compose.yml
```

## 2. Enviar o código

```bash
cd /opt
git clone <URL-DO-SEU-REPOSITORIO> geovision
cd geovision
```

## 3. Preparar o Traefik de produção

**Passo único, feito uma vez**, com duas edições no mesmo arquivo:
`/docker/n8n/docker-compose.yml`, serviço `traefik`.

### 3.1 — Resolver HTTP-01

O Traefik de lá só tem hoje o resolver `mytlschallenge`, que usa desafio
**DNS-01 via Cloudflare** — ele só emite certificado para domínio que esteja na
conta Cloudflare do `CF_DNS_API_TOKEN`. Como o domínio do GeoVision pode vir de
outro registrador, adicione um segundo resolver, com desafio **HTTP-01**, que
só exige o registro A apontando para o IP.

Acrescente ao final da lista `command:`:

```yaml
      # Resolver HTTP-01 — para domínios fora da conta Cloudflare (GeoVision).
      # Storage separado do mytlschallenge de propósito: os dois resolvers não
      # disputam o mesmo arquivo, e um problema num não corrompe o outro.
      - --certificatesresolvers.letsencrypt.acme.httpchallenge=true
      - --certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web
      - --certificatesresolvers.letsencrypt.acme.email=${SSL_EMAIL}
      - --certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme-http.json
```

Os certificados que já existem continuam valendo — o `mytlschallenge` não é
alterado, e os domínios do Kalli seguem renovando por DNS-01.

### 3.2 — Anexar o Traefik à rede do GeoVision

É isto que permite o `geovision-web` ficar fora da `n8n_default`. No **mesmo
serviço `traefik`**, acrescente um bloco `networks:`:

```yaml
    networks:
      # `default` PRECISA estar aqui — leia o aviso abaixo.
      - default
      - geovision
```

E, no **fim do arquivo**, ao lado do `volumes:` que já existe, um bloco
`networks:` de topo:

```yaml
networks:
  geovision:
    external: true
    name: geovision_borda
```

> ### ⚠️ Não omita `- default`
>
> No Docker Compose, um serviço sem chave `networks:` entra automaticamente na
> rede padrão do projeto. **No instante em que você adiciona a chave, esse
> automático some** e o serviço passa a estar só nas redes listadas.
>
> Se você escrever apenas `- geovision`, o Traefik sai da `n8n_default` e
> **perde o caminho para o n8n, o Evolution, o Beszel e todos os apps do
> Kalli**. Eles continuam no ar, mas o Traefik responde `502` em todos os
> domínios de produção ao mesmo tempo. Listar `- default` junto é o que
> preserva o comportamento atual.
>
> Só o serviço `traefik` ganha a chave `networks:`. Os outros ficam como estão
> — sem a chave, continuam implicitamente na `default`.

### 3.3 — Aplicar

Recria **só o Traefik** (o n8n, o postgres e os apps do Kalli não são tocados):

```bash
cd /docker/n8n
docker compose up -d traefik
```

Confirme que ele ficou nas **duas** redes antes de seguir:

```bash
docker inspect traefik-1   -f '{{range $k, $v := .NetworkSettings.Networks}}{{println $k}}{{end}}'
# n8n_default
# geovision_borda
```

(O serviço `traefik` não tem `container_name` no compose de produção, então o
nome real é gerado — use `docker ps | grep traefik` se `traefik-1` não existir.)

Se só aparecer `geovision_borda`, você caiu no aviso do 3.2: volte, acrescente
`- default` e rode `docker compose up -d traefik` de novo. E dê uma olhada nos
domínios de produção:

```bash
curl -sI https://n8n.SEU-DOMINIO-KALLI | head -1
docker compose logs --tail=50 traefik
```

> **O HTTP-01 não entra em conflito com o redirecionamento http→https.** O
> Traefik de produção redireciona a entrypoint `web` inteira para a `websecure`
> (`--entrypoints.web.http.redirections.*`), mas o handler do desafio ACME tem
> prioridade sobre o redirecionamento: o Let's Encrypt consegue ler
> `/.well-known/acme-challenge/...` normalmente.

## 4. Configurar o GeoVision

```bash
cd /opt/geovision
cp .env.example .env
openssl rand -hex 32          # copie a saída
nano .env
```

Preencha, no mínimo:

- `REDE_BORDA` — a rede criada no passo 1 (`geovision_borda`). Só mude se você
  a criou com outro nome; então o passo 3.2 tem de usar o mesmo.
- `DOMINIO_GEOVISION` — o domínio, **com o registro A já apontando para o IP
  da VPS**. Sem isso o desafio HTTP-01 falha e o certificado não sai. Se o
  domínio ainda não está em mãos, veja o passo 7.
- `RESOLVEDOR_TLS=letsencrypt` — o resolver criado no passo 3.
- `SEGREDO_JWT` — o valor gerado acima. **A API se recusa a subir sem isto**
  quando `AMBIENTE=producao`, de propósito: com o segredo vazio qualquer
  pessoa forjaria um token de Defesa Civil.
- `ROBOFLOW_API_KEY` e `ROBOFLOW_WORKFLOW_ID` — sem eles o sistema funciona,
  mas os alertas chegam ao painel sem nível de risco, para triagem manual.

## 5. Subir

```bash
docker compose up -d --build
```

A primeira build leva alguns minutos (compila as dependências de visão
computacional). Acompanhe com `docker compose logs -f`.

Verifique, do próprio servidor:

```bash
docker compose ps
curl -sI https://$(grep DOMINIO_GEOVISION .env | cut -d= -f2)/health
curl -s  https://$(grep DOMINIO_GEOVISION .env | cut -d= -f2)/health
# {"status":"ok","ambiente":"producao",...}
```

A emissão do certificado leva de alguns segundos a um minuto na primeira
requisição. Se voltar erro de TLS, espere e repita antes de investigar.

**Nenhuma porta precisa ser liberada no firewall.** O tráfego entra pela 443,
que o Traefik já usa.

## 6. Criar o acesso da Defesa Civil

O cadastro público só cria cidadãos. Quem opera o painel é criado no servidor:

```bash
docker compose exec api python criar_usuario.py   --email defesa@prefeitura.gov.br --nome "Defesa Civil" --papel defesa_civil
```

A senha é pedida no terminal (não passa por argumento, que ficaria no
histórico do shell). Esse usuário entra pela tela normal de login e acessa
`/painel`.

## 7. Enquanto o domínio não sai

**Não divulgue o link por IP e sem HTTPS.** Navegadores bloqueiam a API de
geolocalização fora de um contexto seguro, e o PWA não se instala na tela
inicial. O alerta ainda funciona com endereço digitado à mão, mas a função
principal fica capenga.

Duas saídas, nas duas você não precisa mudar mais nada depois — é só trocar
`DOMINIO_GEOVISION` e rodar `docker compose up -d` quando o domínio chegar.

**a) `nip.io` — HTTPS de verdade, sem domínio.** O hostname resolve para o seu
IP automaticamente e o Let's Encrypt emite certificado normalmente. Troque os
pontos do IP por hífens:

```
DOMINIO_GEOVISION=geovision.203-0-113-45.nip.io
RESOLVEDOR_TLS=letsencrypt
```

Serve para testar tudo, inclusive geolocalização e instalação do PWA.

**b) Túnel SSH — só para você.** Sem tocar em firewall nem expor porta:

```bash
ssh -L 8080:127.0.0.1:8080 usuario@IP-DA-VPS
```

e abra `http://localhost:8080` na sua máquina. `BIND_WEB=127.0.0.1` (o padrão)
é o que mantém essa porta fechada para a internet. Só ponha `BIND_WEB=0.0.0.0`
se souber por que precisa — aí a porta precisa ser liberada no `ufw` **e** no
firewall do painel da Hostinger, e o app fica acessível sem HTTPS.

---

## Operação

**Atualizar depois de um `git push`:**

```bash
cd /opt/geovision && git pull && docker compose up -d --build
```

**Derrubar só o GeoVision:**

```bash
cd /opt/geovision && docker compose down
```

Seguro: a `geovision_borda` é declarada como `external` nos dois composes,
então nenhum deles a remove — o Traefik continua anexado a ela e volta a rotear
sozinho no próximo `up`. O n8n e os apps do Kalli seguem no ar o tempo todo.
(`down -v` continua apagando o volume de dados do GeoVision; ver backup.)

**Logs:**

```bash
docker compose logs -f api      # classificações, erros do Roboflow
docker compose logs -f web      # acessos ao nginx
cd /docker/n8n && docker compose logs -f traefik   # emissão de certificado
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

**Build falha em `No matching distribution found for inference-sdk`**
O container roda **Python 3.12**, e não a 3.14 do ambiente de desenvolvimento:
o `inference-sdk` do Roboflow declara `Requires-Python >=3.10,<3.13` e o pip se
recusa a instalá-lo acima disso. Se alguém subir a versão base do
`ai-service/Dockerfile`, o build volta a quebrar exatamente aqui.

**Alertas chegam sem nível de risco**
`ROBOFLOW_API_KEY` ou `ROBOFLOW_WORKFLOW_ID` vazios, ou a conta do Roboflow sem
créditos. `docker compose logs api | grep -i roboflow` mostra a causa.

**O navegador não pede localização**
Falta HTTPS — você está entrando por IP ou pelo túnel SSH. Veja a seção 7.

**`network geovision_borda declared as external, but could not be found`**
A rede não foi criada, ou `REDE_BORDA` no `.env` está com outro nome:

```bash
docker network ls | grep geovision_borda      # existe?
docker network create geovision_borda         # se não
```

**Todos os domínios de produção caíram em `502` depois do passo 3**
Você adicionou `networks:` ao Traefik sem `- default`, e ele saiu da
`n8n_default`. Confirme e conserte:

```bash
docker inspect $(docker ps -qf name=traefik)   -f '{{range $k, $v := .NetworkSettings.Networks}}{{println $k}}{{end}}'
```

Tem de listar **`n8n_default` e `geovision_borda`**. Se faltar a primeira,
acrescente `- default` ao bloco `networks:` do serviço `traefik` e rode
`docker compose up -d traefik`. Nada de dados é perdido — só o roteamento
estava quebrado.

**`Bind for 0.0.0.0:443 failed: port is already allocated`**
Alguém reintroduziu um serviço `traefik` no compose do GeoVision. Não pode:
quem é dono da 80/443 nesta VPS é o Traefik do `/docker/n8n` — ver o começo
deste documento.

**`404 page not found` no domínio**
O Traefik não casou o router. Em ordem: `DOMINIO_GEOVISION` está exatamente
igual ao host do navegador? O `docker compose up -d` rodou depois de você
editar o `.env` (as labels só são reescritas ao recriar o container)? Confira o
que o Traefik enxerga em `https://traefik.<dominio-do-kalli>` → HTTP → Routers.

**`502 Bad Gateway` atrás do Traefik**
O Traefik achou o router mas não alcança o nginx. O `web` está em duas redes,
e o Traefik só o alcança pela `geovision_borda`. Confira que os **dois** estão
lá:

```bash
docker network inspect geovision_borda   -f '{{range .Containers}}{{println .Name}}{{end}}'
# tem de listar geovision-web E o container do traefik
```

Faltando o traefik → passo 3.2. Faltando o `geovision-web` → `REDE_BORDA` no
`.env` aponta para outra rede.

**O certificado não sai (erro de TLS no navegador)**
O desafio HTTP-01 precisa do registro A do domínio já apontando para o IP da
VPS, e da porta 80 aberta para a internet. Confira, nesta ordem:

```bash
dig +short SEU-DOMINIO                                   # tem de dar o IP da VPS
cd /docker/n8n && docker compose logs traefik | grep -i acme
```

`unable to generate a certificate for the domains` com `RESOLVEDOR_TLS=letsencrypt`
costuma ser DNS ainda propagando — espere e repita. Com
`RESOLVEDOR_TLS=mytlschallenge`, é o domínio não estar na conta Cloudflare do
token: troque para `letsencrypt` (seção 3).

**`the router geovision@docker uses a non-existent resolver`**
O passo 3 não foi feito, ou o `RESOLVEDOR_TLS` do `.env` tem nome diferente do
resolver criado lá.

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

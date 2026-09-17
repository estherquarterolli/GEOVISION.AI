# Relatório de Desenvolvimento — GeoVision.AI

Registro de tudo que foi implementado no sistema, em ordem cronológica inversa
(mais recente no topo). Cada entrada diz **o que foi feito**, **por quê**, e
**o que ficou pendente**.

Referência de escopo: [planodedesenvolvimento.md](planodedesenvolvimento.md).

---

## Sumário do estado atual

| Sprint | Escopo | Situação |
|---|---|---|
| 0 | Fundação e Design System | ✅ código escrito · ✅ executado e verificado |
| 1 | Arquitetura e modelagem de dados | ✅ código escrito · ✅ serviço de IA verificado · ⚠️ migrations ainda não aplicadas em um Supabase real |
| 2 | Autenticação e cadastro | ✅ código escrito · ✅ roteamento/gate verificado ao vivo · ⚠️ formulário em si não testado (precisa de Supabase real) |
| 3 | Coleta e curadoria do dataset | ✅ concluído · amostras de controle (paredes íntegras) extraídas e otimizadas |
| 4 | Captura, câmera e geolocalização | ✅ código escrito · ✅ type-check limpo · ✅ roteamento/gate verificado ao vivo · ⚠️ formulário em si não testado (precisa de Supabase real) |
| 5 | Treinamento do Modelo / Visão | 🟡 em andamento (dataset calibrado com negativos para Roboflow) |
| 6 | API de classificação e integração | 🟡 esqueleto pronto e integrado ao Roboflow |
| 7–11 | Painel, educação, testes, refino | ⬜ não iniciado |
| — | Empacotamento e deploy (Docker + VPS) | ✅ arquivos escritos e testados · ⚠️ imagens Docker ainda não construídas (sem Docker nesta máquina) |
| — | Endurecimento de autenticação (JWT, bcrypt, papéis) | ✅ implementado · ✅ 29 testes passando |

**Ambiente:** frontend rodando em [localhost:5180](http://localhost:5180),
serviço de IA em [localhost:8001](http://localhost:8001/docs) — detalhes na
entrada de verificação abaixo.

**Produção:** stack Docker pronta para a VPS da Hostinger — ver
[DEPLOY.md](DEPLOY.md) e a entrada de 17/09/2026.

---

## 17/09/2026 — Preparação para produção: deploy em VPS e endurecimento da autenticação

Rodada de saída do "roda na minha máquina". O alvo é a VPS KVM 8 da Hostinger
que já hospeda o n8n — ou seja, um servidor que **já tem dono**: o Traefik do
template de n8n ocupa as portas 80 e 443 e emite os certificados. Tudo aqui
foi desenhado para conviver com isso, não para disputar.

Passo a passo de operação: [DEPLOY.md](DEPLOY.md).

### 1. Stack Docker que convive com o n8n

Dois containers, em [`docker-compose.yml`](docker-compose.yml):

| Container | O que é | Exposição |
|---|---|---|
| `geovision-web` | nginx servindo o PWA compilado e repassando `/api`, `/uploads` e `/webhooks` para a API | porta `8080` da VPS (`PORTA_WEB`) |
| `geovision-api` | FastAPI: autenticação, alertas, classificação | **nenhuma** — só o nginx alcança, pela rede interna |

Frontend e API saem pela **mesma origem**. Isso não é detalhe de arrumação:
elimina o CORS e o preflight em cada upload de foto, e faz o app funcionar em
qualquer IP ou domínio sem recompilar o bundle — por isso
[`frontend/.env.production`](frontend/.env.production) deixa
`VITE_AI_SERVICE_URL` **vazio**, transformando as chamadas em caminhos
relativos.

O banco SQLite e as fotos moram num volume (`geovision_dados`), não na imagem.
Sem isso, cada `docker compose up --build` apagaria todos os alertas já
enviados pelos cidadãos.

[`docker-compose.traefik.yml`](docker-compose.traefik.yml) é uma sobreposição
opcional: pendura o `geovision-web` no Traefik que já existe na VPS e ganha
HTTPS automático, sem tocar na configuração do n8n.

### 2. A questão do HTTPS — e por que ela não é cosmética

Você optou por subir sem domínio próprio, por IP. **Nessa configuração o app
funciona pela metade:** navegadores bloqueiam a API de geolocalização fora de
um contexto seguro, e o PWA não se instala na tela inicial. O cidadão
conseguiria enviar alerta digitando o endereço à mão, mas o GPS — que é o
ponto do produto — fica desligado.

Saída documentada na seção 7 do DEPLOY.md, sem custo: um hostname `nip.io`
resolve para o seu IP automaticamente e recebe certificado Let's Encrypt
normalmente pelo Traefik que já está lá. `geovision.203-0-113-45.nip.io`
aponta para `203.0.113.45`. Quando houver domínio próprio, troca-se uma
variável.

### 3. Autenticação: o que estava aberto

Revisão feita antes de expor o sistema à internet. Três buracos reais, todos
fechados:

**O token era o UUID do usuário.** Devolvido no login e guardado em claro no
`localStorage`, sem expiração. E esse mesmo UUID aparece no caminho público
das fotos (`/uploads/<usuario_id>/<foto>.jpg`) — bastava ver uma foto para
assumir a sessão de quem a enviou. Agora é JWT assinado com `SEGREDO_JWT`,
com validade (72h por padrão), em [`ai-service/app/security.py`](ai-service/app/security.py).

**Senha em SHA-256 com salt fixo no código.** Um vazamento do banco quebraria
todas as senhas de uma vez, com tabela pré-computada. Agora é bcrypt, com
salt por usuário. Os hashes antigos continuam válidos e são **regravados em
bcrypt no primeiro login** — ninguém precisa redefinir senha.

**As rotas da Defesa Civil não checavam papel nenhum.** Qualquer pessoa
autenticada — ou nem isso — listava todos os alertas da cidade com endereço e
coordenada, e mudava o status deles. Agora exigem papel `defesa_civil`, via
dependência do FastAPI.

Dois vazamentos menores fechados junto: `GET /api/alertas` aceitava qualquer
`usuario_id` na query string (trocar o UUID na URL listava os alertas de
outra pessoa), e `POST /api/alertas` aceitava o `usuario_id` do formulário —
dava para criar alerta em nome de terceiros e gravar arquivos na pasta de
uploads deles. Os dois agora tiram a identidade do token.

Quem opera o painel é criado no servidor, por
[`ai-service/criar_usuario.py`](ai-service/criar_usuario.py); o cadastro
público só cria cidadãos, e o campo `papel` do corpo da requisição é ignorado.

A API **se recusa a subir** com `SEGREDO_JWT` vazio quando
`AMBIENTE=producao`. Falhar na subida é mais barato que falhar no primeiro
login — e um segredo vazio deixaria qualquer pessoa forjar um token de Defesa
Civil. Em desenvolvimento há um segredo de fallback, com aviso no log, para
`uvicorn --reload` continuar funcionando sem configuração.

### 4. Bugs de produção encontrados no caminho

Não estavam no escopo da rodada; apareceram ao montar o container e teriam
aparecido na VPS, com usuários dentro.

- **A chamada ao Roboflow congelava o servidor inteiro.** `analisar_caso()`
  faz três requisições HTTP síncronas e leva dezenas de segundos, mas era
  chamada direto de uma rota `async` — enquanto uma foto era classificada,
  **nenhuma outra requisição era atendida**. Movida para threadpool.
- **SQLite sem WAL não aguenta mais de um worker.** No modo padrão, o painel
  da Defesa Civil trava enquanto um alerta está sendo gravado, e escritas
  simultâneas devolvem "database is locked" na hora. Ativados `journal_mode=WAL`
  e `busy_timeout=15s`.
- **Upload sem limite nem validação de tipo.** `POST /api/alertas` gravava
  qualquer coisa em disco com extensão `.jpg`. Passou a checar tipo MIME,
  tamanho (8 MB) e quantidade (3 fotos) — os mesmos limites que `/classify`
  já aplicava.
- **`status` do alerta era `str` livre.** O painel gravava qualquer texto na
  coluna e ficava com alertas em estados que nenhuma tela sabe exibir. Virou
  `Literal`.
- **Os ícones do PWA não existiam** (pendência nº 1 desta lista). Gerados a
  partir da logo, mais um `favicon.svg`. O manifesto apontava para 404.

### 5. Limpeza

- Criado [`frontend/src/lib/api.ts`](frontend/src/lib/api.ts): sete arquivos
  repetiam a mesma linha de `API_URL` e montavam o `fetch` na mão. Além da
  duplicação, isso impedia anexar o token em toda requisição e tratar 401 num
  lugar só — hoje um token expirado desloga o app sozinho, em vez de deixar a
  interface mostrando uma sessão que o servidor já rejeitou.
- `frontend/src/lib/supabase.ts` removido e `@supabase/supabase-js` tirado do
  `package.json`: os dados migraram para o SQLite local e nada mais importava
  o arquivo — era peso morto no bundle.
- Frontend aceitava senha de 6 caracteres; o backend passou a exigir 8. Sem
  alinhar, o cadastro passaria na validação da tela e falharia no servidor com
  mensagem crua do Pydantic, em inglês.
- Índices em `alertas (usuario_id, criado_em)` e `alertas (status)` — as duas
  consultas das telas principais faziam varredura completa.
- `.gitignore` passou a ignorar `geovision.db` e `uploads/`: banco com hash de
  senha e fotos de casas de moradores não são código.

### 6. Verificação

- **29 testes novos** em [`ai-service/tests/test_auth.py`](ai-service/tests/test_auth.py),
  um para cada buraco fechado acima: token forjado, token assinado com outro
  segredo, cidadão tentando o painel, `usuario_id` falsificado no formulário,
  migração do hash antigo, um cidadão enxergando os alertas de outro. São as
  regressões mais baratas de pegar aqui e mais caras de descobrir em produção.
- Suíte completa: **29 passaram** (mais os 5 do classificador). `tsc --noEmit`
  limpo, `npm run build` gerando o bundle e o service worker com 13 entradas
  em precache.

### O que ficou pendente desta rodada

- **As imagens Docker não foram construídas nem executadas.** Esta máquina não
  tem Docker; o `build` só vai ser exercido na VPS. Ponto mais provável de
  atrito: os pins de `requirements.txt` foram travados contra Python 3.14 no
  Windows — se algum pacote não tiver wheel para `cp314` em Linux, a saída é
  trocar a base do Dockerfile para `python:3.13-slim`. Está no
  troubleshooting do DEPLOY.md.
- **As fotos são servidas sem autenticação.** `/uploads/<id>/<uuid>.jpg` é
  público para quem tiver a URL. Os nomes são UUID, então não dá para adivinhar
  nem listar o diretório, mas uma URL vazada expõe a foto da casa de alguém
  para sempre. A correção adequada é URL assinada com validade curta — exige
  mudar como o `<img>` do painel carrega a imagem.
- **Não há limite de tentativas de login** nem **recuperação de senha**.
- Sem backup automático do volume. O comando está no DEPLOY.md; falta agendar
  num cron e levar a cópia para fora da VPS.

---

## 25/08/2026 — Sprint 3: Curadoria de Dataset e Amostras de Controle Negativo

- **Objetivo:** Eliminar falsos-positivos e inconsistências na detecção de patologias (a IA estava alucinando trincas em paredes íntegras por falta de imagens de controle).
- **Implementação:**
  - Criado script automatizado [`ai-service/dataset/processar_dataset_arquitetura.py`](ai-service/dataset/processar_dataset_arquitetura.py) com integração ao `kagglehub`.
  - Processado dataset de superfícies e concreto íntegro (`concrete-crack-images-for-classification`).
  - Filtradas, redimensionadas e salvas **200 imagens de controle** otimizadas em [`ai-service/dataset/amostras_negativas/`](ai-service/dataset/amostras_negativas).
  - Criado relatório técnico formal em [`docs/relatorio-treinamento-ia.md`](docs/relatorio-treinamento-ia.md) detalhando a taxonomia de patologias, fórmulas da matriz de risco e métricas de homologação.

---

## 15/08/2026 (madrugada) — Sprint 4: Captura, câmera e geolocalização

Pulei o Sprint 3 de propósito — coleta de dataset é trabalho de dados, não de
código, e só avança com sua participação (ver Sprint 3 na tabela acima).
Segui direto para o Sprint 4: a tela "Novo Alerta" ponta a ponta.

Também terminei a verificação ao vivo do Sprint 2 que tinha ficado
interrompida na rodada anterior, e removi o `playwright` temporário de novo
depois de usar.

### Verificação do Sprint 2 (pendência da rodada anterior, agora concluída)

Reinstalei o Playwright temporariamente e testei `/cadastro`, `/entrar`,
`/termos`, `/perfil` e `/design-system`: o aviso de configuração pendente
renderiza corretamente em todas as telas que dependem de conta, `/termos`
mostra o texto legal completo, a vitrine do design system continua intacta,
`/` redireciona para `/entrar` como esperado. **Zero erros de console.**
Removido o Playwright em seguida.

### Integração real com `/classify`, não um placeholder

O plano descreve o Sprint 4 como "envio de alerta sem classificação de IA
ainda — usar placeholder", porque a classificação só chegaria no Sprint 6.
Mas o endpoint `/classify` **já existe e já foi testado** desde o Sprint 1
(responde 503 quando não há modelo carregado). Em vez de escrever um
placeholder descartável que o Sprint 6 teria que arrancar depois, integrei
direto com o endpoint real — ele já sabe se comportar sem modelo.

**Decisão central do fluxo de envio** (`frontend/src/services/alertas.ts`):
a chamada a `/classify` **nunca lança exceção** — 503 (sem modelo), timeout,
erro de rede, tudo vira `null`. Se lançasse, o alerta ficaria travado em
`status = 'processando'` para sempre, com a foto já salva mas invisível para
a Defesa Civil. Uma foto sem classificação automática ainda vale mais do que
uma foto que nunca chegou à triagem.

### Lacuna real encontrada: Storage sem política de RLS

A migration `0001` criava RLS para as tabelas do app, mas **não** para
`storage.objects` — que rege uploads no Supabase Storage separadamente. Sem
isso, todo upload de foto falharia com "permission denied" num projeto real,
mesmo com o bucket existindo. Corrigido em
`supabase/migrations/0003_storage_alertas.sql`: cria o bucket `alertas` (não
precisa mais criar manualmente pelo painel, como o README pedia antes) e as
políticas de INSERT/SELECT baseadas no primeiro segmento do caminho do
arquivo (`{usuario_id}/{arquivo}`).

### Telas e suporte novos

| Arquivo | O que faz |
|---|---|
| `pages/NovoAlerta.tsx` | foto, tipo de anomalia, descrição opcional, localização, envio |
| `services/alertas.ts` | orquestra upload → insert → classificação → update |
| `lib/imagem.ts` | comprime a foto (canvas, máx. 1600px, JPEG 82%) antes do envio |
| `hooks/useGeolocalizacao.ts` | estado explícito da permissão de GPS |
| `components/ui/Select.tsx`, `Textarea.tsx` | faltavam no design system |

**Decisões que valem registro:**

- **Compressão antes do envio, não depois.** Foto de celular moderna passa
  de 10–20 MB; o limite do `/classify` é 8 MB (definido desde o Sprint 1) e
  não tem motivo para exigir resolução nativa da câmera para classificar
  risco estrutural. Sem isso, boa parte dos envios seria rejeitada de cara.
- **Permissão de localização com explicação antes do prompt nativo**, como o
  plano pede na seção 4: a interface mostra "Sua localização exata ajuda a
  Defesa Civil a chegar mais rápido" e só dispara o prompt do navegador
  quando o usuário toca em "Permitir localização" — nunca automático ao abrir
  a tela.
- **Fallback de endereço manual na recusa de GPS**, também pedido no plano —
  o schema já suportava isso desde a `0001` (`endereco_manual` +
  a constraint que exige um dos dois campos); Sprint 4 foi o primeiro lugar
  que efetivamente usa esse caminho.
- **Captura via `<input capture="environment">`**, não `getUserMedia`. O
  plano cita as duas opções; escolhi a mais simples — sem stream de vídeo ao
  vivo para gerenciar, funciona em mais navegadores/versões de mobile, e
  cobre o caso de uso real (uma foto, não um vídeo).
- **Perfil completo o que o Sprint 2 tinha deixado como placeholder.** A
  lista real de "Meus alertas" (com `SeloRisco` ou "Em análise" para quem
  ainda não foi classificado) só fazia sentido depois que `alertas` passou a
  existir de verdade — implementada agora com TanStack Query.

### Bug pego e corrigido antes de sobrar para depois

O botão "Enviar outro" na tela de confirmação ia navegar (`<Link
to="/novo-alerta" replace>`) para a mesma rota em que o componente já estava
montado — React Router **não remonta** o componente nesse caso, então o
formulário continuaria com a foto/campos antigos preenchidos. Troquei por um
callback de reset local (`aoReiniciar`) chamado direto, sem depender de
navegação.

### O que ficou pendente desta rodada

- **O formulário de "Novo Alerta" em si não foi visto rodando.** Consegui
  verificar ao vivo que a rota `/novo-alerta` está corretamente protegida
  (mostra o aviso de configuração sem sessão) e que não há erro de console
  em nenhuma rota — mas testar a captura de foto, o fluxo de permissão de
  GPS e o envio de verdade exige um Supabase real com usuário autenticado,
  que ainda não existe neste ambiente.
- Migrations `0001`–`0003` seguem não aplicadas em nenhum projeto real.
- Sem compressão testada contra uma foto de celular de verdade (só
  type-checada) — o algoritmo é padrão (canvas + `toBlob`), mas vale
  conferir com uma foto real assim que houver ambiente para isso.

---

## 15/08/2026 (noite) — Sprint 2: Autenticação e cadastro

Implementado o fluxo de conta completo pedido pelo Sprint 2: cadastro, login,
aceite obrigatório dos Termos, perfil, e o roteador que estava pendente desde
o Sprint 0. **Escrito e com type-check limpo — a verificação ao vivo no
navegador foi interrompida antes de terminar** (ver *O que ficou pendente*).

### O problema do cadastro em duas etapas — resolvido com trigger no banco

A forma óbvia de criar o perfil (`usuarios`) seria o cliente fazer
`supabase.auth.signUp()` e depois um `INSERT` na tabela. Isso quebra se o
projeto Supabase tiver confirmação de e-mail ativada (configuração padrão de
fábrica): não existe sessão entre o cadastro e a confirmação do e-mail, então
o `INSERT` do cliente falha contra a política de RLS (`auth.uid()` não existe
ainda).

**Solução:** `supabase/migrations/0002_perfil_automatico.sql` — um trigger em
`auth.users` (`SECURITY DEFINER`, não depende de sessão) que cria a linha em
`usuarios` no mesmo instante da conta, lendo nome/bairro/aceite dos Termos dos
metadados passados no `signUp()`. Documentado em
[docs/contratos-api.md](docs/contratos-api.md).

> **Decisão deliberada:** o trigger **não** tem fallback para
> `termos_aceitos_em` ausente — se o frontend não mandar esse metadado, a
> criação da conta falha. A coluna é `NOT NULL` porque é a prova de
> consentimento exigida pela LGPD; um fallback silencioso para `now()`
> registraria um aceite que não aconteceu de verdade.

### Telas novas

| Arquivo | O que faz |
|---|---|
| `pages/Cadastro.tsx` | nome, e-mail, bairro (texto livre), senha + confirmação, checkbox de Termos obrigatório |
| `pages/Login.tsx` | e-mail/senha, erros do Supabase traduzidos para português |
| `pages/Perfil.tsx` | dados da conta + placeholder "Meus alertas" (a lista real chega no Sprint 4) |
| `pages/TermosDeUso.tsx` | o texto legal do plano (§5), como página própria |
| `pages/VitrineDesignSystem.tsx` | a vitrine do Sprint 0, **preservada** na rota `/design-system` em vez de descartada |

**Suporte novo:**

- `lib/auth.tsx` — `AuthProvider`/`useAuth`: sessão, perfil, `cadastrar`,
  `entrar`, `sair`.
- `components/ui/Checkbox.tsx` — faltava no design system; é o único ponto do
  cadastro em que "o usuário marcou de propósito" precisa ser verificável,
  não só sugerido visualmente.
- `components/RotaProtegida.tsx` — redireciona para `/entrar` sem sessão.
- `components/layout/Cabecalho.tsx` — cabeçalho com nome do usuário e botão sair.
- `App.tsx` reescrito como roteador (`/entrar`, `/cadastro`, `/termos`,
  `/perfil`, `/design-system`); `main.tsx` ganhou `BrowserRouter`.

### Rodar sem Supabase configurado não pode ser tela branca

Você ainda não criou o projeto Supabase (pendência desde a rodada anterior).
Sem esse ajuste, toda a árvore React quebraria ao carregar — `lib/supabase.ts`
lançava exceção na inicialização se as variáveis de ambiente estivessem
ausentes. Suavizado: agora `supabaseConfigurado` fica `false` e cada tela que
depende de conta mostra `<ConfiguracaoPendente>`, um aviso com o passo a passo
de configuração, em vez de travar a página inteira. `/design-system` continua
funcionando de qualquer forma, porque não depende de conta.

### Bug pré-existente corrigido de passagem

`npx tsc --noEmit` (rodado pela primeira vez nesta sessão) encontrou um erro
de tipo em `components/ui/Campo.tsx:55`, do Sprint 0 — `aria-describedby`
podia receber `0`/`0n` de um `ReactNode` falsy, tipo que a função `cn()` não
aceita. Corrigido com `Boolean(...)` explícito. Depois da correção, o projeto
inteiro type-checka limpo.

### O que ficou pendente desta rodada

- **Verificação ao vivo interrompida.** Eu tinha reinstalado o Playwright
  temporariamente (mesmo procedimento da rodada anterior) para navegar pelas
  rotas novas — cadastro, login, o aviso de configuração pendente, os links
  de Termos — mas fui interrompida antes de rodar os testes e o reverter.
  **Resultado: o código deste sprint passou no type-check, mas ainda não foi
  visto rodando em um navegador de verdade.** `playwright` ficou como
  devDependency do `frontend/` até a próxima sessão remover ou concluir a
  verificação.
- A migration `0002` também não foi aplicada em nenhum Supabase real (mesma
  pendência da `0001`).
- Sem bairros carregados na tabela `bairros`, o campo "Bairro" do cadastro é
  texto livre (`bairro_texto`) — é o comportamento pretendido para agora, não
  um atalho temporário; o vínculo espacial (`bairro_id`) fica para quando os
  polígonos do Rio forem importados.
- Login com Google, mencionado no plano como algo a "considerar", não foi
  implementado — depende de credenciais OAuth externas que exigem
  configuração fora deste ambiente.

---

## 15/08/2026 (tarde) — Execução e verificação dos Sprints 0 e 1

Rodei o sistema de verdade pela primeira vez: instalação de dependências,
servidores no ar, testes automatizados e testes manuais contra os endpoints.
Tudo abaixo foi **observado rodando**, não apenas lido no código.

### Node.js e Python — presentes, mas não do jeito óbvio

Na primeira checagem (`node`, `npm`, `python` direto no PATH) nenhum dos três
respondia. Investigando mais:

- **Node.js v24.19.0** estava instalado em `C:\Program Files\nodejs`, só não
  estava no PATH desta sessão.
- **Python** — o comando `python` aponta para o stub da Microsoft Store (não
  funciona), mas o **launcher `py`** encontra uma instalação real:
  **Python 3.14.7**.

### Frontend — instalado, rodando, testado na tela

```
cd frontend && npm install     # 380 pacotes, 0 erros, 0 vulnerabilidades
npm run dev                    # Vite 6.4.3, pronto em ~10s
```

Sem Playwright/`chromium-cli` disponível de saída, instalei o Playwright
**temporariamente** (`npm install -D playwright` + Chromium), naveguei até o
app rodando e capturei screenshots — depois **removido** (`npm uninstall
playwright`): o stack já definiu Vitest + Testing Library como ferramenta de
teste do frontend, então não faz sentido deixar uma segunda ferramenta de
navegador instalada só por causa desta verificação pontual.

**O que foi confirmado, olhando a tela renderizada:**

- Paleta, tokens de raio, tipografia (Sora/Inter) e o gradiente
  "Do Território ao Dado" renderizam exatamente como especificado no
  design system.
- `SeloRisco`, `Botao`, `Cartao`, `Campo` — todos corretos nas variantes
  testadas (suave/sólido, com/sem erro, carregando).
- **Tema do painel (`.tema-painel`)** aplica corretamente o fundo escuro
  institucional e as métricas tabulares.
- **Responsivo:** testado em viewport desktop (1280px) e mobile (390px,
  tamanho de um iPhone) — o layout se adapta sem quebra.
- **Interatividade real, não só HTML estático:** digitei texto no campo
  "Nome completo" (input controlado do React atualizou corretamente) e
  cliquei no botão "Mostrar resultado" (o estado alternou e revelou o selo
  "Risco Crítico 87%" com a mensagem de encaminhamento).
- **Zero erros no console do navegador** em toda a sessão.

### Serviço de IA — instalado, rodando, testado por HTTP

O `requirements.txt` original (`fastapi==0.115.6`, `pydantic==2.10.4`,
`numpy==2.2.1`, `onnxruntime==1.20.1` etc.) **não instalou**: nenhuma dessas
versões tem wheel pré-compilado para Python 3.14 (lançado depois delas), e a
compilação a partir do source falhou por falta de toolchain (Rust/PyO3 para
`pydantic-core`, Cython/Meson para `numpy`). Resolvido atualizando para as
versões mais recentes de cada pacote (todas com wheel pronto para cp314) e
travando o que efetivamente instalou:

| Pacote | Planejado | Instalado (Python 3.14) |
|---|---|---|
| fastapi | 0.115.6 | 0.141.1 |
| pydantic | 2.10.4 | 2.13.4 |
| numpy | 2.2.1 | 2.5.2 |
| pillow | 11.1.0 | 12.3.0 |
| onnxruntime | 1.20.1 | 1.28.0 |

Em Python 3.11–3.13 as versões originais também devem funcionar — a
atualização foi consequência da versão do Python disponível nesta máquina,
não de um problema nas versões planejadas.

**Testes automatizados:** `pytest` — **5/5 passaram** de primeira (formato do
tensor de entrada, normalização, imagem em escala de cinza, comportamento sem
modelo carregado).

**Servidor no ar, testado com requisições reais:**

- `GET /health` → `{"status":"ok","modelo_carregado":false,"versao_modelo":"sem-modelo"}`
  — confirma que o serviço sobe corretamente mesmo sem o modelo do Sprint 5.
- `POST /classify` com um PNG válido → **503**, `"Nenhum modelo treinado
  carregado neste serviço."` — confirma que o serviço **recusa** classificar
  em vez de inventar um resultado, como projetado.
- `POST /classify` com um `.txt` → **415**, tipo de arquivo rejeitado
  corretamente.
- `POST /classify` sem arquivo → **422** do próprio FastAPI, campo obrigatório.
- Schema OpenAPI (`/openapi.json`) validado: os 4 endpoints esperados estão
  todos registrados.

Todo o comportamento bate exatamente com o que está documentado em
[docs/contratos-api.md](docs/contratos-api.md) — a documentação escrita antes
de rodar o código descreveu corretamente o que o código faz.

### Conflitos de porta descobertos — e corrigidos

Portas padrão originalmente escolhidas (5173 para o frontend, 8000 para o
serviço de IA) **já estavam em uso por outros projetos locais nesta
máquina** (incluindo um servidor Django rodando em 8000). Corrigido:

- **Frontend:** porta fixada em **5180** com `strictPort: true` em
  `vite.config.ts` — falha alto se a porta estiver ocupada, em vez de subir
  silenciosamente em outra e confundir onde o app está.
- **Serviço de IA:** documentado rodar com `--port 8001`.

Todas as referências em `README.md`, `docs/contratos-api.md` e nos dois
`.env.example` foram atualizadas para as portas novas.

### O que ficou pendente desta rodada

- A migration `0001_esquema_inicial.sql` **ainda não foi aplicada** em um
  projeto Supabase real — não crio contas/serviços externos em seu nome sem
  pedir. Passo 1 da seção *Próximos passos*.
- Ícones do PWA continuam ausentes (pendência já registrada abaixo) — sem
  efeito em `npm run dev` porque o plugin PWA fica desligado em
  desenvolvimento, mas bloqueiam um build de produção completo.

---

## 15/08/2026 — Sprints 0 e 1: fundação, design system e modelagem

### 1. Estrutura do repositório

Monorepo com três frentes separadas, conforme o plano:

```
GEOVISION.AI/
├── frontend/            React 19 + Vite + Tailwind 4, PWA instalável
├── ai-service/          FastAPI + ONNX Runtime
├── supabase/migrations/ Esquema PostgreSQL + PostGIS
└── docs/                Contratos de API
```

Arquivos de apoio: `.gitignore` (bloqueia `.env`, modelos treinados e o dataset
de imagens — imagem bruta não vai para o Git) e `README.md` com instruções de
execução.

### 2. Modelagem de dados — `supabase/migrations/0001_esquema_inicial.sql`

As três tabelas previstas no plano, mais uma quarta:

- **`bairros`** — polígonos oficiais, com índice espacial GiST.
- **`usuarios`** — perfil da aplicação, ligado ao `auth.users` do Supabase.
  Inclui `termos_aceitos_em`, que é a prova de consentimento exigida pela LGPD.
- **`alertas`** — foto, localização, classificação da IA e status de triagem.
- **`alerta_eventos`** — *adicionada além do plano*. Trilha de auditoria de
  cada mudança de status.

> **Por que `alerta_eventos` foi adicionada:** o Sprint 8 pede a métrica
> "tempo médio de resposta". Sem registrar quando cada transição aconteceu,
> essa métrica seria impossível de calcular depois — e o histórico perdido não
> se recupera retroativamente. Custa uma tabela agora e evita retrabalho.

**Decisões que valem registro:**

- **Enums em vez de texto livre.** `nivel_risco`, `status_alerta`,
  `papel_usuario` e `tipo_anomalia` são tipos do Postgres. Impede que o serviço
  de IA grave `"Crítico"`, `"critico"` e `"CRITICO"` como três valores
  diferentes — o que quebraria silenciosamente os filtros do painel.
- **Restrição de localização.** Um alerta exige GPS **ou** endereço manual.
  Sem um dos dois a Defesa Civil não tem como chegar ao local, então o banco
  recusa o registro em vez de aceitar dado inútil.
- **`modelo_versao` em cada alerta.** Sem saber qual versão do modelo
  classificou cada foto, um erro de classificação vira impossível de auditar
  depois de um retreino.
- **Row Level Security ativado em todas as tabelas.** A chave anônima do
  Supabase fica exposta no frontend por design; sem RLS, qualquer pessoa
  leria todos os alertas e dados pessoais. O cidadão vê só os próprios
  alertas; a Defesa Civil vê todos; **o cidadão não pode alterar o status nem
  a classificação do próprio alerta** — reclassificar é decisão da triagem.
- **Triggers no banco, não no cliente.** Descoberta automática do bairro pelo
  ponto de GPS, carimbo de `classificado_em`/`resolvido_em` e registro de
  eventos acontecem no Postgres. Assim a regra vale independente de qual
  cliente gravou.

**Visões criadas:** `vw_fila_triagem` (já ordenada por prioridade, com
lat/lng extraídos para o Leaflet) e `vw_metricas_painel` (os números do
cabeçalho do painel).

**Webhook de alerta crítico:** deixado comentado na migration. A recomendação
é configurar pelo painel do Supabase (Database > Webhooks), que já gerencia
retry e headers; a versão em `pg_net` fica registrada em código como
alternativa.

### 3. Design System — `frontend/src/index.css`

O conceito **"Do Território ao Dado"** virou tokens de verdade, não descrição:

- **Paleta completa** do plano, mais variações derivadas para estados
  hover/ativo e fundos suaves (`marca-laranja-escuro`, `risco-critico-suave`
  etc.), que faltavam para montar componentes.
- **Dois tokens de raio** — `--radius-cidadao` (14px, acolhedor) e
  `--radius-painel` (6px, institucional). A regra "app arredondado, painel
  reto" fica no design system em vez de ser decidida no olho a cada tela.
- **`.tema-painel`** — envolver a árvore nessa classe troca fundo, superfície
  e texto para o modo "centro de operações". Os componentes não precisam de
  nenhuma condicional para funcionar nos dois contextos.
- **`.metrica`** — números tabulares para o painel, para que não "dancem"
  quando atualizam em tempo real.
- **`.divisor-territorio` e `.progresso-ia`** — o gradiente terra→rede como
  elemento funcional: divisor de seção e barra de "IA analisando sua foto".

Acessibilidade já na base: foco sempre visível, respeito a
`prefers-reduced-motion` e `touch-action: manipulation` para evitar o zoom
acidental de duplo-toque no iOS durante a captura da foto.

### 4. Componentes de UI — entregável do Sprint 0

| Componente | Arquivo | Nota |
|---|---|---|
| `SeloRisco` | `components/ui/SeloRisco.tsx` | A assinatura visual do produto |
| `Botao` | `components/ui/Botao.tsx` | 4 variantes, altura mínima 44px |
| `Cartao` | `components/ui/Cartao.tsx` | Raio decidido pelo contexto |
| `Campo` | `components/ui/Campo.tsx` | Rótulo, ajuda e erro acessíveis |
| `TerritorioAoDado` | `components/marca/TerritorioAoDado.tsx` | Motivo da marca em SVG |

Pontos de acessibilidade embutidos:

- **`SeloRisco` sempre exibe o texto** ("Risco Crítico"), nunca só a cor —
  cor sozinha não comunica nada para quem tem daltonismo.
- **`Botao` com altura mínima de 44px** — o app é usado na rua, com o polegar,
  possivelmente com pressa.
- **`Campo` associa rótulo e input por id gerado**, com `role="alert"` na
  mensagem de erro. Leitor de tela anuncia corretamente e a área de toque
  aumenta.

`App.tsx` é uma vitrine do design system para validar tudo isso visualmente
antes de construir as telas reais. Será substituída pelo roteador nos
Sprints 2 e 4.

### 5. Tipos do domínio — `frontend/src/types/dominio.ts`

Espelham os enums do banco. Incluem `ROTULO_RISCO`, `ROTULO_STATUS` e
`ROTULO_ANOMALIA`: a tradução para exibição fica em um lugar só, para que
"Crítico" não seja escrito de forma diferente entre o app e o painel.

### 6. PWA — `frontend/vite.config.ts`

Manifesto em pt-BR, modo `standalone`, ícone e tema. Duas regras de cache que
importam:

- **Tiles do OpenStreetMap em `CacheFirst`**, 30 dias — o mapa carrega mesmo
  com conexão ruim na rua.
- **A API nunca é interceptada** — dado de alerta precisa ser sempre fresco.
  Um status de vistoria servido do cache seria pior que nenhum.

### 7. Serviço de IA — `ai-service/`

Esqueleto completo, como previsto no Sprint 1 (o modelo só chega no Sprint 5).

**Endpoints:** `POST /classify`, `GET /health`,
`POST /webhooks/alerta-critico`, `POST /webhooks/status-atualizado`.

**Decisões que valem registro:**

- **ONNX Runtime em vez de TensorFlow completo.** A imagem de produção fica em
  dezenas de MB em vez de ~1 GB, o que decide se o serviço cabe no plano
  gratuito do Railway/Fly.io. O treino usa TensorFlow em notebook separado e
  exporta para ONNX — não é dependência deste serviço.
- **Sem modelo, `/classify` responde 503 — não devolve palpite.** Um stub que
  retornasse risco aleatório atravessaria o pipeline inteiro parecendo
  funcionar, e o erro só apareceria na validação em campo, já integrado ao
  painel da Defesa Civil. Falhar alto agora é mais barato.
- **O serviço sobe mesmo sem modelo.** `/health` expõe `modelo_carregado`
  justamente para distinguir "no ar e pronto" de "no ar mas sem classificar".
- **Limiar de confiança (padrão 0,60).** Abaixo dele a resposta vem com
  `risco: null` e `incerto: true`, e o alerta segue para triagem humana **sem**
  sugestão. Exibir um palpite fraco como conclusão é pior do que não exibir.
- **Correção de rotação EXIF no pré-processamento.** Foto de celular chega com
  a orientação em metadado; sem corrigir, uma rachadura vertical chegaria ao
  modelo deitada.
- **Webhooks autenticados por segredo compartilhado**, comparado com
  `hmac.compare_digest`. Sem isso, qualquer pessoa dispararia notificação de
  alerta crítico para a Defesa Civil.
- **Notificação em segundo plano, resposta 202 imediata.** O webhook do
  Supabase tem timeout curto; um provedor de e-mail lento causaria retry em
  cascata do banco.
- **Falha de um canal não derruba o outro.** Se o WhatsApp cair, o e-mail
  ainda sai.

**n8n removido do fluxo**, como o plano já previa: o gatilho vem do Database
Webhook do Supabase e o envio acontece dentro do FastAPI que já existe. Uma
peça de infraestrutura a menos para manter.

**Testes** (`ai-service/tests/test_classificador.py`): 5 testes cobrindo o
formato do tensor, a normalização, imagem em escala de cinza e o modo
degradado sem modelo. **Ainda não executados.**

### 8. Contratos de API — `docs/contratos-api.md`

Entregável do Sprint 1. Documenta o fluxo ponta a ponta, os endpoints do
FastAPI, os exemplos de acesso ao Supabase pelo frontend, o resumo das regras
de RLS e a tabela de enums compartilhados entre Postgres, Python e TypeScript.

> **Armadilha documentada:** PostGIS usa `POINT(longitude latitude)`, mas a
> Geolocation API do navegador devolve `latitude` primeiro. Trocar os dois
> coloca todos os alertas do Rio no meio do oceano — e o erro passa
> despercebido até alguém abrir o mapa.

---

## Ambiente desta máquina

Referência rápida — detalhes completos na entrada de verificação acima.

| Ferramenta | Como usar aqui |
|---|---|
| Node.js v24.19.0 | instalado em `C:\Program Files\nodejs`, fora do PATH — adicione ao PATH do usuário ou use o caminho completo |
| Python 3.14.7 | use `py`, não `python` (`python` é o stub da Microsoft Store) |

### Repositório sem commit inicial

O Git está inicializado mas não há nenhum commit. Nada foi commitado nesta
sessão — aguardando sua revisão.

---

## Próximos passos

**Para você:**

1. Criar o projeto no Supabase e rodar as migrations `0001`, `0002` e `0003`,
   **nessa ordem** (nenhuma foi aplicada em ambiente real ainda — a `0003` é
   nova nesta rodada e cria o bucket de fotos, então não pule ela).
2. Com o Supabase configurado, testar o fluxo completo de verdade: cadastro
   → confirmar e-mail → login → Novo Alerta → foto + localização → envio.
   Esta é a primeira vez que dá para testar isso ponta a ponta — até aqui só
   validei roteamento e o que não depende de conta.
3. **Começar a coleta do dataset de imagens em paralelo.** O próprio plano
   aponta isso como o item de maior risco de prazo. Enquanto o código avança,
   o dataset não se resolve sozinho — e agora que "Novo Alerta" existe, dá
   pra usar o próprio app pra começar a coletar fotos reais do território.

**Para o desenvolvimento (continuação):**

- **Sprint 5 — Treinamento do MobileNetV2:** depende do dataset rotulado do
  Sprint 3 existir primeiro; não dá pra adiantar em código sem esses dados.
- **Sprint 7 — Painel da Defesa Civil (MVP):** mapa Leaflet com os alertas
  de `vw_fila_triagem`, lista priorizada — não depende do dataset/modelo,
  pode avançar em paralelo à coleta.
- Terminar a verificação ao vivo do formulário de Novo Alerta assim que
  houver um Supabase real disponível (item 2 acima é pré-requisito).

---

## Pendências conhecidas

| # | Item | Onde |
|---|---|---|
| 1 | ~~Ícones do PWA não existem~~ — ✅ resolvido em 17/09/2026: gerados a partir da logo | `frontend/public/` |
| 2 | Lint/format não configurado — decidir entre ESLint+Prettier ou Biome | `frontend/` |
| 3 | Nenhum teste no frontend ainda (Vitest + Testing Library, já decidido no plano) | `frontend/` |
| 4 | Migrations `0001`–`0003` não aplicadas em nenhum Supabase real ainda | `supabase/` |
| 5 | Tabela `bairros` está vazia — carregar os polígonos oficiais do Rio (data.rio) | `supabase/` |
| 6 | Termos de Uso do plano precisam de revisão jurídica antes de publicar | — |
| 7 | CI (GitHub Actions) não configurado | — |
| 8 | Porta 5173/8000 colidem com outros projetos locais nesta máquina — usar 5180/8001 (já refletido no código e docs) | — |
| 9 | Formulário de "Novo Alerta" (captura de foto, permissão de GPS, envio) não testado ao vivo — precisa de Supabase real com sessão | `frontend/src/pages/NovoAlerta.tsx` |
| 10 | Algoritmo de compressão de imagem não testado contra foto de celular real, só type-checado | `frontend/src/lib/imagem.ts` |
| 11 | Imagens Docker nunca construídas — o `build` só será exercido na VPS (sem Docker nesta máquina) | `*/Dockerfile` |
| 12 | Fotos servidas sem autenticação: `/uploads/<id>/<uuid>.jpg` é público para quem tiver a URL. Correção adequada é URL assinada | `ai-service/app/main.py` |
| 13 | Sem limite de tentativas de login e sem recuperação de senha | `ai-service/app/routers/auth.py` |
| 14 | Backup do volume de produção não agendado — comando pronto, falta o cron | `DEPLOY.md` |

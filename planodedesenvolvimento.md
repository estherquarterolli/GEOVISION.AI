# GeoVision.AI — Plano de Desenvolvimento
**Programa Jovens Cientistas Cariocas 2026 · Modalidade 1 — Iniciação Científica**
**Autora:** Esther Quarterolli dos Santos · estherquarterollii@gmail.com
**Território:** Engenho de Dentro, em torno da Nave do Conhecimento do Engenhão

---

## 1. Visão geral do produto

GeoVision.AI transforma o celular do morador em um sensor de risco estrutural. O
cidadão fotografa uma rachadura, inclinação de muro de arrimo ou infiltração; um
modelo de visão computacional (CNN, MobileNetV2) classifica o risco (Baixo / Médio /
Crítico) e envia o alerta geolocalizado direto para um painel de triagem da Defesa
Civil. O objetivo não é substituir a vistoria técnica, e sim **priorizar** — dar à
Defesa Civil um filtro inteligente sobre o que checar primeiro.

Há dois produtos dentro de um único sistema:

| | App do Cidadão | Painel da Defesa Civil |
|---|---|---|
| Quem usa | Moradores, 13–55 anos | Agentes/operadores da Defesa Civil RJ |
| Prioridade | Simplicidade, confiança, rapidez | Densidade de informação, controle, decisão |
| Tom visual | Acolhedor, leve, laranja em destaque | Institucional, "centro de comando", azul em destaque |

O questionário de validação já aponta as dores centrais que o produto precisa resolver:
demora na vistoria manual, dificuldade de explicar a gravidade por telefone, não saber
reconhecer se uma rachadura é perigosa, e ausência de canal padronizado com o poder
público. Isso define a hierarquia de funcionalidades do app do cidadão: **captura
rápida > acompanhamento do status > painel educativo > mapa de risco do bairro**, nessa
ordem de prioridade de desenvolvimento.

---

## 2. Identidade visual — conceito único

A sua logo já contém o conceito central do produto, só precisa ser expandido em
sistema de design: **linhas de contorno topográfico (laranja) se transformando em uma
rede de nós conectados (azul), fechando em um pino de localização (laranja)**. Isso é,
literalmente, a jornada do dado no GeoVision.AI: relevo/risco natural → dado
estruturado por IA → ponto de ação no mapa.

**Conceito de identidade: "Do Território ao Dado"**
Use esse gradiente terra→rede como fio condutor em toda a interface: barras de
progresso, divisores de seção, splash screen, estado de "IA processando" — sempre a
transição de linha orgânica (contorno) para linha reta/nó (rede).

**Paleta**
- Laranja sinal `#F2811D` — ações primárias, alerta, pino, marca
- Azul profundo `#0E5C82` — estrutura, dados, navegação, texto de destaque
- Azul petróleo escuro `#0A3A52` — painel da Defesa Civil (fundo)
- Neutros: `#FAFAF8` (fundo app cidadão), `#1C2530` (texto), `#6B7280` (texto secundário)
- Semáforo de risco (já usado no seu protótipo, manter): Verde `#2E9E5B` Baixo · Amarelo `#E8A93B` Médio · Vermelho `#D9463B` Crítico

**Tipografia**
- Títulos: **Sora** ou **Space Grotesk** (geométrica, moderna, ainda assim amigável — funciona bem para 13 a 55 anos, não é "infantil" nem "corporativa fria")
- Corpo de texto: **Inter** (altíssima legibilidade em telas pequenas, gratuita, ótima para formulários)

**Linguagem gráfica**
- Cantos arredondados médios (12–16px) nos cards do app cidadão; cantos mais retos (4–8px) no painel Defesa Civil para reforçar o tom institucional
- Ícones em traço único (outline), nunca preenchidos, ecoando o traço da logo
- Motivo decorativo recorrente: pequenos "nós conectados por linha" como elemento de fundo sutil em telas vazias/loading — nunca como ruído sobre conteúdo
- Fotos de rachaduras/anomalias sempre com moldura consistente + selo de risco sobreposto (como já está no seu mockup) — isso vira uma assinatura visual do produto

**Diferenciação do Painel da Defesa Civil**
- Fundo escuro (`#0A3A52`), não claro — reforça leitura de "centro de operações"
- Cabeçalho com **brasão/logo da Defesa Civil RJ + Prefeitura do Rio** ao lado da logo do GeoVision.AI (parceria institucional visível, como no seu mockup)
- Tipografia de dados em variante tabular (números alinhados, tipo monoespaçada só para métricas: total de alertas, tempo médio de resposta)
- Densidade de informação alta: tabela de alertas, mapa, filtros — nada de espaço vazio "confortável" como no app cidadão

---

## 3. Stack tecnológica recomendada

Critérios: leve, rápido de entregar num projeto de iniciação científica com prazo de 6
meses, funciona bem em celular *e* em navegador desktop/tablet sem duas bases de
código, e aproveita o que você já domina (Django, React/Vite, PostgreSQL/Supabase,
Python, n8n).

### Recomendação: **PWA (Progressive Web App)**, não app nativo
Um app nativo (Swift/Kotlin) exigiria duas bases de código e lojas de app — pesado
demais para o prazo. Uma **PWA instalável** roda no navegador, se comporta como app
(ícone na tela inicial, funciona offline em parte, acesso a câmera e GPS via APIs do
navegador) e funciona automaticamente em PC/tablet, porque é uma única aplicação web
responsiva. É a escolha que melhor atende "leve + mobile-first + também funciona em
web".

### Frontend
- **React + Vite + TypeScript** (você já usa) com **Tailwind CSS** para o design system
- `vite-plugin-pwa` para instalabilidade, ícone, splash screen e cache offline
- **MediaDevices.getUserMedia / `<input capture="environment">`** para acesso à câmera
- **Geolocation API** do navegador para captura de GPS
- **TanStack Query** para gerenciar chamadas à API de forma leve
- **Leaflet + OpenStreetMap** para o mapa de risco (gratuito, leve — evita custo de API paga tipo Google Maps/Mapbox numa fase de validação)

### Backend e dados
- **Supabase** como espinha dorsal: Postgres gerenciado (com extensão **PostGIS** para consultas geoespaciais — essencial para "áreas de risco mapeadas"), Auth pronta (login/cadastro por e-mail e senha, recuperação de senha), Storage para as fotos, e Realtime para o painel da Defesa Civil atualizar sozinho quando chega alerta novo
- Isso elimina a necessidade de escrever backend de autenticação do zero e mantém o projeto leve para os 6 meses de cronograma
- **Alternativa mais robusta** (se quiser mais controle/já é seu ecossistema): Django REST Framework por cima do mesmo Postgres, no lugar do Supabase — mais trabalho de setup, mais controle. Recomendo Supabase para o MVP do JCC e migração para Django só se o projeto crescer além da validação.

### IA / Visão computacional
- Serviço separado em **Python + FastAPI**, hospedando o modelo (fiel ao que você já escreveu no pré-projeto: **MobileNetV2** com fine-tuning para classificar Baixo/Médio/Crítico)
- Exportar o modelo para **ONNX** ou **TensorFlow Lite** para inferência mais rápida e mais leve em produção
- Endpoint único: `POST /classify` recebe imagem → devolve `{risco, confianca}`
- Mantido separado do backend principal porque inferência de IA tem necessidades de recursos diferentes (pode escalar/hospedar independente)

### Automação e notificações (sem ferramenta externa)
Dá para tirar o n8n do caminho e resolver os mesmos dois fluxos direto no seu próprio
stack, sem depender de uma ferramenta de automação separada:

- **Gatilho:** usar um **Database Webhook do Supabase** (ou uma função Postgres +
 trigger `AFTER INSERT/UPDATE`) na tabela `alertas`. Isso dispara uma chamada HTTP
 automaticamente sempre que um alerta é criado com risco Crítico, ou quando o campo
 `status` muda — sem precisar de um serviço externo rodando o fluxo.
- **Quem recebe o gatilho:** uma rota simples no seu próprio serviço **FastAPI** (ex:
 `POST /webhooks/alerta-critico` e `POST /webhooks/status-atualizado`), já que esse
 serviço já existe para hospedar o modelo de IA — não precisa criar infraestrutura nova.
- **Envio de e-mail:** dentro dessa rota, chamar a API de um provedor transacional leve
 e com plano gratuito generoso, como **Resend** ou **Brevo** (poucas linhas de código,
 sem servidor extra).
- **Envio de WhatsApp:** para a Defesa Civil, usar a **API oficial do WhatsApp Business
 (Cloud API, da Meta)** diretamente da rota do FastAPI. Para o MVP/validação, se o
 processo de aprovação da conta comercial for lento, o e-mail sozinho já cobre o fluxo
 1, e o fluxo 2 (cidadão) pode usar apenas **notificação em tempo real dentro do próprio
 app** via Supabase Realtime (o status muda na tela sem precisar de nenhum canal
 externo) — o que aliás é mais leve ainda do que WhatsApp.

Resultado: os dois fluxos continuam automáticos (gatilho no banco → chamada HTTP →
ação), só que rodando inteiramente dentro do Supabase + FastAPI que você já vai ter no
ar, sem outra peça de infraestrutura para manter.

### Hospedagem (fase de validação/MVP, custo baixo)
- Frontend: **Vercel** (deploy direto do GitHub, grátis para o volume de um MVP)
- API de IA (FastAPI): **Railway** ou **Fly.io**
- Banco/Auth/Storage: **Supabase Cloud** (plano gratuito cobre a fase de validação)

### Resumo em uma linha
`React + Vite + Tailwind (PWA) → Supabase (Auth/DB/PostGIS/Storage/Realtime, com webhook de banco) → FastAPI + MobileNetV2 (classificação e notificações) → Leaflet (mapa)`

---

## 4. Autenticação, câmera e localização

- **Cadastro**: nome, e-mail, senha, bairro/região (mesmo campo do seu formulário de
 validação — já testado com moradores), aceite obrigatório dos Termos de Uso (checkbox,
 não pode prosseguir sem marcar)
- **Login**: e-mail/senha via Supabase Auth; considerar "Entrar com Google" como
 atalho, dado o público de 13–55 anos que já usa esse login em outros apps
- **Permissão de câmera**: solicitar apenas no momento em que o usuário toca em "Novo
 Alerta" (nunca no primeiro acesso) — pedido de permissão contextual aumenta muito a
 taxa de aceitação
- **Permissão de localização**: mesma lógica — solicitar junto da câmera, explicando em
 uma linha *por que* ("Sua localização exata ajuda a Defesa Civil a chegar mais rápido")
 antes do prompt nativo do navegador aparecer
- Tratar o caso de recusa de permissão com uma tela de fallback clara (ex: permitir
 inserir endereço manualmente se o GPS for negado) — sem isso, o fluxo trava para uma
 parte real dos usuários

---

## 5. Termos e Condições de Uso — base

> [!IMPORTANT]
> **Termos de Uso e Política de Privacidade — GeoVision.AI (Integrado à Defesa Civil)**
> 
> 1. **Objeto e Integração.** O GeoVision.AI é uma plataforma de triagem de riscos estruturais integrada diretamente ao painel de monitoramento da Defesa Civil. Desenvolvida no âmbito do Programa Jovens Cientistas Cariocas 2026, serve como canal de alerta auxiliar. O sistema otimiza a triagem, mas não substitui o laudo técnico oficial emitido pelos engenheiros da Defesa Civil após vistoria presencial.
> 
> 2. **Cadastro e Responsabilidade.** Para usar o sistema, o usuário deve se cadastrar com nome, e-mail e bairro de residência. Ao submeter um alerta, o usuário assume total responsabilidade pela veracidade das informações. O envio de alertas falsos (trote) ou simulações maliciosas é passível de punição legal por mobilização indevida de serviços públicos de emergência.
> 
> 3. **Coleta de Dados e Geolocalização.** Para a triagem e atendimento, a plataforma coleta: (a) 3 fotografias em diferentes ângulos da anomalia; (b) a geolocalização exata do local (coordenadas GPS); (c) data e hora do registro. A permissão de geolocalização é indispensável para que as equipes de vistoria da Defesa Civil localizem o ponto com precisão.
> 
> 4. **Base Legal e LGPD.** O tratamento de dados segue a Lei Geral de Proteção de Dados (Lei nº 13.709/2018), com base no consentimento do usuário e no legítimo interesse público de prevenção de desastres. Os dados são usados exclusivamente para a segurança pública e prevenção de acidentes.
> 
> 5. **Limitação de Responsabilidade e IA.** A classificação de risco é gerada por modelo de Inteligência Artificial e consiste em uma estimativa inicial de urgência para a fila de atendimento da Defesa Civil. A decisão final de intervenção técnica e evacuação é sempre humana. O GeoVision.AI e seus desenvolvedores não se responsabilizam por danos decorrentes de decisões tomadas sem confirmação por vistoria oficial. Em caso de risco iminente, o usuário deve sempre ligar diretamente para 199 (Defesa Civil) ou 193 (Corpo de Bombeiros).
> 
> 6. **Uso Adequado.** É proibido enviar imagens falsas, de outras localidades, ou utilizar o sistema para fins diferentes do reporte de riscos estruturais reais.
> 
> 7. **Propriedade Intelectual.** O sistema, sua marca, design e modelo de IA são de autoria do projeto GeoVision.AI (Programa JCC 2026) e sua cessão de fluxo de dados é de uso exclusivo da Defesa Civil do Rio de Janeiro.
> 
> 8. **Alterações.** Estes termos podem ser atualizados; alterações relevantes serão comunicadas por e-mail ou aviso no aplicativo.
> 
> 9. **Contato.** Dúvidas, solicitações de dados ou denúncias de uso indevido: estherquarterollii@gmail.com

---

## 6. Sprints de desenvolvimento

Cronograma em **12 sprints de 2 semanas (24 semanas ≈ 6 meses)**, alinhado ao
cronograma do seu pré-projeto (definição de arquitetura → coleta/treinamento de IA →
backend → frontend mobile → testes → relatório final).

### Sprint 0 — Fundação e Design System *(Semanas 1–2)*
- Configurar repositório, monorepo (frontend + serviço de IA)
- Criar design system em Figma: paleta, tipografia, componentes-base (botão, card,
 badge de risco, input), aplicando o conceito "Do Território ao Dado"
- Configurar projeto Supabase (banco, Auth, Storage) e ativar extensão PostGIS
- **Entregável:** repositório inicial + biblioteca de componentes de UI + Supabase configurado

### Sprint 1 — Arquitetura e modelagem de dados *(Semanas 3–4)*
- Modelar tabelas: `usuarios`, `alertas` (foto, geolocalização, nível de risco, status,
 confiança da IA), `bairros`
- Definir contratos de API entre frontend, Supabase e serviço de IA
- Setup do projeto FastAPI para o serviço de classificação (esqueleto, sem modelo ainda)
- **Entregável:** schema de banco versionado + documentação de API (mesmo que informal, em Markdown)

### Sprint 2 — Autenticação e cadastro *(Semanas 5–6)*
- Telas de cadastro e login (com validação de formulário)
- Fluxo de aceite dos Termos de Uso obrigatório no cadastro
- Perfil do usuário (nome, bairro, alertas enviados)
- **Entregável:** fluxo completo de conta funcionando ponta a ponta

### Sprint 3 — Coleta e curadoria do dataset de imagens *(Semanas 7–8)*
- Levantar/organizar imagens de rachaduras, inclinações e infiltrações (fontes públicas
 + captação própria no território em torno da Nave do Conhecimento do Engenhão)
- Rotulagem manual por nível de risco (Baixo/Médio/Crítico)
- **Entregável:** dataset rotulado, dividido em treino/validação/teste

### Sprint 4 — Captura, câmera e geolocalização (App Cidadão) *(Semanas 9–10)*
- Tela "Novo Alerta": acesso à câmera, solicitação de permissão contextual, preview da
 foto, captura automática de GPS
- Envio do alerta para o Supabase (foto no Storage + registro no banco, status
 "processando")
- **Entregável:** cidadão consegue enviar um alerta completo (sem classificação de IA ainda — usar placeholder)

### Sprint 5 — Treinamento do modelo (MobileNetV2) *(Semanas 11–12)*
- Fine-tuning do MobileNetV2 no dataset rotulado
- Avaliação de métricas (acurácia, matriz de confusão por classe de risco)
- Exportar modelo em formato leve (ONNX/TFLite)
- **Entregável:** primeira versão do modelo com métricas documentadas

### Sprint 6 — API de classificação e integração *(Semanas 13–14)*
- Endpoint `POST /classify` no FastAPI, servindo o modelo treinado
- Integrar: alerta enviado pelo app → dispara classificação → atualiza status no banco
- Configurar o webhook do banco (Supabase → FastAPI) para disparar notificação quando risco = Crítico
- **Entregável:** pipeline completo — foto enviada vira classificação de risco automaticamente

### Sprint 7 — Painel da Defesa Civil (MVP) *(Semanas 15–16)*
- Layout institucional (fundo escuro, logo Defesa Civil RJ + Prefeitura + GeoVision.AI)
- Mapa de alertas (Leaflet) com pins coloridos por nível de risco
- Lista/tabela de alertas em prioridade (crítico no topo)
- **Entregável:** Defesa Civil consegue visualizar todos os alertas recebidos num mapa

### Sprint 8 — Fluxo de vistoria e status *(Semanas 17–18)*
- Ações no painel: "Ordem de vistoria", "Marcar como resolvido"
- Atualização de status refletida em tempo real no app do cidadão (via Supabase Realtime)
- Métricas do painel: total de alertas, risco crítico ativo, tempo médio de resposta
- **Entregável:** ciclo completo — alerta enviado → triagem → vistoria → resolução → cidadão notificado

### Sprint 9 — Painel educativo e acompanhamento (App Cidadão) *(Semanas 19–20)*
- Tela "Como identificar risco": conteúdo educativo sobre rachaduras/infiltrações
 (resposta direta à dor de "não saber identificar se é perigoso", do seu questionário)
- Histórico de alertas enviados pelo usuário com status em tempo real
- Mapa de risco do próprio bairro, visível ao cidadão
- **Entregável:** app do cidadão com as 4 funcionalidades do formulário completas

### Sprint 10 — Testes de usabilidade em campo *(Semanas 21–22)*
- Validação com usuários reais na Nave do Conhecimento do Engenhão
- Aplicar o próprio questionário de validação anexado como pós-teste
- Coletar feedback qualitativo e priorizar ajustes
- **Entregável:** relatório de usabilidade + lista de ajustes priorizados

### Sprint 11 — Refino final, hardening e apresentação *(Semanas 23–24)*
- Implementar ajustes do teste de usabilidade
- Revisão de acessibilidade (contraste, tamanho de toque, leitura para 13–55 anos)
- Publicar Termos de Uso e Política de Privacidade definitivos
- Preparar deck e relatório final de apresentação do JCC 2026
- **Entregável:** GeoVision.AI pronto para apresentação pública

---

## 7. Próximos passos imediatos
1. Criar o projeto no Supabase e o repositório do frontend
2. Montar o design system no Figma a partir da paleta e tipografia definidas acima
3. Começar a coleta do dataset de imagens em paralelo (Sprint 3) — é o item de maior
 risco de prazo, então vale adiantar desde já
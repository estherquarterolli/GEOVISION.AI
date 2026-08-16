# Contratos de API — GeoVision.AI

> Entregável do Sprint 1. Define as fronteiras entre frontend, Supabase e
> serviço de IA. Atualizar aqui **antes** de mudar qualquer um dos lados.

---

## Visão do fluxo

```
App do Cidadão (PWA)
  │  1. upload da foto
  ▼
Supabase Storage (bucket "alertas")
  │  2. insert em alertas (status = processando)
  ▼
Supabase Postgres ──── 3. Database Webhook ────► FastAPI /webhooks/alerta-critico
  │                                                       │
  │  5. update: nivel_risco, confianca_ia                  │ 4. notifica Defesa Civil
  │                                                       ▼
  │                                              E-mail (Resend) / WhatsApp
  ▼
Painel Defesa Civil ◄─── 6. Realtime ───► App do Cidadão (status ao vivo)
```

A classificação (passo 5) é disparada pelo app logo após o upload, chamando
`POST /classify` diretamente e gravando o resultado no alerta.

---

## 1. Serviço de IA (FastAPI)

Base local: `http://localhost:8001`
(porta 8000 evitada de propósito — colide com outro projeto local nesta máquina)

### `POST /classify`

Classifica o risco estrutural de uma foto.

**Requisição** — `multipart/form-data`

| Campo | Tipo | Obrigatório | Nota |
|---|---|---|---|
| `imagem` | arquivo | sim | JPEG, PNG, WebP ou HEIC. Máx. 8 MB. |

**Resposta 200**

```json
{
  "risco": "critico",
  "confianca": 0.8734,
  "incerto": false,
  "versao_modelo": "mobilenetv2-v1",
  "probabilidades": { "baixo": 0.04, "medio": 0.09, "critico": 0.87 }
}
```

`risco` vem **nulo** quando `confianca` fica abaixo de `LIMIAR_CONFIANCA`
(padrão 0,60). Nesse caso `incerto` é `true` e o alerta deve seguir para
triagem humana **sem** sugestão de risco na tela — exibir um palpite fraco
como conclusão é pior do que não exibir nada.

**Erros**

| Código | Quando |
|---|---|
| 400 | arquivo vazio |
| 413 | imagem acima de 8 MB |
| 415 | formato não suportado |
| 503 | nenhum modelo treinado carregado (situação normal até o Sprint 5) |

### `GET /health`

```json
{
  "status": "ok",
  "ambiente": "desenvolvimento",
  "modelo_carregado": false,
  "versao_modelo": "sem-modelo"
}
```

### `POST /webhooks/alerta-critico`

Chamado pelo Database Webhook do Supabase. Exige o header
`X-Webhook-Secret` igual a `WEBHOOK_SECRET`.

```json
{ "alerta_id": "uuid", "nivel_risco": "critico" }
```

Responde `202 Accepted` imediatamente e envia as notificações em segundo
plano — o webhook do Supabase tem timeout curto e não pode ficar esperando o
provedor de e-mail.

### `POST /webhooks/status-atualizado`

Mesma autenticação. Registra a transição de status. O cidadão já é notificado
por Supabase Realtime; este endpoint é o ponto de extensão caso o teste de
usabilidade do Sprint 10 mostre que a notificação in-app não basta.

---

## 2. Supabase — acesso pelo frontend

O frontend fala com o banco via `@supabase/supabase-js`, não por uma API REST
própria. As regras de acesso estão nas políticas de RLS da migration `0001`.

### Cadastro e login

```ts
// Cadastro — nome, bairro e o instante do aceite dos Termos vão nos metadados
// do usuário. O trigger fn_criar_perfil_usuario (migration 0002) lê esses
// metadados e cria a linha em `usuarios` no mesmo instante da conta.
await supabase.auth.signUp({
  email,
  password: senha,
  options: {
    data: {
      nome,
      bairro_texto: bairro,
      termos_aceitos_em: new Date().toISOString(),
    },
  },
})

// Login
await supabase.auth.signInWithPassword({ email, password: senha })
```

> **Por que um trigger em vez de `INSERT` direto na tabela `usuarios` depois
> do `signUp`:** se a confirmação de e-mail estiver ativada no projeto
> (padrão de fábrica do Supabase), não existe sessão logo após o cadastro —
> só depois do usuário confirmar o e-mail. Um `INSERT` feito pelo cliente
> nesse intervalo falharia contra a política `usuarios_cria_proprio`, porque
> `auth.uid()` ainda não existe. O trigger roda como `SECURITY DEFINER` e não
> depende de sessão.
>
> **Consequência prática:** se `raw_user_meta_data.termos_aceitos_em` não for
> enviado no `signUp`, a criação da conta **falha** — de propósito. A coluna
> `termos_aceitos_em` é `NOT NULL` porque é a prova de consentimento exigida
> pela LGPD; preferimos travar o cadastro a registrar um aceite que não
> aconteceu.

### Enviar um alerta

Implementado em `frontend/src/services/alertas.ts` (`enviarAlerta`), usado
pela tela `pages/NovoAlerta.tsx`.

```ts
// 0. comprimir antes de tudo — foto de celular passa de 10-20 MB, acima do
//    limite de 8 MB do /classify e sem necessidade nenhuma para a análise.
const fotoComprimida = await comprimirImagem(arquivo)   // lib/imagem.ts

// 1. foto no Storage
const caminho = `${usuario.id}/${crypto.randomUUID()}.jpg`
await supabase.storage.from('alertas').upload(caminho, fotoComprimida)

// 2. registro do alerta (status inicial: 'processando', default da coluna)
const { data } = await supabase.from('alertas').insert({
  usuario_id: usuario.id,
  foto_path: caminho,
  localizacao: `POINT(${lng} ${lat})`,   // ordem: longitude, latitude
  endereco_manual: enderecoManual,       // preenchido só se o GPS foi negado
  tipo_anomalia: 'rachadura',
}).select().single()

// 3. classificação — nunca lança. 503 (sem modelo), erro de rede ou timeout
//    todos viram `null`, não uma exceção que travaria o envio do alerta.
const classificacao = await classificar(fotoComprimida)   // -> ... | null

// 4. resultado de volta no alerta — mesmo sem classificação, o status sai de
//    'processando' e o alerta aparece na fila de triagem sem risco sugerido.
await supabase.from('alertas').update({
  nivel_risco: classificacao?.risco ?? null,
  confianca_ia: classificacao?.confianca ?? null,
  modelo_versao: classificacao?.versao_modelo ?? null,
  status: 'recebido',
}).eq('id', data.id)
```

> **Atenção à ordem das coordenadas.** PostGIS usa `POINT(longitude latitude)`.
> A Geolocation API do navegador devolve `coords.latitude` e
> `coords.longitude` — trocar os dois coloca todos os alertas do Rio no meio
> do oceano, e o erro passa despercebido até alguém abrir o mapa.

> **Por que a classificação nunca bloqueia o envio:** se o passo 3 lançasse
> exceção em qualquer indisponibilidade do serviço de IA (esperado até o
> Sprint 5, mas também possível depois — deploy, rede, timeout), o alerta
> ficaria preso em `status = 'processando'` para sempre, com a foto já salva
> mas invisível para a Defesa Civil. Uma foto sem classificação automática
> ainda vale mais do que uma foto que nunca chegou à triagem.

### Upload de fotos — RLS do Storage

Bucket `alertas` (privado). Políticas em
`supabase/migrations/0003_storage_alertas.sql`, exigem o caminho no formato
`{usuario_id}/{arquivo}` — é assim que a política identifica o dono do
arquivo. Um upload para qualquer outro caminho é rejeitado.

### Ler a fila de triagem (Defesa Civil)

```ts
const { data } = await supabase.from('vw_fila_triagem').select('*')
```

Já vem ordenada por prioridade (crítico primeiro, mais antigo primeiro dentro
do mesmo nível) e com `latitude`/`longitude` extraídas para o Leaflet.

### Métricas do painel

```ts
const { data } = await supabase.from('vw_metricas_painel').select('*').single()
// alertas_ativos, criticos_ativos, ultimas_24h, tempo_medio_resposta_horas
```

### Realtime — status ao vivo

```ts
supabase.channel('alertas-do-usuario')
  .on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'alertas',
        filter: `usuario_id=eq.${usuario.id}` },
      (payload) => atualizarTela(payload.new))
  .subscribe()
```

---

## 3. Regras de acesso (resumo do RLS)

| Tabela | Cidadão | Defesa Civil |
|---|---|---|
| `usuarios` | lê/edita só o próprio perfil | lê todos |
| `alertas` | lê e cria os próprios | lê todos, atualiza status |
| `alerta_eventos` | lê os dos próprios alertas | lê todos |
| `bairros` | leitura pública | leitura pública |

O cidadão **não** pode alterar `status` nem `nivel_risco` de um alerta — nem o
próprio. Reclassificação é decisão da triagem.

---

## 4. Enums compartilhados

Definidos em três lugares que precisam permanecer sincronizados:

| Enum | Postgres | Python | TypeScript |
|---|---|---|---|
| risco | `nivel_risco` | `schemas.NivelRisco` | `types/dominio.ts` |
| status | `status_alerta` | — | `types/dominio.ts` |
| papel | `papel_usuario` | — | `types/dominio.ts` |
| anomalia | `tipo_anomalia` | — | `types/dominio.ts` |

Valores sempre em minúsculas e sem acento (`critico`, não `Crítico`). A
tradução para exibição vive em `ROTULO_RISCO` / `ROTULO_STATUS`, no frontend.

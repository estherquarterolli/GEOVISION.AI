-- =============================================================================
-- GeoVision.AI — Migration 0001: esquema inicial
-- Sprint 1 — Arquitetura e modelagem de dados
--
-- Cobre as tabelas previstas no plano de desenvolvimento: usuarios, alertas,
-- bairros. Adiciona alerta_eventos (trilha de auditoria) porque a métrica
-- "tempo médio de resposta" do Sprint 8 precisa do histórico de mudanças de
-- status — sem ela, essa métrica é impossível de calcular depois.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Extensões
-- -----------------------------------------------------------------------------
create extension if not exists postgis;      -- consultas geoespaciais
create extension if not exists pgcrypto;     -- gen_random_uuid()


-- -----------------------------------------------------------------------------
-- Tipos enumerados
--
-- Enum em vez de texto livre: impede que o serviço de IA grave "Crítico",
-- "critico" e "CRITICO" como três valores diferentes.
-- -----------------------------------------------------------------------------
create type nivel_risco as enum ('baixo', 'medio', 'critico');

create type status_alerta as enum (
  'processando',   -- foto enviada, aguardando classificação da IA
  'recebido',      -- classificado, na fila de triagem da Defesa Civil
  'em_vistoria',   -- ordem de vistoria emitida
  'resolvido',     -- vistoria concluída
  'nao_procede'    -- triagem concluiu que não havia risco
);

create type papel_usuario as enum ('cidadao', 'defesa_civil', 'admin');

create type tipo_anomalia as enum ('rachadura', 'inclinacao_muro', 'infiltracao', 'outro');


-- -----------------------------------------------------------------------------
-- bairros
--
-- Polígonos oficiais dos bairros. Permite agregar alertas por região sem
-- depender do texto digitado pelo usuário (que vem com erro de grafia).
-- -----------------------------------------------------------------------------
create table bairros (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  codigo_ibge text,
  geom        geometry(MultiPolygon, 4326),
  criado_em   timestamptz not null default now()
);

create index bairros_geom_idx on bairros using gist (geom);
create unique index bairros_nome_idx on bairros (lower(nome));

comment on table bairros is 'Limites geográficos dos bairros para agregação de alertas por região.';


-- -----------------------------------------------------------------------------
-- usuarios
--
-- Perfil da aplicação. O id referencia auth.users do Supabase Auth — a senha
-- e o fluxo de autenticação ficam inteiramente sob responsabilidade do Auth,
-- nunca nesta tabela.
-- -----------------------------------------------------------------------------
create table usuarios (
  id                uuid primary key references auth.users(id) on delete cascade,
  nome              text not null,
  email             text not null,
  bairro_id         uuid references bairros(id) on delete set null,
  bairro_texto      text,          -- fallback: bairro digitado antes do match espacial
  papel             papel_usuario not null default 'cidadao',
  termos_aceitos_em timestamptz not null,   -- LGPD: registro de consentimento
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now()
);

create index usuarios_bairro_idx on usuarios (bairro_id);
create index usuarios_papel_idx on usuarios (papel);

comment on column usuarios.termos_aceitos_em is
  'Momento do aceite dos Termos de Uso. Obrigatório: é a prova de consentimento exigida pela LGPD.';


-- -----------------------------------------------------------------------------
-- alertas
--
-- Núcleo do sistema. Um registro por foto enviada pelo cidadão.
-- -----------------------------------------------------------------------------
create table alertas (
  id              uuid primary key default gen_random_uuid(),
  usuario_id      uuid not null references usuarios(id) on delete cascade,

  -- Captura
  foto_path       text not null,               -- caminho no Supabase Storage
  localizacao     geography(Point, 4326),      -- GPS do momento do envio
  endereco_manual text,                        -- fallback quando o GPS é negado
  bairro_id       uuid references bairros(id) on delete set null,
  tipo_anomalia   tipo_anomalia,               -- informado pelo cidadão
  descricao       text,

  -- Classificação da IA
  nivel_risco     nivel_risco,                 -- nulo enquanto status = 'processando'
  confianca_ia    numeric(5, 4),               -- 0.0000 a 1.0000
  modelo_versao   text,                        -- rastreabilidade: qual modelo classificou

  -- Triagem
  status          status_alerta not null default 'processando',
  observacao_defesa_civil text,

  -- Marcos temporais (base das métricas do painel)
  criado_em       timestamptz not null default now(),
  classificado_em timestamptz,
  resolvido_em    timestamptz,

  -- Um alerta precisa de GPS OU endereço manual. Sem um dos dois, a Defesa
  -- Civil não tem como chegar ao local — o registro seria inútil.
  constraint alertas_tem_localizacao
    check (localizacao is not null or endereco_manual is not null),

  constraint alertas_confianca_valida
    check (confianca_ia is null or (confianca_ia >= 0 and confianca_ia <= 1))
);

create index alertas_localizacao_idx on alertas using gist (localizacao);
create index alertas_usuario_idx     on alertas (usuario_id, criado_em desc);
create index alertas_bairro_idx      on alertas (bairro_id);
-- Índice da consulta mais quente do painel: fila de triagem por prioridade.
create index alertas_triagem_idx     on alertas (status, nivel_risco, criado_em desc);

comment on column alertas.modelo_versao is
  'Versão do modelo que gerou a classificação. Sem isso é impossível auditar um erro da IA depois de um retreino.';


-- -----------------------------------------------------------------------------
-- alerta_eventos
--
-- Trilha de auditoria de mudança de status. Alimenta a métrica de tempo médio
-- de resposta e dá rastreabilidade de quem decidiu o quê.
-- -----------------------------------------------------------------------------
create table alerta_eventos (
  id             uuid primary key default gen_random_uuid(),
  alerta_id      uuid not null references alertas(id) on delete cascade,
  status_anterior status_alerta,
  status_novo    status_alerta not null,
  autor_id       uuid references usuarios(id) on delete set null,
  observacao     text,
  criado_em      timestamptz not null default now()
);

create index alerta_eventos_alerta_idx on alerta_eventos (alerta_id, criado_em);


-- -----------------------------------------------------------------------------
-- Funções e triggers
-- -----------------------------------------------------------------------------

-- Mantém atualizado_em coerente sem depender do cliente.
create or replace function fn_toca_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

create trigger trg_usuarios_atualizado_em
  before update on usuarios
  for each row execute function fn_toca_atualizado_em();


-- Descobre o bairro pelo ponto de GPS e registra os marcos temporais.
-- Fazer isso no banco garante consistência independente de qual cliente grava.
create or replace function fn_alerta_antes_de_gravar()
returns trigger
language plpgsql
as $$
begin
  -- Match espacial do bairro quando há GPS e o bairro ainda não foi definido
  if new.localizacao is not null and new.bairro_id is null then
    select b.id into new.bairro_id
    from bairros b
    where st_contains(b.geom, new.localizacao::geometry)
    limit 1;
  end if;

  -- Carimba o momento da classificação assim que o risco é atribuído
  if new.nivel_risco is not null
     and (tg_op = 'INSERT' or old.nivel_risco is distinct from new.nivel_risco)
     and new.classificado_em is null then
    new.classificado_em := now();
  end if;

  -- Carimba o encerramento
  if new.status in ('resolvido', 'nao_procede')
     and (tg_op = 'INSERT' or old.status is distinct from new.status)
     and new.resolvido_em is null then
    new.resolvido_em := now();
  end if;

  return new;
end;
$$;

create trigger trg_alerta_antes_de_gravar
  before insert or update on alertas
  for each row execute function fn_alerta_antes_de_gravar();


-- Registra automaticamente cada transição de status.
create or replace function fn_registra_evento_alerta()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    insert into alerta_eventos (alerta_id, status_anterior, status_novo, autor_id)
    values (new.id, null, new.status, new.usuario_id);
  elsif old.status is distinct from new.status then
    insert into alerta_eventos (alerta_id, status_anterior, status_novo, autor_id)
    values (new.id, old.status, new.status, auth.uid());
  end if;
  return new;
end;
$$;

create trigger trg_registra_evento_alerta
  after insert or update on alertas
  for each row execute function fn_registra_evento_alerta();


-- -----------------------------------------------------------------------------
-- Row Level Security
--
-- Sem RLS, a chave anônima do Supabase exposta no frontend daria a qualquer
-- pessoa acesso de leitura a todos os alertas e dados pessoais. As políticas
-- abaixo não são opcionais.
-- -----------------------------------------------------------------------------
alter table usuarios       enable row level security;
alter table alertas        enable row level security;
alter table alerta_eventos enable row level security;
alter table bairros        enable row level security;

-- Helper: o usuário autenticado é da Defesa Civil?
create or replace function fn_eh_defesa_civil()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from usuarios
    where id = auth.uid() and papel in ('defesa_civil', 'admin')
  );
$$;

-- usuarios: cada um enxerga e edita apenas o próprio perfil
create policy usuarios_le_proprio on usuarios
  for select using (id = auth.uid() or fn_eh_defesa_civil());

create policy usuarios_cria_proprio on usuarios
  for insert with check (id = auth.uid());

create policy usuarios_edita_proprio on usuarios
  for update using (id = auth.uid()) with check (id = auth.uid());

-- alertas: cidadão vê os seus; Defesa Civil vê todos
create policy alertas_le on alertas
  for select using (usuario_id = auth.uid() or fn_eh_defesa_civil());

create policy alertas_cria on alertas
  for insert with check (usuario_id = auth.uid());

-- Apenas a Defesa Civil altera status/observação. O cidadão não reabre nem
-- reclassifica o próprio alerta.
create policy alertas_atualiza on alertas
  for update using (fn_eh_defesa_civil()) with check (fn_eh_defesa_civil());

-- eventos: visíveis a quem enxerga o alerta correspondente
create policy alerta_eventos_le on alerta_eventos
  for select using (
    exists (
      select 1 from alertas a
      where a.id = alerta_eventos.alerta_id
        and (a.usuario_id = auth.uid() or fn_eh_defesa_civil())
    )
  );

-- bairros: leitura pública (usado no mapa e no cadastro)
create policy bairros_le_todos on bairros
  for select using (true);


-- -----------------------------------------------------------------------------
-- Visões de apoio ao painel
-- -----------------------------------------------------------------------------

-- Fila de triagem já ordenada por prioridade: crítico primeiro, mais antigo
-- primeiro dentro do mesmo nível.
create view vw_fila_triagem as
select
  a.id,
  a.nivel_risco,
  a.confianca_ia,
  a.status,
  a.tipo_anomalia,
  a.criado_em,
  a.foto_path,
  st_y(a.localizacao::geometry) as latitude,
  st_x(a.localizacao::geometry) as longitude,
  b.nome as bairro,
  u.nome as autor
from alertas a
left join bairros  b on b.id = a.bairro_id
left join usuarios u on u.id = a.usuario_id
where a.status in ('recebido', 'em_vistoria')
order by
  case a.nivel_risco
    when 'critico' then 1
    when 'medio'   then 2
    when 'baixo'   then 3
    else 4
  end,
  a.criado_em;

-- Métricas do cabeçalho do painel (Sprint 8).
create view vw_metricas_painel as
select
  count(*) filter (where status not in ('resolvido', 'nao_procede'))            as alertas_ativos,
  count(*) filter (where nivel_risco = 'critico'
                     and status not in ('resolvido', 'nao_procede'))            as criticos_ativos,
  count(*) filter (where criado_em >= now() - interval '24 hours')              as ultimas_24h,
  avg(extract(epoch from (resolvido_em - criado_em)) / 3600)
    filter (where resolvido_em is not null)                                     as tempo_medio_resposta_horas
from alertas;


-- -----------------------------------------------------------------------------
-- Webhook de alerta crítico
--
-- O disparo para o FastAPI é configurado como Database Webhook pelo painel do
-- Supabase (Database > Webhooks), que já gerencia retry e headers. O trigger
-- via pg_net abaixo fica registrado como alternativa versionada em código —
-- habilitar apenas se optarmos por não usar o painel.
--
-- create extension if not exists pg_net;
--
-- create or replace function fn_notifica_alerta_critico()
-- returns trigger language plpgsql as $$
-- begin
--   if new.nivel_risco = 'critico'
--      and (tg_op = 'INSERT' or old.nivel_risco is distinct from new.nivel_risco) then
--     perform net.http_post(
--       url     := current_setting('app.webhook_url') || '/webhooks/alerta-critico',
--       headers := jsonb_build_object(
--                    'Content-Type', 'application/json',
--                    'X-Webhook-Secret', current_setting('app.webhook_secret')),
--       body    := jsonb_build_object('alerta_id', new.id)
--     );
--   end if;
--   return new;
-- end; $$;
--
-- create trigger trg_notifica_alerta_critico
--   after insert or update on alertas
--   for each row execute function fn_notifica_alerta_critico();

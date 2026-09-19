-- =============================================================================
-- GeoVision.AI — Migration 0004: categorias do IBAPE e campos de priorização GUT
--
-- Contexto: os campos gravidade_percebida/tempo_surgimento/evolucao/
-- local_anomalia já existem no SQLite de desenvolvimento (ai-service/app/db.py)
-- desde a sessão de triagem do morador adicionada ao formulário de Novo
-- Alerta, mas nunca chegaram a esta migration porque o projeto Supabase real
-- ainda não foi aplicado (ver relatorio.md). Esta migration traz o schema do
-- Postgres para o mesmo ponto, e soma duas mudanças decididas em 17/09/2026
-- após validação técnica com a engenheira civil consultora — ver
-- docs/metodologia-priorizacao-gut.md para a justificativa completa:
--
--   1. Três novas categorias em tipo_anomalia, fundamentadas na Norma de
--      Inspeção Predial do IBAPE/NA e no checklist de Carvalho & Almeida
--      (COBREAP, 2017): desplacamento, armadura_exposta e
--      afundamento_recalque.
--   2. Coluna ruido_percebido — a engenheira apontou que som e vibração ao
--      pisar fazem parte da leitura sensorial de risco que uma foto sozinha
--      não capta.
--
-- pontuacao_gut e seus componentes (G/U/T) NÃO são colunas: são calculados
-- em tempo de requisição por ai-service/app/services/priorizacao.py, porque
-- dependem do nível de risco corrente e não deveriam ficar dessincronizados
-- de uma reclassificação. Nada a gravar aqui para isso.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Categorias de anomalia observáveis pelo morador, ampliadas com base no
-- checklist de inspeção predial (Apêndice C, item "1. ESTRUTURAS" e
-- "4. REVESTIMENTO" de Carvalho & Almeida, 2017; e "Fundação" da Norma
-- IBAPE/NA):
--   desplacamento        — reboco/concreto se soltando ou caindo
--   armadura_exposta     — ferragem à mostra e enferrujada (achado que a
--                          Norma trata com prioridade alta por risco à
--                          segurança estrutural)
--   afundamento_recalque — piso ou solo afundando/rachando (recalque
--                          diferencial de fundação)
-- ALTER TYPE ... ADD VALUE não pode ser revertido nem usado na mesma
-- transação em versões antigas do Postgres — como esta migration só
-- adiciona os valores (não os usa em seguida), roda sem problema.
-- -----------------------------------------------------------------------------
alter type tipo_anomalia add value if not exists 'desplacamento';
alter type tipo_anomalia add value if not exists 'armadura_exposta';
alter type tipo_anomalia add value if not exists 'afundamento_recalque';


-- -----------------------------------------------------------------------------
-- Sessão de triagem do morador — perguntas fechadas que substituem, em
-- parte, a leitura sensorial que um engenheiro faz em campo (visão, tato,
-- audição) e que uma única foto não capta. Alimentam o método GUT de
-- priorização da fila (ver docs/metodologia-priorizacao-gut.md).
-- Todas em texto livre curto (não enum) porque os valores possíveis podem
-- evoluir com o formulário sem exigir nova migration — a validação de
-- domínio fica no frontend (frontend/src/types/dominio.ts).
-- -----------------------------------------------------------------------------
alter table alertas add column if not exists gravidade_percebida text;
alter table alertas add column if not exists tempo_surgimento     text;
alter table alertas add column if not exists evolucao             text;
alter table alertas add column if not exists local_anomalia       text;
alter table alertas add column if not exists ruido_percebido      text;

comment on column alertas.gravidade_percebida is
  'Percepção do próprio morador sobre a gravidade (baixo/medio/alto). Alimenta a Tendência (T) do método GUT.';
comment on column alertas.evolucao is
  'Evolução percebida (estavel/aumentando/rapido). Alimenta a Urgência (U) do método GUT.';
comment on column alertas.ruido_percebido is
  'Som ou vibração notados no local (nenhum/estalos/vibracao_ao_pisar/outro). Adicionado após validação com a engenheira civil consultora em 16/09/2026.';

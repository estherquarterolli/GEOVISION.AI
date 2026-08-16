-- =============================================================================
-- GeoVision.AI — Migration 0003: bucket de fotos e suas políticas de RLS
-- Sprint 4 — Captura, câmera e geolocalização
--
-- O Storage do Supabase é regido por RLS na tabela storage.objects, separada
-- da RLS das tabelas do app. Criar só o bucket (pelo painel ou aqui) não
-- basta: sem política de INSERT em storage.objects, todo upload autenticado
-- volta "permission denied" mesmo com o bucket existindo.
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('alertas', 'alertas', false)
on conflict (id) do nothing;

-- Convenção de caminho: {usuario_id}/{uuid}.jpg — a política usa o primeiro
-- segmento do caminho para checar dono, então o frontend precisa respeitar
-- esse formato (ver frontend/src/services/alertas.ts).

create policy alertas_storage_upload_proprio on storage.objects
  for insert
  with check (
    bucket_id = 'alertas'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy alertas_storage_le on storage.objects
  for select
  using (
    bucket_id = 'alertas'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or fn_eh_defesa_civil()
    )
  );

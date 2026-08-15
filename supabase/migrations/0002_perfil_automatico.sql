-- =============================================================================
-- GeoVision.AI — Migration 0002: criação automática de perfil no cadastro
-- Sprint 2 — Autenticação e cadastro
--
-- Por que um trigger em vez do cliente inserir a linha em `usuarios` depois
-- do signUp: se a confirmação de e-mail estiver ativada no projeto Supabase
-- (padrão de fábrica), o usuário não tem sessão ativa logo após o cadastro —
-- só depois de confirmar o e-mail. Um insert feito pelo cliente nesse
-- intervalo falharia contra a política de RLS `usuarios_cria_proprio`
-- (auth.uid() ainda não existe). Um trigger em auth.users, rodando como
-- SECURITY DEFINER, cria o perfil no mesmo instante da conta, sem depender
-- de haver sessão.
-- =============================================================================

create or replace function public.fn_criar_perfil_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.usuarios (id, nome, email, bairro_texto, termos_aceitos_em)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data ->> 'bairro_texto',
    -- Sem coalesce para now(): a ausência desse campo indica que o cadastro
    -- não passou pelo fluxo do app (checkbox de Termos obrigatório antes do
    -- submit). Preferimos falhar a criação da conta a registrar consentimento
    -- que não aconteceu de fato — a coluna é NOT NULL exatamente por isso.
    (new.raw_user_meta_data ->> 'termos_aceitos_em')::timestamptz
  );
  return new;
end;
$$;

create trigger trg_criar_perfil_usuario
  after insert on auth.users
  for each row execute function public.fn_criar_perfil_usuario();

comment on function public.fn_criar_perfil_usuario is
  'Cria a linha em public.usuarios no instante do cadastro, lendo nome/bairro/aceite dos Termos de raw_user_meta_data (passados pelo frontend em supabase.auth.signUp). Ver frontend/src/lib/auth.tsx.';

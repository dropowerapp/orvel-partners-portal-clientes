-- Políticas de acesso (RLS).
-- Regras:
--  * RLS ativa em todas as tabelas de public; sem política = sem acesso.
--  * Todas as políticas filtram por organização, além de cliente/processo.
--  * Equipa: membro admin ativo E sessão com MFA (aal2). Sem MFA não lê nada.
--  * Cliente: só lê; escreve apenas através das funções em 20261031100300_client_api.sql.
--  * Parceiro: só com organizations.partner_role_enabled = true, MFA e processo atribuído.
--  * process_internal, internal_notes, partners, activity_log, email_outbox: só equipa.

-- Conjuntos de acesso do utilizador atual ------------------------------------------------

create or replace function private.staff_org_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select m.organization_id
  from public.memberships m
  where m.user_id = auth.uid()
    and m.role = 'admin'
    and m.is_active
    and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
$$;

create or replace function private.client_org_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select m.organization_id
  from public.memberships m
  where m.user_id = auth.uid() and m.role = 'client' and m.is_active
$$;

create or replace function private.client_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select m.client_id
  from public.memberships m
  where m.user_id = auth.uid() and m.role = 'client' and m.is_active
$$;

create or replace function private.client_process_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select p.id
  from public.processes p
  join public.memberships m on m.client_id = p.client_id and m.organization_id = p.organization_id
  where m.user_id = auth.uid() and m.role = 'client' and m.is_active
$$;

create or replace function private.partner_org_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select m.organization_id
  from public.memberships m
  join public.organizations o on o.id = m.organization_id
  where m.user_id = auth.uid()
    and m.role = 'partner'
    and m.is_active
    and o.partner_role_enabled
    and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
$$;

create or replace function private.partner_process_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select pa.process_id
  from public.partner_assignments pa
  join public.memberships m on m.partner_id = pa.partner_id and m.organization_id = pa.organization_id
  join public.organizations o on o.id = pa.organization_id
  where m.user_id = auth.uid()
    and m.role = 'partner'
    and m.is_active
    and o.partner_role_enabled
    and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
$$;

-- Dados bancários visíveis ao cliente: proposta aceite e dados libertados nesse processo.
create or replace function private.client_bank_account_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select p.bank_account_id
  from public.processes p
  where p.id in (select private.client_process_ids())
    and p.bank_account_id is not null
    and p.bank_details_released_at is not null
    and exists (select 1 from public.proposals pr where pr.process_id = p.id and pr.status = 'accepted')
$$;

-- Permissões base ------------------------------------------------------------------------

revoke all on schema private from public;
grant usage on schema private to authenticated;
revoke execute on all functions in schema private from public;
grant execute on function
  private.staff_org_ids(),
  private.client_org_ids(),
  private.client_ids(),
  private.client_process_ids(),
  private.partner_org_ids(),
  private.partner_process_ids(),
  private.client_bank_account_ids()
to authenticated;

-- anon não toca em nenhuma tabela; authenticated passa sempre pela RLS.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
-- Tabelas de sistema: só leitura para utilizadores (escrita apenas por funções do servidor).
revoke insert, update, delete on public.activity_log, public.email_outbox, public.privacy_consents from authenticated;

-- Ativar RLS em todas as tabelas de public. (Sem FORCE: as funções do servidor correm como
-- postgres, que no Supabase tem BYPASSRLS; os utilizadores da API nunca são donos das tabelas.)
do $$
declare
  t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;

-- Equipa: acesso total à própria organização ------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'clients', 'partners', 'memberships', 'bank_accounts', 'privacy_notices',
    'document_types', 'timeline_templates', 'timeline_template_steps', 'document_request_templates',
    'processes', 'people', 'proposals', 'document_requests', 'documents', 'payments',
    'timeline_steps', 'deadlines', 'partner_assignments', 'process_internal', 'internal_notes'
  ] loop
    execute format(
      'create policy staff_all on public.%I for all to authenticated '
      || 'using (organization_id in (select private.staff_org_ids())) '
      || 'with check (organization_id in (select private.staff_org_ids()))',
      t
    );
  end loop;
end $$;

create policy staff_select on public.organizations for select to authenticated
  using (id in (select private.staff_org_ids()));
create policy staff_update on public.organizations for update to authenticated
  using (id in (select private.staff_org_ids()))
  with check (id in (select private.staff_org_ids()));

create policy staff_select on public.privacy_consents for select to authenticated
  using (organization_id in (select private.staff_org_ids()));
create policy staff_select on public.activity_log for select to authenticated
  using (organization_id in (select private.staff_org_ids()));
create policy staff_select on public.email_outbox for select to authenticated
  using (organization_id in (select private.staff_org_ids()));

-- Próprio utilizador ---------------------------------------------------------------------------

create policy self_select on public.memberships for select to authenticated
  using (user_id = (select auth.uid()));
create policy self_select on public.privacy_consents for select to authenticated
  using (user_id = (select auth.uid()));

-- Cliente: só leitura dos seus dados ----------------------------------------------------------

create policy client_select on public.clients for select to authenticated
  using (
    organization_id in (select private.client_org_ids())
    and id in (select private.client_ids())
  );

create policy client_select on public.processes for select to authenticated
  using (
    organization_id in (select private.client_org_ids())
    and id in (select private.client_process_ids())
  );

do $$
declare
  t text;
begin
  foreach t in array array['people', 'payments', 'timeline_steps', 'document_requests', 'deadlines'] loop
    execute format(
      'create policy client_select on public.%I for select to authenticated using ('
      || 'organization_id in (select private.client_org_ids()) '
      || 'and process_id in (select private.client_process_ids()))',
      t
    );
  end loop;
end $$;

create policy client_select on public.proposals for select to authenticated
  using (
    organization_id in (select private.client_org_ids())
    and process_id in (select private.client_process_ids())
    and status <> 'draft'
  );

create policy client_select on public.documents for select to authenticated
  using (
    organization_id in (select private.client_org_ids())
    and process_id in (select private.client_process_ids())
    and purged_at is null
    and (direction = 'upload' or visible_to_client)
  );

create policy client_select on public.bank_accounts for select to authenticated
  using (
    organization_id in (select private.client_org_ids())
    and id in (select private.client_bank_account_ids())
  );

-- Catálogos legíveis por clientes e parceiros da organização.
create policy member_select on public.document_types for select to authenticated
  using (
    organization_id in (select private.client_org_ids())
    or organization_id in (select private.partner_org_ids())
  );

create policy member_select on public.privacy_notices for select to authenticated
  using (
    published_at is not null
    and (
      organization_id in (select private.client_org_ids())
      or organization_id in (select private.partner_org_ids())
    )
  );

-- Parceiro (desligado por omissão): processos atribuídos, sem contactos, pagamentos nem internos.

create policy partner_select on public.processes for select to authenticated
  using (
    organization_id in (select private.partner_org_ids())
    and id in (select private.partner_process_ids())
  );

do $$
declare
  t text;
begin
  foreach t in array array['people', 'timeline_steps', 'document_requests', 'partner_assignments'] loop
    execute format(
      'create policy partner_select on public.%I for select to authenticated using ('
      || 'organization_id in (select private.partner_org_ids()) '
      || 'and process_id in (select private.partner_process_ids()))',
      t
    );
  end loop;
end $$;

create policy partner_select on public.documents for select to authenticated
  using (
    organization_id in (select private.partner_org_ids())
    and process_id in (select private.partner_process_ids())
    and shared_with_partner
    and purged_at is null
  );

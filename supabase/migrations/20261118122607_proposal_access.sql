-- O cliente entra no portal para consultar e aceitar a proposta.
-- O acompanhamento, os dados do processo e os documentos só ficam disponíveis após
-- uma proposta aceite nesse processo. Mantém o bloqueio por aviso em falta/não lido.
-- Não publica avisos, não altera pagamentos e não ativa eliminação.

-- Conjunto mínimo: processos próprios, mesmo antes da aceitação.
create or replace function private.client_portal_process_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select p.id
  from public.processes p
  join public.memberships m on m.client_id = p.client_id and m.organization_id = p.organization_id
  where (select auth.uid()) is not null
    and m.user_id = (select auth.uid()) and m.role = 'client' and m.is_active
    and private.has_current_consent(m.organization_id)
$$;
revoke all on function private.client_portal_process_ids() from public, anon, authenticated;
grant execute on function private.client_portal_process_ids() to authenticated;

-- Todas as políticas e operações existentes de dados/ficheiros usam este conjunto.
create or replace function private.client_process_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select pr.process_id
  from public.proposals pr
  where (select auth.uid()) is not null
    and pr.status = 'accepted'
    and pr.process_id in (select private.client_portal_process_ids())
$$;

-- A ficha pessoal também só é disponibilizada com um processo aceite.
create or replace function private.client_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select m.client_id
  from public.memberships m
  where (select auth.uid()) is not null
    and m.user_id = (select auth.uid()) and m.role = 'client' and m.is_active
    and private.has_current_consent(m.organization_id)
    and exists (
      select 1 from public.processes p
      where p.client_id = m.client_id and p.organization_id = m.organization_id
        and p.id in (select private.client_process_ids())
    )
$$;

-- Exceção limitada à própria proposta, incluindo o PDF via sign-download.
-- Os rascunhos e as propostas de outros clientes continuam invisíveis.
alter policy client_select on public.proposals using (
  organization_id in (select private.client_org_ids())
  and process_id in (select private.client_portal_process_ids())
  and status <> 'draft'
);

-- Lista para o seletor e encaminhamento. Antes de aceitar devolve apenas identificação,
-- data de criação e estado da fase de proposta, sem os dados de acompanhamento.
-- SECURITY DEFINER é necessário porque a tabela processes já está fechada nessa fase.
create or replace function public.get_client_processes(p_org uuid)
returns table (
  id uuid, status public.process_status, plan_name text, includes_bank_account boolean,
  company_name_options text[], bank_account_id uuid, bank_details_released_at timestamptz,
  completed_at timestamptz, cancelled_at timestamptz, created_at timestamptz, proposal_accepted boolean
)
language sql stable security definer set search_path = '' as $$
  select p.id,
    case when access.accepted then p.status
      when p.cancelled_at is not null then 'cancelled'::public.process_status
      when p.completed_at is not null then 'completed'::public.process_status
      when exists (select 1 from public.proposals pr where pr.process_id = p.id and pr.status <> 'draft')
        then 'proposal_sent'::public.process_status
      else 'new'::public.process_status end,
    case when access.accepted then p.plan_name end,
    case when access.accepted then p.includes_bank_account else false end,
    case when access.accepted then p.company_name_options else '{}'::text[] end,
    case when access.accepted then p.bank_account_id end,
    case when access.accepted then p.bank_details_released_at end,
    p.completed_at, p.cancelled_at, p.created_at, access.accepted
  from public.processes p
  join public.memberships m on m.client_id = p.client_id and m.organization_id = p.organization_id
  cross join lateral (
    select exists (select 1 from public.proposals pr where pr.process_id = p.id and pr.status = 'accepted') as accepted
  ) access
  where (select auth.uid()) is not null
    and p.organization_id = p_org and m.user_id = (select auth.uid())
    and m.role = 'client' and m.is_active and private.has_current_consent(m.organization_id)
  order by p.created_at desc, p.id
$$;
revoke all on function public.get_client_processes(uuid) from public, anon, authenticated;
grant execute on function public.get_client_processes(uuid) to authenticated;

create or replace function private.find_client_proposal(p_proposal_id uuid, p_plan_name text, out proposal public.proposals, out plan jsonb)
language plpgsql stable security definer set search_path = '' as $$
begin
  select pr.* into proposal
  from public.proposals pr
  where pr.id = p_proposal_id and pr.status <> 'draft'
    and pr.process_id in (select private.client_portal_process_ids());
  if proposal.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  select e into plan from jsonb_array_elements(proposal.plans) e where e ->> 'name' = p_plan_name limit 1;
  if plan is null then
    raise exception 'plan_not_in_proposal' using errcode = 'P0001';
  end if;
end
$$;

-- A aceitação é a única operação de processo disponível nesta fase inicial.
-- Preserva texto, plano, data, utilizador, IP e navegador; serializa alterações concorrentes.
create or replace function public.accept_proposal(p_proposal_id uuid, p_plan_name text, p_user_agent text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_proposal public.proposals;
  v_process public.processes;
  v_plan jsonb;
  v_locale text;
begin
  select pr.* into v_proposal from public.proposals pr
  where pr.id = p_proposal_id and pr.status <> 'draft'
    and pr.process_id in (select private.client_portal_process_ids())
  for update;
  if v_proposal.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  select p.* into v_process from public.processes p where p.id = v_proposal.process_id for update;
  if v_process.completed_at is not null or v_process.cancelled_at is not null then
    raise exception 'process_closed' using errcode = 'P0001';
  end if;
  select e into v_plan from jsonb_array_elements(v_proposal.plans) e where e ->> 'name' = p_plan_name limit 1;
  if v_plan is null then
    raise exception 'plan_not_in_proposal' using errcode = 'P0001';
  end if;
  if v_proposal.status <> 'sent'
    or exists (select 1 from public.proposals pr where pr.process_id = v_proposal.process_id and pr.status = 'accepted') then
    raise exception 'proposal_not_open' using errcode = 'P0001';
  end if;
  if v_proposal.valid_until is not null and v_proposal.valid_until < private.org_today(v_proposal.organization_id) then
    raise exception 'proposal_expired' using errcode = 'P0001';
  end if;
  select c.locale into v_locale from public.clients c where c.id = v_process.client_id;

  perform set_config('app.accepting_proposal', 'on', true);
  update public.proposals set status = 'accepted', chosen_plan = v_plan ->> 'name',
    accepted_at = now(), accepted_by = auth.uid(), accepted_ip = private.request_ip(),
    accepted_user_agent = left(p_user_agent, 500),
    accepted_text = private.render_acceptance_text(v_proposal, v_plan, v_locale)
  where id = v_proposal.id;
  perform set_config('app.accepting_proposal', 'off', true);
  update public.processes set plan_name = v_plan ->> 'name',
    includes_bank_account = coalesce((v_plan ->> 'includes_bank_account')::boolean, false)
  where id = v_proposal.process_id;
end
$$;

-- CREATE OR REPLACE mantém privilégios; reafirmar os limites das APIs modificadas.
revoke all on function private.find_client_proposal(uuid, text) from public, anon, authenticated;
revoke all on function private.client_ids(), private.client_process_ids(), public.accept_proposal(uuid, text, text) from public, anon;
grant execute on function private.client_ids(), private.client_process_ids(), public.accept_proposal(uuid, text, text) to authenticated;

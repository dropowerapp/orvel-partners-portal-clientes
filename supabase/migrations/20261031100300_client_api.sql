-- Funções chamadas pela área de cliente. O cliente não tem permissões de escrita diretas:
-- tudo o que altera dados passa por aqui, com validação de cada campo.
-- Os erros usam códigos estáveis (ex.: 'process_closed') traduzidos no frontend.

create or replace function private.assert_client_process(p_process_id uuid, p_require_open boolean default true)
returns public.processes
language plpgsql stable security definer set search_path = '' as $$
declare
  v_proc public.processes;
begin
  select p.* into v_proc
  from public.processes p
  where p.id = p_process_id and p.id in (select private.client_process_ids());
  if v_proc.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if p_require_open and (v_proc.completed_at is not null or v_proc.cancelled_at is not null) then
    raise exception 'process_closed' using errcode = 'P0001';
  end if;
  return v_proc;
end
$$;

create or replace function private.clean_text(p text, p_max int default 200) returns text
language sql immutable set search_path = '' as $$
  select nullif(left(trim(regexp_replace(coalesce(p, ''), '\s+', ' ', 'g')), p_max), '')
$$;

-- Marca pública da organização (ecrã de entrada, antes do login) ------------------------------

create or replace function public.get_org_public(p_host text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', o.id,
    'name', o.name,
    'slug', o.slug,
    'logo_path', o.logo_path,
    'theme', o.theme,
    'contact_email', o.contact_email,
    'contact_whatsapp', o.contact_whatsapp,
    'default_locale', o.default_locale
  )
  from public.organizations o
  where lower(p_host) = any (o.hostnames) or o.slug = lower(p_host)
  order by (lower(p_host) = any (o.hostnames)) desc
  limit 1
$$;

-- Consentimento de privacidade ---------------------------------------------------------------

create or replace function public.accept_privacy_notice(p_notice_id uuid, p_user_agent text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_notice public.privacy_notices;
begin
  select n.* into v_notice
  from public.privacy_notices n
  where n.id = p_notice_id
    and n.published_at is not null
    and exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid() and m.organization_id = n.organization_id and m.is_active
    );
  if v_notice.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  insert into public.privacy_consents (organization_id, user_id, notice_id, ip, user_agent)
  values (v_notice.organization_id, auth.uid(), v_notice.id, private.request_ip(), left(p_user_agent, 500))
  on conflict (user_id, notice_id) do nothing;

  perform private.log_activity(v_notice.organization_id, null, 'consent.given', 'privacy_notice', v_notice.id,
    jsonb_build_object('version', v_notice.version));
end
$$;

-- Os meus dados ---------------------------------------------------------------------------------

create or replace function public.update_my_details(
  p_client_id uuid,
  p_full_name text,
  p_phone text,
  p_country text,
  p_address_line text,
  p_city text,
  p_postal_code text,
  p_address_country text
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_client public.clients;
begin
  select c.* into v_client from public.clients c
  where c.id = p_client_id and c.id in (select private.client_ids());
  if v_client.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if private.clean_text(p_full_name) is null then
    raise exception 'full_name_required' using errcode = 'P0001';
  end if;

  update public.clients set
    full_name = private.clean_text(p_full_name),
    phone = private.clean_text(p_phone, 40),
    country = private.clean_text(p_country, 80),
    address_line = private.clean_text(p_address_line, 300),
    city = private.clean_text(p_city, 120),
    postal_code = private.clean_text(p_postal_code, 20),
    address_country = private.clean_text(p_address_country, 80)
  where id = v_client.id;

  perform private.log_activity(v_client.organization_id, null, 'client.details_updated', 'client', v_client.id);
end
$$;

-- Titular e dependentes ---------------------------------------------------------------------

create or replace function public.save_person(
  p_process_id uuid,
  p_person_id uuid,
  p_relationship public.person_relationship,
  p_full_name text,
  p_nationality text,
  p_date_of_birth date
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_proc public.processes := private.assert_client_process(p_process_id);
  v_person public.people;
  v_id uuid;
begin
  if private.clean_text(p_full_name) is null then
    raise exception 'full_name_required' using errcode = 'P0001';
  end if;
  if p_date_of_birth is not null
     and (p_date_of_birth > private.org_today(v_proc.organization_id) or p_date_of_birth < date '1900-01-01') then
    raise exception 'date_of_birth_invalid' using errcode = 'P0001';
  end if;

  if p_person_id is null then
    if p_relationship = 'holder' and exists (
      select 1 from public.people where process_id = v_proc.id and relationship = 'holder'
    ) then
      raise exception 'holder_already_exists' using errcode = 'P0001';
    end if;
    insert into public.people (organization_id, process_id, relationship, full_name, nationality, date_of_birth)
    values (v_proc.organization_id, v_proc.id, p_relationship, private.clean_text(p_full_name),
            private.clean_text(p_nationality, 80), p_date_of_birth)
    returning id into v_id;
    perform private.log_activity(v_proc.organization_id, v_proc.id, 'person.created', 'person', v_id);
    return v_id;
  end if;

  select pe.* into v_person from public.people pe where pe.id = p_person_id and pe.process_id = v_proc.id;
  if v_person.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if (v_person.relationship = 'holder') <> (p_relationship = 'holder') then
    raise exception 'holder_relationship_locked' using errcode = 'P0001';
  end if;

  update public.people set
    relationship = p_relationship,
    full_name = private.clean_text(p_full_name),
    nationality = private.clean_text(p_nationality, 80),
    date_of_birth = p_date_of_birth
  where id = v_person.id;
  perform private.log_activity(v_proc.organization_id, v_proc.id, 'person.updated', 'person', v_person.id);
  return v_person.id;
end
$$;

create or replace function public.delete_person(p_person_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_person public.people;
begin
  select pe.* into v_person from public.people pe where pe.id = p_person_id;
  if v_person.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  perform private.assert_client_process(v_person.process_id);
  if v_person.relationship = 'holder' then
    raise exception 'holder_cannot_be_deleted' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.documents where person_id = v_person.id)
     or exists (select 1 from public.document_requests where person_id = v_person.id and status in ('submitted', 'approved')) then
    raise exception 'person_has_documents' using errcode = 'P0001';
  end if;
  delete from public.people where id = v_person.id;
  perform private.log_activity(v_person.organization_id, v_person.process_id, 'person.deleted', 'person', v_person.id,
    jsonb_build_object('relationship', v_person.relationship));
end
$$;

-- Nomes pretendidos para a empresa (1 a 3) ---------------------------------------------------

create or replace function public.set_company_names(p_process_id uuid, p_names text[]) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_proc public.processes := private.assert_client_process(p_process_id);
  v_names text[];
begin
  select coalesce(array_agg(n order by ord), '{}') into v_names
  from (
    select distinct on (lower(private.clean_text(x, 120))) private.clean_text(x, 120) as n, ord
    from unnest(p_names) with ordinality as u (x, ord)
    where private.clean_text(x, 120) is not null
    order by lower(private.clean_text(x, 120)), ord
  ) s;
  if cardinality(v_names) < 1 or cardinality(v_names) > 3 then
    raise exception 'company_names_count' using errcode = 'P0001';
  end if;
  update public.processes set company_name_options = v_names where id = v_proc.id;
  perform private.log_activity(v_proc.organization_id, v_proc.id, 'process.company_names_updated', 'process', v_proc.id);
end
$$;

-- Aceitação da proposta ----------------------------------------------------------------------

create or replace function private.render_acceptance_text(p_proposal public.proposals, p_plan jsonb, p_locale text)
returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  v_templates jsonb;
  v_default_locale text;
  v_text text;
begin
  select o.proposal_acceptance_text, o.default_locale into v_templates, v_default_locale
  from public.organizations o where o.id = p_proposal.organization_id;
  v_text := coalesce(v_templates ->> p_locale, v_templates ->> v_default_locale, v_templates ->> 'pt-PT');
  v_text := replace(v_text, '{reference}', p_proposal.reference);
  v_text := replace(v_text, '{plan}', p_plan ->> 'name');
  v_text := replace(v_text, '{price}', to_char((p_plan ->> 'price_aed')::numeric, 'FM999,999,990.00'));
  return v_text;
end
$$;

create or replace function private.find_client_proposal(p_proposal_id uuid, p_plan_name text, out proposal public.proposals, out plan jsonb)
language plpgsql stable security definer set search_path = '' as $$
begin
  select pr.* into proposal
  from public.proposals pr
  where pr.id = p_proposal_id
    and pr.status <> 'draft'
    and pr.process_id in (select private.client_process_ids());
  if proposal.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  select e into plan
  from jsonb_array_elements(proposal.plans) e
  where e ->> 'name' = p_plan_name
  limit 1;
  if plan is null then
    raise exception 'plan_not_in_proposal' using errcode = 'P0001';
  end if;
end
$$;

-- Texto exato que o cliente vai aceitar (mostrado antes do botão).
create or replace function public.get_acceptance_text(p_proposal_id uuid, p_plan_name text) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  v_found record;
  v_locale text;
begin
  select * into v_found from private.find_client_proposal(p_proposal_id, p_plan_name);
  select c.locale into v_locale
  from public.processes p join public.clients c on c.id = p.client_id
  where p.id = (v_found.proposal).process_id;
  return private.render_acceptance_text(v_found.proposal, v_found.plan, v_locale);
end
$$;

create or replace function public.accept_proposal(p_proposal_id uuid, p_plan_name text, p_user_agent text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_found record;
  v_proposal public.proposals;
  v_plan jsonb;
  v_locale text;
begin
  select * into v_found from private.find_client_proposal(p_proposal_id, p_plan_name);
  v_proposal := v_found.proposal;
  v_plan := v_found.plan;
  perform private.assert_client_process(v_proposal.process_id);

  if v_proposal.status <> 'sent' then
    raise exception 'proposal_not_open' using errcode = 'P0001';
  end if;
  if v_proposal.valid_until is not null
     and v_proposal.valid_until < private.org_today(v_proposal.organization_id) then
    raise exception 'proposal_expired' using errcode = 'P0001';
  end if;

  select c.locale into v_locale
  from public.processes p join public.clients c on c.id = p.client_id
  where p.id = v_proposal.process_id;

  perform set_config('app.accepting_proposal', 'on', true);
  update public.proposals set
    status = 'accepted',
    chosen_plan = v_plan ->> 'name',
    accepted_at = now(),
    accepted_by = auth.uid(),
    accepted_ip = private.request_ip(),
    accepted_user_agent = left(p_user_agent, 500),
    accepted_text = private.render_acceptance_text(v_proposal, v_plan, v_locale)
  where id = v_proposal.id;
  perform set_config('app.accepting_proposal', 'off', true);

  update public.processes set
    plan_name = v_plan ->> 'name',
    includes_bank_account = coalesce((v_plan ->> 'includes_bank_account')::boolean, false)
  where id = v_proposal.process_id;
end
$$;

-- Upload de documentos ------------------------------------------------------------------------
-- O ficheiro é carregado primeiro para o Storage (a política só deixa escrever em
-- {org}/{processo}/uploads/{pedido}/...) e depois registado aqui. Tamanho e tipo vêm do Storage.

create or replace function public.register_upload(p_request_id uuid, p_storage_path text, p_file_name text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_request public.document_requests;
  v_proc public.processes;
  v_object record;
  v_doc_id uuid;
begin
  select r.* into v_request from public.document_requests r where r.id = p_request_id;
  if v_request.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  v_proc := private.assert_client_process(v_request.process_id);
  if v_request.status not in ('pending', 'rejected') then
    raise exception 'request_not_open' using errcode = 'P0001';
  end if;
  if p_storage_path not like (v_proc.organization_id::text || '/' || v_proc.id::text || '/uploads/' || v_request.id::text || '/%')
     or position('..' in p_storage_path) > 0 then
    raise exception 'document_path_invalid' using errcode = 'P0001';
  end if;

  select o.metadata into v_object
  from storage.objects o
  where o.bucket_id = 'documents' and o.name = p_storage_path;
  if not found then
    raise exception 'upload_not_found' using errcode = 'P0001';
  end if;

  insert into public.documents (
    organization_id, process_id, person_id, request_id, document_type_id, direction,
    storage_path, file_name, mime_type, size_bytes
  ) values (
    v_proc.organization_id, v_proc.id, v_request.person_id, v_request.id, v_request.document_type_id, 'upload',
    p_storage_path, coalesce(private.clean_text(p_file_name, 200), 'documento'),
    v_object.metadata ->> 'mimetype', (v_object.metadata ->> 'size')::bigint
  ) returning id into v_doc_id;

  update public.document_requests set status = 'submitted' where id = v_request.id;
  return v_doc_id;
end
$$;

-- Permissões das funções públicas --------------------------------------------------------------

revoke execute on all functions in schema private from public;
revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.accept_privacy_notice(uuid, text),
  public.update_my_details(uuid, text, text, text, text, text, text, text),
  public.save_person(uuid, uuid, public.person_relationship, text, text, date),
  public.delete_person(uuid),
  public.set_company_names(uuid, text[]),
  public.get_acceptance_text(uuid, text),
  public.accept_proposal(uuid, text, text),
  public.register_upload(uuid, text, text)
to authenticated;
grant execute on function public.get_org_public(text) to anon, authenticated;

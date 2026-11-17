-- Etapa 3: funções do painel da equipa. Correm com os direitos de quem chama (security invoker):
-- a RLS aplica-se como em qualquer outra escrita da equipa (membro admin ativo e sessão com MFA).
-- A verificação explícita no início só serve para devolver um erro claro.

-- Novo processo, com cliente novo ou já existente, numa só operação: cliente, processo, pessoa
-- titular e as restantes pessoas. Os pedidos de documentos e a cronologia nascem dos modelos da
-- organização (triggers de processes e people).
--
-- p_client: { "id"?, "full_name", "email", "phone"?, "country"?, "locale"?,
--             "holder_name"?, "nationality"?, "date_of_birth"? }
--   Com "id", usa o cliente existente (da mesma organização) e ignora os restantes dados dele.
-- p_process: { "plan_name"?, "includes_bank_account"?, "free_zone"?, "visa_count"? }
-- p_people: [ { "relationship": "spouse"|"child"|"other", "full_name", "nationality"?, "date_of_birth"? } ]
create or replace function public.create_client_process(
  p_org uuid,
  p_client jsonb,
  p_process jsonb default '{}'::jsonb,
  p_people jsonb default '[]'::jsonb
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_client_id uuid;
  v_client_name text;
  v_process_id uuid;
  v_locale text;
  v_person jsonb;
  v_position smallint := 1;
  v_relationship public.person_relationship;
begin
  if not public.is_staff_of(p_org) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if jsonb_typeof(p_client) <> 'object' or jsonb_typeof(coalesce(p_process, '{}'::jsonb)) <> 'object'
     or jsonb_typeof(coalesce(p_people, '[]'::jsonb)) <> 'array' then
    raise exception 'invalid_input' using errcode = '22023';
  end if;

  if p_client ? 'id' then
    select c.id, c.full_name into v_client_id, v_client_name
    from public.clients c
    where c.id = (p_client ->> 'id')::uuid and c.organization_id = p_org;
    if v_client_id is null then
      raise exception 'not_found' using errcode = 'P0002';
    end if;
  else
    select coalesce(nullif(trim(p_client ->> 'locale'), ''), o.default_locale) into v_locale
    from public.organizations o where o.id = p_org;

    v_client_name := trim(p_client ->> 'full_name');
    begin
      insert into public.clients (organization_id, full_name, email, phone, country, locale)
      values (
        p_org,
        v_client_name,
        lower(trim(p_client ->> 'email')),
        nullif(trim(p_client ->> 'phone'), ''),
        nullif(trim(p_client ->> 'country'), ''),
        v_locale
      )
      returning id into v_client_id;
    exception when unique_violation then
      raise exception 'client_email_taken' using errcode = 'P0001';
    end;
  end if;

  insert into public.processes (organization_id, client_id, plan_name, includes_bank_account, free_zone, visa_count)
  values (
    p_org,
    v_client_id,
    nullif(trim(p_process ->> 'plan_name'), ''),
    coalesce((p_process ->> 'includes_bank_account')::boolean, false),
    nullif(trim(p_process ->> 'free_zone'), ''),
    (nullif(p_process ->> 'visa_count', ''))::smallint
  )
  returning id into v_process_id;

  insert into public.people (organization_id, process_id, relationship, full_name, nationality, date_of_birth, position)
  values (
    p_org,
    v_process_id,
    'holder',
    coalesce(nullif(trim(p_client ->> 'holder_name'), ''), v_client_name),
    nullif(trim(p_client ->> 'nationality'), ''),
    (nullif(p_client ->> 'date_of_birth', ''))::date,
    0
  );

  for v_person in select value from jsonb_array_elements(coalesce(p_people, '[]'::jsonb)) loop
    v_relationship := (v_person ->> 'relationship')::public.person_relationship;
    if v_relationship = 'holder' then
      raise exception 'invalid_input' using errcode = '22023';
    end if;
    insert into public.people (organization_id, process_id, relationship, full_name, nationality, date_of_birth, position)
    values (
      p_org,
      v_process_id,
      v_relationship,
      trim(v_person ->> 'full_name'),
      nullif(trim(v_person ->> 'nationality'), ''),
      (nullif(v_person ->> 'date_of_birth', ''))::date,
      v_position
    );
    v_position := v_position + 1;
  end loop;

  return v_process_id;
end
$$;

-- Próxima referência de proposta da organização: PREFIXO-ANO-NNN (ano na hora local da organização).
-- A referência é única por organização: se duas pessoas criarem ao mesmo tempo, a segunda recebe
-- um erro de duplicado e pede outra.
create or replace function public.next_proposal_reference(p_org uuid) returns text
language plpgsql stable security invoker set search_path = '' as $$
declare
  v_prefix text;
  v_year text;
  v_next int;
begin
  if not public.is_staff_of(p_org) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  select o.proposal_ref_prefix, to_char((now() at time zone o.timezone)::date, 'YYYY')
  into v_prefix, v_year
  from public.organizations o where o.id = p_org;

  select coalesce(max(substring(p.reference from '-([0-9]+)$')::int), 0) + 1 into v_next
  from public.proposals p
  where p.organization_id = p_org and p.reference like v_prefix || '-' || v_year || '-%';

  return v_prefix || '-' || v_year || '-' || lpad(v_next::text, 3, '0');
end
$$;

revoke execute on function public.create_client_process(uuid, jsonb, jsonb, jsonb) from public, anon;
revoke execute on function public.next_proposal_reference(uuid) from public, anon;
grant execute on function public.create_client_process(uuid, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.next_proposal_reference(uuid) to authenticated;

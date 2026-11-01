-- Etapa 2: consentimento de privacidade, contexto da sessão e convite de clientes.
--
-- 1. O consentimento passa a ser exigido pela própria base de dados: um cliente que ainda não
--    aceitou o aviso de privacidade em vigor não lê nem altera nada (só o próprio aviso).
--    Quando a organização publica uma nova versão, o cliente volta a ter de a aceitar.
-- 2. get_session_context: o que o frontend precisa de saber logo a seguir ao login.
-- 3. Funções admin_*: usadas só pelas Edge Functions com a chave de serviço (convite e emails
--    de autenticação). Nenhum utilizador do portal as pode executar.

-- Aviso em vigor e consentimento --------------------------------------------------------------

-- Aviso de privacidade em vigor numa organização: o publicado mais recente.
create or replace function private.current_notice_id(p_org uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select n.id
  from public.privacy_notices n
  where n.organization_id = p_org
    and n.published_at is not null
    and n.published_at <= now()
  order by n.published_at desc, n.version desc
  limit 1
$$;

-- O utilizador atual aceitou o aviso em vigor dessa organização.
create or replace function private.has_current_consent(p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.privacy_consents c
    where c.user_id = auth.uid()
      and c.organization_id = p_org
      and c.notice_id = private.current_notice_id(p_org)
  )
$$;

-- Os conjuntos do cliente passam a exigir o consentimento. client_org_ids fica como estava,
-- para o cliente conseguir ler o aviso que tem de aceitar.
create or replace function private.client_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select m.client_id
  from public.memberships m
  where m.user_id = auth.uid()
    and m.role = 'client'
    and m.is_active
    and private.has_current_consent(m.organization_id)
$$;

create or replace function private.client_process_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select p.id
  from public.processes p
  join public.memberships m on m.client_id = p.client_id and m.organization_id = p.organization_id
  where m.user_id = auth.uid()
    and m.role = 'client'
    and m.is_active
    and private.has_current_consent(m.organization_id)
$$;

-- Só se aceita o aviso em vigor (não uma versão antiga).
create or replace function public.accept_privacy_notice(p_notice_id uuid, p_user_agent text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_notice public.privacy_notices;
begin
  select n.* into v_notice
  from public.privacy_notices n
  where n.id = p_notice_id
    and n.id = private.current_notice_id(n.organization_id)
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

-- Contexto da sessão ---------------------------------------------------------------------------

-- Papel do utilizador atual na organização do portal (por hostname) e o que falta para entrar:
--   role: 'admin' | 'client' | 'partner' | null (sem acesso a esta organização)
--   mfa_required: a equipa (e o parceiro) só lê dados com MFA (aal2)
--   consent_required + notice: o cliente ainda não aceitou o aviso em vigor
--   notice_missing: não há aviso publicado (a área de cliente fica fechada)
-- Nunca devolve nomes da equipa.
create or replace function public.get_session_context(p_org uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_member public.memberships;
  v_org public.organizations;
  v_notice public.privacy_notices;
  v_role text;
  v_needs_consent boolean := false;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select o.* into v_org from public.organizations o where o.id = p_org;
  if v_org.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  select m.* into v_member
  from public.memberships m
  where m.user_id = auth.uid() and m.organization_id = p_org and m.is_active;

  v_role := v_member.role::text;
  if v_role = 'partner' and not v_org.partner_role_enabled then
    v_role := null;
  end if;

  if v_role = 'client' then
    select n.* into v_notice from public.privacy_notices n where n.id = private.current_notice_id(p_org);
    v_needs_consent := not private.has_current_consent(p_org);
  end if;

  return jsonb_build_object(
    'role', v_role,
    'client_id', case when v_role = 'client' then v_member.client_id end,
    'mfa_required', v_role in ('admin', 'partner'),
    'consent_required', coalesce(v_needs_consent, false),
    'notice_missing', v_role = 'client' and v_notice.id is null,
    'notice', case when v_needs_consent and v_notice.id is not null then jsonb_build_object(
      'id', v_notice.id,
      'version', v_notice.version,
      'body', v_notice.body,
      'retention_days', v_org.sensitive_retention_days
    ) end
  );
end
$$;

-- Verificação explícita usada pela função de convite (com o token do utilizador).
create or replace function public.is_staff_of(p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_org in (select private.staff_org_ids())
$$;

-- Funções para as Edge Functions (só service_role) ------------------------------------------------

-- Marca da organização para emails. Nunca inclui nomes da equipa.
create or replace function private.org_email_branding(p_org uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', o.id,
    'name', o.name,
    'slug', o.slug,
    'hostname', o.hostnames[1],
    'logo_path', o.logo_path,
    'theme', o.theme,
    'email_from_name', o.email_from_name,
    'email_from_address', o.email_from_address,
    'email_reply_to', coalesce(o.email_reply_to, o.email_from_address),
    'contact_email', o.contact_email,
    'contact_whatsapp', o.contact_whatsapp,
    'default_locale', o.default_locale
  )
  from public.organizations o
  where o.id = p_org
$$;

-- Dados para enviar (ou reenviar) o convite a um cliente. Confirma que quem convida é
-- administrador ativo da organização do cliente (o MFA é verificado antes, na Edge Function,
-- com public.is_staff_of e o token do próprio utilizador).
create or replace function public.admin_prepare_invite(p_client_id uuid, p_actor uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_client public.clients;
  v_member public.memberships;
begin
  select c.* into v_client from public.clients c where c.id = p_client_id;
  if v_client.id is null or not exists (
    select 1 from public.memberships m
    where m.user_id = p_actor and m.organization_id = v_client.organization_id
      and m.role = 'admin' and m.is_active
  ) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  if v_client.last_invite_sent_at > now() - interval '60 seconds' then
    raise exception 'invite_too_soon' using errcode = 'P0001';
  end if;

  select m.* into v_member from public.memberships m where m.client_id = v_client.id;
  if v_member.id is not null and not v_member.is_active then
    raise exception 'membership_inactive' using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'client', jsonb_build_object(
      'id', v_client.id,
      'full_name', v_client.full_name,
      'email', lower(v_client.email),
      'locale', v_client.locale,
      'user_id', v_member.user_id,
      'invited_at', v_client.invited_at
    ),
    'organization', private.org_email_branding(v_client.organization_id)
  );
end
$$;

-- Utilizador do Supabase Auth com este email (para reaproveitar contas já criadas).
create or replace function public.admin_user_id_by_email(p_email text) returns uuid
language sql stable security definer set search_path = '' as $$
  select u.id from auth.users u where lower(u.email) = lower(trim(p_email)) limit 1
$$;

-- Liga a conta ao cliente (membership) e regista o envio do convite.
create or replace function public.admin_register_invite(p_client_id uuid, p_user_id uuid, p_actor uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_client public.clients;
  v_existing public.memberships;
  v_resend boolean;
begin
  select c.* into v_client from public.clients c where c.id = p_client_id for update;
  if v_client.id is null or not exists (
    select 1 from public.memberships m
    where m.user_id = p_actor and m.organization_id = v_client.organization_id
      and m.role = 'admin' and m.is_active
  ) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  -- O cliente já está ligado a outra conta?
  select m.* into v_existing from public.memberships m where m.client_id = v_client.id;
  if v_existing.id is not null and v_existing.user_id <> p_user_id then
    raise exception 'client_linked_to_other_user' using errcode = 'P0001';
  end if;

  -- A conta já tem outro papel nesta organização (ex.: é da equipa)?
  if v_existing.id is null then
    if exists (
      select 1 from public.memberships m
      where m.user_id = p_user_id and m.organization_id = v_client.organization_id
    ) then
      raise exception 'membership_conflict' using errcode = 'P0001';
    end if;
    insert into public.memberships (user_id, organization_id, role, client_id)
    values (p_user_id, v_client.organization_id, 'client', v_client.id);
  end if;

  v_resend := v_client.invited_at is not null;
  update public.clients
  set invited_at = coalesce(invited_at, now()),
      last_invite_sent_at = now()
  where id = v_client.id;

  perform private.log_activity(v_client.organization_id, null, 'client.invited', 'client', v_client.id,
    jsonb_build_object('resend', v_resend), p_actor);
end
$$;

-- Contexto para os emails de autenticação (link mágico, recuperação de password): a organização
-- do utilizador, de preferência a do hostname de onde o pedido veio.
create or replace function public.admin_email_context(p_user_id uuid, p_host text default null) returns jsonb
language sql stable security definer set search_path = '' as $$
  with candidates as (
    select o.id as organization_id,
           m.role::text as role,
           c.locale as client_locale,
           c.full_name as client_name,
           (lower(coalesce(p_host, '')) = any (o.hostnames)) as host_match
    from public.memberships m
    join public.organizations o on o.id = m.organization_id
    left join public.clients c on c.id = m.client_id
    where m.user_id = p_user_id and m.is_active
    union all
    -- Sem acesso ativo: usa a organização do hostname (o email sai na mesma com a marca certa).
    select o.id, null, null, null, true
    from public.organizations o
    where lower(coalesce(p_host, '')) = any (o.hostnames)
      and not exists (select 1 from public.memberships m where m.user_id = p_user_id and m.is_active)
  )
  select jsonb_build_object(
    'role', c.role,
    -- Nome do cliente (para a saudação). Nunca nomes da equipa.
    'full_name', c.client_name,
    'locale', coalesce(c.client_locale, (private.org_email_branding(c.organization_id)) ->> 'default_locale'),
    'organization', private.org_email_branding(c.organization_id)
  )
  from candidates c
  order by c.host_match desc, (c.role = 'admin') desc nulls last
  limit 1
$$;

-- Permissões -------------------------------------------------------------------------------------

revoke execute on all functions in schema private from public;
revoke execute on function
  public.admin_prepare_invite(uuid, uuid),
  public.admin_user_id_by_email(text),
  public.admin_register_invite(uuid, uuid, uuid),
  public.admin_email_context(uuid, text)
from public, anon, authenticated;
grant execute on function
  public.admin_prepare_invite(uuid, uuid),
  public.admin_user_id_by_email(text),
  public.admin_register_invite(uuid, uuid, uuid),
  public.admin_email_context(uuid, text)
to service_role;

revoke execute on function
  public.get_session_context(uuid),
  public.is_staff_of(uuid),
  public.accept_privacy_notice(uuid, text)
from public, anon;
grant execute on function
  public.get_session_context(uuid),
  public.is_staff_of(uuid),
  public.accept_privacy_notice(uuid, text)
to authenticated;

-- Lógica de negócio na base de dados: registo de atividade, estado do processo,
-- cronologia automática, prazos criados a partir de documentos emitidos, valores iniciais.

-- Auxiliares -------------------------------------------------------------------------

create or replace function private.request_ip() returns inet
language plpgsql stable set search_path = '' as $$
declare
  v text;
begin
  v := nullif(trim(split_part(
    coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for', ''),
    ',', 1)), '');
  return v::inet;
exception when others then
  return null;
end
$$;

create or replace function private.org_today(p_org uuid) returns date
language sql stable security definer set search_path = '' as $$
  select (now() at time zone o.timezone)::date from public.organizations o where o.id = p_org
$$;

create or replace function private.log_activity(
  p_org uuid,
  p_process uuid,
  p_action text,
  p_entity_type text default null,
  p_entity_id uuid default null,
  p_metadata jsonb default '{}'::jsonb,
  p_actor uuid default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := coalesce(p_actor, auth.uid());
  v_role text;
begin
  if v_uid is not null then
    select m.role::text into v_role
    from public.memberships m
    where m.user_id = v_uid and m.organization_id = p_org;
  end if;
  insert into public.activity_log (
    organization_id, process_id, actor_user_id, actor_role, action, entity_type, entity_id, metadata, ip
  ) values (
    p_org, p_process, v_uid,
    coalesce(v_role, case when v_uid is null then 'system' else 'unknown' end),
    p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb), private.request_ip()
  );
end
$$;

-- Valores iniciais por organização (secção 8 do briefing) ----------------------------

create or replace function private.install_org_defaults(p_org uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_template uuid;
begin
  -- Tipos de documento enviados pelo cliente
  insert into public.document_types (organization_id, key, direction, is_sensitive, position, label) values
    (p_org, 'passport',           'upload', true,  10, '{"pt-PT": "Passaporte", "en": "Passport"}'),
    (p_org, 'photo',              'upload', true,  20, '{"pt-PT": "Fotografia tipo passe com fundo branco", "en": "Passport photo with white background"}'),
    (p_org, 'marriage_certificate','upload', false, 30, '{"pt-PT": "Certidão de casamento", "en": "Marriage certificate"}'),
    (p_org, 'birth_certificate',  'upload', false, 40, '{"pt-PT": "Certidão de nascimento", "en": "Birth certificate"}'),
    (p_org, 'other',              'upload', false, 90, '{"pt-PT": "Outro documento", "en": "Other document"}');

  -- Tipos de documento emitidos pela organização
  insert into public.document_types (organization_id, key, direction, is_sensitive, deadline_type, position, label) values
    (p_org, 'trade_licence',             'issued', false, 'licence',            10, '{"pt-PT": "Licença comercial", "en": "Trade licence"}'),
    (p_org, 'incorporation_certificate', 'issued', false, null,                 20, '{"pt-PT": "Certificado de constituição", "en": "Certificate of incorporation"}'),
    (p_org, 'moa',                       'issued', false, null,                 30, '{"pt-PT": "Estatutos (MOA)", "en": "Memorandum of Association (MOA)"}'),
    (p_org, 'office_contract',           'issued', false, 'office_contract',    40, '{"pt-PT": "Contrato de escritório", "en": "Office contract"}'),
    (p_org, 'establishment_card',        'issued', false, 'establishment_card', 50, '{"pt-PT": "Establishment Card", "en": "Establishment Card"}'),
    (p_org, 'evisa',                     'issued', false, null,                 60, '{"pt-PT": "e-Visa", "en": "e-Visa"}'),
    (p_org, 'residence_visa',            'issued', false, 'residence_visa',     70, '{"pt-PT": "Visto de residência", "en": "Residence visa"}'),
    (p_org, 'emirates_id',               'issued', true,  'emirates_id',        80, '{"pt-PT": "Emirates ID", "en": "Emirates ID"}'),
    (p_org, 'invoice',                   'issued', false, null,                 90, '{"pt-PT": "Fatura", "en": "Invoice"}'),
    (p_org, 'other',                     'issued', false, null,                 99, '{"pt-PT": "Outro", "en": "Other"}');

  -- Pedidos de documentos (modelo)
  insert into public.document_request_templates (organization_id, document_type_id, applies_to, position)
  select p_org, t.id, x.applies_to::public.request_applies_to, x.position
  from (values
    ('passport', 'each_person', 10),
    ('photo', 'each_person', 20),
    ('marriage_certificate', 'spouse', 30),
    ('birth_certificate', 'child', 40)
  ) as x (key, applies_to, position)
  join public.document_types t on t.organization_id = p_org and t.key = x.key and t.direction = 'upload';

  -- Cronologia (modelo)
  insert into public.timeline_templates (organization_id, name, is_default)
  values (p_org, 'Constituição e residência', true)
  returning id into v_template;

  insert into public.timeline_template_steps (organization_id, template_id, position, title, condition, auto_event) values
    (p_org, v_template,  10, '{"pt-PT": "Proposta aceite", "en": "Proposal accepted"}', null, 'proposal_accepted'),
    (p_org, v_template,  20, '{"pt-PT": "Pagamento confirmado", "en": "Payment confirmed"}', null, 'payment_confirmed'),
    (p_org, v_template,  30, '{"pt-PT": "Documentos recebidos", "en": "Documents received"}', null, 'documents_received'),
    (p_org, v_template,  40, '{"pt-PT": "Pedido de constituição submetido", "en": "Incorporation application submitted"}', null, null),
    (p_org, v_template,  50, '{"pt-PT": "Assinaturas", "en": "Signatures"}', null, null),
    (p_org, v_template,  60, '{"pt-PT": "Licença emitida", "en": "Licence issued"}', null, null),
    (p_org, v_template,  70, '{"pt-PT": "Establishment Card", "en": "Establishment Card"}', null, null),
    (p_org, v_template,  80, '{"pt-PT": "e-Visa emitido", "en": "e-Visa issued"}', null, null),
    (p_org, v_template,  90, '{"pt-PT": "Chegada ao Dubai", "en": "Arrival in Dubai"}', null, null),
    (p_org, v_template, 100, '{"pt-PT": "Exame médico e biometria", "en": "Medical test and biometrics"}', null, null),
    (p_org, v_template, 110, '{"pt-PT": "Visto de residência", "en": "Residence visa"}', null, null),
    (p_org, v_template, 120, '{"pt-PT": "Emirates ID", "en": "Emirates ID"}', null, null),
    (p_org, v_template, 130, '{"pt-PT": "Conta bancária", "en": "Bank account"}', 'requires_bank_account', null),
    (p_org, v_template, 140, '{"pt-PT": "Processo concluído", "en": "Process completed"}', null, 'process_completed');

  -- Aviso de privacidade provisório, por publicar: a área de cliente só abre depois de
  -- a equipa publicar um aviso validado pelo advogado.
  insert into public.privacy_notices (organization_id, version, body) values (
    p_org, 1,
    jsonb_build_object('pt-PT',
      'TEXTO PROVISÓRIO, A VALIDAR PELO ADVOGADO. Os seus dados pessoais são tratados apenas para '
      || 'acompanhar o seu processo. As cópias de passaportes e fotografias são apagadas '
      || '{retention_days} dias depois de o processo terminar.')
  );
end
$$;

create or replace function private.organizations_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.install_org_defaults(new.id);
  return new;
end
$$;

create trigger install_defaults after insert on public.organizations
  for each row execute function private.organizations_after_insert();

-- Estado do processo ---------------------------------------------------------------------

create or replace function private.compute_process_status(
  p_process_id uuid, p_completed_at timestamptz, p_cancelled_at timestamptz
) returns public.process_status
language sql stable security definer set search_path = '' as $$
  select case
    when p_cancelled_at is not null then 'cancelled'::public.process_status
    when p_completed_at is not null then 'completed'::public.process_status
    when not exists (
      select 1 from public.proposals where process_id = p_process_id and status = 'accepted'
    ) then
      case when exists (
        select 1 from public.proposals where process_id = p_process_id and status in ('sent', 'expired')
      ) then 'proposal_sent'::public.process_status else 'new'::public.process_status end
    when not exists (select 1 from public.payments where process_id = p_process_id)
      or exists (select 1 from public.payments where process_id = p_process_id and status <> 'paid')
      then 'awaiting_payment'::public.process_status
    when exists (
      select 1 from public.document_requests where process_id = p_process_id and status <> 'approved'
    ) then 'awaiting_documents'::public.process_status
    else 'in_progress'::public.process_status
  end
$$;

-- Passos automáticos da cronologia: avançam sozinhos quando o facto se verifica.
-- Só "Processo concluído" recua (quando um processo é reaberto).
create or replace function private.sync_auto_steps(p_process_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid;
  v_completed boolean;
  v_accepted boolean;
  v_paid boolean;
  v_docs boolean;
  v_today date;
begin
  select p.organization_id, p.completed_at is not null into v_org, v_completed
  from public.processes p where p.id = p_process_id;
  if v_org is null then
    return;
  end if;
  v_today := private.org_today(v_org);

  v_accepted := exists (select 1 from public.proposals where process_id = p_process_id and status = 'accepted');
  v_paid := exists (select 1 from public.payments where process_id = p_process_id)
    and not exists (select 1 from public.payments where process_id = p_process_id and status <> 'paid');
  v_docs := exists (select 1 from public.document_requests where process_id = p_process_id)
    and not exists (select 1 from public.document_requests where process_id = p_process_id and status <> 'approved');

  update public.timeline_steps s
  set status = 'done', done_on = coalesce(s.done_on, v_today)
  where s.process_id = p_process_id
    and s.status <> 'done'
    and (
      (s.auto_event = 'proposal_accepted' and v_accepted)
      or (s.auto_event = 'payment_confirmed' and v_paid)
      or (s.auto_event = 'documents_received' and v_docs)
      or (s.auto_event = 'process_completed' and v_completed)
    );

  update public.timeline_steps s
  set status = 'todo', done_on = null
  where s.process_id = p_process_id
    and s.auto_event = 'process_completed'
    and s.status = 'done'
    and not v_completed;
end
$$;

create or replace function private.refresh_process(p_process_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.processes p
  set status = private.compute_process_status(p.id, p.completed_at, p.cancelled_at)
  where p.id = p_process_id
    and p.status is distinct from private.compute_process_status(p.id, p.completed_at, p.cancelled_at);
  perform private.sync_auto_steps(p_process_id);
end
$$;

-- Passo condicional "Conta bancária": existe só quando o plano a inclui.
create or replace function private.sync_conditional_steps(p_process_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_proc record;
begin
  select p.id, p.organization_id, p.includes_bank_account into v_proc
  from public.processes p where p.id = p_process_id;
  if v_proc.id is null then
    return;
  end if;

  if v_proc.includes_bank_account then
    insert into public.timeline_steps (organization_id, process_id, position, title, condition, auto_event, template_step_id)
    select v_proc.organization_id, v_proc.id, ts.position, ts.title, ts.condition, ts.auto_event, ts.id
    from public.timeline_template_steps ts
    join public.timeline_templates t on t.id = ts.template_id
    where t.organization_id = v_proc.organization_id and t.is_default
      and ts.condition = 'requires_bank_account'
      and not exists (
        select 1 from public.timeline_steps s
        where s.process_id = v_proc.id and s.condition = 'requires_bank_account'
      );
  else
    delete from public.timeline_steps s
    where s.process_id = v_proc.id and s.condition = 'requires_bank_account' and s.status = 'todo';
  end if;
end
$$;

create or replace function private.processes_before_write() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_org record;
  v_closed_now boolean;
begin
  select o.timezone, o.sensitive_retention_days into v_org
  from public.organizations o where o.id = new.organization_id;

  new.status := private.compute_process_status(new.id, new.completed_at, new.cancelled_at);

  -- Data de limpeza dos ficheiros sensíveis: fixada no momento em que o processo termina.
  if new.completed_at is not null or new.cancelled_at is not null then
    v_closed_now := tg_op = 'INSERT' or (old.completed_at is null and old.cancelled_at is null);
    if v_closed_now or new.sensitive_purge_on is null then
      new.sensitive_purge_on :=
        (coalesce(new.completed_at, new.cancelled_at) at time zone v_org.timezone)::date
        + v_org.sensitive_retention_days;
    end if;
  else
    new.sensitive_purge_on := null;
  end if;

  -- Dados bancários: só podem ser libertados depois de a proposta ser aceite.
  if new.bank_details_released_at is not null
     and (tg_op = 'INSERT' or old.bank_details_released_at is null) then
    if not exists (
      select 1 from public.proposals where process_id = new.id and status = 'accepted'
    ) then
      raise exception 'bank_details_require_accepted_proposal' using errcode = 'P0001';
    end if;
    if new.bank_account_id is null then
      raise exception 'bank_details_require_account' using errcode = 'P0001';
    end if;
    new.bank_details_released_by := auth.uid();
  elsif new.bank_details_released_at is null then
    new.bank_details_released_by := null;
  end if;

  return new;
end
$$;

create trigger before_write before insert or update on public.processes
  for each row execute function private.processes_before_write();

create or replace function private.processes_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.timeline_steps (organization_id, process_id, position, title, condition, auto_event, template_step_id)
  select new.organization_id, new.id, ts.position, ts.title, ts.condition, ts.auto_event, ts.id
  from public.timeline_template_steps ts
  join public.timeline_templates t on t.id = ts.template_id
  where t.organization_id = new.organization_id and t.is_default
    and (ts.condition is null or (ts.condition = 'requires_bank_account' and new.includes_bank_account))
  order by ts.position;

  insert into public.process_internal (process_id, organization_id) values (new.id, new.organization_id);

  perform private.log_activity(new.organization_id, new.id, 'process.created', 'process', new.id);
  return new;
end
$$;

create trigger after_insert after insert on public.processes
  for each row execute function private.processes_after_insert();

create or replace function private.processes_after_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status then
    perform private.log_activity(new.organization_id, new.id, 'process.status_changed', 'process', new.id,
      jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  if new.includes_bank_account is distinct from old.includes_bank_account then
    perform private.sync_conditional_steps(new.id);
  end if;
  if new.completed_at is distinct from old.completed_at or new.cancelled_at is distinct from old.cancelled_at then
    perform private.sync_auto_steps(new.id);
    perform private.log_activity(new.organization_id, new.id,
      case
        when new.completed_at is not null then 'process.completed'
        when new.cancelled_at is not null then 'process.cancelled'
        else 'process.reopened'
      end,
      'process', new.id, jsonb_build_object('sensitive_purge_on', new.sensitive_purge_on));
  end if;
  if new.bank_details_released_at is not null and old.bank_details_released_at is null then
    perform private.log_activity(new.organization_id, new.id, 'bank_details.released', 'process', new.id);
  end if;
  return new;
end
$$;

create trigger after_update after update on public.processes
  for each row execute function private.processes_after_update();

-- Pessoas: pedidos de documentos criados a partir do modelo ---------------------------------

create or replace function private.people_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.document_requests (organization_id, process_id, person_id, document_type_id)
  select new.organization_id, new.process_id, new.id, rt.document_type_id
  from public.document_request_templates rt
  where rt.organization_id = new.organization_id
    and (
      rt.applies_to = 'each_person'
      or (rt.applies_to = 'spouse' and new.relationship = 'spouse')
      or (rt.applies_to = 'child' and new.relationship = 'child')
    )
  order by rt.position;
  return new;
end
$$;

create trigger after_insert after insert on public.people
  for each row execute function private.people_after_insert();

-- Propostas ---------------------------------------------------------------------------------

create or replace function private.proposals_before_write() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_prefix text;
begin
  select o.proposal_ref_prefix into v_prefix from public.organizations o where o.id = new.organization_id;
  if new.reference !~ ('^' || v_prefix || '-[0-9]{4}-[0-9]{3,}$') then
    raise exception 'proposal_reference_invalid' using errcode = 'P0001';
  end if;

  -- Uma proposta aceite é um registo jurídico: não muda.
  if tg_op = 'UPDATE' and old.status = 'accepted' then
    if (new.status, new.reference, new.pdf_path, new.plans, new.chosen_plan, new.accepted_at,
        new.accepted_by, new.accepted_ip, new.accepted_user_agent, new.accepted_text, new.process_id)
       is distinct from
       (old.status, old.reference, old.pdf_path, old.plans, old.chosen_plan, old.accepted_at,
        old.accepted_by, old.accepted_ip, old.accepted_user_agent, old.accepted_text, old.process_id) then
      raise exception 'proposal_accepted_is_locked' using errcode = 'P0001';
    end if;
  end if;

  -- Só a função de aceitação (chamada pelo cliente) pode marcar como aceite.
  if new.status = 'accepted' and (tg_op = 'INSERT' or old.status <> 'accepted')
     and coalesce(current_setting('app.accepting_proposal', true), '') <> 'on' then
    raise exception 'proposal_accept_only_by_client' using errcode = 'P0001';
  end if;

  if new.status = 'sent' and (tg_op = 'INSERT' or old.status <> 'sent') then
    if new.pdf_path is null or jsonb_array_length(new.plans) = 0 then
      raise exception 'proposal_requires_pdf_and_plans' using errcode = 'P0001';
    end if;
    new.sent_at := coalesce(new.sent_at, now());
  end if;

  if new.status = 'declined' and new.declined_at is null then
    new.declined_at := now();
  end if;

  return new;
end
$$;

create trigger before_write before insert or update on public.proposals
  for each row execute function private.proposals_before_write();

create or replace function private.proposals_before_delete() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.status = 'accepted' then
    raise exception 'proposal_accepted_is_locked' using errcode = 'P0001';
  end if;
  return old;
end
$$;

create trigger before_delete before delete on public.proposals
  for each row execute function private.proposals_before_delete();

create or replace function private.proposals_after_write() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    perform private.refresh_process(old.process_id);
    return old;
  end if;
  perform private.refresh_process(new.process_id);
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    perform private.log_activity(new.organization_id, new.process_id, 'proposal.' || new.status::text,
      'proposal', new.id, jsonb_build_object('reference', new.reference));
  end if;
  return new;
end
$$;

create trigger after_write after insert or update or delete on public.proposals
  for each row execute function private.proposals_after_write();

-- Pagamentos ---------------------------------------------------------------------------------

create or replace function private.payments_before_write() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'paid' then
    new.amount_paid_aed := new.amount_aed;
    new.paid_on := coalesce(new.paid_on, private.org_today(new.organization_id));
  elsif new.status = 'pending' then
    new.amount_paid_aed := 0;
    new.paid_on := null;
  end if;
  return new;
end
$$;

create trigger before_write before insert or update on public.payments
  for each row execute function private.payments_before_write();

create or replace function private.payments_after_write() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    perform private.refresh_process(old.process_id);
    return old;
  end if;
  perform private.refresh_process(new.process_id);
  if tg_op = 'INSERT' or new.status is distinct from old.status or new.amount_paid_aed is distinct from old.amount_paid_aed then
    perform private.log_activity(new.organization_id, new.process_id, 'payment.updated', 'payment', new.id,
      jsonb_build_object('status', new.status, 'amount_aed', new.amount_aed, 'amount_paid_aed', new.amount_paid_aed));
  end if;
  return new;
end
$$;

create trigger after_write after insert or update or delete on public.payments
  for each row execute function private.payments_after_write();

-- Pedidos de documentos ------------------------------------------------------------------------

create or replace function private.document_requests_before_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status is distinct from old.status then
    if new.status in ('approved', 'rejected') then
      new.reviewed_by := auth.uid();
      new.reviewed_at := now();
    else
      new.reviewed_by := null;
      new.reviewed_at := null;
    end if;
  end if;
  return new;
end
$$;

create trigger before_update before update on public.document_requests
  for each row execute function private.document_requests_before_update();

create or replace function private.document_requests_after_write() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    perform private.refresh_process(old.process_id);
    return old;
  end if;
  perform private.refresh_process(new.process_id);
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    perform private.log_activity(new.organization_id, new.process_id, 'document_request.' || new.status::text,
      'document_request', new.id,
      case when new.status = 'rejected' then jsonb_build_object('reason', new.rejection_reason) else '{}'::jsonb end);
  end if;
  return new;
end
$$;

create trigger after_write after insert or update or delete on public.document_requests
  for each row execute function private.document_requests_after_write();

-- Documentos e prazos automáticos ------------------------------------------------------------

create or replace function private.documents_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_type record;
begin
  select t.direction, t.is_sensitive into v_type
  from public.document_types t where t.id = new.document_type_id;
  if v_type.direction is distinct from new.direction then
    raise exception 'document_type_direction_mismatch' using errcode = 'P0001';
  end if;
  if new.storage_path not like (new.organization_id::text || '/' || new.process_id::text || '/%')
     or position('..' in new.storage_path) > 0 then
    raise exception 'document_path_invalid' using errcode = 'P0001';
  end if;
  new.is_sensitive := new.is_sensitive or v_type.is_sensitive;
  new.uploaded_by := coalesce(new.uploaded_by, auth.uid());
  if new.direction = 'upload' then
    new.visible_to_client := true;
  end if;
  return new;
end
$$;

create trigger before_insert before insert on public.documents
  for each row execute function private.documents_before_insert();

create or replace function private.sync_document_deadline(p_doc public.documents) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_deadline_type public.deadline_type;
begin
  select t.deadline_type into v_deadline_type from public.document_types t where t.id = p_doc.document_type_id;

  if p_doc.direction <> 'issued' or v_deadline_type is null then
    return;
  end if;

  if p_doc.expires_on is null then
    update public.deadlines set status = 'dismissed'
    where document_id = p_doc.id and status in ('open', 'renewing');
    return;
  end if;

  if exists (select 1 from public.deadlines where document_id = p_doc.id) then
    update public.deadlines
    set due_on = p_doc.expires_on, reminders_sent = '{}', status = 'open'
    where document_id = p_doc.id and due_on is distinct from p_doc.expires_on;
    return;
  end if;

  -- Novo documento do mesmo tipo e pessoa: o prazo anterior fica "renovado".
  update public.deadlines
  set status = 'renewed'
  where process_id = p_doc.process_id
    and deadline_type = v_deadline_type
    and person_id is not distinct from p_doc.person_id
    and status in ('open', 'renewing');

  insert into public.deadlines (organization_id, process_id, person_id, document_id, deadline_type, due_on)
  values (p_doc.organization_id, p_doc.process_id, p_doc.person_id, p_doc.id, v_deadline_type, p_doc.expires_on);
end
$$;

create or replace function private.documents_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.sync_document_deadline(new);
  perform private.log_activity(new.organization_id, new.process_id,
    case when new.direction = 'issued' then 'document.issued' else 'document.uploaded' end,
    'document', new.id,
    jsonb_build_object('file_name', new.file_name, 'sensitive', new.is_sensitive, 'request_id', new.request_id));
  return new;
end
$$;

create trigger after_insert after insert on public.documents
  for each row execute function private.documents_after_insert();

create or replace function private.documents_after_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.expires_on is distinct from old.expires_on then
    perform private.sync_document_deadline(new);
  end if;
  return new;
end
$$;

create trigger after_update after update on public.documents
  for each row execute function private.documents_after_update();

-- Dados internos: total de outros custos ---------------------------------------------------

create or replace function private.process_internal_before_write() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.other_costs_aed := coalesce(
    (select sum((e ->> 'amount_aed')::numeric) from jsonb_array_elements(new.other_costs) e), 0);
  return new;
end
$$;

create trigger before_write before insert or update on public.process_internal
  for each row execute function private.process_internal_before_write();

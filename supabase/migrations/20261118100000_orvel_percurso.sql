-- Etapa 4: percurso por fases (documento "Criar empresa no Dubai, passo a passo" da Orvel) e
-- contactos da Orvel.
--
-- Fases: documents (documentos e proposta) → incorporation (constituição da empresa) →
-- residence (visto de residência) → bank (conta bancária) → done. Os nomes e prazos indicativos de
-- cada fase estão nos ficheiros de tradução do portal. Os processos já existentes mantêm os passos
-- que tinham; o modelo novo só se aplica a processos criados a partir de agora.

alter table public.timeline_template_steps
  add column phase text check (phase in ('documents', 'incorporation', 'residence', 'bank', 'done'));
alter table public.timeline_steps
  add column phase text check (phase in ('documents', 'incorporation', 'residence', 'bank', 'done'));

-- Os passos criados a partir do modelo herdam a fase (evita mudar as funções que os copiam).
create or replace function private.timeline_steps_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.phase is null and new.template_step_id is not null then
    select ts.phase into new.phase from public.timeline_template_steps ts where ts.id = new.template_step_id;
  end if;
  return new;
end
$$;

create trigger before_insert before insert on public.timeline_steps
  for each row execute function private.timeline_steps_before_insert();

-- Fase por omissão de um passo de modelo sem fase (como os do modelo inicial de cada organização
-- nova, criados por install_org_defaults), pelas posições desse modelo.
create or replace function private.default_phase(p_position smallint, p_condition public.step_condition,
  p_auto_event public.timeline_auto_event) returns text
language sql immutable set search_path = '' as $$
  select case
    when p_auto_event in ('proposal_accepted', 'payment_confirmed', 'documents_received') then 'documents'
    when p_auto_event = 'process_completed' then 'done'
    when p_condition = 'requires_bank_account' then 'bank'
    when p_position <= 70 then 'incorporation'
    else 'residence'
  end
$$;

create or replace function private.timeline_template_steps_before_insert() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.phase := coalesce(new.phase, private.default_phase(new.position, new.condition, new.auto_event));
  return new;
end
$$;

create trigger before_insert before insert on public.timeline_template_steps
  for each row execute function private.timeline_template_steps_before_insert();

revoke execute on all functions in schema private from public;

-- Fases dos modelos já existentes.
update public.timeline_template_steps set phase = private.default_phase(position, condition, auto_event);

-- E dos passos dos processos já existentes que vieram desses modelos.
update public.timeline_steps s set phase = ts.phase
from public.timeline_template_steps ts
where ts.id = s.template_step_id and s.phase is null;

-- Modelo da Orvel, tal como no documento do percurso.
do $$
declare
  v_org uuid := (select id from public.organizations where slug = 'orvel');
  v_template uuid;
begin
  if v_org is null then
    return;
  end if;
  select id into v_template from public.timeline_templates where organization_id = v_org and is_default;
  if v_template is null then
    insert into public.timeline_templates (organization_id, name, is_default)
    values (v_org, 'Constituição e residência', true) returning id into v_template;
  end if;

  -- Os passos dos processos existentes ficam (template_step_id passa a null).
  delete from public.timeline_template_steps where template_id = v_template;

  insert into public.timeline_template_steps (organization_id, template_id, position, phase, title, condition, auto_event) values
    (v_org, v_template,  10, 'documents',     '{"pt-PT": "Proposta aceite", "en": "Proposal accepted"}', null, 'proposal_accepted'),
    (v_org, v_template,  20, 'documents',     '{"pt-PT": "Pagamento confirmado", "en": "Payment confirmed"}', null, 'payment_confirmed'),
    (v_org, v_template,  30, 'documents',     '{"pt-PT": "Documentos recebidos", "en": "Documents received"}', null, 'documents_received'),
    (v_org, v_template,  40, 'incorporation', '{"pt-PT": "Pedido de constituição submetido", "en": "Incorporation application submitted"}', null, null),
    (v_org, v_template,  50, 'incorporation', '{"pt-PT": "Pagamento das taxas e assinaturas por email", "en": "Fees paid and documents signed by email"}', null, null),
    (v_org, v_template,  60, 'incorporation', '{"pt-PT": "Documentos da empresa emitidos", "en": "Company documents issued"}', null, null),
    (v_org, v_template,  70, 'residence',     '{"pt-PT": "Data da viagem confirmada (5 dias úteis de antecedência)", "en": "Travel date confirmed (5 working days in advance)"}', null, null),
    (v_org, v_template,  80, 'residence',     '{"pt-PT": "e-Visa emitido (válido 2 meses)", "en": "e-Visa issued (valid for 2 months)"}', null, null),
    (v_org, v_template,  90, 'residence',     '{"pt-PT": "Chegada ao Dubai", "en": "Arrival in Dubai"}', null, null),
    (v_org, v_template, 100, 'residence',     '{"pt-PT": "Exame médico e biometria", "en": "Medical test and biometrics"}', null, null),
    (v_org, v_template, 110, 'residence',     '{"pt-PT": "Visto de residência e Emirates ID emitidos", "en": "Residence visa and Emirates ID issued"}', null, null),
    (v_org, v_template, 120, 'bank',          '{"pt-PT": "Abertura da conta pessoal e da empresa", "en": "Personal and company accounts opened"}', 'requires_bank_account', null),
    (v_org, v_template, 130, 'done',          '{"pt-PT": "Processo concluído", "en": "Process completed"}', null, 'process_completed');

  -- Contactos da Orvel para os clientes (página Contacto e início).
  update public.organizations
  set contact_whatsapp = '+971503642510', contact_email = 'hello@orvelpartners.com'
  where id = v_org;
end $$;

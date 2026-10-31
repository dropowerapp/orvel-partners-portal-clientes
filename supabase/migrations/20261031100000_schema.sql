-- Portal de clientes: esquema base.
-- Todas as tabelas de negócio têm organization_id. As tabelas ligadas a um processo usam
-- chaves estrangeiras compostas (process_id, organization_id) para que seja impossível
-- associar um registo a um processo de outra organização.

create schema if not exists private;
-- Funções internas: nunca executáveis por PUBLIC. Cada migração que cria funções em private
-- termina com "revoke execute on all functions in schema private from public" (o teste
-- 01_catalog.sql falha se alguma escapar).
revoke all on schema private from public;

-- Tipos ----------------------------------------------------------------------

create type public.app_role as enum ('admin', 'client', 'partner');
create type public.process_status as enum (
  'new', 'proposal_sent', 'awaiting_payment', 'awaiting_documents', 'in_progress', 'completed', 'cancelled'
);
create type public.person_relationship as enum ('holder', 'spouse', 'child', 'other');
create type public.proposal_status as enum ('draft', 'sent', 'accepted', 'expired', 'declined');
create type public.payment_status as enum ('pending', 'partial', 'paid');
create type public.step_status as enum ('todo', 'in_progress', 'done');
create type public.step_condition as enum ('requires_bank_account');
create type public.timeline_auto_event as enum (
  'proposal_accepted', 'payment_confirmed', 'documents_received', 'process_completed'
);
create type public.document_direction as enum ('upload', 'issued');
create type public.request_applies_to as enum ('each_person', 'spouse', 'child');
create type public.request_status as enum ('pending', 'submitted', 'approved', 'rejected');
create type public.deadline_type as enum (
  'licence', 'office_contract', 'establishment_card', 'residence_visa', 'emirates_id', 'other'
);
create type public.deadline_status as enum ('open', 'renewing', 'renewed', 'dismissed');
create type public.email_status as enum ('queued', 'sent', 'failed');

-- Utilitários ------------------------------------------------------------------

create or replace function private.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end
$$;

-- Organização e acessos ----------------------------------------------------------

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  hostnames text[] not null default '{}',
  logo_path text,
  theme jsonb not null default '{}'::jsonb check (jsonb_typeof(theme) = 'object'),
  email_from_name text not null,
  email_from_address text not null check (email_from_address ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  email_reply_to text check (email_reply_to ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  team_notification_email text not null check (team_notification_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  contact_email text,
  contact_whatsapp text,
  reminder_days int[] not null default '{90,60,30,7}'
    check (cardinality(reminder_days) between 1 and 10 and 0 < all (reminder_days)),
  weekly_digest_weekday smallint not null default 1 check (weekly_digest_weekday between 1 and 7),
  sensitive_retention_days int not null default 30 check (sensitive_retention_days between 0 and 3650),
  proposal_ref_prefix text not null default 'ORV' check (proposal_ref_prefix ~ '^[A-Z]{2,6}$'),
  -- Texto que o cliente aceita, por idioma. Marcadores: {reference}, {plan}, {price}.
  proposal_acceptance_text jsonb not null default jsonb_build_object(
    'pt-PT', 'Declaro que li e aceito a proposta {reference}, no plano {plan}, pelo valor total de {price} AED, nas condições descritas no documento.'
  ),
  timezone text not null default 'Asia/Dubai',
  default_locale text not null default 'pt-PT',
  partner_role_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.partners (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id)
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  full_name text not null check (length(trim(full_name)) > 0),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone text,
  country text,
  address_line text,
  city text,
  postal_code text,
  address_country text,
  locale text not null default 'pt-PT',
  invited_at timestamptz,
  last_invite_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id)
);
create unique index clients_org_email_key on public.clients (organization_id, lower(email));

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  role public.app_role not null,
  client_id uuid,
  partner_id uuid,
  -- Visível apenas à equipa; o cliente nunca vê nomes da equipa.
  display_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, organization_id),
  foreign key (client_id, organization_id) references public.clients (id, organization_id) on delete cascade,
  foreign key (partner_id, organization_id) references public.partners (id, organization_id) on delete cascade,
  check ((role = 'client') = (client_id is not null)),
  check ((role = 'partner') = (partner_id is not null))
);
create unique index memberships_client_key on public.memberships (client_id) where client_id is not null;

create table public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  label text not null,
  beneficiary text not null,
  bank_name text not null,
  iban text,
  account_number text,
  swift text,
  currency text not null default 'AED',
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id)
);

create table public.privacy_notices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  version int not null check (version > 0),
  -- Texto por idioma. Marcador {retention_days} substituído na apresentação.
  body jsonb not null check (jsonb_typeof(body) = 'object'),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, version),
  unique (id, organization_id)
);

create table public.privacy_consents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  notice_id uuid not null,
  accepted_at timestamptz not null default now(),
  ip inet,
  user_agent text,
  unique (user_id, notice_id),
  foreign key (notice_id, organization_id) references public.privacy_notices (id, organization_id) on delete cascade
);

-- Catálogos e modelos por organização ----------------------------------------------

create table public.document_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  key text not null check (key ~ '^[a-z0-9_]+$'),
  label jsonb not null check (jsonb_typeof(label) = 'object'),
  direction public.document_direction not null,
  is_sensitive boolean not null default false,
  deadline_type public.deadline_type,
  is_active boolean not null default true,
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, key, direction),
  unique (id, organization_id),
  check (direction = 'issued' or deadline_type is null)
);

create table public.timeline_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id)
);
create unique index timeline_templates_one_default on public.timeline_templates (organization_id) where is_default;

create table public.timeline_template_steps (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  template_id uuid not null,
  position smallint not null,
  title jsonb not null check (jsonb_typeof(title) = 'object'),
  condition public.step_condition,
  auto_event public.timeline_auto_event,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (template_id, position),
  foreign key (template_id, organization_id) references public.timeline_templates (id, organization_id) on delete cascade
);

create table public.document_request_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  document_type_id uuid not null,
  applies_to public.request_applies_to not null,
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, document_type_id, applies_to),
  foreign key (document_type_id, organization_id) references public.document_types (id, organization_id) on delete cascade
);

-- Processos ------------------------------------------------------------------------

create table public.processes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  client_id uuid not null,
  -- Calculado automaticamente (ver private.compute_process_status); não editar à mão.
  status public.process_status not null default 'new',
  plan_name text,
  includes_bank_account boolean not null default false,
  free_zone text,
  visa_count smallint check (visa_count between 0 and 50),
  company_name_options text[] not null default '{}' check (cardinality(company_name_options) <= 3),
  bank_account_id uuid,
  bank_details_released_at timestamptz,
  bank_details_released_by uuid references auth.users (id) on delete set null,
  completed_at timestamptz,
  cancelled_at timestamptz,
  -- Data em que os ficheiros sensíveis enviados pelo cliente serão apagados (fixada ao concluir/cancelar).
  sensitive_purge_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (client_id, organization_id) references public.clients (id, organization_id) on delete restrict,
  foreign key (bank_account_id, organization_id) references public.bank_accounts (id, organization_id),
  check (completed_at is null or cancelled_at is null)
);
create index processes_org_status_idx on public.processes (organization_id, status);
create index processes_client_idx on public.processes (client_id);

create table public.people (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  process_id uuid not null,
  relationship public.person_relationship not null,
  full_name text not null check (length(trim(full_name)) > 0),
  nationality text,
  date_of_birth date,
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (id, process_id),
  foreign key (process_id, organization_id) references public.processes (id, organization_id) on delete cascade
);
create unique index people_one_holder on public.people (process_id) where relationship = 'holder';
create index people_process_idx on public.people (process_id);

create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  process_id uuid not null,
  reference text not null,
  pdf_path text,
  -- Planos apresentados: [{"name": "...", "price_aed": 0, "includes_bank_account": false}]
  plans jsonb not null default '[]'::jsonb check (jsonb_typeof(plans) = 'array'),
  chosen_plan text,
  valid_until date,
  status public.proposal_status not null default 'draft',
  sent_at timestamptz,
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  accepted_ip inet,
  accepted_user_agent text,
  accepted_text text,
  declined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, reference),
  foreign key (process_id, organization_id) references public.processes (id, organization_id) on delete cascade,
  check (status <> 'accepted' or (accepted_at is not null and accepted_text is not null and chosen_plan is not null))
);
create unique index proposals_one_accepted on public.proposals (process_id) where status = 'accepted';
create index proposals_process_idx on public.proposals (process_id);

create table public.document_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  process_id uuid not null,
  person_id uuid not null,
  document_type_id uuid not null,
  custom_label text,
  instructions text,
  status public.request_status not null default 'pending',
  rejection_reason text,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, process_id),
  foreign key (process_id, organization_id) references public.processes (id, organization_id) on delete cascade,
  foreign key (person_id, process_id) references public.people (id, process_id) on delete cascade,
  foreign key (document_type_id, organization_id) references public.document_types (id, organization_id),
  check (status <> 'rejected' or length(trim(coalesce(rejection_reason, ''))) > 0)
);
create index document_requests_process_idx on public.document_requests (process_id);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  process_id uuid not null,
  person_id uuid,
  request_id uuid,
  document_type_id uuid not null,
  direction public.document_direction not null,
  title text,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  is_sensitive boolean not null default false,
  issued_on date,
  expires_on date,
  uploaded_by uuid references auth.users (id) on delete set null,
  visible_to_client boolean not null default true,
  shared_with_partner boolean not null default false,
  purged_at timestamptz,
  purged_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (process_id, organization_id) references public.processes (id, organization_id) on delete cascade,
  foreign key (person_id, process_id) references public.people (id, process_id) on delete set null (person_id),
  foreign key (request_id, process_id) references public.document_requests (id, process_id) on delete set null (request_id),
  foreign key (document_type_id, organization_id) references public.document_types (id, organization_id),
  check (direction = 'upload' or request_id is null),
  check (expires_on is null or issued_on is null or expires_on >= issued_on)
);
create index documents_process_idx on public.documents (process_id);
create index documents_purge_idx on public.documents (process_id) where is_sensitive and purged_at is null;

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  process_id uuid not null,
  description text not null default '',
  amount_aed numeric(12, 2) not null check (amount_aed > 0),
  amount_paid_aed numeric(12, 2) not null default 0 check (amount_paid_aed >= 0),
  status public.payment_status not null default 'pending',
  due_on date,
  paid_on date,
  invoice_document_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (process_id, organization_id) references public.processes (id, organization_id) on delete cascade,
  foreign key (invoice_document_id, organization_id) references public.documents (id, organization_id)
    on delete set null (invoice_document_id),
  check (status <> 'partial' or (amount_paid_aed > 0 and amount_paid_aed < amount_aed))
);
create index payments_process_idx on public.payments (process_id);

create table public.timeline_steps (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  process_id uuid not null,
  position smallint not null,
  title jsonb not null check (jsonb_typeof(title) = 'object'),
  status public.step_status not null default 'todo',
  planned_on date,
  done_on date,
  client_note text,
  condition public.step_condition,
  auto_event public.timeline_auto_event,
  template_step_id uuid references public.timeline_template_steps (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (process_id, organization_id) references public.processes (id, organization_id) on delete cascade
);
create index timeline_steps_process_idx on public.timeline_steps (process_id, position);

create table public.deadlines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  process_id uuid not null,
  person_id uuid,
  document_id uuid unique,
  deadline_type public.deadline_type not null,
  title text,
  due_on date not null,
  status public.deadline_status not null default 'open',
  -- Avisos já enviados (dias antes do prazo). Cada aviso sai uma só vez.
  reminders_sent int[] not null default '{}',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (process_id, organization_id) references public.processes (id, organization_id) on delete cascade,
  foreign key (person_id, process_id) references public.people (id, process_id) on delete set null (person_id),
  foreign key (document_id) references public.documents (id) on delete set null
);
create index deadlines_org_due_idx on public.deadlines (organization_id, due_on) where status in ('open', 'renewing');

-- Parceiros (papel previsto, desligado por omissão) -----------------------------------

create table public.partner_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  partner_id uuid not null,
  process_id uuid not null,
  assigned_by uuid references auth.users (id) on delete set null default auth.uid(),
  assigned_at timestamptz not null default now(),
  unique (partner_id, process_id),
  foreign key (partner_id, organization_id) references public.partners (id, organization_id) on delete cascade,
  foreign key (process_id, organization_id) references public.processes (id, organization_id) on delete cascade
);

-- Só equipa ---------------------------------------------------------------------------

create table public.process_internal (
  process_id uuid primary key,
  organization_id uuid not null,
  manager_user_id uuid references auth.users (id) on delete set null,
  partner_id uuid,
  partner_cost_aed numeric(12, 2) check (partner_cost_aed >= 0),
  -- [{"label": "...", "amount_aed": 0}]
  other_costs jsonb not null default '[]'::jsonb check (jsonb_typeof(other_costs) = 'array'),
  other_costs_aed numeric(12, 2) not null default 0,
  sale_price_aed numeric(12, 2) check (sale_price_aed >= 0),
  margin_aed numeric(12, 2) generated always as (
    sale_price_aed - coalesce(partner_cost_aed, 0) - other_costs_aed
  ) stored,
  invoice_issuer text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (process_id, organization_id) references public.processes (id, organization_id) on delete cascade,
  foreign key (partner_id, organization_id) references public.partners (id, organization_id)
);

create table public.internal_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  process_id uuid not null,
  author_id uuid references auth.users (id) on delete set null default auth.uid(),
  body text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (process_id, organization_id) references public.processes (id, organization_id) on delete cascade
);
create index internal_notes_process_idx on public.internal_notes (process_id);

-- Sistema -----------------------------------------------------------------------------

create table public.activity_log (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  process_id uuid references public.processes (id) on delete set null,
  actor_user_id uuid,
  actor_role text not null,
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  ip inet,
  created_at timestamptz not null default now()
);
create index activity_log_process_idx on public.activity_log (process_id, created_at desc);
create index activity_log_org_idx on public.activity_log (organization_id, created_at desc);

create table public.email_outbox (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  process_id uuid references public.processes (id) on delete set null,
  template text not null,
  to_email text not null,
  to_kind text not null check (to_kind in ('client', 'team')),
  locale text not null default 'pt-PT',
  payload jsonb not null default '{}'::jsonb,
  status public.email_status not null default 'queued',
  attempts int not null default 0,
  last_error text,
  provider_message_id text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index email_outbox_queue_idx on public.email_outbox (created_at) where status = 'queued';

-- updated_at automático -------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'organizations', 'partners', 'clients', 'memberships', 'bank_accounts', 'privacy_notices',
    'document_types', 'timeline_templates', 'timeline_template_steps', 'document_request_templates',
    'processes', 'people', 'proposals', 'document_requests', 'documents', 'payments',
    'timeline_steps', 'deadlines', 'process_internal', 'internal_notes'
  ] loop
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function private.set_updated_at()',
      t
    );
  end loop;
end $$;

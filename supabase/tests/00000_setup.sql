-- Preparação dos testes: funções auxiliares no schema "tests" (só em ambiente local).
-- Corre primeiro (ordem alfabética) e fica gravado; os restantes ficheiros correm cada um
-- numa transação que é desfeita no fim. Todos os dados são fictícios.

create extension if not exists pgtap with schema extensions;

drop schema if exists tests cascade;
create schema tests;
grant usage on schema tests to anon, authenticated;

-- Identificadores determinísticos: tests.id('client_a') devolve sempre o mesmo uuid.
create function tests.id(p_name text) returns uuid
language sql immutable as $$ select md5('orvel-tests:' || p_name)::uuid $$;

create function tests.login(p_user text, p_aal text default 'aal1') returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object(
    'sub', tests.id(p_user), 'role', 'authenticated', 'aal', p_aal
  )::text, true);
  perform set_config('role', 'authenticated', true);
end
$$;

create function tests.login_anon() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  perform set_config('role', 'anon', true);
end
$$;

create function tests.logout() returns void
language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end
$$;

-- Executa um comando com o papel atual e devolve o número de linhas afetadas.
create function tests.affected(p_sql text) returns int
language plpgsql as $$
declare
  n int;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end
$$;

create function tests.create_user(p_name text) returns uuid
language sql as $$
  insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, email_confirmed_at)
  values (tests.id(p_name), 'authenticated', 'authenticated', p_name || '@exemplo.test', '{}', '{}', now())
  returning id
$$;

-- Pedido de documento de uma pessoa, por tipo (ex.: tests.request_id('person_a_spouse', 'passport')).
create function tests.request_id(p_person text, p_doc_key text) returns uuid
language sql stable security definer set search_path = '' as $$
  select r.id from public.document_requests r
  join public.document_types t on t.id = r.document_type_id
  where r.person_id = tests.id(p_person) and t.key = p_doc_key
$$;

-- Caminho de upload de um pedido, como o frontend o constrói.
create function tests.upload_path(p_org text, p_proc text, p_person text, p_doc_key text, p_file text default 'f.pdf')
returns text
language sql stable as $$
  select tests.id(p_org) || '/' || tests.id(p_proc) || '/uploads/' || tests.request_id(p_person, p_doc_key) || '/' || p_file
$$;

-- Cria um objeto no Storage (só a linha; não há ficheiro real nos testes).
create function tests.put_object(p_path text, p_mime text default 'application/pdf', p_size int default 1000)
returns void
language sql as $$
  insert into storage.objects (bucket_id, name, metadata)
  values ('documents', p_path, jsonb_build_object('mimetype', p_mime, 'size', p_size))
$$;

-- Cenário base:
--   org_x: staff_x, client_a (processo proc_a: titular + cônjuge, proposta enviada, pagamento,
--          documentos, prazo, interno), client_b (proc_b: proposta em rascunho), partner_p
--          (atribuído a proc_a; papel desligado por omissão).
--   org_y: staff_y, client_c (proc_c).
create function tests.seed_fixtures() returns void
language plpgsql as $$
declare
  v_x uuid := tests.id('org_x');
  v_y uuid := tests.id('org_y');
  v_type_licence uuid;
  v_type_passport uuid;
  v_req_passport uuid;
begin
  insert into public.organizations (id, name, slug, hostnames, email_from_name, email_from_address,
    team_notification_email, proposal_ref_prefix)
  values
    (v_x, 'Organização X (teste)', 'org-x', '{x.exemplo.test}', 'Org X', 'hello@x.exemplo.test', 'equipa@x.exemplo.test', 'TSX'),
    (v_y, 'Organização Y (teste)', 'org-y', '{y.exemplo.test}', 'Org Y', 'hello@y.exemplo.test', 'equipa@y.exemplo.test', 'TSY');

  perform tests.create_user(u) from unnest(array[
    'staff_x', 'staff_y', 'client_a', 'client_b', 'client_c', 'partner_p', 'outsider'
  ]) u;

  insert into public.partners (id, organization_id, name) values (tests.id('partner'), v_x, 'Parceiro Exemplo');

  insert into public.clients (id, organization_id, full_name, email, phone, country) values
    (tests.id('client_a'), v_x, 'Rui Fictício', 'client_a@exemplo.test', '+351 900 000 001', 'Portugal'),
    (tests.id('client_b'), v_x, 'Marta Exemplo', 'client_b@exemplo.test', '+351 900 000 002', 'Portugal'),
    (tests.id('client_c'), v_y, 'Carlos Teste', 'client_c@exemplo.test', '+244 900 000 003', 'Angola');

  insert into public.memberships (user_id, organization_id, role, client_id, partner_id, display_name) values
    (tests.id('staff_x'), v_x, 'admin', null, null, 'Admin X'),
    (tests.id('staff_y'), v_y, 'admin', null, null, 'Admin Y'),
    (tests.id('client_a'), v_x, 'client', tests.id('client_a'), null, null),
    (tests.id('client_b'), v_x, 'client', tests.id('client_b'), null, null),
    (tests.id('client_c'), v_y, 'client', tests.id('client_c'), null, null),
    (tests.id('partner_p'), v_x, 'partner', null, tests.id('partner'), null);

  insert into public.bank_accounts (id, organization_id, label, beneficiary, bank_name, iban) values
    (tests.id('bank_x'), v_x, 'Conta AED', 'Beneficiário Exemplo', 'Banco Exemplo', 'AE000000000000000000001');

  insert into public.processes (id, organization_id, client_id, bank_account_id) values
    (tests.id('proc_a'), v_x, tests.id('client_a'), tests.id('bank_x')),
    (tests.id('proc_b'), v_x, tests.id('client_b'), null),
    (tests.id('proc_c'), v_y, tests.id('client_c'), null);

  insert into public.people (id, organization_id, process_id, relationship, full_name, nationality) values
    (tests.id('person_a_holder'), v_x, tests.id('proc_a'), 'holder', 'Rui Fictício', 'Portuguesa'),
    (tests.id('person_a_spouse'), v_x, tests.id('proc_a'), 'spouse', 'Ana Fictícia', 'Portuguesa'),
    (tests.id('person_b_holder'), v_x, tests.id('proc_b'), 'holder', 'Marta Exemplo', 'Portuguesa'),
    (tests.id('person_c_holder'), v_y, tests.id('proc_c'), 'holder', 'Carlos Teste', 'Angolana');

  insert into public.proposals (id, organization_id, process_id, reference, pdf_path, plans, valid_until, status) values
    (tests.id('proposal_a'), v_x, tests.id('proc_a'), 'TSX-2026-001',
      v_x || '/' || tests.id('proc_a') || '/proposals/a.pdf',
      '[{"name": "Essencial", "price_aed": 25000, "includes_bank_account": false},
        {"name": "Completo", "price_aed": 32000, "includes_bank_account": true}]',
      current_date + 30, 'sent'),
    (tests.id('proposal_b'), v_x, tests.id('proc_b'), 'TSX-2026-002', null, '[]', null, 'draft'),
    (tests.id('proposal_c'), v_y, tests.id('proc_c'), 'TSY-2026-001',
      v_y || '/' || tests.id('proc_c') || '/proposals/c.pdf',
      '[{"name": "Base", "price_aed": 20000}]', current_date + 30, 'sent');

  insert into public.payments (id, organization_id, process_id, description, amount_aed) values
    (tests.id('payment_a'), v_x, tests.id('proc_a'), 'Pagamento único', 32000),
    (tests.id('payment_c'), v_y, tests.id('proc_c'), 'Pagamento único', 20000);

  select id into v_type_licence from public.document_types
  where organization_id = v_x and key = 'trade_licence' and direction = 'issued';
  select id into v_type_passport from public.document_types
  where organization_id = v_x and key = 'passport' and direction = 'upload';
  select id into v_req_passport from public.document_requests
  where process_id = tests.id('proc_a') and person_id = tests.id('person_a_holder') and document_type_id = v_type_passport;

  perform tests.put_object(v_x || '/' || tests.id('proc_a') || '/issued/licence.pdf');
  perform tests.put_object(v_x || '/' || tests.id('proc_a') || '/uploads/' || v_req_passport || '/passport.pdf');

  insert into public.documents (id, organization_id, process_id, person_id, request_id, document_type_id, direction,
    storage_path, file_name, mime_type, size_bytes, issued_on, expires_on, shared_with_partner) values
    (tests.id('doc_a_licence'), v_x, tests.id('proc_a'), null, null, v_type_licence, 'issued',
      v_x || '/' || tests.id('proc_a') || '/issued/licence.pdf', 'licenca.pdf', 'application/pdf', 1000,
      current_date, current_date + 365, true),
    (tests.id('doc_a_passport'), v_x, tests.id('proc_a'), tests.id('person_a_holder'), v_req_passport, v_type_passport, 'upload',
      v_x || '/' || tests.id('proc_a') || '/uploads/' || v_req_passport || '/passport.pdf', 'passaporte.pdf', 'application/pdf', 1000,
      null, null, false);

  update public.process_internal
  set partner_id = tests.id('partner'), partner_cost_aed = 18000, sale_price_aed = 32000,
      other_costs = '[{"label": "Taxas", "amount_aed": 1500}]', invoice_issuer = 'Entidade Emissora Exemplo'
  where process_id = tests.id('proc_a');

  insert into public.internal_notes (organization_id, process_id, author_id, body)
  values (v_x, tests.id('proc_a'), tests.id('staff_x'), 'Nota interna de teste.');

  insert into public.partner_assignments (organization_id, partner_id, process_id, assigned_by)
  values (v_x, tests.id('partner'), tests.id('proc_a'), tests.id('staff_x'));

  update public.privacy_notices set published_at = now() where organization_id in (v_x, v_y);
end
$$;

grant execute on all functions in schema tests to anon, authenticated;

begin;
select plan(1);
select ok(to_regprocedure('tests.seed_fixtures()') is not null, 'funções de teste instaladas');
select * from finish();
rollback;

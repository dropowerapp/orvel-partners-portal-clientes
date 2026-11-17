-- Etapa 3: funções do painel da equipa (novo processo e referência de proposta).
begin;
select no_plan();
select tests.seed_fixtures();

-- Sem MFA, cliente ou de outra organização: recusado ---------------------------------------------
select tests.login('staff_x', 'aal1');
select throws_ok(
  $$ select public.create_client_process(tests.id('org_x'), '{"full_name": "Nova Pessoa", "email": "nova@exemplo.test"}') $$,
  'P0002', 'not_found', 'equipa sem MFA não cria processos');
select throws_ok($$ select public.next_proposal_reference(tests.id('org_x')) $$, 'P0002', 'not_found',
  'equipa sem MFA não pede referências');

select tests.login('client_a', 'aal2');
select throws_ok(
  $$ select public.create_client_process(tests.id('org_x'), '{"full_name": "Nova Pessoa", "email": "nova@exemplo.test"}') $$,
  'P0002', 'not_found', 'cliente não cria processos');

select tests.login('staff_y', 'aal2');
select throws_ok(
  $$ select public.create_client_process(tests.id('org_x'), '{"full_name": "Nova Pessoa", "email": "nova@exemplo.test"}') $$,
  'P0002', 'not_found', 'equipa de outra organização não cria processos aqui');
select throws_ok(
  $$ select public.create_client_process(tests.id('org_y'), jsonb_build_object('id', tests.id('client_a'))) $$,
  'P0002', 'not_found', 'não usa clientes de outra organização');

-- Cliente novo ---------------------------------------------------------------------------------
select tests.login('staff_x', 'aal2');
-- (linha indentada de propósito: o db-test.sh remoto só reescreve os "select" do início da linha)
create temporary table _new on commit drop as
  select public.create_client_process(
  tests.id('org_x'),
  '{"full_name": "  Nova Pessoa  ", "email": " Nova@Exemplo.Test ", "phone": "+351 900 000 009",
    "country": "Portugal", "nationality": "Portuguesa", "date_of_birth": "1990-05-01"}',
  '{"plan_name": "Essencial", "includes_bank_account": true, "free_zone": "Zona Exemplo", "visa_count": 2}',
  '[{"relationship": "spouse", "full_name": "Cônjuge Exemplo"},
    {"relationship": "child", "full_name": "Filho Exemplo", "date_of_birth": "2015-02-03"}]'
  ) as process_id;

select is((select c.email from public.clients c join public.processes p on p.client_id = c.id where p.id = (select process_id from _new)),
  'nova@exemplo.test', 'email do cliente guardado em minúsculas e sem espaços');
select is((select c.full_name from public.clients c join public.processes p on p.client_id = c.id where p.id = (select process_id from _new)),
  'Nova Pessoa', 'nome do cliente sem espaços a mais');
select is((select c.locale from public.clients c join public.processes p on p.client_id = c.id where p.id = (select process_id from _new)),
  'pt-PT', 'idioma por omissão da organização');
select results_eq(
  $$ select status::text, plan_name, includes_bank_account, free_zone, visa_count::int
     from public.processes where id = (select process_id from _new) $$,
  $$ values ('new', 'Essencial', true, 'Zona Exemplo', 2) $$,
  'processo criado com os dados indicados e estado "new"');
select results_eq(
  $$ select relationship::text, full_name, position::int from public.people
     where process_id = (select process_id from _new) order by position $$,
  $$ values ('holder', 'Nova Pessoa', 0), ('spouse', 'Cônjuge Exemplo', 1), ('child', 'Filho Exemplo', 2) $$,
  'titular (com o nome do cliente) e restantes pessoas, por ordem');
select is((select date_of_birth from public.people where process_id = (select process_id from _new) and relationship = 'holder'),
  '1990-05-01'::date, 'data de nascimento do titular');
select ok((select count(*) from public.document_requests where process_id = (select process_id from _new)) > 0,
  'pedidos de documentos criados a partir dos modelos');
select ok((select count(*) from public.timeline_steps where process_id = (select process_id from _new)) > 0,
  'cronologia criada a partir do modelo');
select ok(exists (select 1 from public.process_internal where process_id = (select process_id from _new)),
  'dados internos do processo criados');

select throws_ok(
  $$ select public.create_client_process(tests.id('org_x'), '{"full_name": "Outra", "email": "NOVA@exemplo.test"}') $$,
  'P0001', 'client_email_taken', 'email já usado por outro cliente da organização');
select throws_ok(
  $$ select public.create_client_process(tests.id('org_x'), '{"full_name": "Outra", "email": "outra@exemplo.test"}',
       '{}', '[{"relationship": "holder", "full_name": "Segundo titular"}]') $$,
  '22023', 'invalid_input', 'só pode haver um titular');
select is((select count(*)::int from public.clients where email = 'outra@exemplo.test'), 0,
  'um erro não deixa nada a meio (cliente não fica criado)');

-- Cliente existente ------------------------------------------------------------------------------
select lives_ok(
  $$ select public.create_client_process(tests.id('org_x'), jsonb_build_object('id', tests.id('client_b'), 'email', 'ignorado@exemplo.test')) $$,
  'novo processo para um cliente que já existe');
select is((select count(*)::int from public.processes where client_id = tests.id('client_b')), 2,
  'o cliente fica com mais um processo');
select is((select email from public.clients where id = tests.id('client_b')), 'client_b@exemplo.test',
  'os dados do cliente existente não mudam');

-- Referência da proposta ---------------------------------------------------------------------------
select is(public.next_proposal_reference(tests.id('org_x')),
  'TSX-' || to_char(now() at time zone 'Asia/Dubai', 'YYYY') || '-'
    || case when to_char(now() at time zone 'Asia/Dubai', 'YYYY') = '2026' then '003' else '001' end,
  'próxima referência: prefixo, ano e número seguinte');

select tests.login('staff_y', 'aal2');
select is(public.next_proposal_reference(tests.id('org_y')),
  'TSY-' || to_char(now() at time zone 'Asia/Dubai', 'YYYY') || '-'
    || case when to_char(now() at time zone 'Asia/Dubai', 'YYYY') = '2026' then '002' else '001' end,
  'cada organização tem a sua numeração');

select tests.logout();
select * from finish();
rollback;

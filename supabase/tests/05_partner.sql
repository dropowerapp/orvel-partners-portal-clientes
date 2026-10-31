-- Parceiro: desligado não vê nada; ligado vê só o atribuído, sem internos, pagamentos nem contactos.
begin;
select no_plan();
select tests.seed_fixtures();

-- Papel desligado (por omissão)
select tests.login('partner_p', 'aal2');
select is_empty($$ select 1 from public.processes $$, 'desligado: não vê processos');
select is_empty($$ select 1 from public.people $$, 'desligado: não vê pessoas');
select is_empty($$ select 1 from public.documents $$, 'desligado: não vê documentos');
select is_empty($$ select 1 from public.document_types $$, 'desligado: não vê catálogos');

-- Ligar o papel
select tests.logout();
update public.organizations set partner_role_enabled = true where id = tests.id('org_x');

select tests.login('partner_p', 'aal2');
select results_eq($$ select id from public.processes $$, array[tests.id('proc_a')], 'ligado: vê só o processo atribuído');
select is((select count(*) from public.people)::int, 2, 'vê as pessoas do processo atribuído');
select ok((select count(*) from public.timeline_steps) > 0, 'vê a cronologia');
select ok((select count(*) from public.document_requests) > 0, 'vê os pedidos de documentos');
select results_eq($$ select id from public.documents $$, array[tests.id('doc_a_licence')],
  'vê só os documentos marcados para partilhar (não o passaporte)');

select is_empty($$ select 1 from public.process_internal $$, 'não lê process_internal');
select is_empty($$ select 1 from public.internal_notes $$, 'não lê notas internas');
select is_empty($$ select 1 from public.payments $$, 'não lê pagamentos');
select is_empty($$ select 1 from public.bank_accounts $$, 'não lê dados bancários');
select is_empty($$ select 1 from public.proposals $$, 'não lê propostas');
select is_empty($$ select 1 from public.clients $$, 'não lê clientes nem contactos');
select is_empty($$ select 1 from public.deadlines $$, 'não lê prazos');
select is_empty($$ select 1 from public.activity_log $$, 'não lê atividade');
select is_empty($$ select 1 from public.partners $$, 'não lê a tabela de parceiros');
select is_empty($$ select 1 from public.processes where id = tests.id('proc_b') $$, 'não vê processos não atribuídos');
select is(tests.affected($$ update public.documents set shared_with_partner = true $$), 0, 'não altera documentos');
select throws_ok($$ select public.accept_proposal(tests.id('proposal_a'), 'Completo') $$, 'P0002', 'not_found',
  'não usa funções de cliente');

-- Ligado mas sem MFA
select tests.login('partner_p', 'aal1');
select is_empty($$ select 1 from public.processes $$, 'parceiro sem MFA não vê nada');

select * from finish();
rollback;

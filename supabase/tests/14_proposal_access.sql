-- Entrada pelo portal: proposta antes de aceitar; acompanhamento só do processo aceite.
begin;
select no_plan();
select tests.seed_fixtures();

-- Segundo processo do mesmo cliente, para impedir uma autorização global por cliente.
insert into public.processes (id, organization_id, client_id, company_name_options, plan_name)
values (tests.id('proc_a_second'), tests.id('org_x'), tests.id('client_a'), array['Nome ainda reservado'], 'Interno não aceite');
insert into public.proposals (id, organization_id, process_id, reference, pdf_path, plans, valid_until, status)
values (tests.id('proposal_a_second'), tests.id('org_x'), tests.id('proc_a_second'), 'TSX-2026-003',
  tests.id('org_x') || '/' || tests.id('proc_a_second') || '/proposals/second.pdf',
  '[{"name":"Base","price_aed":1000}]', current_date + 30, 'sent');
update public.processes set company_name_options = array['Nome reservado'], plan_name = 'Plano interno'
where id = tests.id('proc_a');

select tests.login('client_a');
select is((select count(*) from public.get_client_processes(tests.id('org_x')))::int, 2, 'lista inicial inclui os dois processos próprios');
select is_empty($$ select 1 from public.get_client_processes(tests.id('org_y')) $$, 'RPC não lê outra organização');
select ok((select bool_and(not proposal_accepted) from public.get_client_processes(tests.id('org_x'))), 'ambos aguardam aceitação');
select ok((select bool_and(plan_name is null and company_name_options = '{}'::text[] and bank_account_id is null
  and not includes_bank_account and bank_details_released_at is null) from public.get_client_processes(tests.id('org_x'))),
  'lista prévia não expõe plano interno, nomes de empresa ou dados bancários');
select is((select count(*) from public.proposals)::int, 2, 'pode consultar as suas propostas enviadas e respetivos caminhos PDF');
select is_empty($$ select 1 from public.proposals where id in (tests.id('proposal_b'), tests.id('proposal_c')) $$, 'não lê propostas alheias');
select is_empty($$ select 1 from public.processes $$, 'tabela processes bloqueada antes de aceitar');
select is_empty($$ select 1 from public.clients $$, 'ficha de cliente bloqueada antes de aceitar');
select is_empty($$ select 1 from public.people $$, 'pessoas bloqueadas antes de aceitar');
select is_empty($$ select 1 from public.payments $$, 'pagamentos bloqueados antes de aceitar');
select is_empty($$ select 1 from public.documents $$, 'ficheiros não podem ser selecionados para download');
select is_empty($$ select 1 from public.document_requests $$, 'pedidos de documentos bloqueados');
select is_empty($$ select 1 from public.timeline_steps $$, 'cronologia bloqueada');
select is_empty($$ select 1 from public.deadlines $$, 'prazos bloqueados');
select is_empty($$ select 1 from public.bank_accounts $$, 'dados bancários bloqueados');
select throws_ok($$ select public.set_company_names(tests.id('proc_a'), array['Forjado']) $$, 'P0002', 'not_found', 'não altera nomes antes de aceitar');
select throws_ok($$ select public.save_person(tests.id('proc_a'), null, 'child', 'Fictício', null, null) $$,
  'P0002', 'not_found', 'não cria pessoas antes de aceitar');
select throws_ok($$ select public.update_my_details(tests.id('client_a'), 'Fictício', null, null, null, null, null, null) $$,
  'P0002', 'not_found', 'não altera a ficha antes de aceitar');
select throws_ok($$ select public.register_upload(tests.request_id('person_a_spouse', 'passport'),
  tests.upload_path('org_x', 'proc_a', 'person_a_spouse', 'passport'), 'f.pdf') $$,
  'P0002', 'not_found', 'registo de upload bloqueado');
select throws_ok($$ select tests.put_object(tests.upload_path('org_x', 'proc_a', 'person_a_spouse', 'passport')) $$,
  '42501', null, 'Storage recusa o upload antes de aceitar');
select is(tests.affected($$ update public.proposals set status = 'accepted' where id = tests.id('proposal_a') $$), 0,
  'escrita direta não desbloqueia o acompanhamento');
select throws_ok($$ select public.accept_proposal(tests.id('proposal_c'), 'Base') $$,
  'P0002', 'not_found', 'não aceita proposta de outro cliente');
select ok(public.get_acceptance_text(tests.id('proposal_a'), 'Completo') like '%TSX-2026-001%',
  'pode ler o texto exato antes de aceitar');
select lives_ok($$ select public.accept_proposal(tests.id('proposal_a'), 'Completo', 'Teste portal') $$,
  'aceita a proposta dentro do portal sem acesso prévio ao acompanhamento');
select ok((select proposal_accepted from public.get_client_processes(tests.id('org_x')) where id = tests.id('proc_a')),
  'RPC desbloqueia imediatamente o processo aceite');
select ok(not (select proposal_accepted from public.get_client_processes(tests.id('org_x')) where id = tests.id('proc_a_second')),
  'segundo processo continua por aceitar');
select results_eq($$ select id from public.processes $$, array[tests.id('proc_a')], 'só o processo aceite fica legível');
select is((select count(*) from public.documents)::int, 2, 'documentos disponíveis após aceitação, mesmo por pagar');
select isnt_empty($$ select 1 from public.people $$, 'pessoas disponíveis após aceitação');
select isnt_empty($$ select 1 from public.timeline_steps $$, 'cronologia disponível após aceitação');
select isnt_empty($$ select 1 from public.deadlines $$, 'prazos disponíveis após aceitação');
select is((select status::text from public.payments where id = tests.id('payment_a')), 'pending', 'pagamento não é requisito de acesso');
select is_empty($$ select 1 from public.bank_accounts $$, 'dados bancários ainda exigem libertação pela equipa');
select lives_ok($$ select tests.put_object(tests.upload_path('org_x', 'proc_a', 'person_a_spouse', 'passport')) $$,
  'Storage permite o pedido pendente depois da aceitação');
select throws_ok($$ select public.set_company_names(tests.id('proc_a_second'), array['Forjado']) $$,
  'P0002', 'not_found', 'aceitar um processo não permite alterar o segundo');
select is_empty($$ select 1 from public.timeline_steps where process_id = tests.id('proc_a_second') $$,
  'segundo processo não expõe cronologia');
select throws_ok($$ select public.accept_proposal(tests.id('proposal_a'), 'Completo') $$,
  'P0001', 'proposal_not_open', 'não aceita a mesma proposta duas vezes');

-- Propostas expiradas, recusadas ou com processo encerrado não abrem a área completa.
select tests.logout();
update public.proposals set valid_until = current_date - 2 where id = tests.id('proposal_a_second');
select tests.login('client_a');
select throws_ok($$ select public.accept_proposal(tests.id('proposal_a_second'), 'Base') $$,
  'P0001', 'proposal_expired', 'proposta expirada não abre o processo');
select tests.logout();
update public.proposals set status = 'declined', valid_until = current_date + 30 where id = tests.id('proposal_a_second');
select tests.login('client_a');
select throws_ok($$ select public.accept_proposal(tests.id('proposal_a_second'), 'Base') $$,
  'P0001', 'proposal_not_open', 'proposta recusada não abre o processo');
select tests.logout();
update public.proposals set status = 'sent' where id = tests.id('proposal_a_second');
update public.processes set cancelled_at = now() where id = tests.id('proc_a_second');
select tests.login('client_a');
select throws_ok($$ select public.accept_proposal(tests.id('proposal_a_second'), 'Base') $$,
  'P0001', 'process_closed', 'processo cancelado não aceita proposta');

-- Aviso/filiação continuam a ser condições obrigatórias, mesmo depois da aceitação.
select tests.logout();
delete from public.privacy_consents where user_id = tests.id('client_a');
select tests.login('client_a');
select is_empty($$ select 1 from public.get_client_processes(tests.id('org_x')) $$, 'sem confirmação do aviso não devolve nem lista inicial');
select is_empty($$ select 1 from public.proposals $$, 'sem confirmação não devolve propostas');
select is_empty($$ select 1 from public.documents $$, 'sem confirmação não devolve documentos do processo aceite');
select throws_ok($$ select public.get_acceptance_text(tests.id('proposal_a_second'), 'Base') $$,
  'P0002', 'not_found', 'RPC de texto respeita o aviso');
select lives_ok($$ select public.accept_privacy_notice((public.get_session_context(tests.id('org_x'))->'notice'->>'id')::uuid) $$,
  'pode confirmar novamente o aviso');
select tests.logout();
update public.memberships set is_active = false where user_id = tests.id('client_a');
select tests.login('client_a');
select is_empty($$ select 1 from public.get_client_processes(tests.id('org_x')) $$, 'filiação desativada não usa a RPC');
select is_empty($$ select 1 from public.proposals $$, 'filiação desativada não consulta propostas');
select is_empty($$ select 1 from public.documents $$, 'filiação desativada não consulta documentos');
select tests.login('client_b');
select is_empty($$ select 1 from public.proposals $$, 'rascunho permanece invisível');
select throws_ok($$ select public.accept_proposal(tests.id('proposal_b'), 'Base') $$, 'P0002', 'not_found', 'não aceita rascunho');
select tests.login('outsider');
select is_empty($$ select 1 from public.get_client_processes(tests.id('org_x')) $$, 'utilizador sem filiação não obtém lista');
select tests.login('staff_x', 'aal2');
select is_empty($$ select 1 from public.get_client_processes(tests.id('org_x')) $$, 'RPC não confunde equipa com cliente');
select is((select count(*) from public.processes)::int, 3, 'admin com MFA continua a ver todos os processos da organização');
select tests.login_anon();
select throws_ok($$ select 1 from public.get_client_processes(tests.id('org_x')) $$, '42501', null, 'anónimo não pode executar a RPC');
select throws_ok($$ select private.client_portal_process_ids() $$, '42501', null, 'anónimo não pode executar o auxiliar');
select tests.logout();
select is((select count(*) from private.document_purge_jobs)::int, 0, 'o novo percurso não agenda eliminação');
select * from finish();
rollback;

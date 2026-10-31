-- Cliente A não vê nada do cliente B nem de outra organização; nenhum cliente lê dados internos.
begin;
select no_plan();
select tests.seed_fixtures();

select tests.login('client_a');

-- O que é dele
select results_eq($$ select id from public.clients $$, array[tests.id('client_a')], 'cliente A vê só a sua ficha');
select results_eq($$ select id from public.processes $$, array[tests.id('proc_a')], 'cliente A vê só o seu processo');
select is((select count(*) from public.people)::int, 2, 'cliente A vê as 2 pessoas do seu processo');
select results_eq($$ select id from public.proposals $$, array[tests.id('proposal_a')], 'cliente A vê só a sua proposta');
select results_eq($$ select id from public.payments $$, array[tests.id('payment_a')], 'cliente A vê só o seu pagamento');
select ok((select count(*) from public.timeline_steps) > 0, 'cliente A vê a sua cronologia');
select ok((select bool_and(process_id = tests.id('proc_a')) from public.timeline_steps), 'cronologia só do processo A');
select ok((select bool_and(process_id = tests.id('proc_a')) from public.document_requests), 'pedidos só do processo A');
select is((select count(*) from public.documents)::int, 2, 'cliente A vê os seus 2 documentos');
select is((select count(*) from public.deadlines)::int, 1, 'cliente A vê o prazo criado pela licença');
select results_eq($$ select user_id from public.memberships $$, array[tests.id('client_a')], 'cliente A vê só a sua filiação');

-- Nada do cliente B nem da organização Y
select is_empty($$ select 1 from public.clients where id <> tests.id('client_a') $$, 'não vê outros clientes');
select is_empty($$ select 1 from public.processes where id in (tests.id('proc_b'), tests.id('proc_c')) $$, 'não vê processos de B nem de C');
select is_empty($$ select 1 from public.people where process_id <> tests.id('proc_a') $$, 'não vê pessoas de outros processos');
select is_empty($$ select 1 from public.payments where process_id <> tests.id('proc_a') $$, 'não vê pagamentos de outros');
select is_empty($$ select 1 from public.organizations $$, 'não lê a tabela organizations (só a marca pública por RPC)');

-- Dados internos e de sistema
select is_empty($$ select 1 from public.process_internal $$, 'não lê process_internal (custos, margem, emissor)');
select is_empty($$ select 1 from public.internal_notes $$, 'não lê notas internas');
select is_empty($$ select 1 from public.partners $$, 'não lê parceiros');
select is_empty($$ select 1 from public.partner_assignments $$, 'não lê atribuições de parceiro');
select is_empty($$ select 1 from public.activity_log $$, 'não lê o registo de atividade');
select is_empty($$ select 1 from public.email_outbox $$, 'não lê a fila de emails');
select is_empty($$ select 1 from public.timeline_templates $$, 'não lê modelos de cronologia');
select is_empty($$ select 1 from public.privacy_consents where user_id <> tests.id('client_a') $$, 'não vê consentimentos de outros');

-- Dados bancários: só depois de aceitar e de a equipa libertar
select is_empty($$ select 1 from public.bank_accounts $$, 'dados bancários escondidos antes da aceitação');
select lives_ok($$ select public.accept_proposal(tests.id('proposal_a'), 'Completo', 'teste') $$, 'cliente A aceita a proposta');
select is_empty($$ select 1 from public.bank_accounts $$, 'aceite mas não libertado: continuam escondidos');
select tests.logout();
select tests.login('staff_x', 'aal2');
update public.processes set bank_details_released_at = now() where id = tests.id('proc_a');
select tests.login('client_a');
select results_eq($$ select id from public.bank_accounts $$, array[tests.id('bank_x')], 'depois de libertados, o cliente vê os dados bancários');
select tests.login('client_b');
select is_empty($$ select 1 from public.bank_accounts $$, 'cliente B continua sem ver dados bancários');

-- Cliente B: proposta em rascunho invisível
select is_empty($$ select 1 from public.proposals $$, 'cliente B não vê a proposta em rascunho');

-- Documentos apagados pela limpeza deixam de aparecer
select tests.logout();
update public.documents set purged_at = now(), purged_reason = 'retention' where id = tests.id('doc_a_passport');
select tests.login('client_a');
select is_empty($$ select 1 from public.documents where id = tests.id('doc_a_passport') $$, 'documento apagado não aparece');

-- Documento emitido escondido ao cliente
select tests.logout();
update public.documents set visible_to_client = false where id = tests.id('doc_a_licence');
select tests.login('client_a');
select is_empty($$ select 1 from public.documents where id = tests.id('doc_a_licence') $$, 'documento emitido não visível fica escondido');

-- Funções do cliente sobre dados de outro cliente
select throws_ok($$ select public.set_company_names(tests.id('proc_b'), array['Empresa X']) $$, 'P0002', 'not_found', 'não altera nomes da empresa de B');
select throws_ok($$ select public.save_person(tests.id('proc_c'), null, 'child', 'Intruso', null, null) $$, 'P0002', 'not_found', 'não acrescenta pessoas ao processo de C');
select throws_ok($$ select public.update_my_details(tests.id('client_b'), 'X', null, null, null, null, null, null) $$, 'P0002', 'not_found', 'não altera dados de B');
select throws_ok($$ select public.accept_proposal(tests.id('proposal_c'), 'Base') $$, 'P0002', 'not_found', 'não aceita a proposta de C');
select throws_ok($$ select public.get_acceptance_text(tests.id('proposal_c'), 'Base') $$, 'P0002', 'not_found', 'não lê o texto de aceitação de C');

-- Utilizador sem filiação e anónimo
select tests.login('outsider');
select is_empty($$ select 1 from public.processes $$, 'utilizador sem filiação não vê processos');
select is_empty($$ select 1 from public.documents $$, 'utilizador sem filiação não vê documentos');
select tests.login_anon();
select throws_ok($$ select 1 from public.processes $$, '42501', null, 'anónimo nem tem permissão para consultar');
select ok(public.get_org_public('x.exemplo.test') ->> 'name' = 'Organização X (teste)', 'anónimo lê a marca pública pelo hostname');
select ok(public.get_org_public('x.exemplo.test') -> 'team_notification_email' is null, 'a marca pública não expõe configuração interna');

select * from finish();
rollback;

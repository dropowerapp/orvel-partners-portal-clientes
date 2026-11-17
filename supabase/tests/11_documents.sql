begin;
select no_plan();
select tests.seed_fixtures();

create temporary table doc_case as select
 tests.request_id('person_a_spouse', 'passport') as request_id,
 tests.upload_path('org_x', 'proc_a', 'person_a_spouse', 'passport', 'first.pdf') as first_path,
 tests.upload_path('org_x', 'proc_a', 'person_a_spouse', 'passport', 'second.pdf') as second_path,
 (select id from public.document_types where organization_id = tests.id('org_x') and key = 'passport' and direction = 'upload') as upload_type,
 (select id from public.document_types where organization_id = tests.id('org_x') and key = 'trade_licence' and direction = 'issued') as issued_type,
 tests.id('org_x') || '/' || tests.id('proc_a') || '/issued/new.pdf' as issued_path;
grant select on doc_case to authenticated;
select tests.put_object(first_path) from doc_case;
select tests.put_object(second_path) from doc_case;
select tests.put_object(issued_path) from doc_case;

select tests.login('staff_x', 'aal1');
select throws_ok($$ select public.create_document_request(tests.id('proc_a'), tests.id('person_a_holder'), upload_type) from doc_case $$,
 'P0002', 'not_found', 'equipa sem MFA não cria pedidos');
select throws_ok($$ select public.register_issued_document(tests.id('proc_a'), issued_type, issued_path, 'f.pdf') from doc_case $$,
 'P0002', 'not_found', 'equipa sem MFA não regista emitidos');
select tests.login('staff_y', 'aal2');
select throws_ok($$ select public.remove_document_request(request_id) from doc_case $$,
 'P0002', 'not_found', 'outra organização não remove pedidos');
select throws_ok($$ select public.review_document_request(request_id, tests.id('doc_a_passport'), 'approved') from doc_case $$,
 'P0002', 'not_found', 'outra organização não revê pedidos');

select tests.login('client_a');
select throws_ok($$ select public.create_document_request(tests.id('proc_a'), tests.id('person_a_holder'), upload_type) from doc_case $$,
 'P0002', 'not_found', 'cliente não cria pedidos');
select throws_ok($$ select public.review_document_request(request_id, tests.id('doc_a_passport'), 'approved') from doc_case $$,
 'P0002', 'not_found', 'cliente não aprova os próprios documentos');
select lives_ok($$ select public.register_upload(request_id, first_path, 'passaporte.pdf') from doc_case $$,
 'cliente regista o ficheiro enviado');
select lives_ok($$ select public.register_upload(request_id, first_path, 'passaporte.pdf') from doc_case $$,
 'repetir a confirmação após falha de rede é seguro');
select is((select count(*)::int from public.documents where storage_path = (select first_path from doc_case)), 1,
 'a repetição não duplica o documento');
select throws_ok($$ select public.register_upload(request_id, second_path, 'outro.pdf') from doc_case $$,
 'P0001', 'request_not_open', 'um pedido em análise não aceita outro ficheiro');
select tests.login('client_b');
select throws_ok($$ select public.register_upload(request_id, first_path, 'f.pdf') from doc_case $$,
 'P0002', 'not_found', 'a repetição não contorna o isolamento entre clientes');

select tests.login('staff_x', 'aal2');
select throws_ok($$ select public.review_document_request(request_id, (select id from public.documents where storage_path = first_path), 'rejected', '   ') from doc_case $$,
 'P0001', 'rejection_reason_required', 'rejeitar exige um motivo');
select throws_ok($$ select public.review_document_request(request_id, tests.id('doc_a_passport'), 'approved') from doc_case $$,
 'P0001', 'document_review_conflict', 'não é possível aprovar o ficheiro errado');
select lives_ok($$ select public.review_document_request(request_id, (select id from public.documents where storage_path = first_path), 'rejected', 'Envie todas as páginas.') from doc_case $$,
 'equipa rejeita indicando a correção');
select is((select reviewed_by from public.document_requests where id = (select request_id from doc_case)), tests.id('staff_x'),
 'revisão regista o autor');
select throws_ok($$ select public.remove_document_request(request_id) from doc_case $$,
 'P0001', 'document_request_has_files', 'pedido com histórico não pode ser removido');

select tests.login('client_a');
select lives_ok($$ select public.register_upload(request_id, second_path, 'corrigido.pdf') from doc_case $$,
 'cliente reenvia depois da rejeição');
select is((select rejection_reason from public.document_requests where id = (select request_id from doc_case)), null::text,
 'novo envio limpa o motivo anterior');
select is((select status::text from public.document_requests where id = (select request_id from doc_case)), 'submitted',
 'novo envio volta à análise');
select tests.logout();
update public.documents set created_at = now() - interval '1 hour' where storage_path = (select first_path from doc_case);
select tests.login('staff_x', 'aal2');
select throws_ok($$ select public.review_document_request(request_id, (select id from public.documents where storage_path = first_path), 'approved') from doc_case $$,
 'P0001', 'document_review_conflict', 'um ecrã desatualizado não aprova a versão antiga');
select lives_ok($$ select public.review_document_request(request_id, (select id from public.documents where storage_path = second_path), 'approved') from doc_case $$,
 'equipa aprova a versão corrigida');
select throws_ok($$ select public.create_document_request(tests.id('proc_a'), tests.id('person_c_holder'), upload_type) from doc_case $$,
 'P0002', 'not_found', 'pedido não pode apontar para uma pessoa de outro processo');
select throws_ok($$ select public.create_document_request(tests.id('proc_a'), tests.id('person_a_holder'), issued_type) from doc_case $$,
 'P0001', 'document_type_invalid', 'tipo emitido não pode ser pedido ao cliente');
select lives_ok($$ select public.remove_document_request(public.create_document_request(tests.id('proc_a'), tests.id('person_a_holder'), upload_type, 'Documento adicional')) from doc_case $$,
 'equipa cria e remove um pedido vazio');

select throws_ok($$ select public.register_issued_document(tests.id('proc_a'), upload_type, issued_path, 'f.pdf') from doc_case $$,
 'P0001', 'document_type_invalid', 'tipo de upload não serve para um emitido');
select throws_ok($$ select public.register_issued_document(tests.id('proc_a'), issued_type, first_path, 'f.pdf') from doc_case $$,
 'P0001', 'document_path_invalid', 'emitido tem de pertencer à pasta correta');
select throws_ok($$ select public.register_issued_document(tests.id('proc_a'), issued_type, issued_path, 'f.pdf', p_issued_on := current_date, p_expires_on := current_date - 1) from doc_case $$,
 'P0001', 'document_dates_invalid', 'validade não pode anteceder a emissão');
select lives_ok($$ select public.register_issued_document(tests.id('proc_a'), issued_type, issued_path, 'licenca.pdf', p_expires_on := current_date + 365, p_visible := false) from doc_case $$,
 'equipa regista emitido só para a equipa');
select lives_ok($$ select public.register_issued_document(tests.id('proc_a'), issued_type, issued_path, 'licenca.pdf') from doc_case $$,
 'registo de emitido também é idempotente');
select is((select count(*)::int from public.documents where storage_path = (select issued_path from doc_case)), 1,
 'repetição não duplica o emitido');
select is((select count(*)::int from public.deadlines where document_id = (select id from public.documents where storage_path = (select issued_path from doc_case))), 1,
 'emitido com validade cria prazo');
select tests.login('client_a');
select is_empty($$ select id from public.documents where storage_path = (select issued_path from doc_case) $$,
 'cliente não vê emitido marcado só equipa');
select throws_ok($$ select public.set_document_visibility(tests.id('doc_a_licence'), false) $$,
 'P0002', 'not_found', 'cliente não altera a visibilidade de documentos');
select tests.login('staff_y', 'aal2');
select throws_ok($$ select public.set_document_visibility(tests.id('doc_a_licence'), true) $$,
 'P0002', 'not_found', 'outra organização não disponibiliza documentos');
select tests.login('staff_x', 'aal2');
select lives_ok($$ select public.set_document_visibility((select id from public.documents where storage_path = issued_path), true) from doc_case $$,
 'equipa pode disponibilizar um emitido guardado internamente');
select tests.login('client_a');
select is((select count(*)::int from public.documents where storage_path = (select issued_path from doc_case)), 1,
 'cliente vê o emitido depois de ser disponibilizado');

select tests.logout();
select tests.put_object(tests.upload_path('org_x', 'proc_a', 'person_a_holder', 'photo'), 'image/png', 0);
select tests.login('client_a');
select throws_ok($$ select public.register_upload(tests.request_id('person_a_holder', 'photo'), tests.upload_path('org_x', 'proc_a', 'person_a_holder', 'photo'), 'vazio.png') $$,
 'P0001', 'document_metadata_invalid', 'servidor recusa objeto vazio');

select tests.login('staff_x', 'aal2');
update public.processes set completed_at = now() where id = tests.id('proc_a');
select throws_ok($$ select public.create_document_request(tests.id('proc_a'), tests.id('person_a_holder'), upload_type) from doc_case $$,
 'P0001', 'process_closed', 'processo concluído não aceita novos pedidos');
select tests.login('client_a');
select lives_ok($$ select public.register_upload(request_id, second_path, 'corrigido.pdf') from doc_case $$,
 'confirmar um upload já registado continua seguro após a conclusão');

select * from finish();
rollback;

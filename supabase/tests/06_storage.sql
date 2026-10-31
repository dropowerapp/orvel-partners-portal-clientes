-- Storage: uploads só nas pastas permitidas; ninguém lê diretamente o bucket de documentos.
begin;
select no_plan();
select tests.seed_fixtures();

create temporary table t_paths as
select
  tests.upload_path('org_x', 'proc_a', 'person_a_spouse', 'passport') as own_request,
  tests.upload_path('org_x', 'proc_b', 'person_b_holder', 'passport') as other_request,
  tests.id('org_x') || '/' || tests.id('proc_a') || '/issued/f.pdf' as issued_folder,
  tests.id('org_y') || '/' || tests.id('proc_c') || '/issued/f.pdf' as other_org;
grant select on t_paths to authenticated;

select tests.login('client_a');
select lives_ok($$ insert into storage.objects (bucket_id, name) select 'documents', own_request from t_paths $$,
  'cliente carrega para o seu pedido');
select throws_ok($$ insert into storage.objects (bucket_id, name) select 'documents', other_request from t_paths $$,
  '42501', null, 'cliente não carrega para o pedido de outro cliente');
select throws_ok($$ insert into storage.objects (bucket_id, name) select 'documents', issued_folder from t_paths $$,
  '42501', null, 'cliente não carrega para a pasta de documentos emitidos');
select throws_ok($$ insert into storage.objects (bucket_id, name) select 'branding', 'x/logo.png' $$,
  '42501', null, 'cliente não carrega logótipos');
select is_empty($$ select 1 from storage.objects $$, 'cliente não lê objetos diretamente (nem os seus)');
select is(tests.affected($$ delete from storage.objects $$), 0, 'cliente não apaga objetos');

-- Pedido já aprovado: deixa de aceitar uploads
select tests.login('staff_x', 'aal2');
update public.document_requests set status = 'approved' where id = tests.request_id('person_a_spouse', 'passport');
select tests.login('client_a');
select throws_ok($$ insert into storage.objects (bucket_id, name) select 'documents', replace(own_request, 'f.pdf', 'g.pdf') from t_paths $$,
  '42501', null, 'pedido aprovado não aceita novos ficheiros');

select tests.login('staff_x', 'aal2');
select lives_ok($$ insert into storage.objects (bucket_id, name) select 'documents', issued_folder from t_paths $$,
  'equipa carrega na sua organização');
select throws_ok($$ insert into storage.objects (bucket_id, name) select 'documents', other_org from t_paths $$,
  '42501', null, 'equipa não carrega noutra organização');
select is_empty($$ select 1 from storage.objects where bucket_id = 'documents' $$, 'equipa também não lê diretamente (downloads só por URL assinado)');

select tests.login('staff_x', 'aal1');
select throws_ok($$ insert into storage.objects (bucket_id, name) select 'documents', replace(issued_folder, 'f.pdf', 'h.pdf') from t_paths $$,
  '42501', null, 'equipa sem MFA não carrega');

select * from finish();
rollback;

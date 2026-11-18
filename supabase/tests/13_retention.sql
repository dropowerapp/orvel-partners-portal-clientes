begin;
select no_plan();
select tests.seed_fixtures();

-- Este alvo não tem objeto físico: simula a ausência após sucesso da Storage API.
update public.documents set storage_path = organization_id || '/' || process_id || '/uploads/teste-retencao/passaporte.pdf'
  where id = tests.id('doc_a_passport');
create temporary table retention_case(document_id uuid, process_id uuid, organization_id uuid, storage_path text, lease_id uuid);
grant all on retention_case to service_role, authenticated;

select tests.login('staff_x', 'aal2');
select throws_ok($$ select public.admin_claim_document_purges(tests.id('org_x')) $$, '42501', null, 'equipa não executa a limpeza');
select throws_ok($$ select * from private.document_purge_jobs $$, '42501', null, 'fila de limpeza não é acessível pela API do utilizador');
select throws_ok($$ update public.documents set purged_at = now() where id = tests.id('doc_a_passport') $$,
  'P0001', 'retention_managed', 'equipa não marca eliminação sem passar pelo serviço');
select throws_ok($$ update public.documents set storage_path = tests.id('org_y') || '/alheio/documento.pdf' where id = tests.id('doc_a_passport') $$,
  'P0001', 'document_path_invalid', 'documento não aponta para outra organização');
select throws_ok($$ update public.proposals set pdf_path = tests.id('org_y') || '/alheio/proposta.pdf' where id = tests.id('proposal_a') $$,
  'P0001', 'document_path_invalid', 'proposta não aponta para outra organização');
select tests.logout();
-- Este ensaio cobre o acompanhamento de um processo já aceite pelo cliente.
select tests.login('client_a');
select public.accept_proposal(tests.id('proposal_a'), 'Completo', 'fixture de teste');
select tests.logout();
select is_empty($$ select * from public.admin_preview_document_purges(tests.id('org_x')) $$, 'processo aberto não é candidato');
update public.processes set completed_at = now() where id = tests.id('proc_a');
select is_empty($$ select * from public.admin_preview_document_purges(tests.id('org_x')) $$, 'período de conservação ainda em curso');
update public.processes set completed_at = null where id = tests.id('proc_a');
update public.processes set completed_at = now() - interval '40 days' where id = tests.id('proc_a');
select is((select count(*)::int from public.admin_preview_document_purges(tests.id('org_x'))), 1, 'só o passaporte sensível vencido é candidato');
select is_empty($$ select * from private.document_purge_jobs $$, 'simulação não cria reservas');
select is_empty($$ select * from public.admin_claim_document_purges(tests.id('org_y')) $$, 'limpeza limitada à organização indicada');
select throws_ok($$ select public.admin_claim_document_purges(tests.id('org_x'), 0) $$, '22023', 'invalid_input', 'lote limitado e validado');

select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
insert into retention_case select * from public.admin_claim_document_purges(tests.id('org_x'), 1);
select is((select count(*)::int from retention_case), 1, 'serviço reserva um ficheiro');
select is_empty($$ select * from public.admin_claim_document_purges(tests.id('org_x'), 1) $$, 'reserva ativa não é atribuída duas vezes');
select throws_ok($$ do $body$ begin
  perform tests.put_object((select storage_path from retention_case));
  perform public.admin_finish_document_purge(document_id, lease_id) from retention_case;
end $body$ $$,
  'P0001', 'retention_object_present', 'não confirma eliminação enquanto o objeto existe');

select tests.login('staff_x', 'aal2');
select throws_ok($$ update public.processes set completed_at = null where id = tests.id('proc_a') $$,
  'P0001', 'retention_started', 'processo não reabre durante eliminação');
select throws_ok($$ update public.documents set storage_path = organization_id || '/' || process_id || '/issued/trocado.pdf' where id = tests.id('doc_a_passport') $$,
  'P0001', 'retention_started', 'o objeto reservado não pode ser substituído');
select tests.logout();
select public.admin_fail_document_purge(document_id, lease_id, 'storage_delete_failed') from retention_case;
select is((select attempts from private.document_purge_jobs where document_id = tests.id('doc_a_passport')), 1, 'falha preserva tentativa e metadados');
select is((select purged_at from public.documents where id = tests.id('doc_a_passport')), null::timestamptz, 'falha não marca ficheiro como eliminado');
select is((select last_error from private.document_purge_jobs where document_id = tests.id('doc_a_passport')), 'storage_delete_failed', 'falha registada sem dados privados');
create temporary table retry_case as select * from public.admin_claim_document_purges(tests.id('org_x'), 1);
select is((select attempts from private.document_purge_jobs where document_id = tests.id('doc_a_passport')), 2, 'nova tentativa reserva de novo');
select throws_ok($$ select public.admin_finish_document_purge(document_id, lease_id) from retention_case $$,
  'P0001', 'retention_lease_expired', 'trabalhador antigo não confirma reserva nova');

-- A inserção transitória no teste throws_ok foi desfeita com a exceção. Não apagar
-- diretamente storage.objects: a ausência atual representa o resultado da Storage API.
select lives_ok($$ select public.admin_finish_document_purge(document_id, lease_id) from retry_case $$, 'ausência confirmada permite finalizar');
select ok((select purged_at is not null from public.documents where id = tests.id('doc_a_passport')), 'marca a eliminação no documento');
select is((select count(*)::int from public.activity_log where action = 'document.purged' and entity_id = tests.id('doc_a_passport')), 1, 'eliminação auditada');
select lives_ok($$ select public.admin_finish_document_purge(document_id, lease_id) from retry_case $$, 'confirmação idempotente');
select is((select count(*)::int from public.activity_log where action = 'document.purged' and entity_id = tests.id('doc_a_passport')), 1, 'auditoria não duplicada');
select is((select count(*)::int from storage.objects where bucket_id = 'documents' and name like '%/issued/licence.pdf'), 1, 'documento não sensível preservado');
select is_empty($$ select * from public.admin_claim_document_purges(tests.id('org_x')) $$, 'ficheiro eliminado não volta a ser reservado');
select tests.login('client_a');
select is_empty($$ select id from public.documents where id = tests.id('doc_a_passport') $$, 'cliente deixa de ver documento eliminado');
select throws_ok($$ select public.admin_preview_document_purges(tests.id('org_x')) $$, '42501', null, 'cliente não consulta candidatos da limpeza');
select * from finish();
rollback;

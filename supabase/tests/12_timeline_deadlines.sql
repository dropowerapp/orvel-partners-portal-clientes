begin;
select no_plan();
select tests.seed_fixtures();

-- Este ensaio cobre o acompanhamento de um processo já aceite pelo cliente.
select tests.login('client_a');
select public.accept_proposal(tests.id('proposal_a'), 'Completo', 'fixture de teste');
select tests.logout();
create temporary table schedule_case (step_id uuid, deadline_id uuid);
grant all on schedule_case to authenticated;

select tests.login('client_a');
select throws_ok($$ select public.save_timeline_step(tests.id('proc_a'), 'Tentativa', 'incorporation') $$, 'P0002', 'not_found', 'cliente não cria passos');
select throws_ok($$ select public.save_deadline(tests.id('proc_a'), 'other', current_date, 'Tentativa') $$, 'P0002', 'not_found', 'cliente não cria prazos');
select tests.login('staff_x', 'aal1');
select throws_ok($$ select public.save_timeline_step(tests.id('proc_a'), 'Tentativa', 'incorporation') $$, 'P0002', 'not_found', 'equipa sem MFA não cria passos');
select throws_ok($$ select public.save_deadline(tests.id('proc_a'), 'other', current_date, 'Tentativa') $$, 'P0002', 'not_found', 'equipa sem MFA não cria prazos');
select tests.login('staff_y', 'aal2');
select throws_ok($$ select public.save_deadline(tests.id('proc_a'), 'other', current_date, 'Tentativa') $$, 'P0002', 'not_found', 'outra organização não cria prazos');
select throws_ok($$ select public.save_timeline_step(tests.id('proc_a'), 'Tentativa', 'incorporation') $$, 'P0002', 'not_found', 'outra organização não cria passos');

select tests.login('staff_x', 'aal2');
select throws_ok($$ update public.timeline_steps set status = 'done' $$, '42501', null, 'escrita direta não contorna proteção dos passos automáticos');
select throws_ok($$ update public.deadlines set due_on = current_date $$, '42501', null, 'escrita direta não desliga prazo do documento');
select throws_ok($$ select public.save_timeline_step(tests.id('proc_a'), ' ', 'incorporation') $$, '22023', 'invalid_input', 'passo exige título');
select throws_ok($$ select public.save_timeline_step(tests.id('proc_a'), 'Título', 'inventada') $$, '22023', 'invalid_input', 'fase é validada');
select throws_ok($$ select public.save_timeline_step(tests.id('proc_a'), 'Título', 'incorporation', 'done', null, current_date + 2) $$, 'P0001', 'timeline_future_completion', 'não conclui passo no futuro');
insert into schedule_case select public.save_timeline_step(tests.id('proc_a'), '  Reunião  ', 'incorporation', 'in_progress', current_date + 7, null, 'Nota pública'),
 public.save_deadline(tests.id('proc_a'), 'other', current_date + 20, 'Revisão anual', tests.id('person_a_holder'));
select is((select title ->> 'pt-PT' from public.timeline_steps where id = (select step_id from schedule_case)), 'Reunião', 'passo criado com título normalizado');
select is((select created_by from public.deadlines where id = (select deadline_id from schedule_case)), tests.id('staff_x'), 'prazo regista autor da equipa');
select throws_ok($$ select public.save_timeline_step(tests.id('proc_a'), 'Antigo', 'incorporation', p_step_id := step_id, p_expected_updated_at := '2000-01-01') from schedule_case $$,
 'P0001', 'schedule_conflict', 'edição antiga não substitui o passo');
select lives_ok($$ select public.save_timeline_step(tests.id('proc_a'), 'Reunião feita', 'incorporation', 'done', p_step_id := id, p_expected_updated_at := updated_at)
 from public.timeline_steps where id = (select step_id from schedule_case) $$, 'equipa conclui passo manual');
select is((select done_on from public.timeline_steps where id = (select step_id from schedule_case)), (now() at time zone 'Asia/Dubai')::date, 'conclusão usa dia da organização');
select lives_ok($$ select public.save_timeline_step(tests.id('proc_a'), 'Reunião', 'incorporation', 'todo', p_step_id := id, p_expected_updated_at := updated_at)
 from public.timeline_steps where id = (select step_id from schedule_case) $$, 'equipa reabre passo manual');
select is((select done_on from public.timeline_steps where id = (select step_id from schedule_case)), null::date, 'reabrir limpa a data real');
select throws_ok($$ select public.remove_timeline_step(id, updated_at) from public.timeline_steps where process_id = tests.id('proc_a') and auto_event = 'proposal_accepted' $$,
 'P0001', 'timeline_automatic_locked', 'passo automático não é removido');
select throws_ok($$ select public.save_timeline_step(tests.id('proc_a'), 'Forjado', 'documents', p_step_id := id, p_expected_updated_at := updated_at)
 from public.timeline_steps where process_id = tests.id('proc_a') and auto_event = 'proposal_accepted' $$, 'P0001', 'timeline_automatic_locked', 'passo automático não é alterado');

select throws_ok($$ select public.save_deadline(tests.id('proc_a'), 'other', current_date, ' ') $$, '22023', 'invalid_input', 'outro prazo exige título');
select throws_ok($$ select public.save_deadline(tests.id('proc_a'), 'licence', null) $$, '22023', 'invalid_input', 'prazo exige data');
select throws_ok($$ select public.save_deadline(tests.id('proc_a'), 'other', current_date, 'Pessoa errada', tests.id('person_c_holder')) $$, 'P0002', 'not_found', 'pessoa de outro processo é recusada');
select throws_ok($$ select public.save_deadline(tests.id('proc_a'), 'other', current_date, 'Antigo', p_deadline_id := deadline_id, p_expected_updated_at := '2000-01-01') from schedule_case $$,
 'P0001', 'schedule_conflict', 'prazo com versão antiga é recusado');
select lives_ok($$ select public.save_deadline(process_id, deadline_type, due_on, title, person_id, 'renewing', id, updated_at) from public.deadlines where id = (select deadline_id from schedule_case) $$,
 'equipa inicia renovação');
select is((select status::text from public.deadlines where id = (select deadline_id from schedule_case)), 'renewing', 'renovação guardada');
select throws_ok($$ select public.save_deadline(process_id, deadline_type, due_on + 1, title, person_id, status, id, updated_at) from public.deadlines where document_id = tests.id('doc_a_licence') $$,
 'P0001', 'deadline_document_locked', 'prazo automático conserva a validade documental');
select throws_ok($$ select public.save_deadline(process_id, deadline_type, due_on, title, person_id, 'renewed', id, updated_at) from public.deadlines where document_id = tests.id('doc_a_licence') $$,
 'P0001', 'deadline_document_locked', 'renovação documental exige documento novo');
select lives_ok($$ select public.save_deadline(process_id, deadline_type, due_on, title, person_id, 'renewing', id, updated_at) from public.deadlines where document_id = tests.id('doc_a_licence') $$,
 'prazo documental aceita acompanhamento da renovação');

select tests.login('client_a');
select is((select client_note from public.timeline_steps where id = (select step_id from schedule_case)), null::text, 'cliente lê o passo atualizado');
select is((select count(*)::int from public.deadlines where id = (select deadline_id from schedule_case)), 1, 'cliente lê prazo manual próprio');
select tests.login('client_b');
select is_empty($$ select id from public.deadlines where id = (select deadline_id from schedule_case) $$, 'outro cliente não lê prazo');
select tests.login('staff_x', 'aal2');
update public.documents set visible_to_client = false where id = tests.id('doc_a_licence');
select tests.login('client_a');
select is_empty($$ select id from public.deadlines where document_id = tests.id('doc_a_licence') $$, 'prazo de documento interno não vaza para o cliente');
select tests.login('staff_x', 'aal2');
update public.documents set visible_to_client = true where id = tests.id('doc_a_licence');
select tests.login('client_a');
select is((select count(*)::int from public.deadlines where document_id = tests.id('doc_a_licence')), 1, 'disponibilizar o documento disponibiliza o prazo');

select tests.login('staff_y', 'aal2');
select throws_ok($$ select public.remove_timeline_step(step_id, now()) from schedule_case $$, 'P0002', 'not_found', 'outra organização não remove passos');
select tests.login('staff_x', 'aal2');
select throws_ok($$ select public.remove_timeline_step(step_id, '2000-01-01') from schedule_case $$, 'P0001', 'schedule_conflict', 'remoção antiga não apaga alterações recentes');
select lives_ok($$ select public.remove_timeline_step(id, updated_at) from public.timeline_steps where id = (select step_id from schedule_case) $$, 'equipa remove passo manual');
select is_empty($$ select id from public.timeline_steps where id = (select step_id from schedule_case) $$, 'passo deixa o percurso');
select ok(exists(select 1 from public.activity_log where action = 'timeline.removed' and entity_id = (select step_id from schedule_case)), 'remoção permanece na auditoria');

update public.processes set completed_at = now() where id = tests.id('proc_a');
select throws_ok($$ select public.save_timeline_step(tests.id('proc_a'), 'Tardio', 'done') $$, 'P0001', 'process_closed', 'percurso concluído fica protegido');
select lives_ok($$ select public.save_deadline(process_id, deadline_type, due_on, title, person_id, 'dismissed', id, updated_at) from public.deadlines where id = (select deadline_id from schedule_case) $$,
 'renovações continuam geríveis depois da conclusão');
select lives_ok($$ select public.save_deadline(process_id, deadline_type, due_on + 365, title, person_id, 'open', id, updated_at) from public.deadlines where id = (select deadline_id from schedule_case) $$,
 'prazo manual pode ser reaberto com nova data');
select ok(exists(select 1 from public.activity_log where action = 'deadline.updated' and entity_id = (select deadline_id from schedule_case)), 'alterações de prazo auditadas');

select * from finish();
rollback;

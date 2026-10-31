-- Lógica de negócio: estado automático, cronologia, prazos, dados bancários, data de limpeza.
begin;
select no_plan();
select tests.seed_fixtures();

-- Valores iniciais por organização
select is((select count(*) from public.timeline_template_steps where organization_id = tests.id('org_x'))::int, 14,
  'modelo de cronologia com 14 passos');
select is((select count(*) from public.timeline_steps where process_id = tests.id('proc_a'))::int, 13,
  'processo sem conta bancária recebe 13 passos');
select is((select count(*) from public.document_requests where person_id = tests.id('person_a_spouse'))::int, 3,
  'cônjuge recebe passaporte, fotografia e certidão de casamento');

-- Estado automático
select is((select status::text from public.processes where id = tests.id('proc_a')), 'proposal_sent', 'proposta enviada');
select is((select status::text from public.processes where id = tests.id('proc_b')), 'new', 'só rascunho: novo');

select tests.login('client_a');
select public.accept_proposal(tests.id('proposal_a'), 'Completo');
select tests.logout();
select is((select status::text from public.processes where id = tests.id('proc_a')), 'awaiting_payment', 'aceite: por pagar');
select is((select count(*) from public.timeline_steps where process_id = tests.id('proc_a'))::int, 14,
  'plano com conta bancária acrescenta o passo');
select is((select status::text from public.timeline_steps where process_id = tests.id('proc_a') and auto_event = 'proposal_accepted'),
  'done', 'passo "Proposta aceite" concluído automaticamente');

select tests.login('staff_x', 'aal2');
update public.payments set status = 'partial', amount_paid_aed = 10000 where id = tests.id('payment_a');
select is((select status::text from public.processes where id = tests.id('proc_a')), 'awaiting_payment', 'pagamento parcial: por pagar');
update public.payments set status = 'paid' where id = tests.id('payment_a');
select is((select amount_paid_aed from public.payments where id = tests.id('payment_a')), 32000.00::numeric(12,2),
  'pago: valor pago igual ao total');
select is((select status::text from public.processes where id = tests.id('proc_a')), 'awaiting_documents', 'pago: à espera de documentos');
select is((select status::text from public.timeline_steps where process_id = tests.id('proc_a') and auto_event = 'payment_confirmed'),
  'done', 'passo "Pagamento confirmado" concluído');

select throws_ok($$ update public.document_requests set status = 'rejected' where process_id = tests.id('proc_a') $$,
  '23514', null, 'rejeição exige motivo');
update public.document_requests set status = 'rejected', rejection_reason = 'Fotografia desfocada'
where person_id = tests.id('person_a_holder');
select ok((select bool_and(reviewed_by = tests.id('staff_x')) from public.document_requests where person_id = tests.id('person_a_holder')),
  'revisor registado');
update public.document_requests set status = 'approved' where process_id = tests.id('proc_a');
select is((select status::text from public.processes where id = tests.id('proc_a')), 'in_progress', 'documentos aprovados: em curso');
select is((select status::text from public.timeline_steps where process_id = tests.id('proc_a') and auto_event = 'documents_received'),
  'done', 'passo "Documentos recebidos" concluído');
select ok((select count(*) from public.activity_log where process_id = tests.id('proc_a') and action = 'document_request.rejected') = 2,
  'rejeições registadas na atividade');

-- Prazos automáticos a partir de documentos emitidos
select is((select (deadline_type::text, due_on) from public.deadlines where document_id = tests.id('doc_a_licence')),
  row('licence'::text, current_date + 365), 'licença com validade cria prazo');
update public.documents set expires_on = current_date + 400 where id = tests.id('doc_a_licence');
select is((select due_on from public.deadlines where document_id = tests.id('doc_a_licence')), current_date + 400,
  'mudar a validade atualiza o prazo');
select tests.logout();
select tests.put_object(tests.id('org_x') || '/' || tests.id('proc_a') || '/issued/licence-2.pdf');
select tests.login('staff_x', 'aal2');
insert into public.documents (organization_id, process_id, document_type_id, direction, storage_path, file_name, mime_type, size_bytes, expires_on)
select tests.id('org_x'), tests.id('proc_a'), id, 'issued',
  tests.id('org_x') || '/' || tests.id('proc_a') || '/issued/licence-2.pdf', 'licenca-2027.pdf', 'application/pdf', 1000, current_date + 730
from public.document_types where organization_id = tests.id('org_x') and key = 'trade_licence' and direction = 'issued';
select is((select status::text from public.deadlines where document_id = tests.id('doc_a_licence')), 'renewed',
  'nova licença marca o prazo anterior como renovado');
select is((select count(*) from public.deadlines where process_id = tests.id('proc_a') and status = 'open')::int, 1,
  'fica um só prazo de licença em aberto');
select throws_ok($$ insert into public.documents (organization_id, process_id, document_type_id, direction, storage_path, file_name, mime_type, size_bytes)
  select tests.id('org_x'), tests.id('proc_a'), id, 'issued', 'outra-org/caminho.pdf', 'x.pdf', 'application/pdf', 10
  from public.document_types where organization_id = tests.id('org_x') and key = 'moa' $$, 'P0001', 'document_path_invalid',
  'caminho do ficheiro tem de estar na pasta do processo');

-- Dados bancários só depois da aceitação
select throws_ok($$ update public.processes set bank_details_released_at = now() where id = tests.id('proc_b') $$,
  'P0001', 'bank_details_require_accepted_proposal', 'não liberta dados bancários sem proposta aceite');
update public.processes set bank_details_released_at = now() where id = tests.id('proc_a');
select is((select bank_details_released_by from public.processes where id = tests.id('proc_a')), tests.id('staff_x'),
  'regista quem libertou');

-- Estado não é editável à mão
update public.processes set status = 'completed' where id = tests.id('proc_a');
select is((select status::text from public.processes where id = tests.id('proc_a')), 'in_progress', 'estado é sempre calculado');

-- Conclusão e data de limpeza (30 dias, configurável por organização)
update public.processes set completed_at = now() where id = tests.id('proc_a');
select is((select status::text from public.processes where id = tests.id('proc_a')), 'completed', 'concluído');
select is((select sensitive_purge_on from public.processes where id = tests.id('proc_a')),
  (now() at time zone 'Asia/Dubai')::date + 30, 'limpeza marcada para 30 dias depois');
select is((select status::text from public.timeline_steps where process_id = tests.id('proc_a') and auto_event = 'process_completed'),
  'done', 'passo "Processo concluído" concluído');
update public.organizations set sensitive_retention_days = 60 where id = tests.id('org_x');
select is((select sensitive_purge_on from public.processes where id = tests.id('proc_a')),
  (now() at time zone 'Asia/Dubai')::date + 30, 'mudar a conservação não altera conclusões já feitas');
update public.processes set completed_at = null where id = tests.id('proc_a');
select is((select (status::text, sensitive_purge_on) from public.processes where id = tests.id('proc_a')),
  row('in_progress'::text, null::date), 'reabrir limpa a data de limpeza');
select is((select status::text from public.timeline_steps where process_id = tests.id('proc_a') and auto_event = 'process_completed'),
  'todo', 'reabrir volta a pôr "Processo concluído" por fazer');
update public.processes set cancelled_at = now() where id = tests.id('proc_b');
select is((select (status::text, sensitive_purge_on) from public.processes where id = tests.id('proc_b')),
  row('cancelled'::text, (now() at time zone 'Asia/Dubai')::date + 60), 'cancelar também marca a limpeza (com o novo valor de 60 dias)');

-- Referência da proposta
select throws_ok($$ insert into public.proposals (organization_id, process_id, reference) values (tests.id('org_x'), tests.id('proc_b'), 'ORV-26-1') $$,
  'P0001', 'proposal_reference_invalid', 'referência tem de seguir PREFIXO-AAAA-NNN');
select throws_ok($$ insert into public.proposals (organization_id, process_id, reference, status) values (tests.id('org_x'), tests.id('proc_b'), 'TSX-2026-050', 'sent') $$,
  'P0001', 'proposal_requires_pdf_and_plans', 'não envia proposta sem PDF e planos');

select * from finish();
rollback;

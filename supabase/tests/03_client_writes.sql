-- O cliente só escreve através das funções validadas; escritas diretas falham ou não afetam nada.
begin;
select no_plan();
select tests.seed_fixtures();

select tests.login('client_a');

-- Escritas diretas: sem política de escrita para clientes
select is(tests.affected($$ update public.document_requests set status = 'approved' where process_id = tests.id('proc_a') $$), 0,
  'não aprova os próprios documentos');
select is(tests.affected($$ update public.payments set status = 'paid' where id = tests.id('payment_a') $$), 0,
  'não marca o pagamento como pago');
select is(tests.affected($$ update public.processes set completed_at = now() where id = tests.id('proc_a') $$), 0,
  'não altera o processo diretamente');
select is(tests.affected($$ update public.clients set email = 'outro@exemplo.test' where id = tests.id('client_a') $$), 0,
  'não altera o próprio email de acesso');
select is(tests.affected($$ update public.proposals set status = 'accepted' where id = tests.id('proposal_a') $$), 0,
  'não aceita a proposta por escrita direta');
select is(tests.affected($$ delete from public.documents where process_id = tests.id('proc_a') $$), 0,
  'não apaga documentos');
select is(tests.affected($$ delete from public.deadlines $$), 0, 'não apaga prazos');
select throws_ok($$ insert into public.payments (organization_id, process_id, amount_aed)
                    values (tests.id('org_x'), tests.id('proc_a'), 1) $$, '42501', null, 'não cria pagamentos');
select throws_ok($$ insert into public.people (organization_id, process_id, relationship, full_name)
                    values (tests.id('org_x'), tests.id('proc_a'), 'child', 'Direto') $$, '42501', null,
  'não cria pessoas sem passar pela função');
select throws_ok($$ insert into public.activity_log (organization_id, actor_role, action)
                    values (tests.id('org_x'), 'client', 'forjado') $$, '42501', null, 'não escreve no registo de atividade');
select throws_ok($$ insert into public.memberships (user_id, organization_id, role)
                    values (tests.id('client_a'), tests.id('org_x'), 'admin') $$, '42501', null, 'não se promove a administrador');
select throws_ok($$ insert into public.privacy_consents (organization_id, user_id, notice_id)
                    select organization_id, tests.id('client_a'), id from public.privacy_notices limit 1 $$, '42501', null,
  'consentimento só pela função');

-- Funções validadas: dados pessoais
select lives_ok($$ select public.update_my_details(tests.id('client_a'), '  Rui   Fictício ', '+351 911 111 111', 'Portugal',
                   'Rua Exemplo 1', 'Lisboa', '1000-001', 'Portugal') $$, 'atualiza os seus dados');
select is((select full_name from public.clients where id = tests.id('client_a')), 'Rui Fictício', 'espaços normalizados');
select throws_ok($$ select public.update_my_details(tests.id('client_a'), '  ', null, null, null, null, null, null) $$,
  'P0001', 'full_name_required', 'nome obrigatório');

-- Dependentes
select lives_ok($$ select public.save_person(tests.id('proc_a'), null, 'child', 'Tomás Fictício', 'Portuguesa', date '2015-05-01') $$,
  'acrescenta um filho');
select is((select count(*) from public.document_requests r join public.people p on p.id = r.person_id
           where p.full_name = 'Tomás Fictício')::int, 3, 'filho recebe 3 pedidos: passaporte, fotografia, certidão de nascimento');
select throws_ok($$ select public.save_person(tests.id('proc_a'), null, 'holder', 'Segundo Titular', null, null) $$,
  'P0001', 'holder_already_exists', 'não cria segundo titular');
select throws_ok($$ select public.save_person(tests.id('proc_a'), tests.id('person_a_spouse'), 'holder', 'Ana', null, null) $$,
  'P0001', 'holder_relationship_locked', 'não transforma dependente em titular');
select throws_ok($$ select public.save_person(tests.id('proc_a'), null, 'child', 'Futuro', null, current_date + 10) $$,
  'P0001', 'date_of_birth_invalid', 'data de nascimento no futuro é recusada');
select throws_ok($$ select public.delete_person(tests.id('person_a_holder')) $$, 'P0001', 'holder_cannot_be_deleted',
  'não apaga o titular');
select lives_ok($$ select public.delete_person((select id from public.people where full_name = 'Tomás Fictício')) $$,
  'apaga um dependente sem documentos');

-- Nomes da empresa
select lives_ok($$ select public.set_company_names(tests.id('proc_a'), array[' Alfa Trading ', 'alfa trading', 'Beta FZ', '']) $$,
  'grava nomes pretendidos');
select is((select company_name_options from public.processes where id = tests.id('proc_a')), array['Alfa Trading', 'Beta FZ'],
  'remove vazios e repetidos');
select throws_ok($$ select public.set_company_names(tests.id('proc_a'), array['A', 'B', 'C', 'D']) $$, 'P0001', 'company_names_count',
  'no máximo 3 nomes');

-- Upload: só no caminho do próprio pedido, e o ficheiro tem de existir no Storage
select tests.logout();
select tests.put_object(tests.upload_path('org_x', 'proc_a', 'person_a_spouse', 'passport', 'p.pdf'));
select tests.login('client_a');
select lives_ok($$ select public.register_upload(tests.request_id('person_a_spouse', 'passport'),
    tests.upload_path('org_x', 'proc_a', 'person_a_spouse', 'passport', 'p.pdf'), 'passaporte-ana.pdf') $$,
  'regista o upload');
select is((select status::text from public.document_requests where id = tests.request_id('person_a_spouse', 'passport')),
  'submitted', 'pedido passa a enviado');
select ok((select is_sensitive from public.documents where file_name = 'passaporte-ana.pdf'), 'passaporte fica marcado como sensível');
select throws_ok($$ select public.register_upload(tests.request_id('person_a_spouse', 'photo'),
    tests.id('org_x') || '/' || tests.id('proc_a') || '/uploads/x/../../p.pdf', 'x.pdf') $$,
  'P0001', 'document_path_invalid', 'recusa caminhos fora do pedido');
select throws_ok($$ select public.register_upload(tests.request_id('person_a_spouse', 'photo'),
    tests.upload_path('org_x', 'proc_a', 'person_a_spouse', 'passport', 'p.pdf'), 'x.pdf') $$,
  'P0001', 'document_path_invalid', 'recusa o caminho de outro pedido');
select throws_ok($$ select public.register_upload(tests.request_id('person_a_spouse', 'photo'),
    tests.upload_path('org_x', 'proc_a', 'person_a_spouse', 'photo', 'nao-existe.jpg'), 'x.jpg') $$,
  'P0001', 'upload_not_found', 'recusa registo sem ficheiro no Storage');
select throws_ok($$ select public.register_upload(tests.request_id('person_a_spouse', 'passport'),
    tests.upload_path('org_x', 'proc_a', 'person_a_spouse', 'passport', 'p.pdf'), 'outra.pdf') $$,
  'P0001', 'request_not_open', 'pedido já enviado não aceita novo registo até ser rejeitado');

-- Aceitação da proposta
select is(public.get_acceptance_text(tests.id('proposal_a'), 'Completo'),
  'Declaro que li e aceito a proposta TSX-2026-001, no plano Completo, pelo valor total de 32,000.00 AED, nas condições descritas no documento.',
  'texto de aceitação gerado no servidor');
select throws_ok($$ select public.accept_proposal(tests.id('proposal_a'), 'Plano Inventado') $$, 'P0001', 'plan_not_in_proposal',
  'só aceita planos apresentados');
select lives_ok($$ select public.accept_proposal(tests.id('proposal_a'), 'Completo', 'Mozilla/5.0 teste') $$, 'aceita a proposta');
select throws_ok($$ select public.accept_proposal(tests.id('proposal_a'), 'Completo') $$, 'P0001', 'proposal_not_open',
  'não aceita duas vezes');
select tests.logout();
select is((select (status::text, chosen_plan, accepted_by, accepted_text is not null) from public.proposals where id = tests.id('proposal_a')),
  row('accepted'::text, 'Completo'::text, tests.id('client_a'), true), 'aceitação registada com plano, utilizador e texto');
select is((select (plan_name, includes_bank_account) from public.processes where id = tests.id('proc_a')),
  row('Completo'::text, true), 'plano escolhido passa para o processo');

-- A equipa não consegue alterar nem forjar uma aceitação
select tests.login('staff_x', 'aal2');
select throws_ok($$ update public.proposals set chosen_plan = 'Essencial' where id = tests.id('proposal_a') $$, 'P0001',
  'proposal_accepted_is_locked', 'proposta aceite não muda');
select throws_ok($$ delete from public.proposals where id = tests.id('proposal_a') $$, 'P0001', 'proposal_accepted_is_locked',
  'proposta aceite não se apaga');
select throws_ok($$ update public.proposals set status = 'accepted', accepted_at = now(), accepted_text = 'x', chosen_plan = 'Base'
                    where id = tests.id('proposal_b') $$, 'P0001', 'proposal_accept_only_by_client', 'a equipa não marca como aceite');

-- Processo concluído: o cliente deixa de poder alterar
update public.processes set completed_at = now() where id = tests.id('proc_a');
select tests.login('client_a');
select throws_ok($$ select public.set_company_names(tests.id('proc_a'), array['Gama']) $$, 'P0001', 'process_closed',
  'processo concluído fica só de leitura para o cliente');

select * from finish();
rollback;

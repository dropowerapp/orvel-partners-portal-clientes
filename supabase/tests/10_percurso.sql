-- Etapa 4: fases do percurso e modelo da Orvel (documento "Criar empresa no Dubai, passo a passo").
begin;
select no_plan();
select tests.seed_fixtures();

-- Este ensaio cobre o acompanhamento de um processo já aceite pelo cliente.
select tests.login('client_a');
select public.accept_proposal(tests.id('proposal_a'), 'Completo', 'fixture de teste');
select tests.logout();

select results_eq(
  $$ select ts.phase, count(*)::int from public.timeline_template_steps ts
     join public.timeline_templates t on t.id = ts.template_id
     join public.organizations o on o.id = t.organization_id
     where o.slug = 'orvel' and t.is_default group by ts.phase order by min(ts.position) $$,
  $$ values ('documents', 3), ('incorporation', 3), ('residence', 5), ('bank', 1), ('done', 1) $$,
  'modelo da Orvel com as fases do documento do percurso');

select is((select contact_whatsapp from public.organizations where slug = 'orvel'), '+971503642510', 'WhatsApp da Orvel');
select is((select contact_email from public.organizations where slug = 'orvel'), 'hello@orvelpartners.com', 'email de contacto da Orvel');

select is_empty(
  $$ select 1 from public.timeline_template_steps where phase is null $$,
  'todos os passos de modelo têm fase (incluindo os das organizações novas)');

-- Processo novo numa organização de teste: os passos herdam a fase do modelo.
insert into public.processes (id, organization_id, client_id, includes_bank_account)
values (tests.id('proc_fases'), tests.id('org_x'), tests.id('client_b'), true);
select is_empty(
  $$ select 1 from public.timeline_steps where process_id = tests.id('proc_fases') and phase is null $$,
  'os passos do processo herdam a fase');
select is(
  (select phase from public.timeline_steps where process_id = tests.id('proc_fases') and condition = 'requires_bank_account'),
  'bank', 'o passo da conta bancária fica na fase "bank"');
select is(
  (select phase from public.timeline_steps where process_id = tests.id('proc_fases') and auto_event = 'proposal_accepted'),
  'documents', 'a aceitação da proposta fica na fase "documents"');

-- O cliente vê as fases dos seus passos.
select tests.login('client_a');
select ok((select count(*) from public.timeline_steps where phase is not null) > 0, 'o cliente lê a fase dos seus passos');

select tests.logout();
select * from finish();
rollback;

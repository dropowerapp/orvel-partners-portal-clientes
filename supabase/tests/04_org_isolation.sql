-- A organização X não vê dados da organização Y; a equipa sem MFA não vê nada.
begin;
select no_plan();
select tests.seed_fixtures();

-- Equipa X com MFA
select tests.login('staff_x', 'aal2');
select results_eq($$ select id from public.organizations $$, array[tests.id('org_x')], 'equipa X vê só a sua organização');
select is((select count(*) from public.processes)::int, 2, 'equipa X vê os 2 processos de X');
select is_empty($$ select 1 from public.processes where organization_id = tests.id('org_y') $$, 'equipa X não vê processos de Y');
select is_empty($$ select 1 from public.clients where organization_id = tests.id('org_y') $$, 'equipa X não vê clientes de Y');
select is_empty($$ select 1 from public.documents where organization_id = tests.id('org_y') $$, 'equipa X não vê documentos de Y');
select is_empty($$ select 1 from public.activity_log where organization_id = tests.id('org_y') $$, 'equipa X não vê a atividade de Y');
select is_empty($$ select 1 from public.document_types where organization_id = tests.id('org_y') $$, 'equipa X não vê catálogos de Y');
select ok((select count(*) from public.process_internal) = 2, 'equipa X lê os dados internos de X');
select is((select margin_aed from public.process_internal where process_id = tests.id('proc_a')), 12500.00::numeric(12,2),
  'margem calculada: 32000 − 18000 − 1500');
select ok((select count(*) from public.internal_notes) = 1, 'equipa X lê as notas internas de X');
select ok((select count(*) from public.activity_log) > 0, 'equipa X lê a atividade de X');

-- Escrita noutra organização
select throws_ok($$ insert into public.clients (organization_id, full_name, email)
                    values (tests.id('org_y'), 'Intruso', 'intruso@exemplo.test') $$, '42501', null, 'não cria clientes em Y');
select is(tests.affected($$ update public.processes set free_zone = 'X' where organization_id = tests.id('org_y') $$), 0,
  'não altera processos de Y');
select is(tests.affected($$ update public.organizations set partner_role_enabled = true where id = tests.id('org_y') $$), 0,
  'não altera definições de Y');
select throws_ok($$ insert into public.people (organization_id, process_id, relationship, full_name)
                    values (tests.id('org_x'), tests.id('proc_c'), 'child', 'Cruzado') $$, '23503', null,
  'chave composta impede ligar um registo de X a um processo de Y');

-- Equipa Y com MFA
select tests.login('staff_y', 'aal2');
select results_eq($$ select id from public.processes $$, array[tests.id('proc_c')], 'equipa Y vê só o processo de Y');
select is_empty($$ select 1 from public.process_internal where organization_id = tests.id('org_x') $$, 'equipa Y não lê internos de X');

-- Equipa sem MFA (sessão aal1): nada
select tests.login('staff_x', 'aal1');
select is_empty($$ select 1 from public.organizations $$, 'sem MFA: não vê a organização');
select is_empty($$ select 1 from public.processes $$, 'sem MFA: não vê processos');
select is_empty($$ select 1 from public.clients $$, 'sem MFA: não vê clientes');
select is_empty($$ select 1 from public.process_internal $$, 'sem MFA: não vê dados internos');
select is_empty($$ select 1 from public.activity_log $$, 'sem MFA: não vê atividade');
select throws_ok($$ insert into public.clients (organization_id, full_name, email)
                    values (tests.id('org_x'), 'Sem MFA', 'semmfa@exemplo.test') $$, '42501', null, 'sem MFA: não escreve');

-- Administrador desativado: nada
select tests.logout();
update public.memberships set is_active = false where user_id = tests.id('staff_x');
select tests.login('staff_x', 'aal2');
select is_empty($$ select 1 from public.processes $$, 'administrador desativado não vê nada');

select * from finish();
rollback;

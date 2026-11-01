-- Etapa 2: consentimento exigido pela base de dados, contexto da sessão e funções do convite.
begin;
select no_plan();
select tests.seed_fixtures();

-- Cliente sem consentimento: só vê o aviso -----------------------------------------------------
delete from public.privacy_consents where user_id = tests.id('client_a');

select tests.login('client_a');
select is_empty($$ select 1 from public.processes $$, 'sem consentimento não vê o processo');
select is_empty($$ select 1 from public.clients $$, 'sem consentimento não vê os seus dados');
select is_empty($$ select 1 from public.documents $$, 'sem consentimento não vê documentos');
select throws_ok($$ select public.set_company_names(tests.id('proc_a'), array['Alfa']) $$, 'P0002', 'not_found',
  'sem consentimento não altera nada');
select isnt_empty($$ select 1 from public.privacy_notices $$, 'consegue ler o aviso que tem de aceitar');

select is((public.get_session_context(tests.id('org_x')) ->> 'role'), 'client', 'contexto: papel cliente');
select ok((public.get_session_context(tests.id('org_x')) ->> 'consent_required')::boolean, 'contexto: consentimento em falta');
select ok((public.get_session_context(tests.id('org_x')) -> 'notice' ->> 'id') is not null, 'contexto: devolve o aviso em vigor');
select is((public.get_session_context(tests.id('org_x')) -> 'notice' ->> 'retention_days'), '30',
  'contexto: inclui o prazo de conservação');

select lives_ok($$ select public.accept_privacy_notice(
    (public.get_session_context(tests.id('org_x')) -> 'notice' ->> 'id')::uuid, 'Mozilla/5.0 teste') $$,
  'aceita o aviso em vigor');
select isnt_empty($$ select 1 from public.processes $$, 'depois de aceitar, vê o processo');
select ok(not (public.get_session_context(tests.id('org_x')) ->> 'consent_required')::boolean,
  'contexto: consentimento em dia');
select ok((public.get_session_context(tests.id('org_x')) -> 'notice') = 'null'::jsonb, 'contexto: sem aviso a mostrar');

-- Nova versão do aviso: volta a ser pedido o consentimento ---------------------------------------
select tests.logout();
insert into public.privacy_notices (organization_id, version, body, published_at)
values (tests.id('org_x'), 2, '{"pt-PT": "Versão 2 (teste)"}', now());
select tests.login('client_a');
select is_empty($$ select 1 from public.processes $$, 'nova versão publicada: deixa de ver até aceitar');
select throws_ok($$ select public.accept_privacy_notice(
    (select id from public.privacy_notices where version = 1 and organization_id = tests.id('org_x'))) $$,
  'P0002', 'not_found', 'não aceita uma versão antiga');
select lives_ok($$ select public.accept_privacy_notice(
    (select id from public.privacy_notices where version = 2 and organization_id = tests.id('org_x'))) $$,
  'aceita a nova versão');
select isnt_empty($$ select 1 from public.processes $$, 'volta a ver o processo');

-- Aviso por publicar: área de cliente fechada --------------------------------------------------
select tests.logout();
update public.privacy_notices set published_at = null where organization_id = tests.id('org_x');
select tests.login('client_b');
select ok((public.get_session_context(tests.id('org_x')) ->> 'notice_missing')::boolean, 'sem aviso publicado: contexto avisa');
select is_empty($$ select 1 from public.processes $$, 'sem aviso publicado: cliente não vê nada');
select tests.logout();
update public.privacy_notices set published_at = now() where organization_id = tests.id('org_x') and version = 2;

-- Contexto para outros papéis -----------------------------------------------------------------
select tests.login('staff_x', 'aal1');
select is((public.get_session_context(tests.id('org_x')) ->> 'role'), 'admin', 'contexto: equipa');
select ok((public.get_session_context(tests.id('org_x')) ->> 'mfa_required')::boolean, 'contexto: equipa precisa de MFA');
select ok(not public.is_staff_of(tests.id('org_x')), 'is_staff_of: falso sem MFA');
select tests.login('staff_x', 'aal2');
select ok(public.is_staff_of(tests.id('org_x')), 'is_staff_of: verdadeiro com MFA');
select ok(not public.is_staff_of(tests.id('org_y')), 'is_staff_of: falso noutra organização');
select ok((public.get_session_context(tests.id('org_y')) ->> 'role') is null, 'contexto: sem papel noutra organização');

select tests.login('partner_p', 'aal2');
select ok((public.get_session_context(tests.id('org_x')) ->> 'role') is null, 'contexto: parceiro desligado não tem papel');

select tests.login('outsider');
select ok((public.get_session_context(tests.id('org_x')) ->> 'role') is null, 'contexto: utilizador sem acesso');
select tests.login('client_a');
select ok(not public.is_staff_of(tests.id('org_x')), 'is_staff_of: cliente não é equipa');

-- Funções admin_*: só service_role ----------------------------------------------------------
select tests.login('staff_x', 'aal2');
select throws_ok($$ select public.admin_prepare_invite(tests.id('client_b'), tests.id('staff_x')) $$, '42501', null,
  'equipa não executa admin_prepare_invite diretamente');
select throws_ok($$ select public.admin_register_invite(tests.id('client_b'), tests.id('staff_x'), tests.id('staff_x')) $$,
  '42501', null, 'equipa não executa admin_register_invite');
select throws_ok($$ select public.admin_user_id_by_email('client_a@exemplo.test') $$, '42501', null,
  'equipa não procura contas por email');
select throws_ok($$ select public.admin_email_context(tests.id('client_a')) $$, '42501', null,
  'equipa não executa admin_email_context');
select tests.login_anon();
select throws_ok($$ select public.admin_user_id_by_email('client_a@exemplo.test') $$, '42501', null,
  'anónimo não procura contas por email');

-- Convite (como a Edge Function o faz, com service_role) -----------------------------------------
select tests.logout();
set local role service_role;

insert into public.clients (id, organization_id, full_name, email)
values (tests.id('client_new'), tests.id('org_x'), 'Nova Cliente', 'Nova@Exemplo.test');

select is((public.admin_prepare_invite(tests.id('client_new'), tests.id('staff_x')) -> 'client' ->> 'email'),
  'nova@exemplo.test', 'prepara o convite com o email normalizado');
select is((public.admin_prepare_invite(tests.id('client_new'), tests.id('staff_x')) -> 'organization' ->> 'email_from_address'),
  'hello@x.exemplo.test', 'inclui o remetente da organização');
select ok(not ((public.admin_prepare_invite(tests.id('client_new'), tests.id('staff_x')) -> 'organization') ? 'display_name'),
  'não inclui nomes da equipa');
select throws_ok($$ select public.admin_prepare_invite(tests.id('client_new'), tests.id('staff_y')) $$, 'P0002', 'not_found',
  'equipa de outra organização não convida');
select throws_ok($$ select public.admin_prepare_invite(tests.id('client_new'), tests.id('client_a')) $$, 'P0002', 'not_found',
  'cliente não convida');

reset role;
select tests.create_user('client_new');
set local role service_role;

select is(public.admin_user_id_by_email(' CLIENT_NEW@exemplo.test '), tests.id('client_new'), 'encontra a conta pelo email');
select lives_ok($$ select public.admin_register_invite(tests.id('client_new'), tests.id('client_new'), tests.id('staff_x')) $$,
  'regista o convite');
select is((select role::text from public.memberships where user_id = tests.id('client_new')), 'client', 'cria o acesso de cliente');
select ok((select invited_at is not null and last_invite_sent_at is not null from public.clients where id = tests.id('client_new')),
  'marca as datas do convite');
select is((select actor_user_id from public.activity_log where action = 'client.invited' and entity_id = tests.id('client_new')),
  tests.id('staff_x'), 'regista quem convidou');
select throws_ok($$ select public.admin_prepare_invite(tests.id('client_new'), tests.id('staff_x')) $$, 'P0001', 'invite_too_soon',
  'não reenvia no mesmo minuto');

reset role;
update public.clients set last_invite_sent_at = now() - interval '2 minutes' where id = tests.id('client_new');
set local role service_role;
select lives_ok($$ select public.admin_register_invite(tests.id('client_new'), tests.id('client_new'), tests.id('staff_x')) $$,
  'reenvia o convite');
select is((select count(*)::int from public.memberships where user_id = tests.id('client_new')), 1, 'reenviar não duplica o acesso');
select ok((select (metadata ->> 'resend')::boolean from public.activity_log where action = 'client.invited'
           and entity_id = tests.id('client_new') order by created_at desc, id desc limit 1), 'reenvio fica registado como tal');
select throws_ok($$ select public.admin_register_invite(tests.id('client_new'), tests.id('outsider'), tests.id('staff_x')) $$,
  'P0001', 'client_linked_to_other_user', 'cliente já ligado não passa para outra conta');

insert into public.clients (id, organization_id, full_name, email)
values (tests.id('client_staff'), tests.id('org_x'), 'Conta da Equipa', 'staff_x@exemplo.test');
select throws_ok($$ select public.admin_register_invite(tests.id('client_staff'), tests.id('staff_x'), tests.id('staff_x')) $$,
  'P0001', 'membership_conflict', 'conta da equipa não vira cliente na mesma organização');

-- Contexto dos emails de autenticação
select is((public.admin_email_context(tests.id('client_new'), 'x.exemplo.test') -> 'organization' ->> 'name'),
  'Organização X (teste)', 'email de login usa a marca da organização do cliente');
select is((public.admin_email_context(tests.id('client_new')) ->> 'locale'), 'pt-PT', 'idioma do cliente');
select is((public.admin_email_context(tests.id('client_new')) ->> 'full_name'), 'Nova Cliente', 'nome do cliente para a saudação');
select ok((public.admin_email_context(tests.id('staff_x')) ->> 'full_name') is null, 'equipa: sem nome no email');
select is((public.admin_email_context(tests.id('outsider'), 'y.exemplo.test') -> 'organization' ->> 'slug'), 'org-y',
  'sem acesso: usa a organização do hostname');
select ok(public.admin_email_context(tests.id('outsider')) is null, 'sem acesso nem hostname: sem contexto');

reset role;
select * from finish();
rollback;

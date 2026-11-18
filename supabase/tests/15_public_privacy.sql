begin;
select no_plan();
select tests.seed_fixtures();

insert into public.privacy_notices (organization_id, version, body, published_at) values
  (tests.id('org_x'), 2, '{"pt-PT":"RASCUNHO PRIVADO"}', null),
  (tests.id('org_x'), 3, '{"pt-PT":"PUBLICAÇÃO FUTURA"}', now() + interval '1 day'),
  (tests.id('org_x'), 4, '{"pt-PT":"AVISO X PUBLICADO"}', now());
update public.privacy_notices set body = '{"pt-PT":"AVISO Y PUBLICADO"}'
where organization_id = tests.id('org_y');
delete from public.privacy_consents where user_id = tests.id('client_a');

select tests.login_anon();
select is(public.get_org_public('X.EXEMPLO.TEST')->'privacy_notice'->>'version', '4', 'anónimo lê apenas a versão atual');
select is(public.get_org_public('org-x')->'privacy_notice'->'body'->>'pt-PT', 'AVISO X PUBLICADO', 'slug e hostname resolvem o mesmo aviso');
select is(public.get_org_public('y.exemplo.test')->'privacy_notice'->'body'->>'pt-PT', 'AVISO Y PUBLICADO', 'aviso pertence à organização do portal');
select ok(public.get_org_public('desconhecido.test') is null, 'host desconhecido não devolve aviso de outra organização');
select ok(public.get_org_public(null) is null, 'host nulo não tem fallback');
select ok(public.get_org_public('org-x')->'privacy_notice'->>'published_at' is not null, 'inclui a data de publicação');
select is((select array_agg(k order by k) from jsonb_object_keys(public.get_org_public('org-x')->'privacy_notice') k),
  array['body','id','published_at','retention_days','version'], 'projeção pública limitada aos campos do aviso');
select throws_ok($$ select * from public.privacy_notices $$, '42501', null, 'anónimo não lê a tabela nem rascunhos');
select throws_ok($$ select * from public.documents $$, '42501', null, 'anónimo continua sem acesso a documentos');
select throws_ok($$ select * from public.privacy_consents $$, '42501', null, 'confirmações de leitura permanecem privadas');
select throws_ok($$ select public.accept_privacy_notice('00000000-0000-0000-0000-000000000001') $$,
  '42501', null, 'consulta pública não permite confirmar leitura sem sessão');

select tests.login('client_a');
select is(public.get_org_public('org-x')->'privacy_notice'->>'id',
  public.get_session_context(tests.id('org_x'))->'notice'->>'id', 'leitura pública e confirmação usam o mesmo aviso em vigor');
select ok((public.get_session_context(tests.id('org_x'))->>'consent_required')::boolean, 'consultar não regista confirmação');
select is_empty($$ select * from public.documents $$, 'cliente sem confirmação continua sem documentos');

select tests.logout();
update public.privacy_notices set published_at = null where organization_id = tests.id('org_x') and version in (1,4);
select tests.login_anon();
select is(public.get_org_public('org-x')->'privacy_notice', 'null'::jsonb, 'sem publicação válida não expõe rascunho nem versão futura');
select tests.logout();
select is((select count(*) from private.document_purge_jobs)::int, 0, 'consulta não agenda eliminações');
select * from finish();
rollback;

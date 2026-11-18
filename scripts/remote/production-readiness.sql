-- Só leitura, para executar no projeto escolhido antes da publicação.
-- Não devolve emails, documentos, tokens, passwords ou segredos. Não certifica backups
-- nem as definições Auth/Vercel: esses pontos exigem inspeção separada das plataformas.
with target as (select * from public.organizations where slug = 'orvel'),
expected(version) as (values ('20261118110000'), ('20261118120000'), ('20261118122607'), ('20261118130000'), ('20261118140000'))
select jsonb_build_object(
  'organization_found', (select count(*) = 1 from target),
  'public_tables_without_rls', (select coalesce(jsonb_agg(c.relname), '[]')
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  'anonymous_table_grants', (select count(*) from information_schema.role_table_grants
    where table_schema = 'public' and grantee = 'anon'),
  'unexpected_anonymous_functions', (select coalesce(jsonb_agg(p.proname), '[]')
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public','private') and p.proname <> 'get_org_public'
      and has_function_privilege('anon', p.oid, 'execute')),
  'admin_functions_executable_by_users', (select coalesce(jsonb_agg(p.proname), '[]')
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'admin\_%'
      and has_function_privilege('authenticated', p.oid, 'execute')),
  'documents_bucket_private', (select not public from storage.buckets where id = 'documents'),
  'documents_size_limit', (select file_size_limit from storage.buckets where id = 'documents'),
  'documents_allowed_mime_types', (select allowed_mime_types from storage.buckets where id = 'documents'),
  'active_test_memberships', (select count(*) from public.memberships m join auth.users u on u.id = m.user_id
    where m.organization_id in (select id from target) and m.is_active and u.email like '%@exemplo.test'),
  'active_admins', (select count(*) from public.memberships m
    where m.organization_id in (select id from target) and m.is_active and m.role = 'admin'),
  'active_admins_without_verified_totp', (select count(*) from public.memberships m
    where m.organization_id in (select id from target) and m.is_active and m.role = 'admin'
      and not exists(select 1 from auth.mfa_factors f where f.user_id = m.user_id and f.factor_type = 'totp' and f.status = 'verified')),
  'current_privacy_notice_exists', exists(select 1 from target o
    where private.current_notice_id(o.id) is not null),
  'current_notice_contains_placeholder', exists(select 1 from public.privacy_notices n join target o on o.id = n.organization_id
    where n.id = private.current_notice_id(o.id) and (n.body::text ilike '%provisório%' or n.body::text ilike '%validar pelo advogado%')),
  'test_or_preview_hostnames', (select coalesce(jsonb_agg(h), '[]') from target, unnest(hostnames) h
    where h in ('localhost', '127.0.0.1') or h like '%.vercel.app'),
  'missing_migrations', (select coalesce(jsonb_agg(e.version), '[]') from expected e
    where not exists(select 1 from supabase_migrations.schema_migrations m where m.version = e.version)),
  'not_checked', jsonb_build_array('Platform account MFA/access', 'Auth settings and redirect URLs',
    'Vercel Production variables and HTTPS domain', 'Database restore', 'Storage file restore',
    'Legal approval of privacy and retention', 'Retention activation and scheduling', 'Email delivery and monitoring')
) as readiness;

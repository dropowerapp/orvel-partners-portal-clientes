-- Proteções estruturais: falham se uma tabela ou função nova for criada sem as regras base.
begin;
select no_plan();

select is_empty(
  $$ select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity $$,
  'todas as tabelas de public têm RLS ativa'
);

select is_empty(
  $$ select table_name || ':' || privilege_type from information_schema.role_table_grants
     where table_schema = 'public' and grantee = 'anon' $$,
  'anon não tem nenhuma permissão em tabelas de public'
);

select is_empty(
  $$ select tablename || ':' || policyname from pg_policies
     where schemaname = 'public' and not (roles @> array['authenticated']::name[]) $$,
  'todas as políticas de public são só para authenticated'
);

select is_empty(
  $$ select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('public', 'private') and p.prosecdef
       and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%') $$,
  'todas as funções security definer fixam o search_path'
);

select is(
  (select array_agg(p.proname::text order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')),
  array['get_org_public'],
  'anon só pode executar get_org_public'
);

select is_empty(
  $$ select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'private' and has_function_privilege('anon', p.oid, 'execute') $$,
  'anon não executa nenhuma função de private'
);

select is_empty(
  $$ select tablename || ':' || policyname from pg_policies
     where schemaname = 'storage' and tablename = 'objects' and cmd in ('SELECT', 'DELETE', 'ALL')
       and (qual like '%documents%' or with_check like '%documents%') $$,
  'nenhuma política permite ler ou apagar diretamente o bucket documents'
);

select * from finish();
rollback;

-- O Supabase pode instalar este event trigger em projetos recentes. É uma função
-- de infraestrutura, sem necessidade de execução pelo cliente da API. Não alterar
-- a função nem o event trigger que ativa RLS nas tabelas novas.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end $$;

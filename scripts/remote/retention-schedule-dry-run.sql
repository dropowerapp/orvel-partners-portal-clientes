-- Configuração opcional, não faz parte das migrações nem é executada automaticamente.
-- Executar só no projeto escolhido, depois do deploy de purge-documents e dos testes.
-- Requer pg_cron, pg_net e dois segredos no Vault (criados no painel, sem tokens no Git):
--   retention_function_url = https://<projeto>.supabase.co/functions/v1/purge-documents
--   retention_job_secret   = mesmo valor de RETENTION_JOB_SECRET na Edge Function
-- Manter RETENTION_ENABLED=false. O corpo abaixo simula, mesmo que a função esteja ativa.
begin;
do $$
begin
  if not exists(select 1 from vault.decrypted_secrets where name = 'retention_function_url'
    and decrypted_secret ~ '^https://[a-z0-9]+\.supabase\.co/functions/v1/purge-documents$')
    or not exists(select 1 from vault.decrypted_secrets where name = 'retention_job_secret' and length(decrypted_secret) >= 32) then
    raise exception 'retention_vault_not_configured';
  end if;
end $$;
-- 04:00 UTC = 08:00 no Dubai. A resposta HTTP tem de ser monitorizada em net._http_response;
-- o estado do cron por si só confirma apenas que o pedido foi colocado na fila.
select cron.schedule('orvel-retention-dry-run', '0 4 * * *', $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'retention_function_url'),
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'retention_job_secret')),
    body := '{"dry_run":true}'::jsonb,
    timeout_milliseconds := 10000
  );
$job$);
commit;

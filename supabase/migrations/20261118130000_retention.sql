-- Retenção de documentos registados. Não agenda nem ativa eliminações.
-- A Edge Function só apaga via Storage API, depois de reservar o trabalho no servidor.
create table private.document_purge_jobs (
  document_id uuid primary key references public.documents(id) on delete restrict,
  process_id uuid not null references public.processes(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  storage_path text not null,
  lease_id uuid not null,
  leased_until timestamptz not null,
  attempts integer not null default 1,
  last_error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
alter table private.document_purge_jobs enable row level security;
revoke all on private.document_purge_jobs from public, anon, authenticated;
create index document_purge_jobs_process_idx on private.document_purge_jobs(process_id);

-- Verificar também na gravação: um registo autorizado não pode apontar para outra pasta.
create or replace function private.guard_document_path() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_path text;
begin
  v_path := case when tg_table_name = 'proposals' then to_jsonb(new)->>'pdf_path' else to_jsonb(new)->>'storage_path' end;
  if v_path is not null and (
    v_path not like new.organization_id::text || '/' || new.process_id::text || '/%'
    or position('..' in v_path) > 0 or position(chr(92) in v_path) > 0
    or position('//' in v_path) > 0 or right(v_path, 1) = '/') then
    raise exception 'document_path_invalid' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger guard_path before insert or update on public.documents
  for each row execute function private.guard_document_path();
create trigger guard_path before insert or update on public.proposals
  for each row execute function private.guard_document_path();

create or replace function private.guard_retention_process() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- A reserva e o fecho do processo usam o mesmo bloqueio. Não reabrir durante o pedido HTTP.
  if exists(select 1 from private.document_purge_jobs where process_id = old.id)
     or exists(select 1 from public.documents where process_id = old.id and purged_at is not null) then
    if (new.completed_at is null and new.cancelled_at is null)
       or new.sensitive_purge_on is distinct from old.sensitive_purge_on then
      raise exception 'retention_started' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
create trigger guard_retention before update on public.processes
  for each row execute function private.guard_retention_process();

create or replace function private.guard_retention_document() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.role() in ('anon', 'authenticated') and
     (new.purged_at, new.purged_reason) is distinct from (old.purged_at, old.purged_reason) then
    raise exception 'retention_managed' using errcode = 'P0001';
  end if;
  if exists(select 1 from private.document_purge_jobs where document_id = old.id) and
     (new.organization_id, new.process_id, new.storage_path, new.is_sensitive) is distinct from
     (old.organization_id, old.process_id, old.storage_path, old.is_sensitive) then
    raise exception 'retention_started' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger guard_retention before update on public.documents
  for each row execute function private.guard_retention_document();

create or replace function public.admin_preview_document_purges(p_org uuid, p_limit integer default 25)
returns table(document_id uuid, process_id uuid, organization_id uuid, storage_path text)
language sql stable security definer set search_path = '' as $$
  select d.id, d.process_id, d.organization_id, d.storage_path
  from public.documents d join public.processes p on p.id = d.process_id
  where p.organization_id = p_org and d.is_sensitive and d.purged_at is null
    and (p.completed_at is not null or p.cancelled_at is not null)
    and p.sensitive_purge_on <= private.org_today(p_org)
  order by p.sensitive_purge_on, d.id limit greatest(0, least(coalesce(p_limit, 25), 100))
$$;

create or replace function public.admin_claim_document_purges(p_org uuid, p_limit integer default 25)
returns table(document_id uuid, process_id uuid, organization_id uuid, storage_path text, lease_id uuid)
language plpgsql security definer set search_path = '' as $$
declare v_proc record; v_doc record; v_lease uuid; v_count integer := 0;
begin
  if p_org is null or p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  for v_proc in select p.* from public.processes p
    where p.organization_id = p_org and (p.completed_at is not null or p.cancelled_at is not null)
      and p.sensitive_purge_on <= private.org_today(p_org)
      and exists(select 1 from public.documents d left join private.document_purge_jobs j on j.document_id = d.id
        where d.process_id = p.id and d.is_sensitive and d.purged_at is null
          and (j.document_id is null or (j.completed_at is null and j.leased_until <= now())))
    order by p.sensitive_purge_on, p.id for update of p skip locked
  loop
    for v_doc in select d.* from public.documents d left join private.document_purge_jobs j on j.document_id = d.id
      where d.process_id = v_proc.id and d.is_sensitive and d.purged_at is null
        and (j.document_id is null or (j.completed_at is null and j.leased_until <= now()))
      order by d.id for update of d skip locked
    loop
      v_lease := gen_random_uuid();
      insert into private.document_purge_jobs as job(document_id, process_id, organization_id, storage_path, lease_id, leased_until)
        values(v_doc.id, v_doc.process_id, v_doc.organization_id, v_doc.storage_path, v_lease, now() + interval '5 minutes')
        on conflict on constraint document_purge_jobs_pkey do update set
          lease_id = excluded.lease_id, leased_until = excluded.leased_until, attempts = job.attempts + 1, last_error = null;
      document_id := v_doc.id; process_id := v_doc.process_id; organization_id := v_doc.organization_id;
      storage_path := v_doc.storage_path; lease_id := v_lease;
      return next;
      v_count := v_count + 1;
      if v_count >= p_limit then return; end if;
    end loop;
  end loop;
end $$;

create or replace function public.admin_finish_document_purge(p_document_id uuid, p_lease_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_job private.document_purge_jobs;
begin
  select * into v_job from private.document_purge_jobs where document_id = p_document_id;
  if v_job.document_id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform 1 from public.processes where id = v_job.process_id for update;
  select * into v_job from private.document_purge_jobs where document_id = p_document_id for update;
  if v_job.lease_id is distinct from p_lease_id then raise exception 'retention_lease_expired' using errcode = 'P0001'; end if;
  if v_job.completed_at is not null then return; end if;
  -- O SQL nunca elimina objetos: só confirma a ausência depois do sucesso da Storage API.
  if exists(select 1 from storage.objects where bucket_id = 'documents' and name = v_job.storage_path) then
    raise exception 'retention_object_present' using errcode = 'P0001';
  end if;
  update public.documents set purged_at = now(), purged_reason = 'retention_expired' where id = p_document_id;
  update private.document_purge_jobs set completed_at = now(), last_error = null where document_id = p_document_id;
  insert into public.activity_log(organization_id, process_id, actor_role, action, entity_type, entity_id, metadata)
    values(v_job.organization_id, v_job.process_id, 'system', 'document.purged', 'document', p_document_id,
      jsonb_build_object('reason', 'retention_expired'));
end $$;

create or replace function public.admin_fail_document_purge(p_document_id uuid, p_lease_id uuid, p_error text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_error is null or p_error not in ('storage_delete_failed', 'confirmation_failed', 'invalid_path') then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  update private.document_purge_jobs set last_error = p_error, leased_until = now()
    where document_id = p_document_id and lease_id = p_lease_id and completed_at is null;
end $$;

revoke execute on all functions in schema private from public;
revoke all on function public.admin_preview_document_purges(uuid,integer), public.admin_claim_document_purges(uuid,integer),
  public.admin_finish_document_purge(uuid,uuid), public.admin_fail_document_purge(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.admin_preview_document_purges(uuid,integer), public.admin_claim_document_purges(uuid,integer),
  public.admin_finish_document_purge(uuid,uuid), public.admin_fail_document_purge(uuid,uuid,text) to service_role;

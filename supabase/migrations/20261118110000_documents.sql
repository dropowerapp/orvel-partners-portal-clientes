-- Etapa 5: operações de documentos. A autorização é verificada no servidor.
-- Bloqueio por processo, seguido do pedido, para serializar envio/revisão/conclusão.
create or replace function private.assert_staff_process(p_process_id uuid)
returns public.processes language plpgsql security definer set search_path = '' as $$
declare v_proc public.processes;
begin
  select p.* into v_proc from public.processes p
  where p.id = p_process_id and public.is_staff_of(p.organization_id) for update;
  if v_proc.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if v_proc.completed_at is not null or v_proc.cancelled_at is not null then
    raise exception 'process_closed' using errcode = 'P0001';
  end if;
  return v_proc;
end $$;

create or replace function public.create_document_request(
  p_process_id uuid, p_person_id uuid, p_type_id uuid,
  p_label text default null, p_instructions text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_proc public.processes := private.assert_staff_process(p_process_id); v_id uuid;
begin
  if not exists (select 1 from public.document_types where id = p_type_id
    and organization_id = v_proc.organization_id and direction = 'upload' and is_active) then
    raise exception 'document_type_invalid' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.people where id = p_person_id and process_id = p_process_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  insert into public.document_requests (organization_id, process_id, person_id, document_type_id, custom_label, instructions)
  values (v_proc.organization_id, p_process_id, p_person_id, p_type_id,
    private.clean_text(p_label, 200), nullif(left(trim(p_instructions), 2000), '')) returning id into v_id;
  perform private.log_activity(v_proc.organization_id, p_process_id, 'document_request.created', 'document_request', v_id);
  return v_id;
end $$;

create or replace function public.remove_document_request(p_request_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_request public.document_requests; v_proc public.processes;
begin
  select * into v_request from public.document_requests where id = p_request_id;
  v_proc := private.assert_staff_process(v_request.process_id);
  select * into v_request from public.document_requests where id = p_request_id for update;
  if v_request.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if v_request.status <> 'pending' or exists (select 1 from public.documents where request_id = p_request_id) then
    raise exception 'document_request_has_files' using errcode = 'P0001';
  end if;
  delete from public.document_requests where id = p_request_id;
  perform private.log_activity(v_proc.organization_id, v_proc.id, 'document_request.removed', 'document_request', p_request_id);
end $$;

create or replace function public.review_document_request(
  p_request_id uuid, p_document_id uuid, p_status public.request_status, p_reason text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare v_request public.document_requests; v_proc public.processes; v_latest uuid;
begin
  select * into v_request from public.document_requests where id = p_request_id;
  v_proc := private.assert_staff_process(v_request.process_id);
  select * into v_request from public.document_requests where id = p_request_id for update;
  if p_status is null or p_status not in ('approved', 'rejected') then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  if p_status = 'rejected' and nullif(trim(p_reason), '') is null then
    raise exception 'rejection_reason_required' using errcode = 'P0001';
  end if;
  select id into v_latest from public.documents
  where request_id = p_request_id and purged_at is null order by created_at desc, id desc limit 1;
  if v_latest is null or v_latest is distinct from p_document_id or v_request.status not in ('submitted', p_status) then
    raise exception 'document_review_conflict' using errcode = 'P0001';
  end if;
  if v_request.status = p_status then return; end if;
  update public.document_requests
  set status = p_status, rejection_reason = case when p_status = 'rejected' then left(trim(p_reason), 2000) else null end
  where id = p_request_id;
end $$;

-- Repetir a confirmação do MESMO objeto devolve o mesmo documento.
-- Uma segunda submissão diferente só é permitida depois de uma rejeição.
create or replace function public.register_upload(p_request_id uuid, p_storage_path text, p_file_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_request public.document_requests;
  v_proc public.processes;
  v_metadata jsonb;
  v_doc_id uuid;
begin
  select * into v_request from public.document_requests where id = p_request_id;
  if v_request.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  v_proc := private.assert_client_process(v_request.process_id, false);
  perform 1 from public.processes where id = v_proc.id for update;
  select * into v_request from public.document_requests where id = p_request_id for update;
  if v_request.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  select id into v_doc_id from public.documents where storage_path = p_storage_path and request_id = p_request_id;
  if v_doc_id is not null then return v_doc_id; end if;
  -- Releitura depois do bloqueio: a conclusão pode ter ocorrido entretanto.
  v_proc := private.assert_client_process(v_request.process_id);
  if v_request.status not in ('pending', 'rejected') then
    raise exception 'request_not_open' using errcode = 'P0001';
  end if;
  if p_storage_path is null
     or p_storage_path not like (v_proc.organization_id::text || '/' || v_proc.id::text || '/uploads/' || p_request_id::text || '/%')
     or cardinality(string_to_array(p_storage_path, '/')) <> 5 or position('..' in p_storage_path) > 0 then
    raise exception 'document_path_invalid' using errcode = 'P0001';
  end if;
  select metadata into v_metadata from storage.objects where bucket_id = 'documents' and name = p_storage_path;
  if not found then raise exception 'upload_not_found' using errcode = 'P0001'; end if;
  if coalesce(v_metadata ->> 'mimetype', '') not in ('application/pdf', 'image/jpeg', 'image/png')
     or coalesce(v_metadata ->> 'size', '') !~ '^[0-9]{1,10}$' then
    raise exception 'document_metadata_invalid' using errcode = 'P0001';
  end if;
  if (v_metadata ->> 'size')::bigint not between 1 and 10485760 then
    raise exception 'document_metadata_invalid' using errcode = 'P0001';
  end if;
  insert into public.documents (organization_id, process_id, person_id, request_id, document_type_id, direction,
    storage_path, file_name, mime_type, size_bytes, created_at)
  values (v_proc.organization_id, v_proc.id, v_request.person_id, p_request_id, v_request.document_type_id, 'upload',
    p_storage_path, coalesce(private.clean_text(p_file_name, 200), 'documento'),
    v_metadata ->> 'mimetype', (v_metadata ->> 'size')::bigint, clock_timestamp()) returning id into v_doc_id;
  update public.document_requests set status = 'submitted', rejection_reason = null where id = p_request_id;
  return v_doc_id;
end $$;

create or replace function public.register_issued_document(
  p_process_id uuid, p_type_id uuid, p_storage_path text, p_file_name text,
  p_person_id uuid default null, p_title text default null,
  p_issued_on date default null, p_expires_on date default null, p_visible boolean default true
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_proc public.processes := private.assert_staff_process(p_process_id); v_metadata jsonb; v_id uuid;
begin
  select id into v_id from public.documents
  where storage_path = p_storage_path and process_id = p_process_id and direction = 'issued';
  if v_id is not null then return v_id; end if;
  if not exists (select 1 from public.document_types where id = p_type_id
    and organization_id = v_proc.organization_id and direction = 'issued' and is_active) then
    raise exception 'document_type_invalid' using errcode = 'P0001';
  end if;
  if p_person_id is not null and not exists (select 1 from public.people where id = p_person_id and process_id = p_process_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if p_expires_on < p_issued_on then raise exception 'document_dates_invalid' using errcode = 'P0001'; end if;
  if p_storage_path is null or p_storage_path not like (v_proc.organization_id::text || '/' || p_process_id::text || '/issued/%')
     or cardinality(string_to_array(p_storage_path, '/')) <> 4 or position('..' in p_storage_path) > 0 then
    raise exception 'document_path_invalid' using errcode = 'P0001';
  end if;
  select metadata into v_metadata from storage.objects where bucket_id = 'documents' and name = p_storage_path;
  if not found then raise exception 'upload_not_found' using errcode = 'P0001'; end if;
  if coalesce(v_metadata ->> 'mimetype', '') not in ('application/pdf', 'image/jpeg', 'image/png')
     or coalesce(v_metadata ->> 'size', '') !~ '^[0-9]{1,10}$' then
    raise exception 'document_metadata_invalid' using errcode = 'P0001';
  end if;
  if (v_metadata ->> 'size')::bigint not between 1 and 10485760 then
    raise exception 'document_metadata_invalid' using errcode = 'P0001';
  end if;
  insert into public.documents (organization_id, process_id, person_id, document_type_id, direction, storage_path,
    file_name, mime_type, size_bytes, title, issued_on, expires_on, visible_to_client)
  values (v_proc.organization_id, p_process_id, p_person_id, p_type_id, 'issued', p_storage_path,
    coalesce(private.clean_text(p_file_name, 200), 'documento'), v_metadata ->> 'mimetype', (v_metadata ->> 'size')::bigint,
    private.clean_text(p_title, 200), p_issued_on, p_expires_on, coalesce(p_visible, true))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.set_document_visibility(p_document_id uuid, p_visible boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_doc public.documents; v_proc public.processes;
begin
  select * into v_doc from public.documents where id = p_document_id;
  v_proc := private.assert_staff_process(v_doc.process_id);
  if v_doc.direction <> 'issued' or v_doc.purged_at is not null or p_visible is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  update public.documents set visible_to_client = p_visible where id = p_document_id;
  if v_doc.visible_to_client is distinct from p_visible then
    perform private.log_activity(v_proc.organization_id, v_proc.id, 'document.visibility_changed',
      'document', p_document_id, jsonb_build_object('visible_to_client', p_visible));
  end if;
end $$;

revoke execute on all functions in schema private from public;
revoke execute on function public.create_document_request(uuid, uuid, uuid, text, text),
  public.set_document_visibility(uuid, boolean), public.remove_document_request(uuid), public.review_document_request(uuid, uuid, public.request_status, text),
  public.register_upload(uuid, text, text),
  public.register_issued_document(uuid, uuid, text, text, uuid, text, date, date, boolean) from public, anon;
grant execute on function public.create_document_request(uuid, uuid, uuid, text, text),
  public.set_document_visibility(uuid, boolean), public.remove_document_request(uuid), public.review_document_request(uuid, uuid, public.request_status, text),
  public.register_upload(uuid, text, text),
  public.register_issued_document(uuid, uuid, text, text, uuid, text, date, date, boolean) to authenticated;

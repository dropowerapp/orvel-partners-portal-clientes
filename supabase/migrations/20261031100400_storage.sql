-- Storage: bucket privado para documentos e bucket público para logótipos.
-- Não há nenhuma política de leitura no bucket documents: os downloads passam todos pela
-- Edge Function sign-download (verifica o acesso, regista os sensíveis, URL de 60 s).
-- Também não há políticas de apagar/alterar: a limpeza automática usa a service role.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('documents', 'documents', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png']),
  ('branding', 'branding', true, 2097152, array['image/png', 'image/svg+xml', 'image/jpeg'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Cliente: só {org}/{processo}/uploads/{pedido}/{ficheiro}, num pedido seu pendente ou rejeitado.
create or replace function private.client_can_upload(p_name text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  v_parts text[] := string_to_array(p_name, '/');
begin
  if cardinality(v_parts) <> 5 or v_parts[3] <> 'uploads' or coalesce(v_parts[5], '') = ''
     or position('..' in p_name) > 0 then
    return false;
  end if;
  return exists (
    select 1
    from public.document_requests r
    join public.processes p on p.id = r.process_id
    where r.id::text = v_parts[4]
      and p.id::text = v_parts[2]
      and p.organization_id::text = v_parts[1]
      and p.id in (select private.client_process_ids())
      and r.status in ('pending', 'rejected')
      and p.completed_at is null
      and p.cancelled_at is null
  );
end
$$;

-- Equipa: qualquer caminho dentro da pasta da sua organização.
create or replace function private.staff_can_write_object(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select position('..' in p_name) = 0
    and (string_to_array(p_name, '/'))[1] in (select o::text from private.staff_org_ids() o)
$$;

revoke execute on all functions in schema private from public;
grant execute on function private.client_can_upload(text), private.staff_can_write_object(text) to authenticated;

create policy documents_client_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and private.client_can_upload(name));

create policy documents_staff_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and private.staff_can_write_object(name));

create policy branding_staff_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'branding' and private.staff_can_write_object(name));

create policy branding_staff_update on storage.objects for update to authenticated
  using (bucket_id = 'branding' and private.staff_can_write_object(name))
  with check (bucket_id = 'branding' and private.staff_can_write_object(name));

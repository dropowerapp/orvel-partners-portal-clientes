-- Etapa 6. Escritas validadas, com MFA, isolamento por organização e controlo de versões.
-- Os prazos continuam a ser geridos após a conclusão: as renovações não terminam com o processo.
create or replace function public.save_timeline_step(
  p_process_id uuid, p_title text, p_phase text, p_status public.step_status default 'todo',
  p_planned_on date default null, p_done_on date default null, p_note text default null,
  p_step_id uuid default null, p_expected_updated_at timestamptz default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_proc public.processes := private.assert_staff_process(p_process_id);
  v_step public.timeline_steps; v_id uuid; v_position integer;
begin
  if nullif(trim(p_title), '') is null or length(p_title) > 200 or length(p_note) > 2000
     or p_phase is null or p_phase not in ('documents', 'incorporation', 'residence', 'bank', 'done')
     or p_status is null then raise exception 'invalid_input' using errcode = '22023'; end if;
  if p_status = 'done' and p_done_on > private.org_today(v_proc.organization_id) then
    raise exception 'timeline_future_completion' using errcode = 'P0001';
  end if;
  if p_step_id is null then
    select coalesce(max(position), 0) + 10 into v_position from public.timeline_steps where process_id = p_process_id;
    if v_position > 32767 then raise exception 'invalid_input' using errcode = '22023'; end if;
    insert into public.timeline_steps (organization_id, process_id, position, title, phase, status, planned_on, done_on, client_note)
    values (v_proc.organization_id, p_process_id, v_position, jsonb_build_object('pt-PT', trim(p_title)), p_phase, p_status, p_planned_on,
      case when p_status = 'done' then coalesce(p_done_on, private.org_today(v_proc.organization_id)) end, nullif(trim(p_note), ''))
    returning id into v_id;
  else
    select * into v_step from public.timeline_steps where id = p_step_id and process_id = p_process_id for update;
    if v_step.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
    if v_step.auto_event is not null then raise exception 'timeline_automatic_locked' using errcode = 'P0001'; end if;
    if v_step.updated_at is distinct from p_expected_updated_at then raise exception 'schedule_conflict' using errcode = 'P0001'; end if;
    update public.timeline_steps set title = title || jsonb_build_object('pt-PT', trim(p_title)), phase = p_phase,
      status = p_status, planned_on = p_planned_on,
      done_on = case when p_status = 'done' then coalesce(p_done_on, private.org_today(v_proc.organization_id)) end,
      client_note = nullif(trim(p_note), '') where id = p_step_id;
    v_id := p_step_id;
  end if;
  perform private.log_activity(v_proc.organization_id, p_process_id,
    case when p_step_id is null then 'timeline.created' else 'timeline.updated' end,
    'timeline_step', v_id, jsonb_build_object('title', trim(p_title), 'status', p_status));
  return v_id;
end $$;

create or replace function public.remove_timeline_step(p_step_id uuid, p_expected_updated_at timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
declare v_step public.timeline_steps; v_proc public.processes;
begin
  select * into v_step from public.timeline_steps where id = p_step_id;
  v_proc := private.assert_staff_process(v_step.process_id);
  select * into v_step from public.timeline_steps where id = p_step_id for update;
  if v_step.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if v_step.auto_event is not null then raise exception 'timeline_automatic_locked' using errcode = 'P0001'; end if;
  if v_step.updated_at is distinct from p_expected_updated_at then raise exception 'schedule_conflict' using errcode = 'P0001'; end if;
  delete from public.timeline_steps where id = p_step_id;
  perform private.log_activity(v_proc.organization_id, v_proc.id, 'timeline.removed', 'timeline_step', p_step_id,
    jsonb_build_object('title', v_step.title ->> 'pt-PT'));
end $$;

create or replace function public.save_deadline(
  p_process_id uuid, p_type public.deadline_type, p_due_on date,
  p_title text default null, p_person_id uuid default null, p_status public.deadline_status default 'open',
  p_deadline_id uuid default null, p_expected_updated_at timestamptz default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_proc public.processes; v_deadline public.deadlines; v_id uuid;
begin
  select * into v_proc from public.processes where id = p_process_id and public.is_staff_of(organization_id) for update;
  if v_proc.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if p_type is null or p_due_on is null or p_status is null or length(p_title) > 200
    or (p_deadline_id is null and p_type = 'other' and nullif(trim(p_title), '') is null) then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  if p_person_id is not null and not exists (select 1 from public.people where id = p_person_id and process_id = p_process_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if p_deadline_id is null then
    insert into public.deadlines (organization_id, process_id, person_id, deadline_type, title, due_on, status, created_by)
    values (v_proc.organization_id, p_process_id, p_person_id, p_type, nullif(trim(p_title), ''), p_due_on, p_status, auth.uid())
    returning id into v_id;
  else
    select * into v_deadline from public.deadlines where id = p_deadline_id and process_id = p_process_id for update;
    if v_deadline.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
    if v_deadline.updated_at is distinct from p_expected_updated_at then raise exception 'schedule_conflict' using errcode = 'P0001'; end if;
    if v_deadline.document_id is null and p_type = 'other' and nullif(trim(p_title), '') is null then
      raise exception 'invalid_input' using errcode = '22023';
    end if;
    -- Um prazo documental mantém a pessoa, o tipo e a validade do documento de origem.
    -- A renovação documental é confirmada apenas ao emitir o documento seguinte.
    if v_deadline.document_id is not null and (
      p_type is distinct from v_deadline.deadline_type or p_due_on is distinct from v_deadline.due_on
      or p_person_id is distinct from v_deadline.person_id or nullif(trim(p_title), '') is distinct from v_deadline.title
      or p_status = 'renewed' or v_deadline.status = 'renewed') then
      raise exception 'deadline_document_locked' using errcode = 'P0001';
    end if;
    update public.deadlines set deadline_type = p_type, title = nullif(trim(p_title), ''), person_id = p_person_id,
      due_on = p_due_on, status = p_status,
      reminders_sent = case when due_on is distinct from p_due_on or
        (status in ('renewed', 'dismissed') and p_status in ('open', 'renewing')) then '{}'::int[] else reminders_sent end
    where id = p_deadline_id;
    v_id := p_deadline_id;
  end if;
  perform private.log_activity(v_proc.organization_id, p_process_id,
    case when p_deadline_id is null then 'deadline.created' else 'deadline.updated' end,
    'deadline', v_id, jsonb_build_object('title', coalesce(nullif(trim(p_title), ''), p_type::text), 'status', p_status, 'due_on', p_due_on));
  return v_id;
end $$;

-- Cliente só vê o prazo documental quando o documento de origem também está disponível.
drop policy client_select on public.deadlines;
create policy client_select on public.deadlines for select to authenticated using (
  organization_id in (select private.client_org_ids()) and process_id in (select private.client_process_ids())
  and (document_id is null or exists (select 1 from public.documents d where d.id = deadlines.document_id))
);

-- As funções internas de sincronização continuam a escrever como proprietário.
revoke insert, update, delete on public.timeline_steps, public.deadlines from authenticated;
revoke all on function public.save_timeline_step(uuid,text,text,public.step_status,date,date,text,uuid,timestamptz) from public, anon;
revoke all on function public.remove_timeline_step(uuid,timestamptz) from public, anon;
revoke all on function public.save_deadline(uuid,public.deadline_type,date,text,uuid,public.deadline_status,uuid,timestamptz) from public, anon;
grant execute on function public.save_timeline_step(uuid,text,text,public.step_status,date,date,text,uuid,timestamptz) to authenticated;
grant execute on function public.remove_timeline_step(uuid,timestamptz) to authenticated;
grant execute on function public.save_deadline(uuid,public.deadline_type,date,text,uuid,public.deadline_status,uuid,timestamptz) to authenticated;

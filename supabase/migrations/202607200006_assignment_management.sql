begin;

-- Assignments are created only through the protected RPC below.
revoke insert, update, delete on public.exam_assignments from authenticated;
grant select on public.exam_assignments to authenticated;

create or replace function public.assign_exam_to_candidate(
  p_examination_id uuid,
  p_candidate_email text,
  p_available_from timestamptz default now(),
  p_expires_at timestamptz default null,
  p_max_attempts integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate public.profiles%rowtype;
  v_assignment public.exam_assignments%rowtype;
begin
  if not public.is_exam_admin() then
    raise exception 'Only an examination administrator or Super Administrator may assign examinations.';
  end if;
  if p_max_attempts is not null and (p_max_attempts < 1 or p_max_attempts > 10) then
    raise exception 'Maximum attempts must be between 1 and 10.';
  end if;
  if p_expires_at is not null and p_available_from is not null and p_expires_at <= p_available_from then
    raise exception 'Assignment expiry must be after its availability date.';
  end if;

  select * into v_candidate
  from public.profiles
  where lower(email) = lower(trim(p_candidate_email))
    and role = 'candidate'
    and is_active = true;

  if not found then
    raise exception 'An active candidate account with this email was not found.';
  end if;

  insert into public.exam_assignments (
    examination_id, candidate_id, assigned_by,
    available_from, expires_at, max_attempts_override, status
  ) values (
    p_examination_id, v_candidate.id, auth.uid(),
    p_available_from, p_expires_at, p_max_attempts, 'assigned'
  )
  on conflict (examination_id, candidate_id) do update
  set assigned_by = auth.uid(),
      available_from = excluded.available_from,
      expires_at = excluded.expires_at,
      max_attempts_override = excluded.max_attempts_override,
      status = 'assigned',
      updated_at = now()
  returning * into v_assignment;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(), 'assign_exam', 'exam_assignment', v_assignment.id::text,
    jsonb_build_object('candidate_email', v_candidate.email, 'examination_id', p_examination_id)
  );

  return jsonb_build_object(
    'assignmentId', v_assignment.id,
    'candidateId', v_candidate.id,
    'candidateName', v_candidate.full_name,
    'candidateEmail', v_candidate.email,
    'examinationId', v_assignment.examination_id,
    'status', v_assignment.status
  );
end;
$$;

revoke all on function public.assign_exam_to_candidate(uuid, text, timestamptz, timestamptz, integer) from public;
grant execute on function public.assign_exam_to_candidate(uuid, text, timestamptz, timestamptz, integer) to authenticated;

commit;

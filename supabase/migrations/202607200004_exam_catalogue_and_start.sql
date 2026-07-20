begin;

alter table public.examinations
  add column if not exists allow_self_enrollment boolean not null default false;

create or replace function public.get_available_exams()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(exam_payload order by title), '[]'::jsonb)
  from (
    select
      e.title,
      jsonb_build_object(
        'id', e.id,
        'title', e.title,
        'course', p.code,
        'durationMinutes', e.duration_minutes,
        'questionCount', (select count(*) from public.questions q where q.examination_id = e.id and q.is_active),
        'description', coalesce(p.description, e.instructions, ''),
        'questions', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id', q.id,
              'text', q.question_text,
              'options', coalesce((
                select jsonb_agg(qo.option_text order by qo.position)
                from public.question_options qo
                where qo.question_id = q.id
              ), '[]'::jsonb)
            ) order by q.position
          )
          from public.questions q
          where q.examination_id = e.id and q.is_active
        ), '[]'::jsonb)
      ) as exam_payload
    from public.examinations e
    join public.programmes p on p.id = e.programme_id
    where e.status = 'published'
      and (e.starts_at is null or e.starts_at <= now())
      and (e.ends_at is null or e.ends_at > now())
      and (
        public.is_exam_staff()
        or e.allow_self_enrollment
        or exists (
          select 1
          from public.exam_assignments ea
          where ea.examination_id = e.id
            and ea.candidate_id = auth.uid()
            and ea.status = 'assigned'
            and (ea.available_from is null or ea.available_from <= now())
            and (ea.expires_at is null or ea.expires_at > now())
        )
      )
  ) available;
$$;

create or replace function public.start_exam_secure(
  p_examination_id uuid,
  p_client_fingerprint jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate_id uuid := auth.uid();
  v_exam public.examinations%rowtype;
  v_assignment public.exam_assignments%rowtype;
  v_session public.exam_sessions%rowtype;
  v_attempt_count integer;
  v_max_attempts integer;
  v_expiry timestamptz;
  v_test jsonb;
begin
  if v_candidate_id is null then
    raise exception 'Authentication is required.';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = v_candidate_id and role = 'candidate' and is_active = true
  ) then
    raise exception 'Only an active candidate account may start an examination.';
  end if;

  select * into v_exam
  from public.examinations
  where id = p_examination_id
  for update;

  if not found or v_exam.status <> 'published' then
    raise exception 'This examination is not available.';
  end if;
  if v_exam.starts_at is not null and v_exam.starts_at > now() then
    raise exception 'This examination has not opened.';
  end if;
  if v_exam.ends_at is not null and v_exam.ends_at <= now() then
    raise exception 'This examination has closed.';
  end if;

  select * into v_assignment
  from public.exam_assignments
  where examination_id = p_examination_id and candidate_id = v_candidate_id
  for update;

  if not found then
    if not v_exam.allow_self_enrollment then
      raise exception 'You have not been assigned to this examination.';
    end if;

    insert into public.exam_assignments (
      examination_id, candidate_id, status, available_from
    ) values (
      p_examination_id, v_candidate_id, 'assigned', now()
    ) returning * into v_assignment;
  end if;

  if v_assignment.status <> 'assigned' then
    raise exception 'This examination assignment is not active.';
  end if;
  if v_assignment.available_from is not null and v_assignment.available_from > now() then
    raise exception 'This examination assignment is not yet available.';
  end if;
  if v_assignment.expires_at is not null and v_assignment.expires_at <= now() then
    update public.exam_assignments set status = 'expired' where id = v_assignment.id;
    raise exception 'This examination assignment has expired.';
  end if;

  update public.exam_sessions
  set status = 'expired', updated_at = now()
  where assignment_id = v_assignment.id
    and status = 'active'
    and expires_at <= now();

  select * into v_session
  from public.exam_sessions
  where assignment_id = v_assignment.id and status = 'active'
  order by started_at desc
  limit 1;

  if not found then
    select count(*) into v_attempt_count
    from public.attempts
    where examination_id = p_examination_id and candidate_id = v_candidate_id;

    v_max_attempts := coalesce(v_assignment.max_attempts_override, v_exam.max_attempts);
    if v_attempt_count >= v_max_attempts then
      update public.exam_assignments set status = 'completed' where id = v_assignment.id;
      raise exception 'The maximum number of attempts has been reached.';
    end if;

    v_expiry := now() + make_interval(mins => v_exam.duration_minutes);
    if v_exam.ends_at is not null then v_expiry := least(v_expiry, v_exam.ends_at); end if;
    if v_assignment.expires_at is not null then v_expiry := least(v_expiry, v_assignment.expires_at); end if;

    insert into public.exam_sessions (
      assignment_id, examination_id, candidate_id, expires_at, client_fingerprint
    ) values (
      v_assignment.id, p_examination_id, v_candidate_id, v_expiry, coalesce(p_client_fingerprint, '{}'::jsonb)
    ) returning * into v_session;
  end if;

  select jsonb_build_object(
    'id', e.id,
    'title', e.title,
    'course', p.code,
    'durationMinutes', greatest(1, ceil(extract(epoch from (v_session.expires_at - now())) / 60.0)::integer),
    'questionCount', (select count(*) from public.questions q where q.examination_id = e.id and q.is_active),
    'description', coalesce(p.description, e.instructions, ''),
    'sessionId', v_session.id,
    'expiresAt', v_session.expires_at,
    'assignmentId', v_assignment.id,
    'questions', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', q.id,
          'text', q.question_text,
          'options', coalesce((
            select jsonb_agg(qo.option_text order by qo.position)
            from public.question_options qo
            where qo.question_id = q.id
          ), '[]'::jsonb)
        ) order by q.position
      )
      from public.questions q
      where q.examination_id = e.id and q.is_active
    ), '[]'::jsonb)
  ) into v_test
  from public.examinations e
  join public.programmes p on p.id = e.programme_id
  where e.id = p_examination_id;

  return v_test;
end;
$$;

revoke all on function public.get_available_exams() from public;
revoke all on function public.start_exam_secure(uuid, jsonb) from public;
grant execute on function public.get_available_exams() to authenticated;
grant execute on function public.start_exam_secure(uuid, jsonb) to authenticated;

commit;

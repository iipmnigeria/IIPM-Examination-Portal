begin;

create or replace function public.submit_exam_secure(
  p_session_id uuid,
  p_answers jsonb,
  p_logs jsonb default '[]'::jsonb,
  p_tab_away_count integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate_id uuid := auth.uid();
  v_session public.exam_sessions%rowtype;
  v_assignment public.exam_assignments%rowtype;
  v_exam public.examinations%rowtype;
  v_question record;
  v_selected_index integer;
  v_selected_option uuid;
  v_raw_score numeric := 0;
  v_maximum_score numeric := 0;
  v_percentage numeric := 0;
  v_log_score integer := 0;
  v_suspicious numeric := 0;
  v_status text := 'submitted';
  v_attempt_id uuid;
  v_candidate_name text;
  v_attempt_count integer;
  v_max_attempts integer;
begin
  if v_candidate_id is null then
    raise exception 'Authentication is required.';
  end if;

  select * into v_session
  from public.exam_sessions
  where id = p_session_id
  for update;

  if not found or v_session.candidate_id <> v_candidate_id then
    raise exception 'The examination session was not found.';
  end if;
  if v_session.status <> 'active' then
    raise exception 'This examination session is no longer active.';
  end if;
  if v_session.expires_at <= now() then
    update public.exam_sessions set status = 'expired', updated_at = now() where id = p_session_id;
    raise exception 'The examination session has expired.';
  end if;

  select * into v_exam from public.examinations where id = v_session.examination_id;
  select * into v_assignment from public.exam_assignments where id = v_session.assignment_id;

  for v_question in
    select q.id, q.points
    from public.questions q
    where q.examination_id = v_session.examination_id and q.is_active
    order by q.position
  loop
    v_selected_index := null;
    v_selected_option := null;

    begin
      v_selected_index := nullif(p_answers ->> v_question.id::text, '')::integer;
    exception when invalid_text_representation then
      v_selected_index := null;
    end;

    if v_selected_index is not null and v_selected_index >= 0 then
      select qo.id into v_selected_option
      from public.question_options qo
      where qo.question_id = v_question.id
        and qo.position = v_selected_index + 1;
    end if;

    insert into public.candidate_answers (
      session_id, question_id, selected_option_id, client_sequence
    ) values (
      p_session_id, v_question.id, v_selected_option, coalesce(v_selected_index, -1)
    )
    on conflict (session_id, question_id) do update
    set selected_option_id = excluded.selected_option_id,
        client_sequence = excluded.client_sequence,
        answered_at = now();
  end loop;

  select
    coalesce(sum(q.points) filter (where ca.selected_option_id = ak.correct_option_id), 0),
    coalesce(sum(q.points), 0)
  into v_raw_score, v_maximum_score
  from public.questions q
  join public.question_answer_keys ak on ak.question_id = q.id
  left join public.candidate_answers ca
    on ca.question_id = q.id and ca.session_id = p_session_id
  where q.examination_id = v_session.examination_id and q.is_active;

  if v_maximum_score > 0 then
    v_percentage := round((v_raw_score / v_maximum_score) * 100, 2);
  end if;

  select coalesce(sum(
    case lower(coalesce(item ->> 'severity', 'low'))
      when 'high' then 45
      when 'medium' then 20
      else 8
    end
  ), 0)::integer
  into v_log_score
  from jsonb_array_elements(coalesce(p_logs, '[]'::jsonb)) item;

  v_suspicious := least(100, greatest(0, coalesce(p_tab_away_count, 0) * 12 + v_log_score));
  if v_suspicious >= 50 then v_status := 'flagged'; end if;

  insert into public.proctor_events (
    session_id, candidate_id, event_type, severity, confidence, message, metadata, occurred_at
  )
  select
    p_session_id,
    v_candidate_id,
    coalesce(nullif(item ->> 'type', ''), 'manual_flag'),
    case when lower(item ->> 'severity') in ('low', 'medium', 'high') then lower(item ->> 'severity') else 'low' end,
    null,
    coalesce(nullif(item ->> 'message', ''), 'Proctor event recorded.'),
    item - 'snapshotUrl',
    case when (item ->> 'timestamp') is not null then (item ->> 'timestamp')::timestamptz else now() end
  from jsonb_array_elements(coalesce(p_logs, '[]'::jsonb)) item;

  update public.exam_sessions
  set status = 'submitted',
      submitted_at = now(),
      tab_away_count = greatest(0, coalesce(p_tab_away_count, 0)),
      suspicious_score = v_suspicious,
      updated_at = now()
  where id = p_session_id;

  insert into public.attempts (
    session_id, examination_id, candidate_id,
    raw_score, maximum_score, percentage, status, suspicious_score,
    started_at, submitted_at
  ) values (
    p_session_id, v_session.examination_id, v_candidate_id,
    v_raw_score, v_maximum_score, v_percentage, v_status, v_suspicious,
    v_session.started_at, now()
  ) returning id into v_attempt_id;

  select count(*) into v_attempt_count
  from public.attempts
  where examination_id = v_session.examination_id and candidate_id = v_candidate_id;
  v_max_attempts := coalesce(v_assignment.max_attempts_override, v_exam.max_attempts);
  if v_attempt_count >= v_max_attempts then
    update public.exam_assignments set status = 'completed', updated_at = now() where id = v_assignment.id;
  end if;

  select full_name into v_candidate_name from public.profiles where id = v_candidate_id;

  return jsonb_build_object(
    'id', v_attempt_id,
    'studentName', coalesce(v_candidate_name, 'Candidate'),
    'testId', v_exam.id,
    'testTitle', v_exam.title,
    'startTime', v_session.started_at,
    'endTime', now(),
    'answers', coalesce(p_answers, '{}'::jsonb),
    'score', v_percentage,
    'logs', coalesce(p_logs, '[]'::jsonb),
    'status', v_status,
    'suspiciousScore', v_suspicious
  );
end;
$$;

create or replace function public.get_portal_attempts()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(attempt_payload order by submitted_at desc), '[]'::jsonb)
  from (
    select
      a.submitted_at,
      jsonb_build_object(
        'id', a.id,
        'studentName', p.full_name,
        'testId', a.examination_id,
        'testTitle', e.title,
        'startTime', a.started_at,
        'endTime', a.submitted_at,
        'answers', coalesce((
          select jsonb_object_agg(ca.question_id::text, qo.position - 1)
          from public.candidate_answers ca
          left join public.question_options qo on qo.id = ca.selected_option_id
          where ca.session_id = a.session_id and ca.selected_option_id is not null
        ), '{}'::jsonb),
        'score', a.percentage,
        'logs', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', pe.id,
            'timestamp', pe.occurred_at,
            'type', pe.event_type,
            'severity', pe.severity,
            'message', pe.message
          ) order by pe.occurred_at)
          from public.proctor_events pe
          where pe.session_id = a.session_id
        ), '[]'::jsonb),
        'status', case when a.status = 'reviewed' then 'submitted' else a.status end,
        'suspiciousScore', a.suspicious_score
      ) as attempt_payload
    from public.attempts a
    join public.profiles p on p.id = a.candidate_id
    join public.examinations e on e.id = a.examination_id
    where a.candidate_id = auth.uid() or public.is_exam_staff()
  ) portal_attempts;
$$;

revoke all on function public.submit_exam_secure(uuid, jsonb, jsonb, integer) from public;
revoke all on function public.get_portal_attempts() from public;
grant execute on function public.submit_exam_secure(uuid, jsonb, jsonb, integer) to authenticated;
grant execute on function public.get_portal_attempts() to authenticated;

commit;

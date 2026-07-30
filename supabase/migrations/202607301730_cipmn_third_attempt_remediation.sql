begin;

-- Phase 1: CIPMN third-attempt remediation.
-- One paid or authorised module access now permits three attempts. Correct answers
-- remain server-protected until the third completed attempt and integrity clearance.

update public.examinations e
set max_attempts = 3, updated_at = now()
from public.programmes p
where p.id = e.programme_id
  and p.code = 'CIPMN-MOCK'
  and e.max_attempts <> 3;

update public.exam_assignments a
set max_attempts_override = greatest(coalesce(a.max_attempts_override, 3), 3),
    status = case
      when a.status = 'completed'
       and (select count(*) from public.attempts attempted
            where attempted.examination_id = a.examination_id
              and attempted.candidate_id = a.candidate_id) < 3
      then 'assigned'
      else a.status
    end,
    updated_at = now()
from public.examinations e
join public.programmes p on p.id = e.programme_id
where e.id = a.examination_id
  and p.code = 'CIPMN-MOCK'
  and a.status in ('assigned', 'completed')
  and (
    coalesce(a.max_attempts_override, 0) < 3
    or a.status = 'completed'
  );

create table if not exists public.agilecert_cipmn_attempt_reviews (
  id uuid primary key default extensions.gen_random_uuid(),
  attempt_id uuid not null unique references public.attempts(id) on delete restrict,
  examination_id uuid not null references public.examinations(id) on delete restrict,
  candidate_id uuid not null references public.profiles(id) on delete restrict,
  attempt_number integer not null check (attempt_number = 3),
  question_count integer not null default 0 check (question_count >= 0),
  incorrect_count integer not null default 0 check (incorrect_count >= 0),
  review_unlocked_at timestamptz not null default now(),
  first_opened_at timestamptz,
  last_opened_at timestamptz,
  open_count integer not null default 0 check (open_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agilecert_cipmn_attempt_review_items (
  id uuid primary key default extensions.gen_random_uuid(),
  review_id uuid not null references public.agilecert_cipmn_attempt_reviews(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete restrict,
  question_number integer not null check (question_number > 0),
  question_text text not null,
  selected_option_id uuid references public.question_options(id) on delete restrict,
  selected_option_position integer,
  selected_option_text text,
  correct_option_id uuid not null references public.question_options(id) on delete restrict,
  correct_option_position integer not null check (correct_option_position > 0),
  correct_option_text text not null,
  explanation text not null,
  created_at timestamptz not null default now(),
  unique (review_id, question_id)
);

create index if not exists agilecert_cipmn_attempt_reviews_candidate_idx
  on public.agilecert_cipmn_attempt_reviews(candidate_id, created_at desc);
create index if not exists agilecert_cipmn_attempt_review_items_review_idx
  on public.agilecert_cipmn_attempt_review_items(review_id, question_number);

alter table public.agilecert_cipmn_attempt_reviews enable row level security;
alter table public.agilecert_cipmn_attempt_review_items enable row level security;
revoke all on table public.agilecert_cipmn_attempt_reviews from public, anon, authenticated;
revoke all on table public.agilecert_cipmn_attempt_review_items from public, anon, authenticated;

create or replace function public.agilecert_cipmn_attempt_number(p_attempt_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  with target as (
    select candidate_id, examination_id
    from public.attempts
    where id = p_attempt_id
  ), ranked as (
    select a.id,
      row_number() over (
        partition by a.candidate_id, a.examination_id
        order by a.submitted_at, a.created_at, a.id
      )::integer as attempt_number
    from public.attempts a
    join target t
      on t.candidate_id = a.candidate_id
     and t.examination_id = a.examination_id
  )
  select attempt_number from ranked where id = p_attempt_id
$$;

create or replace function public.agilecert_cipmn_review_is_releasable(p_attempt_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select
      p.code = 'CIPMN-MOCK'
      and a.status in ('submitted', 'reviewed')
      and public.agilecert_cipmn_attempt_number(a.id) = 3
      and not exists (
        select 1
        from public.agilecert_misconduct_cases c
        where c.attempt_id = a.id
          and c.result_hold = true
          and c.status <> 'closed'
      )
    from public.attempts a
    join public.examinations e on e.id = a.examination_id
    join public.programmes p on p.id = e.programme_id
    where a.id = p_attempt_id
  ), false)
$$;

create or replace function public.agilecert_prepare_cipmn_third_attempt_review(p_attempt_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_attempt public.attempts%rowtype;
  v_exam public.examinations%rowtype;
  v_programme_code text;
  v_review_id uuid;
  v_question_count integer := 0;
  v_incorrect_count integer := 0;
  v_email text;
  v_email_hash text;
  v_outbox_id uuid;
  v_highlights text;
begin
  select a into v_attempt
  from public.attempts a
  where a.id = p_attempt_id;
  if not found then return; end if;

  select e into v_exam
  from public.examinations e
  where e.id = v_attempt.examination_id;
  if not found then return; end if;

  select p.code into v_programme_code
  from public.programmes p
  where p.id = v_exam.programme_id;

  if v_programme_code <> 'CIPMN-MOCK'
     or public.agilecert_cipmn_attempt_number(v_attempt.id) <> 3 then
    return;
  end if;

  insert into public.agilecert_cipmn_attempt_reviews(
    attempt_id, examination_id, candidate_id, attempt_number
  ) values (
    v_attempt.id, v_attempt.examination_id, v_attempt.candidate_id, 3
  )
  on conflict (attempt_id) do update set updated_at = now()
  returning id into v_review_id;

  -- Snapshot only incorrect or unanswered questions. This prevents a later
  -- question-bank revision from changing a historical candidate review.
  insert into public.agilecert_cipmn_attempt_review_items(
    review_id, question_id, question_number, question_text,
    selected_option_id, selected_option_position, selected_option_text,
    correct_option_id, correct_option_position, correct_option_text, explanation
  )
  select
    v_review_id,
    q.id,
    q.position,
    q.question_text,
    answer.selected_option_id,
    selected_option.position,
    selected_option.option_text,
    answer_key.correct_option_id,
    correct_option.position,
    correct_option.option_text,
    coalesce(
      nullif(trim(answer_key.explanation), ''),
      'Review the relevant module concept and compare the selected response with the professionally appropriate action.'
    )
  from public.questions q
  join public.question_answer_keys answer_key on answer_key.question_id = q.id
  join public.question_options correct_option on correct_option.id = answer_key.correct_option_id
  left join public.candidate_answers answer
    on answer.session_id = v_attempt.session_id
   and answer.question_id = q.id
  left join public.question_options selected_option on selected_option.id = answer.selected_option_id
  where q.examination_id = v_attempt.examination_id
    and q.is_active = true
    and answer.selected_option_id is distinct from answer_key.correct_option_id
  on conflict (review_id, question_id) do nothing;

  select count(*) into v_question_count
  from public.questions q
  where q.examination_id = v_attempt.examination_id and q.is_active = true;

  select count(*) into v_incorrect_count
  from public.agilecert_cipmn_attempt_review_items item
  where item.review_id = v_review_id;

  update public.agilecert_cipmn_attempt_reviews
  set question_count = case when question_count = 0 then v_question_count else question_count end,
      incorrect_count = v_incorrect_count,
      updated_at = now()
  where id = v_review_id;

  if not public.agilecert_cipmn_review_is_releasable(v_attempt.id) then
    update public.agilecert_communication_outbox
    set status = 'cancelled',
        cancelled_at = now(),
        failure_code = 'cipmn_integrity_hold',
        failure_message = 'The remediation review is withheld pending examination-integrity clearance.',
        updated_at = now()
    where event_key = 'cipmn-third-attempt-remediation:' || v_attempt.id::text
      and status in ('queued', 'processing', 'failed');
    return;
  end if;

  select lower(u.email) into v_email
  from auth.users u
  where u.id = v_attempt.candidate_id and u.email is not null;
  if nullif(trim(coalesce(v_email, '')), '') is null then return; end if;
  v_email_hash := encode(extensions.digest(v_email, 'sha256'), 'hex');

  insert into public.agilecert_communication_preferences(candidate_id)
  values (v_attempt.candidate_id)
  on conflict (candidate_id) do nothing;

  if not coalesce((
    select pref.operational_messages
    from public.agilecert_communication_preferences pref
    where pref.candidate_id = v_attempt.candidate_id
  ), true) then
    return;
  end if;

  select string_agg(format('%s. %s', learning.ordinality, learning.explanation), E'\n')
  into v_highlights
  from (
    select item.explanation,
      row_number() over (order by item.question_number)::integer as ordinality
    from public.agilecert_cipmn_attempt_review_items item
    where item.review_id = v_review_id
    order by item.question_number
    limit 6
  ) learning;

  insert into public.agilecert_communication_outbox(
    candidate_id, recipient_email, recipient_email_hash, message_type, category,
    event_key, due_at, payload
  ) values (
    v_attempt.candidate_id,
    v_email,
    v_email_hash,
    'admin_message',
    'operational',
    'cipmn-third-attempt-remediation:' || v_attempt.id::text,
    now(),
    jsonb_build_object(
      'recipientName', coalesce((select p.full_name from public.profiles p where p.id = v_attempt.candidate_id), 'Candidate'),
      'senderName', 'AgileCert Examination Support',
      'subject', 'Your CIPMN third-attempt remediation review is ready',
      'body', concat(
        'You have completed attempt 3 of ', v_exam.title, '.', E'\n\n',
        'Score: ', trim(to_char(v_attempt.percentage, 'FM999990.00')), '%.', E'\n',
        'Responses requiring review: ', v_incorrect_count, ' of ', v_question_count, '.', E'\n\n',
        case
          when coalesce(v_highlights, '') = '' then
            'No incorrect responses were recorded. Your secure review remains available in the portal for confirmation.'
          else
            'Key learning explanations from the responses you missed:' || E'\n' || v_highlights
        end,
        E'\n\n',
        'Sign in to AgileCert Global to view the protected question-by-question review, including your selected answer, the correct answer and the full explanation. For examination security, the detailed answer key is not reproduced in email.'
      ),
      'attemptId', v_attempt.id,
      'examinationId', v_attempt.examination_id,
      'attemptNumber', 3,
      'incorrectCount', v_incorrect_count,
      'questionCount', v_question_count
    )
  )
  on conflict (event_key) do update set
    recipient_email = excluded.recipient_email,
    recipient_email_hash = excluded.recipient_email_hash,
    payload = excluded.payload,
    due_at = case
      when public.agilecert_communication_outbox.status = 'cancelled'
       and public.agilecert_communication_outbox.failure_code = 'cipmn_integrity_hold'
      then now()
      else public.agilecert_communication_outbox.due_at
    end,
    status = case
      when public.agilecert_communication_outbox.status = 'cancelled'
       and public.agilecert_communication_outbox.failure_code = 'cipmn_integrity_hold'
      then 'queued'
      else public.agilecert_communication_outbox.status
    end,
    cancelled_at = case
      when public.agilecert_communication_outbox.failure_code = 'cipmn_integrity_hold' then null
      else public.agilecert_communication_outbox.cancelled_at
    end,
    failure_code = case
      when public.agilecert_communication_outbox.failure_code = 'cipmn_integrity_hold' then null
      else public.agilecert_communication_outbox.failure_code
    end,
    failure_message = case
      when public.agilecert_communication_outbox.failure_code = 'cipmn_integrity_hold' then null
      else public.agilecert_communication_outbox.failure_message
    end,
    updated_at = now()
  returning id into v_outbox_id;

  insert into public.agilecert_communication_events(outbox_id, candidate_id, event_type, metadata)
  select v_outbox_id, v_attempt.candidate_id, 'queued',
    jsonb_build_object('messageType', 'cipmn_third_attempt_remediation', 'attemptId', v_attempt.id)
  where not exists (
    select 1 from public.agilecert_communication_events event
    where event.outbox_id = v_outbox_id and event.event_type = 'queued'
  );

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  select v_attempt.candidate_id, 'create_cipmn_third_attempt_review', 'attempt', v_attempt.id::text,
    jsonb_build_object(
      'attemptNumber', 3,
      'questionCount', v_question_count,
      'incorrectCount', v_incorrect_count,
      'emailOutboxId', v_outbox_id
    )
  where not exists (
    select 1 from public.audit_logs audit
    where audit.action = 'create_cipmn_third_attempt_review'
      and audit.entity_type = 'attempt'
      and audit.entity_id = v_attempt.id::text
  );
end;
$$;

create or replace function public.agilecert_prepare_cipmn_third_attempt_review_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.agilecert_prepare_cipmn_third_attempt_review(new.id);
  return new;
end;
$$;

drop trigger if exists agilecert_prepare_cipmn_third_attempt_review_insert_trigger on public.attempts;
create trigger agilecert_prepare_cipmn_third_attempt_review_insert_trigger
after insert on public.attempts
for each row execute function public.agilecert_prepare_cipmn_third_attempt_review_trigger();

drop trigger if exists agilecert_prepare_cipmn_third_attempt_review_status_trigger on public.attempts;
create trigger agilecert_prepare_cipmn_third_attempt_review_status_trigger
after update of status on public.attempts
for each row
when (old.status is distinct from new.status)
execute function public.agilecert_prepare_cipmn_third_attempt_review_trigger();

create or replace function public.get_my_cipmn_remediation_attempts()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate_id uuid := auth.uid();
  v_attempt_id uuid;
  v_payload jsonb;
begin
  if v_candidate_id is null or not exists (
    select 1 from public.profiles p
    where p.id = v_candidate_id and p.role = 'candidate' and p.is_active = true
  ) then
    raise exception 'An active candidate account is required.';
  end if;

  for v_attempt_id in
    select a.id
    from public.attempts a
    join public.examinations e on e.id = a.examination_id
    join public.programmes p on p.id = e.programme_id
    where a.candidate_id = v_candidate_id
      and p.code = 'CIPMN-MOCK'
      and public.agilecert_cipmn_attempt_number(a.id) = 3
  loop
    perform public.agilecert_prepare_cipmn_third_attempt_review(v_attempt_id);
  end loop;

  with ranked as (
    select
      a.id,
      a.examination_id,
      a.percentage,
      a.status,
      a.submitted_at,
      e.title as examination_title,
      e.pass_mark,
      e.max_attempts as examination_max_attempts,
      s.assignment_id,
      public.agilecert_cipmn_attempt_number(a.id) as attempt_number
    from public.attempts a
    join public.examinations e on e.id = a.examination_id
    join public.programmes p on p.id = e.programme_id
    join public.exam_sessions s on s.id = a.session_id
    where a.candidate_id = v_candidate_id and p.code = 'CIPMN-MOCK'
  )
  select jsonb_build_object(
    'attempts', coalesce(jsonb_agg(jsonb_build_object(
      'attemptId', ranked.id,
      'examinationId', ranked.examination_id,
      'examinationTitle', ranked.examination_title,
      'attemptNumber', ranked.attempt_number,
      'maxAttempts', coalesce(assignment.max_attempts_override, ranked.examination_max_attempts),
      'score', ranked.percentage,
      'passMark', ranked.pass_mark,
      'status', ranked.status,
      'submittedAt', ranked.submitted_at,
      'reviewAvailable', public.agilecert_cipmn_review_is_releasable(ranked.id) and review.id is not null,
      'incorrectCount', case when ranked.attempt_number = 3 then review.incorrect_count else null end,
      'questionCount', case when ranked.attempt_number = 3 then review.question_count else null end,
      'reviewEmailStatus', outbox.status
    ) order by ranked.submitted_at desc, ranked.id desc), '[]'::jsonb)
  ) into v_payload
  from ranked
  left join public.exam_assignments assignment on assignment.id = ranked.assignment_id
  left join public.agilecert_cipmn_attempt_reviews review on review.attempt_id = ranked.id
  left join public.agilecert_communication_outbox outbox
    on outbox.event_key = 'cipmn-third-attempt-remediation:' || ranked.id::text;

  return coalesce(v_payload, jsonb_build_object('attempts', '[]'::jsonb));
end;
$$;

create or replace function public.get_my_cipmn_attempt_review(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate_id uuid := auth.uid();
  v_attempt public.attempts%rowtype;
  v_exam public.examinations%rowtype;
  v_programme_code text;
  v_review public.agilecert_cipmn_attempt_reviews%rowtype;
  v_payload jsonb;
begin
  if v_candidate_id is null or not exists (
    select 1 from public.profiles p
    where p.id = v_candidate_id and p.role = 'candidate' and p.is_active = true
  ) then
    raise exception 'An active candidate account is required.';
  end if;

  select a into v_attempt
  from public.attempts a
  where a.id = p_attempt_id and a.candidate_id = v_candidate_id;
  if not found then raise exception 'The selected attempt was not found.'; end if;

  select e into v_exam
  from public.examinations e
  where e.id = v_attempt.examination_id;
  select p.code into v_programme_code
  from public.programmes p
  where p.id = v_exam.programme_id;

  if v_programme_code <> 'CIPMN-MOCK' then
    raise exception 'Detailed remediation is available only for approved CIPMN module examinations.';
  end if;
  if public.agilecert_cipmn_attempt_number(v_attempt.id) <> 3 then
    raise exception 'Correct-answer remediation unlocks only for the third completed attempt.';
  end if;

  perform public.agilecert_prepare_cipmn_third_attempt_review(v_attempt.id);
  if not public.agilecert_cipmn_review_is_releasable(v_attempt.id) then
    raise exception 'The detailed remediation review is withheld pending examination-integrity clearance.';
  end if;

  select review into v_review
  from public.agilecert_cipmn_attempt_reviews review
  where review.attempt_id = v_attempt.id and review.candidate_id = v_candidate_id
  for update;
  if not found then raise exception 'The third-attempt remediation review is not yet available.'; end if;

  update public.agilecert_cipmn_attempt_reviews
  set first_opened_at = coalesce(first_opened_at, now()),
      last_opened_at = now(),
      open_count = open_count + 1,
      updated_at = now()
  where id = v_review.id
  returning * into v_review;

  select jsonb_build_object(
    'attemptId', v_attempt.id,
    'examinationId', v_attempt.examination_id,
    'examinationTitle', v_exam.title,
    'attemptNumber', 3,
    'score', v_attempt.percentage,
    'passMark', v_exam.pass_mark,
    'questionCount', v_review.question_count,
    'incorrectCount', v_review.incorrect_count,
    'submittedAt', v_attempt.submitted_at,
    'reviewUnlockedAt', v_review.review_unlocked_at,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'questionId', item.question_id,
        'questionNumber', item.question_number,
        'questionText', item.question_text,
        'selectedOptionPosition', item.selected_option_position,
        'selectedOptionText', item.selected_option_text,
        'correctOptionPosition', item.correct_option_position,
        'correctOptionText', item.correct_option_text,
        'explanation', item.explanation
      ) order by item.question_number)
      from public.agilecert_cipmn_attempt_review_items item
      where item.review_id = v_review.id
    ), '[]'::jsonb)
  ) into v_payload;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (
    v_candidate_id,
    'open_cipmn_third_attempt_review',
    'attempt',
    v_attempt.id::text,
    jsonb_build_object('incorrectCount', v_review.incorrect_count, 'openCount', v_review.open_count)
  );

  return v_payload;
end;
$$;

revoke all on function public.agilecert_cipmn_attempt_number(uuid) from public, anon, authenticated;
revoke all on function public.agilecert_cipmn_review_is_releasable(uuid) from public, anon, authenticated;
revoke all on function public.agilecert_prepare_cipmn_third_attempt_review(uuid) from public, anon, authenticated;
revoke all on function public.agilecert_prepare_cipmn_third_attempt_review_trigger() from public, anon, authenticated;
revoke all on function public.get_my_cipmn_remediation_attempts() from public, anon, authenticated;
revoke all on function public.get_my_cipmn_attempt_review(uuid) from public, anon, authenticated;
grant execute on function public.get_my_cipmn_remediation_attempts() to authenticated;
grant execute on function public.get_my_cipmn_attempt_review(uuid) to authenticated;

commit;

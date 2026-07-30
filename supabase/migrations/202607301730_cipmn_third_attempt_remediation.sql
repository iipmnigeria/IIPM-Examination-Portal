begin;

-- Phase 1: CIPMN third-attempt remediation.
-- Correct answers remain protected until the candidate's third completed attempt.
-- The detailed answer review stays inside the authenticated portal; email contains
-- only learning explanations and a secure portal call-to-action.

update public.examinations e
set max_attempts = 3,
    updated_at = now()
from public.programmes p
where p.id = e.programme_id
  and p.code = 'CIPMN-MOCK'
  and e.max_attempts <> 3;

-- Existing paid/waived access is expanded to the approved three-attempt policy.
-- Revoked and expired access is never reopened.
update public.exam_assignments a
set max_attempts_override = case
      when a.max_attempts_override is null or a.max_attempts_override < 3 then 3
      else a.max_attempts_override
    end,
    status = case
      when a.status = 'completed'
       and (select count(*) from public.attempts at where at.examination_id = a.examination_id and at.candidate_id = a.candidate_id) < 3
      then 'assigned'
      else a.status
    end,
    updated_at = now()
from public.examinations e
join public.programmes p on p.id = e.programme_id
where e.id = a.examination_id
  and p.code = 'CIPMN-MOCK'
  and a.status in ('assigned', 'completed')
  and (a.max_attempts_override is null or a.max_attempts_override < 3 or a.status = 'completed');

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
create index if not exists agilecert_cipmn_attempt_reviews_exam_idx
  on public.agilecert_cipmn_attempt_reviews(examination_id, created_at desc);
create index if not exists agilecert_cipmn_attempt_review_items_review_idx
  on public.agilecert_cipmn_attempt_review_items(review_id, question_number);

alter table public.agilecert_cipmn_attempt_reviews enable row level security;
alter table public.agilecert_cipmn_attempt_review_items enable row level security;
revoke all on table public.agilecert_cipmn_attempt_reviews from public, anon, authenticated;
revoke all on table public.agilecert_cipmn_attempt_review_items from public, anon, authenticated;

-- Add the operational remediation message to the existing controlled outbox.
alter table public.agilecert_communication_outbox
  drop constraint if exists agilecert_communication_outbox_message_type_check;
alter table public.agilecert_communication_outbox
  add constraint agilecert_communication_outbox_message_type_check
  check (message_type in (
    'preparation_material_ready', 'certificate_offer_immediate', 'certificate_offer_day_2',
    'certificate_offer_day_5', 'certificate_offer_day_7', 'certificate_purchase_confirmation',
    'credential_ready', 'course_recommendation', 'admin_message',
    'cipmn_third_attempt_remediation'
  ));

create or replace function public.agilecert_prepare_cipmn_third_attempt_review(
  p_attempt_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_attempt public.attempts%rowtype;
  v_exam public.examinations%rowtype;
  v_programme_code text;
  v_attempt_number integer;
  v_review_id uuid;
  v_question_count integer := 0;
  v_incorrect_count integer := 0;
  v_email text;
  v_email_hash text;
  v_operational_messages boolean := true;
  v_result_held boolean := false;
  v_outbox_id uuid;
begin
  select * into v_attempt
  from public.attempts
  where id = p_attempt_id;
  if not found then return; end if;

  select e.*, p.code
  into v_exam, v_programme_code
  from public.examinations e
  join public.programmes p on p.id = e.programme_id
  where e.id = v_attempt.examination_id;
  if not found or v_programme_code <> 'CIPMN-MOCK' then return; end if;

  select ranked.attempt_number into v_attempt_number
  from (
    select a.id,
      row_number() over (
        partition by a.candidate_id, a.examination_id
        order by a.submitted_at, a.created_at, a.id
      )::integer as attempt_number
    from public.attempts a
    where a.candidate_id = v_attempt.candidate_id
      and a.examination_id = v_attempt.examination_id
  ) ranked
  where ranked.id = v_attempt.id;

  if coalesce(v_attempt_number, 0) <> 3 then return; end if;

  insert into public.agilecert_cipmn_attempt_reviews(
    attempt_id, examination_id, candidate_id, attempt_number
  ) values (
    v_attempt.id, v_attempt.examination_id, v_attempt.candidate_id, 3
  )
  on conflict (attempt_id) do update set updated_at = now()
  returning id into v_review_id;

  -- Snapshot only failed/unanswered questions. The snapshot prevents a later
  -- question-bank revision from changing a candidate's historical review.
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
    ca.selected_option_id,
    selected_option.position,
    selected_option.option_text,
    answer_key.correct_option_id,
    correct_option.position,
    correct_option.option_text,
    coalesce(nullif(trim(answer_key.explanation), ''),
      'Review the relevant module concept and compare the selected response with the professionally appropriate action.')
  from public.questions q
  join public.question_answer_keys answer_key on answer_key.question_id = q.id
  join public.question_options correct_option on correct_option.id = answer_key.correct_option_id
  left join public.candidate_answers ca
    on ca.session_id = v_attempt.session_id and ca.question_id = q.id
  left join public.question_options selected_option on selected_option.id = ca.selected_option_id
  where q.examination_id = v_attempt.examination_id
    and q.is_active = true
    and ca.selected_option_id is distinct from answer_key.correct_option_id
  on conflict (review_id, question_id) do nothing;

  select count(*) into v_question_count
  from public.questions q
  where q.examination_id = v_attempt.examination_id and q.is_active = true;

  select count(*) into v_incorrect_count
  from public.agilecert_cipmn_attempt_review_items item
  where item.review_id = v_review_id;

  update public.agilecert_cipmn_attempt_reviews
  set question_count = v_question_count,
      incorrect_count = v_incorrect_count,
      updated_at = now()
  where id = v_review_id;

  select exists (
    select 1
    from public.agilecert_misconduct_cases c
    where c.attempt_id = v_attempt.id
      and c.result_hold = true
      and c.status <> 'closed'
  ) into v_result_held;

  -- A held, flagged or terminated result must not release protected answers or email.
  if v_attempt.status not in ('submitted', 'reviewed') or v_result_held then
    update public.agilecert_communication_outbox
    set status = 'cancelled',
        cancelled_at = now(),
        failure_code = 'cipmn_integrity_hold',
        failure_message = 'The detailed remediation review is withheld pending examination-integrity clearance.',
        updated_at = now()
    where event_key = 'cipmn-third-attempt-remediation:' || v_attempt.id::text
      and status in ('queued', 'failed', 'processing');
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

  select pref.operational_messages into v_operational_messages
  from public.agilecert_communication_preferences pref
  where pref.candidate_id = v_attempt.candidate_id;
  if not coalesce(v_operational_messages, true) then return; end if;

  insert into public.agilecert_communication_outbox(
    candidate_id, recipient_email, recipient_email_hash, message_type, category,
    event_key, due_at, payload
  ) values (
    v_attempt.candidate_id,
    v_email,
    v_email_hash,
    'cipmn_third_attempt_remediation',
    'operational',
    'cipmn-third-attempt-remediation:' || v_attempt.id::text,
    now(),
    jsonb_build_object(
      'attemptId', v_attempt.id,
      'examinationId', v_attempt.examination_id,
      'examinationTitle', v_exam.title,
      'attemptNumber', 3,
      'score', v_attempt.percentage,
      'passMark', v_exam.pass_mark,
      'questionCount', v_question_count,
      'incorrectCount', v_incorrect_count,
      'reviewHighlights', coalesce((
        select jsonb_agg(highlight.explanation order by highlight.question_number)
        from (
          select item.question_number, left(item.explanation, 700) as explanation
          from public.agilecert_cipmn_attempt_review_items item
          where item.review_id = v_review_id
          order by item.question_number
          limit 6
        ) highlight
      ), '[]'::jsonb)
    )
  )
  on conflict (event_key) do update set
    recipient_email = excluded.recipient_email,
    recipient_email_hash = excluded.recipient_email_hash,
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
    payload = excluded.payload,
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

  -- Lazily creates a review for a historical third attempt if required.
  for v_attempt_id in
    select ranked.id
    from (
      select a.id,
        row_number() over (
          partition by a.candidate_id, a.examination_id
          order by a.submitted_at, a.created_at, a.id
        )::integer as attempt_number
      from public.attempts a
      join public.examinations e on e.id = a.examination_id
      join public.programmes p on p.id = e.programme_id
      where a.candidate_id = v_candidate_id and p.code = 'CIPMN-MOCK'
    ) ranked
    where ranked.attempt_number = 3
  loop
    perform public.agilecert_prepare_cipmn_third_attempt_review(v_attempt_id);
  end loop;

  with ranked as (
    select
      a.*,
      e.title as examination_title,
      e.pass_mark,
      e.max_attempts as examination_max_attempts,
      s.assignment_id,
      row_number() over (
        partition by a.candidate_id, a.examination_id
        order by a.submitted_at, a.created_at, a.id
      )::integer as attempt_number
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
      'reviewAvailable', (
        ranked.attempt_number = 3
        and ranked.status in ('submitted', 'reviewed')
        and review.id is not null
        and not exists (
          select 1 from public.agilecert_misconduct_cases c
          where c.attempt_id = ranked.id and c.result_hold = true and c.status <> 'closed'
        )
      ),
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

create or replace function public.get_my_cipmn_attempt_review(
  p_attempt_id uuid
)
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
  v_attempt_number integer;
  v_review public.agilecert_cipmn_attempt_reviews%rowtype;
  v_result_held boolean := false;
  v_payload jsonb;
begin
  if v_candidate_id is null or not exists (
    select 1 from public.profiles p
    where p.id = v_candidate_id and p.role = 'candidate' and p.is_active = true
  ) then
    raise exception 'An active candidate account is required.';
  end if;

  select * into v_attempt
  from public.attempts
  where id = p_attempt_id and candidate_id = v_candidate_id;
  if not found then raise exception 'The selected attempt was not found.'; end if;

  select e.*, p.code into v_exam, v_programme_code
  from public.examinations e
  join public.programmes p on p.id = e.programme_id
  where e.id = v_attempt.examination_id;
  if v_programme_code <> 'CIPMN-MOCK' then
    raise exception 'Detailed remediation is available only for approved CIPMN module examinations.';
  end if;

  select ranked.attempt_number into v_attempt_number
  from (
    select a.id,
      row_number() over (
        partition by a.candidate_id, a.examination_id
        order by a.submitted_at, a.created_at, a.id
      )::integer as attempt_number
    from public.attempts a
    where a.candidate_id = v_candidate_id and a.examination_id = v_attempt.examination_id
  ) ranked
  where ranked.id = v_attempt.id;

  if coalesce(v_attempt_number, 0) < 3 then
    raise exception 'Correct-answer remediation unlocks only after the third completed attempt.';
  end if;
  if v_attempt_number <> 3 then
    raise exception 'The protected remediation record belongs to the third attempt.';
  end if;

  perform public.agilecert_prepare_cipmn_third_attempt_review(v_attempt.id);

  select exists (
    select 1 from public.agilecert_misconduct_cases c
    where c.attempt_id = v_attempt.id and c.result_hold = true and c.status <> 'closed'
  ) into v_result_held;
  if v_attempt.status not in ('submitted', 'reviewed') or v_result_held then
    raise exception 'The detailed remediation review is withheld pending examination-integrity clearance.';
  end if;

  select * into v_review
  from public.agilecert_cipmn_attempt_reviews
  where attempt_id = v_attempt.id and candidate_id = v_candidate_id
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
    v_candidate_id, 'open_cipmn_third_attempt_review', 'attempt', v_attempt.id::text,
    jsonb_build_object('incorrectCount', v_review.incorrect_count, 'openCount', v_review.open_count)
  );

  return v_payload;
end;
$$;

revoke all on function public.agilecert_prepare_cipmn_third_attempt_review(uuid)
  from public, anon, authenticated;
revoke all on function public.agilecert_prepare_cipmn_third_attempt_review_trigger()
  from public, anon, authenticated;
revoke all on function public.get_my_cipmn_remediation_attempts()
  from public, anon, authenticated;
revoke all on function public.get_my_cipmn_attempt_review(uuid)
  from public, anon, authenticated;
grant execute on function public.get_my_cipmn_remediation_attempts() to authenticated;
grant execute on function public.get_my_cipmn_attempt_review(uuid) to authenticated;

commit;

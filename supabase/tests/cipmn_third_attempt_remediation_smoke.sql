\set ON_ERROR_STOP on

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '30173000-0000-0000-0000-000000000001',
    'authenticated', 'authenticated', 'cipmn-remediation@example.test',
    extensions.crypt('Remediation1!', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"CIPMN Remediation Candidate"}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '30173000-0000-0000-0000-000000000002',
    'authenticated', 'authenticated', 'other-remediation@example.test',
    extensions.crypt('Remediation1!', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Other Remediation Candidate"}'::jsonb, now(), now()
  )
on conflict (id) do nothing;

select set_config('request.jwt.claim.sub', '30173000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select public.complete_my_agilecert_candidate_onboarding(
  'CIPMN Remediation Candidate', '+2347000000031', 'NG', 'NGN', 'Africa/Lagos',
  true, true, true
);

insert into public.exam_assignments(
  id, examination_id, candidate_id, max_attempts_override, status
)
select
  '30173000-0000-0000-0000-000000000010',
  e.id,
  '30173000-0000-0000-0000-000000000001',
  3,
  'assigned'
from public.examinations e
join public.programmes p on p.id = e.programme_id
where p.code = 'CIPMN-MOCK'
  and e.title like 'CIPMN-MOD-003 - %'
on conflict (examination_id, candidate_id) do update set
  max_attempts_override = 3,
  status = 'assigned',
  updated_at = now();

DO $$
declare
  v_exam_id uuid;
  v_question_count integer;
  v_attempt_no integer;
  v_session_id uuid;
  v_attempt_id uuid;
  v_started timestamptz;
begin
  select e.id into v_exam_id
  from public.examinations e
  join public.programmes p on p.id = e.programme_id
  where p.code = 'CIPMN-MOCK'
    and e.title like 'CIPMN-MOD-003 - %';

  select count(*) into v_question_count
  from public.questions q
  where q.examination_id = v_exam_id and q.is_active = true;

  if v_question_count <> 75 then
    raise exception 'Expected 75 active Module 003 questions, found %.', v_question_count;
  end if;

  for v_attempt_no in 1..3 loop
    v_session_id := case v_attempt_no
      when 1 then '30173000-0000-0000-0000-000000000101'::uuid
      when 2 then '30173000-0000-0000-0000-000000000102'::uuid
      else '30173000-0000-0000-0000-000000000103'::uuid
    end;
    v_attempt_id := case v_attempt_no
      when 1 then '30173000-0000-0000-0000-000000000201'::uuid
      when 2 then '30173000-0000-0000-0000-000000000202'::uuid
      else '30173000-0000-0000-0000-000000000203'::uuid
    end;
    v_started := now() + make_interval(mins => v_attempt_no);

    insert into public.exam_sessions(
      id, assignment_id, examination_id, candidate_id, status,
      started_at, expires_at, submitted_at, client_fingerprint
    ) values (
      v_session_id,
      '30173000-0000-0000-0000-000000000010',
      v_exam_id,
      '30173000-0000-0000-0000-000000000001',
      'submitted',
      v_started,
      v_started + interval '2 hours',
      v_started + interval '90 minutes',
      jsonb_build_object('validation', 'cipmn-third-attempt-remediation')
    );

    insert into public.candidate_answers(
      session_id, question_id, selected_option_id, answered_at, client_sequence
    )
    select
      v_session_id,
      q.id,
      case
        when v_attempt_no = 3 and q.position = 1 then wrong_option.id
        else answer_key.correct_option_id
      end,
      v_started + interval '60 minutes',
      q.position
    from public.questions q
    join public.question_answer_keys answer_key on answer_key.question_id = q.id
    join lateral (
      select option.id
      from public.question_options option
      where option.question_id = q.id
        and option.id <> answer_key.correct_option_id
      order by option.position
      limit 1
    ) wrong_option on true
    where q.examination_id = v_exam_id and q.is_active = true;

    insert into public.attempts(
      id, session_id, examination_id, candidate_id,
      raw_score, maximum_score, percentage, status, suspicious_score,
      started_at, submitted_at, graded_at
    ) values (
      v_attempt_id,
      v_session_id,
      v_exam_id,
      '30173000-0000-0000-0000-000000000001',
      case when v_attempt_no = 3 then 74 else 75 end,
      75,
      case when v_attempt_no = 3 then 98.67 else 100 end,
      'submitted',
      0,
      v_started,
      v_started + interval '90 minutes',
      v_started + interval '90 minutes'
    );
  end loop;
end;
$$;

DO $$
begin
  if (select count(*) from public.agilecert_cipmn_attempt_reviews) <> 1 then
    raise exception 'Exactly one third-attempt review should exist.';
  end if;

  if exists (
    select 1 from public.agilecert_cipmn_attempt_reviews review
    where review.attempt_id in (
      '30173000-0000-0000-0000-000000000201',
      '30173000-0000-0000-0000-000000000202'
    )
  ) then
    raise exception 'An answer review was released before the third attempt.';
  end if;

  if not exists (
    select 1
    from public.agilecert_cipmn_attempt_reviews review
    where review.attempt_id = '30173000-0000-0000-0000-000000000203'
      and review.attempt_number = 3
      and review.question_count = 75
      and review.incorrect_count = 1
  ) then
    raise exception 'The third-attempt review summary is incorrect.';
  end if;

  if not exists (
    select 1
    from public.agilecert_cipmn_attempt_review_items item
    join public.agilecert_cipmn_attempt_reviews review on review.id = item.review_id
    where review.attempt_id = '30173000-0000-0000-0000-000000000203'
      and item.selected_option_id <> item.correct_option_id
      and length(trim(item.explanation)) > 20
  ) then
    raise exception 'The failed answer, protected correct answer and explanation were not snapshotted.';
  end if;

  if (select count(*) from public.agilecert_communication_outbox
      where event_key = 'cipmn-third-attempt-remediation:30173000-0000-0000-0000-000000000203') <> 1 then
    raise exception 'The remediation email was not queued exactly once.';
  end if;

  if not exists (
    select 1 from public.agilecert_communication_outbox outbox
    where outbox.event_key = 'cipmn-third-attempt-remediation:30173000-0000-0000-0000-000000000203'
      and outbox.message_type = 'admin_message'
      and outbox.category = 'operational'
      and outbox.status = 'queued'
      and outbox.payload ->> 'subject' like 'Your CIPMN third-attempt remediation%'
      and outbox.payload ->> 'body' like '%Key learning explanations%'
      and outbox.payload ->> 'body' like '%detailed answer key is not reproduced in email%'
  ) then
    raise exception 'The controlled remediation email payload is incomplete or exposes the wrong channel.';
  end if;
end;
$$;

DO $$
begin
  begin
    perform public.get_my_cipmn_attempt_review('30173000-0000-0000-0000-000000000201');
    raise exception 'Attempt one incorrectly exposed protected answers.';
  exception
    when others then
      if position('third completed attempt' in sqlerrm) = 0 then
        raise;
      end if;
  end;
end;
$$;

DO $$
declare
  v_attempts jsonb;
  v_review jsonb;
begin
  v_attempts := public.get_my_cipmn_remediation_attempts();
  if jsonb_array_length(v_attempts -> 'attempts') <> 3 then
    raise exception 'The candidate remediation summary did not return all three attempts: %', v_attempts;
  end if;
  if not exists (
    select 1
    from jsonb_array_elements(v_attempts -> 'attempts') item
    where (item ->> 'attemptNumber')::integer = 3
      and (item ->> 'reviewAvailable')::boolean = true
      and (item ->> 'incorrectCount')::integer = 1
  ) then
    raise exception 'The third attempt was not marked reviewable: %', v_attempts;
  end if;

  v_review := public.get_my_cipmn_attempt_review('30173000-0000-0000-0000-000000000203');
  if (v_review ->> 'attemptNumber')::integer <> 3
     or (v_review ->> 'incorrectCount')::integer <> 1
     or jsonb_array_length(v_review -> 'items') <> 1 then
    raise exception 'The protected remediation RPC returned an invalid review: %', v_review;
  end if;
  if coalesce(v_review #>> '{items,0,correctOptionText}', '') = ''
     or coalesce(v_review #>> '{items,0,explanation}', '') = '' then
    raise exception 'The protected review omitted the correct answer or explanation: %', v_review;
  end if;
end;
$$;

DO $$
begin
  if has_table_privilege('authenticated', 'public.agilecert_cipmn_attempt_reviews', 'select')
     or has_table_privilege('authenticated', 'public.agilecert_cipmn_attempt_review_items', 'select')
     or has_table_privilege('authenticated', 'public.question_answer_keys', 'select') then
    raise exception 'Candidate table privileges expose protected remediation or answer-key data.';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '30173000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

DO $$
begin
  begin
    perform public.get_my_cipmn_attempt_review('30173000-0000-0000-0000-000000000203');
    raise exception 'A different candidate accessed another candidate''s remediation review.';
  exception
    when others then
      if position('selected attempt was not found' in lower(sqlerrm)) = 0 then
        raise;
      end if;
  end;
end;
$$;

select
  (select count(*) from public.agilecert_cipmn_attempt_reviews) as third_attempt_reviews,
  (select count(*) from public.agilecert_cipmn_attempt_review_items) as failed_answer_items,
  (select count(*) from public.agilecert_communication_outbox
   where event_key like 'cipmn-third-attempt-remediation:%') as remediation_emails,
  (select count(*) from public.examinations e
   join public.programmes p on p.id = e.programme_id
   where p.code = 'CIPMN-MOCK' and e.max_attempts = 3) as cipmn_three_attempt_examinations;

rollback;

\set ON_ERROR_STOP on

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '29000000-0000-0000-0000-000000000001',
    'authenticated', 'authenticated', 'people-admin@example.test',
    extensions.crypt('PeopleTest1!', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"People Test Administrator"}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '29000000-0000-0000-0000-000000000002',
    'authenticated', 'authenticated', 'profile-candidate@example.test',
    extensions.crypt('PeopleTest1!', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Profile Test Candidate"}'::jsonb, now(), now()
  )
on conflict (id) do nothing;

update public.profiles
set role = 'super_admin', is_active = true, updated_at = now()
where id = '29000000-0000-0000-0000-000000000001';

insert into public.programmes(id, code, name, description, is_active, created_by)
values (
  '29000000-0000-0000-0000-000000000010',
  'PEOPLE-CI', 'People Administration Validation',
  'Isolated validation programme for mandatory onboarding and messaging.', true,
  '29000000-0000-0000-0000-000000000001'
)
on conflict (id) do nothing;

insert into public.examinations(
  id, programme_id, title, instructions, duration_minutes, pass_mark, status,
  max_attempts, randomize_questions, randomize_options, requires_payment, created_by
) values (
  '29000000-0000-0000-0000-000000000011',
  '29000000-0000-0000-0000-000000000010',
  'Mandatory Profile Validation Examination', 'CI only', 30, 70, 'published',
  1, false, false, true, '29000000-0000-0000-0000-000000000001'
)
on conflict (id) do nothing;

select set_config('request.jwt.claim.sub', '29000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

DO $$
begin
  if public.agilecert_candidate_profile_is_complete('29000000-0000-0000-0000-000000000002') then
    raise exception 'A newly registered candidate must not begin as onboarding-complete.';
  end if;
end;
$$;

DO $$
begin
  begin
    insert into public.exam_orders(
      candidate_id, examination_id, currency, list_amount_minor,
      discount_amount_minor, payable_amount_minor, status, gateway
    ) values (
      '29000000-0000-0000-0000-000000000002',
      '29000000-0000-0000-0000-000000000011',
      'NGN', 2500000, 0, 2500000, 'pending', 'paystack'
    );
    raise exception 'The examination-order profile gate did not block an incomplete candidate.';
  exception
    when others then
      if position('Complete your mandatory candidate profile' in sqlerrm) = 0 then
        raise;
      end if;
  end;
end;
$$;

select public.complete_my_agilecert_candidate_onboarding(
  'Profile Test Candidate', '+2347000000000', 'NG', 'NGN', 'Africa/Lagos',
  true, true, true
);

DO $$
declare
  v_status jsonb;
begin
  v_status := public.get_my_agilecert_onboarding_status();
  if coalesce((v_status ->> 'complete')::boolean, false) is not true then
    raise exception 'Candidate onboarding did not become complete: %', v_status;
  end if;
  if coalesce((v_status ->> 'completionPercent')::integer, 0) <> 100 then
    raise exception 'Completed candidate should report 100 percent: %', v_status;
  end if;
end;
$$;

insert into public.exam_orders(
  candidate_id, examination_id, currency, list_amount_minor,
  discount_amount_minor, payable_amount_minor, status, gateway
) values (
  '29000000-0000-0000-0000-000000000002',
  '29000000-0000-0000-0000-000000000011',
  'NGN', 2500000, 0, 2500000, 'pending', 'paystack'
);

select set_config('request.jwt.claim.sub', '29000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

DO $$
declare
  v_directory jsonb;
begin
  v_directory := public.get_agilecert_people_directory(
    'profile-candidate@example.test', 'candidate', 'active', 'complete', 20, 0
  );
  if coalesce((v_directory ->> 'total')::integer, 0) <> 1 then
    raise exception 'The administrator directory did not return the completed candidate: %', v_directory;
  end if;
end;
$$;

DO $$
declare
  v_result jsonb;
begin
  v_result := public.queue_agilecert_admin_message(
    array['29000000-0000-0000-0000-000000000002'::uuid],
    'Operational profile validation',
    'Your AgileCert candidate profile has been validated for secured services.',
    'operational',
    'CI candidate'
  );
  if coalesce((v_result ->> 'queued')::integer, 0) <> 1 then
    raise exception 'Operational administrator message was not queued: %', v_result;
  end if;
end;
$$;

DO $$
begin
  if not exists (
    select 1
    from public.agilecert_communication_outbox
    where candidate_id = '29000000-0000-0000-0000-000000000002'
      and message_type = 'admin_message'
      and subject = 'Operational profile validation'
      and payload ->> 'body' like 'Your AgileCert candidate profile%'
      and status = 'queued'
  ) then
    raise exception 'The administrator message payload was not retained in the communications outbox.';
  end if;
end;
$$;

DO $$
declare
  v_result jsonb;
begin
  v_result := public.queue_agilecert_admin_message(
    array['29000000-0000-0000-0000-000000000002'::uuid],
    'Optional certification offer',
    'Explore optional professional certification pathways available in AgileCert.',
    'marketing',
    'CI marketing'
  );
  if coalesce((v_result ->> 'queued')::integer, 0) <> 0
     or coalesce((v_result ->> 'skipped')::integer, 0) <> 1 then
    raise exception 'Marketing consent controls did not skip the candidate: %', v_result;
  end if;
end;
$$;

select public.update_agilecert_person_admin(
  '29000000-0000-0000-0000-000000000002',
  null, null, null, null, true
);

DO $$
begin
  if public.agilecert_candidate_profile_is_complete('29000000-0000-0000-0000-000000000002') then
    raise exception 'Administrator-required profile update did not re-enable the onboarding gate.';
  end if;
  if not exists (
    select 1 from public.audit_logs
    where actor_id = '29000000-0000-0000-0000-000000000001'
      and action in ('queue_admin_message', 'update_portal_person')
  ) then
    raise exception 'People administration audit records were not created.';
  end if;
end;
$$;

select
  public.agilecert_candidate_profile_is_complete('29000000-0000-0000-0000-000000000002') as profile_complete_after_admin_reset,
  count(*) filter (where message_type = 'admin_message') as administrator_messages
from public.agilecert_communication_outbox
where candidate_id = '29000000-0000-0000-0000-000000000002';

rollback;

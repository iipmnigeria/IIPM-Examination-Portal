\set ON_ERROR_STOP on

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '29100000-0000-0000-0000-000000000001',
    'authenticated', 'authenticated', 'cutover-admin@example.test', '', now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Cutover Administrator"}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '29100000-0000-0000-0000-000000000002',
    'authenticated', 'authenticated', 'cutover-candidate@example.test', '', now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Cutover Candidate"}'::jsonb, now(), now()
  )
on conflict (id) do nothing;

update public.profiles
set role = 'super_admin', is_active = true, updated_at = now()
where id = '29100000-0000-0000-0000-000000000001';

update public.profiles
set role = 'candidate', is_active = true, updated_at = now()
where id = '29100000-0000-0000-0000-000000000002';

insert into public.agilecert_communication_preferences(candidate_id)
values ('29100000-0000-0000-0000-000000000002')
on conflict (candidate_id) do nothing;

select set_config('request.jwt.claim.sub', '29100000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

DO $$
declare
  v_result jsonb;
  v_claimed integer;
begin
  v_result := public.queue_agilecert_admin_message(
    array['29100000-0000-0000-0000-000000000002'::uuid],
    'Controlled delivery cutover validation',
    'This operational message validates administrator email delivery after controlled provider activation.',
    'operational',
    'Cutover validation'
  );

  if coalesce((v_result ->> 'queued')::integer, 0) <> 1 then
    raise exception 'The administrator message was not queued: %', v_result;
  end if;

  select count(*) into v_claimed
  from public.claim_agilecert_communication_outbox(10, now());
  if v_claimed <> 0 then
    raise exception 'A provider-disabled message was claimed.';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'service_role', true);

select public.configure_agilecert_communication_provider_activation(
  true,
  'AgileCert Global',
  'verified-sender@example.test',
  'support@example.test',
  40,
  5,
  'example.test',
  true,
  'Isolated administrator message cutover validation'
);

DO $$
declare
  v_claimed integer;
begin
  select count(*) into v_claimed
  from public.claim_agilecert_communication_outbox(10, now());

  if v_claimed <> 1 then
    raise exception 'Expected one administrator message at the controlled cutover boundary, received %.', v_claimed;
  end if;

  if not exists (
    select 1
    from public.agilecert_communication_outbox
    where candidate_id = '29100000-0000-0000-0000-000000000002'
      and message_type = 'admin_message'
      and status = 'processing'
      and subject = 'Controlled delivery cutover validation'
      and payload ->> 'body' like 'This operational message validates%'
  ) then
    raise exception 'The claimed administrator message did not retain its subject and body.';
  end if;
end;
$$;

select message_type, category, status, subject
from public.agilecert_communication_outbox
where candidate_id = '29100000-0000-0000-0000-000000000002';

rollback;

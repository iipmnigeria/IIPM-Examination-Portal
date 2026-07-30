\set ON_ERROR_STOP on

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '29100000-0000-0000-0000-000000000001',
    'authenticated', 'authenticated', 'role-safety-admin@example.test',
    extensions.crypt('RoleSafety1!', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Role Safety Administrator"}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '29100000-0000-0000-0000-000000000002',
    'authenticated', 'authenticated', 'role-safety-person@example.test',
    extensions.crypt('RoleSafety1!', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Role Safety Person"}'::jsonb, now(), now()
  )
on conflict (id) do nothing;

-- Database bootstrap context has no browser JWT and may establish the test admin.
update public.profiles
set role = 'super_admin', is_active = true, updated_at = now()
where id = '29100000-0000-0000-0000-000000000001';

select set_config('request.jwt.claim.sub', '29100000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select public.update_agilecert_person_admin(
  '29100000-0000-0000-0000-000000000002',
  null, null, null, false, null
);

DO $$
begin
  if exists (
    select 1 from public.profiles
    where id = '29100000-0000-0000-0000-000000000002'
      and is_active = true
  ) then
    raise exception 'The controlled Super Administrator RPC did not suspend the account.';
  end if;
end;
$$;

select public.update_agilecert_person_admin(
  '29100000-0000-0000-0000-000000000002',
  null, null, 'auditor', true, null
);

DO $$
begin
  if not exists (
    select 1 from public.profiles
    where id = '29100000-0000-0000-0000-000000000002'
      and role = 'auditor'
      and is_active = true
  ) then
    raise exception 'The controlled Super Administrator RPC did not update role and status.';
  end if;
end;
$$;

select public.update_agilecert_person_admin(
  '29100000-0000-0000-0000-000000000002',
  null, null, 'candidate', null, null
);

DO $$
begin
  if not exists (
    select 1 from public.agilecert_candidate_profiles
    where user_id = '29100000-0000-0000-0000-000000000002'
      and profile_update_required = true
      and onboarding_completed_at is null
  ) then
    raise exception 'Conversion to candidate did not require mandatory onboarding.';
  end if;
end;
$$;

DO $$
begin
  begin
    perform public.update_agilecert_person_admin(
      '29100000-0000-0000-0000-000000000001',
      null, null, 'exam_admin', null, null
    );
    raise exception 'Self-demotion was not blocked.';
  exception
    when others then
      if position('cannot demote or suspend your own' in lower(sqlerrm)) = 0 then
        raise;
      end if;
  end;
end;
$$;

DO $$
begin
  begin
    update public.profiles
    set role = 'super_admin'
    where id = '29100000-0000-0000-0000-000000000002';
    raise exception 'Direct browser-context role escalation was not blocked.';
  exception
    when others then
      if position('authorised server operation' in lower(sqlerrm)) = 0 then
        raise;
      end if;
  end;
end;
$$;

DO $$
begin
  if not exists (
    select 1 from public.audit_logs
    where actor_id = '29100000-0000-0000-0000-000000000001'
      and action = 'update_portal_person'
      and entity_id = '29100000-0000-0000-0000-000000000002'
      and metadata ? 'before'
      and metadata ? 'after'
  ) then
    raise exception 'Role and status changes were not recorded with before-and-after audit evidence.';
  end if;
end;
$$;

select
  role,
  is_active,
  'people_admin_role_safety_passed' as validation_marker
from public.profiles
where id = '29100000-0000-0000-0000-000000000002';

rollback;

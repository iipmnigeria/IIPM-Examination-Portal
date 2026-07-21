-- IIPM Examination Portal
-- One-time bootstrap of the first Super Administrator.
-- Run only after iipmonline@iipmi.org has been created in Supabase Authentication.

do $$
declare
  target_user_id uuid;
  target_email text;
  target_name text;
begin
  select
    id,
    lower(email),
    coalesce(nullif(raw_user_meta_data ->> 'full_name', ''), 'IIPM Super Administrator')
  into target_user_id, target_email, target_name
  from auth.users
  where lower(email) = lower('iipmonline@iipmi.org')
  limit 1;

  if target_user_id is null then
    raise exception 'Supabase Auth user iipmonline@iipmi.org was not found. Create the user first under Authentication > Users, then run this migration again.';
  end if;

  insert into public.profiles (
    id,
    full_name,
    email,
    role,
    is_active
  )
  values (
    target_user_id,
    target_name,
    target_email,
    'super_admin',
    true
  )
  on conflict (id) do update
  set
    full_name = excluded.full_name,
    email = excluded.email,
    role = 'super_admin',
    is_active = true,
    updated_at = now();

  insert into public.audit_logs (
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    target_user_id,
    'bootstrap_super_admin',
    'profile',
    target_user_id,
    jsonb_build_object('email', target_email, 'source', 'migration_202607200003')
  );
end
$$;

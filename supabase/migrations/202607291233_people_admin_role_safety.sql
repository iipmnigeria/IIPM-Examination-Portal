begin;

-- Harden privileged profile administration so browser sessions still cannot
-- change authority fields directly, while the audited Super Administrator RPC
-- may do so without risking a complete administrator lockout.
create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Service-role/database operations have no authenticated end-user UID.
  if auth.uid() is null then
    return new;
  end if;

  -- Only the controlled Super Administrator RPC sets this transaction-local
  -- flag. A non-Super-Administrator remains blocked even if another exposed
  -- function ever attempts to set the same configuration key.
  if current_setting('app.agilecert_profile_admin_authorised', true) = 'on'
     and public.current_user_role() = 'super_admin' then
    return new;
  end if;

  if new.id <> old.id then
    raise exception 'Profile identity cannot be changed.';
  end if;

  if new.role is distinct from old.role
     or new.email is distinct from old.email
     or new.is_active is distinct from old.is_active
     or new.candidate_code is distinct from old.candidate_code then
    raise exception 'Privileged profile fields can be changed only by an authorised server operation.';
  end if;

  return new;
end;
$$;

create or replace function public.update_agilecert_person_admin(
  p_user_id uuid,
  p_full_name text default null,
  p_phone text default null,
  p_role text default null,
  p_is_active boolean default null,
  p_require_profile_update boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_role text := public.current_user_role();
  v_before public.profiles%rowtype;
  v_after public.profiles%rowtype;
  v_next_role text;
  v_next_active boolean;
  v_other_active_super_admins integer;
begin
  if v_actor_role <> 'super_admin' then
    raise exception 'Only a Super Administrator may change account authority.';
  end if;
  if p_role is not null and p_role not in ('candidate', 'auditor', 'exam_admin', 'super_admin') then
    raise exception 'Unsupported portal role.';
  end if;

  -- Serialise authority changes so two simultaneous requests cannot each
  -- remove what they believe is a different remaining Super Administrator.
  perform pg_advisory_xact_lock(hashtext('agilecert-super-admin-authority'));

  select * into v_before
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    raise exception 'The selected portal account was not found.';
  end if;

  v_next_role := coalesce(p_role, v_before.role);
  v_next_active := coalesce(p_is_active, v_before.is_active);

  if p_user_id = v_actor
     and (v_next_role <> 'super_admin' or not v_next_active) then
    raise exception 'You cannot demote or suspend your own Super Administrator account.';
  end if;

  if v_before.role = 'super_admin'
     and v_before.is_active
     and (v_next_role <> 'super_admin' or not v_next_active) then
    select count(*) into v_other_active_super_admins
    from public.profiles
    where id <> p_user_id
      and role = 'super_admin'
      and is_active = true;

    if v_other_active_super_admins < 1 then
      raise exception 'At least one active Super Administrator account must remain.';
    end if;
  end if;

  perform set_config('app.agilecert_profile_admin_authorised', 'on', true);

  update public.profiles set
    full_name = coalesce(nullif(trim(p_full_name), ''), full_name),
    phone = case when p_phone is null then phone else nullif(trim(p_phone), '') end,
    role = v_next_role,
    is_active = v_next_active,
    updated_at = now()
  where id = p_user_id
  returning * into v_after;

  perform set_config('app.agilecert_profile_admin_authorised', 'off', true);

  if v_after.role = 'candidate' then
    insert into public.agilecert_candidate_profiles(user_id, legal_name, phone, profile_update_required)
    values (
      v_after.id,
      v_after.full_name,
      v_after.phone,
      case
        when v_before.role <> 'candidate' then true
        else coalesce(p_require_profile_update, true)
      end
    )
    on conflict (user_id) do update set
      legal_name = excluded.legal_name,
      phone = excluded.phone,
      profile_update_required = case
        when v_before.role <> 'candidate' then true
        else coalesce(p_require_profile_update, public.agilecert_candidate_profiles.profile_update_required)
      end,
      onboarding_completed_at = case
        when v_before.role <> 'candidate' or coalesce(p_require_profile_update, false) then null
        else public.agilecert_candidate_profiles.onboarding_completed_at
      end,
      updated_at = now();
  end if;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (
    v_actor,
    'update_portal_person',
    'profile',
    p_user_id::text,
    jsonb_build_object(
      'before', jsonb_build_object(
        'role', v_before.role,
        'isActive', v_before.is_active,
        'fullName', v_before.full_name,
        'phone', v_before.phone
      ),
      'after', jsonb_build_object(
        'role', v_after.role,
        'isActive', v_after.is_active,
        'fullName', v_after.full_name,
        'phone', v_after.phone
      ),
      'requireProfileUpdate', p_require_profile_update
    )
  );

  return jsonb_build_object(
    'id', v_after.id,
    'fullName', v_after.full_name,
    'email', v_after.email,
    'role', v_after.role,
    'isActive', v_after.is_active
  );
end;
$$;

revoke all on function public.update_agilecert_person_admin(uuid, text, text, text, boolean, boolean)
  from public, anon, authenticated;
grant execute on function public.update_agilecert_person_admin(uuid, text, text, text, boolean, boolean)
  to authenticated;

comment on function public.update_agilecert_person_admin(uuid, text, text, text, boolean, boolean) is
  'Allows an active Super Administrator to make audited account changes while preventing self-lockout and removal of the final active Super Administrator.';

commit;

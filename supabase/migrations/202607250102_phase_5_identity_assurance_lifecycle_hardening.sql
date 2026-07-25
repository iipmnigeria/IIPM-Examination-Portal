begin;

-- Phase 5 lifecycle hardening. This follow-on migration was separated from the
-- main Phase 5 schema after validation identified two race conditions:
-- verified profile changes and identity withdrawal during an active
-- Professional Certificate order.

create or replace function public.agilecert_identity_profile_change_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_identity_fields_changed boolean;
  v_actor_id uuid := coalesce(auth.uid(), new.user_id);
begin
  v_identity_fields_changed :=
    old.legal_name is distinct from new.legal_name
    or old.phone is distinct from new.phone
    or old.country_code is distinct from new.country_code;

  if not v_identity_fields_changed then
    return new;
  end if;

  if exists (
    select 1
    from public.agilecert_identity_verifications verification
    where verification.candidate_id = new.user_id
      and verification.status = 'approved'
  ) and exists (
    select 1
    from public.agilecert_certificate_orders certificate_order
    where certificate_order.candidate_id = new.user_id
      and certificate_order.product_code = 'professional'
      and (
        certificate_order.status in ('paid', 'waived')
        or (
          certificate_order.status in ('pending', 'initialized')
          and (
            certificate_order.expires_at is null
            or certificate_order.expires_at > now()
          )
        )
      )
  ) then
    raise exception 'Verified identity fields cannot be changed while a Professional Certificate order is active.';
  end if;

  with expired as (
    update public.agilecert_identity_verifications verification
    set status = 'expired',
        approval_expires_at = now(),
        updated_at = now(),
        metadata = coalesce(verification.metadata, '{}'::jsonb) || jsonb_build_object(
          'expiredAt', now(),
          'expiredReason', 'candidate_identity_profile_changed'
        )
    where verification.candidate_id = new.user_id
      and verification.status = 'approved'
    returning verification.id, verification.candidate_id
  )
  insert into public.agilecert_identity_verification_audits (
    verification_id,
    actor_id,
    candidate_id,
    action,
    metadata
  )
  select
    expired.id,
    v_actor_id,
    expired.candidate_id,
    'identity_assurance_expired_profile_change',
    jsonb_build_object(
      'legalNameChanged', old.legal_name is distinct from new.legal_name,
      'phoneChanged', old.phone is distinct from new.phone,
      'countryChanged', old.country_code is distinct from new.country_code
    )
  from expired;

  return new;
end;
$$;

drop trigger if exists agilecert_identity_profile_change_guard_trigger
  on public.agilecert_candidate_profiles;
create trigger agilecert_identity_profile_change_guard_trigger
after update of legal_name, phone, country_code
on public.agilecert_candidate_profiles
for each row
execute function public.agilecert_identity_profile_change_guard();

create or replace function public.withdraw_my_agilecert_identity_assurance(
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate_id uuid := auth.uid();
  v_verification public.agilecert_identity_verifications%rowtype;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if v_candidate_id is null or not exists (
    select 1
    from public.profiles profile
    where profile.id = v_candidate_id
      and profile.role = 'candidate'
      and profile.is_active = true
  ) then
    raise exception 'An active candidate account is required.';
  end if;

  update public.agilecert_certificate_orders certificate_order
  set status = 'expired',
      updated_at = now(),
      metadata = coalesce(certificate_order.metadata, '{}'::jsonb) || jsonb_build_object(
        'expiredByIdentityWithdrawalCheckAt', now()
      )
  where certificate_order.candidate_id = v_candidate_id
    and certificate_order.product_code = 'professional'
    and certificate_order.status in ('pending', 'initialized')
    and certificate_order.expires_at is not null
    and certificate_order.expires_at <= now();

  if exists (
    select 1
    from public.agilecert_certificate_orders certificate_order
    where certificate_order.candidate_id = v_candidate_id
      and certificate_order.product_code = 'professional'
      and certificate_order.status in ('pending', 'initialized', 'paid', 'waived')
  ) then
    raise exception 'Identity assurance cannot be withdrawn while a Professional Certificate order is active or fulfilled.';
  end if;

  select * into v_verification
  from public.agilecert_identity_verifications verification
  where verification.candidate_id = v_candidate_id
    and verification.status in ('draft', 'submitted', 'under_review', 'changes_requested', 'approved')
  order by verification.created_at desc
  limit 1
  for update;

  if not found then
    raise exception 'No active identity-assurance submission was found.';
  end if;

  update public.agilecert_identity_verifications verification
  set status = 'withdrawn',
      approval_expires_at = case
        when verification.status = 'approved' then now()
        else verification.approval_expires_at
      end,
      updated_at = now(),
      metadata = coalesce(verification.metadata, '{}'::jsonb) || jsonb_build_object(
        'withdrawnAt', now(),
        'withdrawalReason', v_reason,
        'previousStatus', verification.status
      )
  where verification.id = v_verification.id
  returning * into v_verification;

  insert into public.agilecert_identity_verification_audits (
    verification_id,
    actor_id,
    candidate_id,
    action,
    metadata
  ) values (
    v_verification.id,
    v_candidate_id,
    v_candidate_id,
    'identity_assurance_withdrawn',
    jsonb_build_object(
      'reason', v_reason,
      'previousStatus', coalesce(v_verification.metadata->>'previousStatus', 'unknown')
    )
  );

  return jsonb_build_object(
    'id', v_verification.id,
    'status', v_verification.status
  );
end;
$$;

revoke all on function public.agilecert_identity_profile_change_guard()
  from public, anon, authenticated;

revoke all on function public.withdraw_my_agilecert_identity_assurance(text)
  from public, anon, authenticated;
grant execute on function public.withdraw_my_agilecert_identity_assurance(text)
  to authenticated;

comment on function public.agilecert_identity_profile_change_guard() is
  'Expires an approved identity-assurance record when verified candidate profile fields change, while blocking changes during an active Professional Certificate order.';

notify pgrst, 'reload schema';

commit;

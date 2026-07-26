begin;

-- Original Roadmap Phase 4, unit 5 of 5:
-- sanitize the public employer/institution response, keep helper functions
-- server-internal, seed policies for future programmes and allow a renewal
-- returned for changes to be recalculated and resubmitted.

create or replace function public.agilecert_seed_credential_policies_for_programme()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.agilecert_credential_policies (
    programme_id,
    product_code,
    validity_months,
    renewal_window_days,
    cpd_hours_required,
    share_link_default_days,
    active
  )
  select
    new.id,
    product.code,
    null,
    90,
    0,
    30,
    true
  from public.agilecert_certificate_products product
  on conflict (programme_id, product_code) do nothing;

  return new;
end;
$$;

drop trigger if exists agilecert_seed_credential_policies_for_programme_trigger
  on public.programmes;
create trigger agilecert_seed_credential_policies_for_programme_trigger
  after insert on public.programmes
  for each row
  execute function public.agilecert_seed_credential_policies_for_programme();

create or replace function public.request_my_agilecert_credential_renewal(
  p_credential_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate_id uuid := auth.uid();
  v_credential public.agilecert_paid_credentials%rowtype;
  v_programme_id uuid;
  v_policy public.agilecert_credential_policies%rowtype;
  v_approved_hours numeric(7,2);
  v_renewal public.agilecert_credential_renewals%rowtype;
  v_period_start timestamptz;
  v_proposed_expiry timestamptz;
  v_resubmission boolean := false;
begin
  select credential.* into v_credential
  from public.agilecert_paid_credentials credential
  where credential.id = p_credential_id
    and credential.candidate_id = v_candidate_id
  for update;

  if not found then
    raise exception 'The credential was not found.';
  end if;

  select examination.programme_id into v_programme_id
  from public.agilecert_issued_certificates certificate
  join public.examinations examination on examination.id = certificate.examination_id
  where certificate.id = v_credential.certificate_id;

  select * into v_policy
  from public.agilecert_credential_policies
  where programme_id = v_programme_id
    and product_code = v_credential.product_code
    and active = true;

  if not found or v_policy.validity_months is null or v_credential.expires_at is null then
    raise exception 'This credential does not currently require renewal.';
  end if;

  if public.agilecert_credential_effective_status(v_credential.id) in ('revoked', 'suspended') then
    raise exception 'A suspended or revoked credential cannot be renewed.';
  end if;

  if v_credential.renewal_due_at is not null and now() < v_credential.renewal_due_at then
    raise exception 'The renewal window has not opened yet.';
  end if;

  select * into v_renewal
  from public.agilecert_credential_renewals
  where credential_id = v_credential.id
    and status in ('pending', 'changes_requested')
  order by requested_at desc
  limit 1
  for update;

  if found and v_renewal.status = 'pending' then
    raise exception 'A renewal request is already open for this credential.';
  end if;

  if found and v_renewal.status = 'changes_requested' then
    v_resubmission := true;
  end if;

  v_period_start := coalesce(
    v_credential.last_renewed_at,
    v_credential.valid_from,
    v_credential.issued_at
  );

  select coalesce(sum(cpd.hours), 0)::numeric(7,2)
  into v_approved_hours
  from public.agilecert_cpd_records cpd
  where cpd.candidate_id = v_candidate_id
    and cpd.status = 'approved'
    and cpd.completed_on >= v_period_start::date
    and (cpd.credential_id is null or cpd.credential_id = v_credential.id);

  if v_approved_hours < v_policy.cpd_hours_required then
    raise exception 'Approved CPD hours are insufficient for renewal. Required: %, approved: %.',
      v_policy.cpd_hours_required, v_approved_hours;
  end if;

  v_proposed_expiry := greatest(v_credential.expires_at, now()) +
    make_interval(months => v_policy.validity_months);

  if v_resubmission then
    update public.agilecert_credential_renewals
    set status = 'pending',
        current_expires_at = v_credential.expires_at,
        proposed_expires_at = v_proposed_expiry,
        required_cpd_hours = v_policy.cpd_hours_required,
        approved_cpd_hours = v_approved_hours,
        requested_at = now(),
        reviewed_by = null,
        reviewed_at = null,
        review_reason = null,
        completed_at = null,
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
          'resubmittedAt', now(),
          'policyId', v_policy.id,
          'periodStart', v_period_start
        ),
        updated_at = now()
    where id = v_renewal.id
    returning * into v_renewal;
  else
    insert into public.agilecert_credential_renewals (
      credential_id,
      candidate_id,
      current_expires_at,
      proposed_expires_at,
      required_cpd_hours,
      approved_cpd_hours,
      metadata
    ) values (
      v_credential.id,
      v_candidate_id,
      v_credential.expires_at,
      v_proposed_expiry,
      v_policy.cpd_hours_required,
      v_approved_hours,
      jsonb_build_object('policyId', v_policy.id, 'periodStart', v_period_start)
    ) returning * into v_renewal;
  end if;

  insert into public.agilecert_credential_audit_events (
    credential_id, candidate_id, actor_id, event_type, metadata
  ) values (
    v_credential.id, v_candidate_id, v_candidate_id,
    case when v_resubmission then 'renewal_resubmitted' else 'renewal_requested' end,
    jsonb_build_object(
      'renewalId', v_renewal.id,
      'approvedCpdHours', v_approved_hours,
      'proposedExpiresAt', v_renewal.proposed_expires_at
    )
  );

  return jsonb_build_object(
    'id', v_renewal.id,
    'status', v_renewal.status,
    'proposedExpiresAt', v_renewal.proposed_expires_at,
    'approvedCpdHours', v_renewal.approved_cpd_hours,
    'resubmitted', v_resubmission,
    'message', case when v_resubmission
      then 'The credential renewal request was updated and resubmitted.'
      else 'The credential renewal request was submitted.' end
  );
end;
$$;

alter function public.verify_agilecert_professional_record(text)
  rename to verify_agilecert_professional_record_internal;

revoke all on function public.verify_agilecert_professional_record_internal(text)
  from public, anon, authenticated;

create or replace function public.verify_agilecert_professional_record(
  p_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_credentials jsonb;
begin
  v_result := public.verify_agilecert_professional_record_internal(p_code);

  if jsonb_typeof(v_result->'credentials') = 'array' then
    select coalesce(jsonb_agg(
      credential
        - 'credentialId'
        - 'orderId'
        - 'candidateId'
        - 'candidateEmail'
        - 'paymentAmount'
        - 'transactionReference'
        - 'providerPayload'
    ), '[]'::jsonb)
    into v_credentials
    from jsonb_array_elements(v_result->'credentials') credential;

    v_result := jsonb_set(v_result, '{credentials}', v_credentials, true);
  end if;

  return v_result
    - 'credentialId'
    - 'orderId'
    - 'candidateId'
    - 'candidateEmail'
    - 'paymentAmount'
    - 'transactionReference'
    - 'providerPayload';
end;
$$;

revoke all on function public.agilecert_credential_effective_status(uuid)
  from public, anon, authenticated;
revoke all on function public.agilecert_build_badge_assertion(uuid)
  from public, anon, authenticated;
revoke all on function public.agilecert_public_credential_payload(uuid)
  from public, anon, authenticated;
revoke all on function public.agilecert_seed_credential_policies_for_programme()
  from public, anon, authenticated;
revoke all on function public.request_my_agilecert_credential_renewal(uuid)
  from public;
revoke all on function public.verify_agilecert_professional_record(text)
  from public;

grant execute on function public.request_my_agilecert_credential_renewal(uuid)
  to authenticated;
grant execute on function public.verify_agilecert_professional_record(text)
  to anon, authenticated;

commit;

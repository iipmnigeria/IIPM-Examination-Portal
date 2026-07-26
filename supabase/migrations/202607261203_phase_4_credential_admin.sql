begin;

-- Original Roadmap Phase 4, unit 4 of 4:
-- CPD review, renewal decisions, configurable credential policies,
-- administrator reporting and lifecycle audit access.

create or replace function public.review_agilecert_cpd_record(
  p_record_id uuid,
  p_decision text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid := public.agilecert_require_certificate_admin();
  v_decision text := lower(trim(coalesce(p_decision, '')));
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_record public.agilecert_cpd_records%rowtype;
begin
  if v_decision not in ('approved', 'changes_requested', 'rejected') then
    raise exception 'Select approved, changes requested or rejected.';
  end if;

  if v_decision <> 'approved' and (v_reason is null or length(v_reason) < 5) then
    raise exception 'A clear review reason is required.';
  end if;

  select * into v_record
  from public.agilecert_cpd_records
  where id = p_record_id
  for update;

  if not found or v_record.status <> 'submitted' then
    raise exception 'Only submitted CPD records can be reviewed.';
  end if;

  update public.agilecert_cpd_records
  set status = v_decision,
      reviewed_by = v_admin_id,
      reviewed_at = now(),
      review_reason = v_reason,
      updated_at = now()
  where id = v_record.id
  returning * into v_record;

  insert into public.agilecert_credential_audit_events (
    credential_id, candidate_id, actor_id, event_type, metadata
  ) values (
    v_record.credential_id, v_record.candidate_id, v_admin_id,
    'cpd_record_' || v_decision,
    jsonb_build_object('cpdRecordId', v_record.id, 'reason', v_reason)
  );

  return jsonb_build_object(
    'id', v_record.id,
    'status', v_record.status,
    'message', 'The CPD review decision was recorded.'
  );
end;
$$;

create or replace function public.decide_agilecert_credential_renewal(
  p_renewal_id uuid,
  p_decision text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid := public.agilecert_require_certificate_admin();
  v_decision text := lower(trim(coalesce(p_decision, '')));
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_renewal public.agilecert_credential_renewals%rowtype;
  v_credential public.agilecert_paid_credentials%rowtype;
  v_programme_id uuid;
  v_policy public.agilecert_credential_policies%rowtype;
begin
  if v_decision not in ('approved', 'changes_requested', 'rejected') then
    raise exception 'Select approved, changes requested or rejected.';
  end if;

  if v_decision <> 'approved' and (v_reason is null or length(v_reason) < 5) then
    raise exception 'A clear renewal decision reason is required.';
  end if;

  select * into v_renewal
  from public.agilecert_credential_renewals
  where id = p_renewal_id
  for update;

  if not found or v_renewal.status not in ('pending', 'changes_requested') then
    raise exception 'The renewal request is unavailable for this decision.';
  end if;

  select * into v_credential
  from public.agilecert_paid_credentials
  where id = v_renewal.credential_id
  for update;

  if not found then
    raise exception 'The credential linked to this renewal was not found.';
  end if;

  if v_decision = 'approved' then
    if public.agilecert_credential_effective_status(v_credential.id) in ('revoked', 'suspended') then
      raise exception 'A suspended or revoked credential cannot be renewed.';
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

    if not found or v_policy.validity_months is null then
      raise exception 'An active expiring credential policy is required to approve renewal.';
    end if;

    if v_renewal.approved_cpd_hours < v_policy.cpd_hours_required then
      raise exception 'The approved CPD hours no longer satisfy the active renewal policy.';
    end if;

    update public.agilecert_paid_credentials
    set expires_at = v_renewal.proposed_expires_at,
        renewal_due_at = v_renewal.proposed_expires_at -
          make_interval(days => v_policy.renewal_window_days),
        last_renewed_at = now(),
        renewal_count = renewal_count + 1,
        lifecycle_metadata = coalesce(lifecycle_metadata, '{}'::jsonb) ||
          jsonb_build_object('lastRenewalId', v_renewal.id, 'lastRenewedBy', v_admin_id),
        updated_at = now()
    where id = v_credential.id
    returning * into v_credential;

    update public.agilecert_paid_credentials
    set badge_assertion = public.agilecert_build_badge_assertion(v_credential.id),
        updated_at = now()
    where id = v_credential.id;

    update public.agilecert_credential_renewals
    set status = 'completed',
        reviewed_by = v_admin_id,
        reviewed_at = now(),
        review_reason = v_reason,
        completed_at = now(),
        updated_at = now()
    where id = v_renewal.id
    returning * into v_renewal;
  else
    update public.agilecert_credential_renewals
    set status = v_decision,
        reviewed_by = v_admin_id,
        reviewed_at = now(),
        review_reason = v_reason,
        updated_at = now()
    where id = v_renewal.id
    returning * into v_renewal;
  end if;

  insert into public.agilecert_credential_audit_events (
    credential_id, candidate_id, actor_id, event_type, metadata
  ) values (
    v_renewal.credential_id, v_renewal.candidate_id, v_admin_id,
    'renewal_' || v_renewal.status,
    jsonb_build_object(
      'renewalId', v_renewal.id,
      'reason', v_reason,
      'proposedExpiresAt', v_renewal.proposed_expires_at
    )
  );

  return jsonb_build_object(
    'id', v_renewal.id,
    'status', v_renewal.status,
    'expiresAt', case when v_renewal.status = 'completed'
      then v_renewal.proposed_expires_at else v_renewal.current_expires_at end,
    'message', 'The credential renewal decision was recorded.'
  );
end;
$$;

create or replace function public.upsert_agilecert_credential_policy(
  p_programme_id uuid,
  p_product_code text,
  p_validity_months integer default null,
  p_renewal_window_days integer default 90,
  p_cpd_hours_required numeric default 0,
  p_share_link_default_days integer default 30,
  p_active boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid := public.agilecert_require_certificate_admin();
  v_product_code text := lower(trim(coalesce(p_product_code, '')));
  v_policy public.agilecert_credential_policies%rowtype;
begin
  if not exists (select 1 from public.programmes where id = p_programme_id) then
    raise exception 'The programme was not found.';
  end if;

  if v_product_code not in ('achievement', 'professional') then
    raise exception 'Select achievement or professional.';
  end if;

  if p_validity_months is not null and (p_validity_months < 1 or p_validity_months > 120) then
    raise exception 'Validity months must be between 1 and 120, or left blank for no expiry.';
  end if;

  insert into public.agilecert_credential_policies (
    programme_id, product_code, validity_months, renewal_window_days,
    cpd_hours_required, share_link_default_days, active, created_by, updated_by
  ) values (
    p_programme_id, v_product_code, p_validity_months,
    greatest(1, least(coalesce(p_renewal_window_days, 90), 730)),
    greatest(0, least(coalesce(p_cpd_hours_required, 0), 10000)),
    greatest(1, least(coalesce(p_share_link_default_days, 30), 365)),
    coalesce(p_active, true), v_admin_id, v_admin_id
  )
  on conflict (programme_id, product_code) do update
  set validity_months = excluded.validity_months,
      renewal_window_days = excluded.renewal_window_days,
      cpd_hours_required = excluded.cpd_hours_required,
      share_link_default_days = excluded.share_link_default_days,
      active = excluded.active,
      updated_by = v_admin_id,
      updated_at = now()
  returning * into v_policy;

  -- A deliberate expiring policy activates expiry for credentials that do not
  -- already carry an expiry. Existing renewal history is never shortened.
  if v_policy.active and v_policy.validity_months is not null then
    update public.agilecert_paid_credentials credential
    set valid_from = coalesce(credential.valid_from, credential.issued_at),
        expires_at = coalesce(
          credential.expires_at,
          coalesce(credential.valid_from, credential.issued_at) +
            make_interval(months => v_policy.validity_months)
        ),
        renewal_due_at = coalesce(
          credential.renewal_due_at,
          coalesce(credential.valid_from, credential.issued_at) +
            make_interval(months => v_policy.validity_months) -
            make_interval(days => v_policy.renewal_window_days)
        ),
        lifecycle_metadata = coalesce(credential.lifecycle_metadata, '{}'::jsonb) ||
          jsonb_build_object('expiryPolicyActivatedAt', now(), 'policyId', v_policy.id),
        updated_at = now()
    where credential.product_code = v_product_code
      and exists (
        select 1
        from public.agilecert_issued_certificates certificate
        join public.examinations examination on examination.id = certificate.examination_id
        where certificate.id = credential.certificate_id
          and examination.programme_id = p_programme_id
      );

    update public.agilecert_paid_credentials credential
    set badge_assertion = public.agilecert_build_badge_assertion(credential.id),
        updated_at = now()
    where credential.product_code = v_product_code
      and exists (
        select 1
        from public.agilecert_issued_certificates certificate
        join public.examinations examination on examination.id = certificate.examination_id
        where certificate.id = credential.certificate_id
          and examination.programme_id = p_programme_id
      );
  end if;

  insert into public.agilecert_credential_audit_events (
    actor_id, event_type, metadata
  ) values (
    v_admin_id, 'credential_policy_updated',
    jsonb_build_object(
      'policyId', v_policy.id,
      'programmeId', v_policy.programme_id,
      'productCode', v_policy.product_code,
      'validityMonths', v_policy.validity_months,
      'renewalWindowDays', v_policy.renewal_window_days,
      'cpdHoursRequired', v_policy.cpd_hours_required,
      'active', v_policy.active
    )
  );

  return jsonb_build_object(
    'id', v_policy.id,
    'programmeId', v_policy.programme_id,
    'productCode', v_policy.product_code,
    'validityMonths', v_policy.validity_months,
    'renewalWindowDays', v_policy.renewal_window_days,
    'cpdHoursRequired', v_policy.cpd_hours_required,
    'shareLinkDefaultDays', v_policy.share_link_default_days,
    'active', v_policy.active,
    'updatedAt', v_policy.updated_at
  );
end;
$$;

create or replace function public.get_agilecert_credential_admin_console(
  p_limit integer default 150
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 150), 500));
  v_policies jsonb;
  v_cpd jsonb;
  v_renewals jsonb;
  v_credentials jsonb;
  v_audits jsonb;
begin
  perform public.agilecert_require_certificate_admin();

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', policy.id,
    'programmeId', policy.programme_id,
    'programmeCode', programme.code,
    'programmeTitle', programme.name,
    'productCode', policy.product_code,
    'validityMonths', policy.validity_months,
    'renewalWindowDays', policy.renewal_window_days,
    'cpdHoursRequired', policy.cpd_hours_required,
    'shareLinkDefaultDays', policy.share_link_default_days,
    'active', policy.active,
    'updatedAt', policy.updated_at
  ) order by programme.code, policy.product_code), '[]'::jsonb)
  into v_policies
  from public.agilecert_credential_policies policy
  join public.programmes programme on programme.id = policy.programme_id;

  select coalesce(jsonb_agg(payload order by submitted_at desc nulls last), '[]'::jsonb)
  into v_cpd
  from (
    select cpd.submitted_at,
      jsonb_build_object(
        'id', cpd.id,
        'candidateId', cpd.candidate_id,
        'candidateName', profile.full_name,
        'candidateEmail', profile.email,
        'credentialId', cpd.credential_id,
        'title', cpd.title,
        'provider', cpd.provider,
        'activityType', cpd.activity_type,
        'completedOn', cpd.completed_on,
        'hours', cpd.hours,
        'evidenceReference', cpd.evidence_reference,
        'status', cpd.status,
        'submittedAt', cpd.submitted_at,
        'reviewedAt', cpd.reviewed_at,
        'reviewReason', cpd.review_reason
      ) payload
    from public.agilecert_cpd_records cpd
    join public.profiles profile on profile.id = cpd.candidate_id
    order by cpd.submitted_at desc nulls last, cpd.created_at desc
    limit v_limit
  ) recent;

  select coalesce(jsonb_agg(payload order by requested_at desc), '[]'::jsonb)
  into v_renewals
  from (
    select renewal.requested_at,
      jsonb_build_object(
        'id', renewal.id,
        'credentialId', renewal.credential_id,
        'candidateId', renewal.candidate_id,
        'candidateName', profile.full_name,
        'candidateEmail', profile.email,
        'credentialCode', credential.credential_code,
        'status', renewal.status,
        'currentExpiresAt', renewal.current_expires_at,
        'proposedExpiresAt', renewal.proposed_expires_at,
        'requiredCpdHours', renewal.required_cpd_hours,
        'approvedCpdHours', renewal.approved_cpd_hours,
        'requestedAt', renewal.requested_at,
        'reviewedAt', renewal.reviewed_at,
        'reviewReason', renewal.review_reason
      ) payload
    from public.agilecert_credential_renewals renewal
    join public.profiles profile on profile.id = renewal.candidate_id
    join public.agilecert_paid_credentials credential on credential.id = renewal.credential_id
    order by renewal.requested_at desc
    limit v_limit
  ) recent;

  select coalesce(jsonb_agg(
    public.agilecert_public_credential_payload(credential.id)
    || jsonb_build_object(
      'candidateId', credential.candidate_id,
      'candidateName', profile.full_name,
      'candidateEmail', profile.email,
      'renewalCount', credential.renewal_count,
      'lastRenewedAt', credential.last_renewed_at
    ) order by credential.issued_at desc
  ), '[]'::jsonb)
  into v_credentials
  from public.agilecert_paid_credentials credential
  join public.profiles profile on profile.id = credential.candidate_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', audit.id,
    'credentialId', audit.credential_id,
    'candidateId', audit.candidate_id,
    'actorId', audit.actor_id,
    'shareLinkId', audit.share_link_id,
    'eventType', audit.event_type,
    'metadata', audit.metadata,
    'createdAt', audit.created_at
  ) order by audit.created_at desc), '[]'::jsonb)
  into v_audits
  from (
    select * from public.agilecert_credential_audit_events
    order by created_at desc
    limit v_limit
  ) audit;

  return jsonb_build_object(
    'policies', v_policies,
    'cpdQueue', v_cpd,
    'renewals', v_renewals,
    'credentials', v_credentials,
    'auditEvents', v_audits,
    'counts', jsonb_build_object(
      'credentials', (select count(*) from public.agilecert_paid_credentials),
      'activeCredentials', (
        select count(*) from public.agilecert_paid_credentials credential
        where public.agilecert_credential_effective_status(credential.id) = 'active'
      ),
      'expiredCredentials', (
        select count(*) from public.agilecert_paid_credentials credential
        where public.agilecert_credential_effective_status(credential.id) = 'expired'
      ),
      'submittedCpd', (
        select count(*) from public.agilecert_cpd_records where status = 'submitted'
      ),
      'pendingRenewals', (
        select count(*) from public.agilecert_credential_renewals
        where status in ('pending', 'changes_requested')
      ),
      'activeShareLinks', (
        select count(*) from public.agilecert_credential_share_links
        where revoked_at is null and expires_at > now()
      )
    )
  );
end;
$$;

revoke all on function public.review_agilecert_cpd_record(uuid, text, text) from public;
revoke all on function public.decide_agilecert_credential_renewal(uuid, text, text) from public;
revoke all on function public.upsert_agilecert_credential_policy(uuid, text, integer, integer, numeric, integer, boolean) from public;
revoke all on function public.get_agilecert_credential_admin_console(integer) from public;

grant execute on function public.review_agilecert_cpd_record(uuid, text, text) to authenticated;
grant execute on function public.decide_agilecert_credential_renewal(uuid, text, text) to authenticated;
grant execute on function public.upsert_agilecert_credential_policy(uuid, text, integer, integer, numeric, integer, boolean) to authenticated;
grant execute on function public.get_agilecert_credential_admin_console(integer) to authenticated;

commit;

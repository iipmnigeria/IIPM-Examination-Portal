begin;

-- Original Roadmap Phase 4, unit 2 of 4:
-- privacy-bounded credential payloads, candidate wallet, examination history,
-- consolidated transcript data and candidate CPD record management.

create or replace function public.agilecert_public_credential_payload(
  p_credential_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_payload jsonb;
begin
  select jsonb_build_object(
    'credentialId', credential.id,
    'credentialCode', credential.credential_code,
    'badgeCode', credential.badge_code,
    'transcriptCode', credential.transcript_code,
    'productCode', credential.product_code,
    'productTitle', product.title,
    'holderName', certificate.holder_name,
    'certificateNumber', certificate.certificate_number,
    'certificateTitle', certificate.certificate_title,
    'examinationTitle', certificate.examination_title,
    'programmeCode', certificate.programme_code,
    'score', certificate.score,
    'passMark', certificate.pass_mark,
    'issueDate', certificate.issue_date,
    'issuedAt', credential.issued_at,
    'validFrom', coalesce(credential.valid_from, credential.issued_at),
    'expiresAt', credential.expires_at,
    'renewalDueAt', credential.renewal_due_at,
    'effectiveStatus', public.agilecert_credential_effective_status(credential.id),
    'valid', public.agilecert_credential_effective_status(credential.id) = 'active',
    'verificationUrl', credential.verification_url,
    'issuer', 'Integrated Institute of Professional Management (IIPM)',
    'poweredBy', 'AgileCert Global',
    'badgeAssertion', credential.badge_assertion
  ) into v_payload
  from public.agilecert_paid_credentials credential
  join public.agilecert_certificate_products product
    on product.code = credential.product_code
  join public.agilecert_issued_certificates certificate
    on certificate.id = credential.certificate_id
  where credential.id = p_credential_id;

  return coalesce(v_payload, '{}'::jsonb);
end;
$$;

create or replace function public.get_my_agilecert_credential_wallet()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_candidate_id uuid := auth.uid();
  v_credentials jsonb;
  v_history jsonb;
  v_cpd jsonb;
  v_renewals jsonb;
  v_shares jsonb;
  v_transcript jsonb;
begin
  if v_candidate_id is null or not exists (
    select 1 from public.profiles
    where id = v_candidate_id
      and role = 'candidate'
      and is_active = true
  ) then
    raise exception 'An active candidate account is required.';
  end if;

  select coalesce(jsonb_agg(
    public.agilecert_public_credential_payload(credential.id)
    || jsonb_build_object(
      'orderId', credential.order_id,
      'linkedinCredentialName', credential.linkedin_credential_name,
      'renewalCount', credential.renewal_count,
      'lastRenewedAt', credential.last_renewed_at,
      'renewalEligible', credential.expires_at is not null
        and credential.renewal_due_at is not null
        and now() >= credential.renewal_due_at
        and public.agilecert_credential_effective_status(credential.id) in ('active', 'expired'),
      'policy', jsonb_build_object(
        'validityMonths', policy.validity_months,
        'renewalWindowDays', coalesce(policy.renewal_window_days, 90),
        'cpdHoursRequired', coalesce(policy.cpd_hours_required, 0),
        'shareLinkDefaultDays', coalesce(policy.share_link_default_days, 30)
      )
    ) order by credential.issued_at desc
  ), '[]'::jsonb)
  into v_credentials
  from public.agilecert_paid_credentials credential
  join public.agilecert_issued_certificates certificate
    on certificate.id = credential.certificate_id
  join public.examinations examination on examination.id = certificate.examination_id
  left join public.agilecert_credential_policies policy
    on policy.programme_id = examination.programme_id
   and policy.product_code = credential.product_code
   and policy.active = true
  where credential.candidate_id = v_candidate_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'attemptId', attempt.id,
    'examinationId', attempt.examination_id,
    'examinationTitle', examination.title,
    'programmeCode', programme.code,
    'programmeTitle', programme.name,
    'attemptStatus', attempt.status,
    'score', coalesce(eligibility.score, attempt.percentage, 0),
    'passMark', coalesce(eligibility.pass_mark, examination.pass_mark, 70),
    'result', case
      when coalesce(eligibility.score, attempt.percentage, 0) >=
           coalesce(eligibility.pass_mark, examination.pass_mark, 70)
        then 'pass'
      else 'not_passed'
    end,
    'integrityStatus', eligibility.integrity_status,
    'completedAt', coalesce(attempt.submitted_at, attempt.graded_at),
    'certificateNumber', certificate.certificate_number,
    'credentialCode', credential.credential_code,
    'credentialStatus', case when credential.id is null then null
      else public.agilecert_credential_effective_status(credential.id)
    end
  ) order by coalesce(attempt.submitted_at, attempt.graded_at, attempt.started_at) desc), '[]'::jsonb)
  into v_history
  from public.attempts attempt
  join public.examinations examination on examination.id = attempt.examination_id
  join public.programmes programme on programme.id = examination.programme_id
  left join public.agilecert_certificate_eligibility_records eligibility
    on eligibility.attempt_id = attempt.id
  left join public.agilecert_issued_certificates certificate
    on certificate.attempt_id = attempt.id
  left join public.agilecert_paid_credentials credential
    on credential.certificate_id = certificate.id
  where attempt.candidate_id = v_candidate_id
    and attempt.status in ('submitted', 'flagged', 'terminated');

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', cpd.id,
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
    'reviewReason', cpd.review_reason,
    'createdAt', cpd.created_at,
    'updatedAt', cpd.updated_at
  ) order by cpd.completed_on desc, cpd.created_at desc), '[]'::jsonb)
  into v_cpd
  from public.agilecert_cpd_records cpd
  where cpd.candidate_id = v_candidate_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', renewal.id,
    'credentialId', renewal.credential_id,
    'status', renewal.status,
    'currentExpiresAt', renewal.current_expires_at,
    'proposedExpiresAt', renewal.proposed_expires_at,
    'requiredCpdHours', renewal.required_cpd_hours,
    'approvedCpdHours', renewal.approved_cpd_hours,
    'requestedAt', renewal.requested_at,
    'reviewedAt', renewal.reviewed_at,
    'reviewReason', renewal.review_reason,
    'completedAt', renewal.completed_at
  ) order by renewal.requested_at desc), '[]'::jsonb)
  into v_renewals
  from public.agilecert_credential_renewals renewal
  where renewal.candidate_id = v_candidate_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', share.id,
    'credentialId', share.credential_id,
    'scope', share.scope,
    'shareCode', share.share_code,
    'shareUrl', 'https://iipmnigeria.github.io/IIPM-Examination-Portal/?verify=' || share.share_code,
    'label', share.label,
    'expiresAt', share.expires_at,
    'revokedAt', share.revoked_at,
    'accessCount', share.access_count,
    'lastAccessedAt', share.last_accessed_at,
    'createdAt', share.created_at
  ) order by share.created_at desc), '[]'::jsonb)
  into v_shares
  from public.agilecert_credential_share_links share
  where share.candidate_id = v_candidate_id;

  select jsonb_build_object(
    'id', transcript.id,
    'transcriptCode', transcript.transcript_code,
    'publicEnabled', transcript.public_enabled,
    'issuedAt', transcript.issued_at,
    'updatedAt', transcript.updated_at,
    'verificationUrl', 'https://iipmnigeria.github.io/IIPM-Examination-Portal/?verify=' || transcript.transcript_code
  ) into v_transcript
  from public.agilecert_candidate_transcripts transcript
  where transcript.candidate_id = v_candidate_id;

  return jsonb_build_object(
    'credentials', v_credentials,
    'examinationHistory', v_history,
    'cpdRecords', v_cpd,
    'renewals', v_renewals,
    'shareLinks', v_shares,
    'transcript', coalesce(v_transcript, '{}'::jsonb),
    'counts', jsonb_build_object(
      'credentials', jsonb_array_length(v_credentials),
      'activeCredentials', (
        select count(*) from public.agilecert_paid_credentials credential
        where credential.candidate_id = v_candidate_id
          and public.agilecert_credential_effective_status(credential.id) = 'active'
      ),
      'examinations', jsonb_array_length(v_history),
      'approvedCpdHours', coalesce((
        select sum(hours) from public.agilecert_cpd_records
        where candidate_id = v_candidate_id and status = 'approved'
      ), 0),
      'pendingRenewals', (
        select count(*) from public.agilecert_credential_renewals
        where candidate_id = v_candidate_id
          and status in ('pending', 'changes_requested')
      ),
      'activeShareLinks', (
        select count(*) from public.agilecert_credential_share_links
        where candidate_id = v_candidate_id
          and revoked_at is null
          and expires_at > now()
      )
    )
  );
end;
$$;

create or replace function public.save_my_agilecert_cpd_record(
  p_title text,
  p_provider text,
  p_activity_type text,
  p_completed_on date,
  p_hours numeric,
  p_credential_id uuid default null,
  p_evidence_reference text default null,
  p_record_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate_id uuid := auth.uid();
  v_record public.agilecert_cpd_records%rowtype;
  v_activity_type text := lower(trim(coalesce(p_activity_type, '')));
begin
  if v_candidate_id is null then
    raise exception 'Authentication is required.';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = v_candidate_id and role = 'candidate' and is_active = true
  ) then
    raise exception 'An active candidate account is required.';
  end if;

  if length(trim(coalesce(p_title, ''))) < 3
     or length(trim(coalesce(p_provider, ''))) < 2 then
    raise exception 'Enter a valid CPD title and provider.';
  end if;

  if v_activity_type not in (
    'course', 'workshop', 'conference', 'webinar', 'professional_practice',
    'research', 'publication', 'mentoring', 'volunteering', 'other'
  ) then
    raise exception 'Select a valid CPD activity type.';
  end if;

  if p_completed_on is null or p_completed_on > current_date then
    raise exception 'The CPD completion date must be today or earlier.';
  end if;

  if p_hours is null or p_hours <= 0 or p_hours > 1000 then
    raise exception 'CPD hours must be greater than zero and no more than 1000.';
  end if;

  if p_credential_id is not null and not exists (
    select 1 from public.agilecert_paid_credentials
    where id = p_credential_id and candidate_id = v_candidate_id
  ) then
    raise exception 'The selected credential does not belong to the candidate.';
  end if;

  if p_record_id is null then
    insert into public.agilecert_cpd_records (
      candidate_id, credential_id, title, provider, activity_type,
      completed_on, hours, evidence_reference, status
    ) values (
      v_candidate_id, p_credential_id, trim(p_title), trim(p_provider),
      v_activity_type, p_completed_on, p_hours,
      nullif(trim(coalesce(p_evidence_reference, '')), ''), 'draft'
    ) returning * into v_record;
  else
    select * into v_record
    from public.agilecert_cpd_records
    where id = p_record_id and candidate_id = v_candidate_id
    for update;

    if not found then
      raise exception 'The CPD record was not found.';
    end if;

    if v_record.status not in ('draft', 'changes_requested') then
      raise exception 'Only draft or changes-requested CPD records can be edited.';
    end if;

    update public.agilecert_cpd_records
    set credential_id = p_credential_id,
        title = trim(p_title),
        provider = trim(p_provider),
        activity_type = v_activity_type,
        completed_on = p_completed_on,
        hours = p_hours,
        evidence_reference = nullif(trim(coalesce(p_evidence_reference, '')), ''),
        status = 'draft',
        review_reason = null,
        reviewed_by = null,
        reviewed_at = null,
        updated_at = now()
    where id = v_record.id
    returning * into v_record;
  end if;

  insert into public.agilecert_credential_audit_events (
    credential_id, candidate_id, actor_id, event_type, metadata
  ) values (
    v_record.credential_id, v_candidate_id, v_candidate_id,
    'cpd_record_saved', jsonb_build_object('cpdRecordId', v_record.id)
  );

  return jsonb_build_object(
    'id', v_record.id,
    'status', v_record.status,
    'message', 'The CPD record was saved as a draft.'
  );
end;
$$;

create or replace function public.submit_my_agilecert_cpd_record(
  p_record_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate_id uuid := auth.uid();
  v_record public.agilecert_cpd_records%rowtype;
begin
  select * into v_record
  from public.agilecert_cpd_records
  where id = p_record_id and candidate_id = v_candidate_id
  for update;

  if not found then
    raise exception 'The CPD record was not found.';
  end if;

  if v_record.status not in ('draft', 'changes_requested') then
    raise exception 'This CPD record cannot be submitted from its current status.';
  end if;

  update public.agilecert_cpd_records
  set status = 'submitted',
      submitted_at = now(),
      review_reason = null,
      reviewed_by = null,
      reviewed_at = null,
      updated_at = now()
  where id = v_record.id
  returning * into v_record;

  insert into public.agilecert_credential_audit_events (
    credential_id, candidate_id, actor_id, event_type, metadata
  ) values (
    v_record.credential_id, v_candidate_id, v_candidate_id,
    'cpd_record_submitted',
    jsonb_build_object('cpdRecordId', v_record.id, 'hours', v_record.hours)
  );

  return jsonb_build_object(
    'id', v_record.id,
    'status', v_record.status,
    'message', 'The CPD record was submitted for review.'
  );
end;
$$;

create or replace function public.set_my_agilecert_transcript_public(
  p_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate_id uuid := auth.uid();
  v_transcript public.agilecert_candidate_transcripts%rowtype;
begin
  update public.agilecert_candidate_transcripts
  set public_enabled = coalesce(p_enabled, false),
      updated_at = now()
  where candidate_id = v_candidate_id
  returning * into v_transcript;

  if not found then
    raise exception 'A candidate transcript is not available yet.';
  end if;

  insert into public.agilecert_credential_audit_events (
    candidate_id, actor_id, event_type, metadata
  ) values (
    v_candidate_id, v_candidate_id, 'transcript_visibility_changed',
    jsonb_build_object('publicEnabled', v_transcript.public_enabled)
  );

  return jsonb_build_object(
    'transcriptCode', v_transcript.transcript_code,
    'publicEnabled', v_transcript.public_enabled,
    'message', case when v_transcript.public_enabled
      then 'Permanent transcript-code verification is enabled.'
      else 'Permanent transcript-code verification is disabled.' end
  );
end;
$$;

revoke all on function public.agilecert_public_credential_payload(uuid) from public;
revoke all on function public.get_my_agilecert_credential_wallet() from public;
revoke all on function public.save_my_agilecert_cpd_record(text, text, text, date, numeric, uuid, text, uuid) from public;
revoke all on function public.submit_my_agilecert_cpd_record(uuid) from public;
revoke all on function public.set_my_agilecert_transcript_public(boolean) from public;

grant execute on function public.get_my_agilecert_credential_wallet() to authenticated;
grant execute on function public.save_my_agilecert_cpd_record(text, text, text, date, numeric, uuid, text, uuid) to authenticated;
grant execute on function public.submit_my_agilecert_cpd_record(uuid) to authenticated;
grant execute on function public.set_my_agilecert_transcript_public(boolean) to authenticated;

commit;

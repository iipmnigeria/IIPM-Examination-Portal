begin;

-- Original Roadmap Phase 4, unit 3 of 4:
-- candidate-controlled sharing, credential renewal and privacy-bounded public
-- professional-record verification.

create or replace function public.create_my_agilecert_credential_share_link(
  p_scope text,
  p_credential_id uuid default null,
  p_label text default null,
  p_valid_days integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_candidate_id uuid := auth.uid();
  v_scope text := lower(trim(coalesce(p_scope, '')));
  v_days integer;
  v_default_days integer := 30;
  v_share public.agilecert_credential_share_links%rowtype;
begin
  if v_candidate_id is null or not exists (
    select 1 from public.profiles
    where id = v_candidate_id and role = 'candidate' and is_active = true
  ) then
    raise exception 'An active candidate account is required.';
  end if;

  if v_scope not in ('credential', 'transcript') then
    raise exception 'Share scope must be credential or transcript.';
  end if;

  if v_scope = 'credential' then
    if p_credential_id is null or not exists (
      select 1 from public.agilecert_paid_credentials
      where id = p_credential_id and candidate_id = v_candidate_id
    ) then
      raise exception 'Select a credential owned by the candidate.';
    end if;

    select coalesce(policy.share_link_default_days, 30) into v_default_days
    from public.agilecert_paid_credentials credential
    join public.agilecert_issued_certificates certificate
      on certificate.id = credential.certificate_id
    join public.examinations examination on examination.id = certificate.examination_id
    left join public.agilecert_credential_policies policy
      on policy.programme_id = examination.programme_id
     and policy.product_code = credential.product_code
     and policy.active = true
    where credential.id = p_credential_id;
  else
    if not exists (
      select 1 from public.agilecert_candidate_transcripts
      where candidate_id = v_candidate_id
    ) then
      raise exception 'A candidate transcript is not available yet.';
    end if;
  end if;

  v_days := greatest(1, least(coalesce(p_valid_days, v_default_days, 30), 365));

  insert into public.agilecert_credential_share_links (
    candidate_id,
    credential_id,
    scope,
    share_code,
    label,
    expires_at,
    metadata
  ) values (
    v_candidate_id,
    case when v_scope = 'credential' then p_credential_id else null end,
    v_scope,
    'SHARE-' || upper(encode(gen_random_bytes(12), 'hex')),
    coalesce(nullif(trim(coalesce(p_label, '')), ''),
      case when v_scope = 'credential' then 'Credential verification link'
           else 'Professional transcript link' end),
    now() + make_interval(days => v_days),
    jsonb_build_object('validDays', v_days)
  ) returning * into v_share;

  insert into public.agilecert_credential_audit_events (
    credential_id, candidate_id, actor_id, share_link_id, event_type, metadata
  ) values (
    v_share.credential_id, v_candidate_id, v_candidate_id, v_share.id,
    'share_link_created',
    jsonb_build_object('scope', v_scope, 'expiresAt', v_share.expires_at)
  );

  return jsonb_build_object(
    'id', v_share.id,
    'scope', v_share.scope,
    'shareCode', v_share.share_code,
    'shareUrl', 'https://iipmnigeria.github.io/IIPM-Examination-Portal/?verify=' || v_share.share_code,
    'expiresAt', v_share.expires_at,
    'message', 'The verification link was created.'
  );
end;
$$;

create or replace function public.revoke_my_agilecert_credential_share_link(
  p_share_link_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate_id uuid := auth.uid();
  v_share public.agilecert_credential_share_links%rowtype;
begin
  update public.agilecert_credential_share_links
  set revoked_at = coalesce(revoked_at, now())
  where id = p_share_link_id
    and candidate_id = v_candidate_id
  returning * into v_share;

  if not found then
    raise exception 'The share link was not found.';
  end if;

  insert into public.agilecert_credential_audit_events (
    credential_id, candidate_id, actor_id, share_link_id, event_type
  ) values (
    v_share.credential_id, v_candidate_id, v_candidate_id, v_share.id,
    'share_link_revoked'
  );

  return jsonb_build_object(
    'id', v_share.id,
    'revokedAt', v_share.revoked_at,
    'message', 'The verification link was revoked.'
  );
end;
$$;

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

  if exists (
    select 1 from public.agilecert_credential_renewals
    where credential_id = v_credential.id
      and status in ('pending', 'changes_requested')
  ) then
    raise exception 'A renewal request is already open for this credential.';
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
    greatest(v_credential.expires_at, now()) + make_interval(months => v_policy.validity_months),
    v_policy.cpd_hours_required,
    v_approved_hours,
    jsonb_build_object('policyId', v_policy.id, 'periodStart', v_period_start)
  ) returning * into v_renewal;

  insert into public.agilecert_credential_audit_events (
    credential_id, candidate_id, actor_id, event_type, metadata
  ) values (
    v_credential.id, v_candidate_id, v_candidate_id,
    'renewal_requested',
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
    'message', 'The credential renewal request was submitted.'
  );
end;
$$;

create or replace function public.verify_agilecert_professional_record(
  p_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := trim(coalesce(p_code, ''));
  v_share public.agilecert_credential_share_links%rowtype;
  v_transcript public.agilecert_candidate_transcripts%rowtype;
  v_credential public.agilecert_paid_credentials%rowtype;
  v_candidate_id uuid;
  v_holder_name text;
  v_credentials jsonb;
  v_base jsonb;
begin
  if length(v_code) < 6 then
    return jsonb_build_object(
      'found', false,
      'valid', false,
      'recordType', 'not_found',
      'message', 'Enter a valid certificate, credential, badge, transcript or share code.'
    );
  end if;

  select * into v_share
  from public.agilecert_credential_share_links
  where lower(share_code) = lower(v_code)
  limit 1;

  if found then
    if v_share.revoked_at is not null or v_share.expires_at <= now() then
      return jsonb_build_object(
        'found', true,
        'valid', false,
        'recordType', v_share.scope || '_share',
        'status', case when v_share.revoked_at is not null then 'revoked' else 'expired' end,
        'message', 'This candidate-controlled verification link is no longer active.'
      );
    end if;

    update public.agilecert_credential_share_links
    set access_count = access_count + 1,
        last_accessed_at = now()
    where id = v_share.id;

    if v_share.scope = 'credential' then
      v_credentials := jsonb_build_array(
        public.agilecert_public_credential_payload(v_share.credential_id)
      );
      v_candidate_id := v_share.candidate_id;
    else
      v_candidate_id := v_share.candidate_id;
      select coalesce(jsonb_agg(
        public.agilecert_public_credential_payload(credential.id)
        order by credential.issued_at desc
      ), '[]'::jsonb)
      into v_credentials
      from public.agilecert_paid_credentials credential
      where credential.candidate_id = v_candidate_id;
    end if;

    select coalesce(nullif(trim(candidate_profile.legal_name), ''), profile.full_name)
    into v_holder_name
    from public.profiles profile
    left join public.agilecert_candidate_profiles candidate_profile
      on candidate_profile.user_id = profile.id
    where profile.id = v_candidate_id;

    insert into public.agilecert_credential_audit_events (
      credential_id, candidate_id, share_link_id, event_type, metadata
    ) values (
      v_share.credential_id, v_share.candidate_id, v_share.id,
      'share_link_verified',
      jsonb_build_object('scope', v_share.scope, 'accessedAt', now())
    );

    return jsonb_build_object(
      'found', true,
      'valid', true,
      'recordType', v_share.scope || '_share',
      'status', 'active',
      'holderName', v_holder_name,
      'credentials', v_credentials,
      'expiresAt', v_share.expires_at,
      'message', 'This candidate-controlled professional record is active and verifiable.'
    );
  end if;

  select * into v_transcript
  from public.agilecert_candidate_transcripts
  where lower(transcript_code) = lower(v_code)
  limit 1;

  if found then
    if not v_transcript.public_enabled then
      return jsonb_build_object(
        'found', true,
        'valid', false,
        'recordType', 'transcript',
        'status', 'private',
        'message', 'The candidate has not enabled permanent public transcript verification.'
      );
    end if;

    select coalesce(nullif(trim(candidate_profile.legal_name), ''), profile.full_name)
    into v_holder_name
    from public.profiles profile
    left join public.agilecert_candidate_profiles candidate_profile
      on candidate_profile.user_id = profile.id
    where profile.id = v_transcript.candidate_id;

    select coalesce(jsonb_agg(
      public.agilecert_public_credential_payload(credential.id)
      order by credential.issued_at desc
    ), '[]'::jsonb)
    into v_credentials
    from public.agilecert_paid_credentials credential
    where credential.candidate_id = v_transcript.candidate_id;

    insert into public.agilecert_credential_audit_events (
      candidate_id, event_type, metadata
    ) values (
      v_transcript.candidate_id,
      'public_transcript_verified',
      jsonb_build_object('transcriptId', v_transcript.id)
    );

    return jsonb_build_object(
      'found', true,
      'valid', true,
      'recordType', 'transcript',
      'status', 'active',
      'holderName', v_holder_name,
      'transcriptCode', v_transcript.transcript_code,
      'credentials', v_credentials,
      'message', 'This candidate transcript is publicly enabled and verifiable.'
    );
  end if;

  select credential.* into v_credential
  from public.agilecert_paid_credentials credential
  join public.agilecert_issued_certificates certificate
    on certificate.id = credential.certificate_id
  where lower(credential.credential_code) = lower(v_code)
     or lower(credential.badge_code) = lower(v_code)
     or lower(coalesce(credential.transcript_code, '')) = lower(v_code)
     or lower(certificate.certificate_number) = lower(v_code)
     or lower(certificate.verification_code) = lower(v_code)
  limit 1;

  if found then
    insert into public.agilecert_credential_audit_events (
      credential_id, candidate_id, event_type, metadata
    ) values (
      v_credential.id, v_credential.candidate_id,
      'public_credential_verified',
      jsonb_build_object('lookupCodeHash', encode(extensions.digest(lower(v_code), 'sha256'), 'hex'))
    );

    return jsonb_build_object(
      'found', true,
      'valid', public.agilecert_credential_effective_status(v_credential.id) = 'active',
      'recordType', 'credential',
      'status', public.agilecert_credential_effective_status(v_credential.id),
      'holderName', public.agilecert_public_credential_payload(v_credential.id)->>'holderName',
      'credentials', jsonb_build_array(
        public.agilecert_public_credential_payload(v_credential.id)
      ),
      'message', case public.agilecert_credential_effective_status(v_credential.id)
        when 'active' then 'This professional credential is active and publicly verifiable.'
        when 'expired' then 'This professional credential has expired and requires renewal.'
        when 'suspended' then 'This professional credential is currently suspended.'
        else 'This professional credential has been revoked.'
      end
    );
  end if;

  v_base := public.verify_agilecert_certificate(v_code);
  return v_base || jsonb_build_object(
    'recordType', case when coalesce((v_base->>'found')::boolean, false)
      then 'certificate' else 'not_found' end
  );
end;
$$;

revoke all on function public.create_my_agilecert_credential_share_link(text, uuid, text, integer) from public;
revoke all on function public.revoke_my_agilecert_credential_share_link(uuid) from public;
revoke all on function public.request_my_agilecert_credential_renewal(uuid) from public;
revoke all on function public.verify_agilecert_professional_record(text) from public;

grant execute on function public.create_my_agilecert_credential_share_link(text, uuid, text, integer) to authenticated;
grant execute on function public.revoke_my_agilecert_credential_share_link(uuid) to authenticated;
grant execute on function public.request_my_agilecert_credential_renewal(uuid) to authenticated;
grant execute on function public.verify_agilecert_professional_record(text) to anon, authenticated;

commit;

\set ON_ERROR_STOP on

begin;

do $$
declare
  v_candidate_one uuid := '00000000-0000-0000-0000-00000000c071';
  v_candidate_two uuid := '00000000-0000-0000-0000-00000000c072';
  v_document public.agilecert_candidate_cv_documents;
  v_registration jsonb;
  v_request_id uuid;
  v_result jsonb;
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) values
    (
      v_candidate_one, '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated', 'phase7-candidate-one@example.test',
      crypt('temporary-password', gen_salt('bf')), now(), '{}'::jsonb,
      jsonb_build_object('full_name', 'Phase 7 Candidate One'), now(), now()
    ),
    (
      v_candidate_two, '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated', 'phase7-candidate-two@example.test',
      crypt('temporary-password', gen_salt('bf')), now(), '{}'::jsonb,
      jsonb_build_object('full_name', 'Phase 7 Candidate Two'), now(), now()
    );

  update public.profiles
  set role = 'candidate', is_active = true
  where id in (v_candidate_one, v_candidate_two);

  perform set_config('request.jwt.claim.sub', v_candidate_one::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  v_document := public.upsert_my_agilecert_candidate_cv_document(
    'Phase 7 Completion CV',
    'Senior Project Manager',
    'Project professional with verified delivery experience.',
    'phase7-candidate-one@example.test',
    '+2348000000071',
    'Abuja, Nigeria',
    null,
    null,
    array['Project Planning', 'Stakeholder Management'],
    array['English'],
    jsonb_build_array(jsonb_build_object(
      'id', 'experience-1',
      'role', 'Project Manager',
      'organisation', 'Example Organisation',
      'location', 'Abuja',
      'startDate', '2024',
      'endDate', '',
      'current', true,
      'highlights', jsonb_build_array('Coordinated approved project activities.')
    )),
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    null,
    'professional',
    'draft',
    false
  );

  if v_document.candidate_id <> v_candidate_one then
    raise exception 'The private CV document was not bound to auth.uid().';
  end if;

  v_result := public.set_my_agilecert_ai_cv_consent(true);
  if coalesce((v_result->>'consent')::boolean, false) is not true then
    raise exception 'Explicit AI CV consent was not enabled.';
  end if;

  v_registration := public.register_agilecert_ai_cv_request(
    v_candidate_one,
    'role_tailoring',
    repeat('a', 64),
    repeat('b', 64),
    12
  );
  if coalesce((v_registration->>'allowed')::boolean, false) is not true then
    raise exception 'A consented candidate AI CV request was not allowed: %', v_registration;
  end if;
  v_request_id := nullif(v_registration->>'requestId', '')::uuid;
  if v_request_id is null then
    raise exception 'The AI CV request audit ID was not created.';
  end if;

  perform public.complete_agilecert_ai_cv_request(
    v_request_id,
    true,
    'test-model',
    'test-provider-request',
    jsonb_build_object('rawCvContentStored', false),
    jsonb_build_object('suggestedSummary', true, 'suggestedSkillCount', 2),
    null
  );

  v_result := public.mark_my_agilecert_ai_cv_enhancement_applied(v_request_id);
  if nullif(v_result->>'documentUpdatedAt', '') is null then
    raise exception 'Applying the AI suggestion did not update the private CV document.';
  end if;

  if not exists (
    select 1 from public.agilecert_ai_cv_requests
    where id = v_request_id
      and candidate_id = v_candidate_one
      and status = 'applied'
      and safety_metadata->>'rawCvContentStored' = 'false'
  ) then
    raise exception 'The minimal AI CV audit lifecycle is incomplete.';
  end if;

  if not exists (
    select 1 from public.agilecert_candidate_cv_documents
    where candidate_id = v_candidate_one
      and ai_last_enhanced_at is not null
  ) then
    raise exception 'The candidate CV enhancement timestamp was not recorded.';
  end if;

  perform public.set_my_agilecert_ai_cv_consent(false);
  begin
    perform public.register_agilecert_ai_cv_request(
      v_candidate_one,
      'professional_summary',
      null,
      null,
      12
    );
    raise exception 'An AI CV request was allowed after consent withdrawal.';
  exception
    when others then
      if position('Explicit AI CV processing consent is required' in sqlerrm) = 0 then
        raise;
      end if;
  end;
end;
$$;

-- Direct browser writes remain blocked.
do $$
begin
  if has_table_privilege('authenticated', 'public.agilecert_candidate_cv_documents', 'INSERT')
     or has_table_privilege('authenticated', 'public.agilecert_candidate_cv_documents', 'UPDATE')
     or has_table_privilege('authenticated', 'public.agilecert_ai_cv_requests', 'INSERT')
     or has_table_privilege('authenticated', 'public.agilecert_ai_cv_requests', 'UPDATE') then
    raise exception 'Authenticated browser roles received prohibited direct AI CV writes.';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.register_agilecert_ai_cv_request(uuid,text,text,text,integer)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.complete_agilecert_ai_cv_request(uuid,boolean,text,text,jsonb,jsonb,text)',
    'EXECUTE'
  ) then
    raise exception 'Authenticated browser roles received service-only AI CV authority.';
  end if;
end;
$$;

-- A second authenticated candidate cannot read the first candidate's CV or AI audit.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000c072', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

do $$
begin
  if (select count(*) from public.agilecert_candidate_cv_documents) <> 0 then
    raise exception 'A candidate could read another candidate CV document.';
  end if;
  if (select count(*) from public.agilecert_ai_cv_requests) <> 0 then
    raise exception 'A candidate could read another candidate AI CV audit.';
  end if;
end;
$$;

reset role;
rollback;

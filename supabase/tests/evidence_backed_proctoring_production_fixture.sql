begin;

-- This file is copied by CI into the migration sequence immediately before the
-- evidence-backed patch. It is never applied to production.

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000001',
    'authenticated', 'authenticated', 'evidence-admin@example.test',
    extensions.crypt('EvidenceTest1!', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Evidence Test Administrator"}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000002',
    'authenticated', 'authenticated', 'legacy-candidate@example.test',
    extensions.crypt('EvidenceTest1!', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Legacy Evidence Candidate"}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000003',
    'authenticated', 'authenticated', 'visual-candidate@example.test',
    extensions.crypt('EvidenceTest1!', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Visual Evidence Candidate"}'::jsonb, now(), now()
  )
on conflict (id) do nothing;

update public.profiles
set role = 'super_admin', is_active = true, updated_at = now()
where id = '10000000-0000-0000-0000-000000000001';

insert into public.programmes (
  id, code, name, description, is_active, created_by
) values (
  '10000000-0000-0000-0000-000000000010',
  'EVIDENCE-CI',
  'Evidence Validation Programme',
  'Isolated programme for evidence-backed proctoring validation.',
  true,
  '10000000-0000-0000-0000-000000000001'
)
on conflict (id) do nothing;

insert into public.examinations (
  id, programme_id, title, instructions, duration_minutes, pass_mark, status,
  max_attempts, randomize_questions, randomize_options, created_by
) values (
  '10000000-0000-0000-0000-000000000011',
  '10000000-0000-0000-0000-000000000010',
  'Evidence-Backed Proctoring Validation Examination',
  'CI-only examination used to validate evidence-backed audit controls.',
  60, 70, 'published', 1, false, false,
  '10000000-0000-0000-0000-000000000001'
)
on conflict (id) do nothing;

update public.agilecert_identity_proctoring_policies
set require_camera = true,
    live_event_capture_enabled = true,
    ai_visual_analysis_enabled = true,
    retain_webcam_images = true,
    updated_by = '10000000-0000-0000-0000-000000000001',
    updated_at = now()
where examination_id = '10000000-0000-0000-0000-000000000011';

insert into public.exam_assignments (
  id, examination_id, candidate_id, assigned_by, available_from, expires_at,
  max_attempts_override, status
) values
  (
    '10000000-0000-0000-0000-000000000020',
    '10000000-0000-0000-0000-000000000011',
    '10000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    now() - interval '2 hours', now() + interval '2 days', 1, 'completed'
  ),
  (
    '10000000-0000-0000-0000-000000000021',
    '10000000-0000-0000-0000-000000000011',
    '10000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000001',
    now() - interval '2 hours', now() + interval '2 days', 1, 'completed'
  )
on conflict (id) do nothing;

insert into public.exam_sessions (
  id, assignment_id, examination_id, candidate_id, status, started_at,
  expires_at, submitted_at, tab_away_count, suspicious_score
) values
  (
    '10000000-0000-0000-0000-000000000030',
    '10000000-0000-0000-0000-000000000020',
    '10000000-0000-0000-0000-000000000011',
    '10000000-0000-0000-0000-000000000002',
    'submitted', now() - interval '70 minutes', now() + interval '50 minutes',
    now() - interval '10 minutes', 0, 75
  ),
  (
    '10000000-0000-0000-0000-000000000031',
    '10000000-0000-0000-0000-000000000021',
    '10000000-0000-0000-0000-000000000011',
    '10000000-0000-0000-0000-000000000003',
    'submitted', now() - interval '65 minutes', now() + interval '55 minutes',
    now() - interval '5 minutes', 0, 0
  )
on conflict (id) do nothing;

insert into public.attempts (
  id, session_id, examination_id, candidate_id, raw_score, maximum_score,
  percentage, status, suspicious_score, started_at, submitted_at
) values
  (
    '10000000-0000-0000-0000-000000000040',
    '10000000-0000-0000-0000-000000000030',
    '10000000-0000-0000-0000-000000000011',
    '10000000-0000-0000-0000-000000000002',
    94.67, 100, 94.67, 'flagged', 75,
    now() - interval '70 minutes', now() - interval '10 minutes'
  ),
  (
    '10000000-0000-0000-0000-000000000041',
    '10000000-0000-0000-0000-000000000031',
    '10000000-0000-0000-0000-000000000011',
    '10000000-0000-0000-0000-000000000003',
    82, 100, 82, 'submitted', 0,
    now() - interval '65 minutes', now() - interval '5 minutes'
  )
on conflict (id) do nothing;

insert into public.agilecert_proctoring_sessions (
  id, session_id, examination_id, candidate_id, policy_version, status,
  started_at, ended_at, camera_permission, microphone_permission,
  fullscreen_status, connectivity_status, risk_score, risk_level
) values
  (
    '10000000-0000-0000-0000-000000000050',
    '10000000-0000-0000-0000-000000000030',
    '10000000-0000-0000-0000-000000000011',
    '10000000-0000-0000-0000-000000000002',
    1, 'submitted', now() - interval '70 minutes', now() - interval '10 minutes',
    'granted', 'not_requested', 'entered', 'online', 75, 'high'
  ),
  (
    '10000000-0000-0000-0000-000000000051',
    '10000000-0000-0000-0000-000000000031',
    '10000000-0000-0000-0000-000000000011',
    '10000000-0000-0000-0000-000000000003',
    1, 'submitted', now() - interval '65 minutes', now() - interval '5 minutes',
    'granted', 'not_requested', 'entered', 'online', 0, 'low'
  )
on conflict (id) do nothing;

commit;

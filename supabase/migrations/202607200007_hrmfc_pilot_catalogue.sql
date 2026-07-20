begin;

insert into public.programmes (id, code, name, description, is_active)
values (
  '10000000-0000-4000-8000-000000000101',
  'HRMFC',
  'Human Resource Management Foundation Certified',
  'Foundation-level professional examination in Human Resource Management.',
  true
)
on conflict (code) do update
set name = excluded.name,
    description = excluded.description,
    is_active = true,
    updated_at = now();

insert into public.examinations (
  id, programme_id, title, instructions, duration_minutes, pass_mark,
  status, max_attempts, randomize_questions, randomize_options,
  allow_self_enrollment
)
values (
  '20000000-0000-4000-8000-000000000101',
  (select id from public.programmes where code = 'HRMFC'),
  'Human Resource Management Foundation Certified (HRMFC)',
  'Answer every question. This pilot assessment is timed and subject to IIPM examination integrity controls.',
  10,
  70,
  'published',
  1,
  false,
  false,
  true
)
on conflict (id) do update
set programme_id = excluded.programme_id,
    title = excluded.title,
    instructions = excluded.instructions,
    duration_minutes = excluded.duration_minutes,
    pass_mark = excluded.pass_mark,
    status = excluded.status,
    max_attempts = excluded.max_attempts,
    randomize_questions = excluded.randomize_questions,
    randomize_options = excluded.randomize_options,
    allow_self_enrollment = excluded.allow_self_enrollment,
    updated_at = now();

insert into public.questions (id, examination_id, question_text, position, points, is_active)
values
  ('30000000-0000-4000-8000-000000000101', '20000000-0000-4000-8000-000000000101', 'What is the primary strategic objective of Human Resource Management within an organisation?', 1, 1, true),
  ('30000000-0000-4000-8000-000000000102', '20000000-0000-4000-8000-000000000101', 'Which employee lifecycle stage integrates a new hire into organisational culture, compliance requirements and performance expectations?', 2, 1, true),
  ('30000000-0000-4000-8000-000000000103', '20000000-0000-4000-8000-000000000101', 'What is the primary purpose of a formal job analysis?', 3, 1, true),
  ('30000000-0000-4000-8000-000000000104', '20000000-0000-4000-8000-000000000101', 'Which compensation component links employee payout directly to performance achievements?', 4, 1, true),
  ('30000000-0000-4000-8000-000000000105', '20000000-0000-4000-8000-000000000101', 'Which documented process helps an underperforming employee meet clearly defined expectations?', 5, 1, true)
on conflict (id) do update
set examination_id = excluded.examination_id,
    question_text = excluded.question_text,
    position = excluded.position,
    points = excluded.points,
    is_active = true,
    updated_at = now();

insert into public.question_options (id, question_id, option_text, position)
values
  ('40000000-0000-4000-8000-000000000101', '30000000-0000-4000-8000-000000000101', 'To manage physical office facilities and supplies only.', 1),
  ('40000000-0000-4000-8000-000000000102', '30000000-0000-4000-8000-000000000101', 'To align and optimise workforce capabilities to achieve organisational goals.', 2),
  ('40000000-0000-4000-8000-000000000103', '30000000-0000-4000-8000-000000000101', 'To maintain computer networks and software repositories.', 3),
  ('40000000-0000-4000-8000-000000000104', '30000000-0000-4000-8000-000000000101', 'To produce advertising materials and sales campaigns.', 4),
  ('40000000-0000-4000-8000-000000000111', '30000000-0000-4000-8000-000000000102', 'Candidate sourcing.', 1),
  ('40000000-0000-4000-8000-000000000112', '30000000-0000-4000-8000-000000000102', 'Structured onboarding.', 2),
  ('40000000-0000-4000-8000-000000000113', '30000000-0000-4000-8000-000000000102', 'Annual appraisal.', 3),
  ('40000000-0000-4000-8000-000000000114', '30000000-0000-4000-8000-000000000102', 'Offboarding.', 4),
  ('40000000-0000-4000-8000-000000000121', '30000000-0000-4000-8000-000000000103', 'To evaluate competitors and market share.', 1),
  ('40000000-0000-4000-8000-000000000122', '30000000-0000-4000-8000-000000000103', 'To identify duties, responsibilities, skills and working conditions of a role.', 2),
  ('40000000-0000-4000-8000-000000000123', '30000000-0000-4000-8000-000000000103', 'To schedule social activities.', 3),
  ('40000000-0000-4000-8000-000000000124', '30000000-0000-4000-8000-000000000103', 'To configure database servers.', 4),
  ('40000000-0000-4000-8000-000000000131', '30000000-0000-4000-8000-000000000104', 'Fixed base salary.', 1),
  ('40000000-0000-4000-8000-000000000132', '30000000-0000-4000-8000-000000000104', 'Variable incentive compensation.', 2),
  ('40000000-0000-4000-8000-000000000133', '30000000-0000-4000-8000-000000000104', 'Pension contribution.', 3),
  ('40000000-0000-4000-8000-000000000134', '30000000-0000-4000-8000-000000000104', 'Attendance record.', 4),
  ('40000000-0000-4000-8000-000000000141', '30000000-0000-4000-8000-000000000105', 'Immediate dismissal.', 1),
  ('40000000-0000-4000-8000-000000000142', '30000000-0000-4000-8000-000000000105', 'Performance Improvement Plan.', 2),
  ('40000000-0000-4000-8000-000000000143', '30000000-0000-4000-8000-000000000105', 'Salary reduction.', 3),
  ('40000000-0000-4000-8000-000000000144', '30000000-0000-4000-8000-000000000105', 'Role abandonment.', 4)
on conflict (id) do update
set question_id = excluded.question_id,
    option_text = excluded.option_text,
    position = excluded.position;

insert into public.question_answer_keys (question_id, correct_option_id)
values
  ('30000000-0000-4000-8000-000000000101', '40000000-0000-4000-8000-000000000102'),
  ('30000000-0000-4000-8000-000000000102', '40000000-0000-4000-8000-000000000112'),
  ('30000000-0000-4000-8000-000000000103', '40000000-0000-4000-8000-000000000122'),
  ('30000000-0000-4000-8000-000000000104', '40000000-0000-4000-8000-000000000132'),
  ('30000000-0000-4000-8000-000000000105', '40000000-0000-4000-8000-000000000142')
on conflict (question_id) do update
set correct_option_id = excluded.correct_option_id,
    updated_at = now();

commit;

begin;

insert into public.programmes (id, code, name, description, is_active)
values (
  '10000000-0000-4000-8000-000000000102',
  'CHRMP',
  'Certified Human Resource Management Professional',
  'Professional-level certification examination covering employee relations, labour-law compliance, performance management, compensation, HR analytics, HR technology and inclusive people practices.',
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
  '20000000-0000-4000-8000-000000000102',
  (select id from public.programmes where code = 'CHRMP'),
  'Certified Human Resource Management Professional (CHRMP)',
  'Answer every question. This professional assessment is timed and subject to IIPM examination integrity controls. Select the most appropriate response in each case.',
  30,
  70,
  'published',
  1,
  true,
  true,
  false
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
  ('30000000-0000-4000-8000-000000000201', '20000000-0000-4000-8000-000000000102', 'Which action best demonstrates procedural fairness when handling employee misconduct?', 1, 1, true),
  ('30000000-0000-4000-8000-000000000202', '20000000-0000-4000-8000-000000000102', 'What is the most important design principle of an effective performance management system?', 2, 1, true),
  ('30000000-0000-4000-8000-000000000203', '20000000-0000-4000-8000-000000000102', 'Which method is primarily used to establish the relative internal value of jobs for compensation purposes?', 3, 1, true),
  ('30000000-0000-4000-8000-000000000204', '20000000-0000-4000-8000-000000000102', 'In the Nigerian public service, what is the main purpose of an approved Scheme of Service?', 4, 1, true),
  ('30000000-0000-4000-8000-000000000205', '20000000-0000-4000-8000-000000000102', 'Which HR metric most directly measures the proportion of employees who leave an organisation within a defined period?', 5, 1, true),
  ('30000000-0000-4000-8000-000000000206', '20000000-0000-4000-8000-000000000102', 'Which control best protects confidential employee information in an HRIS?', 6, 1, true),
  ('30000000-0000-4000-8000-000000000207', '20000000-0000-4000-8000-000000000102', 'A selection process produces a much lower pass rate for one protected group than for others. What should HR examine first?', 7, 1, true),
  ('30000000-0000-4000-8000-000000000208', '20000000-0000-4000-8000-000000000102', 'Which approach best links employee rewards to both individual contribution and organisational affordability?', 8, 1, true),
  ('30000000-0000-4000-8000-000000000209', '20000000-0000-4000-8000-000000000102', 'What is the strongest basis for defending an employment decision during a labour dispute or regulatory review?', 9, 1, true),
  ('30000000-0000-4000-8000-000000000210', '20000000-0000-4000-8000-000000000102', 'Which HR analytics practice is most appropriate before recommending a workforce intervention?', 10, 1, true)
on conflict (id) do update
set examination_id = excluded.examination_id,
    question_text = excluded.question_text,
    position = excluded.position,
    points = excluded.points,
    is_active = true,
    updated_at = now();

insert into public.question_options (id, question_id, option_text, position)
values
  ('40000000-0000-4000-8000-000000000201', '30000000-0000-4000-8000-000000000201', 'Apply a sanction immediately based on the supervisor’s verbal report.', 1),
  ('40000000-0000-4000-8000-000000000202', '30000000-0000-4000-8000-000000000201', 'Notify the employee of the allegation, investigate objectively and provide an opportunity to respond.', 2),
  ('40000000-0000-4000-8000-000000000203', '30000000-0000-4000-8000-000000000201', 'Transfer the employee without documenting the reason.', 3),
  ('40000000-0000-4000-8000-000000000204', '30000000-0000-4000-8000-000000000201', 'Allow only senior employees to participate in the hearing.', 4),

  ('40000000-0000-4000-8000-000000000211', '30000000-0000-4000-8000-000000000202', 'Ratings should be based mainly on the manager’s personal impression.', 1),
  ('40000000-0000-4000-8000-000000000212', '30000000-0000-4000-8000-000000000202', 'Objectives, measures, feedback and development actions should align with organisational goals.', 2),
  ('40000000-0000-4000-8000-000000000213', '30000000-0000-4000-8000-000000000202', 'All employees should receive the same rating to avoid conflict.', 3),
  ('40000000-0000-4000-8000-000000000214', '30000000-0000-4000-8000-000000000202', 'Performance discussions should occur only when employment is ending.', 4),

  ('40000000-0000-4000-8000-000000000221', '30000000-0000-4000-8000-000000000203', 'Job evaluation.', 1),
  ('40000000-0000-4000-8000-000000000222', '30000000-0000-4000-8000-000000000203', 'Exit interviewing.', 2),
  ('40000000-0000-4000-8000-000000000223', '30000000-0000-4000-8000-000000000203', 'Succession planning.', 3),
  ('40000000-0000-4000-8000-000000000224', '30000000-0000-4000-8000-000000000203', 'Employee engagement surveying.', 4),

  ('40000000-0000-4000-8000-000000000231', '30000000-0000-4000-8000-000000000204', 'To prescribe job classifications, entry requirements, duties and career progression for cadres.', 1),
  ('40000000-0000-4000-8000-000000000232', '30000000-0000-4000-8000-000000000204', 'To replace all financial regulations and procurement rules.', 2),
  ('40000000-0000-4000-8000-000000000233', '30000000-0000-4000-8000-000000000204', 'To approve individual leave applications.', 3),
  ('40000000-0000-4000-8000-000000000234', '30000000-0000-4000-8000-000000000204', 'To set daily attendance times for every ministry.', 4),

  ('40000000-0000-4000-8000-000000000241', '30000000-0000-4000-8000-000000000205', 'Absence rate.', 1),
  ('40000000-0000-4000-8000-000000000242', '30000000-0000-4000-8000-000000000205', 'Employee turnover rate.', 2),
  ('40000000-0000-4000-8000-000000000243', '30000000-0000-4000-8000-000000000205', 'Training completion rate.', 3),
  ('40000000-0000-4000-8000-000000000244', '30000000-0000-4000-8000-000000000205', 'Offer acceptance rate.', 4),

  ('40000000-0000-4000-8000-000000000251', '30000000-0000-4000-8000-000000000206', 'A shared administrator password used by all HR staff.', 1),
  ('40000000-0000-4000-8000-000000000252', '30000000-0000-4000-8000-000000000206', 'Role-based access, strong authentication and audit logging.', 2),
  ('40000000-0000-4000-8000-000000000253', '30000000-0000-4000-8000-000000000206', 'Exporting all employee files to personal devices.', 3),
  ('40000000-0000-4000-8000-000000000254', '30000000-0000-4000-8000-000000000206', 'Disabling record-retention controls.', 4),

  ('40000000-0000-4000-8000-000000000261', '30000000-0000-4000-8000-000000000207', 'Whether the assessment creates adverse impact and whether it is job-related and valid.', 1),
  ('40000000-0000-4000-8000-000000000262', '30000000-0000-4000-8000-000000000207', 'Whether the unsuccessful candidates can be excluded from future recruitment.', 2),
  ('40000000-0000-4000-8000-000000000263', '30000000-0000-4000-8000-000000000207', 'Whether the organisation can conceal the selection data.', 3),
  ('40000000-0000-4000-8000-000000000264', '30000000-0000-4000-8000-000000000207', 'Whether the same interviewer can make every decision alone.', 4),

  ('40000000-0000-4000-8000-000000000271', '30000000-0000-4000-8000-000000000208', 'A total-reward framework combining market position, internal equity, performance and budget controls.', 1),
  ('40000000-0000-4000-8000-000000000272', '30000000-0000-4000-8000-000000000208', 'Automatic annual increases without performance or affordability review.', 2),
  ('40000000-0000-4000-8000-000000000273', '30000000-0000-4000-8000-000000000208', 'Pay decisions based only on employee tenure.', 3),
  ('40000000-0000-4000-8000-000000000274', '30000000-0000-4000-8000-000000000208', 'Confidential pay decisions without approved salary structures.', 4),

  ('40000000-0000-4000-8000-000000000281', '30000000-0000-4000-8000-000000000209', 'Consistent policy, reliable evidence, documented process and an opportunity for the employee to respond.', 1),
  ('40000000-0000-4000-8000-000000000282', '30000000-0000-4000-8000-000000000209', 'The manager’s undocumented recollection of events.', 2),
  ('40000000-0000-4000-8000-000000000283', '30000000-0000-4000-8000-000000000209', 'A decision made differently from similar previous cases without explanation.', 3),
  ('40000000-0000-4000-8000-000000000284', '30000000-0000-4000-8000-000000000209', 'Informal messages exchanged outside the approved process.', 4),

  ('40000000-0000-4000-8000-000000000291', '30000000-0000-4000-8000-000000000210', 'Recommend an intervention immediately after observing one unusual case.', 1),
  ('40000000-0000-4000-8000-000000000292', '30000000-0000-4000-8000-000000000210', 'Define the business question, validate the data, analyse relevant patterns and test alternative explanations.', 2),
  ('40000000-0000-4000-8000-000000000293', '30000000-0000-4000-8000-000000000210', 'Use only the metric that produces the preferred conclusion.', 3),
  ('40000000-0000-4000-8000-000000000294', '30000000-0000-4000-8000-000000000210', 'Exclude historical comparisons and workforce segments.', 4)
on conflict (id) do update
set question_id = excluded.question_id,
    option_text = excluded.option_text,
    position = excluded.position;

insert into public.question_answer_keys (question_id, correct_option_id)
values
  ('30000000-0000-4000-8000-000000000201', '40000000-0000-4000-8000-000000000202'),
  ('30000000-0000-4000-8000-000000000202', '40000000-0000-4000-8000-000000000212'),
  ('30000000-0000-4000-8000-000000000203', '40000000-0000-4000-8000-000000000221'),
  ('30000000-0000-4000-8000-000000000204', '40000000-0000-4000-8000-000000000231'),
  ('30000000-0000-4000-8000-000000000205', '40000000-0000-4000-8000-000000000242'),
  ('30000000-0000-4000-8000-000000000206', '40000000-0000-4000-8000-000000000252'),
  ('30000000-0000-4000-8000-000000000207', '40000000-0000-4000-8000-000000000261'),
  ('30000000-0000-4000-8000-000000000208', '40000000-0000-4000-8000-000000000271'),
  ('30000000-0000-4000-8000-000000000209', '40000000-0000-4000-8000-000000000281'),
  ('30000000-0000-4000-8000-000000000210', '40000000-0000-4000-8000-000000000292')
on conflict (question_id) do update
set correct_option_id = excluded.correct_option_id,
    updated_at = now();

commit;

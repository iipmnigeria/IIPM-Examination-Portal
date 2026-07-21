begin;

-- 1. Insert CHRMG Programme
insert into public.programmes (id, code, name, description, is_active)
values (
  '10000000-0000-4000-8000-000000000102',
  'CHRMG',
  'Certified Human Resource Generalist',
  'Professional-level certification validating core competencies of an HR Generalist, including employee relations, total rewards, recruitment, performance management, and operations.',
  true
)
on conflict (code) do update
set name = excluded.name,
    description = excluded.description,
    is_active = true,
    updated_at = now();

-- 2. Insert CHRMG Examination
insert into public.examinations (
  id, programme_id, title, instructions, duration_minutes, pass_mark,
  status, max_attempts, randomize_questions, randomize_options,
  allow_self_enrollment
)
values (
  '20000000-0000-4000-8000-000000000102',
  (select id from public.programmes where code = 'CHRMG'),
  'Certified Human Resource Generalist (CHRMG)',
  'Answer all 50 multiple-choice questions. This examination evaluates core competencies required of an HR Generalist and is subject to IIPM proctoring controls.',
  60,
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

-- 3. Insert Questions (50 questions)
insert into public.questions (id, examination_id, question_text, position, points, is_active)
values
  ('30000000-0000-4000-8000-000000000201', '20000000-0000-4000-8000-000000000102', 'Scenario: An employee submits a formal complaint to HR stating that their immediate manager has been making inappropriate personal remarks. The employee expresses fear of retaliation. What is the most critical immediate action the HR Generalist must take?', 1, 1, true),
  ('30000000-0000-4000-8000-000000000202', '20000000-0000-4000-8000-000000000102', 'Scenario: A team of software engineers reports a persistent clash between two senior designers regarding product styling, which is delaying project milestones. What conflict resolution technique should the HR Generalist facilitate to achieve a sustainable, win-win outcome?', 2, 1, true),
  ('30000000-0000-4000-8000-000000000203', '20000000-0000-4000-8000-000000000102', 'Scenario: A customer service agent with high customer ratings is found to be consistently late for work. Following the company’s progressive discipline policy, the supervisor wants to issue an immediate suspension. What is HR''s role in advising this supervisor?', 3, 1, true),
  ('30000000-0000-4000-8000-000000000204', '20000000-0000-4000-8000-000000000102', 'Scenario: During an exit interview, a high-performing analyst states that they are resigning because their supervisor has repeatedly changed performance targets without notice and excluded them from core client presentations. What does this situation indicate to HR strategically?', 4, 1, true),
  ('30000000-0000-4000-8000-000000000205', '20000000-0000-4000-8000-000000000102', 'Scenario: An HR Generalist is reviewing engagement survey results for a division experiencing high turnover. The data shows that while employees are happy with benefits, they feel highly disconnected from management decision-making. What is the most constructive response?', 5, 1, true),
  ('30000000-0000-4000-8000-000000000206', '20000000-0000-4000-8000-000000000102', 'Scenario: An employee claims they were forced to resign because the company made their working conditions intolerable by cutting their pay by 20% and changing their shift to overnight without reason. What legal risk does this scenario present to the company?', 6, 1, true),
  ('30000000-0000-4000-8000-000000000207', '20000000-0000-4000-8000-000000000102', 'Scenario: An HR Generalist is conducting stay interviews with critical software developers. Several developers express that while they enjoy their work, they are constantly approached by external recruiters offering remote options. What should HR recommend?', 7, 1, true),
  ('30000000-0000-4000-8000-000000000208', '20000000-0000-4000-8000-000000000102', 'Scenario: A company is planning a major restructuring that will eliminate several roles and introduce new operational technologies. HR is tasked with managing employee anxiety and maintaining engagement. What should be HR''s primary communication strategy?', 8, 1, true),
  ('30000000-0000-4000-8000-000000000209', '20000000-0000-4000-8000-000000000102', 'Scenario: A top-performing sales executive is accused of bullying junior sales coordinators. The head of sales asks HR to ignore the complaint because the executive generates 40% of the department''s revenue. How should HR respond?', 9, 1, true),
  ('30000000-0000-4000-8000-000000000210', '20000000-0000-4000-8000-000000000102', 'Scenario: An employee requests to bring an external legal counsel into a routine internal meeting with their manager regarding a minor performance concern. What is the standard HR generalist best practice in this scenario?', 10, 1, true),
  ('30000000-0000-4000-8000-000000000211', '20000000-0000-4000-8000-000000000102', 'Scenario: A logistics company needs to recruit 100 delivery drivers in a short period due to seasonal expansion. The HR Generalist needs to select a sourcing and screening strategy that is fast but reliable. Which approach is most effective?', 11, 1, true),
  ('30000000-0000-4000-8000-000000000212', '20000000-0000-4000-8000-000000000102', 'Scenario: To reduce subjectivity and personal bias in hiring, the Head of HR wants to reform the interviewing process for administrative roles. What interview design has the highest predictive validity?', 12, 1, true),
  ('30000000-0000-4000-8000-000000000213', '20000000-0000-4000-8000-000000000102', 'Scenario: A tech company wishes to move from hiring for "cultural fit" to "cultural add" in its engineering department. What is the fundamental difference between these two philosophies?', 13, 1, true),
  ('30000000-0000-4000-8000-000000000214', '20000000-0000-4000-8000-000000000102', 'Scenario: During an interview debrief, a hiring manager states that they want to hire a candidate because they went to the same university and are highly energetic, ignoring the fact that the candidate scored poorly on the technical assessment. What cognitive bias is the manager exhibiting?', 14, 1, true),
  ('30000000-0000-4000-8000-000000000215', '20000000-0000-4000-8000-000000000102', 'Scenario: An HR Generalist is evaluating a recruitment pipeline and notices that while candidate attraction is high, 45% of offers in the customer success department are rejected. What is the first diagnostic step HR should take?', 15, 1, true),
  ('30000000-0000-4000-8000-000000000216', '20000000-0000-4000-8000-000000000102', 'Scenario: When conducting background checks for a candidate who is about to be offered a financial clerk position, HR receives a highly enthusiastic reference letter from a relative, but the candidate''s previous employer refuses to disclose anything other than dates of employment. How should HR handle this?', 16, 1, true),
  ('30000000-0000-4000-8000-000000000217', '20000000-0000-4000-8000-000000000102', 'Scenario: A manufacturing company wants to implement pre-employment tests to evaluate the manual dexterity and safety alignment of machinery operators. To ensure the tests are legally defensible, what must HR verify?', 17, 1, true),
  ('30000000-0000-4000-8000-000000000218', '20000000-0000-4000-8000-000000000102', 'Scenario: A tech startup is experiencing high voluntary turnover among engineers who quit within their first 6 months. Exit surveys indicate they felt the actual job duties were completely different from what was described during recruitment. What is the best solution?', 18, 1, true),
  ('30000000-0000-4000-8000-000000000219', '20000000-0000-4000-8000-000000000102', 'Scenario: A financial services firm wants to improve its onboarding process to increase first-year retention. Which structure represents the most strategic and complete onboarding framework?', 19, 1, true),
  ('30000000-0000-4000-8000-000000000220', '20000000-0000-4000-8000-000000000102', 'Scenario: An employee submits a medical request for a specialized ergonomic desk chair and a software text-to-speech reader due to a physical disability. How should the HR Generalist proceed under accommodation frameworks?', 20, 1, true),
  ('30000000-0000-4000-8000-000000000221', '20000000-0000-4000-8000-000000000102', 'Scenario: To address high burnout rates in customer operations, HR wants to implement a wellness initiative. Which of the following approaches is most likely to deliver a measurable, positive impact on employee retention?', 21, 1, true),
  ('30000000-0000-4000-8000-000000000222', '20000000-0000-4000-8000-000000000102', 'Scenario: During calibration, the HR team realizes that the company''s baby-boomer generation managers are reporting high frustration with younger Gen Z hires, citing different communications and remote work expectations. How should HR intervene?', 22, 1, true),
  ('30000000-0000-4000-8000-000000000223', '20000000-0000-4000-8000-000000000102', 'Scenario: An HR Generalist is looking for ways to enrich the roles of senior customer service representatives who are bored but do not want to move into people-management. Which job design approach should HR implement?', 23, 1, true),
  ('30000000-0000-4000-8000-000000000224', '20000000-0000-4000-8000-000000000102', 'Scenario: To increase workforce flexibility and reduce facility costs, the executive committee asks HR to review compressed workweek configurations. What is a standard compressed workweek setup?', 24, 1, true),
  ('30000000-0000-4000-8000-000000000225', '20000000-0000-4000-8000-000000000102', 'Scenario: A company is struggling to attract talent. The VP of Talent wants to track the effectiveness of the company''s Employer Value Proposition (EVP). Which metric is the most direct indicator of EVP health?', 25, 1, true),
  ('30000000-0000-4000-8000-000000000226', '20000000-0000-4000-8000-000000000102', 'Scenario: A medium-sized enterprise wants to overhaul its compensation structure to ensure internal equity. Which job evaluation methodology provides the most objective, quantitative system for ranking roles based on compensable factors?', 26, 1, true),
  ('30000000-0000-4000-8000-000000000227', '20000000-0000-4000-8000-000000000102', 'Scenario: HR wants to establish a competitive pay policy that attracts high-caliber talent but remains financially sustainable. What strategy should HR recommend to the board regarding market-pricing benchmarks?', 27, 1, true),
  ('30000000-0000-4000-8000-000000000228', '20000000-0000-4000-8000-000000000102', 'Scenario: An HR Generalist is auditing employee classifications under fair labor standards. They discover several executive assistants are classified as "exempt" from overtime pay, even though their primary duties are administrative support, scheduling, and data entry. What is the risk, and what is the correction?', 28, 1, true),
  ('30000000-0000-4000-8000-000000000229', '20000000-0000-4000-8000-000000000102', 'Scenario: To manage rising medical insurance premium costs, a company wants to transition to a consumer-directed health plan (CDHP). What typical benefits configuration should HR communicate to employees?', 29, 1, true),
  ('30000000-0000-4000-8000-000000000230', '20000000-0000-4000-8000-000000000102', 'Scenario: HR is designing a rewards framework for a remote sales team. Focus groups reveal that reps value professional development as much as cash bonuses. What rewards model should HR adopt?', 30, 1, true),
  ('30000000-0000-4000-8000-000000000231', '20000000-0000-4000-8000-000000000102', 'Scenario: An employee discovers that a newly hired colleague with less tenure in an identical role is earning 15% more base salary. The employee files a complaint alleging pay discrimination. How should HR handle this pay disparity?', 31, 1, true),
  ('30000000-0000-4000-8000-000000000232', '20000000-0000-4000-8000-000000000102', 'Scenario: A global firm needs to temporarily relocate a senior project manager from headquarters to a foreign subsidiary for 12 months. Which compensation approach is standard for maintaining the manager''s purchasing power and covering relocation costs?', 32, 1, true),
  ('30000000-0000-4000-8000-000000000233', '20000000-0000-4000-8000-000000000102', 'Scenario: An HR Generalist is designing a 360-degree feedback program for mid-level managers. What is the primary best-practice application of 360-degree feedback data?', 33, 1, true),
  ('30000000-0000-4000-8000-000000000234', '20000000-0000-4000-8000-000000000102', 'Scenario: Following annual reviews, the HR Director notices that 90% of employees in the administrative department were rated "exceeds expectations," while the engineering department has a balanced bell-curve of ratings. What intervention should HR implement?', 34, 1, true),
  ('30000000-0000-4000-8000-000000000235', '20000000-0000-4000-8000-000000000102', 'Scenario: To improve rating clarity, HR wants to replace the standard 1-to-5 graphic rating scale with a Behaviorally Anchored Rating Scale (BARS). What is the primary benefit of BARS?', 35, 1, true),
  ('30000000-0000-4000-8000-000000000236', '20000000-0000-4000-8000-000000000102', 'Scenario: A historically high-performing administrative assistant has recently made several data-entry errors and missed core deadlines. The supervisor wants to place them on a PIP immediately. What should HR recommend first?', 36, 1, true),
  ('30000000-0000-4000-8000-000000000237', '20000000-0000-4000-8000-000000000102', 'Scenario: A company CEO wants to introduce a "forced distribution" performance appraisal model where the bottom 10% of employees are automatically terminated every year. What should HR warn the CEO about regarding this system?', 37, 1, true),
  ('30000000-0000-4000-8000-000000000238', '20000000-0000-4000-8000-000000000102', 'Scenario: Frontline employees complain that their annual performance appraisal is stressful because they only receive feedback once a year and are surprised by negative supervisor comments. What structural reform should HR implement?', 38, 1, true),
  ('30000000-0000-4000-8000-000000000239', '20000000-0000-4000-8000-000000000102', 'Scenario: What is the fundamental difference between "Coaching" and "Mentoring" in talent development?', 39, 1, true),
  ('30000000-0000-4000-8000-000000000240', '20000000-0000-4000-8000-000000000102', 'Scenario: To ensure individual goals directly support the company’s strategic business objectives, which goal-setting methodology should HR implement?', 40, 1, true),
  ('30000000-0000-4000-8000-000000000241', '20000000-0000-4000-8000-000000000102', 'Scenario: A manufacturing division wants to purchase a $50,000 training program for forklift operators. The L&D Specialist wants to ensure the program will address the actual root cause of warehouse delays. What should be the first step under the ADDIE framework?', 41, 1, true),
  ('30000000-0000-4000-8000-000000000242', '20000000-0000-4000-8000-000000000102', 'Scenario: A company wants to design a training program for its senior managers. According to Knowles’ Theory of Andragogy (Adult Learning), which design principle will maximize manager engagement?', 42, 1, true),
  ('30000000-0000-4000-8000-000000000243', '20000000-0000-4000-8000-000000000102', 'Scenario: The CFO demands that HR evaluate the effectiveness of a newly implemented leadership development program. To measure behavioral transfer (the degree to which participants apply training back on the job), which Kirkpatrick level must HR target?', 43, 1, true),
  ('30000000-0000-4000-8000-000000000244', '20000000-0000-4000-8000-000000000102', 'Scenario: A multinational retail chain wants to train 10,000 retail clerks on new POS terminal safety features in 2 weeks. The clerks have limited time during their shifts. What L&D modality should HR select?', 44, 1, true),
  ('30000000-0000-4000-8000-000000000245', '20000000-0000-4000-8000-000000000102', 'Scenario: To accelerate the technical development of junior financial analysts, HR wants to implement a mentorship program. Which structure will yield the highest success rate?', 45, 1, true),
  ('30000000-0000-4000-8000-000000000246', '20000000-0000-4000-8000-000000000102', 'Scenario: An employee requests 6 weeks of leave to care for a family member with a serious health condition. What is the standard HR generalist compliance priority regarding job-protected leave?', 46, 1, true),
  ('30000000-0000-4000-8000-000000000247', '20000000-0000-4000-8000-000000000102', 'Scenario: A warehouse operator reports a physical safety hazard regarding broken safety guards on a conveyor belt. The warehouse manager tells the operator to ignore it and continue working. How must the HR Generalist intervene?', 47, 1, true),
  ('30000000-0000-4000-8000-000000000248', '20000000-0000-4000-8000-000000000102', 'Scenario: A company operates a unionized manufacturing facility. Management wants to make a unilateral change to the employee health benefit plans. What is HR''s counsel to the site director?', 48, 1, true),
  ('30000000-0000-4000-8000-000000000249', '20000000-0000-4000-8000-000000000102', 'Scenario: HR wants to evaluate the stability of its workforce. During the year, the company had 50 separations and maintained an average headcount of 500 employees. What is the annual turnover rate?', 49, 1, true),
  ('30000000-0000-4000-8000-000000000250', '20000000-0000-4000-8000-000000000102', 'Scenario: A manager consistently speaks in a loud, aggressive tone during project review meetings and critiques employee work in front of colleagues. An employee files a complaint alleging workplace harassment and bullying. How should HR analyze this?', 50, 1, true)
on conflict (id) do update
set examination_id = excluded.examination_id,
    question_text = excluded.question_text,
    position = excluded.position,
    points = excluded.points,
    is_active = true,
    updated_at = now();

-- 4. Insert Question Options (200 options)
insert into public.question_options (id, question_id, option_text, position)
values
  -- Q1
  ('40000000-0000-4000-8000-000000000201', '30000000-0000-4000-8000-000000000201', 'Advise the employee to submit a transfer request first, then talk to the manager.', 1),
  ('40000000-0000-4000-8000-000000000202', '30000000-0000-4000-8000-000000000201', 'Reassure the employee of anti-retaliation policies, document the grievance, and initiate a prompt, objective investigation.', 2),
  ('40000000-0000-4000-8000-000000000203', '30000000-0000-4000-8000-000000000201', 'Confront the manager immediately in an informal meeting and demand that they apologize to the employee.', 3),
  ('40000000-0000-4000-8000-000000000204', '30000000-0000-4000-8000-000000000201', 'Advise the employee to resolve the issue directly with the manager to preserve the working relationship.', 4),
  -- Q2
  ('40000000-0000-4000-8000-000000000205', '30000000-0000-4000-8000-000000000202', 'Forcing: Instruct the project manager to select one designer''s styling rules and mandate compliance.', 1),
  ('40000000-0000-4000-8000-000000000206', '30000000-0000-4000-8000-000000000202', 'Avoiding: Reassign one of the senior designers to a completely different engineering unit.', 2),
  ('40000000-0000-4000-8000-000000000207', '30000000-0000-4000-8000-000000000202', 'Collaborating: Guide both designers in a structured brainstorming session to integrate their ideas and align on shared criteria.', 3),
  ('40000000-0000-4000-8000-000000000208', '30000000-0000-4000-8000-000000000202', 'Accommodating: Ask one designer to give in to the other''s ideas to maintain harmony.', 4),
  -- Q3
  ('40000000-0000-4000-8000-000000000209', '30000000-0000-4000-8000-000000000203', 'Approve the suspension because attendance is a basic requirement, regardless of past performance.', 1),
  ('40000000-0000-4000-8000-000000000210', '30000000-0000-4000-8000-000000000203', 'Advise the supervisor to verify that previous progressive steps (verbal and written warnings) were documented and issued before proceeding to suspension.', 2),
  ('40000000-0000-4000-8000-000000000211', '30000000-0000-4000-8000-000000000203', 'Instruct the supervisor to overlook the lateness since the agent has high customer feedback scores.', 3),
  ('40000000-0000-4000-8000-000000000212', '30000000-0000-4000-8000-000000000203', 'Terminate the employee immediately to set an example for other team members.', 4),
  -- Q4
  ('40000000-0000-4000-8000-000000000213', '30000000-0000-4000-8000-000000000204', 'The analyst was not resilient enough to handle a fast-paced work environment.', 1),
  ('40000000-0000-4000-8000-000000000214', '30000000-0000-4000-8000-000000000204', 'A localized leadership issue that requires a targeted stay-interview and manager development intervention.', 2),
  ('40000000-0000-4000-8000-000000000215', '30000000-0000-4000-8000-000000000204', 'The company''s base salary range is non-competitive in the regional market.', 3),
  ('40000000-0000-4000-8000-000000000216', '30000000-0000-4000-8000-000000000204', 'An isolated incident that does not require any follow-up or system diagnostics.', 4),
  -- Q5
  ('40000000-0000-4000-8000-000000000217', '30000000-0000-4000-8000-000000000205', 'Implement an automated newsletter from the CEO to increase the flow of high-level company communications.', 1),
  ('40000000-0000-4000-8000-000000000218', '30000000-0000-4000-8000-000000000205', 'Establish cross-functional feedback forums and action planning committees to involve employees directly in problem-solving.', 2),
  ('40000000-0000-4000-8000-000000000219', '30000000-0000-4000-8000-000000000205', 'Increase the employee referral bonus to offset the turnover rates quickly.', 3),
  ('40000000-0000-4000-8000-000000000220', '30000000-0000-4000-8000-000000000205', 'Restrict the distribution of future surveys to avoid highlighting negative areas.', 4),
  -- Q6
  ('40000000-0000-4000-8000-000000000221', '30000000-0000-4000-8000-000000000206', 'Breach of employment loyalty', 1),
  ('40000000-0000-4000-8000-000000000222', '30000000-0000-4000-8000-000000000206', 'Constructive Dismissal (treated as involuntary termination under labor laws)', 2),
  ('40000000-0000-4000-8000-000000000223', '30000000-0000-4000-8000-000000000206', 'Voluntary Resignation with cause', 3),
  ('40000000-0000-4000-8000-000000000224', '30000000-0000-4000-8000-000000000206', 'No legal risk since the employee signed a standard voluntary resignation letter', 4),
  -- Q7
  ('40000000-0000-4000-8000-000000000225', '30000000-0000-4000-8000-000000000207', 'Draft non-compete agreements to prevent the developers from leaving for other tech firms.', 1),
  ('40000000-0000-4000-8000-000000000226', '30000000-0000-4000-8000-000000000207', 'Review and design a localized hybrid/remote work framework and benchmark the total rewards against remote markets.', 2),
  ('40000000-0000-4000-8000-000000000227', '30000000-0000-4000-8000-000000000207', 'Offer immediate salary increases to the entire development team without modifying work policies.', 3),
  ('40000000-0000-4000-8000-000000000228', '30000000-0000-4000-8000-000000000207', 'Ignore the feedback, assuming that corporate loyalty will naturally prevent developer attrition.', 4),
  -- Q8
  ('40000000-0000-4000-8000-000000000229', '30000000-0000-4000-8000-000000000208', 'Keep the restructuring completely confidential until the day of execution to avoid panic.', 1),
  ('40000000-0000-4000-8000-000000000230', '30000000-0000-4000-8000-000000000208', 'Communicate the business rationale early and transparently, hold town hall meetings to answer questions, and detail support pathways.', 2),
  ('40000000-0000-4000-8000-000000000231', '30000000-0000-4000-8000-000000000208', 'Issue standard electronic policy manuals explaining the operational changes and mandate signatures.', 3),
  ('40000000-0000-4000-8000-000000000232', '30000000-0000-4000-8000-000000000208', 'Instruct middle managers to handle communications on an individual, ad-hoc basis without central coordination.', 4),
  -- Q9
  ('40000000-0000-4000-8000-000000000233', '30000000-0000-4000-8000-000000000209', 'Agree to defer the investigation, but advise the sales head to speak to the executive informally.', 1),
  ('40000000-0000-4000-8000-000000000234', '30000000-0000-4000-8000-000000000209', 'Insist on conducting a complete, unbiased investigation, highlighting that ignoring misconduct violates policy and exposes the company to severe legal and cultural risks.', 2),
  ('40000000-0000-4000-8000-000000000235', '30000000-0000-4000-8000-000000000209', 'Instruct the junior sales coordinators to adapt to the executive''s high-pressure style.', 3),
  ('40000000-0000-4000-8000-000000000236', '30000000-0000-4000-8000-000000000209', 'Reassign the junior coordinators to other sales reps to resolve the conflict without checking the claims.', 4),
  -- Q10
  ('40000000-0000-4000-8000-000000000237', '30000000-0000-4000-8000-000000000210', 'Allow the attorney to attend to show that the company has nothing to hide.', 1),
  ('40000000-0000-4000-8000-000000000238', '30000000-0000-4000-8000-000000000210', 'Explain that internal performance reviews are private business matters, deny the request, and offer a supportive internal colleague or HR presence instead.', 2),
  ('40000000-0000-4000-8000-000000000239', '30000000-0000-4000-8000-000000000210', 'Cancel the meeting entirely and escalate the performance concern to a formal disciplinary board.', 3),
  ('40000000-0000-4000-8000-000000000240', '30000000-0000-4000-8000-000000000210', 'Immediately terminate the employee for attempting to involve external legal entities.', 4),
  -- Q11
  ('40000000-0000-4000-8000-000000000241', '30000000-0000-4000-8000-000000000211', 'Post openings on national professional networks, requiring a detailed cover letter, executive references, and a multi-stage essay test.', 1),
  ('40000000-0000-4000-8000-000000000242', '30000000-0000-4000-8000-000000000211', 'Deploy mobile-responsive micro-applications, hold local walk-in recruitment days, and conduct immediate background and driving record screening.', 2),
  ('40000000-0000-4000-8000-000000000243', '30000000-0000-4000-8000-000000000211', 'Rely exclusively on executive search boutique headhunters to source individual drivers from competitor pools.', 3),
  ('40000000-0000-4000-8000-000000000244', '30000000-0000-4000-8000-000000000211', 'Post on general forums and hire the first 100 applicants without background checks, handling quality issues during onboarding.', 4),
  -- Q12
  ('40000000-0000-4000-8000-000000000245', '30000000-0000-4000-8000-000000000212', 'Structured behavioral interviews where candidates are asked specific, job-related situational questions scored against a standardized rubric.', 1),
  ('40000000-0000-4000-8000-000000000246', '30000000-0000-4000-8000-000000000212', 'Unstructured conversational interviews that allow managers to assess cultural fit and chemistry naturally.', 2),
  ('40000000-0000-4000-8000-000000000247', '30000000-0000-4000-8000-000000000212', 'A series of unstructured meetings with different executives, followed by an informal group vote.', 3),
  ('40000000-0000-4000-8000-000000000248', '30000000-0000-4000-8000-000000000212', 'A review of the candidate''s social media profiles and academic institution prestige.', 4),
  -- Q13
  ('40000000-0000-4000-8000-000000000249', '30000000-0000-4000-8000-000000000213', '"Cultural fit" focuses on selecting candidates who share identical hobbies, interests, and background; "cultural add" actively seeks diverse perspectives and experiences that enrich the existing team.', 1),
  ('40000000-0000-4000-8000-000000000250', '30000000-0000-4000-8000-000000000213', '"Cultural fit" is a legal requirement; "cultural add" is a voluntary diversity campaign.', 2),
  ('40000000-0000-4000-8000-000000000251', '30000000-0000-4000-8000-000000000213', '"Cultural fit" is used for entry-level positions; "cultural add" is reserved strictly for C-suite executive recruitment.', 3),
  ('40000000-0000-4000-8000-000000000252', '30000000-0000-4000-8000-000000000213', 'There is no functional difference; they are synonymous HR marketing buzzwords.', 4),
  -- Q14
  ('40000000-0000-4000-8000-000000000253', '30000000-0000-4000-8000-000000000214', 'Contrast effect', 1),
  ('40000000-0000-4000-8000-000000000254', '30000000-0000-4000-8000-000000000214', 'Halo effect and affinity bias', 2),
  ('40000000-0000-4000-8000-000000000255', '30000000-0000-4000-8000-000000000214', 'Leniency bias', 3),
  ('40000000-0000-4000-8000-000000000256', '30000000-0000-4000-8000-000000000214', 'Stereotyping', 4),
  -- Q15
  ('40000000-0000-4000-8000-000000000257', '30000000-0000-4000-8000-000000000215', 'Increase the budget for corporate recruiting advertisements on social channels.', 1),
  ('40000000-0000-4000-8000-000000000258', '30000000-0000-4000-8000-000000000215', 'Analyze exit and feedback data from candidate rejections, and benchmark salary, benefits, and remote flexibility against local competitor offerings.', 2),
  ('40000000-0000-4000-8000-000000000259', '30000000-0000-4000-8000-000000000215', 'Increase base salaries across the board without investigating candidate sentiments.', 3),
  ('40000000-0000-4000-8000-000000000260', '30000000-0000-4000-8000-000000000215', 'Mandate that the talent acquisition team double the volume of weekly candidates sourced.', 4),
  -- Q16
  ('40000000-0000-4000-8000-000000000261', '30000000-0000-4000-8000-000000000216', 'Assume the previous employer''s silence implies a negative record and reject the candidate immediately.', 1),
  ('40000000-0000-4000-8000-000000000262', '30000000-0000-4000-8000-000000000216', 'Understand that many companies have strict "dates-only" reference policies to avoid liability, and utilize neutral verification methods combined with secondary professional references.', 2),
  ('40000000-0000-4000-8000-000000000263', '30000000-0000-4000-8000-000000000216', 'Demand that the candidate obtain a written performance waiver from the previous employer''s CEO.', 3),
  ('40000000-0000-4000-8000-000000000264', '30000000-0000-4000-8000-000000000216', 'Overlook the dates and rely fully on the relative''s reference letter to close the hiring file.', 4),
  -- Q17
  ('40000000-0000-4000-8000-000000000265', '30000000-0000-4000-8000-000000000217', 'The tests must be highly difficult so that only the top 5% of candidates can pass.', 1),
  ('40000000-0000-4000-8000-000000000266', '30000000-0000-4000-8000-000000000217', 'The tests must have proven job-related validity and reliability, and must not create an adverse impact on protected groups.', 2),
  ('40000000-0000-4000-8000-000000000267', '30000000-0000-4000-8000-000000000217', 'The tests must be administered off-site during evening hours to test candidate commitment.', 3),
  ('40000000-0000-4000-8000-000000000268', '30000000-0000-4000-8000-000000000217', 'The tests must be purchased from an approved general educational vendor, regardless of the target job duties.', 4),
  -- Q18
  ('40000000-0000-4000-8000-000000000269', '30000000-0000-4000-8000-000000000218', 'Increase the initial base salary for all new engineering hires.', 1),
  ('40000000-0000-4000-8000-000000000270', '30000000-0000-4000-8000-000000000218', 'Implement a Realistic Job Preview (RJP) during the selection process to provide candidates with an honest view of daily duties and challenges.', 2),
  ('40000000-0000-4000-8000-000000000271', '30000000-0000-4000-8000-000000000218', 'Require engineers to sign a 12-month retention commitment contract upon hiring.', 3),
  ('40000000-0000-4000-8000-000000000272', '30000000-0000-4000-8000-000000000218', 'Redesign the corporate career website to make the job roles look more attractive.', 4),
  -- Q19
  ('40000000-0000-4000-8000-000000000273', '30000000-0000-4000-8000-000000000219', 'A single-day classroom lecture covering corporate history, payroll setup, and handbook signing.', 1),
  ('40000000-0000-4000-8000-000000000274', '30000000-0000-4000-8000-000000000219', 'A structured, multi-month program featuring 30-60-90 day milestone reviews, executive context briefings, peer buddies, and continuous manager feedback.', 2),
  ('40000000-0000-4000-8000-000000000275', '30000000-0000-4000-8000-000000000219', 'An online self-service folder containing PDF policy documents that the employee reviews independently.', 3),
  ('40000000-0000-4000-8000-000000000276', '30000000-0000-4000-8000-000000000219', 'An informal process where the employee shadows a senior colleague on their first afternoon.', 4),
  -- Q20
  ('40000000-0000-4000-8000-000000000277', '30000000-0000-4000-8000-000000000220', 'Deny the request because it creates an administrative inconvenience and sets a precedent for other employees.', 1),
  ('40000000-0000-4000-8000-000000000278', '30000000-0000-4000-8000-000000000220', 'Engage in an interactive process with the employee to understand their functional limitations, review medical recommendations, and provide reasonable accommodations.', 2),
  ('40000000-0000-4000-8000-000000000279', '30000000-0000-4000-8000-000000000220', 'Advise the employee that they must purchase their own ergonomic equipment if they wish to use it at the office.', 3),
  ('40000000-0000-4000-8000-000000000280', '30000000-0000-4000-8000-000000000220', 'Reassign the employee to a lower-stress, non-technical role to avoid having to implement accommodations.', 4),
  -- Q21
  ('40000000-0000-4000-8000-000000000281', '30000000-0000-4000-8000-000000000221', 'Distribute fruit baskets and organize optional wellness lectures on weekends.', 1),
  ('40000000-0000-4000-8000-000000000282', '30000000-0000-4000-8000-000000000221', 'Conduct a structural work-load analysis, optimize shift schedules to allow adequate rest, and train managers to support mental health boundaries.', 2),
  ('40000000-0000-4000-8000-000000000283', '30000000-0000-4000-8000-000000000221', 'Introduce a meditation room in the office while keeping the 60-hour mandatory workweek unchanged.', 3),
  ('40000000-0000-4000-8000-000000000284', '30000000-0000-4000-8000-000000000221', 'Encourage employees to utilize their personal time off more effectively without adjusting daily performance quotas.', 4),
  -- Q22
  ('40000000-0000-4000-8000-000000000285', '30000000-0000-4000-8000-000000000222', 'Advise the managers that Gen Z workers are too difficult to manage and recommend prioritizing older hires.', 1),
  ('40000000-0000-4000-8000-000000000286', '30000000-0000-4000-8000-000000000222', 'Organize cross-generational collaboration workshops to build mutual understanding of work styles, and clarify objective output metrics.', 2),
  ('40000000-0000-4000-8000-000000000287', '30000000-0000-4000-8000-000000000222', 'Mandate that all younger workers return to 100% in-office work while allowing older employees to remain hybrid.', 3),
  ('40000000-0000-4000-8000-000000000288', '30000000-0000-4000-8000-000000000222', 'Redesign the corporate communication handbook to prohibit modern text messaging and messaging apps.', 4),
  -- Q23
  ('40000000-0000-4000-8000-000000000289', '30000000-0000-4000-8000-000000000223', 'Job Rotation: Move them to different low-skill entry roles across various physical offices.', 1),
  ('40000000-0000-4000-8000-000000000290', '30000000-0000-4000-8000-000000000223', 'Job Enrichment: Delegate higher-level responsibilities such as handling escalated client accounts, designing training modules, and leading process improvement initiatives.', 2),
  ('40000000-0000-4000-8000-000000000291', '30000000-0000-4000-8000-000000000223', 'Job Simplification: Reduce their tasks to standard, repetitive processes to minimize stress.', 3),
  ('40000000-0000-4000-8000-000000000292', '30000000-0000-4000-8000-000000000223', 'Job Enlargement: Increase the number of low-skill support calls they are required to answer daily.', 4),
  -- Q24
  ('40000000-0000-4000-8000-000000000293', '30000000-0000-4000-8000-000000000224', 'Working 40 hours over 6 days in a flexible shift rotation.', 1),
  ('40000000-0000-4000-8000-000000000294', '30000000-0000-4000-8000-000000000224', 'Working four 10-hour days per week (4/10 schedule), providing employees with a 3-day weekend.', 2),
  ('40000000-0000-4000-8000-000000000295', '30000000-0000-4000-8000-000000000224', 'Allowing employees to log in and work whenever they choose, provided they meet weekly tasks.', 3),
  ('40000000-0000-4000-8000-000000000296', '30000000-0000-4000-8000-000000000224', 'Working 5 hours per day, 5 days per week, with a proportional salary reduction.', 4),
  -- Q25
  ('40000000-0000-4000-8000-000000000297', '30000000-0000-4000-8000-000000000225', 'The average time-to-hire for administrative positions.', 1),
  ('40000000-0000-4000-8000-000000000298', '30000000-0000-4000-8000-000000000225', 'The ratio of job-offer acceptances relative to the total number of offers extended to top candidates.', 2),
  ('40000000-0000-4000-8000-000000000299', '30000000-0000-4000-8000-000000000225', 'The total number of followers on the company''s official LinkedIn page.', 3),
  ('40000000-0000-4000-8000-000000000300', '30000000-0000-4000-8000-000000000225', 'The percentage of employees who completed their annual compliance training.', 4),
  -- Q26
  ('40000000-0000-4000-8000-000000000301', '30000000-0000-4000-8000-000000000226', 'Classification Method', 1),
  ('40000000-0000-4000-8000-000000000302', '30000000-0000-4000-8000-000000000226', 'Point Factor Method', 2),
  ('40000000-0000-4000-8000-000000000303', '30000000-0000-4000-8000-000000000226', 'Job Ranking Method', 3),
  ('40000000-0000-4000-8000-000000000304', '30000000-0000-4000-8000-000000000226', 'Market Pricing Method', 4),
  -- Q27
  ('40000000-0000-4000-8000-000000000305', '30000000-0000-4000-8000-000000000227', 'Target base salaries at the 95th percentile of the market, regardless of incentive options.', 1),
  ('40000000-0000-4000-8000-000000000306', '30000000-0000-4000-8000-000000000227', 'Benchmark base salaries at the 50th percentile (market median), but design a high-value performance-based variable pay and comprehensive benefits package.', 2),
  ('40000000-0000-4000-8000-000000000307', '30000000-0000-4000-8000-000000000227', 'Set base salaries at the 25th percentile to minimize fixed costs and rely fully on discretionary bonuses.', 3),
  ('40000000-0000-4000-8000-000000000308', '30000000-0000-4000-8000-000000000227', 'Copy the compensation structures of international companies, irrespective of local cost-of-living data.', 4),
  -- Q28
  ('40000000-0000-4000-8000-000000000309', '30000000-0000-4000-8000-000000000228', 'There is no risk since they have "assistant" in their title; maintain current exempt classification.', 1),
  ('40000000-0000-4000-8000-000000000310', '30000000-0000-4000-8000-000000000228', 'High risk of wage-and-hour violations; reclassify them as "non-exempt" based on the duties test, track their hours, and pay appropriate overtime.', 2),
  ('40000000-0000-4000-8000-000000000311', '30000000-0000-4000-8000-000000000228', 'Ask the assistants to sign a voluntary waiver agreeing to waive their rights to overtime pay.', 3),
  ('40000000-0000-4000-8000-000000000312', '30000000-0000-4000-8000-000000000228', 'Change their job titles to "Executive Director of Calendars" to justify the exempt classification.', 4),
  -- Q29
  ('40000000-0000-4000-8000-000000000313', '30000000-0000-4000-8000-000000000229', 'An insurance plan with zero deductibles but high monthly premiums, coupled with restricted clinic selections.', 1),
  ('40000000-0000-4000-8000-000000000314', '30000000-0000-4000-8000-000000000229', 'A High-Deductible Health Plan (HDHP) combined with a tax-advantaged Health Savings Account (HSA) that receives employer contributions.', 2),
  ('40000000-0000-4000-8000-000000000315', '30000000-0000-4000-8000-000000000229', 'A plan that covers dental and vision care only, leaving general medical expenses to be paid out-of-pocket.', 3),
  ('40000000-0000-4000-8000-000000000316', '30000000-0000-4000-8000-000000000229', 'An plan that requires employees to obtain pre-approval from HR for all medical visits.', 4),
  -- Q30
  ('40000000-0000-4000-8000-000000000317', '30000000-0000-4000-8000-000000000230', 'A traditional commissions-only model that focuses strictly on cash incentives.', 1),
  ('40000000-0000-4000-8000-000000000318', '30000000-0000-4000-8000-000000000230', 'A Total Rewards framework that integrates competitive base pay, sales commissions, paid certifications, and career mentoring.', 2),
  ('40000000-0000-4000-8000-000000000319', '30000000-0000-4000-8000-000000000230', 'A non-cash model that replaces all sales bonuses with company recognition certificates.', 3),
  ('40000000-0000-4000-8000-000000000320', '30000000-0000-4000-8000-000000000230', 'A plan where stipends are deducted from commissions to fund mandatory training sessions.', 4),
  -- Q31
  ('40000000-0000-4000-8000-000000000321', '30000000-0000-4000-8000-000000000231', 'Advise the employee that salary discussions are prohibited and threaten disciplinary action.', 1),
  ('40000000-0000-4000-8000-000000000322', '30000000-0000-4000-8000-000000000231', 'Conduct a pay equity review, identify objective factors (e.g., certifications, specialized experience, market fluctuations at hire), and adjust pay if unjustified disparities are found.', 2),
  ('40000000-0000-4000-8000-000000000323', '30000000-0000-4000-8000-000000000231', 'Explain that new hires always make more due to market inflation, and advise them to wait for the annual review.', 3),
  ('40000000-0000-4000-8000-000000000324', '30000000-0000-4000-8000-000000000231', 'Immediately lower the new hire''s salary to match the existing employee''s rate.', 4),
  -- Q32
  ('40000000-0000-4000-8000-000000000325', '30000000-0000-4000-8000-000000000232', 'Local Market Approach: Pay the manager the local going rate of the host country, regardless of home country standards.', 1),
  ('40000000-0000-4000-8000-000000000326', '30000000-0000-4000-8000-000000000232', 'Balance Sheet Approach: Keep the manager on the home-country salary scale, while providing cost-of-living adjustments, housing allowances, and tax equalization.', 2),
  ('40000000-0000-4000-8000-000000000327', '30000000-0000-4000-8000-000000000232', 'Lump-Sum Approach: Give the manager a flat cash allowance and require them to handle all salary, tax, and relocation logistics independently.', 3),
  ('40000000-0000-4000-8000-000000000328', '30000000-0000-4000-8000-000000000232', 'Negotiation Approach: Agree on a custom, ad-hoc salary rate through individual bargaining without structured policies.', 4),
  -- Q33
  ('40000000-0000-4000-8000-000000000329', '30000000-0000-4000-8000-000000000233', 'To serve as the direct, sole mathematical basis for calculating annual salary increases and promotion decisions.', 1),
  ('40000000-0000-4000-8000-000000000330', '30000000-0000-4000-8000-000000000233', 'To provide broad developmental feedback on leadership behaviors, communication style, and collaboration, separate from pay evaluations.', 2),
  ('40000000-0000-4000-8000-000000000331', '30000000-0000-4000-8000-000000000233', 'To identify and document low-performing managers for immediate placement on Performance Improvement Plans.', 3),
  ('40000000-0000-4000-8000-000000000332', '30000000-0000-4000-8000-000000000233', 'To allow team members to anonymously grade their supervisors for disciplinary reviews.', 4),
  -- Q34
  ('40000000-0000-4000-8000-000000000333', '30000000-0000-4000-8000-000000000234', 'Order the engineering department to raise their ratings to match the administrative department.', 1),
  ('40000000-0000-4000-8000-000000000334', '30000000-0000-4000-8000-000000000234', 'Introduce structured performance calibration sessions where managers discuss and justify their ratings based on objective evidence.', 2),
  ('40000000-0000-4000-8000-000000000335', '30000000-0000-4000-8000-000000000234', 'Enforce a rigid forced-ranking system where 15% of all employees must be rated as low performers.', 3),
  ('40000000-0000-4000-8000-000000000336', '30000000-0000-4000-8000-000000000234', 'Instruct the payroll department to cap bonuses regardless of performance ratings.', 4),
  -- Q35
  ('40000000-0000-4000-8000-000000000337', '30000000-0000-4000-8000-000000000235', 'It is faster to design and requires zero supervisor training.', 1),
  ('40000000-0000-4000-8000-000000000338', '30000000-0000-4000-8000-000000000235', 'It anchors rating levels to specific, observable behavioral examples, reducing supervisor subjectivity and bias.', 2),
  ('40000000-0000-4000-8000-000000000339', '30000000-0000-4000-8000-000000000235', 'It automatically calculates employee bonuses based on mathematical algorithms.', 3),
  ('40000000-0000-4000-8000-000000000340', '30000000-0000-4000-8000-000000000235', 'It allows employees to rate themselves without supervisor intervention.', 4),
  -- Q36
  ('40000000-0000-4000-8000-000000000341', '30000000-0000-4000-8000-000000000236', 'Approve the PIP immediately to start the termination documentation process.', 1),
  ('40000000-0000-4000-8000-000000000342', '30000000-0000-4000-8000-000000000236', 'Advise the supervisor to hold an informal, supportive meeting with the assistant to discuss the sudden performance drop, identify root causes, and offer guidance.', 2),
  ('40000000-0000-4000-8000-000000000343', '30000000-0000-4000-8000-000000000236', 'Reassign the assistant to a non-administrative role to bypass performance issues.', 3),
  ('40000000-0000-4000-8000-000000000344', '30000000-0000-4000-8000-000000000236', 'Issue an immediate formal written warning and log it in the employee''s permanent file.', 4),
  -- Q37
  ('40000000-0000-4000-8000-000000000345', '30000000-0000-4000-8000-000000000237', 'It increases operational costs by requiring too many physical evaluation sheets.', 1),
  ('40000000-0000-4000-8000-000000000346', '30000000-0000-4000-8000-000000000237', 'It destroys teamwork, encourages internal competition, increases voluntary turnover of high-performers, and exposes the firm to legal risks.', 2),
  ('40000000-0000-4000-8000-000000000347', '30000000-0000-4000-8000-000000000237', 'It is highly favored by labor unions and will lead to excessive collective bargaining demands.', 3),
  ('40000000-0000-4000-8000-000000000348', '30000000-0000-4000-8000-000000000237', 'It has no impact on culture and is the industry standard for all major technology companies.', 4),
  -- Q38
  ('40000000-0000-4000-8000-000000000349', '30000000-0000-4000-8000-000000000238', 'Abolish all performance evaluations and allocate salary increases strictly based on tenure.', 1),
  ('40000000-0000-4000-8000-000000000350', '30000000-0000-4000-8000-000000000238', 'Transition from annual appraisals to a continuous feedback model with structured monthly or bi-weekly check-ins and shared OKRs.', 2),
  ('40000000-0000-4000-8000-000000000351', '30000000-0000-4000-8000-000000000238', 'Mandate that supervisors send performance check-in emails every Monday morning.', 3),
  ('40000000-0000-4000-8000-000000000352', '30000000-0000-4000-8000-000000000238', 'Create an online portal where employees can view their manager''s notes in real-time without scheduling meetings.', 4),
  -- Q39
  ('40000000-0000-4000-8000-000000000353', '30000000-0000-4000-8000-000000000239', 'Coaching is long-term and informal; Mentoring is short-term and focused strictly on technical skills.', 1),
  ('40000000-0000-4000-8000-000000000354', '30000000-0000-4000-8000-000000000239', 'Coaching is typically short-term, structured, and focused on specific task performance; Mentoring is long-term, development-oriented, and focused on career pathing.', 2),
  ('40000000-0000-4000-8000-000000000355', '30000000-0000-4000-8000-000000000239', 'Coaching is handled by external consultants; Mentoring is handled exclusively by HR staff.', 3),
  ('40000000-0000-4000-8000-000000000356', '30000000-0000-4000-8000-000000000239', 'There is no difference; they are synonymous terms in executive development.', 4),
  -- Q40
  ('40000000-0000-4000-8000-000000000357', '30000000-0000-4000-8000-000000000240', 'Isolated Departmental Goals: Allow each manager to set team tasks independently of other divisions.', 1),
  ('40000000-0000-4000-8000-000000000358', '30000000-0000-4000-8000-000000000240', 'Cascading Goals: Align organizational strategic objectives to division KPIs, department targets, and individual performance goals.', 2),
  ('40000000-0000-4000-8000-000000000359', '30000000-0000-4000-8000-000000000240', 'Ad-hoc Goals: Encourage employees to set weekly personal tasks without corporate alignments.', 3),
  ('40000000-0000-4000-8000-000000000360', '30000000-0000-4000-8000-000000000240', 'Bottom-up Mandate: Aggregate individual personal goals and define the corporate strategy based on employee preferences.', 4),
  -- Q41
  ('40000000-0000-4000-8000-000000000361', '30000000-0000-4000-8000-000000000241', 'Review online catalogs and sign a contract with the highest-rated training vendor.', 1),
  ('40000000-0000-4000-8000-000000000362', '30000000-0000-4000-8000-000000000241', 'Conduct a thorough Training Needs Assessment (TNA) to analyze the performance gap, target audience skills, and operational challenges.', 2),
  ('40000000-0000-4000-8000-000000000363', '30000000-0000-4000-8000-000000000241', 'Design interactive slide decks and forklift training manuals for the operators.', 3),
  ('40000000-0000-4000-8000-000000000364', '30000000-0000-4000-8000-000000000241', 'Organize a pilot training session with the most experienced forklift operators.', 4),
  -- Q42
  ('40000000-0000-4000-8000-000000000365', '30000000-0000-4000-8000-000000000242', 'Structuring the course around abstract theories, rote-memorization, and grades.', 1),
  ('40000000-0000-4000-8000-000000000366', '30000000-0000-4000-8000-000000000242', 'Designing problem-centered, experiential modules where managers can apply their existing professional expertise to solve real scenarios.', 2),
  ('40000000-0000-4000-8000-000000000367', '30000000-0000-4000-8000-000000000242', 'Enforcing strict daily attendance quotas with formal reprimands for missing lectures.', 3),
  ('40000000-0000-4000-8000-000000000368', '30000000-0000-4000-8000-000000000242', 'Keeping the training content uniform and standardized, without allowing self-directed pacing.', 4),
  -- Q43
  ('40000000-0000-4000-8000-000000000369', '30000000-0000-4000-8000-000000000243', 'Level 1: Reaction (satisfaction surveys)', 1),
  ('40000000-0000-4000-8000-000000000370', '30000000-0000-4000-8000-000000000243', 'Level 2: Learning (post-training knowledge quizzes)', 2),
  ('40000000-0000-4000-8000-000000000371', '30000000-0000-4000-8000-000000000243', 'Level 3: Behavior (on-the-job behavioral audits and 360-degree feedback reviews)', 3),
  ('40000000-0000-4000-8000-000000000372', '30000000-0000-4000-8000-000000000243', 'Level 4: Results (business unit productivity metrics)', 4),
  -- Q44
  ('40000000-0000-4000-8000-000000000373', '30000000-0000-4000-8000-000000000244', 'Schedule live, full-day classroom lectures at regional hotels over the next three months.', 1),
  ('40000000-0000-4000-8000-000000000374', '30000000-0000-4000-8000-000000000244', 'Deploy bite-sized, mobile-optimized microlearning modules on the corporate LMS with interactive simulated checks.', 2),
  ('40000000-0000-4000-8000-000000000375', '30000000-0000-4000-8000-000000000244', 'Distribute printed technical manuals and require clerks to study them in their personal hours.', 3),
  ('40000000-0000-4000-8000-000000000376', '30000000-0000-4000-8000-000000000244', 'Deliver the training via a sequence of weekly corporate emails without assessments.', 4),
  -- Q45
  ('40000000-0000-4000-8000-000000000377', '30000000-0000-4000-8000-000000000245', 'Allow junior analysts and executives to self-select matches and meet informally without guidelines.', 1),
  ('40000000-0000-4000-8000-000000000378', '30000000-0000-4000-8000-000000000245', 'Establish a formal pairing system based on career mapping, define clear goals and meeting templates, and monitor progress.', 2),
  ('40000000-0000-4000-8000-000000000379', '30000000-0000-4000-8000-000000000245', 'Require senior partners to grade the weekly performance of their junior mentees for the HR files.', 3),
  ('40000000-0000-4000-8000-000000000380', '30000000-0000-4000-8000-000000000245', 'Limit the mentorship program to the highest-performing junior analyst each year.', 4),
  -- Q46
  ('40000000-0000-4000-8000-000000000381', '30000000-0000-4000-8000-000000000246', 'Deny the leave if the department is currently understaffed, and suggest they resign.', 1),
  ('40000000-0000-4000-8000-000000000382', '30000000-0000-4000-8000-000000000246', 'Review and administer the leave under family/medical leave laws (such as FMLA or national equivalents), maintaining their health benefits and guaranteeing their role or equivalent upon return.', 2),
  ('40000000-0000-4000-8000-000000000383', '30000000-0000-4000-8000-000000000246', 'Approve the leave but suspend their health insurance benefits during their absence.', 3),
  ('40000000-0000-4000-8000-000000000384', '30000000-0000-4000-8000-000000000246', 'Approve the leave only on the condition that the employee works part-time from home.', 4),
  -- Q47
  ('40000000-0000-4000-8000-000000000385', '30000000-0000-4000-8000-000000000247', 'Support the manager''s production goals and advise the operator to work carefully.', 1),
  ('40000000-0000-4000-8000-000000000386', '30000000-0000-4000-8000-000000000247', 'Ensure the belt is shut down immediately, report the hazard to the safety officer, and protect the operator from any retaliation.', 2),
  ('40000000-0000-4000-8000-000000000247', 'Advise the operator to file an external government lawsuit without notifying internal safety teams.', 3),
  ('40000000-0000-4000-8000-000000000388', '30000000-0000-4000-8000-000000000247', 'Instruct the operator to find a colleague willing to operate the belt instead.', 4),
  -- Q48
  ('40000000-0000-4000-8000-000000000389', '30000000-0000-4000-8000-000000000248', 'Management can change benefits unilaterally at any time under executive authority.', 1),
  ('40000000-0000-4000-8000-000000000390', '30000000-0000-4000-8000-000000000248', 'Benefits are mandatory subjects of collective bargaining; HR must consult union representatives and negotiate in good faith before making changes.', 2),
  ('40000000-0000-4000-8000-000000000391', '30000000-0000-4000-8000-000000000248', 'Advise the site director to announce the changes quietly to avoid union opposition.', 3),
  ('40000000-0000-4000-8000-000000000392', '30000000-0000-4000-8000-000000000248', 'Terminate the collective bargaining agreement to simplify benefits administration.', 4),
  -- Q49
  ('40000000-0000-4000-8000-000000000393', '30000000-0000-4000-8000-000000000249', '5%', 1),
  ('40000000-0000-4000-8000-000000000394', '30000000-0000-4000-8000-000000000249', '10%', 2),
  ('40000000-0000-4000-8000-000000000395', '30000000-0000-4000-8000-000000000249', '20%', 3),
  ('40000000-0000-4000-8000-000000000396', '30000000-0000-4000-8000-000000000249', '15%', 4),
  -- Q50
  ('40000000-0000-4000-8000-000000000397', '30000000-0000-4000-8000-000000000250', 'Dismiss the complaint immediately because critiquing work is part of a manager''s job.', 1),
  ('40000000-0000-4000-8000-000000000398', '30000000-0000-4000-8000-000000000250', 'Conduct a thorough review of the manager''s behavior against workplace conduct policies, interview witnesses, and guide the manager on professional coaching.', 2),
  ('40000000-0000-4000-8000-000000000399', '30000000-0000-4000-8000-000000000250', 'Inform the employee that they must adapt to different management styles or seek other roles.', 3),
  ('40000000-0000-4000-8000-000000000400', '30000000-0000-4000-8000-000000000250', 'Immediately suspend the manager without checking the claims to demonstrate safety.', 4)
on conflict (id) do update
set question_id = excluded.question_id,
    option_text = excluded.option_text,
    position = excluded.position;

-- 5. Insert Question Answer Keys (50 keys)
insert into public.question_answer_keys (question_id, correct_option_id)
values
  ('30000000-0000-4000-8000-000000000201', '40000000-0000-4000-8000-000000000202'),
  ('30000000-0000-4000-8000-000000000202', '40000000-0000-4000-8000-000000000207'),
  ('30000000-0000-4000-8000-000000000203', '40000000-0000-4000-8000-000000000210'),
  ('30000000-0000-4000-8000-000000000204', '40000000-0000-4000-8000-000000000214'),
  ('30000000-0000-4000-8000-000000000205', '40000000-0000-4000-8000-000000000218'),
  ('30000000-0000-4000-8000-000000000206', '40000000-0000-4000-8000-000000000222'),
  ('30000000-0000-4000-8000-000000000207', '40000000-0000-4000-8000-000000000226'),
  ('30000000-0000-4000-8000-000000000208', '40000000-0000-4000-8000-000000000230'),
  ('30000000-0000-4000-8000-000000000209', '40000000-0000-4000-8000-000000000234'),
  ('30000000-0000-4000-8000-000000000210', '40000000-0000-4000-8000-000000000238'),
  ('30000000-0000-4000-8000-000000000211', '40000000-0000-4000-8000-000000000242'),
  ('30000000-0000-4000-8000-000000000212', '40000000-0000-4000-8000-000000000245'),
  ('30000000-0000-4000-8000-000000000213', '40000000-0000-4000-8000-000000000249'),
  ('30000000-0000-4000-8000-000000000214', '40000000-0000-4000-8000-000000000254'),
  ('30000000-0000-4000-8000-000000000215', '40000000-0000-4000-8000-000000000258'),
  ('30000000-0000-4000-8000-000000000216', '40000000-0000-4000-8000-000000000262'),
  ('30000000-0000-4000-8000-000000000217', '40000000-0000-4000-8000-000000000266'),
  ('30000000-0000-4000-8000-000000000218', '40000000-0000-4000-8000-000000000270'),
  ('30000000-0000-4000-8000-000000000219', '40000000-0000-4000-8000-000000000274'),
  ('30000000-0000-4000-8000-000000000220', '40000000-0000-4000-8000-000000000278'),
  ('30000000-0000-4000-8000-000000000221', '40000000-0000-4000-8000-000000000282'),
  ('30000000-0000-4000-8000-000000000222', '40000000-0000-4000-8000-000000000286'),
  ('30000000-0000-4000-8000-000000000223', '40000000-0000-4000-8000-000000000290'),
  ('30000000-0000-4000-8000-000000000224', '40000000-0000-4000-8000-000000000294'),
  ('30000000-0000-4000-8000-000000000225', '40000000-0000-4000-8000-000000000298'),
  ('30000000-0000-4000-8000-000000000226', '40000000-0000-4000-8000-000000000302'),
  ('30000000-0000-4000-8000-000000000227', '40000000-0000-4000-8000-000000000306'),
  ('30000000-0000-4000-8000-000000000228', '40000000-0000-4000-8000-000000000310'),
  ('30000000-0000-4000-8000-000000000229', '40000000-0000-4000-8000-000000000314'),
  ('30000000-0000-4000-8000-000000000230', '40000000-0000-4000-8000-000000000318'),
  ('30000000-0000-4000-8000-000000000231', '40000000-0000-4000-8000-000000000322'),
  ('30000000-0000-4000-8000-000000000232', '40000000-0000-4000-8000-000000000326'),
  ('30000000-0000-4000-8000-000000000233', '40000000-0000-4000-8000-000000000330'),
  ('30000000-0000-4000-8000-000000000234', '40000000-0000-4000-8000-000000000334'),
  ('30000000-0000-4000-8000-000000000235', '40000000-0000-4000-8000-000000000338'),
  ('30000000-0000-4000-8000-000000000236', '40000000-0000-4000-8000-000000000342'),
  ('30000000-0000-4000-8000-000000000237', '40000000-0000-4000-8000-000000000346'),
  ('30000000-0000-4000-8000-000000000238', '40000000-0000-4000-8000-000000000350'),
  ('30000000-0000-4000-8000-000000000239', '40000000-0000-4000-8000-000000000354'),
  ('30000000-0000-4000-8000-000000000240', '40000000-0000-4000-8000-000000000358'),
  ('30000000-0000-4000-8000-000000000241', '40000000-0000-4000-8000-000000000362'),
  ('30000000-0000-4000-8000-000000000242', '40000000-0000-4000-8000-000000000366'),
  ('30000000-0000-4000-8000-000000000243', '40000000-0000-4000-8000-000000000371'),
  ('30000000-0000-4000-8000-000000000244', '40000000-0000-4000-8000-000000000374'),
  ('30000000-0000-4000-8000-000000000245', '40000000-0000-4000-8000-000000000378'),
  ('30000000-0000-4000-8000-000000000246', '40000000-0000-4000-8000-000000000382'),
  ('30000000-0000-4000-8000-000000000247', '40000000-0000-4000-8000-000000000386'),
  ('30000000-0000-4000-8000-000000000248', '40000000-0000-4000-8000-000000000390'),
  ('30000000-0000-4000-8000-000000000249', '40000000-0000-4000-8000-000000000394'),
  ('30000000-0000-4000-8000-000000000250', '40000000-0000-4000-8000-000000000398')
on conflict (question_id) do update
set correct_option_id = excluded.correct_option_id,
    updated_at = now();

commit;

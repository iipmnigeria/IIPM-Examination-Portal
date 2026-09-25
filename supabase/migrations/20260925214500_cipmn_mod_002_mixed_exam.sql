begin;

-- CIPMN-MOD-002 only: convert the existing standard 75-MCQ mock into
-- the proven mixed structure (25 MCQs + 5 Theory questions).
-- Existing submitted attempts, answers, access records and historical questions are preserved.

do $guard$
declare
  v_exam_id constant uuid := 'fe7a116b-72ef-5d1f-acc8-36938ee8b0cf';
  v_live integer;
  v_format text;
  v_active_questions integer;
begin
  select exam_format into v_format
  from public.examinations
  where id=v_exam_id
  for update;

  if not found then
    raise exception 'CIPMN-MOD-002 examination not found.';
  end if;

  if v_format not in ('standard','cipmn_mixed') then
    raise exception 'Unexpected CIPMN-MOD-002 exam format: %',v_format;
  end if;

  if v_format='cipmn_mixed' then
    raise exception 'CIPMN-MOD-002 is already configured as a mixed examination; conversion aborted.';
  end if;

  update public.exam_sessions
  set status='expired',updated_at=now()
  where examination_id=v_exam_id
    and status='active'
    and expires_at<=now();

  select count(*) into v_live
  from public.exam_sessions
  where examination_id=v_exam_id
    and status='active'
    and expires_at>now();

  if v_live<>0 then
    raise exception 'CIPMN-MOD-002 has % genuinely live examination session(s); conversion aborted.',v_live;
  end if;

  select count(*) into v_active_questions
  from public.questions
  where examination_id=v_exam_id and is_active;

  if v_format='standard' and v_active_questions<>75 then
    raise exception 'Expected 75 active legacy questions before conversion, found %.',v_active_questions;
  end if;
end
$guard$;

-- Preserve the first 25 validated MCQs and normalize their mixed-exam metadata.
update public.questions
set question_type='single_choice',
    section='mcq',
    points=1,
    updated_at=now()
where examination_id='fe7a116b-72ef-5d1f-acc8-36938ee8b0cf'
  and is_active=true
  and position between 1 and 25;

-- Retire positions 26-75 without deleting them so completed-attempt history remains intact.
with retirement as (
  select id,position
  from public.questions
  where examination_id='fe7a116b-72ef-5d1f-acc8-36938ee8b0cf'
    and is_active=true
    and position>25
)
update public.questions q
set is_active=false,
    position=retirement.position+1000,
    updated_at=now()
from retirement
where q.id=retirement.id;

-- Theory 1: methodology selection and tailoring.
insert into public.questions(
  id,examination_id,question_text,question_type,section,position,points,is_active
) values (
  public.cipmn_mock_seed_uuid('CIPMN-MOD-002:theory:1'),
  'fe7a116b-72ef-5d1f-acc8-36938ee8b0cf',
  'A federal agency is about to launch a nationwide digital-service project. Requirements are partly known, some regulatory approvals are fixed, users will need to provide feedback during development, and several vendors must work under a common governance structure. As Project Manager: (a) explain the factors you would assess before choosing a project-management methodology; (b) recommend an appropriate delivery approach and justify it; (c) explain what tailoring means in this context; (d) identify governance elements that should remain controlled; and (e) explain how the selected approach should support value delivery and stakeholder confidence.',
  'theory','theory',26,10,true
)
on conflict(id) do update set
  examination_id=excluded.examination_id,
  question_text=excluded.question_text,
  question_type='theory',
  section='theory',
  position=26,
  points=10,
  is_active=true,
  updated_at=now();

insert into public.theory_marking_rubrics(question_id,max_score,rubric,source_label,is_active)
values(
  public.cipmn_mock_seed_uuid('CIPMN-MOD-002:theory:1'),
  10,
  jsonb_build_object('criteria',jsonb_build_array(
    jsonb_build_object('name','Selection factors','marks',2,'expected','Assesses requirement stability, complexity, risk, regulation, stakeholder access, delivery urgency and team/vendor capability.'),
    jsonb_build_object('name','Recommended approach','marks',2,'expected','Recommends a justified hybrid or similarly appropriate approach matching fixed controls with adaptive digital delivery.'),
    jsonb_build_object('name','Tailoring','marks',2,'expected','Explains adapting processes, roles, artefacts and controls to project scale and context without abandoning necessary governance.'),
    jsonb_build_object('name','Governance controls','marks',2,'expected','Identifies controlled approvals, accountabilities, tolerances, compliance, decision rights and integrated vendor governance.'),
    jsonb_build_object('name','Value and confidence','marks',2,'expected','Links the approach to feedback, incremental value, transparency, stakeholder engagement and delivery confidence.')
  )),
  'CIPMN-MOD-002 supplied module material',
  true
)
on conflict(question_id) do update set
  max_score=excluded.max_score,rubric=excluded.rubric,source_label=excluded.source_label,is_active=true,updated_at=now();

-- Theory 2: predictive, Agile and hybrid choice.
insert into public.questions(
  id,examination_id,question_text,question_type,section,position,points,is_active
) values (
  public.cipmn_mock_seed_uuid('CIPMN-MOD-002:theory:2'),
  'fe7a116b-72ef-5d1f-acc8-36938ee8b0cf',
  'A programme contains two major components. Component A is a regulated infrastructure installation with stable requirements and sequential dependencies. Component B is a citizen-facing software platform whose requirements will evolve through frequent user feedback. As Project Manager: (a) compare the suitability of predictive/Waterfall and Agile approaches for the two components; (b) recommend the delivery approach for each component; (c) explain how a hybrid methodology could integrate both; (d) identify key coordination risks between the components; and (e) explain how change and stakeholder feedback should be governed.',
  'theory','theory',27,10,true
)
on conflict(id) do update set
  examination_id=excluded.examination_id,
  question_text=excluded.question_text,
  question_type='theory',
  section='theory',
  position=27,
  points=10,
  is_active=true,
  updated_at=now();

insert into public.theory_marking_rubrics(question_id,max_score,rubric,source_label,is_active)
values(
  public.cipmn_mock_seed_uuid('CIPMN-MOD-002:theory:2'),
  10,
  jsonb_build_object('criteria',jsonb_build_array(
    jsonb_build_object('name','Approach comparison','marks',2,'expected','Explains why predictive delivery suits stable sequential regulated work and Agile suits uncertain feedback-driven digital work.'),
    jsonb_build_object('name','Component recommendations','marks',2,'expected','Assigns an appropriate method to each component with clear justification.'),
    jsonb_build_object('name','Hybrid integration','marks',2,'expected','Explains integrated governance, dependencies, milestones and interfaces while allowing different delivery methods.'),
    jsonb_build_object('name','Coordination risks','marks',2,'expected','Identifies interface, dependency, timing, integration, governance or vendor coordination risks.'),
    jsonb_build_object('name','Change and feedback','marks',2,'expected','Explains controlled change for predictive work and frequent structured feedback/adaptation for Agile work.')
  )),
  'CIPMN-MOD-002 supplied module material',
  true
)
on conflict(question_id) do update set
  max_score=excluded.max_score,rubric=excluded.rubric,source_label=excluded.source_label,is_active=true,updated_at=now();

-- Theory 3: Scrum, Kanban and Lean.
insert into public.questions(
  id,examination_id,question_text,question_type,section,position,points,is_active
) values (
  public.cipmn_mock_seed_uuid('CIPMN-MOD-002:theory:3'),
  'fe7a116b-72ef-5d1f-acc8-36938ee8b0cf',
  'An organization has three delivery challenges: a product team needs short development cycles with prioritized features and regular reviews; a support team receives unpredictable requests continuously and suffers from work bottlenecks; and an operational process contains repeated waiting, rework and non-value-adding handoffs. Using the methodologies covered in the module: (a) recommend the most appropriate approach for each challenge; (b) explain the core practices of Scrum relevant to the product team; (c) explain how Kanban should improve support-team flow; (d) explain how Lean should address operational waste; and (e) state how management should measure improvement across the three environments.',
  'theory','theory',28,10,true
)
on conflict(id) do update set
  examination_id=excluded.examination_id,
  question_text=excluded.question_text,
  question_type='theory',
  section='theory',
  position=28,
  points=10,
  is_active=true,
  updated_at=now();

insert into public.theory_marking_rubrics(question_id,max_score,rubric,source_label,is_active)
values(
  public.cipmn_mock_seed_uuid('CIPMN-MOD-002:theory:3'),
  10,
  jsonb_build_object('criteria',jsonb_build_array(
    jsonb_build_object('name','Method selection','marks',2,'expected','Correctly maps Scrum to iterative product delivery, Kanban to continuous support flow, and Lean to waste reduction.'),
    jsonb_build_object('name','Scrum practices','marks',2,'expected','Covers roles/accountabilities, prioritized backlog, Sprints, review/inspection and adaptation.'),
    jsonb_build_object('name','Kanban practices','marks',2,'expected','Covers workflow visualization, WIP limits, flow management and bottleneck reduction.'),
    jsonb_build_object('name','Lean practices','marks',2,'expected','Covers customer value, waste elimination, improved flow and continuous improvement.'),
    jsonb_build_object('name','Measurement','marks',2,'expected','Uses relevant outcome/flow/value measures such as cycle time, throughput, defects/rework, customer value or delivery predictability.')
  )),
  'CIPMN-MOD-002 supplied module material',
  true
)
on conflict(question_id) do update set
  max_score=excluded.max_score,rubric=excluded.rubric,source_label=excluded.source_label,is_active=true,updated_at=now();

-- Theory 4: PRINCE2 and PMBOK.
insert into public.questions(
  id,examination_id,question_text,question_type,section,position,points,is_active
) values (
  public.cipmn_mock_seed_uuid('CIPMN-MOD-002:theory:4'),
  'fe7a116b-72ef-5d1f-acc8-36938ee8b0cf',
  'A large public project has an approved business case, several management stages and delegated tolerances. Midway through delivery, expected benefits decline sharply while cost forecasts exceed the agreed tolerance. Senior management also insists that PMBOK must be followed as a single rigid step-by-step methodology. As Project Manager: (a) explain how PRINCE2 continued business justification applies; (b) explain management by stages and by exception; (c) state what should happen when tolerance is forecast to be exceeded; (d) correct management''s interpretation of PMBOK; and (e) explain how PRINCE2 governance and PMBOK guidance could be used together appropriately.',
  'theory','theory',29,10,true
)
on conflict(id) do update set
  examination_id=excluded.examination_id,
  question_text=excluded.question_text,
  question_type='theory',
  section='theory',
  position=29,
  points=10,
  is_active=true,
  updated_at=now();

insert into public.theory_marking_rubrics(question_id,max_score,rubric,source_label,is_active)
values(
  public.cipmn_mock_seed_uuid('CIPMN-MOD-002:theory:4'),
  10,
  jsonb_build_object('criteria',jsonb_build_array(
    jsonb_build_object('name','Business justification','marks',2,'expected','Explains that justification must remain valid throughout and declining benefits require review, rejustification, redirection or stopping.'),
    jsonb_build_object('name','Stages and exception','marks',2,'expected','Explains staged control, delegated tolerances and escalation only when forecast exceptions exceed authority.'),
    jsonb_build_object('name','Tolerance breach response','marks',2,'expected','Escalates the forecast exception with impact/options rather than silently continuing beyond delegated limits.'),
    jsonb_build_object('name','PMBOK interpretation','marks',2,'expected','Explains PMBOK as a body of knowledge/principles/domains/processes/tools to be tailored, not one mandatory methodology.'),
    jsonb_build_object('name','Combined use','marks',2,'expected','Shows how governance can be provided by PRINCE2 while appropriate PMBOK practices are selected and tailored within that governance.')
  )),
  'CIPMN-MOD-002 supplied module material',
  true
)
on conflict(question_id) do update set
  max_score=excluded.max_score,rubric=excluded.rubric,source_label=excluded.source_label,is_active=true,updated_at=now();

-- Theory 5: DUCAP and contextual methodology.
insert into public.questions(
  id,examination_id,question_text,question_type,section,position,points,is_active
) values (
  public.cipmn_mock_seed_uuid('CIPMN-MOD-002:theory:5'),
  'fe7a116b-72ef-5d1f-acc8-36938ee8b0cf',
  'A complex Nigerian development project involves government agencies, local communities, contractors and international partners. The project must satisfy formal governance requirements but also respond to changing local realities, cultural expectations, sustainability concerns and stakeholder feedback. As Project Manager: (a) explain why applying an imported methodology unchanged may be inadequate; (b) explain the contextual value of DUCAP as presented in the module; (c) identify governance and adaptive-delivery elements that should be combined; (d) explain how stakeholder and cultural considerations should influence delivery; and (e) explain how sustainability and long-term value should affect methodology tailoring and project decisions.',
  'theory','theory',30,10,true
)
on conflict(id) do update set
  examination_id=excluded.examination_id,
  question_text=excluded.question_text,
  question_type='theory',
  section='theory',
  position=30,
  points=10,
  is_active=true,
  updated_at=now();

insert into public.theory_marking_rubrics(question_id,max_score,rubric,source_label,is_active)
values(
  public.cipmn_mock_seed_uuid('CIPMN-MOD-002:theory:5'),
  10,
  jsonb_build_object('criteria',jsonb_build_array(
    jsonb_build_object('name','Need for context','marks',2,'expected','Explains that methodology must reflect local political, cultural, regulatory, stakeholder and delivery realities rather than be imported unchanged.'),
    jsonb_build_object('name','DUCAP value','marks',2,'expected','Describes DUCAP as combining controlled governance, agility/adaptation, context sensitivity, stakeholder integration, sustainability and value.'),
    jsonb_build_object('name','Controlled and adaptive elements','marks',2,'expected','Combines clear governance/accountability/controls with iterative learning, responsiveness and proportionate tailoring.'),
    jsonb_build_object('name','Stakeholder and culture','marks',2,'expected','Explains continuous engagement, cultural awareness, community realities and stakeholder influence on decisions and acceptance.'),
    jsonb_build_object('name','Sustainability and value','marks',2,'expected','Links methodology choices to sustainable outcomes, benefits, long-term value and post-delivery considerations.')
  )),
  'CIPMN-MOD-002 supplied module material',
  true
)
on conflict(question_id) do update set
  max_score=excluded.max_score,rubric=excluded.rubric,source_label=excluded.source_label,is_active=true,updated_at=now();

-- Final invariant checks before changing the examination routing format.
do $verify$
declare
  v_mcq integer;
  v_theory integer;
  v_keys integer;
  v_rubrics integer;
  v_bad_mcq integer;
begin
  select count(*) into v_mcq
  from public.questions
  where examination_id='fe7a116b-72ef-5d1f-acc8-36938ee8b0cf'
    and is_active and section='mcq' and question_type='single_choice';

  select count(*) into v_theory
  from public.questions
  where examination_id='fe7a116b-72ef-5d1f-acc8-36938ee8b0cf'
    and is_active and section='theory' and question_type='theory';

  select count(*) into v_keys
  from public.question_answer_keys k
  join public.questions q on q.id=k.question_id
  where q.examination_id='fe7a116b-72ef-5d1f-acc8-36938ee8b0cf'
    and q.is_active and q.section='mcq';

  select count(*) into v_rubrics
  from public.theory_marking_rubrics r
  join public.questions q on q.id=r.question_id
  where q.examination_id='fe7a116b-72ef-5d1f-acc8-36938ee8b0cf'
    and q.is_active and q.section='theory' and r.is_active;

  select count(*) into v_bad_mcq
  from public.questions q
  where q.examination_id='fe7a116b-72ef-5d1f-acc8-36938ee8b0cf'
    and q.is_active and q.section='mcq'
    and (
      (select count(*) from public.question_options o where o.question_id=q.id)<>4
      or not exists(select 1 from public.question_answer_keys k where k.question_id=q.id)
    );

  if v_mcq<>25 then raise exception 'Module 2 mixed conversion expected 25 MCQs, found %.',v_mcq; end if;
  if v_theory<>5 then raise exception 'Module 2 mixed conversion expected 5 Theory questions, found %.',v_theory; end if;
  if v_keys<>25 then raise exception 'Module 2 mixed conversion expected 25 MCQ answer keys, found %.',v_keys; end if;
  if v_rubrics<>5 then raise exception 'Module 2 mixed conversion expected 5 active Theory rubrics, found %.',v_rubrics; end if;
  if v_bad_mcq<>0 then raise exception 'Module 2 mixed conversion contains % incomplete MCQ(s).',v_bad_mcq; end if;
end
$verify$;

update public.examinations
set exam_format='cipmn_mixed',
    updated_at=now()
where id='fe7a116b-72ef-5d1f-acc8-36938ee8b0cf';

commit;

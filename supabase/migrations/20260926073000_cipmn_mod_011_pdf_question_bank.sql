begin;

-- CIPMN-MOD-011 assessment conversion and source-strict bank refresh.
-- Primary official assessment source:
-- CIPMN-MOD-011.pdf (Understanding DUCAP Methodology; 48 pages; current library edition reviewed 2026-09-26).
-- Earlier July first-edition rendering was used only as a consistency cross-check.
-- Historical attempts, submitted answers, assignments and retired questions are preserved.

do $guard$
declare
  v_exam_id constant uuid := '6561efd6-938e-5da0-aae3-520349741cc9';
  v_live integer;
  v_format text;
  v_active integer;
  v_marker uuid := public.cipmn_mock_seed_uuid('CIPMN-MOD-011:PDF-V1:MCQ:1');
begin
  select exam_format into v_format
  from public.examinations
  where id=v_exam_id
  for update;

  if not found then raise exception 'CIPMN-MOD-011 examination not found.'; end if;

  if v_format not in ('standard','cipmn_mixed') then
    raise exception 'Unexpected CIPMN-MOD-011 exam format: %',v_format;
  end if;

  if exists(select 1 from public.questions where id=v_marker and is_active) then
    raise exception 'CIPMN-MOD-011 PDF-aligned bank is already active; refresh aborted.';
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
    raise exception 'CIPMN-MOD-011 has % genuinely live examination session(s); conversion aborted.',v_live;
  end if;

  select count(*) into v_active
  from public.questions
  where examination_id=v_exam_id and is_active;

  if v_format='standard' and v_active<>75 then
    raise exception 'Expected 75 active legacy Module 11 questions, found %.',v_active;
  end if;
end
$guard$;

update public.questions
set is_active=false,
    position=position+23000,
    updated_at=now()
where examination_id='6561efd6-938e-5da0-aae3-520349741cc9'
  and is_active=true;

do $mcq_insert$
declare
  v_exam_id constant uuid := '6561efd6-938e-5da0-aae3-520349741cc9';
  v_mcqs jsonb := $mcq$
[
  {
    "position":1,
    "question":"Which description best captures the purpose of DUCAP as presented in the current Module 11 licensing material?",
    "options":[
      "To replace all predictive controls with unrestricted Agile autonomy.",
      "To combine delivery control and predictability with Agile adaptability in challenging project environments.",
      "To prescribe a single software-development lifecycle for all Nigerian projects.",
      "To focus only on governance while leaving delivery methods undefined."
    ],
    "correct":2
  },
  {
    "position":2,
    "question":"Which organizational challenge is explicitly identified as one DUCAP was developed to address?",
    "options":[
      "Balancing executive need for control with team need for autonomy.",
      "Eliminating stakeholder feedback during delivery.",
      "Removing the need for formal project governance.",
      "Replacing all compliance requirements with iterative experimentation."
    ],
    "correct":1
  },
  {
    "position":3,
    "question":"Which set correctly identifies DUCAP's four key elements?",
    "options":[
      "Scope, Schedule, Cost and Quality.",
      "Predictive, Agile, Hybrid and Adaptive.",
      "Pillar, Activity, Process and Vision.",
      "Initiation, Planning, Execution and Closure."
    ],
    "correct":3
  },
  {
    "position":4,
    "question":"How does Module 11 characterize the DUCAP Pillars?",
    "options":[
      "Optional templates that may be used only at project closure.",
      "Compulsory principles that guide how the Project Manager must think and deliver within the Nigerian context.",
      "A list of software tools for day-to-day project control.",
      "A sequence of stage-gate approvals performed only by senior management."
    ],
    "correct":2
  },
  {
    "position":5,
    "question":"What is the DUCAP expectation for Lessons Learned Management?",
    "options":[
      "Lessons learned should begin during conceptualisation, draw on relevant past experience, and continue throughout delivery.",
      "Lessons learned should be documented only after formal project closure.",
      "Only failed projects should be reviewed for lessons.",
      "Lessons learned are optional where the Project Case is strong."
    ],
    "correct":1
  },
  {
    "position":6,
    "question":"Which statement best describes DUCAP's Project Value Justification pillar?",
    "options":[
      "Every project should maintain a Project Case that compares intended value/results with estimated cost and is reaffirmed throughout the lifecycle.",
      "Value is assessed only after benefits have been realized.",
      "Mandatory projects do not require value-for-money consideration.",
      "A Project Case is needed only for private-sector projects."
    ],
    "correct":1
  },
  {
    "position":7,
    "question":"A project is divided into stand-alone portions so that each portion can be completed, assessed for viability, and paused with minimal loss if necessary. Which DUCAP pillar is being applied?",
    "options":[
      "Outcome Realization Management.",
      "Segmented Delivery Management.",
      "Project Post-Delivery Sustainability.",
      "Project Change Management."
    ],
    "correct":2
  },
  {
    "position":8,
    "question":"Before a DUCAP project commences, what financial condition is specifically required for the first delivery segment?",
    "options":[
      "The project must have all lifetime funding fully deposited.",
      "Funding for at least the first segment must be available and signed off for use.",
      "Only a non-binding funding intention is required.",
      "Funding may be confirmed after the first Segment Interaction Point."
    ],
    "correct":2
  },
  {
    "position":9,
    "question":"Which pillar directly addresses unity, shared commitment, wellbeing, social inclusion and equality within the project team?",
    "options":[
      "Team Cohesion, Wellbeing and Equality.",
      "Project Value Justification.",
      "Environmental & Health Impact.",
      "Segmented Delivery Management."
    ],
    "correct":1
  },
  {
    "position":10,
    "question":"What does DUCAP require regarding environmental and health impacts?",
    "options":[
      "They should be evaluated only after the project becomes operational.",
      "They should be considered before, during and after delivery, with early forecasting and mitigation of negative effects.",
      "They apply only to infrastructure projects.",
      "They are subordinate to cost and schedule and need not affect project design."
    ],
    "correct":2
  },
  {
    "position":11,
    "question":"Which requirement best reflects DUCAP's Project Post-Delivery Sustainability pillar?",
    "options":[
      "A written and approved means of sustaining the delivered project should exist before delivery begins.",
      "Sustainability planning starts only after project acceptance.",
      "The Project Manager may transfer all sustainability responsibility at the first delivery segment.",
      "A sustainability plan is optional where the project meets scope and budget."
    ],
    "correct":1
  },
  {
    "position":12,
    "question":"How does DUCAP define project scope within Scope & Viability Management?",
    "options":[
      "Only the tangible outputs produced by the project.",
      "All outputs, outcomes and benefits, together with all work required to deliver them.",
      "Only work packages included in the original schedule.",
      "Only customer-facing deliverables."
    ],
    "correct":2
  },
  {
    "position":13,
    "question":"In the DUCAP RACI treatment, what does 'Accountable' mean?",
    "options":[
      "The person who physically performs the task.",
      "The individual or group that owns the task, gives approval and is ultimately responsible for the outcome.",
      "A person who must be informed after a decision.",
      "A specialist consulted only when an exception occurs."
    ],
    "correct":2
  },
  {
    "position":14,
    "question":"DUCAP supplements its RACI treatment with a RAG priority method. What does Amber mean?",
    "options":[
      "Important and urgent — High.",
      "Important but not urgent — Medium.",
      "Important but can be done later — Low.",
      "Not important and should be removed."
    ],
    "correct":2
  },
  {
    "position":15,
    "question":"Which statement best reflects DUCAP's approach to Quality and Regulation Management?",
    "options":[
      "Quality is assessed only by cost, schedule and scope performance.",
      "Quality includes traditional success factors plus stakeholder satisfaction, team wellbeing/equality, applicable regulation and customer satisfaction.",
      "Regulatory requirements are managed separately from quality.",
      "Quality is a closure-stage activity performed after delivery."
    ],
    "correct":2
  },
  {
    "position":16,
    "question":"Which statement best describes Outcome Realization Management in DUCAP?",
    "options":[
      "A structured approach to define, plan for and track project outcomes and ultimately benefits, including after deliverables are completed.",
      "A method for closing all project benefits when outputs are handed over.",
      "A finance-only review performed by the Project Board.",
      "A replacement for the sustainability plan."
    ],
    "correct":1
  },
  {
    "position":17,
    "question":"Which sequence correctly represents the three main DUCAP process groupings?",
    "options":[
      "Project Preparatory → Project Implementation/Control → Project Closure and Handover.",
      "Concept → Design → Procurement.",
      "Initiation → Sprint Delivery → Benefits Audit.",
      "Business Case → Agile Delivery → Programme Closure."
    ],
    "correct":1
  },
  {
    "position":18,
    "question":"Which activities belong to the DUCAP Project Preparatory process structure?",
    "options":[
      "Start up, Pre-planning/Lessons Learnt, and Full planning.",
      "Risk closure, supplier release and BAU handover.",
      "Daily Scrum, Sprint Review and Retrospective.",
      "Procurement, Quality Audit and Benefits Closure."
    ],
    "correct":1
  },
  {
    "position":19,
    "question":"How should a Segment Interaction Point (SIP) be understood under DUCAP?",
    "options":[
      "A routine milestone requiring no management review.",
      "A genuine pause and senior-management/Project Board interaction where the previous segment and next-stage viability are reviewed.",
      "A daily meeting controlled entirely by the Project Manager.",
      "A financial checkpoint used only when funding is exhausted."
    ],
    "correct":2
  },
  {
    "position":20,
    "question":"Which responsibility belongs to the Project Manager at a Segment Interaction Point when an exception exceeds project tolerance?",
    "options":[
      "Proceed without escalation because segment authority is already granted.",
      "Inform the Project Board and provide sufficient information for a continue, redirect or abort decision.",
      "Close the entire project automatically.",
      "Transfer the decision to the delivery team."
    ],
    "correct":2
  },
  {
    "position":21,
    "question":"During DUCAP Implementation and Control, what is a core Project Manager responsibility?",
    "options":[
      "Authorize, review and receive completed work packages while monitoring boundaries and reporting to the board.",
      "Delegate all monitoring to senior management.",
      "Freeze the sustainability plan after planning approval.",
      "Avoid revisiting the Project Case once implementation begins."
    ],
    "correct":1
  },
  {
    "position":22,
    "question":"Which activity is explicitly part of DUCAP project closure?",
    "options":[
      "Completing the Lessons Learned Log/Report and handing over an accepted sustainability plan to BAU.",
      "Starting the Project Case.",
      "Approving funding for the first delivery segment.",
      "Creating the initial stakeholder list."
    ],
    "correct":1
  },
  {
    "position":23,
    "question":"According to Module 11, when should the project team finally disband?",
    "options":[
      "Immediately after the final deliverable is technically completed.",
      "After the sustainability plan is operational and necessary documents have been handed over to the client/BAU.",
      "At the first Segment Interaction Point after implementation.",
      "When the Project Board approves the final invoice."
    ],
    "correct":2
  },
  {
    "position":24,
    "question":"What is the central purpose of the DUCAP Vision Element?",
    "options":[
      "To promote national development/value creation, national integration/inclusion, and efficient use of limited resources within the project environment.",
      "To mandate local hiring regardless of competence.",
      "To prioritize political affiliation when selecting project teams.",
      "To replace business objectives with community objectives."
    ],
    "correct":1
  },
  {
    "position":25,
    "question":"Which practice does Module 11 explicitly warn against in applying the DUCAP Vision Element?",
    "options":[
      "Selecting team members solely to satisfy diversity requirements without first ensuring they are skilled and suitable for purpose.",
      "Using diverse teams where relevant skills are available.",
      "Considering local cultural, religious and political sensitivities.",
      "Promoting fairness, respect and inclusion during delivery."
    ],
    "correct":1
  }
]
$mcq$::jsonb;
  v_item jsonb;
  v_qid uuid;
  v_option_text text;
  v_opt_pos integer;
  v_opt_id uuid;
  v_correct_id uuid;
begin
  for v_item in select value from jsonb_array_elements(v_mcqs)
  loop
    v_qid := public.cipmn_mock_seed_uuid('CIPMN-MOD-011:PDF-V1:MCQ:' || (v_item->>'position'));

    insert into public.questions(
      id,examination_id,question_text,question_type,section,position,points,is_active
    ) values(
      v_qid,v_exam_id,v_item->>'question','single_choice','mcq',
      (v_item->>'position')::integer,1,true
    );

    v_correct_id := null;
    for v_option_text,v_opt_pos in
      select value #>> '{}', ordinality::integer
      from jsonb_array_elements(v_item->'options') with ordinality
    loop
      insert into public.question_options(question_id,option_text,position)
      values(v_qid,v_option_text,v_opt_pos)
      returning id into v_opt_id;

      if v_opt_pos=(v_item->>'correct')::integer then
        v_correct_id:=v_opt_id;
      end if;
    end loop;

    if v_correct_id is null then
      raise exception 'No correct option resolved for Module 11 MCQ position %.',v_item->>'position';
    end if;

    insert into public.question_answer_keys(question_id,correct_option_id)
    values(v_qid,v_correct_id);
  end loop;
end
$mcq_insert$;

do $theory_insert$
declare
  v_exam_id constant uuid := '6561efd6-938e-5da0-aae3-520349741cc9';
  v_theory jsonb := $theory$
[
  {
    "position":26,
    "question":"Using only the current Module 11 DUCAP licensing material: (a) explain why DUCAP was developed and how it combines control with agility; (b) identify and explain the four DUCAP elements; (c) explain the benefits of adopting DUCAP; (d) explain why DUCAP is tailored to Nigerian/African project realities; and (e) explain how control, agility, alignment and stakeholder value are reflected in its overall approach.",
    "criteria":[
      {"name":"Purpose/background","marks":2,"expected":"Explains predictive discipline plus Agile adaptability and the challenges of complex compliance, dynamic markets, executive control and team autonomy."},
      {"name":"Four elements","marks":2,"expected":"Explains Pillar, Activity, Process and Vision Elements using the source's roles for principles, practical activities, delivery process and national/sustainable-development perspective."},
      {"name":"Benefits","marks":2,"expected":"Uses source-supported benefits such as predictability, strategy-execution alignment, stakeholder satisfaction/feedback, structured risk control, team morale/productivity and sustainability thinking."},
      {"name":"Nigerian/African context","marks":2,"expected":"Explains multicultural/diverse environment, emerging-economy constraints, local delivery experience and the need to reflect project realities in Nigeria/Africa."},
      {"name":"Integrated DUCAP approach","marks":2,"expected":"Shows how governance/control, iterative feedback/adaptability, strategic alignment and continuous stakeholder value coexist within the methodology."}
    ]
  },
  {
    "position":27,
    "question":"Using only Module 11: (a) explain what DUCAP Pillars are and why they are compulsory; (b) explain Cultural, Religious and Political Sensitivity, Lessons Learned Management, Project Value Justification and Segmented Delivery Management; (c) explain Financial Sustainability and Team Cohesion, Wellbeing and Equality; (d) explain Understanding Stakeholders and Environmental & Health Impact; and (e) explain Project Post-Delivery Sustainability and how the pillars reinforce project viability.",
    "criteria":[
      {"name":"Pillar concept","marks":2,"expected":"Explains pillars as compulsory principles/rules guiding how the PM thinks rather than tasks or processes."},
      {"name":"Sensitivity/lessons/value/SDM","marks":2,"expected":"Accurately explains cultural-religious-political sensitivity, continuous lessons learning, Project Case/value justification and stand-alone segmented delivery."},
      {"name":"Finance/team pillar","marks":2,"expected":"Explains secure/signed-off funding for at least the first segment, value for money, and team cohesion/wellbeing/equality/social inclusion."},
      {"name":"Stakeholders/environment","marks":2,"expected":"Explains understanding and engaging affected stakeholders plus forecasting/minimizing environmental and health impacts before, during and after delivery."},
      {"name":"Post-delivery sustainability","marks":2,"expected":"Explains the requirement for an approved means of continuation before commencement and connects sustainability to ongoing viability/value."}
    ]
  },
  {
    "position":28,
    "question":"Using only Module 11: (a) explain the purpose of DUCAP Activity Elements; (b) explain Scope & Viability Management and Project Resource Management; (c) explain DUCAP's RACI Matrix together with its RAG prioritization method; (d) explain Quality & Regulation, Change, Risk & Issue, Schedule, and Stakeholder/Community Management; and (e) explain Outcome Realization Management and why benefits may require management beyond delivery of outputs.",
    "criteria":[
      {"name":"Activity Element purpose","marks":2,"expected":"Explains Activity Elements as practical day-to-day task areas with relevant templates used during project execution."},
      {"name":"Scope/resources","marks":2,"expected":"Explains coordinated scope boundary/viability control and planning/managing project resources consistent with the source."},
      {"name":"RACI/RAG","marks":2,"expected":"Explains Responsible, Accountable, Consult, Inform and RAG: Red important/urgent, Amber important/not urgent, Green important/can be later."},
      {"name":"Core activity areas","marks":2,"expected":"Explains quality/regulation, change, risk/issues, schedule and stakeholder/community management at the source-supported level."},
      {"name":"Outcome realization","marks":2,"expected":"Distinguishes outputs from outcomes/benefits, explains structured tracking and shared responsibility, and links benefits realization to sustainability planning."}
    ]
  },
  {
    "position":29,
    "question":"Using only Module 11: (a) explain the objectives of the DUCAP Processes; (b) describe the three main process groupings and their sub-parts; (c) explain the Preparatory Stage including Start-up, Pre-planning/Lessons Learnt and Full Planning; (d) explain Segment Interaction Points and the distinct responsibilities of senior management/Project Board and the Project Manager; and (e) explain Implementation/Control, exception management and the continue/redirect/abort decision logic.",
    "criteria":[
      {"name":"Process objectives","marks":2,"expected":"Explains guidance, role assignment, planning/monitoring, lessons capture, maintained Project Case, governance and structured staged delivery."},
      {"name":"Three process groupings","marks":2,"expected":"Correctly states Project Preparatory; Project Implementation/Control; Project Closure and Handover, including source-listed sub-parts."},
      {"name":"Preparatory Stage","marks":2,"expected":"Explains Start-up, Pre-planning/Lessons Learnt and Full Planning, including Project Case, governance/team setup, lessons review and integrated planning."},
      {"name":"SIP governance","marks":2,"expected":"Explains SIP as a genuine stage-boundary meeting/pause led by senior management/Project Board, with PM reporting exceptions and supplying decision information."},
      {"name":"Implementation/exceptions","marks":2,"expected":"Explains authorization/review of work packages, monitoring/control, tolerance boundaries, Project Case/sustainability review and decisions to continue, redirect or abort."}
    ]
  },
  {
    "position":30,
    "question":"Using only Module 11: (a) explain the objectives and principal activities of Closing a DUCAP Project; (b) explain the role of the Lessons Learned Log/Report and the final Sustainability Plan; (c) explain BAU transition and the condition for final team disbandment; (d) explain the Vision Element's ethics/purpose and DUCAP's general approach to diversity, inclusion and national integration; and (e) explain how Module 11 says DUCAP should NOT be applied when selecting people or interpreting wellbeing and diversity.",
    "criteria":[
      {"name":"Closure activities","marks":2,"expected":"Explains value delivery/transition, finishing work, acceptance, records/as-built documentation, releasing resources, financial closure and reviews."},
      {"name":"Lessons/sustainability","marks":2,"expected":"Explains complete/current Lessons Learned Log and Report and final Sustainability Plan updated from implementation/post-go-live learning."},
      {"name":"BAU transition","marks":2,"expected":"Explains handover/training/interface with BAU and that final disbandment occurs only after the sustainability plan is operational and documents are handed over."},
      {"name":"Vision Element","marks":2,"expected":"Explains national development/value creation, national integration/inclusion, efficient resource use, common good, diverse perspectives, fairness and inspiring conduct."},
      {"name":"How not to apply DUCAP","marks":2,"expected":"Explains that diversity does not justify selecting unsuitable people, wellbeing applies to everyone, and skills/suitability remain primary in team/supplier selection."}
    ]
  }
]
$theory$::jsonb;
  v_item jsonb;
  v_qid uuid;
begin
  for v_item in select value from jsonb_array_elements(v_theory)
  loop
    v_qid := public.cipmn_mock_seed_uuid('CIPMN-MOD-011:PDF-V1:THEORY:' || ((v_item->>'position')::integer-25));

    insert into public.questions(
      id,examination_id,question_text,question_type,section,position,points,is_active
    ) values(
      v_qid,v_exam_id,v_item->>'question','theory','theory',
      (v_item->>'position')::integer,10,true
    );

    insert into public.theory_marking_rubrics(
      question_id,max_score,rubric,source_label,is_active
    ) values(
      v_qid,10,jsonb_build_object('criteria',v_item->'criteria'),
      'CIPMN-MOD-011.pdf (48 pages; current library edition reviewed 2026-09-26)',true
    );
  end loop;
end
$theory_insert$;

do $verify$
declare
  v_exam_id constant uuid := '6561efd6-938e-5da0-aae3-520349741cc9';
  v_mcq integer;
  v_theory integer;
  v_keys integer;
  v_options integer;
  v_rubrics integer;
  v_bad_options integer;
  v_bad_rubrics integer;
  v_duplicate_texts integer;
begin
  select count(*) into v_mcq
  from public.questions
  where examination_id=v_exam_id and is_active
    and section='mcq' and question_type='single_choice';

  select count(*) into v_theory
  from public.questions
  where examination_id=v_exam_id and is_active
    and section='theory' and question_type='theory';

  select count(*) into v_keys
  from public.question_answer_keys k
  join public.questions q on q.id=k.question_id
  where q.examination_id=v_exam_id and q.is_active and q.section='mcq';

  select count(*) into v_options
  from public.question_options o
  join public.questions q on q.id=o.question_id
  where q.examination_id=v_exam_id and q.is_active and q.section='mcq';

  select count(*) into v_rubrics
  from public.theory_marking_rubrics r
  join public.questions q on q.id=r.question_id
  where q.examination_id=v_exam_id and q.is_active and q.section='theory' and r.is_active;

  select count(*) into v_bad_options
  from public.questions q
  where q.examination_id=v_exam_id and q.is_active and q.section='mcq'
    and (
      (select count(*) from public.question_options o where o.question_id=q.id)<>4
      or
      (select count(distinct lower(trim(o.option_text))) from public.question_options o where o.question_id=q.id)<>4
    );

  select count(*) into v_bad_rubrics
  from public.theory_marking_rubrics r
  join public.questions q on q.id=r.question_id
  where q.examination_id=v_exam_id and q.is_active and q.section='theory'
    and (
      not r.is_active
      or r.max_score<>10
      or jsonb_typeof(r.rubric->'criteria')<>'array'
      or jsonb_array_length(r.rubric->'criteria')<>5
    );

  select count(*)-count(distinct regexp_replace(lower(trim(question_text)),'\s+',' ','g'))
  into v_duplicate_texts
  from public.questions
  where examination_id=v_exam_id and is_active;

  if v_mcq<>25 then raise exception 'Expected 25 active Module 11 MCQs, found %.',v_mcq; end if;
  if v_theory<>5 then raise exception 'Expected 5 active Module 11 Theory questions, found %.',v_theory; end if;
  if v_keys<>25 then raise exception 'Expected 25 Module 11 answer keys, found %.',v_keys; end if;
  if v_options<>100 then raise exception 'Expected 100 active Module 11 MCQ options, found %.',v_options; end if;
  if v_rubrics<>5 then raise exception 'Expected 5 active Module 11 Theory rubrics, found %.',v_rubrics; end if;
  if v_bad_options<>0 then raise exception 'Found % Module 11 MCQ(s) with invalid/repeated options.',v_bad_options; end if;
  if v_bad_rubrics<>0 then raise exception 'Found % invalid Module 11 Theory rubric(s).',v_bad_rubrics; end if;
  if v_duplicate_texts<>0 then raise exception 'Found % repeated active Module 11 question text(s).',v_duplicate_texts; end if;
end
$verify$;

update public.examinations
set exam_format='cipmn_mixed',
    updated_at=now()
where id='6561efd6-938e-5da0-aae3-520349741cc9';

commit;

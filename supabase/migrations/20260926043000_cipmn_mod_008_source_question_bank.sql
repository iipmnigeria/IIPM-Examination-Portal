begin;

-- CIPMN-MOD-008 assessment conversion and source-strict bank refresh.
-- Official assessment sources:
-- 1) CIPMN - MOD-008..pdf (Project Quality Management)
-- 2) CIPMN-MOD-008.pptx
-- Reviewed 2026-09-26.
-- Historical attempts, submitted answers, assignments and retired questions are preserved.

do $guard$
declare
  v_exam_id constant uuid := '2eec289b-9c0b-57e4-a2c6-e288fa6d4a28';
  v_live integer;
  v_format text;
  v_active integer;
  v_marker uuid := public.cipmn_mock_seed_uuid('CIPMN-MOD-008:SOURCES-V1:MCQ:1');
begin
  select exam_format into v_format
  from public.examinations
  where id=v_exam_id
  for update;

  if not found then
    raise exception 'CIPMN-MOD-008 examination not found.';
  end if;

  if v_format not in ('standard','cipmn_mixed') then
    raise exception 'Unexpected CIPMN-MOD-008 exam format: %',v_format;
  end if;

  if exists(select 1 from public.questions where id=v_marker and is_active) then
    raise exception 'CIPMN-MOD-008 source-aligned bank is already active; refresh aborted.';
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
    raise exception 'CIPMN-MOD-008 has % genuinely live examination session(s); conversion aborted.',v_live;
  end if;

  select count(*) into v_active
  from public.questions
  where examination_id=v_exam_id and is_active;

  if v_format='standard' and v_active<>75 then
    raise exception 'Expected 75 active legacy Module 8 questions, found %.',v_active;
  end if;
end
$guard$;

update public.questions
set is_active=false,
    position=position+17000,
    updated_at=now()
where examination_id='2eec289b-9c0b-57e4-a2c6-e288fa6d4a28'
  and is_active=true;

do $mcq_insert$
declare
  v_exam_id constant uuid := '2eec289b-9c0b-57e4-a2c6-e288fa6d4a28';
  v_mcqs jsonb := $mcq$
[
  {
    "position":1,
    "question":"A low-cost housing project uses modest materials but fully meets agreed safety, durability and functional requirements. How should its quality be judged according to Module 8?",
    "options":[
      "Low quality because high grade is required for quality.",
      "High quality if the deliverable meets requirements and is fit for use.",
      "High grade automatically means high quality.",
      "Quality cannot be judged until the project closes."
    ],
    "correct":2
  },
  {
    "position":2,
    "question":"Which statement correctly distinguishes quality from grade in the official materials?",
    "options":[
      "Quality measures conformity to requirements; grade is a category or rank among products with the same functional use but different technical characteristics.",
      "Quality and grade are interchangeable terms.",
      "Grade measures stakeholder satisfaction while quality measures price.",
      "Grade is always more important than quality."
    ],
    "correct":1
  },
  {
    "position":3,
    "question":"Repeated measurements are tightly clustered but all are far from the true value. Which interpretation is correct?",
    "options":[
      "Accurate but not precise.",
      "Neither accurate nor precise.",
      "Precise but not accurate.",
      "Both accurate and precise."
    ],
    "correct":3
  },
  {
    "position":4,
    "question":"Which principle is emphasized by the module when choosing between defect prevention and later inspection?",
    "options":[
      "Inspection should replace prevention.",
      "Prevention is generally more cost-effective than finding and fixing defects after they occur.",
      "Inspection is always cheaper than process improvement.",
      "Defects should be accepted if the product grade is high."
    ],
    "correct":2
  },
  {
    "position":5,
    "question":"Which statement best describes Project Quality Management?",
    "options":[
      "It covers only final product testing.",
      "It focuses only on organizational policy, not project execution.",
      "It integrates planning, managing and controlling project and product quality requirements so stakeholder expectations are met.",
      "It is limited to quality audits performed after delivery."
    ],
    "correct":3
  },
  {
    "position":6,
    "question":"A project manager wants to identify applicable standards and document how compliance will be demonstrated. Which process is being performed?",
    "options":[
      "Quality Planning.",
      "Quality Control.",
      "Issue Escalation.",
      "Scope Validation."
    ],
    "correct":1
  },
  {
    "position":7,
    "question":"Which item is listed as an output of Plan Quality Management in the official deck?",
    "options":[
      "Risk Register only.",
      "Quality Management Plan.",
      "Project Charter.",
      "Stakeholder Register only."
    ],
    "correct":2
  },
  {
    "position":8,
    "question":"Which set contains only source-listed tools and techniques for quality planning?",
    "options":[
      "Expert judgment, brainstorming/interviews/checklists, cost-benefit analysis, SWOT, multicriteria decision analysis, benchmarking, DOE and meetings.",
      "PERT, CPM, crashing and fast-tracking.",
      "Monte Carlo, EMV and decision trees only.",
      "Issue logs, escalation paths and risk audits."
    ],
    "correct":1
  },
  {
    "position":9,
    "question":"Which statement best distinguishes Quality Assurance from Quality Control?",
    "options":[
      "QA is proactive and process-focused; QC measures and inspects outputs for conformance.",
      "QA and QC are identical.",
      "QA focuses on product inspection while QC improves processes.",
      "QC is performed only by external auditors."
    ],
    "correct":1
  },
  {
    "position":10,
    "question":"A quality team reviews welding procedures, material procurement processes and safety protocols to determine whether project processes comply with standards. What is this activity?",
    "options":[
      "Statistical Sampling.",
      "Quality Audit.",
      "Product Validation.",
      "Acceptance Testing."
    ],
    "correct":2
  },
  {
    "position":11,
    "question":"Which continuous-improvement method is described as maximizing customer value while minimizing waste?",
    "options":[
      "Six Sigma.",
      "TQM.",
      "Lean.",
      "PDSA."
    ],
    "correct":3
  },
  {
    "position":12,
    "question":"Which methodology is explicitly described as data-driven and focused on reducing defects and variability, often using DMAIC?",
    "options":[
      "Kaizen.",
      "Six Sigma.",
      "Lean.",
      "Benchmarking."
    ],
    "correct":2
  },
  {
    "position":13,
    "question":"What does the PDSA cycle represent in the source materials?",
    "options":[
      "An iterative Plan–Do–Study–Act method for continuous improvement and control of processes/products.",
      "A budgeting method for Cost of Quality.",
      "A schedule compression technique.",
      "A stakeholder prioritization tool."
    ],
    "correct":1
  },
  {
    "position":14,
    "question":"Which Quality Control technique selects a representative portion of a population for inspection when checking every item is impractical or too costly?",
    "options":[
      "Statistical Sampling.",
      "Benchmarking.",
      "Process Audit.",
      "Quality Function Deployment."
    ],
    "correct":1
  },
  {
    "position":15,
    "question":"Which basic quality tool is best used to prioritize the most frequent or significant causes of problems using the 80/20 principle?",
    "options":[
      "Histogram.",
      "Control Chart.",
      "Pareto Chart.",
      "Scatter Diagram."
    ],
    "correct":3
  },
  {
    "position":16,
    "question":"Which quality tool helps determine whether a process remains within established control limits over time?",
    "options":[
      "Check Sheet.",
      "Control Chart.",
      "Flowchart.",
      "Fishbone Diagram."
    ],
    "correct":2
  },
  {
    "position":17,
    "question":"A team wants to investigate possible root causes of repeated defects by grouping causes such as Man, Machine, Material, Method, Measurement and Environment. Which tool fits?",
    "options":[
      "Cause-and-Effect (Fishbone/Ishikawa) Diagram.",
      "Scatter Diagram.",
      "Histogram.",
      "Check Sheet."
    ],
    "correct":1
  },
  {
    "position":18,
    "question":"A defect has already been detected and the team acts to eliminate its cause and realign performance with the project plan. What type of action is this?",
    "options":[
      "Preventive Action.",
      "Corrective Action.",
      "Appraisal Cost.",
      "External Failure."
    ],
    "correct":2
  },
  {
    "position":19,
    "question":"Which framework is presented as an internationally recognized Quality Management System standard that supports consistent customer and regulatory compliance?",
    "options":[
      "ISO 9001.",
      "PERT.",
      "MoSCoW.",
      "COBIT."
    ],
    "correct":1
  },
  {
    "position":20,
    "question":"Which Nigerian regulator is identified in the module as responsible for standardizing and regulating the quality of products and services in Nigeria?",
    "options":[
      "NCC.",
      "CBN.",
      "SON.",
      "COREN."
    ],
    "correct":3
  },
  {
    "position":21,
    "question":"Which Cost of Quality category covers costs incurred to assess or measure whether products and services conform to requirements?",
    "options":[
      "Prevention Cost.",
      "Appraisal Cost.",
      "Internal Failure Cost.",
      "External Failure Cost."
    ],
    "correct":2
  },
  {
    "position":22,
    "question":"A defect is discovered after a product has already been delivered to the customer. Which Cost of Quality category applies?",
    "options":[
      "External Failure Cost.",
      "Internal Failure Cost.",
      "Prevention Cost.",
      "Appraisal Cost."
    ],
    "correct":1
  },
  {
    "position":23,
    "question":"Which statement best reflects the module's view of responsibility for project quality?",
    "options":[
      "Quality belongs only to the Quality Manager.",
      "Quality is a shared responsibility supported by role clarity, leadership commitment, stakeholder engagement, communication and training.",
      "Quality belongs only to the Project Manager.",
      "Team members should report defects only after project closure."
    ],
    "correct":2
  },
  {
    "position":24,
    "question":"Which Quality KPI characteristic is required by the module?",
    "options":[
      "SMART: Specific, Measurable, Achievable, Relevant and Time-bound.",
      "Subjective, Manual, Approximate, Repetitive and Temporary.",
      "Strategic, Monetary, Audited, Reactive and Technical.",
      "Simple, Market-driven, Annual, Risk-free and Transferable."
    ],
    "correct":1
  },
  {
    "position":25,
    "question":"Which statement best describes how quality is integrated into Agile and Hybrid project environments in the source materials?",
    "options":[
      "Agile builds quality through continuous testing, frequent feedback and iterative development; Hybrid requires flexibility and adaptation while retaining quality controls.",
      "Agile removes the need for quality planning and QC.",
      "Hybrid projects should defer quality checks until final delivery.",
      "Agile and Hybrid methods are incompatible with formal quality management."
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
    v_qid := public.cipmn_mock_seed_uuid(
      'CIPMN-MOD-008:SOURCES-V1:MCQ:' || (v_item->>'position')
    );

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
      raise exception 'No correct option resolved for Module 8 MCQ position %.',v_item->>'position';
    end if;

    insert into public.question_answer_keys(question_id,correct_option_id)
    values(v_qid,v_correct_id);
  end loop;
end
$mcq_insert$;

do $theory_insert$
declare
  v_exam_id constant uuid := '2eec289b-9c0b-57e4-a2c6-e288fa6d4a28';
  v_theory jsonb := $theory$
[
  {
    "position":26,
    "question":"Using only Module 8: (a) define Quality and Project Quality Management; (b) distinguish quality from grade and precision from accuracy; (c) explain prevention versus inspection; (d) explain why quality matters for customer satisfaction, rework/cost, reputation, stakeholder confidence and morale; and (e) explain how project quality should align with organizational strategy and quality policy.",
    "criteria":[
      {"name":"Core definitions","marks":2,"expected":"Defines quality as the degree to which inherent characteristics fulfill requirements/fitness for use and Project Quality Management as planning, managing and controlling quality so needs and standards are met."},
      {"name":"Quality vs grade / precision vs accuracy","marks":2,"expected":"Correctly distinguishes conformity from grade/rank and repeatability/consistency from closeness to the true or standard value."},
      {"name":"Prevention vs inspection","marks":2,"expected":"Explains the source principle that preventing defects is generally more cost-effective than detecting and fixing them after occurrence."},
      {"name":"Business/project value","marks":2,"expected":"Explains source-supported benefits: customer satisfaction, reduced rework/cost, enhanced reputation, stakeholder confidence and improved morale/productivity."},
      {"name":"Strategic alignment","marks":2,"expected":"Explains that organizational quality policy/strategy provides the framework and project quality objectives should contribute to broader strategic quality goals."}
    ]
  },
  {
    "position":27,
    "question":"Using only Module 8: (a) define Quality Planning; (b) identify the major planning inputs, tools/techniques and outputs shown in the module; (c) explain quality metrics, checklists and acceptance criteria; (d) explain how regulatory, industry, organizational and stakeholder requirements shape planning; and (e) explain how a Quality Management Plan demonstrates compliance throughout the project.",
    "criteria":[
      {"name":"Quality Planning definition","marks":2,"expected":"Explains identifying applicable quality requirements/standards and documenting how compliance will be demonstrated."},
      {"name":"Inputs/tools/outputs","marks":2,"expected":"Uses source-listed inputs such as Charter/Plan/Requirements/Stakeholders/Risks/EEFs/OPAs; tools such as expert judgment, data gathering/analysis, benchmarking/DOE/meetings; and outputs including QMP, metrics and updates."},
      {"name":"Metrics/checklists/acceptance criteria","marks":2,"expected":"Explains their role in making quality expectations measurable, repeatable and testable against defined acceptance conditions."},
      {"name":"Requirement sources","marks":2,"expected":"Explains stakeholder needs, organizational policies, industry standards and regulatory compliance as quality-planning drivers."},
      {"name":"Compliance demonstration","marks":2,"expected":"Explains how the Quality Management Plan documents methods, standards, responsibilities and evidence used to demonstrate compliance."}
    ]
  },
  {
    "position":28,
    "question":"A project has recurring defects despite repeated final inspections. Using only Module 8: (a) distinguish Quality Assurance from Quality Control; (b) explain process quality assurance versus product quality assurance; (c) explain process audits, standardization and training; (d) explain Kaizen, Lean, Six Sigma/DMAIC and PDSA at the level taught in the module; and (e) recommend how QA and QC should work together to reduce recurrence.",
    "criteria":[
      {"name":"QA vs QC","marks":2,"expected":"Explains QA as proactive/process-focused defect prevention and QC as output/product monitoring, inspection and conformance checking."},
      {"name":"Process vs product assurance","marks":2,"expected":"Distinguishes assurance of methods/procedures from assurance/testing/inspection of actual deliverables as presented in the deck."},
      {"name":"Process controls","marks":2,"expected":"Explains standardization, training and process/quality audits as ways to build quality into the project lifecycle and improve compliance."},
      {"name":"Continuous improvement methods","marks":2,"expected":"Explains Kaizen as continuous improvement, Lean as maximizing value/minimizing waste, Six Sigma as data-driven defect/variation reduction using DMAIC, and PDSA as an iterative improvement cycle."},
      {"name":"Integrated response","marks":2,"expected":"Explains that QC detects/measures defects while QA investigates and improves the underlying process to prevent recurrence, with lessons learned feeding continuous improvement."}
    ]
  },
  {
    "position":29,
    "question":"Using only Module 8: (a) explain verification, validation, inspection, testing and statistical sampling; (b) explain the purpose of the seven basic quality tools; (c) compare Control Charts, Pareto Charts, Histograms, Scatter Diagrams, Flowcharts, Check Sheets and Cause-and-Effect Diagrams; (d) distinguish corrective from preventive action; and (e) explain how lessons learned from nonconformance should be captured and reused.",
    "criteria":[
      {"name":"QC methods","marks":2,"expected":"Explains verification against requirements, validation against customer/stakeholder needs, inspection, testing and representative statistical sampling."},
      {"name":"Seven-tool purpose","marks":2,"expected":"Explains the seven basic tools as practical data-analysis/problem-solving methods used in quality control and SPC contexts."},
      {"name":"Tool comparison","marks":2,"expected":"Accurately describes Control Charts, Pareto, Histogram, Scatter, Flowchart, Check Sheet and Fishbone/Ishikawa according to source functions."},
      {"name":"Corrective vs preventive","marks":2,"expected":"Corrective action eliminates cause of detected nonconformity; preventive action proactively eliminates cause of a potential nonconformity."},
      {"name":"Lessons learned","marks":2,"expected":"Explains documenting defects, causes and effectiveness of actions as organizational process assets so future projects can avoid recurrence and improve quality."}
    ]
  },
  {
    "position":30,
    "question":"Using only Module 8: (a) compare ISO 9001, TQM, Six Sigma and Lean; (b) explain regulatory/industry-specific quality requirements in the Nigerian context; (c) explain the four Cost of Quality categories and how they should be balanced with customer expectations; (d) explain quality roles/culture including leadership, stakeholder engagement and RACI; and (e) explain how SMART KPIs, dashboards, data analysis and embedded lessons learned support continuous improvement.",
    "criteria":[
      {"name":"Standards/frameworks","marks":2,"expected":"Explains ISO 9001 as a QMS standard, TQM as organization-wide customer-focused continuous improvement, Six Sigma as defect/variation reduction, and Lean as waste reduction/value maximization."},
      {"name":"Nigerian compliance context","marks":2,"expected":"Uses source-supported examples such as SON, CBN, NCC and relevant industry-specific bodies/standards, emphasizing integration into the Quality Management Plan."},
      {"name":"Cost of Quality","marks":2,"expected":"Explains Prevention, Appraisal, Internal Failure and External Failure costs and the need to balance investment in quality with customer value, risk, lifecycle cost and monitoring."},
      {"name":"Roles and culture","marks":2,"expected":"Explains shared quality responsibility, role clarity/RACI, Project/Quality Manager/team/stakeholder involvement, leadership commitment, communication and training."},
      {"name":"Monitoring and learning","marks":2,"expected":"Explains SMART KPIs, data collection/analysis, dashboards/variance/trends, corrective/preventive actions and the identification, documentation, storage/retrieval and dissemination of lessons learned."}
    ]
  }
]
$theory$::jsonb;
  v_item jsonb;
  v_qid uuid;
begin
  for v_item in select value from jsonb_array_elements(v_theory)
  loop
    v_qid := public.cipmn_mock_seed_uuid(
      'CIPMN-MOD-008:SOURCES-V1:THEORY:' || ((v_item->>'position')::integer-25)
    );

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
      'CIPMN-MOD-008 official PDF + PPTX; reviewed 2026-09-26',true
    );
  end loop;
end
$theory_insert$;

do $verify$
declare
  v_exam_id constant uuid := '2eec289b-9c0b-57e4-a2c6-e288fa6d4a28';
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

  if v_mcq<>25 then raise exception 'Expected 25 active Module 8 MCQs, found %.',v_mcq; end if;
  if v_theory<>5 then raise exception 'Expected 5 active Module 8 Theory questions, found %.',v_theory; end if;
  if v_keys<>25 then raise exception 'Expected 25 Module 8 answer keys, found %.',v_keys; end if;
  if v_options<>100 then raise exception 'Expected 100 active Module 8 MCQ options, found %.',v_options; end if;
  if v_rubrics<>5 then raise exception 'Expected 5 active Module 8 Theory rubrics, found %.',v_rubrics; end if;
  if v_bad_options<>0 then raise exception 'Found % Module 8 MCQ(s) with invalid/repeated options.',v_bad_options; end if;
  if v_bad_rubrics<>0 then raise exception 'Found % invalid Module 8 Theory rubric(s).',v_bad_rubrics; end if;
  if v_duplicate_texts<>0 then raise exception 'Found % repeated active Module 8 question text(s).',v_duplicate_texts; end if;
end
$verify$;

update public.examinations
set exam_format='cipmn_mixed',
    updated_at=now()
where id='2eec289b-9c0b-57e4-a2c6-e288fa6d4a28';

commit;

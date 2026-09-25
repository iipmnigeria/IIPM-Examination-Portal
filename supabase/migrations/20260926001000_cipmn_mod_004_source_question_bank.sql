begin;

-- CIPMN-MOD-004 assessment conversion and source-strict bank refresh.
-- Official assessment sources:
-- 1) CIPMN - MOD-004.pdf (Requirements Engineering in Project Management)
-- 2) CIPMN-MOD-004.pptx
-- Reviewed 2026-09-25.
-- Historical attempts, submitted answers, assignments and retired questions are preserved.

do $guard$
declare
  v_exam_id constant uuid := '5322572d-27b0-5467-ab89-c6b45612b960';
  v_live integer;
  v_format text;
  v_active integer;
  v_marker uuid := public.cipmn_mock_seed_uuid('CIPMN-MOD-004:SOURCES-V1:MCQ:1');
begin
  select exam_format into v_format
  from public.examinations
  where id=v_exam_id
  for update;

  if not found then
    raise exception 'CIPMN-MOD-004 examination not found.';
  end if;

  if v_format not in ('standard','cipmn_mixed') then
    raise exception 'Unexpected CIPMN-MOD-004 exam format: %',v_format;
  end if;

  if exists(select 1 from public.questions where id=v_marker and is_active) then
    raise exception 'CIPMN-MOD-004 source-aligned bank is already active; refresh aborted.';
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
    raise exception 'CIPMN-MOD-004 has % genuinely live examination session(s); conversion aborted.',v_live;
  end if;

  select count(*) into v_active
  from public.questions
  where examination_id=v_exam_id and is_active;

  if v_format='standard' and v_active<>75 then
    raise exception 'Expected 75 active legacy Module 4 questions, found %.',v_active;
  end if;
end
$guard$;

update public.questions
set is_active=false,
    position=position+9000,
    updated_at=now()
where examination_id='5322572d-27b0-5467-ab89-c6b45612b960'
  and is_active=true;

do $mcq_insert$
declare
  v_exam_id constant uuid := '5322572d-27b0-5467-ab89-c6b45612b960';
  v_mcqs jsonb := $mcq$
[
  {
    "position":1,
    "question":"A project team has collected many stakeholder statements but has not analyzed, documented, validated or managed them. Which statement best reflects the official Module 4 definition of Requirements Engineering?",
    "options":[
      "RE is an organized process of identifying, analyzing, documenting, validating and managing project needs and required functionalities.",
      "RE is only the activity of gathering initial stakeholder requests before planning begins.",
      "RE is a testing technique used only after the solution has been built.",
      "RE is a software tool used to store technical specifications."
    ],
    "correct":1
  },
  {
    "position":2,
    "question":"A sponsor complains that scope keeps expanding because stakeholder needs were poorly understood and not controlled. Which value of Requirements Engineering is most directly relevant?",
    "options":[
      "Aligning stakeholder needs with deliverables while reducing scope creep and costly rework.",
      "Replacing stakeholder involvement with automated documentation.",
      "Freezing every requirement permanently at project initiation.",
      "Moving all requirement decisions to the closure phase."
    ],
    "correct":1
  },
  {
    "position":3,
    "question":"A system must process payroll transactions and must also meet security, usability and performance expectations. How does the module distinguish these two types of requirements?",
    "options":[
      "Processing payroll is functional; security, usability and performance are non-functional.",
      "Processing payroll is non-functional; security and usability are functional.",
      "All four are functional because they relate to the same system.",
      "All four are non-functional because they describe quality."
    ],
    "correct":1
  },
  {
    "position":4,
    "question":"A project manager begins solution design by assuming what users want instead of discovering their real needs. Which elicitation best practice from the module is being violated?",
    "options":[
      "Prioritize listening over assuming, ask what and why, and involve cross-functional stakeholders early.",
      "Document requirements only after implementation is complete.",
      "Avoid stakeholder participation to prevent conflicting opinions.",
      "Use only technical staff because business users cannot define requirements."
    ],
    "correct":1
  },
  {
    "position":5,
    "question":"A Federal Government automation project needs to discover how different MDAs actually perform their current tasks. Which elicitation method is most directly suited to studying real user behaviour and work practices?",
    "options":[
      "Observation.",
      "MoSCoW prioritization.",
      "Traceability Matrix.",
      "Version control."
    ],
    "correct":1
  },
  {
    "position":6,
    "question":"Stakeholders cannot clearly describe a new user interface, so the team creates an early mock-up to help them react to a possible solution. Which elicitation method is being used?",
    "options":[
      "Prototyping.",
      "Root Cause Analysis.",
      "Impact Analysis.",
      "Peer Review."
    ],
    "correct":1
  },
  {
    "position":7,
    "question":"A requirements workshop produces 60 needs, but the budget cannot fund all of them. The team classifies each item as Must have, Should have, Could have or Won't have. Which analysis technique is this?",
    "options":[
      "MoSCoW prioritization.",
      "SWOT analysis.",
      "Use Case modelling.",
      "Verification walkthrough."
    ],
    "correct":1
  },
  {
    "position":8,
    "question":"Two stakeholders specify conflicting performance needs. Which Requirements Analysis objective should guide the team before documentation?",
    "options":[
      "Refine and prioritize the requirements, remove ambiguity/conflicts, and ensure they are clear and feasible.",
      "Record both statements unchanged and allow the implementation team to decide later.",
      "Skip analysis and move directly to validation after delivery.",
      "Treat the conflict as a documentation-format issue only."
    ],
    "correct":1
  },
  {
    "position":9,
    "question":"A team needs to model how users interact with a system and how information moves through it. Which pair of analysis techniques is expressly identified in the official materials?",
    "options":[
      "Use Cases and Data Flow Diagrams.",
      "Traceability Matrix and Version Control.",
      "Peer Reviews and Walkthroughs.",
      "SRS and BRD."
    ],
    "correct":1
  },
  {
    "position":10,
    "question":"A business team must record high-level business needs, while a software team needs a structured software requirements specification. Which pair of documentation formats best matches the module?",
    "options":[
      "BRD and SRS.",
      "SWOT and MoSCoW.",
      "ReqView and DOORS.",
      "Interview Guide and Focus Group."
    ],
    "correct":1
  },
  {
    "position":11,
    "question":"A documented requirement has several interpretations and no record of who approved the latest version. Which documentation best practices should be applied?",
    "options":[
      "Use simple unambiguous language, versioning, approval history and appropriate visuals.",
      "Use more technical jargon and remove version history.",
      "Keep requirements informal so stakeholders can interpret them flexibly.",
      "Avoid approval records because they slow collaboration."
    ],
    "correct":1
  },
  {
    "position":12,
    "question":"A regulatory change affects one requirement and may influence scope, cost and several linked deliverables. Which Requirements Management activity should happen before approving the change?",
    "options":[
      "Impact analysis supported by traceability.",
      "Brainstorming without reviewing existing requirements.",
      "Validation testing of the final product only.",
      "Replacing the baseline without recording the change."
    ],
    "correct":1
  },
  {
    "position":13,
    "question":"A project cannot show which final deliverable satisfies a particular approved requirement. Which management tool is designed to maintain that connection?",
    "options":[
      "Requirements Traceability Matrix.",
      "SWOT Analysis.",
      "Focus Group.",
      "Product Prototype."
    ],
    "correct":1
  },
  {
    "position":14,
    "question":"Several team members are unknowingly working from different versions of the same requirement. Which Requirements Management control most directly addresses the problem?",
    "options":[
      "Version control.",
      "Observation.",
      "Root Cause Analysis.",
      "Validation by end users only."
    ],
    "correct":1
  },
  {
    "position":15,
    "question":"The team confirms that a solution has been implemented according to the documented specification, but users later say it solves the wrong problem. Which statement best explains the failure?",
    "options":[
      "Verification may have succeeded, but validation failed because the team did not confirm it was building the right product.",
      "Validation succeeded because the specification was followed exactly.",
      "Verification and validation are identical, so both succeeded.",
      "The failure proves documentation is unnecessary."
    ],
    "correct":1
  },
  {
    "position":16,
    "question":"Which option contains only methods listed in the official materials for Verification & Validation?",
    "options":[
      "Peer reviews, walkthroughs, prototypes and test-case reviews.",
      "MoSCoW, SWOT, interviews and version control.",
      "SRS, BRD, product backlog and traceability matrix.",
      "Focus groups, brainstorming, Jira and Confluence."
    ],
    "correct":1
  },
  {
    "position":17,
    "question":"A large compliance-sensitive project requires advanced traceability, while a smaller team wants a lightweight tool with traceability support. Which tool pairing best matches the module?",
    "options":[
      "IBM DOORS for advanced traceability/compliance and ReqView for lightweight traceability.",
      "Figma for advanced traceability/compliance and Zoom for lightweight traceability.",
      "MS Word for advanced traceability/compliance and Balsamiq for lightweight traceability.",
      "SWOT for advanced traceability/compliance and MoSCoW for lightweight traceability."
    ],
    "correct":1
  },
  {
    "position":18,
    "question":"A team needs process-flow visualizations during requirements analysis and early UI wireframes during elicitation/design discussion. Which tool pairing is best supported by the materials?",
    "options":[
      "Lucidchart/Visio for flowcharts and process modelling; Balsamiq/Figma for wireframing and prototyping.",
      "IBM DOORS for flowcharts; ReqView for user-interface design.",
      "Jira for flowcharts; SWOT for wireframing.",
      "Confluence for process simulation; MoSCoW for prototyping."
    ],
    "correct":1
  },
  {
    "position":19,
    "question":"Which sequence correctly represents the five core RE pillars as a structured process in the module?",
    "options":[
      "Elicitation → Analysis → Documentation → Management → Verification & Validation.",
      "Analysis → Elicitation → Management → Documentation → Verification & Validation.",
      "Documentation → Verification & Validation → Elicitation → Analysis → Management.",
      "Management → Documentation → Analysis → Elicitation → Verification & Validation."
    ],
    "correct":1
  },
  {
    "position":20,
    "question":"A sponsor wants evidence that RE contributes to business value rather than merely producing documents. Which outcome is most consistent with the module's value proposition?",
    "options":[
      "Clear scope, validated needs, reduced rework, stakeholder trust, better ROI and measurable success.",
      "More requirements documents regardless of whether needs are validated.",
      "Permanent elimination of all project changes after initiation.",
      "Greater technical detail with less stakeholder participation."
    ],
    "correct":1
  },
  {
    "position":21,
    "question":"Which group best represents stakeholder pains identified in the Module 4 Value Proposition Canvas?",
    "options":[
      "Scope creep, unclear requirements, rework, misalignment and lack of traceability.",
      "Clear scope, measurable success, stakeholder trust and better ROI.",
      "Agility, collaboration, user-driven outcomes and faster delivery.",
      "Technical specifications, baseline scope and traceability matrices."
    ],
    "correct":1
  },
  {
    "position":22,
    "question":"Which option correctly matches the project offerings and pain relievers described in the Value Proposition Canvas?",
    "options":[
      "Requirements documents/traceability/baseline scope are project products; elicitation, analysis, change control, validation and stakeholder engagement are pain relievers.",
      "Stakeholder pains are project products; requirements documents are pain relievers.",
      "Version control and approval history are stakeholder gains only and never project products.",
      "Scope creep and rework are gain creators because they reveal changing needs."
    ],
    "correct":1
  },
  {
    "position":23,
    "question":"A project team treats Requirements Engineering as a one-time activity completed during initiation. Which correction is supported by the official PDF?",
    "options":[
      "RE is a continuous process throughout the project lifecycle, not a one-time event.",
      "RE ends after elicitation because later changes should be rejected.",
      "RE should begin only after implementation starts.",
      "RE applies only to software and ends when the SRS is signed."
    ],
    "correct":1
  },
  {
    "position":24,
    "question":"A team delivers exactly what was written, but the approved requirements were based on assumptions because users were not involved early. Which combination of RE practices would most directly reduce this risk?",
    "options":[
      "Early stakeholder elicitation, structured analysis, validation and continuous traceability.",
      "More detailed coding standards and fewer stakeholder conversations.",
      "Later documentation with no baseline or version history.",
      "Skipping analysis so that development begins faster."
    ],
    "correct":1
  },
  {
    "position":25,
    "question":"A change request proposes a new feature that stakeholders like, but it is not linked to validated business needs and may expand scope significantly. Which response best applies the Module 4 approach?",
    "options":[
      "Perform impact analysis, check traceability and value alignment, control the change, and update the approved requirement baseline if accepted.",
      "Accept the feature immediately because stakeholder interest overrides scope control.",
      "Reject every change automatically because Requirements Management prevents change.",
      "Implement first and document the requirement after deployment."
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
      'CIPMN-MOD-004:SOURCES-V1:MCQ:' || (v_item->>'position')
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
      raise exception 'No correct option resolved for Module 4 MCQ position %.',v_item->>'position';
    end if;

    insert into public.question_answer_keys(question_id,correct_option_id)
    values(v_qid,v_correct_id);
  end loop;
end
$mcq_insert$;

do $theory_insert$
declare
  v_exam_id constant uuid := '5322572d-27b0-5467-ab89-c6b45612b960';
  v_theory jsonb := $theory$
[
  {
    "position":26,
    "question":"A Federal Government digital-transformation project begins with conflicting stakeholder expectations, unclear scope and assumptions about user needs. Using only the official Module 4 materials: (a) define Requirements Engineering and explain its value to project outcomes; (b) describe the five RE pillars in order; (c) recommend suitable elicitation methods and best practices for discovering true needs; (d) explain how functional and non-functional requirements should be distinguished during analysis; and (e) explain how strong RE reduces scope creep, rework and misalignment while improving stakeholder trust.",
    "criteria":[
      {"name":"RE definition and value","marks":2,"expected":"Defines RE as the organized process of identifying, analyzing, documenting, validating and managing project needs/functions, and links it to alignment, scope clarity, reduced rework and project value."},
      {"name":"Five pillars","marks":2,"expected":"Correctly presents Elicitation, Analysis, Documentation, Management, and Verification & Validation in the official sequence."},
      {"name":"Elicitation","marks":2,"expected":"Uses official methods such as interviews, focus groups, brainstorming, observation or prototyping and best practices such as asking what/why, early cross-functional involvement and listening over assuming."},
      {"name":"Functional vs non-functional","marks":2,"expected":"Explains functional requirements as what the system/project should do and non-functional requirements as how it should perform, including qualities such as performance, usability or security."},
      {"name":"Value and risk reduction","marks":2,"expected":"Explains how early clarity and stakeholder alignment reduce scope creep, rework, delay, misalignment and lack of traceability while improving trust/satisfaction."}
    ]
  },
  {
    "position":27,
    "question":"A refinery-upgrade programme has gathered many requirements, some of which conflict, overlap or lack priority. Using only Module 4: (a) explain the purpose of Requirements Analysis; (b) show how MoSCoW, SWOT and Root Cause Analysis can support analysis; (c) explain how Use Cases and DFDs can be used; (d) describe the characteristics of a good analyzed requirement; and (e) explain how analysis should help prevent gold-plating, ambiguity and scope problems before documentation.",
    "criteria":[
      {"name":"Analysis purpose","marks":2,"expected":"Explains analysis as refining, classifying and prioritizing gathered requirements, removing ambiguity/conflicts and producing clear feasible requirements."},
      {"name":"Analysis techniques","marks":2,"expected":"Accurately explains MoSCoW prioritization, SWOT and Root Cause Analysis within the scope of the official materials."},
      {"name":"Models","marks":2,"expected":"Explains Use Cases and DFDs as techniques for modelling user/system interactions, workflows or data movement."},
      {"name":"Quality of requirements","marks":2,"expected":"Emphasizes clarity, feasibility, classification into functional/non-functional needs and resolution of conflicts/ambiguity."},
      {"name":"Scope/value control","marks":2,"expected":"Explains how prioritization and structured analysis reduce uncontrolled scope growth/gold-plating and ensure requirements remain tied to real needs."}
    ]
  },
  {
    "position":28,
    "question":"A state e-procurement project has approved requirements, but teams are using inconsistent documents and several changes have been introduced without clear history. Using only Module 4: (a) compare SRS, BRD and Product Backlog as documentation formats; (b) identify documentation best practices; (c) explain the goals and activities of Requirements Management; (d) explain how a Traceability Matrix, version control and impact analysis should be used together; and (e) recommend suitable tools from those listed in the materials for collaborative documentation and traceability.",
    "criteria":[
      {"name":"Documentation formats","marks":2,"expected":"Distinguishes SRS, BRD and Product Backlog as official requirement-documentation formats, including Product Backlog use in Agile contexts."},
      {"name":"Documentation best practices","marks":2,"expected":"Uses simple/unambiguous language, versioning, approval history and appropriate visuals/structured formats."},
      {"name":"Management purpose and activities","marks":2,"expected":"Explains traceability, version control, change management and impact analysis as Requirements Management activities that maintain requirement integrity/alignment."},
      {"name":"Traceability and change","marks":2,"expected":"Explains how a Traceability Matrix links requirements to deliverables, version control preserves approved states, and impact analysis evaluates consequences before changes are accepted."},
      {"name":"Tools","marks":2,"expected":"Recommends source-listed tools appropriately, such as Jira/Confluence for collaborative documentation, IBM DOORS for advanced traceability/compliance, ReqView/Jama/Jira for management, or Lucidchart/Visio for modelling."}
    ]
  },
  {
    "position":29,
    "question":"A mobile banking solution passes a peer review against its documented specification, yet pilot users say it does not solve their real problem. Using only Module 4: (a) distinguish Verification from Validation using the module's two guiding questions; (b) explain why the project can pass verification but fail validation; (c) identify appropriate V&V methods from the materials; (d) explain how V&V should connect back to original requirements and traceability; and (e) explain how effective V&V supports stakeholder confidence and satisfaction.",
    "criteria":[
      {"name":"Verification vs Validation","marks":2,"expected":"States Verification as 'Are we building the product right?' and Validation as 'Are we building the right product?'."},
      {"name":"Failure diagnosis","marks":2,"expected":"Explains that conformance to the specification can satisfy verification while failure to meet actual user needs causes validation failure."},
      {"name":"Methods","marks":2,"expected":"Uses source-listed V&V methods such as peer reviews, walkthroughs, prototypes and test-case reviews/pilot use where supported."},
      {"name":"Traceability","marks":2,"expected":"Explains that V&V should confirm implementation against original/approved requirements and traceable stakeholder needs."},
      {"name":"Stakeholder confidence","marks":2,"expected":"Links successful V&V to confirmed implementation, better quality, trust, reduced rework/conflict and stakeholder satisfaction."}
    ]
  },
  {
    "position":30,
    "question":"A large Nigerian infrastructure-and-digital project is suffering from scope creep, rework, weak traceability and stakeholder distrust. Using the Module 4 Value Proposition framework: (a) identify major stakeholder pains and desired gains; (b) identify project products created through good RE; (c) explain how the five RE pillars act as pain relievers; (d) explain the gain creators associated with strong RE; and (e) show how the full RE process should align requirements with business strategy, compliance, measurable success and stakeholder satisfaction throughout the project lifecycle.",
    "criteria":[
      {"name":"Stakeholder pains and gains","marks":2,"expected":"Identifies official pains such as scope creep, unclear/changing requirements, rework, misalignment and lack of traceability, and gains such as clear validated scope, better ROI, trust, transparency and measurable success."},
      {"name":"Project products","marks":2,"expected":"Identifies outputs such as requirements documents, traceability matrix, baseline scope, technical specifications, documented stakeholder/business requirements or final deliverables reflecting validated needs."},
      {"name":"Pain relievers","marks":2,"expected":"Explains elicitation, analysis/prioritization, change control, validation, stakeholder engagement and traceability as means of reducing project/stakeholder pains."},
      {"name":"Gain creators","marks":2,"expected":"Uses source-supported gain creators such as agility, faster delivery, improved collaboration, defined success, user-driven outcomes, clearer design/testing and stronger coordination/trust."},
      {"name":"Strategic value alignment","marks":2,"expected":"Shows how continuous RE aligns needs and deliverables with business strategy, compliance, digital enablement/automation, validated value and stakeholder satisfaction across the lifecycle."}
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
      'CIPMN-MOD-004:SOURCES-V1:THEORY:' || ((v_item->>'position')::integer-25)
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
      'CIPMN-MOD-004 official PDF + PPTX; reviewed 2026-09-25',true
    );
  end loop;
end
$theory_insert$;

do $verify$
declare
  v_exam_id constant uuid := '5322572d-27b0-5467-ab89-c6b45612b960';
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

  if v_mcq<>25 then raise exception 'Expected 25 active Module 4 MCQs, found %.',v_mcq; end if;
  if v_theory<>5 then raise exception 'Expected 5 active Module 4 Theory questions, found %.',v_theory; end if;
  if v_keys<>25 then raise exception 'Expected 25 Module 4 answer keys, found %.',v_keys; end if;
  if v_options<>100 then raise exception 'Expected 100 active Module 4 MCQ options, found %.',v_options; end if;
  if v_rubrics<>5 then raise exception 'Expected 5 active Module 4 Theory rubrics, found %.',v_rubrics; end if;
  if v_bad_options<>0 then raise exception 'Found % Module 4 MCQ(s) with invalid/repeated options.',v_bad_options; end if;
  if v_bad_rubrics<>0 then raise exception 'Found % invalid Module 4 Theory rubric(s).',v_bad_rubrics; end if;
  if v_duplicate_texts<>0 then raise exception 'Found % repeated active Module 4 question text(s).',v_duplicate_texts; end if;
end
$verify$;

update public.examinations
set exam_format='cipmn_mixed',
    updated_at=now()
where id='5322572d-27b0-5467-ab89-c6b45612b960';

commit;

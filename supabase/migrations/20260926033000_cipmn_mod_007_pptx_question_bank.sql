begin;

-- CIPMN-MOD-007 assessment conversion and source-strict bank refresh.
-- Sole official assessment source:
-- CIPMN-MOD-007.pptx (Project Scope and Change Management; 74 slides; reviewed 2026-09-26).
-- Historical attempts, submitted answers, assignments and retired questions are preserved.

do $guard$
declare
  v_exam_id constant uuid := 'a573f28c-a38a-5978-a6a9-42b1d8239935';
  v_live integer;
  v_format text;
  v_active integer;
  v_marker uuid := public.cipmn_mock_seed_uuid('CIPMN-MOD-007:PPTX-V1:MCQ:1');
begin
  select exam_format into v_format
  from public.examinations
  where id=v_exam_id
  for update;

  if not found then
    raise exception 'CIPMN-MOD-007 examination not found.';
  end if;

  if v_format not in ('standard','cipmn_mixed') then
    raise exception 'Unexpected CIPMN-MOD-007 exam format: %',v_format;
  end if;

  if exists(select 1 from public.questions where id=v_marker and is_active) then
    raise exception 'CIPMN-MOD-007 PPTX-aligned bank is already active; refresh aborted.';
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
    raise exception 'CIPMN-MOD-007 has % genuinely live examination session(s); conversion aborted.',v_live;
  end if;

  select count(*) into v_active
  from public.questions
  where examination_id=v_exam_id and is_active;

  if v_format='standard' and v_active<>75 then
    raise exception 'Expected 75 active legacy Module 7 questions, found %.',v_active;
  end if;
end
$guard$;

update public.questions
set is_active=false,
    position=position+15000,
    updated_at=now()
where examination_id='a573f28c-a38a-5978-a6a9-42b1d8239935'
  and is_active=true;

do $mcq_insert$
declare
  v_exam_id constant uuid := 'a573f28c-a38a-5978-a6a9-42b1d8239935';
  v_mcqs jsonb := $mcq$
[
  {
    "position":1,
    "question":"Which statement best defines Project Scope Management in Module 7?",
    "options":[
      "Ensuring the project includes all the work required, and only the work required, to complete the project successfully.",
      "Managing only the final product features after delivery.",
      "Controlling schedule without reference to scope.",
      "Approving every stakeholder request to maximize satisfaction."
    ],
    "correct":1
  },
  {
    "position":2,
    "question":"Which distinction between project scope and product scope is supported by the deck?",
    "options":[
      "Project scope is the work needed to deliver the result; product scope is the features and functions of that result.",
      "Project scope concerns only cost; product scope concerns only schedule.",
      "Project scope is validated by customers while product scope is managed only by the PM.",
      "They are identical concepts documented in the same way."
    ],
    "correct":1
  },
  {
    "position":3,
    "question":"Which three elements together make up the Scope Baseline in Module 7?",
    "options":[
      "Approved scope statement, WBS, and WBS dictionary.",
      "Project charter, issue log, and stakeholder register.",
      "Requirements plan, change request form, and lessons learned log.",
      "Budget, schedule, and quality plan."
    ],
    "correct":1
  },
  {
    "position":4,
    "question":"A project manager is helping stakeholders define requirements, balancing competing interests, and leading structured workshops. Which PM role is being demonstrated?",
    "options":[
      "Facilitator.",
      "Guardian.",
      "Integrator.",
      "Auditor."
    ],
    "correct":1
  },
  {
    "position":5,
    "question":"A project manager refuses an unapproved feature request because it would undermine the approved scope baseline. Which PM role best fits this behavior?",
    "options":[
      "Guardian.",
      "Communicator.",
      "Facilitator.",
      "Sponsor."
    ],
    "correct":1
  },
  {
    "position":6,
    "question":"A project manager updates schedule and cost baselines after an approved scope change. Which PM role is most directly being performed?",
    "options":[
      "Integrator.",
      "Facilitator.",
      "Guardian.",
      "Customer."
    ],
    "correct":1
  },
  {
    "position":7,
    "question":"Which situation is the clearest example of scope creep as defined in Module 7?",
    "options":[
      "Additional functionality is added without corresponding adjustments to time, cost, or resources.",
      "A formally approved change is evaluated and re-baselined.",
      "A requirement is clarified before approval.",
      "A stakeholder signs off the scope statement."
    ],
    "correct":1
  },
  {
    "position":8,
    "question":"Which pair is identified in the deck as common scope threats in Nigerian projects?",
    "options":[
      "Feature creep and requirement volatility.",
      "Cost variance and earned value.",
      "Procurement fraud and tax exposure.",
      "Cash flow and inflation indexing."
    ],
    "correct":1
  },
  {
    "position":9,
    "question":"Which proactive measure helps prevent scope creep by separating essential from optional requirements?",
    "options":[
      "MoSCoW prioritization.",
      "Critical Path Method.",
      "Monte Carlo Simulation.",
      "Earned Value Analysis."
    ],
    "correct":1
  },
  {
    "position":10,
    "question":"A legitimate change must be accommodated after the baseline has been approved. Which reactive scope-control action is specifically supported by the deck?",
    "options":[
      "Perform impact analysis and formally re-baseline if the change is approved.",
      "Implement immediately and update documentation later.",
      "Reject all changes once the baseline exists.",
      "Ignore resource implications if the sponsor supports the change."
    ],
    "correct":1
  },
  {
    "position":11,
    "question":"Which requirements-gathering technique is best described as one-on-one discussion to elicit detailed requirements?",
    "options":[
      "Interviews.",
      "Brainstorming.",
      "Observation.",
      "Prototyping."
    ],
    "correct":1
  },
  {
    "position":12,
    "question":"Which technique is most appropriate when the team needs to observe users in their natural working environment?",
    "options":[
      "Observation.",
      "Focus Group.",
      "Questionnaire.",
      "Document Analysis."
    ],
    "correct":1
  },
  {
    "position":13,
    "question":"Which statement best describes the role of a Scope Statement in Module 7?",
    "options":[
      "It details project boundaries and creates shared understanding of what will and will not be delivered.",
      "It replaces the WBS and requirements documentation.",
      "It is used only after project closure.",
      "It documents only product features."
    ],
    "correct":1
  },
  {
    "position":14,
    "question":"How does the deck define a Work Breakdown Structure?",
    "options":[
      "A hierarchical decomposition of the total project scope into smaller manageable components.",
      "A list of approved changes only.",
      "A stakeholder influence matrix.",
      "A schedule compression tool."
    ],
    "correct":1
  },
  {
    "position":15,
    "question":"What is the purpose of the WBS Dictionary according to Module 7?",
    "options":[
      "To provide detailed descriptions of each WBS component.",
      "To approve project changes.",
      "To classify stakeholder resistance.",
      "To replace the Scope Statement."
    ],
    "correct":1
  },
  {
    "position":16,
    "question":"Which monitoring technique helps determine the cause and degree of difference between the baseline and actual performance?",
    "options":[
      "Variance Analysis.",
      "PESTLE Analysis.",
      "Brainstorming.",
      "Prototyping."
    ],
    "correct":1
  },
  {
    "position":17,
    "question":"What is the primary function of performance reporting in scope monitoring?",
    "options":[
      "To identify deviations early through regular status and progress reporting.",
      "To replace formal change control.",
      "To eliminate stakeholder communication.",
      "To approve changes automatically."
    ],
    "correct":1
  },
  {
    "position":18,
    "question":"Which item belongs in the impact-analysis section of a formal change request form?",
    "options":[
      "Impact on scope, schedule, cost, quality, other constraints, and risk.",
      "Only the requester’s personal opinion.",
      "Only the final implementation date.",
      "Only the sponsor’s signature."
    ],
    "correct":1
  },
  {
    "position":19,
    "question":"Which statement best describes the Change Control Board (CCB)?",
    "options":[
      "A formal stakeholder group that reviews, evaluates, approves, delays, or rejects proposed changes.",
      "A team that implements every change request automatically.",
      "A project team subgroup responsible only for documentation.",
      "A committee used only after project closure."
    ],
    "correct":1
  },
  {
    "position":20,
    "question":"Which principle is emphasized when controlling approved scope changes?",
    "options":[
      "Changes must be integrated across scope, schedule, cost, and other relevant constraints.",
      "Only scope documentation should change.",
      "Approved changes should not affect baselines.",
      "Schedule and cost impacts can be ignored if the change adds value."
    ],
    "correct":1
  },
  {
    "position":21,
    "question":"According to Module 7, what does Change Management primarily address?",
    "options":[
      "The human element of change by preparing, equipping, and supporting people to adopt change.",
      "Only technical configuration control.",
      "Only financial approval of scope changes.",
      "Only the project schedule."
    ],
    "correct":1
  },
  {
    "position":22,
    "question":"Which four aspects are highlighted as key dimensions of change management in the deck?",
    "options":[
      "People, Process, Technology, and Culture.",
      "Scope, Cost, Time, and Procurement.",
      "Risk, Quality, Audit, and Compliance.",
      "Governance, Finance, Logistics, and Security."
    ],
    "correct":1
  },
  {
    "position":23,
    "question":"Which framework in Module 7 is used to consider Political, Economic, Social, Technological, Legal, and Environmental factors?",
    "options":[
      "PESTLE Analysis.",
      "WBS.",
      "MoSCoW.",
      "Variance Analysis."
    ],
    "correct":1
  },
  {
    "position":24,
    "question":"Which set of actions is directly supported by the deck for managing resistance to change?",
    "options":[
      "Education, participation, facilitation, and negotiation.",
      "Crashing, fast-tracking, leveling, and smoothing.",
      "Avoid, mitigate, transfer, and accept.",
      "Exploit, enhance, share, and accept."
    ],
    "correct":1
  },
  {
    "position":25,
    "question":"In the Community Borehole case, a new government directive requires a solar-powered purification system that was not in the original scope. What is the most source-consistent response?",
    "options":[
      "Treat it as a formal change, analyze its impacts, route it through change control, and update baselines if approved.",
      "Ignore it because the original scope was already approved.",
      "Implement it immediately without documenting cost or schedule impact.",
      "Reject it automatically because changes are prohibited after baselining."
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
      'CIPMN-MOD-007:PPTX-V1:MCQ:' || (v_item->>'position')
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
      raise exception 'No correct option resolved for Module 7 MCQ position %.',v_item->>'position';
    end if;

    insert into public.question_answer_keys(question_id,correct_option_id)
    values(v_qid,v_correct_id);
  end loop;
end
$mcq_insert$;

do $theory_insert$
declare
  v_exam_id constant uuid := 'a573f28c-a38a-5978-a6a9-42b1d8239935';
  v_theory jsonb := $theory$
[
  {
    "position":26,
    "question":"Using only Module 7: (a) define Project Scope Management, Project Scope, Product Scope and Scope Baseline; (b) explain the Project Management Triangle relationship presented in the deck; (c) explain why effective scope management matters; (d) compare project scope and product scope; and (e) explain the Project Manager's four scope-management roles.",
    "criteria":[
      {"name":"Core definitions","marks":2,"expected":"Accurately defines Project Scope Management, Project Scope, Product Scope and Scope Baseline using deck terminology."},
      {"name":"Triangle relationship","marks":2,"expected":"Explains the Scope-Time-Cost triangle with Quality in the center and that uncontrolled scope affects the other elements."},
      {"name":"Importance of scope management","marks":2,"expected":"Explains foundation for success, resource optimization, prevention of scope creep and stakeholder alignment."},
      {"name":"Project vs product scope","marks":2,"expected":"Contrasts work/how the project is executed with features/functions/what is delivered, including documentation and validation distinctions supported by the deck."},
      {"name":"PM roles","marks":2,"expected":"Explains facilitator, guardian, communicator and integrator roles and how they protect scope integrity."}
    ]
  },
  {
    "position":27,
    "question":"A project has vague requirements and repeated stakeholder additions. Using only Module 7: (a) explain what scope creep is and its characteristics; (b) identify common scope threats; (c) explain proactive prevention strategies including MoSCoW; (d) explain reactive strategies when scope creep occurs; and (e) discuss the specific Nigerian-context factors highlighted in the deck.",
    "criteria":[
      {"name":"Scope creep definition","marks":2,"expected":"Defines uncontrolled expansion without corresponding time, cost and resource adjustments and describes gradual/subtle additions and lack of formal control."},
      {"name":"Common threats","marks":2,"expected":"Identifies source-supported threats such as feature creep, requirement volatility, gold plating, regulatory changes and scope ambiguity."},
      {"name":"Proactive prevention","marks":2,"expected":"Explains clear scope definition, stakeholder engagement/formal sign-off, MoSCoW prioritization and formal change control."},
      {"name":"Reactive response","marks":2,"expected":"Explains impact analysis, trade-offs, re-baselining and communication after legitimate change pressure occurs."},
      {"name":"Nigerian context","marks":2,"expected":"Explains evolving stakeholder expectations, dynamic regulation, resource constraints, socio-economic/cultural factors, and the deck's change-buffer concept."}
    ]
  },
  {
    "position":28,
    "question":"Using only Module 7: (a) explain why requirements gathering is important; (b) compare at least six requirements-gathering techniques from the deck; (c) explain the purpose of the Requirements Management Plan and Requirements Traceability Matrix at the level supported by the deck; (d) explain the Scope Statement, WBS and WBS Dictionary; and (e) explain what baselining means for future scope changes.",
    "criteria":[
      {"name":"Requirements importance","marks":2,"expected":"Explains that thorough requirements gathering helps deliver what stakeholders truly need and supports accurate scope definition."},
      {"name":"Gathering techniques","marks":2,"expected":"Accurately compares source-listed methods such as interviews, workshops, brainstorming, focus groups, questionnaires/surveys, prototyping, observation and document analysis."},
      {"name":"Requirements tools","marks":2,"expected":"Explains the Requirements Management Plan as guiding requirement handling and recognizes the Traceability Matrix as a requirements-management tool shown in the deck without inventing unsupported detail."},
      {"name":"Scope definition tools","marks":2,"expected":"Explains Scope Statement as defining boundaries, WBS as hierarchical decomposition by decomposition, and WBS Dictionary as detailed descriptions of WBS components."},
      {"name":"Baselining","marks":2,"expected":"Explains that once scope is baselined, modifications require formal change control."}
    ]
  },
  {
    "position":29,
    "question":"A significant scope change is requested after baselining. Using only Module 7: (a) explain monitoring and controlling of project/product scope; (b) explain performance reporting and variance analysis; (c) describe the formal change control process; (d) identify the key information required in a Change Request Form; and (e) explain the role of the Change Control Board and integrated baseline updates.",
    "criteria":[
      {"name":"Monitoring and control","marks":2,"expected":"Explains tracking project/product scope and ensuring requested changes and corrective/preventive actions go through formal change control."},
      {"name":"Reporting and variance","marks":2,"expected":"Explains performance reporting for early detection and variance analysis for cause/degree of difference between baseline and actual performance."},
      {"name":"Formal change control","marks":2,"expected":"Explains documentation, evaluation, approval/rejection/deferment and communication of changes."},
      {"name":"Change Request Form","marks":2,"expected":"Includes request information, detailed description/business case, impact analysis across scope/schedule/cost/quality/risk, and decision/approval information."},
      {"name":"CCB and integration","marks":2,"expected":"Explains CCB review/evaluation/approval-delay-rejection role and integration of approved scope changes across schedule, cost and other baselines."}
    ]
  },
  {
    "position":30,
    "question":"A project is experiencing resistance to a major transition. Using only Module 7: (a) explain why change management is necessary; (b) describe the four change-management aspects highlighted in the deck; (c) explain how PESTLE helps analyze external drivers of change; (d) explain the role of communication, stakeholder engagement and resistance management; and (e) apply these ideas to the Community Borehole scenario in the deck.",
    "criteria":[
      {"name":"Why change management","marks":2,"expected":"Explains preventing chaos, supporting project success and achieving stakeholder buy-in, while avoiding delay, cost overrun, dissatisfaction or failure."},
      {"name":"Four aspects","marks":2,"expected":"Explains People, Process, Technology and Culture as the deck's key aspects of change management."},
      {"name":"PESTLE","marks":2,"expected":"Correctly expands Political, Economic, Social, Technological, Legal and Environmental and explains its use for external factors driving change."},
      {"name":"Engagement and resistance","marks":2,"expected":"Explains multi-channel communication, active stakeholder involvement, resistance assessment/engagement strategy, education, participation, facilitation, negotiation, tracking and training interventions."},
      {"name":"Case application","marks":2,"expected":"Applies formal change control to the government solar-purification requirement, stakeholder engagement to the elder/community, and resistance management to villagers reluctant to adopt the borehole."}
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
      'CIPMN-MOD-007:PPTX-V1:THEORY:' || ((v_item->>'position')::integer-25)
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
      'CIPMN-MOD-007.pptx (74 slides; reviewed 2026-09-26)',true
    );
  end loop;
end
$theory_insert$;

do $verify$
declare
  v_exam_id constant uuid := 'a573f28c-a38a-5978-a6a9-42b1d8239935';
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

  if v_mcq<>25 then raise exception 'Expected 25 active Module 7 MCQs, found %.',v_mcq; end if;
  if v_theory<>5 then raise exception 'Expected 5 active Module 7 Theory questions, found %.',v_theory; end if;
  if v_keys<>25 then raise exception 'Expected 25 Module 7 answer keys, found %.',v_keys; end if;
  if v_options<>100 then raise exception 'Expected 100 active Module 7 MCQ options, found %.',v_options; end if;
  if v_rubrics<>5 then raise exception 'Expected 5 active Module 7 Theory rubrics, found %.',v_rubrics; end if;
  if v_bad_options<>0 then raise exception 'Found % Module 7 MCQ(s) with invalid/repeated options.',v_bad_options; end if;
  if v_bad_rubrics<>0 then raise exception 'Found % invalid Module 7 Theory rubric(s).',v_bad_rubrics; end if;
  if v_duplicate_texts<>0 then raise exception 'Found % repeated active Module 7 question text(s).',v_duplicate_texts; end if;
end
$verify$;

update public.examinations
set exam_format='cipmn_mixed',
    updated_at=now()
where id='a573f28c-a38a-5978-a6a9-42b1d8239935';

commit;

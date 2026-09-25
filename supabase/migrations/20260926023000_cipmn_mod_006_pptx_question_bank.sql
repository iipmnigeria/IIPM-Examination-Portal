begin;

-- CIPMN-MOD-006 assessment conversion and source-strict bank refresh.
-- Sole official assessment source:
-- CIPMN-MOD-006.pptx (Project Planning and Scheduling; 22 slides; reviewed 2026-09-26).
-- Historical attempts, submitted answers, assignments and retired questions are preserved.

do $guard$
declare
  v_exam_id constant uuid := '63311ad6-4bc2-59b6-a5fd-283423c4a2ac';
  v_live integer;
  v_format text;
  v_active integer;
  v_marker uuid := public.cipmn_mock_seed_uuid('CIPMN-MOD-006:PPTX-V1:MCQ:1');
begin
  select exam_format into v_format
  from public.examinations
  where id=v_exam_id
  for update;

  if not found then
    raise exception 'CIPMN-MOD-006 examination not found.';
  end if;

  if v_format not in ('standard','cipmn_mixed') then
    raise exception 'Unexpected CIPMN-MOD-006 exam format: %',v_format;
  end if;

  if exists(select 1 from public.questions where id=v_marker and is_active) then
    raise exception 'CIPMN-MOD-006 PPTX-aligned bank is already active; refresh aborted.';
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
    raise exception 'CIPMN-MOD-006 has % genuinely live examination session(s); conversion aborted.',v_live;
  end if;

  select count(*) into v_active
  from public.questions
  where examination_id=v_exam_id and is_active;

  if v_format='standard' and v_active<>75 then
    raise exception 'Expected 75 active legacy Module 6 questions, found %.',v_active;
  end if;
end
$guard$;

update public.questions
set is_active=false,
    position=position+13000,
    updated_at=now()
where examination_id='63311ad6-4bc2-59b6-a5fd-283423c4a2ac'
  and is_active=true;

do $mcq_insert$
declare
  v_exam_id constant uuid := '63311ad6-4bc2-59b6-a5fd-283423c4a2ac';
  v_mcqs jsonb := $mcq$
[
  {
    "position":1,
    "question":"A project team knows what deliverables must be produced but has not yet determined when activities should occur or in what sequence. Which statement best distinguishes planning from scheduling in Module 6?",
    "options":[
      "Planning defines what needs to be done and how; scheduling determines when and in what order tasks are completed.",
      "Planning determines only dates; scheduling defines scope and deliverables.",
      "Planning and scheduling are identical because both produce a Gantt chart.",
      "Scheduling is performed before scope and deliverables are defined."
    ],
    "correct":1
  },
  {
    "position":2,
    "question":"Which combination is identified as part of planning rather than scheduling?",
    "options":[
      "Arrange tasks over time and visualize them with CPM only.",
      "Define scope, goals and deliverables; allocate resources; estimate costs; set risk-management strategies.",
      "Calculate only ES, EF, LS and LF.",
      "Fast-track every activity to shorten the timeline."
    ],
    "correct":2
  },
  {
    "position":3,
    "question":"A project manager wants a document that answers who, what, when, how and how much for the project. Which concept from the deck best matches this need?",
    "options":[
      "Project planning.",
      "Critical Path Method.",
      "Resource leveling.",
      "Fast-tracking."
    ],
    "correct":1
  },
  {
    "position":4,
    "question":"Which item is listed as a component of a project plan in the Module 6 deck?",
    "options":[
      "Issue Escalation Matrix.",
      "Project Objectives.",
      "Benefits Realization Register.",
      "Procurement Audit Plan."
    ],
    "correct":2
  },
  {
    "position":5,
    "question":"Which option correctly pairs a planning input with a planning output from the official deck?",
    "options":[
      "Project Charter → WBS.",
      "Gantt Chart → Stakeholder Requirements.",
      "Network Diagram → Constraints and Assumptions.",
      "Schedule Baseline → Lessons Learned."
    ],
    "correct":1
  },
  {
    "position":6,
    "question":"A sponsor asks who should participate in planning. Which group is expressly listed in Module 6?",
    "options":[
      "Project Manager, Project Team, Functional Managers, Sponsors, and Customers/Clients.",
      "Only the Project Manager and Sponsor.",
      "Only customers and regulators.",
      "Only Functional Managers and vendors."
    ],
    "correct":1
  },
  {
    "position":7,
    "question":"A team needs to decompose project scope into manageable work packages that can support scheduling and control. Which tool should it use?",
    "options":[
      "Gantt Chart.",
      "Work Breakdown Structure.",
      "PERT.",
      "Resource Leveling."
    ],
    "correct":2
  },
  {
    "position":8,
    "question":"Which statement best describes a milestone in the Module 6 materials?",
    "options":[
      "A recurring operational task.",
      "A major checkpoint in the project.",
      "A resource assigned to multiple activities.",
      "A project risk with zero float."
    ],
    "correct":2
  },
  {
    "position":9,
    "question":"Activity B cannot start until Activity A finishes. Which dependency relationship is this?",
    "options":[
      "Start-to-Start.",
      "Finish-to-Finish.",
      "Start-to-Finish.",
      "Finish-to-Start."
    ],
    "correct":4
  },
  {
    "position":10,
    "question":"Two activities are allowed to begin at the same time, although they may finish at different times. Which dependency type best represents this?",
    "options":[
      "Finish-to-Start.",
      "Start-to-Start.",
      "Finish-to-Finish.",
      "Start-to-Finish."
    ],
    "correct":2
  },
  {
    "position":11,
    "question":"A manager wants a visual timeline showing activity start/end dates, durations, overlaps and sequencing. Which planning tool should be used?",
    "options":[
      "Gantt Chart.",
      "Risk Matrix.",
      "WBS Dictionary.",
      "Decision Tree."
    ],
    "correct":1
  },
  {
    "position":12,
    "question":"According to Module 6, what is the central purpose of scheduling?",
    "options":[
      "To define only project scope.",
      "To determine activity timing and resource allocation while helping optimize time and cost.",
      "To replace planning outputs with a single baseline.",
      "To eliminate all project risks."
    ],
    "correct":2
  },
  {
    "position":13,
    "question":"A delayed project adds extra resources to selected activities in order to shorten the schedule. Which compression technique is being used?",
    "options":[
      "Fast-tracking.",
      "Crashing.",
      "Resource leveling.",
      "Backward pass."
    ],
    "correct":2
  },
  {
    "position":14,
    "question":"A project team performs activities in parallel that were originally planned sequentially. Which compression technique is this?",
    "options":[
      "Crashing.",
      "Fast-tracking.",
      "Resource allocation.",
      "Forward pass."
    ],
    "correct":2
  },
  {
    "position":15,
    "question":"Which practice is part of maintaining the schedule according to the official deck?",
    "options":[
      "Monitor actual versus planned performance and adjust the schedule as needed.",
      "Freeze the schedule and never revise it.",
      "Remove earned value metrics from schedule control.",
      "Ignore deviations until project closure."
    ],
    "correct":1
  },
  {
    "position":16,
    "question":"Which description correctly defines the Critical Path Method in Module 6?",
    "options":[
      "It identifies the longest sequence of dependent tasks and determines the shortest project completion time.",
      "It identifies only the most expensive activities in the project.",
      "It ranks resources by productivity.",
      "It replaces the need for dependencies."
    ],
    "correct":1
  },
  {
    "position":17,
    "question":"What is true of activities on the critical path in the Module 6 deck?",
    "options":[
      "They normally have zero float.",
      "They always have the highest cost.",
      "They can be delayed without affecting project duration.",
      "They have no dependencies."
    ],
    "correct":1
  },
  {
    "position":18,
    "question":"An activity has ES = 4 and duration = 5. Using the Module 6 forward-pass formula, what is its EF?",
    "options":[
      "8.",
      "9.",
      "10.",
      "20."
    ],
    "correct":1
  },
  {
    "position":19,
    "question":"An activity has LF = 15 and duration = 4. Using the Module 6 backward-pass formula, what is its LS?",
    "options":[
      "10.",
      "11.",
      "12.",
      "19."
    ],
    "correct":3
  },
  {
    "position":20,
    "question":"An activity has ES = 6 and LS = 9. What is its float using the deck's formula?",
    "options":[
      "3.",
      "6.",
      "9.",
      "15."
    ],
    "correct":1
  },
  {
    "position":21,
    "question":"Which statement correctly distinguishes lead from lag in Module 6?",
    "options":[
      "Lead is acceleration between dependent tasks; lag is delay between dependent tasks.",
      "Lead is delay; lag is acceleration.",
      "Lead and lag are both types of float.",
      "Lead and lag are resource-allocation techniques."
    ],
    "correct":1
  },
  {
    "position":22,
    "question":"A project has one electrician needed by several overlapping activities. Which approach from the deck best reduces over-allocation?",
    "options":[
      "Resource leveling.",
      "Fast-tracking.",
      "Crashing.",
      "Start-to-Finish dependency."
    ],
    "correct":1
  },
  {
    "position":23,
    "question":"Which statement correctly differentiates resource allocation from resource leveling?",
    "options":[
      "Allocation assigns the right resources; leveling adjusts use to avoid over-allocation and balance workload.",
      "Allocation compresses the schedule; leveling identifies the critical path.",
      "Allocation creates milestones; leveling creates deliverables.",
      "Allocation and leveling mean exactly the same thing."
    ],
    "correct":1
  },
  {
    "position":24,
    "question":"Which factor does the Module 6 deck say should be considered when estimating resources?",
    "options":[
      "Resource type, quantity, availability and productivity.",
      "Only labour cost.",
      "Only equipment quantity.",
      "Only sponsor preference."
    ],
    "correct":1
  },
  {
    "position":25,
    "question":"A complex project needs detailed scheduling, dashboards and reporting. According to the deck, what principle should guide software selection?",
    "options":[
      "Choose software that matches project complexity.",
      "Always use the cheapest tool regardless of project needs.",
      "Use spreadsheets only for every project.",
      "Avoid real-time dashboards because they reduce control."
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
      'CIPMN-MOD-006:PPTX-V1:MCQ:' || (v_item->>'position')
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
      raise exception 'No correct option resolved for Module 6 MCQ position %.',v_item->>'position';
    end if;

    insert into public.question_answer_keys(question_id,correct_option_id)
    values(v_qid,v_correct_id);
  end loop;
end
$mcq_insert$;

do $theory_insert$
declare
  v_exam_id constant uuid := '63311ad6-4bc2-59b6-a5fd-283423c4a2ac';
  v_theory jsonb := $theory$
[
  {
    "position":26,
    "question":"A Nigerian project is approved but the team lacks a clear roadmap for execution. Using only Module 6: (a) distinguish planning from scheduling; (b) explain why both matter for scope, time, cost, resources, transparency and accountability; (c) identify the main components of a project plan; (d) distinguish planning inputs from outputs; and (e) identify the key stakeholders involved in planning and explain why planning helps align them.",
    "criteria":[
      {"name":"Planning vs scheduling","marks":2,"expected":"Explains planning as defining what must be done and how, while scheduling determines when and in what order tasks are completed."},
      {"name":"Why both matter","marks":2,"expected":"Links planning/scheduling to alignment of scope, time, cost and resources, prevention of delays/overruns/scope creep, and improved transparency/accountability."},
      {"name":"Project-plan components","marks":2,"expected":"Identifies core components such as objectives, scope statement, WBS, schedule/milestones, budget/cost estimates and resource plan."},
      {"name":"Inputs vs outputs","marks":2,"expected":"Correctly distinguishes inputs such as Charter, Scope Document, Constraints/Assumptions, Lessons Learned and Stakeholder Requirements from outputs such as WBS, Network Diagram, Gantt Chart, Resource Allocation Plan and Schedule Baseline."},
      {"name":"Planning stakeholders/alignment","marks":2,"expected":"Identifies Project Manager, Project Team, Functional Managers, Sponsors and Customers/Clients and explains planning's role in aligning stakeholders and teams."}
    ]
  },
  {
    "position":27,
    "question":"A solar-energy project needs to move from broad scope to an executable activity plan. Using only Module 6: (a) define the Work Breakdown Structure; (b) explain the relationship among scope, deliverables, work packages and activities; (c) explain milestones and deliverables; (d) describe the four dependency relationships taught in the module with examples; and (e) explain how sequencing supports the project schedule.",
    "criteria":[
      {"name":"WBS definition","marks":2,"expected":"Defines WBS as a deliverable-oriented hierarchical decomposition of project scope into manageable work packages and recognizes it as a plan-of-plans concept in the deck."},
      {"name":"Scope to activity logic","marks":2,"expected":"Explains how scope is decomposed into deliverables/work packages and then into specific activities needed for execution."},
      {"name":"Milestones and deliverables","marks":2,"expected":"Distinguishes milestones as major checkpoints and deliverables as tangible outcomes from project tasks."},
      {"name":"Dependency relationships","marks":2,"expected":"Explains Finish-to-Start, Start-to-Start, Finish-to-Finish and Start-to-Finish accurately with appropriate activity logic."},
      {"name":"Sequencing value","marks":2,"expected":"Explains that logical dependency sequencing supports realistic timelines, network logic and schedule development."}
    ]
  },
  {
    "position":28,
    "question":"A project is behind schedule and management is reviewing scheduling controls. Using only Module 6: (a) define scheduling and its objective; (b) compare crashing and fast-tracking; (c) explain how actual-versus-planned monitoring and earned value metrics support schedule maintenance; (d) explain the purpose of Gantt Charts and Network Diagrams; and (e) describe when schedule adjustments may be required.",
    "criteria":[
      {"name":"Scheduling concept","marks":2,"expected":"Explains scheduling as determining timing of activities and resource allocation with the aim of optimizing time and cost."},
      {"name":"Compression techniques","marks":2,"expected":"Distinguishes crashing as adding resources from fast-tracking as performing tasks in parallel."},
      {"name":"Schedule maintenance","marks":2,"expected":"Explains monitoring actual versus planned performance, using earned value metrics and adjusting the schedule where needed."},
      {"name":"Gantt and network tools","marks":2,"expected":"Explains Gantt as a timeline view of activities, dates, duration, overlap/sequencing and Network Diagrams as dependency/sequence visualizations supporting schedule logic."},
      {"name":"Adjustment rationale","marks":2,"expected":"Explains schedule adjustments in response to performance deviations, dependency/resource constraints or the need to recover timing."}
    ]
  },
  {
    "position":29,
    "question":"A project team must determine the critical path for a network of activities. Using only Module 6: (a) define the Critical Path Method and explain why the critical path matters; (b) define ES, EF, LS, LF and Float; (c) explain the forward-pass and backward-pass calculations using the formulas taught in the deck; (d) explain how float is calculated and interpreted; and (e) distinguish lead from lag and explain how delays on critical-path activities affect the project.",
    "criteria":[
      {"name":"CPM purpose","marks":2,"expected":"Defines CPM as identifying the longest sequence of dependent tasks and determining the shortest project completion time, with zero-float path significance."},
      {"name":"CPM terminology","marks":2,"expected":"Correctly defines Early Start, Early Finish, Late Start, Late Finish and Float/Slack."},
      {"name":"Forward/backward pass","marks":2,"expected":"Uses EF = ES + Duration - 1 and LS = LF - Duration + 1 and explains left-to-right forward pass and right-to-left backward pass."},
      {"name":"Float","marks":2,"expected":"Uses Float = LS - ES or LF - EF and explains it as allowable delay without delaying the project."},
      {"name":"Lead, lag and critical delay","marks":2,"expected":"Defines lead as acceleration and lag as delay between dependent tasks and explains that delays in critical-path activities delay the project."}
    ]
  },
  {
    "position":30,
    "question":"A project has scarce skilled labour and overlapping activities. Using only Module 6: (a) distinguish resource allocation from resource leveling; (b) identify the factors to consider when estimating resources; (c) explain how leveling can prevent over-allocation and burnout; (d) explain why software selection should match project complexity; and (e) identify suitable project-management software listed in the deck and explain the visibility/control benefits they can provide.",
    "criteria":[
      {"name":"Allocation vs leveling","marks":2,"expected":"Explains allocation as assigning the right resources and leveling as adjusting use to avoid over-allocation and balance workload."},
      {"name":"Resource-estimation factors","marks":2,"expected":"Identifies type, quantity, availability and productivity of resources."},
      {"name":"Leveling benefits","marks":2,"expected":"Explains balanced workload, prevention of over-allocation/burnout and practical handling of scarce skilled labour."},
      {"name":"Software-selection principle","marks":2,"expected":"Explains that project-management software should be selected to match project complexity."},
      {"name":"Tools and benefits","marks":2,"expected":"Identifies source-listed tools such as MS Project, Trello, Asana, Excel, Primavera P6 or Smartsheet and links them to visibility, task tracking, dashboards/reports, time tracking or invoicing."}
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
      'CIPMN-MOD-006:PPTX-V1:THEORY:' || ((v_item->>'position')::integer-25)
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
      'CIPMN-MOD-006.pptx (22 slides; reviewed 2026-09-26)',true
    );
  end loop;
end
$theory_insert$;

do $verify$
declare
  v_exam_id constant uuid := '63311ad6-4bc2-59b6-a5fd-283423c4a2ac';
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

  if v_mcq<>25 then raise exception 'Expected 25 active Module 6 MCQs, found %.',v_mcq; end if;
  if v_theory<>5 then raise exception 'Expected 5 active Module 6 Theory questions, found %.',v_theory; end if;
  if v_keys<>25 then raise exception 'Expected 25 Module 6 answer keys, found %.',v_keys; end if;
  if v_options<>100 then raise exception 'Expected 100 active Module 6 MCQ options, found %.',v_options; end if;
  if v_rubrics<>5 then raise exception 'Expected 5 active Module 6 Theory rubrics, found %.',v_rubrics; end if;
  if v_bad_options<>0 then raise exception 'Found % Module 6 MCQ(s) with invalid/repeated options.',v_bad_options; end if;
  if v_bad_rubrics<>0 then raise exception 'Found % invalid Module 6 Theory rubric(s).',v_bad_rubrics; end if;
  if v_duplicate_texts<>0 then raise exception 'Found % repeated active Module 6 question text(s).',v_duplicate_texts; end if;
end
$verify$;

update public.examinations
set exam_format='cipmn_mixed',
    updated_at=now()
where id='63311ad6-4bc2-59b6-a5fd-283423c4a2ac';

commit;

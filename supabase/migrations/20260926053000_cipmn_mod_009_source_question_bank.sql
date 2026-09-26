begin;

-- CIPMN-MOD-009 assessment conversion and source-strict bank refresh.
-- Official assessment sources:
-- 1) CIPMN - MOD-009.pdf (Agile Delivery)
-- 2) CIPMN-MOD-009.pptx
-- Reviewed 2026-09-26.
-- Historical attempts, submitted answers, assignments and retired questions are preserved.

do $guard$
declare
  v_exam_id constant uuid := '8305ebe1-ea1e-5089-bf4c-cb5bac29a918';
  v_live integer;
  v_format text;
  v_active integer;
  v_marker uuid := public.cipmn_mock_seed_uuid('CIPMN-MOD-009:SOURCES-V1:MCQ:1');
begin
  select exam_format into v_format
  from public.examinations
  where id=v_exam_id
  for update;

  if not found then raise exception 'CIPMN-MOD-009 examination not found.'; end if;
  if v_format not in ('standard','cipmn_mixed') then
    raise exception 'Unexpected CIPMN-MOD-009 exam format: %',v_format;
  end if;
  if exists(select 1 from public.questions where id=v_marker and is_active) then
    raise exception 'CIPMN-MOD-009 source-aligned bank is already active; refresh aborted.';
  end if;

  update public.exam_sessions
  set status='expired',updated_at=now()
  where examination_id=v_exam_id and status='active' and expires_at<=now();

  select count(*) into v_live
  from public.exam_sessions
  where examination_id=v_exam_id and status='active' and expires_at>now();

  if v_live<>0 then
    raise exception 'CIPMN-MOD-009 has % genuinely live examination session(s); conversion aborted.',v_live;
  end if;

  select count(*) into v_active
  from public.questions
  where examination_id=v_exam_id and is_active;

  if v_format='standard' and v_active<>75 then
    raise exception 'Expected 75 active legacy Module 9 questions, found %.',v_active;
  end if;
end
$guard$;

update public.questions
set is_active=false,
    position=position+19000,
    updated_at=now()
where examination_id='8305ebe1-ea1e-5089-bf4c-cb5bac29a918'
  and is_active=true;

do $mcq_insert$
declare
  v_exam_id constant uuid := '8305ebe1-ea1e-5089-bf4c-cb5bac29a918';
  v_mcqs jsonb := $mcq$
[
  {
    "position":1,
    "question":"Which statement best captures Agile as taught in Module 9?",
    "options":[
      "A fixed planning method that minimizes change after initiation.",
      "A customer-focused mindset and methodology emphasizing collaboration, flexibility, iterative delivery and continuous improvement.",
      "A documentation-first framework for stable requirements only.",
      "A scheduling technique used only in software projects."
    ],
    "correct":2
  },
  {
    "position":2,
    "question":"Which Agile Manifesto value is correctly represented in the official materials?",
    "options":[
      "Comprehensive documentation over working solutions.",
      "Contract negotiation over customer collaboration.",
      "Responding to change over following a rigid plan.",
      "Processes and tools over people."
    ],
    "correct":3
  },
  {
    "position":3,
    "question":"In the Agile Delivery Cycle, which phase comes after Review & Demo and focuses on reflecting on successes, gaps and improvements?",
    "options":[
      "Retrospective.",
      "Sprint Planning.",
      "Vision & Planning.",
      "Prioritization."
    ],
    "correct":1
  },
  {
    "position":4,
    "question":"Which Agile principle is most directly demonstrated when a team releases usable increments every few weeks rather than waiting for one large final delivery?",
    "options":[
      "Heavy upfront documentation.",
      "Centralized decision-making.",
      "Frequent delivery of working solutions.",
      "Fixed scope protection."
    ],
    "correct":3
  },
  {
    "position":5,
    "question":"Which statement best distinguishes Agile from Waterfall in Module 9?",
    "options":[
      "Agile is flexible and iterative; Waterfall is linear and sequential.",
      "Agile and Waterfall both require fixed requirements throughout.",
      "Waterfall uses continuous stakeholder feedback more than Agile.",
      "Agile is best only where change is prohibited."
    ],
    "correct":1
  },
  {
    "position":6,
    "question":"Which cultural shift is identified as important for Agile adoption in Nigeria?",
    "options":[
      "From collaboration to tighter hierarchy.",
      "From silence to psychological safety and open communication.",
      "From cross-functional teams to functional silos.",
      "From adaptability to predictability."
    ],
    "correct":2
  },
  {
    "position":7,
    "question":"Which is a key enabler of Agile cultural transformation in Nigeria according to the module?",
    "options":[
      "Leadership buy-in that models servant leadership, openness and trust.",
      "Avoiding pilots until the whole organization can transform at once.",
      "Replacing feedback systems with formal escalation only.",
      "Reducing local adaptation so the method remains globally uniform."
    ],
    "correct":1
  },
  {
    "position":8,
    "question":"Which Scrum role is responsible for defining and prioritizing the backlog, representing stakeholders and maximizing value?",
    "options":[
      "Scrum Master.",
      "Development Team.",
      "Product Owner.",
      "Project Sponsor."
    ],
    "correct":3
  },
  {
    "position":9,
    "question":"Which Scrum artifact contains the selected backlog items and tasks for the Sprint Goal?",
    "options":[
      "Increment.",
      "Sprint Backlog.",
      "Product Roadmap.",
      "Definition of Done."
    ],
    "correct":2
  },
  {
    "position":10,
    "question":"Which Scrum event is a short daily check-in used to track progress and adapt during the sprint?",
    "options":[
      "Sprint Retrospective.",
      "Sprint Review.",
      "Daily Scrum.",
      "Backlog Refinement."
    ],
    "correct":3
  },
  {
    "position":11,
    "question":"Which Kanban practice directly limits overload by restricting the number of tasks being worked on at the same time?",
    "options":[
      "WIP Limits.",
      "Sprint Goal.",
      "Definition of Done.",
      "Story Mapping."
    ],
    "correct":1
  },
  {
    "position":12,
    "question":"A university IT support team has a continuous stream of tickets and needs visibility across To Do, In Progress and Done. Which framework is most naturally suited to this context?",
    "options":[
      "Scrum with fixed product sprints only.",
      "Kanban with visual flow and WIP limits.",
      "Waterfall with fixed sequential phases.",
      "PERT with probabilistic durations."
    ],
    "correct":2
  },
  {
    "position":13,
    "question":"What does rolling-wave planning mean in the Module 9 Agile planning context?",
    "options":[
      "Detailed short-term planning with progressively refined longer-term goals.",
      "Completing all planning before any delivery starts.",
      "Using only a daily task list without higher-level plans.",
      "Replacing product vision with sprint estimates."
    ],
    "correct":1
  },
  {
    "position":14,
    "question":"Which prioritization method classifies items as Must-have, Should-have, Could-have and Won’t-have?",
    "options":[
      "Kano.",
      "RICE.",
      "MoSCoW.",
      "WSJF."
    ],
    "correct":3
  },
  {
    "position":15,
    "question":"Which prioritization technique ranks work based on cost of delay relative to job size?",
    "options":[
      "WSJF.",
      "MoSCoW.",
      "100 Dollar Test.",
      "Affinity Estimation."
    ],
    "correct":1
  },
  {
    "position":16,
    "question":"Which Agile estimation approach is team-based and uses cards to compare estimates and discuss differences until alignment improves?",
    "options":[
      "T-Shirt Sizing.",
      "Planning Poker.",
      "Ideal Days.",
      "Affinity Estimation."
    ],
    "correct":2
  },
  {
    "position":17,
    "question":"Which description best fits Story Points in the official module?",
    "options":[
      "A precise duration in hours.",
      "A financial measure of backlog value.",
      "A relative measure of complexity or effort, commonly using a Fibonacci-style scale.",
      "A count of acceptance criteria."
    ],
    "correct":3
  },
  {
    "position":18,
    "question":"Which user story follows the format taught in Module 9?",
    "options":[
      "Build online payment immediately.",
      "As a student, I want to pay online so that I can confirm my course registration.",
      "Payment module shall use secure protocols.",
      "The team should prioritize payments this sprint."
    ],
    "correct":2
  },
  {
    "position":19,
    "question":"Which item is part of the INVEST criteria for good user stories?",
    "options":[
      "Independent.",
      "Immutable.",
      "Integrated.",
      "Inflexible."
    ],
    "correct":1
  },
  {
    "position":20,
    "question":"In User Story Mapping, what does the horizontal axis represent?",
    "options":[
      "Relative story-point size.",
      "Sequence of user activities or workflow.",
      "Team capacity by sprint.",
      "Technical risk level."
    ],
    "correct":2
  },
  {
    "position":21,
    "question":"Which statement best describes the Product Backlog?",
    "options":[
      "A fixed scope document that cannot change once approved.",
      "A dynamic, ordered list of everything needed to improve the product and the single source of work for the Scrum Team.",
      "A list of completed sprint tasks only.",
      "A financial roadmap for release funding."
    ],
    "correct":2
  },
  {
    "position":22,
    "question":"Which activity belongs to Backlog Refinement?",
    "options":[
      "Breaking large epics into smaller user stories and clarifying acceptance criteria.",
      "Freezing priorities for the life of the product.",
      "Removing estimates from backlog items.",
      "Replacing stakeholder feedback with technical priorities."
    ],
    "correct":1
  },
  {
    "position":23,
    "question":"Which characteristic belongs to a good Product Backlog according to Module 9?",
    "options":[
      "Ordered, refined, estimated and visible.",
      "Fixed, confidential, unestimated and complete.",
      "Owned only by developers and hidden from stakeholders.",
      "Organized only by technical dependency."
    ],
    "correct":1
  },
  {
    "position":24,
    "question":"Which prioritization method groups product features into basic, performance and delight categories?",
    "options":[
      "RICE.",
      "Kano Model.",
      "WSJF.",
      "MoSCoW."
    ],
    "correct":2
  },
  {
    "position":25,
    "question":"Which metric measures the time from a request being made until the work is delivered?",
    "options":[
      "Velocity.",
      "Cycle Time.",
      "Lead Time.",
      "Burndown."
    ],
    "correct":3
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
    v_qid := public.cipmn_mock_seed_uuid('CIPMN-MOD-009:SOURCES-V1:MCQ:' || (v_item->>'position'));

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
      raise exception 'No correct option resolved for Module 9 MCQ position %.',v_item->>'position';
    end if;

    insert into public.question_answer_keys(question_id,correct_option_id)
    values(v_qid,v_correct_id);
  end loop;
end
$mcq_insert$;

do $theory_insert$
declare
  v_exam_id constant uuid := '8305ebe1-ea1e-5089-bf4c-cb5bac29a918';
  v_theory jsonb := $theory$
[
  {
    "position":26,
    "question":"Using only Module 9: (a) define Agile and explain its four core values; (b) explain the seven phases of the Agile Delivery Cycle; (c) explain key Agile principles including iterative delivery, collaboration, adaptability, transparency, sustainable pace and continuous improvement; (d) compare Agile with Waterfall; and (e) explain the cultural shifts and adoption enablers required for Agile in Nigeria.",
    "criteria":[
      {"name":"Agile and core values","marks":2,"expected":"Defines Agile as collaboration/flexibility/customer-value focused and accurately explains people over processes, working solutions over documentation, customer collaboration over contracts, and adaptability over rigid plans."},
      {"name":"Delivery cycle","marks":2,"expected":"Explains Vision & Planning, Prioritization, Sprint Planning, Delivery, Review & Demo, Retrospective, and Release & Feedback."},
      {"name":"Core principles","marks":2,"expected":"Explains iterative/incremental delivery, customer collaboration, flexibility, transparency, sustainable pace and continuous improvement."},
      {"name":"Agile vs Waterfall","marks":2,"expected":"Contrasts flexible iterative feedback-driven Agile with linear sequential documentation-heavy Waterfall and appropriate contexts."},
      {"name":"Nigeria adoption","marks":2,"expected":"Explains shifts from control to collaboration, bureaucracy to value, predictability to adaptability, silence to psychological safety and silos to cross-functional teams, plus leadership buy-in, coaching, gradual rollout, local champions and feedback systems."}
    ]
  },
  {
    "position":27,
    "question":"Using only Module 9: (a) explain Scrum and its empirical/iterative nature; (b) describe the Product Owner, Scrum Master and Development Team roles; (c) explain Product Backlog, Sprint Backlog and Increment; (d) explain Sprint Planning, Daily Scrum, Sprint Review and Sprint Retrospective; and (e) compare Scrum and Kanban for Nigerian product-development and operational-support contexts.",
    "criteria":[
      {"name":"Scrum concept","marks":2,"expected":"Explains Scrum as an iterative/incremental Agile framework using short sprints, cross-functional teams, time-boxed events and empirical control."},
      {"name":"Scrum roles","marks":2,"expected":"Explains PO as backlog/value/stakeholder owner, Scrum Master as facilitator/coach/impediment remover, and Development Team as cross-functional/self-organizing delivery team."},
      {"name":"Artifacts","marks":2,"expected":"Explains Product Backlog, Sprint Backlog and usable Done Increment."},
      {"name":"Events","marks":2,"expected":"Explains Sprint Planning, Daily Scrum, Sprint Review and Sprint Retrospective with source-consistent purposes."},
      {"name":"Scrum vs Kanban","marks":2,"expected":"Explains Scrum as structured sprint-based product delivery and Kanban as continuous visual flow with WIP limits/cycle-time focus, including Nigerian challenges and context fit."}
    ]
  },
  {
    "position":28,
    "question":"Using only Module 9: (a) explain Agile planning as a rolling-wave, adaptive approach; (b) describe the planning levels from Vision to Daily Planning; (c) compare MoSCoW and WSJF; (d) explain Story Points, Planning Poker, T-Shirt Sizing, Ideal Days/Hours and Affinity Estimation; and (e) explain how Agile plans connect vision, roadmap, release, sprint, risk/change, quality/testing and metrics.",
    "criteria":[
      {"name":"Agile planning concept","marks":2,"expected":"Explains adaptive multi-level rolling-wave planning, progressive elaboration and timeboxing."},
      {"name":"Planning levels","marks":2,"expected":"Explains Vision, Roadmap, Release, Iteration/Sprint and Daily Planning as a hierarchy from strategic direction to actionable work."},
      {"name":"Prioritization","marks":2,"expected":"Explains MoSCoW categories and WSJF as ranking work by cost of delay versus job size."},
      {"name":"Estimation","marks":2,"expected":"Explains Story Points, Planning Poker, T-Shirt Sizing, Ideal Days/Hours and Affinity Estimation as relative/team-oriented approaches at the level supported by the source."},
      {"name":"Integrated Agile plan","marks":2,"expected":"Connects vision, OKRs/metrics, roadmap, backlog, release planning, sprints, risk/change, acceptance criteria/testing and continuous review/adaptation."}
    ]
  },
  {
    "position":29,
    "question":"Using only Module 9: (a) explain the structure and purpose of user stories; (b) explain all six INVEST criteria; (c) explain User Story Mapping including horizontal workflow and vertical priority; (d) explain how acceptance criteria and the Definition of Done support quality and readiness; and (e) explain how feedback from Review, Release and Retrospective should influence the backlog.",
    "criteria":[
      {"name":"User story structure","marks":2,"expected":"Explains 'As a [user], I want [goal] so that [benefit]' as concise user-perspective requirements."},
      {"name":"INVEST","marks":2,"expected":"Explains Independent, Negotiable, Valuable, Estimable, Small and Testable."},
      {"name":"Story Mapping","marks":2,"expected":"Explains identifying users/activities/tasks/stories and mapping horizontally by workflow and vertically by priority."},
      {"name":"Acceptance/Done","marks":2,"expected":"Explains acceptance criteria as testable conditions and Definition of Done as completion criteria, without adding unsupported detail."},
      {"name":"Feedback loops","marks":2,"expected":"Explains how demos, releases, user feedback and retrospectives feed learning back into backlog refinement and future planning."}
    ]
  },
  {
    "position":30,
    "question":"Using only Module 9: (a) explain the Product Owner’s responsibilities and skills; (b) distinguish Product Vision from Product Roadmap; (c) explain the characteristics of a good Product Backlog; (d) explain Backlog Refinement and Definition of Ready; and (e) compare MoSCoW, WSJF, Kano, RICE and the 100 Dollar Test as prioritization techniques.",
    "criteria":[
      {"name":"Product Owner","marks":2,"expected":"Explains maximizing value, representing customers/stakeholders, defining product goals, maintaining/prioritizing backlog, clarifying items and enabling decisions, with source-listed skills."},
      {"name":"Vision vs Roadmap","marks":2,"expected":"Explains Product Vision as long-term customer-centric mission and Product Roadmap as a living high-level evolution plan rather than a fixed plan."},
      {"name":"Good backlog","marks":2,"expected":"Explains backlog as dynamic/single source of work and characteristics: ordered/prioritized, refined, estimated and visible."},
      {"name":"Refinement/DoR","marks":2,"expected":"Explains breaking epics, clarifying criteria, estimating, re-prioritizing/removing obsolete items, regular refinement and Definition of Ready for sprint-ready stories."},
      {"name":"Prioritization techniques","marks":2,"expected":"Accurately compares MoSCoW, WSJF, Kano, RICE and 100 Dollar Test using the definitions and contexts provided in the module."}
    ]
  }
]
$theory$::jsonb;
  v_item jsonb;
  v_qid uuid;
begin
  for v_item in select value from jsonb_array_elements(v_theory)
  loop
    v_qid := public.cipmn_mock_seed_uuid('CIPMN-MOD-009:SOURCES-V1:THEORY:' || ((v_item->>'position')::integer-25));

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
      'CIPMN-MOD-009 official PDF + PPTX; reviewed 2026-09-26',true
    );
  end loop;
end
$theory_insert$;

do $verify$
declare
  v_exam_id constant uuid := '8305ebe1-ea1e-5089-bf4c-cb5bac29a918';
  v_mcq integer;
  v_theory integer;
  v_keys integer;
  v_options integer;
  v_rubrics integer;
  v_bad_options integer;
  v_bad_rubrics integer;
  v_duplicate_texts integer;
begin
  select count(*) into v_mcq from public.questions where examination_id=v_exam_id and is_active and section='mcq' and question_type='single_choice';
  select count(*) into v_theory from public.questions where examination_id=v_exam_id and is_active and section='theory' and question_type='theory';
  select count(*) into v_keys from public.question_answer_keys k join public.questions q on q.id=k.question_id where q.examination_id=v_exam_id and q.is_active and q.section='mcq';
  select count(*) into v_options from public.question_options o join public.questions q on q.id=o.question_id where q.examination_id=v_exam_id and q.is_active and q.section='mcq';
  select count(*) into v_rubrics from public.theory_marking_rubrics r join public.questions q on q.id=r.question_id where q.examination_id=v_exam_id and q.is_active and q.section='theory' and r.is_active;

  select count(*) into v_bad_options
  from public.questions q
  where q.examination_id=v_exam_id and q.is_active and q.section='mcq'
    and ((select count(*) from public.question_options o where o.question_id=q.id)<>4
      or (select count(distinct lower(trim(o.option_text))) from public.question_options o where o.question_id=q.id)<>4);

  select count(*) into v_bad_rubrics
  from public.theory_marking_rubrics r
  join public.questions q on q.id=r.question_id
  where q.examination_id=v_exam_id and q.is_active and q.section='theory'
    and (not r.is_active or r.max_score<>10
      or jsonb_typeof(r.rubric->'criteria')<>'array'
      or jsonb_array_length(r.rubric->'criteria')<>5);

  select count(*)-count(distinct regexp_replace(lower(trim(question_text)),'\s+',' ','g'))
  into v_duplicate_texts
  from public.questions
  where examination_id=v_exam_id and is_active;

  if v_mcq<>25 then raise exception 'Expected 25 active Module 9 MCQs, found %.',v_mcq; end if;
  if v_theory<>5 then raise exception 'Expected 5 active Module 9 Theory questions, found %.',v_theory; end if;
  if v_keys<>25 then raise exception 'Expected 25 Module 9 answer keys, found %.',v_keys; end if;
  if v_options<>100 then raise exception 'Expected 100 active Module 9 MCQ options, found %.',v_options; end if;
  if v_rubrics<>5 then raise exception 'Expected 5 active Module 9 Theory rubrics, found %.',v_rubrics; end if;
  if v_bad_options<>0 then raise exception 'Found % Module 9 MCQ(s) with invalid/repeated options.',v_bad_options; end if;
  if v_bad_rubrics<>0 then raise exception 'Found % invalid Module 9 Theory rubric(s).',v_bad_rubrics; end if;
  if v_duplicate_texts<>0 then raise exception 'Found % repeated active Module 9 question text(s).',v_duplicate_texts; end if;
end
$verify$;

update public.examinations
set exam_format='cipmn_mixed',
    updated_at=now()
where id='8305ebe1-ea1e-5089-bf4c-cb5bac29a918';

commit;

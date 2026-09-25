begin;

-- CIPMN-MOD-002 assessment bank refresh.
-- Sole assessment source: user-supplied CIPMN-MOD-002.pptx (37 slides), received 2026-09-25.
-- Purpose: remove repeated/low-difficulty items and replace them with a source-strict,
-- higher-order 25-MCQ + 5-Theory bank. Historical attempts/questions remain preserved.

do $guard$
declare
  v_exam_id constant uuid := 'fe7a116b-72ef-5d1f-acc8-36938ee8b0cf';
  v_live integer;
  v_format text;
  v_marker uuid := public.cipmn_mock_seed_uuid('CIPMN-MOD-002:PPTX-V1:MCQ:1');
begin
  select exam_format into v_format
  from public.examinations
  where id=v_exam_id
  for update;

  if not found then
    raise exception 'CIPMN-MOD-002 examination not found.';
  end if;

  if v_format<>'cipmn_mixed' then
    raise exception 'CIPMN-MOD-002 must already use cipmn_mixed before refreshing its assessment bank.';
  end if;

  if exists(select 1 from public.questions where id=v_marker and is_active) then
    raise exception 'CIPMN-MOD-002 PPTX-aligned bank is already active; refresh aborted.';
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
    raise exception 'CIPMN-MOD-002 has % genuinely live examination session(s); question-bank refresh aborted.',v_live;
  end if;
end
$guard$;

update public.questions
set is_active=false,
    position=position+5000,
    updated_at=now()
where examination_id='fe7a116b-72ef-5d1f-acc8-36938ee8b0cf'
  and is_active=true;

do $mcq_insert$
declare
  v_exam_id constant uuid := 'fe7a116b-72ef-5d1f-acc8-36938ee8b0cf';
  v_mcqs jsonb := $mcq$
[
  {
    "position": 1,
    "question": "A project team argues that purchasing a Kanban application means it has already adopted a project management methodology. Which response is MOST consistent with the CIPMN module?",
    "options": [
      "A methodology is a structured way of working that guides planning, execution, monitoring and closure; a tool may support it but does not replace it.",
      "A methodology is any software used to visualize project tasks.",
      "A methodology is only a document template used at project start-up.",
      "A methodology is unnecessary once the team has a digital collaboration platform."
    ],
    "correct": 1
  },
  {
    "position": 2,
    "question": "Which option contains ONLY characteristics that the module associates with a sound project management methodology?",
    "options": [
      "Process-driven, framework-based, best-practice oriented, repeatable and scalable, stakeholder-focused.",
      "Technology-driven, personality-based, informal, non-repeatable, sponsor-focused.",
      "Budget-driven, tool-dependent, vendor-specific, non-scalable, document-free.",
      "Schedule-driven, software-based, one-off, manager-centred, stakeholder-independent."
    ],
    "correct": 1
  },
  {
    "position": 3,
    "question": "A department has inconsistent work practices, unclear responsibilities, reactive handling of threats and declining stakeholder satisfaction. Which combination of methodology benefits in the module MOST directly addresses all four problems?",
    "options": [
      "Standardized processes, clear roles and communication, proactive risk management, and better stakeholder satisfaction.",
      "More meetings, more software licences, fewer controls, and later stakeholder engagement.",
      "Greater informality, individual work methods, less documentation, and reduced stakeholder contact.",
      "Fixed budgets, larger teams, more approvals, and elimination of all project risk."
    ],
    "correct": 1
  },
  {
    "position": 4,
    "question": "A project manager needs to (i) decompose deliverables, (ii) show activities against time, (iii) clarify who is responsible/accountable/consulted/informed, and (iv) maintain visibility of threats. Which tool sequence matches the module?",
    "options": [
      "WBS → Gantt Chart → RACI Matrix → Risk Register.",
      "Gantt Chart → Risk Register → Kanban Board → WBS.",
      "RACI Matrix → WBS → Gantt Chart → Kanban Board.",
      "Kanban Board → RACI Matrix → Risk Register → Gantt Chart."
    ],
    "correct": 1
  },
  {
    "position": 5,
    "question": "Which classification exactly matches the three methodology groupings presented in the module?",
    "options": [
      "Traditional: Waterfall and CPM; Agile-Based: Scrum, Kanban and Lean; Hybrid & Structured: PRINCE2, PMBOK and DUCAP.",
      "Traditional: PRINCE2 and PMBOK; Agile-Based: Waterfall and CPM; Hybrid & Structured: Scrum, Kanban and Lean.",
      "Traditional: Scrum and Kanban; Agile-Based: PRINCE2 and DUCAP; Hybrid & Structured: Waterfall and CPM.",
      "Traditional: Lean and CPM; Agile-Based: PMBOK and PRINCE2; Hybrid & Structured: Waterfall and Scrum."
    ],
    "correct": 1
  },
  {
    "position": 6,
    "question": "A government infrastructure project has a fixed scope, stable requirements and work that must progress largely in sequence. Based strictly on the module, which approach is the strongest fit?",
    "options": [
      "Waterfall, because the module presents it as linear, sequential and well suited to construction, infrastructure and government projects.",
      "Kanban, because the module presents it as a no-sprint method for all fixed-scope construction work.",
      "Lean, because the module classifies it as the primary method for government infrastructure.",
      "Scrum, because the module presents fixed scope and sequential work as its ideal conditions."
    ],
    "correct": 1
  },
  {
    "position": 7,
    "question": "A mobile service is being built while user needs are still evolving. Management proposes completing all phases sequentially and collecting meaningful user feedback only near the end. Which Waterfall weakness from the module creates the greatest risk?",
    "options": [
      "Difficulty and cost of accommodating change once phases are completed.",
      "Excessive flexibility caused by continuous reprioritization.",
      "Too little documentation at the beginning of the project.",
      "Mandatory work-in-progress limits that slow delivery."
    ],
    "correct": 1
  },
  {
    "position": 8,
    "question": "A CPM network has two start-to-finish paths: A–B–D takes 4 + 6 + 5 days, while A–C–D takes 4 + 3 + 5 days. Using the module’s definition of CPM, what should the project manager conclude?",
    "options": [
      "A–B–D is the critical path and the minimum project duration is 15 days.",
      "A–C–D is the critical path and the minimum project duration is 12 days.",
      "Both paths are critical because they share Activities A and D.",
      "The shortest path is always the critical path, so A–C–D controls completion."
    ],
    "correct": 1
  },
  {
    "position": 9,
    "question": "An activity on the critical path has zero slack and is delayed by two days. No acceleration action is taken. Which conclusion follows from the module’s explanation of CPM?",
    "options": [
      "The project completion date is expected to move by two days because a zero-slack critical activity cannot absorb the delay.",
      "The project finish date is unaffected because critical activities always have spare float.",
      "The delay affects only project cost, not project duration.",
      "The activity automatically becomes non-critical once it is delayed."
    ],
    "correct": 1
  },
  {
    "position": 10,
    "question": "A CPM schedule places two critical activities at the same time, but both require the only available specialist. Which CPM weakness in the module is MOST directly exposed?",
    "options": [
      "CPM can ignore resource limits even when the network logic is correct.",
      "CPM cannot show activity dependencies.",
      "CPM cannot identify time-critical activities.",
      "CPM prevents the use of Gantt or network charts."
    ],
    "correct": 1
  },
  {
    "position": 11,
    "question": "A sponsor shortens the deadline and asks which response the module identifies as a CPM-supported acceleration technique. Which answer is correct?",
    "options": [
      "Crashing or fast-tracking critical activities.",
      "Removing the critical path from the schedule.",
      "Replacing all dependencies with a Kanban board.",
      "Delaying every non-critical activity until project closure."
    ],
    "correct": 1
  },
  {
    "position": 12,
    "question": "During product development, new user evidence conflicts with the original plan. Which decision BEST reflects the Agile philosophy stated in the module?",
    "options": [
      "Respond to the change rather than follow the original plan rigidly.",
      "Reject the evidence because approved plans must never change.",
      "Postpone all reviews until the product is fully deployed.",
      "Replace stakeholder feedback with more documentation."
    ],
    "correct": 1
  },
  {
    "position": 13,
    "question": "A startup values fast time to market, flexibility, frequent feedback and innovation, but executives also want highly predictable long-term plans with minimal stakeholder involvement. Which assessment is MOST consistent with the module?",
    "options": [
      "Agile strongly supports the first set of needs, but the second set conflicts with weaknesses identified for Agile.",
      "Waterfall strongly supports both sets of needs because it maximizes flexibility and stakeholder feedback.",
      "Kanban eliminates all predictability and stakeholder concerns in every context.",
      "PRINCE2 is presented as identical to Agile in flexibility and stakeholder requirements."
    ],
    "correct": 1
  },
  {
    "position": 14,
    "question": "Which group consists entirely of Scrum roles shown in the module?",
    "options": [
      "Product Owner, Scrum Master, Development Team.",
      "Project Board, Product Owner, Risk Owner.",
      "Scrum Master, Project Sponsor, Functional Manager.",
      "Development Team, RACI Owner, Kanban Master."
    ],
    "correct": 1
  },
  {
    "position": 15,
    "question": "A Scrum team conducts Sprint Planning, Daily Stand-ups and Sprint Reviews but never holds a session to reflect on how the team worked and how to improve. Which Scrum event shown in the module is missing?",
    "options": [
      "Sprint Retrospective.",
      "Risk Register Review.",
      "Project Board Meeting.",
      "Critical Path Review."
    ],
    "correct": 1
  },
  {
    "position": 16,
    "question": "A maintenance unit receives unpredictable requests continuously. Work piles up because too many items are started at once, and fixed Sprints are not useful. Which method and practice from the module best fit the situation?",
    "options": [
      "Kanban with continuous flow and limits on work in progress.",
      "Waterfall with all requirements frozen before work begins.",
      "PRINCE2 with no visualization of workflow.",
      "CPM with every request treated as a fixed-duration critical activity."
    ],
    "correct": 1
  },
  {
    "position": 17,
    "question": "An operational process contains repeated waiting, rework and activities that add little customer value. Which response most closely follows the Lean principles shown in the module?",
    "options": [
      "Eliminate waste, reduce inefficiencies, maximize customer value and pursue continuous improvement.",
      "Increase work in progress so that every activity remains busy.",
      "Delay customer feedback until final delivery.",
      "Add documentation regardless of whether it contributes value."
    ],
    "correct": 1
  },
  {
    "position": 18,
    "question": "A large public project requires strong governance, clear Project Board roles, auditability, compliance and an approach that can be tailored to scale. Which methodology is the strongest match according to the module?",
    "options": [
      "PRINCE2.",
      "Kanban.",
      "Lean.",
      "Scrum."
    ],
    "correct": 1
  },
  {
    "position": 19,
    "question": "A small fast-moving team is considering PRINCE2. Which concern is MOST directly supported by the module’s list of PRINCE2 weaknesses?",
    "options": [
      "It can be bureaucratic and documentation-heavy, slow to set up for small projects and overkill for fast-moving teams.",
      "It has no governance structure and no defined roles.",
      "It is more flexible than Agile and therefore unsuitable for controlled environments.",
      "It cannot be tailored and must always be applied at maximum scale."
    ],
    "correct": 1
  },
  {
    "position": 20,
    "question": "An executive says, “PMBOK is the methodology we must follow step by step.” Which correction is supported by the module?",
    "options": [
      "PMBOK is presented as a global standard guide rather than a methodology, and it is adaptable to different methods.",
      "PMBOK is presented as a fixed Waterfall methodology that cannot be adapted.",
      "PMBOK is presented as a Kanban implementation guide.",
      "PMBOK is presented as a Nigerian hybrid methodology combining Agile and PRINCE2."
    ],
    "correct": 1
  },
  {
    "position": 21,
    "question": "A Nigerian project needs speed and adaptability but also strong control and accountability. Which approach does the module specifically present as homegrown for Nigerian realities and blending Agile, PRINCE2 and local insight?",
    "options": [
      "DUCAP.",
      "PMBOK.",
      "CPM.",
      "Waterfall."
    ],
    "correct": 1
  },
  {
    "position": 22,
    "question": "Which option contains ONLY DUCAP key features shown in the module?",
    "options": [
      "Unified Approach, Phased Iterative Lifecycle, Dual Accountability, Contextual Risk Management, Lightweight Documentation.",
      "Fixed Sequential Lifecycle, Single Accountability, Universal Risk Model, Heavy Documentation, No Iteration.",
      "Product Backlog, Sprint Planning, Daily Stand-up, Sprint Review, Sprint Retrospective.",
      "Critical Path, Zero Float, Crashing, Fast-Tracking, Network Diagram."
    ],
    "correct": 1
  },
  {
    "position": 23,
    "question": "A project has a fixed scope, more than 100 team members, high risk and relatively low stakeholder involvement. Which methodology receives the strongest overall support from the module’s selection criteria?",
    "options": [
      "PRINCE2.",
      "Kanban.",
      "Lean.",
      "Scrum."
    ],
    "correct": 1
  },
  {
    "position": 24,
    "question": "During methodology selection, the team records evolving scope, 10 team members, low-to-medium risk and high stakeholder involvement. Which family of approaches is most strongly supported by the module’s selection criteria?",
    "options": [
      "Agile-based approaches such as Scrum or Kanban.",
      "Waterfall only.",
      "PRINCE2 only.",
      "PMBOK as a standalone methodology."
    ],
    "correct": 1
  },
  {
    "position": 25,
    "question": "A scoring model uses three criteria: Scope Fit weight 0.40, Risk Fit weight 0.30 and Flexibility weight 0.30. Method A is rated 5, 4 and 2; Method B is rated 3, 3 and 5. Following the module’s weighted-scoring process, which conclusion is correct?",
    "options": [
      "Method A scores 3.80 and ranks above Method B at 3.60.",
      "Method B scores 4.10 and ranks above Method A at 3.20.",
      "Both methods score 3.50, so the model cannot distinguish them.",
      "The module requires choosing the lowest weighted score."
    ],
    "correct": 1
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
      'CIPMN-MOD-002:PPTX-V1:MCQ:' || (v_item->>'position')
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
      raise exception 'No correct option resolved for Module 2 MCQ position %.',v_item->>'position';
    end if;

    insert into public.question_answer_keys(question_id,correct_option_id)
    values(v_qid,v_correct_id);
  end loop;
end
$mcq_insert$;

do $theory_insert$
declare
  v_exam_id constant uuid := 'fe7a116b-72ef-5d1f-acc8-36938ee8b0cf';
  v_theory jsonb := $theory$
[
  {
    "position": 26,
    "question": "A ministry is launching a new programme and the project team has confused methodology with tools. The work must be structured from planning through closure, responsibilities are unclear, threats are not being tracked, and management wants consistent delivery. Using only the concepts in this module: (a) explain what a project management methodology is and how it differs from a tool; (b) identify four characteristics of a sound methodology; (c) explain four benefits of using a methodology; (d) select appropriate tools from WBS, Gantt Chart, Kanban Board, RACI Matrix and Risk Register for decomposing work, tracking time, clarifying roles and tracking threats; and (e) explain why the tools should support rather than replace the methodology.",
    "criteria": [
      {"name":"Methodology concept","marks":2,"expected":"Defines a methodology as a structured framework/way of working guiding planning, execution, monitoring and closure, and distinguishes it from a supporting tool."},
      {"name":"Characteristics","marks":2,"expected":"Identifies at least four source-listed characteristics such as process-driven, framework-based, best-practice oriented, repeatable/scalable and stakeholder-focused."},
      {"name":"Benefits","marks":2,"expected":"Explains source-listed benefits such as consistency, efficiency, risk control, quality assurance, strategic alignment, standardized processes, clear roles/communication, proactive risk management or stakeholder satisfaction."},
      {"name":"Tool selection","marks":2,"expected":"Correctly maps WBS to breaking down work, Gantt Chart to timelines, RACI Matrix to roles and Risk Register to threats; Kanban Board may be identified for visual workflow."},
      {"name":"Integration","marks":2,"expected":"Explains that tools support the methodology and do not replace the structured delivery approach."}
    ]
  },
  {
    "position": 27,
    "question": "A public programme contains two components. Component A is an infrastructure build with fixed scope, stable requirements and largely sequential work. Component B is a digital service with evolving scope, a small team and high stakeholder involvement. Using only this module: (a) recommend the most suitable approach for each component; (b) justify each recommendation using the module’s selection criteria; (c) compare relevant strengths and weaknesses of Waterfall and Agile; (d) explain when a hybrid approach would be appropriate; and (e) identify one supporting project tool that could assist each component and explain its use.",
    "criteria": [
      {"name":"Approach selection","marks":2,"expected":"Selects Waterfall/PRINCE2-aligned structured delivery for the fixed infrastructure component and an Agile-based approach for the evolving digital component."},
      {"name":"Selection criteria","marks":2,"expected":"Uses source criteria such as scope stability, team size, risk level and stakeholder involvement."},
      {"name":"Strengths and weaknesses","marks":2,"expected":"Accurately contrasts source-listed Waterfall strengths/weaknesses with Agile strengths/weaknesses."},
      {"name":"Hybrid reasoning","marks":2,"expected":"Explains hybrid as combining governance with flexibility, structure with adaptability, or control with speed where project conditions require both."},
      {"name":"Supporting tools","marks":2,"expected":"Selects source-listed tools appropriately, such as Gantt/WBS/RACI/Risk Register for structured work or Kanban Board for visual workflow."}
    ]
  },
  {
    "position": 28,
    "question": "A project network has the following paths from start to finish: Path 1 = A(3 days) → B(5 days) → D(4 days); Path 2 = A(3 days) → C(2 days) → D(4 days). Management also discovers that Activities B and C require the same single specialist if scheduled at the same time. Using only the CPM concepts in this module: (a) calculate the duration of each path; (b) identify the critical path; (c) state the minimum project duration; (d) explain what zero slack/float means for activities on the critical path and the likely effect of a delay to Activity B; and (e) explain the CPM limitation exposed by the specialist conflict and name the acceleration techniques the module says CPM can support.",
    "criteria": [
      {"name":"Path calculations","marks":2,"expected":"Calculates Path 1 as 12 days and Path 2 as 9 days."},
      {"name":"Critical path","marks":2,"expected":"Identifies A-B-D as the longest path and therefore the critical path."},
      {"name":"Minimum duration","marks":2,"expected":"States the minimum project duration as 12 days based on the critical path."},
      {"name":"Slack and delay","marks":2,"expected":"Explains that critical activities have zero slack/float and that delay on a critical activity threatens project completion time."},
      {"name":"Limitations and acceleration","marks":2,"expected":"Identifies resource-limit weakness and names crashing and/or fast-tracking as CPM-supported acceleration techniques."}
    ]
  },
  {
    "position": 29,
    "question": "An organization has three work environments: a product team delivering features in short cycles; a support team receiving unpredictable requests continuously; and an operations process with repeated waiting, rework and non-value-adding activities. Using only this module: (a) select Scrum, Kanban or Lean for each environment; (b) identify the Scrum roles shown in the module; (c) identify the Scrum events shown in the module; (d) explain the Kanban practices that make it suitable for unpredictable support work; and (e) explain the Lean principles that should guide the operations process, while noting two strengths or weaknesses of Agile from the module.",
    "criteria": [
      {"name":"Method selection","marks":2,"expected":"Maps Scrum to short-cycle product work, Kanban to continuous unpredictable support work and Lean to waste/inefficiency reduction."},
      {"name":"Scrum roles","marks":2,"expected":"Identifies Product Owner, Scrum Master and Development Team."},
      {"name":"Scrum events","marks":2,"expected":"Identifies Sprint Planning, Daily Stand-up, Sprint Review and Sprint Retrospective."},
      {"name":"Kanban","marks":2,"expected":"Explains continuous flow, limiting work in progress and no fixed Sprints."},
      {"name":"Lean and Agile evaluation","marks":2,"expected":"Explains waste elimination, customer value, reduced inefficiencies and continuous improvement/Kaizen, plus two source-listed Agile strengths or weaknesses."}
    ]
  },
  {
    "position": 30,
    "question": "A large Nigerian transformation project requires formal governance and auditability, but it also needs speed, iteration and sensitivity to local realities. Senior management is considering PRINCE2, PMBOK and DUCAP and wants to use a weighted scoring model before deciding. Using only this module: (a) explain the key characteristics and strengths of PRINCE2 that are relevant; (b) identify two PRINCE2 weaknesses; (c) correct the statement that PMBOK is itself a methodology and state how the module characterizes it; (d) explain why DUCAP may be relevant, including at least four DUCAP key features; and (e) outline the scoring-model steps in the correct order and explain how a hybrid approach could combine control with adaptability.",
    "criteria": [
      {"name":"PRINCE2","marks":2,"expected":"Explains source-listed PRINCE2 features/strengths such as process-driven structure, governance/accountability, Project Board roles, business-case focus, tailoring, audit/compliance suitability."},
      {"name":"PRINCE2 weaknesses","marks":2,"expected":"States two source-listed weaknesses such as bureaucracy/documentation burden, slow setup for small projects, less flexibility than Agile, trained-personnel need, innovation constraints or overkill for fast-moving teams."},
      {"name":"PMBOK","marks":2,"expected":"States that PMBOK is a global standard guide rather than a methodology and is adaptable to different methods; may mention 12 principles and 8 performance domains."},
      {"name":"DUCAP","marks":2,"expected":"Explains Nigerian/local relevance and at least four of Unified Approach, Phased Iterative Lifecycle, Dual Accountability, Contextual Risk Management and Lightweight Documentation; may note Agile + PRINCE2 + local insight."},
      {"name":"Scoring and hybrid","marks":2,"expected":"Orders the scoring process as define criteria, assign weights, rate methods, calculate weighted scores, choose the highest scorer, and explains hybrid combinations such as governance + flexibility/control + speed."}
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
      'CIPMN-MOD-002:PPTX-V1:THEORY:' || ((v_item->>'position')::integer-25)
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
      'CIPMN-MOD-002.pptx (37 slides; supplied 2026-09-25)',true
    );
  end loop;
end
$theory_insert$;

do $verify$
declare
  v_exam_id constant uuid := 'fe7a116b-72ef-5d1f-acc8-36938ee8b0cf';
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

  if v_mcq<>25 then raise exception 'Expected 25 active MCQs, found %.',v_mcq; end if;
  if v_theory<>5 then raise exception 'Expected 5 active Theory questions, found %.',v_theory; end if;
  if v_keys<>25 then raise exception 'Expected 25 answer keys, found %.',v_keys; end if;
  if v_options<>100 then raise exception 'Expected 100 active MCQ options, found %.',v_options; end if;
  if v_rubrics<>5 then raise exception 'Expected 5 active Theory rubrics, found %.',v_rubrics; end if;
  if v_bad_options<>0 then raise exception 'Found % MCQ(s) with invalid or repeated options.',v_bad_options; end if;
  if v_bad_rubrics<>0 then raise exception 'Found % invalid Theory rubric(s).',v_bad_rubrics; end if;
  if v_duplicate_texts<>0 then raise exception 'Found % repeated active question text(s).',v_duplicate_texts; end if;
end
$verify$;

commit;

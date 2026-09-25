begin;

-- CIPMN-MOD-003 assessment conversion and source-strict bank refresh.
-- Sole assessment source: CIPMN-MOD-003.pptx (50 slides), user library copy reviewed 2026-09-25.
-- Existing attempts, submitted answers, assignments and historical questions are preserved.

do $guard$
declare
  v_exam_id constant uuid := '916ed55c-e157-5e23-9d46-43ad4e2b9c2a';
  v_live integer;
  v_format text;
  v_active integer;
  v_marker uuid := public.cipmn_mock_seed_uuid('CIPMN-MOD-003:PPTX-V1:MCQ:1');
begin
  select exam_format into v_format
  from public.examinations
  where id=v_exam_id
  for update;

  if not found then
    raise exception 'CIPMN-MOD-003 examination not found.';
  end if;

  if v_format not in ('standard','cipmn_mixed') then
    raise exception 'Unexpected CIPMN-MOD-003 exam format: %',v_format;
  end if;

  if exists(select 1 from public.questions where id=v_marker and is_active) then
    raise exception 'CIPMN-MOD-003 PPTX-aligned bank is already active; refresh aborted.';
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
    raise exception 'CIPMN-MOD-003 has % genuinely live examination session(s); conversion aborted.',v_live;
  end if;

  select count(*) into v_active
  from public.questions
  where examination_id=v_exam_id and is_active;

  if v_format='standard' and v_active<>75 then
    raise exception 'Expected 75 active legacy questions before Module 3 conversion, found %.',v_active;
  end if;
end
$guard$;

-- Preserve the legacy bank for historical auditability; move it out of active positions.
update public.questions
set is_active=false,
    position=position+7000,
    updated_at=now()
where examination_id='916ed55c-e157-5e23-9d46-43ad4e2b9c2a'
  and is_active=true;

do $mcq_insert$
declare
  v_exam_id constant uuid := '916ed55c-e157-5e23-9d46-43ad4e2b9c2a';
  v_mcqs jsonb := $mcq$
[
  {
    "position":1,
    "question":"A newly appointed project manager receives a project with many activities but no agreed sequence from start to finish. Which concept from the Module 3 deck should be established first to provide clarity, organization and accountability across the project?",
    "options":[
      "A project lifecycle that structures the work from initiation through closure.",
      "A variance report prepared only after project completion.",
      "A stakeholder grid used as a substitute for lifecycle planning.",
      "A Monte Carlo simulation used to define project phases."
    ],
    "correct":1
  },
  {
    "position":2,
    "question":"A project is moving from concept to delivery. Which sequence correctly reflects the five lifecycle phases presented in the deck?",
    "options":[
      "Initiation → Planning → Execution → Monitoring & Control → Closure.",
      "Planning → Initiation → Monitoring & Control → Execution → Closure.",
      "Initiation → Execution → Planning → Closure → Monitoring & Control.",
      "Execution → Planning → Initiation → Monitoring & Control → Closure."
    ],
    "correct":1
  },
  {
    "position":3,
    "question":"A telecom programme has fixed civil-engineering works but an evolving customer-facing mobile interface requiring repeated feedback. Which lifecycle model best matches the example logic taught in the deck?",
    "options":[
      "Hybrid, because it can combine predictive structure with Agile adaptability.",
      "Predictive only, because every part of a telecom project must have fixed scope.",
      "Iterative only, because hybrid models exclude fixed-scope components.",
      "Agile only, because hybrid delivery does not permit formal planning."
    ],
    "correct":1
  },
  {
    "position":4,
    "question":"A pharmaceutical development project is divided into formal stages, and management must approve progress before the team moves to the next stage. Which lifecycle management tool is being applied?",
    "options":[
      "Stage-Gate framework.",
      "Resource histogram.",
      "Stakeholder Power-Interest Grid.",
      "Communication Matrix."
    ],
    "correct":1
  },
  {
    "position":5,
    "question":"A project scope is too broad for effective planning. The manager wants a deliverable-oriented hierarchy that decomposes the scope into manageable work packages. Which tool is the correct choice?",
    "options":[
      "Work Breakdown Structure.",
      "Project Dashboard.",
      "Sensitivity Analysis.",
      "Escalation Path."
    ],
    "correct":1
  },
  {
    "position":6,
    "question":"A sponsor asks, “When will each task happen and how is progress tracking against the timeline?” Which planning tool is best suited to answer this question?",
    "options":[
      "Gantt Chart.",
      "Risk Register.",
      "Power-Interest Grid.",
      "RACI Matrix."
    ],
    "correct":1
  },
  {
    "position":7,
    "question":"A team needs to understand which activity must occur before another, identify dependencies and determine where schedule slack exists. Which tool is most appropriate?",
    "options":[
      "Network Diagram.",
      "Communication Matrix.",
      "Stakeholder Dashboard.",
      "SWOT Analysis."
    ],
    "correct":1
  },
  {
    "position":8,
    "question":"A project has activity durations that are treated as fixed and management wants to identify the sequence of interdependent activities controlling project duration. Which technique best fits the deck?",
    "options":[
      "Critical Path Method (CPM).",
      "Program Evaluation Review Technique (PERT).",
      "Monte Carlo Simulation.",
      "Sensitivity Analysis."
    ],
    "correct":1
  },
  {
    "position":9,
    "question":"A research-and-development project has uncertain activity durations and management needs a probabilistic scheduling approach rather than fixed-duration assumptions. Which technique best fits?",
    "options":[
      "PERT.",
      "CPM.",
      "Gantt Chart only.",
      "RACI Matrix."
    ],
    "correct":1
  },
  {
    "position":10,
    "question":"At a reporting date, management wants one control technique that integrates scope, schedule and cost, comparing planned work, earned work and actual expenditure. Which tool should be used?",
    "options":[
      "Earned Value Management.",
      "Stakeholder Power-Interest Grid.",
      "Stage-Gate Framework.",
      "SWOT Analysis."
    ],
    "correct":1
  },
  {
    "position":11,
    "question":"Which statement correctly distinguishes the three EVM components defined in the deck?",
    "options":[
      "PV is authorized budget for scheduled work; EV is budgeted value of work performed; AC is actual cost incurred for work performed.",
      "PV is actual money spent; EV is forecast risk exposure; AC is authorized budget for scheduled work.",
      "PV is stakeholder interest; EV is project scope; AC is schedule variance.",
      "PV is critical-path duration; EV is float; AC is resource utilization."
    ],
    "correct":1
  },
  {
    "position":12,
    "question":"Two critical activities require the same engineer at the same time. The manager adjusts task schedules to smooth the demand and reduce resource peaks. Which practice is being applied?",
    "options":[
      "Resource leveling.",
      "Variance reporting.",
      "Stakeholder engagement.",
      "Sensitivity analysis."
    ],
    "correct":1
  },
  {
    "position":13,
    "question":"A deadline must be shortened. The team adds resources specifically to activities on the critical path, accepting higher cost to reduce project duration. Which technique is this?",
    "options":[
      "Crashing.",
      "Resource allocation only.",
      "Stakeholder prioritization.",
      "Variance reporting."
    ],
    "correct":1
  },
  {
    "position":14,
    "question":"Senior management wants a centralized visual interface showing project status, resources and risks in near real time, while analysts still need deeper comparison of baseline versus actual performance. Which combination best matches the deck?",
    "options":[
      "Project Dashboard plus Variance Reporting.",
      "RACI Matrix plus Stakeholder Grid.",
      "SWOT plus Escalation Path.",
      "WBS plus Communication Matrix."
    ],
    "correct":1
  },
  {
    "position":15,
    "question":"A team needs an early-stage strategic snapshot of internal strengths and weaknesses together with external opportunities and threats. Which risk-related tool should it use?",
    "options":[
      "SWOT Analysis.",
      "Risk Register.",
      "Monte Carlo Simulation.",
      "EVM."
    ],
    "correct":1
  },
  {
    "position":16,
    "question":"A project manager wants one centralized record of identified risks, their assessment and mitigation information so that accountability and communication can be maintained over time. Which tool is most appropriate?",
    "options":[
      "Risk Register.",
      "Gantt Chart.",
      "Stage-Gate Framework.",
      "RACI Matrix."
    ],
    "correct":1
  },
  {
    "position":17,
    "question":"Management wants a probability-based forecast of possible project outcomes under uncertainty, using repeated random sampling to support contingency planning. Which quantitative risk tool should be selected?",
    "options":[
      "Monte Carlo Simulation.",
      "Sensitivity Analysis.",
      "SWOT Analysis.",
      "Variance Reporting."
    ],
    "correct":1
  },
  {
    "position":18,
    "question":"A project director wants to know which single variable most strongly drives changes in project outcomes, but does not need a probability of occurrence. Which quantitative tool is the better fit?",
    "options":[
      "Sensitivity Analysis.",
      "Monte Carlo Simulation.",
      "Risk Register.",
      "Project Dashboard."
    ],
    "correct":1
  },
  {
    "position":19,
    "question":"A stakeholder initially has low influence but later gains regulatory authority. Which statement best reflects the deck’s guidance on the Power-Interest Grid?",
    "options":[
      "The grid should be updated because stakeholder power and interest can change over time.",
      "The original classification should never change once approved.",
      "Only stakeholder interest matters; power is irrelevant.",
      "The grid should be replaced by a Gantt Chart."
    ],
    "correct":1
  },
  {
    "position":20,
    "question":"A stakeholder has high power and high interest in a community infrastructure project. Based on the purpose of stakeholder analysis and engagement tools in the deck, what should the project team do?",
    "options":[
      "Prioritize and actively manage the stakeholder with tailored communication and involvement.",
      "Minimize communication because powerful stakeholders require fewer updates.",
      "Classify the stakeholder once and avoid further monitoring.",
      "Use only a Risk Register because stakeholder tools are unnecessary."
    ],
    "correct":1
  },
  {
    "position":21,
    "question":"For one project task, three people are marked Accountable in the RACI Matrix. Which correction is required according to the deck?",
    "options":[
      "Identify only one Accountable owner for the task, while other roles may be Responsible, Consulted or Informed.",
      "Remove the Accountable role entirely because only Responsible is required.",
      "Convert every stakeholder to Informed to avoid conflict.",
      "Assign the same person as Responsible, Accountable, Consulted and Informed for every task."
    ],
    "correct":1
  },
  {
    "position":22,
    "question":"A project repeatedly suffers from information gaps because stakeholders are unsure what information they should receive, who should send it, which channel to use and when communication should occur. Which tool directly addresses this problem?",
    "options":[
      "Communication Matrix.",
      "Critical Path Method.",
      "Resource Histogram.",
      "SWOT Analysis."
    ],
    "correct":1
  },
  {
    "position":23,
    "question":"An issue exceeds the authority of the project manager and requires sponsor action within a defined response time. Which tool should specify the trigger, escalation levels, responsible role, channel, response time and final decision authority?",
    "options":[
      "Escalation Path.",
      "Work Breakdown Structure.",
      "Gantt Chart.",
      "PERT."
    ],
    "correct":1
  },
  {
    "position":24,
    "question":"A project manager needs ongoing evidence of changing stakeholder attitudes, conflicts and participation so communication strategy can be adjusted. Which set contains only stakeholder monitoring tools listed in the deck?",
    "options":[
      "Stakeholder Register, Engagement Assessment Matrix, Dashboards/Scorecards, Feedback Tools, Issue/Escalation Logs.",
      "WBS, CPM, PERT, Gantt Chart, EVM.",
      "SWOT, Monte Carlo, Resource Histogram, Crashing, Stage-Gate.",
      "RACI, Network Diagram, Primavera P6, Fast Tracking, EVM."
    ],
    "correct":1
  },
  {
    "position":25,
    "question":"A Nigerian multi-agency project faces community resistance, variable funding, approval delays and infrastructure constraints. Which response best reflects the deck’s overall concept of project delivery conceptual tools?",
    "options":[
      "Combine suitable lifecycle, planning/control, risk, stakeholder and communication tools to shape delivery around project realities.",
      "Use one tool for every problem so the project remains methodologically pure.",
      "Ignore stakeholder and communication tools because they do not affect delivery.",
      "Choose tools only after project closure, when delivery issues are fully known."
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
      'CIPMN-MOD-003:PPTX-V1:MCQ:' || (v_item->>'position')
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
      raise exception 'No correct option resolved for Module 3 MCQ position %.',v_item->>'position';
    end if;

    insert into public.question_answer_keys(question_id,correct_option_id)
    values(v_qid,v_correct_id);
  end loop;
end
$mcq_insert$;

do $theory_insert$
declare
  v_exam_id constant uuid := '916ed55c-e157-5e23-9d46-43ad4e2b9c2a';
  v_theory jsonb := $theory$
[
  {
    "position":26,
    "question":"A Nigerian public-sector programme is moving from concept into delivery. The initiative has defined infrastructure outputs, a digital component that may evolve, multiple approval points and several agencies. Using only Module 3: (a) explain the purpose of the project lifecycle and name its five phases in order; (b) compare Predictive, Iterative, Agile and Hybrid lifecycle models; (c) recommend a suitable lifecycle approach for this programme and justify it; (d) explain how Stage-Gate, WBS, milestones and critical-path concepts can support lifecycle management; and (e) explain why project delivery tools must be matched to project nature, stakeholder needs and risks.",
    "criteria":[
      {"name":"Lifecycle concept and phases","marks":2,"expected":"Explains the lifecycle as the structured sequence from start to completion and correctly names Initiation, Planning, Execution, Monitoring & Control, and Closure."},
      {"name":"Lifecycle models","marks":2,"expected":"Accurately distinguishes Predictive as plan-driven/fixed scope, Iterative as repeated cycles/refinement, Agile as change-driven/adaptive with continuous feedback, and Hybrid as a blend of predictive and agile."},
      {"name":"Model recommendation","marks":2,"expected":"Makes a source-consistent recommendation, reasonably favouring Hybrid where fixed infrastructure and evolving digital work coexist, and justifies the choice."},
      {"name":"Lifecycle tools","marks":2,"expected":"Explains Stage-Gate as staged approval checkpoints, WBS as deliverable decomposition, milestones as checkpoints, and critical path as the longest dependent sequence controlling minimum completion time."},
      {"name":"Contextual fit","marks":2,"expected":"Links tool/model choice to project nature, stakeholder needs, risks and Nigerian delivery realities such as multi-agency approvals, community engagement, variable funding or infrastructure constraints."}
    ]
  },
  {
    "position":27,
    "question":"A complex construction project is behind schedule and management needs stronger planning and control. Using only Module 3: (a) distinguish the information provided by a Gantt Chart and a Network Diagram; (b) compare CPM and PERT, including their assumptions; (c) explain how resource allocation differs from resource leveling; (d) explain time-cost trade-offs and crashing, including why crashing should focus on critical-path activities; and (e) explain how Project Dashboards and Variance Reporting complement one another in monitoring performance.",
    "criteria":[
      {"name":"Gantt and Network Diagram","marks":2,"expected":"Explains Gantt as activities/tasks displayed against a timeline and Network Diagram as activity dependencies/sequence used to show what must happen first, estimate duration and highlight float."},
      {"name":"CPM and PERT","marks":2,"expected":"Explains CPM as deterministic/fixed-duration critical-path planning and PERT as probabilistic/uncertainty-oriented scheduling."},
      {"name":"Resources","marks":2,"expected":"Distinguishes resource allocation as assigning time, money, personnel/equipment to tasks from leveling as adjusting schedules to reduce peaks/imbalances in resource demand."},
      {"name":"Time-cost and crashing","marks":2,"expected":"Explains duration-cost trade-offs and crashing as adding resources to critical-path activities to accelerate completion while managing added cost/resources."},
      {"name":"Dashboards and variance","marks":2,"expected":"Explains dashboards as centralized visual visibility and variance reporting as planned-versus-actual analytical comparison; states that they complement one another."}
    ]
  },
  {
    "position":28,
    "question":"A programme manager reports that the project is spending more than expected and progress information is fragmented. Using only Module 3: (a) define Earned Value Management and explain why it is useful; (b) distinguish Planned Value, Earned Value and Actual Cost; (c) state key EVM advantages and limitations from the deck; (d) explain how EVM can support forecasting, resource allocation and stakeholder communication; and (e) explain why accurate baseline and performance data are necessary for meaningful project control.",
    "criteria":[
      {"name":"EVM concept","marks":2,"expected":"Defines EVM as a technique integrating scope, time and cost to objectively measure project performance/progress against the baseline."},
      {"name":"PV EV AC","marks":2,"expected":"Correctly defines PV as authorized budget/planned cost of scheduled work, EV as budgeted value of work performed, and AC as actual cost incurred for work performed."},
      {"name":"Advantages and limitations","marks":2,"expected":"States source-listed advantages such as objective measurement, early warning, improved forecasting/accountability and limitations such as accurate-data requirement, complexity or limited qualitative insight."},
      {"name":"Management use","marks":2,"expected":"Explains EVM as a forecasting/control tool that can improve resource allocation, project health visibility and stakeholder communication."},
      {"name":"Data and baseline discipline","marks":2,"expected":"Explains that reliable performance assessment depends on accurate baseline and actual data; links this to monitoring and corrective decision-making."}
    ]
  },
  {
    "position":29,
    "question":"A donor-funded water project faces procurement uncertainty, community resistance, governance concerns and uncertain cost/schedule outcomes. Using only Module 3: (a) explain how SWOT and a Risk Register serve different purposes; (b) compare Monte Carlo Simulation and Sensitivity Analysis; (c) identify advantages and limitations of each quantitative risk tool; (d) explain how the tools support contingency planning and proactive management; and (e) recommend an integrated risk-analysis approach for the project.",
    "criteria":[
      {"name":"SWOT and Risk Register","marks":2,"expected":"Explains SWOT as a strategic snapshot of strengths, weaknesses, opportunities and threats, and the Risk Register as a centralized record/database of identified project risks for tracking, communication and accountability."},
      {"name":"Monte Carlo vs Sensitivity","marks":2,"expected":"Explains Monte Carlo as probability/random-sampling modelling of uncertainty and Sensitivity Analysis as testing how changes in one variable affect outcomes/identifying critical drivers."},
      {"name":"Advantages and limitations","marks":2,"expected":"Accurately states source-listed strengths and limitations, including data/software intensity for Monte Carlo and interaction/probability limitations for Sensitivity Analysis."},
      {"name":"Contingency and proactive use","marks":2,"expected":"Explains how quantitative analysis reveals uncertainty/drivers, supports contingency planning, prioritization, negotiations, transparency or proactive management."},
      {"name":"Integrated recommendation","marks":2,"expected":"Recommends a sensible combination of qualitative identification/recording and quantitative analysis, grounded in the deck rather than introducing unsupported external tools."}
    ]
  },
  {
    "position":30,
    "question":"A multi-agency infrastructure project involves regulators, donors, host communities, contractors and a steering committee. Communication failures and unresolved issues are causing delay. Using only Module 3: (a) explain how the Stakeholder Power-Interest Grid should be used and why it must be updated; (b) propose appropriate stakeholder engagement and monitoring practices from the deck; (c) explain RACI roles and the rule for Accountable; (d) explain how a Communication Matrix should structure information flow; and (e) design the essential components of an Escalation Path for issues beyond team authority.",
    "criteria":[
      {"name":"Power-Interest Grid","marks":2,"expected":"Explains mapping stakeholders by power/influence and interest, prioritizing engagement accordingly, and updating the grid because stakeholder power/interest can change."},
      {"name":"Engagement and monitoring","marks":2,"expected":"Uses source-listed practices such as mapping/prioritization, tailored communication, participation, expectation management, continuous relationship building, stakeholder registers, engagement matrices, dashboards/scorecards, feedback tools or issue logs."},
      {"name":"RACI","marks":2,"expected":"Defines Responsible, Accountable, Consulted and Informed correctly and states there should be only one Accountable owner per task."},
      {"name":"Communication Matrix","marks":2,"expected":"Explains that it defines who communicates what, to whom, how and when, supporting clarity, timely information, decision-making, transparency and trust."},
      {"name":"Escalation Path","marks":2,"expected":"Includes trigger/issue, escalation levels, responsible role, channel, response time and resolution authority, and links escalation to faster decisions/accountability."}
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
      'CIPMN-MOD-003:PPTX-V1:THEORY:' || ((v_item->>'position')::integer-25)
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
      'CIPMN-MOD-003.pptx (50 slides; reviewed 2026-09-25)',true
    );
  end loop;
end
$theory_insert$;

do $verify$
declare
  v_exam_id constant uuid := '916ed55c-e157-5e23-9d46-43ad4e2b9c2a';
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

  if v_mcq<>25 then raise exception 'Expected 25 active Module 3 MCQs, found %.',v_mcq; end if;
  if v_theory<>5 then raise exception 'Expected 5 active Module 3 Theory questions, found %.',v_theory; end if;
  if v_keys<>25 then raise exception 'Expected 25 Module 3 answer keys, found %.',v_keys; end if;
  if v_options<>100 then raise exception 'Expected 100 active Module 3 MCQ options, found %.',v_options; end if;
  if v_rubrics<>5 then raise exception 'Expected 5 active Module 3 Theory rubrics, found %.',v_rubrics; end if;
  if v_bad_options<>0 then raise exception 'Found % Module 3 MCQ(s) with invalid/repeated options.',v_bad_options; end if;
  if v_bad_rubrics<>0 then raise exception 'Found % invalid Module 3 Theory rubric(s).',v_bad_rubrics; end if;
  if v_duplicate_texts<>0 then raise exception 'Found % repeated active Module 3 question text(s).',v_duplicate_texts; end if;
end
$verify$;

update public.examinations
set exam_format='cipmn_mixed',
    updated_at=now()
where id='916ed55c-e157-5e23-9d46-43ad4e2b9c2a';

commit;

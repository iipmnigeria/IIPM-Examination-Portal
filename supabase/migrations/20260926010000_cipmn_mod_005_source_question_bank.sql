begin;

-- CIPMN-MOD-005 assessment conversion and source-strict bank refresh.
-- Official assessment sources:
-- 1) CIPMN - MOD-005.pdf (Project Risk and Issues Management)
-- 2) CIPMN-MOD-005.pptx
-- Reviewed 2026-09-25.
-- Historical attempts, submitted answers, assignments and retired questions are preserved.

do $guard$
declare
  v_exam_id constant uuid := 'd0c77c9c-a711-5864-97ac-c930ca231773';
  v_live integer;
  v_format text;
  v_active integer;
  v_marker uuid := public.cipmn_mock_seed_uuid('CIPMN-MOD-005:SOURCES-V1:MCQ:1');
begin
  select exam_format into v_format
  from public.examinations
  where id=v_exam_id
  for update;

  if not found then
    raise exception 'CIPMN-MOD-005 examination not found.';
  end if;

  if v_format not in ('standard','cipmn_mixed') then
    raise exception 'Unexpected CIPMN-MOD-005 exam format: %',v_format;
  end if;

  if exists(select 1 from public.questions where id=v_marker and is_active) then
    raise exception 'CIPMN-MOD-005 source-aligned bank is already active; refresh aborted.';
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
    raise exception 'CIPMN-MOD-005 has % genuinely live examination session(s); conversion aborted.',v_live;
  end if;

  select count(*) into v_active
  from public.questions
  where examination_id=v_exam_id and is_active;

  if v_format='standard' and v_active<>75 then
    raise exception 'Expected 75 active legacy Module 5 questions, found %.',v_active;
  end if;
end
$guard$;

update public.questions
set is_active=false,
    position=position+11000,
    updated_at=now()
where examination_id='d0c77c9c-a711-5864-97ac-c930ca231773'
  and is_active=true;

do $mcq_insert$
declare
  v_exam_id constant uuid := 'd0c77c9c-a711-5864-97ac-c930ca231773';
  v_mcqs jsonb := $mcq$
[
  {
    "position":1,
    "question":"A supplier delay has not yet happened but could affect schedule and cost if it occurs. At the same time, an approved vendor has already missed a delivery date. How should the two situations be classified?",
    "options":[
      "The possible future delay is a risk; the missed delivery is an issue.",
      "Both are risks because they relate to the same supplier.",
      "Both are issues because schedule may be affected.",
      "The future delay is an issue; the missed delivery is a risk."
    ],
    "correct":1
  },
  {
    "position":2,
    "question":"Which statement best reflects the official Module 5 view of risk in project management?",
    "options":[
      "Risk is only a negative event that must be eliminated.",
      "Risk is an uncertain event or condition that may have a positive or negative effect on project objectives.",
      "Risk is any current project problem requiring immediate resolution.",
      "Risk is a confirmed variance that has already occurred."
    ],
    "correct":2
  },
  {
    "position":3,
    "question":"A project manager wants to structure risk management before identifying individual risks. Which action belongs first in the seven-step process described in the official PDF?",
    "options":[
      "Perform Quantitative Risk Analysis.",
      "Plan Risk Responses.",
      "Plan Risk Management.",
      "Monitor Risks."
    ],
    "correct":3
  },
  {
    "position":4,
    "question":"A team wants the broadest possible initial list of threats and opportunities before analysis. Which technique is most directly designed for that purpose?",
    "options":[
      "Brainstorming.",
      "Risk Audit.",
      "Variance Analysis.",
      "Issue Escalation Matrix."
    ],
    "correct":1
  },
  {
    "position":5,
    "question":"The project is based on the assumption that a regulator will approve a permit within 30 days. The team wants to test whether that assumption itself creates uncertainty. Which identification technique best fits?",
    "options":[
      "Checklist Analysis.",
      "Assumption Analysis.",
      "Risk Heat Map.",
      "Expected Monetary Value."
    ],
    "correct":2
  },
  {
    "position":6,
    "question":"A project has limited historical data, but several experienced specialists can independently assess likely risks and converge on a consensus. Which technique is best aligned with the module?",
    "options":[
      "Delphi Technique.",
      "Gantt Chart.",
      "Issue Log.",
      "Risk Radar."
    ],
    "correct":1
  },
  {
    "position":7,
    "question":"A school-renovation programme classifies risks as technical, external, organizational and project-management risks. What is the principal purpose of this categorization?",
    "options":[
      "To calculate Expected Monetary Value for every risk.",
      "To understand risk sources, patterns and accountability so risks can be tracked and managed systematically.",
      "To convert every risk into an issue for immediate escalation.",
      "To remove the need for prioritization."
    ],
    "correct":2
  },
  {
    "position":8,
    "question":"A risk breakdown structure is being created. Which description best matches its use in the official Module 5 materials?",
    "options":[
      "A hierarchical decomposition of risks into categories and subcategories.",
      "A schedule showing when each risk will occur.",
      "A log used only after risks become issues.",
      "A financial calculation of risk-adjusted cash flow."
    ],
    "correct":1
  },
  {
    "position":9,
    "question":"A risk has high probability and high impact and therefore appears in the red zone of a probability-impact matrix. What is the most appropriate interpretation?",
    "options":[
      "It should normally receive high priority for response planning and monitoring.",
      "It can be ignored because red indicates the risk is already controlled.",
      "It should automatically be transferred to a third party.",
      "It should be removed from the risk register and entered only in the issue log."
    ],
    "correct":1
  },
  {
    "position":10,
    "question":"Two risks have similar probability and impact, but one may occur next week while the other is unlikely for six months. Which official prioritization concept helps distinguish them?",
    "options":[
      "Risk urgency assessment.",
      "Root cause analysis.",
      "Issue ownership.",
      "Fallback planning."
    ],
    "correct":1
  },
  {
    "position":11,
    "question":"A risk has a 30% probability of causing a ₦20,000,000 loss. Using the Module 5 EMV approach, what is the risk exposure?",
    "options":[
      "₦6,000,000.",
      "₦20,000,000.",
      "₦14,000,000.",
      "₦60,000,000."
    ],
    "correct":1
  },
  {
    "position":12,
    "question":"Management needs to compare alternative decisions whose outcomes have different probabilities and financial consequences. Which tool is expressly used to map decision paths and evaluate risk-adjusted outcomes?",
    "options":[
      "Decision Tree.",
      "SWOT Analysis.",
      "Issue Log.",
      "Risk Breakdown Structure."
    ],
    "correct":1
  },
  {
    "position":13,
    "question":"A schedule model is run thousands of times using probability distributions to estimate the likelihood of meeting the completion date. Which technique is being applied?",
    "options":[
      "Sensitivity Analysis.",
      "Monte Carlo Simulation.",
      "Qualitative Risk Matrix.",
      "Checklist Analysis."
    ],
    "correct":2
  },
  {
    "position":14,
    "question":"A project director wants to know which uncertain variable has the greatest influence on project cost. Which technique, often displayed with a tornado diagram, is most appropriate?",
    "options":[
      "Sensitivity Analysis.",
      "Brainstorming.",
      "Issue Prioritization.",
      "Risk Reassessment."
    ],
    "correct":1
  },
  {
    "position":15,
    "question":"A contractor proposes insurance to shift the financial consequences of a specific threat to another party. Which negative-risk response strategy is being used?",
    "options":[
      "Avoid.",
      "Mitigate.",
      "Transfer.",
      "Exploit."
    ],
    "correct":3
  },
  {
    "position":16,
    "question":"A favourable market condition could increase project benefits. The project forms a strategic alliance so both parties can maximize the opportunity. Which positive-risk response is this?",
    "options":[
      "Share.",
      "Accept.",
      "Mitigate.",
      "Transfer."
    ],
    "correct":1
  },
  {
    "position":17,
    "question":"After a mitigation action is implemented, some exposure still remains. What term does the module use for that remaining exposure?",
    "options":[
      "Residual Risk.",
      "Secondary Risk.",
      "Risk Threshold.",
      "Issue Priority."
    ],
    "correct":1
  },
  {
    "position":18,
    "question":"A mitigation action introduces a new cybersecurity exposure that did not exist before the response was implemented. How should the new exposure be classified?",
    "options":[
      "Residual Risk.",
      "Secondary Risk.",
      "Accepted Issue.",
      "Risk Appetite."
    ],
    "correct":2
  },
  {
    "position":19,
    "question":"Which statement correctly distinguishes contingency and fallback planning in the official materials?",
    "options":[
      "A contingency plan is predefined action if a risk materializes; a fallback plan is an alternative if the primary response fails.",
      "A contingency plan replaces the risk register; a fallback plan replaces the issue log.",
      "A contingency plan is only for positive risks; a fallback plan is only for negative risks.",
      "They are identical terms and can always be used interchangeably."
    ],
    "correct":1
  },
  {
    "position":20,
    "question":"A project has already encountered a licensing problem that has stopped field work. Which sequence best reflects the Module 5 issue-management process?",
    "options":[
      "Identify → Log and classify → Prioritize and escalate → Assign ownership → Monitor and close.",
      "Analyze probability → Calculate EMV → Avoid → Monitor → Close.",
      "Identify → Exploit → Transfer → Update Risk Appetite → Close.",
      "Document as a future risk → Wait for recurrence → Assign ownership → Close."
    ],
    "correct":1
  },
  {
    "position":21,
    "question":"A severe issue exceeds the project manager's authority. Which information should a proper escalation process define?",
    "options":[
      "Trigger, escalation levels, responsible role, escalation channel, response time and resolution authority.",
      "Only the issue title and date discovered.",
      "Only the probability and impact score.",
      "Only the final sponsor decision."
    ],
    "correct":1
  },
  {
    "position":22,
    "question":"Which statement best distinguishes a Risk Register from an Issues Log?",
    "options":[
      "The Risk Register tracks uncertain future risks and responses; the Issues Log tracks current problems, owners, priorities, resolution plans and status.",
      "The Risk Register is only for positive risks, while the Issues Log is only for negative risks.",
      "The Issues Log records probabilities for events that have not happened.",
      "The two documents are interchangeable because both track uncertainty."
    ],
    "correct":1
  },
  {
    "position":23,
    "question":"A project team wants a dynamic visual tool that helps identify, assess, prioritize and continuously monitor threats so high-risk areas are immediately visible. Which tool is described this way in the Module 5 materials?",
    "options":[
      "Risk Radar.",
      "Gantt Chart.",
      "Issue Log.",
      "SWOT Matrix only."
    ],
    "correct":1
  },
  {
    "position":24,
    "question":"A sponsor, regulator and field team need different levels of detail about the same project risk. Which communication practice is most consistent with the module?",
    "options":[
      "Use clear, transparent, stakeholder-specific messages, appropriate channels and regular updates.",
      "Send the same highly technical message to every stakeholder regardless of role.",
      "Communicate risks only after they become issues.",
      "Avoid dashboards and written updates because risk information should remain informal."
    ],
    "correct":1
  },
  {
    "position":25,
    "question":"A completed project review reveals that repeated vendor risks were handled inconsistently. What is the most appropriate continuous-improvement response from the Module 5 materials?",
    "options":[
      "Capture lessons learned and use them to improve future risk identification, planning and response processes.",
      "Delete prior risk records so future teams are not influenced by old events.",
      "Treat all previous issues as closed and irrelevant to future work.",
      "Replace the risk process with ad hoc management because each project is unique."
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
      'CIPMN-MOD-005:SOURCES-V1:MCQ:' || (v_item->>'position')
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
      raise exception 'No correct option resolved for Module 5 MCQ position %.',v_item->>'position';
    end if;

    insert into public.question_answer_keys(question_id,correct_option_id)
    values(v_qid,v_correct_id);
  end loop;
end
$mcq_insert$;

do $theory_insert$
declare
  v_exam_id constant uuid := 'd0c77c9c-a711-5864-97ac-c930ca231773';
  v_theory jsonb := $theory$
[
  {
    "position":26,
    "question":"A Nigerian infrastructure project is entering execution with uncertainty around permits, supply chains, community relations and technical performance. Using only the official Module 5 materials: (a) distinguish risks from issues and explain positive and negative risks; (b) describe the main risk-management process from planning through monitoring; (c) recommend at least four structured risk-identification techniques and explain when they are useful; (d) explain how categorization and prioritization should work together; and (e) explain why risk management should be continuous, proactive, documented and stakeholder-inclusive.",
    "criteria":[
      {"name":"Risk vs issue and opportunity/threat","marks":2,"expected":"Defines risk as an uncertain future event/condition that may be positive or negative and an issue as a current problem requiring resolution; distinguishes opportunity and threat."},
      {"name":"Risk-management process","marks":2,"expected":"Explains planning, identification, qualitative/quantitative analysis, response planning/implementation and monitoring in a source-consistent sequence."},
      {"name":"Identification techniques","marks":2,"expected":"Uses official techniques such as brainstorming, SWOT, interviews, Delphi, checklists, assumption analysis or root-cause analysis with appropriate rationale."},
      {"name":"Categorization and prioritization","marks":2,"expected":"Explains grouping risks by source/objective/phase/stakeholder/RBS and then ranking them using probability, impact, urgency or quantitative exposure so resources focus on critical risks."},
      {"name":"Risk-management fundamentals","marks":2,"expected":"Explains proactivity, uncertainty management, integration, stakeholder involvement and documentation through Risk Register/Risk Reports."}
    ]
  },
  {
    "position":27,
    "question":"A project has identified several risks and management needs a defensible basis for deciding which deserve the most attention. Using only Module 5: (a) distinguish qualitative from quantitative risk analysis; (b) explain the Probability-Impact Matrix and heat-map interpretation; (c) calculate the EMV of a 25% probability event with a ₦40,000,000 impact and explain what the result means; (d) compare Monte Carlo Simulation, Sensitivity Analysis/Tornado Diagrams and Decision Trees; and (e) explain how risk data quality, urgency and risk scoring can affect prioritization.",
    "criteria":[
      {"name":"Qualitative vs quantitative","marks":2,"expected":"Explains qualitative analysis as relative/subjective probability-impact prioritization and quantitative analysis as numerical modelling of potential effects on objectives."},
      {"name":"P-I Matrix and heat map","marks":2,"expected":"Explains probability-impact plotting, red/yellow/green prioritization and why high-probability/high-impact risks receive greater attention."},
      {"name":"EMV","marks":2,"expected":"Calculates 0.25 × ₦40,000,000 = ₦10,000,000 and explains it as risk exposure/expected monetary value rather than a guaranteed loss."},
      {"name":"Quantitative tools","marks":2,"expected":"Distinguishes Monte Carlo repeated simulation/probability distributions, Sensitivity/Tornado analysis of key drivers, and Decision Trees for branching choices and risk-adjusted outcomes."},
      {"name":"Prioritization quality","marks":2,"expected":"Explains data-quality assessment, urgency/proximity and risk scoring/heat maps as factors that improve the reliability and timing of prioritization."}
    ]
  },
  {
    "position":28,
    "question":"A public-sector project has four threats and two opportunities. Using only Module 5: (a) explain the four main response strategies for negative risks; (b) explain the four strategies for positive risks; (c) distinguish contingency plans from fallback plans; (d) explain residual and secondary risks; and (e) describe how response ownership, implementation and monitoring should be documented in the Risk Register.",
    "criteria":[
      {"name":"Threat responses","marks":2,"expected":"Explains Avoid, Mitigate, Transfer and Accept accurately and in source-consistent terms."},
      {"name":"Opportunity responses","marks":2,"expected":"Explains Exploit, Enhance, Share and Accept accurately and in source-consistent terms."},
      {"name":"Contingency and fallback","marks":2,"expected":"Distinguishes predefined actions if a risk materializes from an alternative strategy if the primary response fails."},
      {"name":"Residual and secondary risks","marks":2,"expected":"Defines residual risk as exposure remaining after mitigation and secondary risk as new risk caused by the response."},
      {"name":"Ownership and monitoring","marks":2,"expected":"Explains assigning a risk owner, recording responses/contingencies/status in the Risk Register, implementing actions and continuously monitoring effectiveness/new risks."}
    ]
  },
  {
    "position":29,
    "question":"During a telecom rollout, a licensing problem has already stopped work and cannot be resolved within the project manager's authority. Using only Module 5: (a) explain why this is an issue rather than a risk; (b) describe the issue-management process from identification to closure; (c) explain how impact and urgency should guide prioritization; (d) design an escalation path using the key components taught in the module; and (e) explain the purpose and key information of an Issues Log and how it supports accountability, communication and historical learning.",
    "criteria":[
      {"name":"Issue classification","marks":2,"expected":"Explains that the licensing problem has already occurred, is current and requires immediate resolution, so it is an issue rather than a future uncertainty."},
      {"name":"Issue-management process","marks":2,"expected":"Describes identifying, logging/classifying, prioritizing/escalating, assigning ownership, monitoring and closing the issue."},
      {"name":"Prioritization","marks":2,"expected":"Explains prioritization based on impact and urgency, including immediate escalation for high-priority issues where appropriate."},
      {"name":"Escalation path","marks":2,"expected":"Includes trigger, escalation levels/hierarchy, responsible role, channel, response time and resolution authority."},
      {"name":"Issues Log","marks":2,"expected":"Explains recording issue description, priority, owner, resolution plan, status/escalation notes and its role in tracking, accountability, communication and historical reference."}
    ]
  },
  {
    "position":30,
    "question":"A geographically dispersed project has technically sound risk analysis but poor stakeholder confidence because risk information is inconsistent and late. Using only Module 5: (a) explain the purpose of risk communication and stakeholder engagement; (b) recommend communication practices covering clarity, transparency, channels, frequency and stakeholder-specific messaging; (c) explain how dashboards, Risk Radar, risk registers and issue logs can support visibility; (d) explain how early warning indicators, reassessments, audits and lessons learned strengthen monitoring and continuous improvement; and (e) describe how these practices support trust, alignment and proactive decision-making.",
    "criteria":[
      {"name":"Communication and engagement purpose","marks":2,"expected":"Explains sharing risk/issue information to maintain transparency, alignment, trust and meaningful stakeholder involvement throughout the lifecycle."},
      {"name":"Communication practice","marks":2,"expected":"Uses simple/clear language, regular updates, appropriate channels, stakeholder-specific tone/detail and transparent messaging."},
      {"name":"Visibility tools","marks":2,"expected":"Explains dashboards/Risk Radar for visual monitoring and registers/logs for structured tracking, ownership, status and accountability."},
      {"name":"Monitoring and learning","marks":2,"expected":"Explains early warning indicators, reassessments, audits/reviews and lessons learned as means to detect change, assess effectiveness and improve future risk practice."},
      {"name":"Management value","marks":2,"expected":"Links communication and monitoring to stakeholder confidence, alignment, proactive intervention, informed decisions and continuous improvement."}
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
      'CIPMN-MOD-005:SOURCES-V1:THEORY:' || ((v_item->>'position')::integer-25)
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
      'CIPMN-MOD-005 official PDF + PPTX; reviewed 2026-09-25',true
    );
  end loop;
end
$theory_insert$;

do $verify$
declare
  v_exam_id constant uuid := 'd0c77c9c-a711-5864-97ac-c930ca231773';
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

  if v_mcq<>25 then raise exception 'Expected 25 active Module 5 MCQs, found %.',v_mcq; end if;
  if v_theory<>5 then raise exception 'Expected 5 active Module 5 Theory questions, found %.',v_theory; end if;
  if v_keys<>25 then raise exception 'Expected 25 Module 5 answer keys, found %.',v_keys; end if;
  if v_options<>100 then raise exception 'Expected 100 active Module 5 MCQ options, found %.',v_options; end if;
  if v_rubrics<>5 then raise exception 'Expected 5 active Module 5 Theory rubrics, found %.',v_rubrics; end if;
  if v_bad_options<>0 then raise exception 'Found % Module 5 MCQ(s) with invalid/repeated options.',v_bad_options; end if;
  if v_bad_rubrics<>0 then raise exception 'Found % invalid Module 5 Theory rubric(s).',v_bad_rubrics; end if;
  if v_duplicate_texts<>0 then raise exception 'Found % repeated active Module 5 question text(s).',v_duplicate_texts; end if;
end
$verify$;

update public.examinations
set exam_format='cipmn_mixed',
    updated_at=now()
where id='d0c77c9c-a711-5864-97ac-c930ca231773';

commit;

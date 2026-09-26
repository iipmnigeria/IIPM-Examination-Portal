begin;

-- CIPMN-MOD-010 assessment conversion and source-strict bank refresh.
-- Sole official assessment source:
-- CIPMN-MOD-010.pptx (Project Leadership and Building High-Performing Teams; 107 slides; reviewed 2026-09-26).
-- Historical attempts, submitted answers, assignments and retired questions are preserved.

do $guard$
declare
  v_exam_id constant uuid := '37eaf7f3-42c8-525c-8c28-cd9c3327da13';
  v_live integer;
  v_format text;
  v_active integer;
  v_marker uuid := public.cipmn_mock_seed_uuid('CIPMN-MOD-010:PPTX-V1:MCQ:1');
begin
  select exam_format into v_format
  from public.examinations
  where id=v_exam_id
  for update;

  if not found then raise exception 'CIPMN-MOD-010 examination not found.'; end if;
  if v_format not in ('standard','cipmn_mixed') then
    raise exception 'Unexpected CIPMN-MOD-010 exam format: %',v_format;
  end if;
  if exists(select 1 from public.questions where id=v_marker and is_active) then
    raise exception 'CIPMN-MOD-010 PPTX-aligned bank is already active; refresh aborted.';
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
    raise exception 'CIPMN-MOD-010 has % genuinely live examination session(s); conversion aborted.',v_live;
  end if;

  select count(*) into v_active
  from public.questions
  where examination_id=v_exam_id and is_active;

  if v_format='standard' and v_active<>75 then
    raise exception 'Expected 75 active legacy Module 10 questions, found %.',v_active;
  end if;
end
$guard$;

update public.questions
set is_active=false,
    position=position+21000,
    updated_at=now()
where examination_id='37eaf7f3-42c8-525c-8c28-cd9c3327da13'
  and is_active=true;

do $mcq_insert$
declare
  v_exam_id constant uuid := '37eaf7f3-42c8-525c-8c28-cd9c3327da13';
  v_mcqs jsonb := $mcq$
[
  {
    "position": 1,
    "question": "Which statement best distinguishes project leadership from traditional project management in Module 10?",
    "options": [
      "Leadership focuses on people, vision, adaptability and resilience, while management emphasizes processes, scope, compliance and control.",
      "Leadership is mainly about Gantt charts and CPM, while management is mainly about stakeholder engagement.",
      "Leadership and management are presented as identical competencies.",
      "Management is preferred in VUCA contexts because predictability is always possible."
    ],
    "correct": 1
  },
  {
    "position": 2,
    "question": "Which three dimensions make up the PMI Talent Triangle as presented in the deck?",
    "options": [
      "Technical project management, strategic and business management, and leadership.",
      "Scope, schedule and cost.",
      "Communication, conflict and negotiation.",
      "Finance, procurement and governance."
    ],
    "correct": 1
  },
  {
    "position": 3,
    "question": "What does VUCA stand for in Module 10?",
    "options": [
      "Volatility, Uncertainty, Complexity, Ambiguity.",
      "Variance, Uncertainty, Cost, Alignment.",
      "Vision, Unity, Collaboration, Adaptability.",
      "Value, Urgency, Control, Accountability."
    ],
    "correct": 1
  },
  {
    "position": 4,
    "question": "A project leader changes leadership style according to team maturity, urgency and complexity. Which style best matches this behavior?",
    "options": [
      "Democratic.",
      "Autocratic.",
      "Laissez-faire.",
      "Situational."
    ],
    "correct": 4
  },
  {
    "position": 5,
    "question": "Which leadership style is described as prioritizing team growth and support while building trust and loyalty?",
    "options": [
      "Servant leadership.",
      "Autocratic leadership.",
      "Laissez-faire leadership.",
      "Authoritative control."
    ],
    "correct": 1
  },
  {
    "position": 6,
    "question": "Which statement best reflects sustainable leadership in the Module 10 materials?",
    "options": [
      "It balances economic, social and environmental priorities and embeds sustainability across the project lifecycle.",
      "It treats ESG reporting as optional after project closure.",
      "It replaces stakeholder engagement with technical analysis.",
      "It focuses only on short-term project outputs."
    ],
    "correct": 1
  },
  {
    "position": 7,
    "question": "Which strategic tool is used in the deck to map stakeholders by power and interest?",
    "options": [
      "SWOT Analysis.",
      "RACI Matrix.",
      "Stakeholder Matrix.",
      "Balanced Scorecard."
    ],
    "correct": 3
  },
  {
    "position": 8,
    "question": "Which Balanced Scorecard perspectives are listed in Module 10?",
    "options": [
      "Strengths, weaknesses, opportunities and threats.",
      "Scope, schedule, cost and risk.",
      "Finance, customer, processes and learning.",
      "People, process, technology and culture."
    ],
    "correct": 3
  },
  {
    "position": 9,
    "question": "Which characteristic is explicitly associated with high-performing project teams in the deck?",
    "options": [
      "Avoidance of all disagreement.",
      "Psychological safety and trust.",
      "Dependence on a single technical expert.",
      "Minimal role clarity to preserve flexibility."
    ],
    "correct": 2
  },
  {
    "position": 10,
    "question": "Which sequence correctly represents Tuckman’s team-development model as taught in Module 10?",
    "options": [
      "Storming → Forming → Performing → Norming → Adjourning.",
      "Forming → Norming → Storming → Performing → Closing.",
      "Initiating → Planning → Executing → Monitoring → Closing.",
      "Forming → Storming → Norming → Performing → Adjourning."
    ],
    "correct": 4
  },
  {
    "position": 11,
    "question": "During which Tuckman stage do conflicts typically emerge and require communication planning and dispute resolution?",
    "options": [
      "Norming.",
      "Performing.",
      "Forming.",
      "Storming."
    ],
    "correct": 4
  },
  {
    "position": 12,
    "question": "What is the main purpose of a RACI Matrix in team building according to the deck?",
    "options": [
      "To replace project charters.",
      "To calculate project risk exposure.",
      "To clarify responsibilities and accountability and reduce overlap or neglect.",
      "To estimate team productivity numerically."
    ],
    "correct": 3
  },
  {
    "position": 13,
    "question": "Which statement best describes psychological safety in Module 10?",
    "options": [
      "A climate where people can share ideas, mistakes and concerns without fear.",
      "A policy that prevents teams from challenging leaders.",
      "A technique for suppressing conflict.",
      "A financial incentive for high performers."
    ],
    "correct": 1
  },
  {
    "position": 14,
    "question": "Which emotional-intelligence component is most directly associated with staying composed under stress?",
    "options": [
      "Self-regulation.",
      "Motivation.",
      "Social skills.",
      "Self-awareness."
    ],
    "correct": 1
  },
  {
    "position": 15,
    "question": "Which set contains the five emotional-intelligence components emphasized in the deck?",
    "options": [
      "Trust, authority, delegation, budgeting and auditing.",
      "Cognition, IQ, technical skill, tenure and experience.",
      "Self-awareness, self-regulation, motivation, empathy and social skills.",
      "Vision, control, planning, execution and closure."
    ],
    "correct": 3
  },
  {
    "position": 16,
    "question": "Which practice is recommended as a quick win for operationalizing emotional intelligence in project teams?",
    "options": [
      "Restricting retrospectives to technical performance only.",
      "Emotional check-ins at meetings.",
      "Eliminating feedback during stressful periods permanently.",
      "Replacing stakeholder engagement with dashboards."
    ],
    "correct": 2
  },
  {
    "position": 17,
    "question": "What do the letters in the SBI feedback model stand for?",
    "options": [
      "Situation, Behavior, Impact.",
      "Strategy, Balance, Influence.",
      "Scope, Budget, Integration.",
      "Stakeholder, Baseline, Improvement."
    ],
    "correct": 1
  },
  {
    "position": 18,
    "question": "Why does the Module 10 deck recommend the SBI model for constructive feedback?",
    "options": [
      "It allows leaders to avoid difficult conversations.",
      "It emphasizes personality judgments to accelerate correction.",
      "It replaces the need for empathy.",
      "It focuses feedback on observable facts and impact, reducing defensiveness and improving clarity."
    ],
    "correct": 4
  },
  {
    "position": 19,
    "question": "Which combination is identified as helping sustain high performance over time?",
    "options": [
      "Competition, secrecy, individual incentives and limited communication.",
      "Longer hours, fewer breaks, reduced training and centralized decisions.",
      "Continuous alignment, recognition, stress management and lifelong learning.",
      "Micromanagement, workload growth, annual feedback and fixed roles."
    ],
    "correct": 3
  },
  {
    "position": 20,
    "question": "What are the five spokes of the High-Performance Wheel Framework?",
    "options": [
      "Planning, Execution, Monitoring, Change and Closure.",
      "Purpose, People, Processes, Performance and Partnership.",
      "Scope, Time, Cost, Quality and Risk.",
      "Trust, Control, Speed, Innovation and Budget."
    ],
    "correct": 2
  },
  {
    "position": 21,
    "question": "Which pitfall is described as killing trust, slowing decisions and creating bottlenecks?",
    "options": [
      "Micromanagement.",
      "Psychological safety.",
      "Recognition culture.",
      "Coaching."
    ],
    "correct": 1
  },
  {
    "position": 22,
    "question": "Which leadership approach is described as adjusting style to context, team maturity and stressors, with more direction early and more autonomy later?",
    "options": [
      "Pure autocratic leadership.",
      "Laissez-faire leadership.",
      "Transactional-only leadership.",
      "Adaptive leadership."
    ],
    "correct": 4
  },
  {
    "position": 23,
    "question": "Which emerging trend is specifically discussed in relation to high-performing teams?",
    "options": [
      "Reducing cultural intelligence in global projects.",
      "Removing asynchronous communication.",
      "AI integration for predictive analytics, automated tasks, risk insights and virtual assistants.",
      "Eliminating digital collaboration from remote teams."
    ],
    "correct": 3
  },
  {
    "position": 24,
    "question": "Which communication practice is recommended for communities and local stakeholders?",
    "options": [
      "One-way email communication regardless of context.",
      "Town halls, storytelling and dialogue adapted to stakeholder needs.",
      "Only technical reports and formal memos.",
      "Only dashboards with no discussion."
    ],
    "correct": 2
  },
  {
    "position": 25,
    "question": "In the Lagos–Calabar Coastal Highway case, which lesson is emphasized about leadership style?",
    "options": [
      "No single style fits all contexts; leaders should adapt style to the situation.",
      "Servant leadership should be used for every project phase.",
      "Authoritative leadership should replace stakeholder consultation.",
      "Technical execution matters more than leadership."
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
    v_qid := public.cipmn_mock_seed_uuid('CIPMN-MOD-010:PPTX-V1:MCQ:' || (v_item->>'position'));

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
      raise exception 'No correct option resolved for Module 10 MCQ position %.',v_item->>'position';
    end if;

    insert into public.question_answer_keys(question_id,correct_option_id)
    values(v_qid,v_correct_id);
  end loop;
end
$mcq_insert$;

do $theory_insert$
declare
  v_exam_id constant uuid := '37eaf7f3-42c8-525c-8c28-cd9c3327da13';
  v_theory jsonb := $theory$
[
  {
    "position":26,
    "question":"Using only Module 10: (a) distinguish project management from project leadership; (b) explain the PMI Talent Triangle; (c) explain VUCA and why leadership matters in complex environments; (d) compare autocratic, democratic, transformational, servant, laissez-faire and situational leadership styles at the level taught in the deck; and (e) explain why no single style fits every project context.",
    "criteria":[
      {"name":"Management vs leadership","marks":2,"expected":"Explains management as process/scope/compliance/control focused and leadership as people/vision/adaptability/resilience/value focused."},
      {"name":"PMI Talent Triangle","marks":2,"expected":"Identifies Technical Project Management, Strategic & Business Management, and Leadership."},
      {"name":"VUCA leadership","marks":2,"expected":"Explains Volatility, Uncertainty, Complexity and Ambiguity and the need for flexibility, collaboration, confidence and alignment."},
      {"name":"Leadership styles","marks":2,"expected":"Accurately compares autocratic, democratic, transformational, servant, laissez-faire and situational styles using the source-supported strengths/limitations."},
      {"name":"Contextual adaptation","marks":2,"expected":"Explains that effective leaders adjust style to project phase, urgency, team competence/maturity and environment rather than using one fixed style."}
    ]
  },
  {
    "position":27,
    "question":"Using only Module 10: (a) define a high-performing project team; (b) explain psychological safety, trust, diversity, role clarity and accountability; (c) explain the five Tuckman stages and appropriate leadership responses; (d) explain how RACI supports team performance; and (e) explain how communication, emotional intelligence and servant leadership interact to create resilient teams.",
    "criteria":[
      {"name":"High-performing team","marks":2,"expected":"Defines high-performing teams as dynamic, goal-driven, value-creating teams with shared vision, trust, resilience, cooperation and alignment."},
      {"name":"Core team conditions","marks":2,"expected":"Explains psychological safety, trust, diversity, role clarity, accountability and goal clarity as foundations of performance."},
      {"name":"Tuckman stages","marks":2,"expected":"Explains Forming, Storming, Norming, Performing and Adjourning with source-consistent leadership responses."},
      {"name":"RACI","marks":2,"expected":"Explains RACI as clarifying Responsible, Accountable, Consulted and Informed roles and reducing duplication, ambiguity and neglect."},
      {"name":"Integrated team leadership","marks":2,"expected":"Explains how communication provides clarity, EI provides resilience/conflict management, and servant leadership builds cohesion, ownership and trust."}
    ]
  },
  {
    "position":28,
    "question":"Using only Module 10: (a) explain the five emotional-intelligence components; (b) explain how EI helps leaders operate in VUCA environments; (c) describe practical EI techniques including emotional check-ins, 360° feedback, journaling, empathy mapping, mindfulness and emotionally aware retrospectives; (d) explain the SBI feedback model and why it works; and (e) explain how leaders should give and receive feedback constructively.",
    "criteria":[
      {"name":"EI components","marks":2,"expected":"Explains self-awareness, self-regulation, motivation, empathy and social skills."},
      {"name":"EI in VUCA","marks":2,"expected":"Links self-regulation to volatility, motivation to uncertainty, empathy/social skills to complexity, and self-awareness/empathy to ambiguity as supported by the deck."},
      {"name":"EI practices","marks":2,"expected":"Explains source-listed practices such as emotional check-ins, 360° feedback, journaling, empathy mapping, mindfulness and retrospectives with an emotion lens."},
      {"name":"SBI model","marks":2,"expected":"Explains Situation–Behavior–Impact and how it reduces defensiveness by focusing on observable facts and effects."},
      {"name":"Constructive feedback","marks":2,"expected":"Explains timing, setting, empathy, respectful language, openness to receiving feedback, and continuous feedback loops."}
    ]
  },
  {
    "position":29,
    "question":"Using only Module 10: (a) explain how high performance should be sustained over time; (b) describe the High-Performance Wheel’s five spokes; (c) explain common team pitfalls such as micromanagement, role ambiguity and cultural blind spots; (d) explain long-term retention/stability practices; and (e) explain how servant leadership, adaptive leadership and a coaching mindset support sustained performance.",
    "criteria":[
      {"name":"Sustaining performance","marks":2,"expected":"Explains continuous alignment, recognition culture, stress management, learning and balancing productivity with well-being."},
      {"name":"High-Performance Wheel","marks":2,"expected":"Explains Purpose, People, Processes, Performance and Partnership and the need for balance across the spokes."},
      {"name":"Pitfalls","marks":2,"expected":"Explains micromanagement, role ambiguity and cultural blind spots and source-supported mitigations such as RACI, feedback loops, cultural training and psychological safety."},
      {"name":"Retention/stability","marks":2,"expected":"Explains trust, psychological safety, shared purpose, mentoring, growth opportunities, recognition, inclusion, meaningful motivation and follow-through on feedback."},
      {"name":"Leadership approaches","marks":2,"expected":"Explains servant leadership as empowerment/barrier removal, adaptive leadership as contextual flexibility, and coaching mindset as facilitating growth through reflection/feedback."}
    ]
  },
  {
    "position":30,
    "question":"Using only Module 10: (a) explain sustainable leadership and SDG alignment; (b) explain stakeholder mapping, SWOT, Balanced Scorecard and scenario planning as strategic leadership tools; (c) apply adaptive leadership to the Solar Micro-grid and Lagos–Calabar Coastal Highway cases; (d) explain communication strategies for diverse stakeholders; and (e) explain emerging trends affecting future high-performing teams, including AI integration, remote/hybrid work and cultural intelligence.",
    "criteria":[
      {"name":"Sustainability/SDGs","marks":2,"expected":"Explains balancing economic, social and environmental priorities, embedding sustainability across project stages, and aligning projects with SDG targets and long-term stakeholder value."},
      {"name":"Strategic tools","marks":2,"expected":"Explains stakeholder mapping, SWOT, Balanced Scorecard and scenario planning at the level taught in the deck."},
      {"name":"Case application","marks":2,"expected":"Uses source-supported leadership adaptations from the Solar Micro-grid and Lagos–Calabar cases to show trust-building, alignment, crisis control, agility and sustainability."},
      {"name":"Stakeholder communication","marks":2,"expected":"Explains stakeholder mapping, communication plans, active listening, clarity/brevity, message mapping, cultural intelligence and suitable media such as formal reports, team updates and town halls."},
      {"name":"Emerging trends","marks":2,"expected":"Explains AI integration, remote/hybrid work, digital psychological safety and cultural intelligence as emerging team-leadership considerations."}
    ]
  }
]
$theory$::jsonb;
  v_item jsonb;
  v_qid uuid;
begin
  for v_item in select value from jsonb_array_elements(v_theory)
  loop
    v_qid := public.cipmn_mock_seed_uuid('CIPMN-MOD-010:PPTX-V1:THEORY:' || ((v_item->>'position')::integer-25));

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
      'CIPMN-MOD-010.pptx (107 slides; reviewed 2026-09-26)',true
    );
  end loop;
end
$theory_insert$;

do $verify$
declare
  v_exam_id constant uuid := '37eaf7f3-42c8-525c-8c28-cd9c3327da13';
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

  if v_mcq<>25 then raise exception 'Expected 25 active Module 10 MCQs, found %.',v_mcq; end if;
  if v_theory<>5 then raise exception 'Expected 5 active Module 10 Theory questions, found %.',v_theory; end if;
  if v_keys<>25 then raise exception 'Expected 25 Module 10 answer keys, found %.',v_keys; end if;
  if v_options<>100 then raise exception 'Expected 100 active Module 10 MCQ options, found %.',v_options; end if;
  if v_rubrics<>5 then raise exception 'Expected 5 active Module 10 Theory rubrics, found %.',v_rubrics; end if;
  if v_bad_options<>0 then raise exception 'Found % Module 10 MCQ(s) with invalid/repeated options.',v_bad_options; end if;
  if v_bad_rubrics<>0 then raise exception 'Found % invalid Module 10 Theory rubric(s).',v_bad_rubrics; end if;
  if v_duplicate_texts<>0 then raise exception 'Found % repeated active Module 10 question text(s).',v_duplicate_texts; end if;
end
$verify$;

update public.examinations
set exam_format='cipmn_mixed',
    updated_at=now()
where id='37eaf7f3-42c8-525c-8c28-cd9c3327da13';

commit;

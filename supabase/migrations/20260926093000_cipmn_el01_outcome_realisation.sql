begin;

-- CIPMN-MOD-EL01 — Outcome Realisation
-- Sole assessment source:
-- CIPMN-MOD-EL01.pptx (36 slides/pages; reviewed 2026-09-26).
-- Creates a new elective examination atomically. It remains draft until
-- questions, answer keys, rubrics, pricing and proctoring invariants pass.

do $guard$
declare
  v_exam_id constant uuid := public.cipmn_mock_seed_uuid('CIPMN-MOD-EL01:EXAM');
begin
  if exists (
    select 1 from public.examinations
    where id=v_exam_id
       or upper(code)='CIPMN-MOD-EL01'
       or upper(title) like 'CIPMN-MOD-EL01 - %'
  ) then
    raise exception 'CIPMN-MOD-EL01 already exists; creation aborted.';
  end if;
end
$guard$;

do $exam$
declare
  v_exam_id constant uuid := public.cipmn_mock_seed_uuid('CIPMN-MOD-EL01:EXAM');
  v_programme_id constant uuid := '614ea9d4-0bd4-5df5-a817-9a93937c74e3';
begin
  insert into public.examinations(
    id,programme_id,title,instructions,duration_minutes,pass_mark,status,
    starts_at,ends_at,max_attempts,randomize_questions,randomize_options,
    created_by,allow_self_enrollment,requires_payment,code,exam_format
  ) values(
    v_exam_id,
    v_programme_id,
    'CIPMN-MOD-EL01 - Outcome Realisation Mock Examination',
    'Complete 25 MCQs first, then the 5 Theory questions. The MCQ section contributes 40% and the Theory section contributes 60% of the overall score. This assessment covers outputs, outcomes, benefits, Benefits Realisation Management, monitoring and evaluation, Nigerian public-sector outcome realisation and sustainability of project benefits. Payment, an applicable coupon or an administrator assignment is required before launch.',
    120,
    70.00,
    'draft',
    null,
    null,
    3,
    true,
    true,
    null,
    false,
    true,
    'CIPMN-MOD-EL01',
    'standard'
  );
end
$exam$;

do $mcq_insert$
declare
  v_exam_id constant uuid := public.cipmn_mock_seed_uuid('CIPMN-MOD-EL01:EXAM');
  v_mcqs jsonb := $mcq$
[
  {
    "position": 1,
    "question": "Which statement best reflects the central idea of Outcome Realisation in EL01?",
    "options": [
      "A project is successful once its physical deliverables are completed.",
      "Outcome Realisation links what is delivered to the changes achieved and the long-term value created.",
      "Outcome Realisation focuses only on post-project financial returns.",
      "Outcome Realisation replaces project monitoring with stakeholder opinion."
    ],
    "correct": 2
  },
  {
    "position": 2,
    "question": "In the EL01 results chain, which description correctly distinguishes outputs, outcomes and benefits?",
    "options": [
      "Outputs are tangible deliverables, outcomes are changes resulting from their use, and benefits are long-term measurable value.",
      "Outputs and outcomes are identical, while benefits are optional.",
      "Outputs are external impacts, outcomes are costs, and benefits are project activities.",
      "Outputs are long-term value, outcomes are deliverables, and benefits are short-term changes."
    ],
    "correct": 1
  },
  {
    "position": 3,
    "question": "Which feature of an output is emphasized in the module's comparison table?",
    "options": [
      "It is primarily influenced by the external environment.",
      "It represents strategic value rather than a deliverable.",
      "It is usually a tangible deliverable achieved during or immediately after project completion.",
      "It normally appears years after project closure."
    ],
    "correct": 3
  },
  {
    "position": 4,
    "question": "Which example from the Kaduna rural-road case is an output rather than an outcome or benefit?",
    "options": [
      "Maternal and child health outcomes improved.",
      "Travel time for farmers reduced by about 45%.",
      "Agricultural income increased by 30%.",
      "More than 500 km of rural feeder roads were rehabilitated."
    ],
    "correct": 4
  },
  {
    "position": 5,
    "question": "A monitoring report from the Kaduna rural-road project shows that farmers now reach markets about 45% faster after using the rehabilitated roads. In the EL01 results chain, how should this change be classified?",
    "options": [
      "Ten community maintenance cooperatives were created.",
      "Travel time for farmers accessing markets reduced by an average of 45%.",
      "Local farm income increased by 30%.",
      "Long-term local employment was sustained through maintenance cooperatives."
    ],
    "correct": 2
  },
  {
    "position": 6,
    "question": "Which example from the same rural-road case is classified as a benefit in EL01?",
    "options": [
      "Local workers were trained in road maintenance.",
      "Agricultural income for rural farmers increased by 30% because market access improved.",
      "Five hundred kilometres of roads were rehabilitated.",
      "Road signs and drainage systems were installed."
    ],
    "correct": 2
  },
  {
    "position": 7,
    "question": "What risk does EL01 associate with confusing outputs and outcomes?",
    "options": [
      "Giving excessive attention to stakeholder value.",
      "Using too many performance indicators.",
      "Focusing on activity completion without establishing whether meaningful change occurred.",
      "Measuring too many long-term benefits."
    ],
    "correct": 3
  },
  {
    "position": 8,
    "question": "Why do outcomes matter according to the module?",
    "options": [
      "They are always fully controlled by the project manager.",
      "They prove only that project activities were completed.",
      "They show the real-world relevance and utility of outputs and help assess whether strategic objectives are being met.",
      "They replace the need to measure benefits."
    ],
    "correct": 3
  },
  {
    "position": 9,
    "question": "How does EL01 define Benefits Realisation Management (BRM)?",
    "options": [
      "A structured approach for ensuring projects and programmes deliver intended benefits and organisational value.",
      "A method for tracking only expenditure after project closure.",
      "A procurement framework for selecting suppliers.",
      "A technique for measuring only immediate outputs."
    ],
    "correct": 1
  },
  {
    "position": 10,
    "question": "Which sequence correctly represents the five BRM stages shown in EL01?",
    "options": [
      "Identify and Quantify → Value and Appraise → Plan → Realise → Review.",
      "Value and Appraise → Plan → Identify → Review → Realise.",
      "Identify → Realise → Plan → Review → Appraise.",
      "Plan → Identify and Quantify → Review → Realise → Appraise."
    ],
    "correct": 1
  },
  {
    "position": 11,
    "question": "At the BRM 'Identify and Quantify' stage, what is the main emphasis?",
    "options": [
      "Comparing only actual expenditure with budget.",
      "Assigning a supplier to each benefit.",
      "Identifying expected benefits, their dependencies and how they connect to project or programme objectives.",
      "Closing all benefits after final delivery."
    ],
    "correct": 3
  },
  {
    "position": 12,
    "question": "What is central to the BRM 'Value and Appraise' stage?",
    "options": [
      "Transferring all benefit ownership to the project team.",
      "Creating a benefit management strategy that defines value, measurement, responsibility and tracking duration.",
      "Suspending measurement until project closure.",
      "Replacing benefits with output measures."
    ],
    "correct": 2
  },
  {
    "position": 13,
    "question": "Within the EL01 BRM framework, what does the Plan stage require when some benefits may appear immediately while others may only emerge after the project or programme has finished?",
    "options": [
      "Planning when benefits are expected to appear and who will track benefits that arise after project completion.",
      "Treating all benefits as immediate.",
      "Focusing only on the delivery schedule.",
      "Ending benefit ownership at project closure."
    ],
    "correct": 1
  },
  {
    "position": 14,
    "question": "What is the purpose of the BRM 'Realise' stage?",
    "options": [
      "To identify the first list of possible benefits before initiation.",
      "To close the project before any outcome is measured.",
      "To replace the benefits strategy with a procurement plan.",
      "To deliver the change that makes the intended benefits possible and assess how delivery is progressing."
    ],
    "correct": 4
  },
  {
    "position": 15,
    "question": "At the BRM Review stage in EL01, what should the team do when comparing the benefits originally expected with the actual results and current stakeholder expectations?",
    "options": [
      "All benefits are assumed to have been achieved.",
      "Benefits are converted back into project tasks.",
      "Expected benefits are compared with actual results and assumptions or stakeholder expectations are reconsidered where necessary.",
      "Only outputs are counted and archived."
    ],
    "correct": 3
  },
  {
    "position": 16,
    "question": "Which is an output indicator in the module's education-project M&E examples?",
    "options": [
      "Higher employment resulting from better education.",
      "Improved national literacy rate.",
      "Increase in student attendance rate.",
      "Number of classrooms built."
    ],
    "correct": 4
  },
  {
    "position": 17,
    "question": "Which is an outcome indicator in the module's health-project examples?",
    "options": [
      "Number of clinics constructed.",
      "Number of vaccines distributed.",
      "Increase in antenatal care attendance.",
      "Increase in national life expectancy."
    ],
    "correct": 3
  },
  {
    "position": 18,
    "question": "Which is a benefit indicator in the module's infrastructure examples?",
    "options": [
      "Number of boreholes drilled.",
      "Reduction in travel time.",
      "Increase in local economic value and property values along road corridors.",
      "Kilometres of road built."
    ],
    "correct": 3
  },
  {
    "position": 19,
    "question": "When should a baseline survey be conducted in the M&E practice described in EL01?",
    "options": [
      "At project closure.",
      "One to three years after project completion.",
      "Before project implementation to establish a benchmark.",
      "Only after the first outcome appears."
    ],
    "correct": 3
  },
  {
    "position": 20,
    "question": "What is the principal purpose of the module's midline survey?",
    "options": [
      "To determine the final national impact.",
      "To measure progress on outputs and early outcomes during implementation.",
      "To prove all long-term benefits have been sustained.",
      "To replace the baseline."
    ],
    "correct": 2
  },
  {
    "position": 21,
    "question": "What does the module recommend for a Post-Project Review?",
    "options": [
      "Conduct it 1–3 years later to capture sustained benefits.",
      "Conduct it before initiation.",
      "Conduct it only when outputs fail.",
      "Use it only to confirm final expenditure."
    ],
    "correct": 1
  },
  {
    "position": 22,
    "question": "Which combination reflects how outcome realisation is practised in the Nigerian context according to EL01?",
    "options": [
      "Only contractor completion certificates and financial audits.",
      "Only donor scorecards with no local participation.",
      "Only national budget releases and procurement reports.",
      "Government M&E frameworks, donor-driven M&E systems, community engagement and public-sector performance scorecards."
    ],
    "correct": 4
  },
  {
    "position": 23,
    "question": "Which development priorities are specifically cited as guiding Nigerian outcome realisation?",
    "options": [
      "Only ERGP and procurement thresholds.",
      "Only donor country strategies.",
      "National Development Plan 2021–2025, Nigeria Vision 2050 and the Sustainable Development Goals.",
      "Only annual federal budgets."
    ],
    "correct": 3
  },
  {
    "position": 24,
    "question": "In the module's sector comparison, what opportunity was used to address infrastructure funding delays, contract variations and weak stakeholder engagement?",
    "options": [
      "Replacing outcomes with output counts.",
      "A PPP model to mobilise resources.",
      "Removal of monitoring requirements.",
      "Suspension of stakeholder engagement."
    ],
    "correct": 2
  },
  {
    "position": 25,
    "question": "Which statement best summarizes the Nigerian public-sector lesson in EL01?",
    "options": [
      "Weak M&E, corruption and political interference can derail outcomes, while PPPs, community ownership, innovative tools and strong governance can help sustain and scale benefits.",
      "Outputs alone are sufficient where projects are publicly funded.",
      "Community ownership is unnecessary if contractors complete on time.",
      "Benefits should be measured only at national level."
    ],
    "correct": 1
  }
]
$mcq$::jsonb;
  v_item jsonb;
  v_qid uuid;
  v_opt_id uuid;
  v_correct_id uuid;
  v_option_text text;
  v_opt_pos integer;
begin
  for v_item in select value from jsonb_array_elements(v_mcqs)
  loop
    v_qid := public.cipmn_mock_seed_uuid('CIPMN-MOD-EL01:MCQ:' || (v_item->>'position'));

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
      raise exception 'No correct option resolved for EL01 MCQ position %.',v_item->>'position';
    end if;

    insert into public.question_answer_keys(question_id,correct_option_id)
    values(v_qid,v_correct_id);
  end loop;
end
$mcq_insert$;

do $theory_insert$
declare
  v_exam_id constant uuid := public.cipmn_mock_seed_uuid('CIPMN-MOD-EL01:EXAM');
  v_theory jsonb := $theory$
[
  {
    "position":26,
    "question":"Using only EL01: (a) distinguish outputs, outcomes and benefits by definition, timeframe, control and measurement; (b) explain why outputs alone do not establish project success; (c) explain the 'activity trap'; (d) apply the three levels to the Kaduna rural-road case; and (e) explain how distinguishing the three improves accountability and project value delivery.",
    "criteria":[
      {"name":"Definitions and distinctions","marks":2,"expected":"Accurately distinguishes tangible/immediate outputs, changes from outputs as outcomes, and long-term strategic value as benefits, including timeframe/control/measurement differences."},
      {"name":"Success beyond outputs","marks":2,"expected":"Explains that project value depends on outputs being used to create meaningful outcomes and sustained benefits rather than deliverables alone."},
      {"name":"Activity trap","marks":2,"expected":"Explains the risk of equating activity or deliverable completion with real-world change without measuring use, change and value."},
      {"name":"Kaduna application","marks":2,"expected":"Uses source-supported rural-road examples such as rehabilitated roads/cooperatives/training as outputs, reduced travel time/access changes as outcomes, and income/health/employment/post-harvest improvements as benefits."},
      {"name":"Accountability/value","marks":2,"expected":"Connects clear results levels to better planning, M&E, stakeholder engagement, accountability and strategic value delivery."}
    ]
  },
  {
    "position":27,
    "question":"Using only EL01: (a) define Benefits Realisation Management; (b) explain Identify and Quantify, Value and Appraise, Plan, Realise and Review; (c) explain how benefits may depend on one another; (d) explain benefit ownership and tracking after project closure; and (e) show how the BRM stages integrate with the project lifecycle.",
    "criteria":[
      {"name":"BRM definition","marks":2,"expected":"Defines BRM as a structured approach ensuring projects/programmes deliver intended benefits and organisational value."},
      {"name":"Five stages","marks":2,"expected":"Correctly explains Identify and Quantify, Value and Appraise, Plan, Realise and Review in source order and purpose."},
      {"name":"Dependencies","marks":2,"expected":"Explains that benefits can have dependencies and should be tied back to project/programme objectives and coherent change."},
      {"name":"Ownership/tracking","marks":2,"expected":"Explains defining who measures and owns benefits, how long they are tracked, and who continues tracking when benefits appear after closure."},
      {"name":"Lifecycle integration","marks":2,"expected":"Connects BRM stages with pre-initiation/initiation, planning, delivery/implementation, monitoring/review and post-project value tracking."}
    ]
  },
  {
    "position":28,
    "question":"Using only EL01: (a) explain the role of M&E in outcome realisation; (b) distinguish output, outcome and benefit indicators; (c) explain Baseline, Midline, Endline and Post-Project Review; (d) compare suitable data sources and frequencies for infrastructure indicators; and (e) explain why sustained benefits require measurement after project closure.",
    "criteria":[
      {"name":"M&E role","marks":2,"expected":"Explains M&E as the mechanism for establishing benchmarks, tracking deliverables/change/value and demonstrating whether intended results occur."},
      {"name":"Indicator levels","marks":2,"expected":"Correctly distinguishes quantity/immediate output indicators, change/usage outcome indicators and long-term impact/value benefit indicators."},
      {"name":"Evaluation timing","marks":2,"expected":"Explains Baseline before implementation, Midline for progress/early outcomes, Endline for outcomes/early benefits and Post-Project Review 1–3 years later for sustained benefits."},
      {"name":"Infrastructure data/frequency","marks":2,"expected":"Uses source examples such as contractor/site records monthly/quarterly for outputs, traffic/GPS/local-government data quarterly/biannually for outcomes, and economic/school/health data annually/biennially for benefits."},
      {"name":"Post-closure measurement","marks":2,"expected":"Explains that benefits may emerge and persist long after outputs are delivered, requiring ongoing ownership and evidence of sustained value."}
    ]
  },
  {
    "position":29,
    "question":"Using only EL01: (a) explain how outcome realisation is practised in Nigeria; (b) identify the cited national development priorities; (c) compare infrastructure, health and education sectors; (d) explain the barriers, opportunities and evaluation findings in the sector comparison; and (e) explain the role of community engagement and governance in validating and sustaining outcomes.",
    "criteria":[
      {"name":"Nigerian practice","marks":2,"expected":"Explains government-led M&E frameworks including the National M&E Policy 2020, donor-driven systems, community engagement and public-sector performance scorecards."},
      {"name":"Development priorities","marks":2,"expected":"Identifies National Development Plan 2021–2025, Nigeria Vision 2050 and SDGs as cited priorities."},
      {"name":"Sector comparison","marks":2,"expected":"Uses source-supported infrastructure, health and education project types/agencies/funding context."},
      {"name":"Barriers/opportunities/findings","marks":2,"expected":"Explains examples such as infrastructure funding/variations/stakeholder barriers with PPP opportunity and travel-time/trade results; health M&E/staffing barriers with community/donor solutions; education power/ICT-skill barriers with solar/retraining solutions."},
      {"name":"Community/governance","marks":2,"expected":"Explains community validation/ownership and strong governance as mechanisms for credible, sustainable and scalable project benefits."}
    ]
  },
  {
    "position":30,
    "question":"Using only EL01: (a) explain the statement that successful projects do not end at delivery; (b) explain how outputs lead to outcomes and benefits; (c) discuss tangible and intangible benefits; (d) explain major Nigerian barriers to benefit realisation; and (e) propose source-supported approaches for institutionalising, sustaining and scaling benefits.",
    "criteria":[
      {"name":"Success after delivery","marks":2,"expected":"Explains the module's position that project success is demonstrated by achieved change and sustained value, not delivery alone."},
      {"name":"Results chain","marks":2,"expected":"Explains how tangible outputs enable behavioural/service/access changes that can generate longer-term economic, social, environmental or strategic benefits."},
      {"name":"Tangible/intangible value","marks":2,"expected":"Uses source framing/examples to discuss measurable economic gains and less-direct value such as better health, education access and stakeholder experience without inventing unsupported valuation methods."},
      {"name":"Nigerian barriers","marks":2,"expected":"Explains barriers including weak M&E, corruption, political interference, funding delays, contract variations, staffing/skills gaps or weak stakeholder engagement as supported by the module."},
      {"name":"Sustain/scale approaches","marks":2,"expected":"Uses source-supported mechanisms such as PPPs, community ownership, innovative tools, donor/government M&E, performance scorecards and strong governance to institutionalise and scale benefits."}
    ]
  }
]
$theory$::jsonb;
  v_item jsonb;
  v_qid uuid;
begin
  for v_item in select value from jsonb_array_elements(v_theory)
  loop
    v_qid := public.cipmn_mock_seed_uuid('CIPMN-MOD-EL01:THEORY:' || ((v_item->>'position')::integer-25));

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
      'CIPMN-MOD-EL01.pptx (36 slides/pages; reviewed 2026-09-26)',true
    );
  end loop;
end
$theory_insert$;

do $commerce_and_proctoring$
declare
  v_exam_id constant uuid := public.cipmn_mock_seed_uuid('CIPMN-MOD-EL01:EXAM');
begin
  insert into public.agilecert_exam_pricing_policies(
    id,examination_id,currency,standard_amount_minor,promotional_amount_minor,
    promotion_name,promotion_starts_at,promotion_ends_at,access_mode,
    attempts_included,retake_amount_minor,bulk_cart_eligible,is_active,updated_by
  ) values(
    public.cipmn_mock_seed_uuid('CIPMN-MOD-EL01:PRICING-POLICY'),
    v_exam_id,'NGN',2500000,null,null,null,null,'paid',1,null,true,true,null
  );

  update public.agilecert_identity_proctoring_policies
  set policy_version=2,
      consent_version='cipmn-camera-v1',
      privacy_notice='Identity and proctoring data is used only to protect examination integrity, investigate incidents and meet certification obligations.',
      require_existing_identity_approval=false,
      require_government_id=false,
      require_selfie=false,
      require_exam_day_identity_check=false,
      require_camera=true,
      require_microphone_permission=false,
      require_fullscreen=false,
      live_event_capture_enabled=true,
      ai_visual_analysis_enabled=true,
      external_kyc_enabled=false,
      automated_face_match_enabled=false,
      liveness_check_enabled=false,
      retain_webcam_images=false,
      incident_threshold=60.00,
      critical_threshold=80.00,
      low_event_weight=2.00,
      medium_event_weight=8.00,
      high_event_weight=20.00,
      identity_retention_days=365,
      proctor_event_retention_days=365,
      incident_retention_days=730,
      appeal_window_days=14,
      active=true,
      updated_by=null,
      updated_at=now()
  where examination_id=v_exam_id;
end
$commerce_and_proctoring$;

do $verify$
declare
  v_exam_id constant uuid := public.cipmn_mock_seed_uuid('CIPMN-MOD-EL01:EXAM');
  v_mcq integer;
  v_theory integer;
  v_keys integer;
  v_options integer;
  v_rubrics integer;
  v_bad_options integer;
  v_bad_rubrics integer;
  v_duplicate_texts integer;
  v_policy integer;
  v_pricing integer;
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

  select count(*) into v_policy
  from public.agilecert_identity_proctoring_policies
  where examination_id=v_exam_id and active=true and require_camera=true
    and live_event_capture_enabled=true and ai_visual_analysis_enabled=true;

  select count(*) into v_pricing
  from public.agilecert_exam_pricing_policies
  where examination_id=v_exam_id and is_active=true
    and currency='NGN' and standard_amount_minor=2500000 and access_mode='paid';

  if v_mcq<>25 then raise exception 'Expected 25 active EL01 MCQs, found %.',v_mcq; end if;
  if v_theory<>5 then raise exception 'Expected 5 active EL01 Theory questions, found %.',v_theory; end if;
  if v_keys<>25 then raise exception 'Expected 25 EL01 answer keys, found %.',v_keys; end if;
  if v_options<>100 then raise exception 'Expected 100 EL01 MCQ options, found %.',v_options; end if;
  if v_rubrics<>5 then raise exception 'Expected 5 EL01 Theory rubrics, found %.',v_rubrics; end if;
  if v_bad_options<>0 then raise exception 'Found % EL01 MCQ(s) with invalid/repeated options.',v_bad_options; end if;
  if v_bad_rubrics<>0 then raise exception 'Found % invalid EL01 Theory rubric(s).',v_bad_rubrics; end if;
  if v_duplicate_texts<>0 then raise exception 'Found % repeated active EL01 question text(s).',v_duplicate_texts; end if;
  if v_policy<>1 then raise exception 'EL01 proctoring policy invariant failed.'; end if;
  if v_pricing<>1 then raise exception 'EL01 pricing policy invariant failed.'; end if;
end
$verify$;

update public.examinations
set exam_format='cipmn_mixed',
    status='published',
    updated_at=now()
where id=public.cipmn_mock_seed_uuid('CIPMN-MOD-EL01:EXAM');

do $publish_verify$
declare
  v_exam_id constant uuid := public.cipmn_mock_seed_uuid('CIPMN-MOD-EL01:EXAM');
  v_prices integer;
  v_published integer;
begin
  select count(*) into v_prices
  from public.exam_prices
  where examination_id=v_exam_id
    and is_active
    and (
      (currency='NGN' and amount_minor=2500000 and is_default=true)
      or (currency='USD' and amount_minor=5000 and is_default=false)
    );

  select count(*) into v_published
  from public.examinations
  where id=v_exam_id
    and status='published'
    and exam_format='cipmn_mixed'
    and requires_payment=true
    and allow_self_enrollment=false;

  if v_prices<>2 then
    raise exception 'Expected publish trigger to create 2 active EL01 prices, found %.',v_prices;
  end if;
  if v_published<>1 then
    raise exception 'EL01 publish invariant failed.';
  end if;
end
$publish_verify$;

commit;

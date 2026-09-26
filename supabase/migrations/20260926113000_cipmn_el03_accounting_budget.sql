begin;

-- CIPMN-MOD-EL03 — Project Accounting & Budget Management
-- Sole assessment source:
-- CIPMN-MOD-EL03.pptx (50 slides/pages; reviewed 2026-09-26).

do $guard$
declare
  v_exam_id constant uuid := public.cipmn_mock_seed_uuid('CIPMN-MOD-EL03:EXAM');
begin
  if exists (
    select 1 from public.examinations
    where id=v_exam_id
       or upper(code)='CIPMN-MOD-EL03'
       or upper(title) like 'CIPMN-MOD-EL03 - %'
  ) then
    raise exception 'CIPMN-MOD-EL03 already exists; creation aborted.';
  end if;
end
$guard$;

do $exam$
declare
  v_exam_id constant uuid := public.cipmn_mock_seed_uuid('CIPMN-MOD-EL03:EXAM');
  v_programme_id constant uuid := '614ea9d4-0bd4-5df5-a817-9a93937c74e3';
begin
  insert into public.examinations(
    id,programme_id,title,instructions,duration_minutes,pass_mark,status,
    starts_at,ends_at,max_attempts,randomize_questions,randomize_options,
    created_by,allow_self_enrollment,requires_payment,code,exam_format
  ) values(
    v_exam_id,
    v_programme_id,
    'CIPMN-MOD-EL03 - Project Accounting & Budget Management Mock Examination',
    'Complete 25 MCQs first, then the 5 Theory questions. The MCQ section contributes 40% and the Theory section contributes 60% of the overall score. This assessment covers project financials, budgeting, cost estimation, cost control, Earned Value Management, financial reporting and forecasting, financial risk management, and financial change control. Payment, an applicable coupon or an administrator assignment is required before launch.',
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
    'CIPMN-MOD-EL03',
    'standard'
  );
end
$exam$;

do $mcq_insert$
declare
  v_exam_id constant uuid := public.cipmn_mock_seed_uuid('CIPMN-MOD-EL03:EXAM');
  v_mcqs jsonb := $mcq$
[
  {
    "position": 1,
    "question": "Which statement best reflects the role of project financials in EL03?",
    "options": [
      "They align financial resources with project goals through estimation, budgeting, funding, tracking, forecasting and reporting.",
      "They are limited to recording supplier invoices after project completion.",
      "They focus only on revenue-generating projects.",
      "They replace scope, schedule and risk management."
    ],
    "correct": 1
  },
  {
    "position": 2,
    "question": "Which lifecycle activity belongs primarily to Monitoring & Control in the EL03 project-financials lifecycle?",
    "options": [
      "Detailed cost estimating and baseline creation.",
      "Earned Value Management, variance analysis, re-forecasting and corrective action.",
      "Final cost reconciliation and release of reserves.",
      "Business case and funding strategy."
    ],
    "correct": 2
  },
  {
    "position": 3,
    "question": "Which stakeholder responsibility is correctly matched in EL03?",
    "options": [
      "External Auditor — approves supplier payments.",
      "Team Leads — perform independent regulatory validation.",
      "Project Sponsor — prepares all detailed work-package estimates.",
      "Project Accountant/Financial Analyst — prepares reports and forecasts."
    ],
    "correct": 4
  },
  {
    "position": 4,
    "question": "When reviewing cost efficiency and variance under the EL03 financial KPI framework, which of the following formulas is correct?",
    "options": [
      "EAC = CPI ÷ BAC",
      "CV = AC – EV",
      "CPI = AC ÷ EV",
      "CV = EV – AC"
    ],
    "correct": 4
  },
  {
    "position": 5,
    "question": "A project has EV of ₦28m and AC of ₦30m. What does EL03's CPI formula indicate?",
    "options": [
      "CPI is about 0.93, indicating cost inefficiency.",
      "CPI is about 1.07, indicating cost efficiency.",
      "CPI is exactly 1.00, indicating perfect cost performance.",
      "CPI cannot be calculated without PV."
    ],
    "correct": 1
  },
  {
    "position": 6,
    "question": "Which statement correctly distinguishes cost estimation from project budgeting in EL03?",
    "options": [
      "Budgeting estimates unit rates, while cost estimation only approves funding.",
      "Cost estimation occurs only after execution begins.",
      "Budgeting excludes contingency and indirect costs.",
      "Cost estimation predicts resources required for activities/work packages, while budgeting aggregates estimates into the project cost baseline."
    ],
    "correct": 4
  },
  {
    "position": 7,
    "question": "Which item is treated as a contingency reserve in EL03?",
    "options": [
      "A reserve solely for unknown-unknown risks.",
      "A fixed operating expense.",
      "An allowance for known-unknown risks.",
      "An allowance only for confirmed invoices."
    ],
    "correct": 3
  },
  {
    "position": 8,
    "question": "Which cost-estimation technique uses historical data from similar completed projects?",
    "options": [
      "Three-Point Estimating.",
      "Bottom-Up Estimating.",
      "Analogous Estimating.",
      "Parametric Estimating."
    ],
    "correct": 3
  },
  {
    "position": 9,
    "question": "Which cost-estimation technique applies unit rates to measurable quantities such as cost per square metre?",
    "options": [
      "Analogous Estimating.",
      "Parametric Estimating.",
      "Bottom-Up Estimating.",
      "Three-Point Estimating."
    ],
    "correct": 2
  },
  {
    "position": 10,
    "question": "Which cost-estimation technique is the most detailed because estimates are developed at work-package level and then summed?",
    "options": [
      "Analogous Estimating.",
      "Parametric Estimating.",
      "Trend Analysis.",
      "Bottom-Up Estimating."
    ],
    "correct": 4
  },
  {
    "position": 11,
    "question": "Using EL03's three-point estimating formula, what is the expected cost if O=₦550m, M=₦600m and P=₦680m?",
    "options": [
      "Approximately ₦605m.",
      "₦630m.",
      "₦590m.",
      "₦600m."
    ],
    "correct": 1
  },
  {
    "position": 12,
    "question": "Which statement best describes the cost baseline in EL03?",
    "options": [
      "It is used only during project closure.",
      "It is the approved, time-phased budget used to measure and control cost performance.",
      "It is an informal estimate that changes automatically with every invoice.",
      "It excludes the project schedule."
    ],
    "correct": 2
  },
  {
    "position": 13,
    "question": "Which finding from the Abuja affordable-housing case most clearly explains why the original budget was exceeded?",
    "options": [
      "The project used only analogous estimating without sufficient site-specific investigation.",
      "The project used too much bottom-up estimation.",
      "The project had an excessive contingency reserve.",
      "The project monitored the budget too frequently."
    ],
    "correct": 1
  },
  {
    "position": 14,
    "question": "At a reporting cut-off date, the team needs the budgeted cost of work that was scheduled to have been completed. In EL03 Earned Value Management, which metric represents this amount?",
    "options": [
      "Budgeted cost of scheduled work.",
      "Budgeted value of work actually completed.",
      "Total forecast cost at completion.",
      "Actual expenditure for completed work."
    ],
    "correct": 1
  },
  {
    "position": 15,
    "question": "A work package has completed deliverables, and the team wants to express that completed work in approved-budget terms rather than actual spending. Which EL03 Earned Value Management metric should be used?",
    "options": [
      "Budgeted cost of scheduled work.",
      "Remaining contingency.",
      "Budgeted cost of work actually completed.",
      "Actual cash paid to suppliers."
    ],
    "correct": 3
  },
  {
    "position": 16,
    "question": "If EV=₦35m and AC=₦45m, what is the Cost Variance (CV) under EL03?",
    "options": [
      "CV cannot be calculated without PV.",
      "₦10m favourable.",
      "₦10m unfavourable.",
      "₦80m unfavourable."
    ],
    "correct": 3
  },
  {
    "position": 17,
    "question": "If EV=₦35m and PV=₦40m, what does EL03's Schedule Variance indicate?",
    "options": [
      "SV = +₦5m, ahead of schedule.",
      "SV = -₦5m, behind schedule.",
      "SV = +₦75m, under budget.",
      "SV cannot be calculated without AC."
    ],
    "correct": 2
  },
  {
    "position": 18,
    "question": "Which EL03 relationship is correct when current cost performance is expected to continue?",
    "options": [
      "EAC = EV ÷ AC.",
      "ETC = BAC – EV.",
      "VAC = AC – BAC.",
      "EAC = BAC ÷ CPI."
    ],
    "correct": 4
  },
  {
    "position": 19,
    "question": "Which formula correctly gives Estimate to Complete (ETC) in EL03?",
    "options": [
      "ETC = EV – PV.",
      "ETC = AC ÷ EV.",
      "ETC = EAC – AC.",
      "ETC = BAC – EAC."
    ],
    "correct": 3
  },
  {
    "position": 20,
    "question": "Which item is identified as a core component of project financial reporting in EL03?",
    "options": [
      "Only a final audit report.",
      "Budget summary, actual expenditure, variance analysis, cash flow, EAC, performance metrics and narrative notes.",
      "Only supplier invoices and payment vouchers.",
      "Only the approved baseline."
    ],
    "correct": 2
  },
  {
    "position": 21,
    "question": "Which forecasting technique is explicitly listed in EL03 alongside trend analysis, moving average, regression, scenario/sensitivity and bottom-up estimating?",
    "options": [
      "Earned Value Forecasting.",
      "Critical Chain Forecasting.",
      "Delphi Forecasting.",
      "Balanced Scorecard Forecasting."
    ],
    "correct": 1
  },
  {
    "position": 22,
    "question": "In the Lagos Urban Drainage case, which intervention directly improved financial visibility and cash-flow adjustment?",
    "options": [
      "Stopping all forecasting until project completion.",
      "Replacing financial reports with verbal updates.",
      "Removing EAC calculations from project reviews.",
      "Automated Excel dashboards linked to project accounting software plus monthly rolling forecasts."
    ],
    "correct": 4
  },
  {
    "position": 23,
    "question": "Which sequence best reflects the EL03 financial risk management process?",
    "options": [
      "Risk Acceptance → Project Closure → Baseline Creation.",
      "Budget Update → Risk Identification → Audit only.",
      "Risk Identification → Risk Assessment & Prioritization → Response Planning → Monitoring & Control.",
      "Monitoring → Closure → Funding → Procurement."
    ],
    "correct": 3
  },
  {
    "position": 24,
    "question": "Which financial risk response is explicitly included in EL03?",
    "options": [
      "Only Mitigate and Avoid.",
      "Avoid, Mitigate, Transfer or Accept.",
      "Ignore, Defer, Outsource or Escalate.",
      "Only Transfer and Accept."
    ],
    "correct": 2
  },
  {
    "position": 25,
    "question": "Which statement best reflects EL03 financial change control?",
    "options": [
      "Cost-affecting changes should be formally requested, impact-assessed, reviewed, approved or rejected, then reflected in the baseline/funding plan and tracked.",
      "Approved scope changes should not alter the financial baseline.",
      "Any team member may revise the budget without review.",
      "Financial changes should be documented only at project closure."
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
    v_qid := public.cipmn_mock_seed_uuid('CIPMN-MOD-EL03:MCQ:' || (v_item->>'position'));

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
      raise exception 'No correct option resolved for EL03 MCQ position %.',v_item->>'position';
    end if;

    insert into public.question_answer_keys(question_id,correct_option_id)
    values(v_qid,v_correct_id);
  end loop;
end
$mcq_insert$;

do $theory_insert$
declare
  v_exam_id constant uuid := public.cipmn_mock_seed_uuid('CIPMN-MOD-EL03:EXAM');
  v_theory jsonb := $theory$
[
  {
    "position":26,
    "question":"Using only EL03: (a) define project financials and explain their purpose; (b) explain the main financial touchpoints across initiation, planning, execution, monitoring/control and closing; (c) explain the financial roles of the Project Manager, Project Accountant/Financial Analyst, Sponsor, Procurement/Contracts Officer, Team Leads and External Auditor; (d) explain the major financial-management tools and systems named in the module; and (e) explain why integration of finance with scope, schedule and risk is important.",
    "criteria":[
      {"name":"Project financials","marks":2,"expected":"Defines project financials using the source's cost estimation, budgeting, funding, expenditure, revenue where applicable, forecasting, tracking and reporting framing."},
      {"name":"Lifecycle touchpoints","marks":2,"expected":"Explains initiation, planning, execution, monitoring/control and closing financial activities as presented in the module."},
      {"name":"Roles","marks":2,"expected":"Accurately explains source-listed responsibilities of PM, accountant/analyst, sponsor, procurement/contracts, team leads/work-package owners and auditor/regulator."},
      {"name":"Tools","marks":2,"expected":"Explains source-named tools such as Excel/Sheets, MS Project/Primavera, accounting software, ERP, Power BI, EVM, forecasting models and cost-benefit analysis."},
      {"name":"Integrated control","marks":2,"expected":"Explains why financial control must integrate cost with schedule, scope and risk for transparency, early warning and value delivery."}
    ]
  },
  {
    "position":27,
    "question":"Using only EL03: (a) distinguish cost estimation from project budgeting; (b) explain direct, indirect, capital and operating costs plus contingency and management reserves; (c) compare Analogous, Parametric, Bottom-Up and Three-Point Estimating; (d) explain the cost-baseline creation process; and (e) apply the lessons from the Abuja affordable-housing case.",
    "criteria":[
      {"name":"Estimation vs budgeting","marks":2,"expected":"Distinguishes predicting costs for activities/work packages from aggregating estimates into the approved project cost baseline."},
      {"name":"Budget components","marks":2,"expected":"Explains direct, indirect, capital and operating costs, inflation/exchange adjustments, contingency reserve, management reserve and cash-flow forecast."},
      {"name":"Estimation methods","marks":2,"expected":"Correctly compares Analogous, Parametric, Bottom-Up and Three-Point Estimating using the source's strengths/limitations."},
      {"name":"Cost baseline","marks":2,"expected":"Explains aggregation, schedule integration/time-phasing, reserves and stakeholder approval."},
      {"name":"Abuja case","marks":2,"expected":"Explains the failure of analogous-only estimating without site-specific investigation and the source-supported switch to parametric/bottom-up estimating, quantity-surveyor input and 10% contingency."}
    ]
  },
  {
    "position":28,
    "question":"Using only EL03: (a) explain PV, EV and AC; (b) calculate and interpret CV, SV, CPI and SPI; (c) explain BAC, EAC, ETC and VAC including the source formulas; (d) explain how EVM integrates cost and schedule performance; and (e) apply the cost-control lessons from the Ogun State road-expansion case.",
    "criteria":[
      {"name":"PV/EV/AC","marks":2,"expected":"Defines Planned Value (PV) as budgeted scheduled work, Earned Value (EV) as budgeted completed work and Actual Cost (AC) as actual expenditure for completed work."},
      {"name":"CV/SV/CPI/SPI","marks":2,"expected":"Uses and interprets Cost Variance (CV)=EV-AC, Schedule Variance (SV)=EV-PV, Cost Performance Index (CPI)=EV/AC and Schedule Performance Index (SPI)=EV/PV including favourable/unfavourable meanings."},
      {"name":"BAC/EAC/ETC/VAC","marks":2,"expected":"Explains Budget at Completion (BAC), Estimate at Completion (EAC)=BAC/CPI when current cost trend continues, Estimate to Complete (ETC)=EAC-AC and Variance at Completion (VAC)=BAC-EAC."},
      {"name":"EVM integration","marks":2,"expected":"Explains how EVM combines scope, schedule and cost to provide objective performance information and forecasting."},
      {"name":"Ogun case","marks":2,"expected":"Applies source lessons: baseline cost tracking, monthly EVM, validation of completed work before invoices, cost-control oversight and dashboard visibility."}
    ]
  },
  {
    "position":29,
    "question":"Using only EL03: (a) define project financial reporting and financial forecasting; (b) explain the main types and components of financial reports; (c) compare the forecasting techniques listed in the module; (d) use the source's BAC/EV/AC example to explain CPI and EAC forecasting; and (e) apply the lessons from the Lagos Urban Drainage case.",
    "criteria":[
      {"name":"Reporting/forecasting definitions","marks":2,"expected":"Defines reporting as systematic presentation of financial data and forecasting as estimating future financial outcomes from historical/current performance and expected conditions."},
      {"name":"Reports/components","marks":2,"expected":"Explains Budget vs Actual, Cost Performance, Cash Flow and Earned Value reports and components such as budget summary, actuals, variance, cash flow, EAC, metrics and narrative."},
      {"name":"Forecasting techniques","marks":2,"expected":"Explains source-listed Trend Analysis, Moving Average, Regression Analysis, Earned Value Forecasting, Scenario/Sensitivity and Bottom-Up Estimating."},
      {"name":"Worked forecast","marks":2,"expected":"Uses BAC ₦50m, AC ₦30m, EV ₦28m to derive CPI about 0.93 and EAC about ₦53.76m and interprets the overrun forecast."},
      {"name":"Lagos case","marks":2,"expected":"Explains how automated dashboards, monthly rolling forecasts and EAC capability improved visibility, cash-flow adjustment and reduced overrun."}
    ]
  },
  {
    "position":30,
    "question":"Using only EL03: (a) define financial risk and identify major sources; (b) explain the risk-identification, assessment, prioritization, response and monitoring process; (c) explain Avoidance, Mitigation, Transfer and Acceptance; (d) explain financial change management and the Change Request → Impact Analysis → CCB Review → Approval/Rejection → Baseline Update → Implementation/Tracking flow; and (e) apply the Smart City Infrastructure in Abuja case.",
    "criteria":[
      {"name":"Financial risk","marks":2,"expected":"Defines financial risk and identifies source-supported risks such as scope creep, inflation/currency volatility, funding delays, unplanned resource costs and regulatory/tax changes."},
      {"name":"Risk process","marks":2,"expected":"Explains Risk Identification, likelihood/impact assessment, Risk Prioritization, response planning and Monitoring & Control."},
      {"name":"Risk responses","marks":2,"expected":"Explains Risk Avoidance, Risk Mitigation, Risk Transfer and Risk Acceptance with source-level distinctions."},
      {"name":"Financial change control","marks":2,"expected":"Explains the structured change-control sequence and the roles of Change Requests, Impact Analysis, Change Control Board (CCB)/Steering review, Cost Baseline Update/funding-plan updates, implementation and documentation."},
      {"name":"Smart City case","marks":2,"expected":"Applies source lessons: unbudgeted scope expansion, absent risk register/change governance, 18% FX impact, financial change log, risk-based contingency and CCB leading to reduced second-phase variance."}
    ]
  }
]
$theory$::jsonb;
  v_item jsonb;
  v_qid uuid;
begin
  for v_item in select value from jsonb_array_elements(v_theory)
  loop
    v_qid := public.cipmn_mock_seed_uuid('CIPMN-MOD-EL03:THEORY:' || ((v_item->>'position')::integer-25));

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
      'CIPMN-MOD-EL03.pptx (50 slides/pages; reviewed 2026-09-26)',true
    );
  end loop;
end
$theory_insert$;

do $commerce_and_proctoring$
declare
  v_exam_id constant uuid := public.cipmn_mock_seed_uuid('CIPMN-MOD-EL03:EXAM');
begin
  insert into public.agilecert_exam_pricing_policies(
    id,examination_id,currency,standard_amount_minor,promotional_amount_minor,
    promotion_name,promotion_starts_at,promotion_ends_at,access_mode,
    attempts_included,retake_amount_minor,bulk_cart_eligible,is_active,updated_by
  ) values(
    public.cipmn_mock_seed_uuid('CIPMN-MOD-EL03:PRICING-POLICY'),
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
  v_exam_id constant uuid := public.cipmn_mock_seed_uuid('CIPMN-MOD-EL03:EXAM');
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

  select count(*) into v_policy
  from public.agilecert_identity_proctoring_policies
  where examination_id=v_exam_id and active=true and require_camera=true
    and live_event_capture_enabled=true and ai_visual_analysis_enabled=true;

  select count(*) into v_pricing
  from public.agilecert_exam_pricing_policies
  where examination_id=v_exam_id and is_active=true
    and currency='NGN' and standard_amount_minor=2500000 and access_mode='paid';

  if v_mcq<>25 then raise exception 'Expected 25 active EL03 MCQs, found %.',v_mcq; end if;
  if v_theory<>5 then raise exception 'Expected 5 active EL03 Theory questions, found %.',v_theory; end if;
  if v_keys<>25 then raise exception 'Expected 25 EL03 answer keys, found %.',v_keys; end if;
  if v_options<>100 then raise exception 'Expected 100 EL03 MCQ options, found %.',v_options; end if;
  if v_rubrics<>5 then raise exception 'Expected 5 EL03 Theory rubrics, found %.',v_rubrics; end if;
  if v_bad_options<>0 then raise exception 'Found % EL03 MCQ(s) with invalid/repeated options.',v_bad_options; end if;
  if v_bad_rubrics<>0 then raise exception 'Found % invalid EL03 Theory rubric(s).',v_bad_rubrics; end if;
  if v_duplicate_texts<>0 then raise exception 'Found % repeated active EL03 question text(s).',v_duplicate_texts; end if;
  if v_policy<>1 then raise exception 'EL03 proctoring policy invariant failed.'; end if;
  if v_pricing<>1 then raise exception 'EL03 pricing policy invariant failed.'; end if;
end
$verify$;

update public.examinations
set exam_format='cipmn_mixed',
    status='published',
    updated_at=now()
where id=public.cipmn_mock_seed_uuid('CIPMN-MOD-EL03:EXAM');

do $publish_verify$
declare
  v_exam_id constant uuid := public.cipmn_mock_seed_uuid('CIPMN-MOD-EL03:EXAM');
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
    raise exception 'Expected publish trigger to create 2 active EL03 prices, found %.',v_prices;
  end if;
  if v_published<>1 then
    raise exception 'EL03 publish invariant failed.';
  end if;
end
$publish_verify$;

commit;

begin;

-- CIPMN-MOD-EL04 — Project Procurement Management
-- Sole assessment source:
-- CIPMN-MOD-EL04.pptx (73 slides/pages; reviewed 2026-09-26).

do $guard$
declare
  v_exam_id constant uuid := public.cipmn_mock_seed_uuid('CIPMN-MOD-EL04:EXAM');
begin
  if exists (
    select 1 from public.examinations
    where id=v_exam_id
       or upper(code)='CIPMN-MOD-EL04'
       or upper(title) like 'CIPMN-MOD-EL04 - %'
  ) then
    raise exception 'CIPMN-MOD-EL04 already exists; creation aborted.';
  end if;
end
$guard$;

do $exam$
declare
  v_exam_id constant uuid := public.cipmn_mock_seed_uuid('CIPMN-MOD-EL04:EXAM');
  v_programme_id constant uuid := '614ea9d4-0bd4-5df5-a817-9a93937c74e3';
begin
  insert into public.examinations(
    id,programme_id,title,instructions,duration_minutes,pass_mark,status,
    starts_at,ends_at,max_attempts,randomize_questions,randomize_options,
    created_by,allow_self_enrollment,requires_payment,code,exam_format
  ) values(
    v_exam_id,
    v_programme_id,
    'CIPMN-MOD-EL04 - Project Procurement Management Mock Examination',
    'Complete 25 MCQs first, then the 5 Theory questions. The MCQ section contributes 40% and the Theory section contributes 60% of the overall score. This assessment covers the procurement lifecycle, procurement planning and strategy, Nigerian procurement methods and legal/institutional framework, supplier management, contract administration, ethics, transparency and contract performance. Payment, an applicable coupon or an administrator assignment is required before launch.',
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
    'CIPMN-MOD-EL04',
    'standard'
  );
end
$exam$;

do $mcq_insert$
declare
  v_exam_id constant uuid := public.cipmn_mock_seed_uuid('CIPMN-MOD-EL04:EXAM');
  v_mcqs jsonb := $mcq$
[
  {
    "position":1,
    "question":"Which definition best matches procurement in EL04?",
    "options":[
      "The process of acquiring external goods, works or services required for successful project implementation.",
      "The internal allocation of staff after contract award.",
      "The process of approving only supplier invoices.",
      "The final audit of completed contracts."
    ],
    "correct":1
  },
  {
    "position":2,
    "question":"Which statement correctly describes Nigeria's Public Procurement Act 2007 in EL04?",
    "options":[
      "It is the main public-procurement law promoting transparency, accountability, competition and value for money.",
      "It applies only to emergency procurement.",
      "It governs private household purchases.",
      "It replaces the need for procuring entities."
    ],
    "correct":1
  },
  {
    "position":3,
    "question":"Which institution is identified in EL04 as the highest policy-making body for public procurement?",
    "options":[
      "Bureau of Public Procurement.",
      "National Council on Public Procurement.",
      "Federal Executive Council.",
      "Ministry Tenders Board."
    ],
    "correct":2
  },
  {
    "position":4,
    "question":"What does a Certificate of No Objection signify in the EL04 deck?",
    "options":[
      "BPP confirmation that the procurement complies with applicable requirements before fund disbursement.",
      "A contractor's guarantee that no variation will occur.",
      "A waiver from competitive bidding.",
      "Final acceptance of completed works."
    ],
    "correct":1
  },
  {
    "position":5,
    "question":"Which sequence best reflects the typical procurement process shown in EL04?",
    "options":[
      "Identify Need → Procurement Planning → Market Research → Procurement Strategy → Solicitation → Tender/Bids → Evaluation → Award → Contract Management → Close-out → Lessons Learned.",
      "Tender → Award → Need Identification → Planning → Close-out.",
      "Market Research → Contract Close-out → Tender → Award.",
      "Award → Needs Assessment → Advertisement → Lessons Learned."
    ],
    "correct":1
  },
  {
    "position":6,
    "question":"What procurement lesson is emphasized by the Abuja–Kaduna Rail Line case?",
    "options":[
      "Clear scope, strategic partnership, contract coordination and value delivery can support successful procurement outcomes.",
      "Lowest price alone guarantees value for money.",
      "Contract management is unnecessary after award.",
      "Public infrastructure should avoid specialist contractors."
    ],
    "correct":1
  },
  {
    "position":7,
    "question":"Which failure is explicitly linked to abandoned road projects in EL04?",
    "options":[
      "Inadequate needs assessment, flawed bidding, weak contract management and corruption.",
      "Excessive supplier prequalification.",
      "Too much market research.",
      "Overuse of performance dashboards."
    ],
    "correct":1
  },
  {
    "position":8,
    "question":"Which issue contributed to failure in the rural-road procurement scenario?",
    "options":[
      "The procurement team skipped adequate market analysis and contractor-capacity checks and relied heavily on lowest bid.",
      "The team used too many technical evaluation criteria.",
      "The project had excessive local material availability.",
      "The contractor had no other active projects."
    ],
    "correct":1
  },
  {
    "position":9,
    "question":"Which item belongs to procurement planning in EL04?",
    "options":[
      "Needs Assessment, Market Analysis, Import Dependency and Pricing Trends.",
      "Only contract litigation.",
      "Only final payment certification.",
      "Only vendor close-out."
    ],
    "correct":1
  },
  {
    "position":10,
    "question":"Which procurement risk category includes corruption, fraud and conflict of interest?",
    "options":[
      "Ethical Risk.",
      "Performance Risk.",
      "Logistical Risk.",
      "Financial Risk."
    ],
    "correct":1
  },
  {
    "position":11,
    "question":"Which factor is part of developing a procurement strategy in EL04?",
    "options":[
      "Procurement method, contract type, timeline, resources, evaluation criteria and local-content integration.",
      "Only project branding.",
      "Only supplier tax history.",
      "Only contract close-out dates."
    ],
    "correct":1
  },
  {
    "position":12,
    "question":"Why did the NAFDAC LIMS scenario adopt a two-stage tendering approach?",
    "options":[
      "To refine technical requirements, assess local capacity, and then obtain financial bids while balancing local content, sustainability and value for money.",
      "To avoid technical evaluation.",
      "To award directly to an international supplier.",
      "To remove long-term support considerations."
    ],
    "correct":1
  },
  {
    "position":13,
    "question":"Which tool is explicitly listed in EL04 procurement planning and strategy?",
    "options":[
      "Total Cost of Ownership.",
      "Critical Path Method only.",
      "Monte Carlo schedule simulation only.",
      "Balanced Scorecard."
    ],
    "correct":1
  },
  {
    "position":14,
    "question":"Which factor most directly influences procurement-method selection in EL04?",
    "options":[
      "Procurement value and complexity, urgency, market conditions and nature of the requirement.",
      "Supplier advertising budget.",
      "Project team size only.",
      "Number of internal meetings."
    ],
    "correct":1
  },
  {
    "position":15,
    "question":"For a low-value, readily available item such as office stationery, which method does EL04 identify as potentially appropriate?",
    "options":[
      "Request for Quotations.",
      "International Competitive Bidding.",
      "Direct Procurement in every case.",
      "Two-stage tendering."
    ],
    "correct":1
  },
  {
    "position":16,
    "question":"Which consequence can result from improper procurement-method selection under EL04?",
    "options":[
      "Violation of PPA 2007, reduced competition, poor value for money and increased corruption risk.",
      "Automatic contract extension.",
      "Guaranteed supplier diversity.",
      "Elimination of public scrutiny."
    ],
    "correct":1
  },
  {
    "position":17,
    "question":"According to the threshold table in EL04, what is the Request for Quotations threshold for Goods & Non-Consultant Services?",
    "options":[
      "Less than ₦30 million.",
      "Less than ₦50 million.",
      "At least ₦500 million.",
      "At least ₦1 billion."
    ],
    "correct":1
  },
  {
    "position":18,
    "question":"According to the EL04 threshold table, what is the Request for Quotations threshold for Works?",
    "options":[
      "Less than ₦50 million.",
      "Less than ₦30 million.",
      "At least ₦1 billion.",
      "At least ₦5 billion."
    ],
    "correct":1
  },
  {
    "position":19,
    "question":"Which vendor-management practice is emphasized in the Lagos Blue Line case?",
    "options":[
      "Capability-based vendor selection, clear responsibilities, continuous performance monitoring and proactive risk mitigation.",
      "Awarding work based only on lowest price.",
      "Avoiding contingency planning.",
      "Stopping supplier communication after contract award."
    ],
    "correct":1
  },
  {
    "position":20,
    "question":"Which tools are specifically listed for vendor/supplier management in EL04?",
    "options":[
      "Vendor Relationship Management software, Supplier Performance Management dashboards and Communication Plans.",
      "Only payroll software.",
      "Only accounting ledgers.",
      "Only legal case-management tools."
    ],
    "correct":1
  },
  {
    "position":21,
    "question":"Which statement best describes contract management and administration in EL04?",
    "options":[
      "It extends from contract award to final closure and ensures both parties fulfil their contractual obligations.",
      "It ends immediately after contract signing.",
      "It is limited to payment approval.",
      "It replaces supplier-performance monitoring."
    ],
    "correct":1
  },
  {
    "position":22,
    "question":"Which item is part of EL04 contract administration?",
    "options":[
      "Kick-off meeting, communication management, documentation, change management and payment administration.",
      "Only tender advertisement.",
      "Only prequalification.",
      "Only needs assessment."
    ],
    "correct":1
  },
  {
    "position":23,
    "question":"Which dispute-resolution mechanisms are explicitly listed in EL04 contract management?",
    "options":[
      "Negotiation, Mediation, Conciliation, Arbitration and Litigation.",
      "Only Arbitration and Litigation.",
      "Only Negotiation and Mediation.",
      "Expert Determination and Adjudication only."
    ],
    "correct":1
  },
  {
    "position":24,
    "question":"Which set reflects the core ethical principles shown in EL04?",
    "options":[
      "Integrity, Objectivity, Fairness, Professionalism and Accountability.",
      "Speed, Secrecy, Loyalty, Informality and Flexibility.",
      "Profit, Competition, Litigation, Control and Exclusivity.",
      "Negotiation, Arbitration, Audit, Scheduling and Costing."
    ],
    "correct":1
  },
  {
    "position":25,
    "question":"What ethical lesson does the P&ID case illustrate in EL04?",
    "options":[
      "Alleged bribery, conflicts of interest and compromised negotiations can create severe financial and reputational consequences.",
      "Contract disputes never affect public finances.",
      "Ethics is separate from procurement performance.",
      "Arbitration automatically protects a procuring entity from corruption."
    ],
    "correct":1
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
    v_qid := public.cipmn_mock_seed_uuid('CIPMN-MOD-EL04:MCQ:' || (v_item->>'position'));

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
      raise exception 'No correct option resolved for EL04 MCQ position %.',v_item->>'position';
    end if;

    insert into public.question_answer_keys(question_id,correct_option_id)
    values(v_qid,v_correct_id);
  end loop;
end
$mcq_insert$;

do $theory_insert$
declare
  v_exam_id constant uuid := public.cipmn_mock_seed_uuid('CIPMN-MOD-EL04:EXAM');
  v_theory jsonb := $theory$
[
  {
    "position":26,
    "question":"Using only EL04: (a) define procurement, public procurement, PPA 2007, BPP, NCPP, Procuring Entity, CNO and Value for Money; (b) explain the typical procurement lifecycle from need identification to lessons learned; (c) explain the Abuja–Kaduna Rail Line procurement lessons; (d) explain the causes of abandoned projects; and (e) analyse the rural-road procurement-planning failure.",
    "criteria":[
      {"name":"Core definitions","marks":2,"expected":"Accurately defines procurement, public procurement, PPA 2007, BPP, NCPP, Procuring Entity, CNO and Value for Money at the source's level."},
      {"name":"Procurement lifecycle","marks":2,"expected":"Explains Identify Need through planning, market research, strategy, solicitation, advertisement, bids, evaluation, award, contract management, close-out and lessons learned."},
      {"name":"Successful procurement case","marks":2,"expected":"Uses source-supported Abuja–Kaduna lessons: clear scope, capable strategic partner, coordination/timely delivery and value from improved transport."},
      {"name":"Abandoned-project lessons","marks":2,"expected":"Explains weak needs assessment, flawed bidding, unqualified contractors, poor contract management, delayed payments and corruption."},
      {"name":"Rural-road analysis","marks":2,"expected":"Explains rushed planning, weak market survey, inadequate contractor-capacity checks, lowest-bid bias, material-price/supply shocks and resource overstretch."}
    ]
  },
  {
    "position":27,
    "question":"Using only EL04: (a) define procurement planning; (b) explain Needs Assessment, Market Analysis, Import Dependency and Pricing Trends; (c) explain procurement risk categories and the elements of procurement strategy; (d) explain the NAFDAC LIMS market-analysis and two-stage-tendering decision; and (e) explain the planning/strategy tools listed in the module.",
    "criteria":[
      {"name":"Procurement planning","marks":2,"expected":"Defines procurement planning as identifying goods/works/services, timing and acquisition methods to support efficient, cost-effective and compliant execution."},
      {"name":"Needs/market analysis","marks":2,"expected":"Explains needs assessment, supplier/market research, local content, import dependency/exchange-rate exposure and pricing trends."},
      {"name":"Risks/strategy","marks":2,"expected":"Explains financial, performance, legal/regulatory, ethical and logistical risks plus method, contract type, timeline, resources, evaluation criteria and local-content integration."},
      {"name":"NAFDAC LIMS case","marks":2,"expected":"Explains RFIs/market analysis, international-vendor/local-firm strengths/limitations and two-stage tendering to refine specifications and assess local capacity before financial bids."},
      {"name":"Tools/frameworks","marks":2,"expected":"Explains source-listed SWOT, Make-or-Buy, Category Management, Stakeholder Engagement, ABC Analysis, Spend Analysis, TCO and Market Intelligence tools."}
    ]
  },
  {
    "position":28,
    "question":"Using only EL04: (a) explain why defined procurement methods matter; (b) explain the factors that influence method selection; (c) compare OCB/NCB/ICB, RFQ, Restricted Tendering, Direct Procurement and Emergency Procurement at the level taught; (d) explain the consequences of improper method selection; and (e) apply the method-selection lessons from the hospital MRI, office-stationery and Lagos–Ibadan Expressway scenarios, including the threshold examples shown in the deck.",
    "criteria":[
      {"name":"Purpose of methods","marks":2,"expected":"Explains competition, transparency, value for money, standardization and accountability."},
      {"name":"Selection factors","marks":2,"expected":"Explains value/complexity, urgency, market conditions and nature of requirement."},
      {"name":"Methods comparison","marks":2,"expected":"Compares OCB/NCB/ICB, RFQ, Restricted, Direct and Emergency Procurement using source conditions/examples only."},
      {"name":"Improper-selection consequences","marks":2,"expected":"Explains PPA violation, sanctions/debarment/prosecution, poor VFM, reduced competition, corruption risk and public distrust."},
      {"name":"Cases/thresholds","marks":2,"expected":"Applies MRI, stationery and Lagos–Ibadan scenarios and source threshold examples, including RFQ goods/non-consultant <₦30m and works <₦50m, without importing outside thresholds."}
    ]
  },
  {
    "position":29,
    "question":"Using only EL04: (a) explain vendor/supplier management and vendor selection; (b) explain prequalification/selection, contract award/mobilization, collaborative relationships and onboarding; (c) explain supplier-performance monitoring and vendor-related risk mitigation; (d) apply the road-project, e-Governance and Lagos Blue Line examples; and (e) explain the vendor-management tools, techniques and frameworks listed in the module.",
    "criteria":[
      {"name":"Vendor management","marks":2,"expected":"Explains strategic relationships, communication, performance monitoring, risk mitigation and timely/quality delivery."},
      {"name":"Lifecycle activities","marks":2,"expected":"Explains prequalification/selection, award/mobilization, collaboration and onboarding/orientation."},
      {"name":"Performance/risk","marks":2,"expected":"Explains monitoring schedules, quality, SLAs, equipment/labour/service performance and proactive contingencies, alternatives and escalation."},
      {"name":"Case application","marks":2,"expected":"Uses road-vendor quality/equipment/labour checks, e-Governance SLA/security/support monitoring and Lagos Blue Line capability/stability/performance lessons."},
      {"name":"Tools/frameworks","marks":2,"expected":"Explains VRM software, SPM dashboards, communication plans, stakeholder analysis, risk assessment, negotiation, performance reviews, PMBOK procurement area and ISO 44001 at the level taught."}
    ]
  },
  {
    "position":30,
    "question":"Using only EL04: (a) explain contract management and administration from award to close-out; (b) explain award, administration, performance-monitoring and closure activities; (c) explain Negotiation, Mediation, Conciliation, Arbitration and Litigation as the listed dispute mechanisms; (d) explain Integrity, Objectivity, Fairness, Professionalism and Accountability in public procurement; and (e) analyse the ethical and contract-performance lessons from the P&ID controversy.",
    "criteria":[
      {"name":"Contract-management scope","marks":2,"expected":"Explains the award-to-closeout lifecycle and ensuring both parties meet obligations while protecting objectives, risk and value for money."},
      {"name":"Administration/performance/closure","marks":2,"expected":"Explains notification, performance guarantee, signing, kickoff, communication, records, changes, payments, progress, QA/QC, risk/compliance monitoring, final inspection, final payment, guarantee release, lessons and archiving."},
      {"name":"Dispute mechanisms","marks":2,"expected":"Explains Negotiation, Mediation, Conciliation, Arbitration and Litigation as source-listed mechanisms without adding outside procedural doctrine."},
      {"name":"Ethical principles","marks":2,"expected":"Explains Integrity, Objectivity, Fairness, Professionalism and Accountability using the source definitions."},
      {"name":"P&ID lessons","marks":2,"expected":"Explains alleged bribery, conflicts of interest and compromised negotiations and their severe financial/reputational impact, including the potential >$10bn exposure described in the deck."}
    ]
  }
]
$theory$::jsonb;
  v_item jsonb;
  v_qid uuid;
begin
  for v_item in select value from jsonb_array_elements(v_theory)
  loop
    v_qid := public.cipmn_mock_seed_uuid('CIPMN-MOD-EL04:THEORY:' || ((v_item->>'position')::integer-25));

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
      'CIPMN-MOD-EL04.pptx (73 slides/pages; reviewed 2026-09-26)',true
    );
  end loop;
end
$theory_insert$;

do $commerce_and_proctoring$
declare
  v_exam_id constant uuid := public.cipmn_mock_seed_uuid('CIPMN-MOD-EL04:EXAM');
begin
  insert into public.agilecert_exam_pricing_policies(
    id,examination_id,currency,standard_amount_minor,promotional_amount_minor,
    promotion_name,promotion_starts_at,promotion_ends_at,access_mode,
    attempts_included,retake_amount_minor,bulk_cart_eligible,is_active,updated_by
  ) values(
    public.cipmn_mock_seed_uuid('CIPMN-MOD-EL04:PRICING-POLICY'),
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
  v_exam_id constant uuid := public.cipmn_mock_seed_uuid('CIPMN-MOD-EL04:EXAM');
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

  if v_mcq<>25 then raise exception 'Expected 25 active EL04 MCQs, found %.',v_mcq; end if;
  if v_theory<>5 then raise exception 'Expected 5 active EL04 Theory questions, found %.',v_theory; end if;
  if v_keys<>25 then raise exception 'Expected 25 EL04 answer keys, found %.',v_keys; end if;
  if v_options<>100 then raise exception 'Expected 100 EL04 MCQ options, found %.',v_options; end if;
  if v_rubrics<>5 then raise exception 'Expected 5 EL04 Theory rubrics, found %.',v_rubrics; end if;
  if v_bad_options<>0 then raise exception 'Found % EL04 MCQ(s) with invalid/repeated options.',v_bad_options; end if;
  if v_bad_rubrics<>0 then raise exception 'Found % invalid EL04 Theory rubric(s).',v_bad_rubrics; end if;
  if v_duplicate_texts<>0 then raise exception 'Found % repeated active EL04 question text(s).',v_duplicate_texts; end if;
  if v_policy<>1 then raise exception 'EL04 proctoring policy invariant failed.'; end if;
  if v_pricing<>1 then raise exception 'EL04 pricing policy invariant failed.'; end if;
end
$verify$;

update public.examinations
set exam_format='cipmn_mixed',
    status='published',
    updated_at=now()
where id=public.cipmn_mock_seed_uuid('CIPMN-MOD-EL04:EXAM');

do $publish_verify$
declare
  v_exam_id constant uuid := public.cipmn_mock_seed_uuid('CIPMN-MOD-EL04:EXAM');
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
    raise exception 'Expected publish trigger to create 2 active EL04 prices, found %.',v_prices;
  end if;
  if v_published<>1 then
    raise exception 'EL04 publish invariant failed.';
  end if;
end
$publish_verify$;

commit;

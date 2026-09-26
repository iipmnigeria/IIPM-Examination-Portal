begin;

-- CIPMN-MOD-EL02 — Project Management Ethics, Governance and Legal
-- Sole assessment source:
-- CIPMN-MOD-EL02.pptx (38 slides/pages; reviewed 2026-09-26).
-- Creates a new elective examination atomically. It remains draft until
-- question-bank, rubric, pricing-policy and proctoring invariants pass.

do $guard$
declare
  v_exam_id constant uuid := public.cipmn_mock_seed_uuid('CIPMN-MOD-EL02:EXAM');
begin
  if exists (
    select 1 from public.examinations
    where id=v_exam_id
       or upper(code)='CIPMN-MOD-EL02'
       or upper(title) like 'CIPMN-MOD-EL02 - %'
  ) then
    raise exception 'CIPMN-MOD-EL02 already exists; creation aborted.';
  end if;
end
$guard$;

do $exam$
declare
  v_exam_id constant uuid := public.cipmn_mock_seed_uuid('CIPMN-MOD-EL02:EXAM');
  v_programme_id constant uuid := '614ea9d4-0bd4-5df5-a817-9a93937c74e3';
begin
  insert into public.examinations(
    id,programme_id,title,instructions,duration_minutes,pass_mark,status,
    starts_at,ends_at,max_attempts,randomize_questions,randomize_options,
    created_by,allow_self_enrollment,requires_payment,code,exam_format
  ) values(
    v_exam_id,
    v_programme_id,
    'CIPMN-MOD-EL02 - Project Management Ethics, Governance and Legal Mock Examination',
    'Complete 25 MCQs first, then the 5 Theory questions. The MCQ section contributes 40% and the Theory section contributes 60% of the overall score. This assessment covers project-management ethics, governance, Nigerian legal and regulatory responsibilities, contract and procurement-law issues, dispute resolution, compliance practices and source-based case analysis. Payment, an applicable coupon or an administrator assignment is required before launch.',
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
    'CIPMN-MOD-EL02',
    'standard'
  );
end
$exam$;

do $mcq_insert$
declare
  v_exam_id constant uuid := public.cipmn_mock_seed_uuid('CIPMN-MOD-EL02:EXAM');
  v_mcqs jsonb := $mcq$
[
  {
    "position": 1,
    "question": "Which statement best reflects the purpose of professional ethics in project management as taught in EL02?",
    "options": [
      "To replace governance controls with personal judgement.",
      "To guide responsible conduct, protect trust and support transparent and accountable project decisions.",
      "To focus only on compliance after project completion.",
      "To allow project managers to ignore stakeholder concerns when delivery targets are met."
    ],
    "correct": 2
  },
  {
    "position": 2,
    "question": "Which situation is explicitly presented as an ethical issue in the EL02 materials?",
    "options": [
      "Inflating a supplier invoice to create room for an unofficial payment.",
      "Using an approved governance dashboard.",
      "Escalating a regulatory concern through the proper channel.",
      "Declaring a conflict of interest before evaluation."
    ],
    "correct": 1
  },
  {
    "position": 3,
    "question": "A project manager awards work to a relative despite stronger competing bids. Which ethical concern from EL02 does this most directly illustrate?",
    "options": [
      "Mediation.",
      "Performance reporting.",
      "Nepotism.",
      "Whistleblowing."
    ],
    "correct": 3
  },
  {
    "position": 4,
    "question": "A project team deliberately reports 90% completion when only 60% of the agreed work has been done. Which EL02 ethical issue is most directly involved?",
    "options": [
      "Contract termination.",
      "Progress misreporting.",
      "Conflict resolution.",
      "Governance alignment."
    ],
    "correct": 2
  },
  {
    "position": 5,
    "question": "Which action best reflects proper handling of a Conflict of Interest under EL02?",
    "options": [
      "Hide the relationship if the affected supplier appears technically qualified.",
      "Disclose the conflict and avoid participating in decisions where impartiality could reasonably be questioned.",
      "Continue the evaluation but document the conflict after award.",
      "Allow the conflicted person to score only the financial section."
    ],
    "correct": 2
  },
  {
    "position": 6,
    "question": "Which sequence correctly represents the ethical decision process taught in EL02?",
    "options": [
      "Recognize issue → Gather facts → Apply ethical test → Decide → Reflect.",
      "Apply ethical test → Gather facts → Decide → Recognize issue → Reflect.",
      "Recognize issue → Decide → Gather facts → Reflect → Apply ethical test.",
      "Gather facts → Decide → Recognize issue → Reflect → Apply ethical test."
    ],
    "correct": 1
  },
  {
    "position": 7,
    "question": "Which ethical approach in EL02 focuses primarily on choosing the action that produces the greatest overall good?",
    "options": [
      "Utilitarianism.",
      "Legal positivism.",
      "Virtue Ethics.",
      "Rights-based Ethics."
    ],
    "correct": 1
  },
  {
    "position": 8,
    "question": "Which ethical approach emphasizes respecting the rights and dignity of affected individuals rather than only the total outcome?",
    "options": [
      "Cost-benefit analysis.",
      "Rights-based Ethics.",
      "Utilitarianism.",
      "Virtue Ethics."
    ],
    "correct": 2
  },
  {
    "position": 9,
    "question": "Which ethical approach asks what a person of good character and integrity should do in the situation?",
    "options": [
      "Rights-based Ethics.",
      "Virtue Ethics.",
      "Utilitarianism.",
      "Compliance auditing."
    ],
    "correct": 2
  },
  {
    "position": 10,
    "question": "Which leadership behaviour is most consistent with ethical leadership in EL02?",
    "options": [
      "Leading by example, encouraging openness and standing firm against unethical pressure.",
      "Keeping ethical concerns within the project team even when escalation is required.",
      "Avoiding difficult ethical decisions by delegating them entirely.",
      "Rewarding results even when improper methods were used."
    ],
    "correct": 1
  },
  {
    "position": 11,
    "question": "Which whistleblowing route is explicitly recognized in EL02?",
    "options": [
      "Only external litigation.",
      "Only reporting to the supplier involved.",
      "Internal reporting channels, relevant bodies such as EFCC/ICPC, and applicable donor channels.",
      "Only anonymous social-media publication."
    ],
    "correct": 3
  },
  {
    "position": 12,
    "question": "Which factor is identified in EL02 as a practical ethical pressure in the Nigerian project environment?",
    "options": [
      "Universal absence of stakeholder diversity.",
      "Political interference and inconsistent enforcement.",
      "Excessive automation of governance reporting.",
      "Mandatory arbitration in all contracts."
    ],
    "correct": 2
  },
  {
    "position": 13,
    "question": "Which statement best describes project governance in EL02?",
    "options": [
      "A system of structures, processes, people and tools that supports strategic alignment, accountability, compliance and value delivery.",
      "A documentation exercise performed only before project approval.",
      "A substitute for project leadership and stakeholder engagement.",
      "A finance function responsible only for audit trails."
    ],
    "correct": 1
  },
  {
    "position": 14,
    "question": "Which governance role is typically responsible for executive direction, oversight and major project decisions according to EL02?",
    "options": [
      "Every supplier equally.",
      "Only the project scheduler.",
      "External auditors acting alone.",
      "Project Board or Sponsor."
    ],
    "correct": 4
  },
  {
    "position": 15,
    "question": "What is a core governance contribution of a Project Management Office (PMO) in the EL02 context?",
    "options": [
      "Eliminating escalation routes.",
      "Approving every supplier invoice personally.",
      "Strengthening standards, reporting, oversight and consistency across projects.",
      "Replacing all project sponsors."
    ],
    "correct": 3
  },
  {
    "position": 16,
    "question": "Which set contains governance tools or mechanisms specifically discussed in EL02?",
    "options": [
      "Only procurement invoices and tax receipts.",
      "Dashboards, audit reports and KPIs.",
      "Only Gantt charts and CPM.",
      "Only legal pleadings and court orders."
    ],
    "correct": 2
  },
  {
    "position": 17,
    "question": "Which governance references are named in EL02 at the level of general governance guidance?",
    "options": [
      "PMBOK, PRINCE2, ISO 37000 and DUCAP.",
      "COBIT, ITIL, TOGAF and Six Sigma.",
      "FIDIC, NEC, JCT and ICC.",
      "COSO, Basel III, IFRS 9 and SOX."
    ],
    "correct": 1
  },
  {
    "position": 18,
    "question": "What lesson does the NIMC/NIN case illustrate in the EL02 governance discussion?",
    "options": [
      "Governance structures are unnecessary for national programmes.",
      "Technical capability alone guarantees timely delivery.",
      "Public-sector programmes should avoid dashboards and reporting.",
      "Weak governance, coordination or oversight can delay delivery even where the programme itself is strategically important."
    ],
    "correct": 4
  },
  {
    "position": 19,
    "question": "Which Nigerian law is identified in EL02 as the primary public-procurement legal framework relevant to projects?",
    "options": [
      "Labour Act only.",
      "Environmental Impact Assessment Act only.",
      "Public Procurement Act 2007.",
      "Companies and Allied Matters Act only."
    ],
    "correct": 3
  },
  {
    "position": 20,
    "question": "Which legal framework named in EL02 is most directly associated with employment and labour obligations?",
    "options": [
      "Nigerian Contract Law.",
      "Labour Act.",
      "Public Procurement Act 2007.",
      "Environmental Impact Assessment Act."
    ],
    "correct": 2
  },
  {
    "position": 21,
    "question": "Which contract provisions are explicitly highlighted in EL02 as important areas for legal clarity?",
    "options": [
      "Scope, payment terms, force majeure, termination and dispute resolution.",
      "Only branding, marketing and media rights.",
      "Only project schedule and team structure.",
      "Only supplier tax history."
    ],
    "correct": 1
  },
  {
    "position": 22,
    "question": "Which dispute-resolution method in EL02 involves direct discussion by the parties without necessarily using an independent third party?",
    "options": [
      "Mediation.",
      "Arbitration.",
      "Litigation.",
      "Negotiation."
    ],
    "correct": 4
  },
  {
    "position": 23,
    "question": "Which dispute-resolution method uses an independent neutral who helps parties reach agreement but does not normally impose a binding decision?",
    "options": [
      "Litigation.",
      "Termination.",
      "Mediation.",
      "Arbitration."
    ],
    "correct": 3
  },
  {
    "position": 24,
    "question": "Which compliance practice is recommended in EL02 for reducing legal and regulatory risk during projects?",
    "options": [
      "Avoid documenting permits and approvals to reduce administrative burden.",
      "Use a legal-compliance checklist by project phase, involve legal advisers early, train the team and monitor compliance regularly.",
      "Review legal obligations only after a dispute arises.",
      "Delegate compliance entirely to suppliers."
    ],
    "correct": 2
  },
  {
    "position": 25,
    "question": "In the EL02 ₦1.5bn ICT project case, which combination best reflects the failures that contributed to project collapse and restart cost?",
    "options": [
      "Procurement irregularities, weak contractual provisions, labour breaches and regulatory non-compliance.",
      "Excessive legal review, too much governance and over-documented procurement.",
      "Too many mediation sessions before award.",
      "Overuse of environmental-impact analysis and public consultation."
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
    v_qid := public.cipmn_mock_seed_uuid('CIPMN-MOD-EL02:MCQ:' || (v_item->>'position'));

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
      raise exception 'No correct option resolved for EL02 MCQ position %.',v_item->>'position';
    end if;

    insert into public.question_answer_keys(question_id,correct_option_id)
    values(v_qid,v_correct_id);
  end loop;
end
$mcq_insert$;

do $theory_insert$
declare
  v_exam_id constant uuid := public.cipmn_mock_seed_uuid('CIPMN-MOD-EL02:EXAM');
  v_theory jsonb := $theory$
[
  {
    "position":26,
    "question":"Using only EL02: (a) explain professional ethics in project management and why it matters; (b) explain bribery, nepotism, inflated billing, progress misreporting and Conflict of Interest; (c) explain the five-step ethical decision process; (d) compare Utilitarianism, Rights-based Ethics and Virtue Ethics at the level taught; and (e) explain the project manager's ethical responsibilities to clients, teams, regulators and the public.",
    "criteria":[
      {"name":"Ethics purpose","marks":2,"expected":"Explains ethics as standards guiding responsible conduct, trust, transparency, accountability and credible project decisions."},
      {"name":"Common ethical issues","marks":2,"expected":"Explains source-supported issues including bribery, nepotism, inflated billing, progress misreporting and Conflict of Interest."},
      {"name":"Decision process","marks":2,"expected":"Explains Recognize issue → Gather facts → Apply ethical test → Decide → Reflect."},
      {"name":"Ethical approaches","marks":2,"expected":"Compares Utilitarianism, Rights-based Ethics and Virtue Ethics using only the source's high-level distinctions."},
      {"name":"Stakeholder responsibility","marks":2,"expected":"Explains the project manager's responsibility for honest, fair, accountable conduct toward clients, team members, regulators, beneficiaries/public and other stakeholders."}
    ]
  },
  {
    "position":27,
    "question":"Using only EL02: (a) explain ethical leadership in projects; (b) explain whistleblowing and the reporting channels identified in the module; (c) explain how cultural/social pressures, political interference and inconsistent enforcement can affect ethical behaviour in Nigeria; (d) explain how a project leader can build an ethical project culture; and (e) explain how retaliation concerns should be handled within the source's whistleblowing principles.",
    "criteria":[
      {"name":"Ethical leadership","marks":2,"expected":"Explains leading by example, openness, rewarding integrity and resisting unethical pressure."},
      {"name":"Whistleblowing","marks":2,"expected":"Explains internal reporting, relevant bodies such as EFCC/ICPC and applicable donor channels as source-listed routes."},
      {"name":"Nigerian pressures","marks":2,"expected":"Explains cultural/social pressures, political interference and inconsistent enforcement as practical ethical challenges."},
      {"name":"Ethical culture","marks":2,"expected":"Explains clear expectations, open communication, transparent decisions, leadership example and support for reporting concerns."},
      {"name":"Protection from retaliation","marks":2,"expected":"Explains the need for safe reporting and protection against retaliation at the level supported by the deck, without inventing statutory procedures."}
    ]
  },
  {
    "position":28,
    "question":"Using only EL02: (a) define project governance and explain Structures, Processes, People and Tools; (b) explain the roles of Project Boards, Sponsors and PMOs; (c) explain governance contributions to strategic alignment, accountability, risk/compliance and value delivery; (d) explain the role of dashboards, audit reports and KPIs; and (e) apply the governance lessons from the NIMC/NIN case and the module's recommendations for role clarity, escalation and PMO strengthening.",
    "criteria":[
      {"name":"Governance definition/components","marks":2,"expected":"Defines governance and explains Structures, Processes, People and Tools as the source's core governance components."},
      {"name":"Governance roles","marks":2,"expected":"Explains oversight/direction roles of Project Boards/Sponsors and standards/reporting/coordination contributions of PMOs."},
      {"name":"Governance value","marks":2,"expected":"Explains strategic alignment, accountability, risk/compliance oversight and value delivery."},
      {"name":"Governance tools","marks":2,"expected":"Explains dashboards, audit reports and KPIs as tools for visibility, monitoring and accountability."},
      {"name":"Case/recommendations","marks":2,"expected":"Uses the NIMC/NIN case to explain governance/coordination delays and source-supported remedies such as role clarity, reporting, escalation routes and PMO strengthening."}
    ]
  },
  {
    "position":29,
    "question":"Using only EL02: (a) identify the major Nigerian legal frameworks named in the module; (b) explain how the Public Procurement Act 2007, Labour Act, Environmental Impact Assessment Act and Nigerian Contract Law affect projects at the level taught; (c) explain key contract provisions including scope, payment terms, force majeure, termination and dispute resolution; (d) explain common legal risks such as breach, permit/licence failure, labour disputes and intellectual-property infringement; and (e) compare Negotiation, Mediation, Arbitration and Litigation.",
    "criteria":[
      {"name":"Legal frameworks","marks":2,"expected":"Identifies source-named frameworks including CAMA, Public Procurement Act 2007, Labour Act, Environmental Impact Assessment Act and Nigerian Contract Law."},
      {"name":"Project implications","marks":2,"expected":"Explains procurement compliance, labour obligations, environmental approval/compliance and enforceable contractual obligations at the source's level of detail."},
      {"name":"Contract provisions","marks":2,"expected":"Explains scope, payment terms, force majeure, termination and dispute-resolution provisions as areas requiring clarity."},
      {"name":"Legal risks","marks":2,"expected":"Explains breach, missing permits/licences, labour disputes and IP infringement as source-supported examples without introducing deeper legal doctrine."},
      {"name":"Dispute resolution","marks":2,"expected":"Compares Negotiation, Mediation, Arbitration and Litigation by formality, third-party involvement and binding nature at the level taught."}
    ]
  },
  {
    "position":30,
    "question":"Using only EL02, analyse the ₦1.5bn ICT project case: (a) identify the procurement irregularities; (b) identify the contractual weaknesses; (c) explain the labour and regulatory compliance failures; (d) explain the consequences, including litigation, project failure and the additional ₦400m restart cost; and (e) recommend only source-supported preventive controls covering procurement, contracts, labour compliance, permits/regulatory approvals and continuous legal/compliance monitoring.",
    "criteria":[
      {"name":"Procurement failures","marks":2,"expected":"Identifies the source-described irregular procurement practices and lack of proper procurement compliance."},
      {"name":"Contract weaknesses","marks":2,"expected":"Explains weak or ambiguous contractual provisions and inadequate legal protection/clarity as presented in the case."},
      {"name":"Labour/regulatory failures","marks":2,"expected":"Explains labour-law breaches and regulatory non-compliance, including source-referenced NCC issues where applicable."},
      {"name":"Consequences","marks":2,"expected":"Explains the resulting disputes/litigation, project collapse or failure and the cited additional ₦400m restart cost."},
      {"name":"Preventive controls","marks":2,"expected":"Recommends source-supported controls: procurement-law compliance, clear contracts, labour compliance, permits/approvals, early legal advice, team training, compliance checklists and regular monitoring/audits."}
    ]
  }
]
$theory$::jsonb;
  v_item jsonb;
  v_qid uuid;
begin
  for v_item in select value from jsonb_array_elements(v_theory)
  loop
    v_qid := public.cipmn_mock_seed_uuid('CIPMN-MOD-EL02:THEORY:' || ((v_item->>'position')::integer-25));

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
      'CIPMN-MOD-EL02.pptx (38 slides/pages; reviewed 2026-09-26)',true
    );
  end loop;
end
$theory_insert$;

do $commerce_and_proctoring$
declare
  v_exam_id constant uuid := public.cipmn_mock_seed_uuid('CIPMN-MOD-EL02:EXAM');
begin
  insert into public.agilecert_exam_pricing_policies(
    id,examination_id,currency,standard_amount_minor,promotional_amount_minor,
    promotion_name,promotion_starts_at,promotion_ends_at,access_mode,
    attempts_included,retake_amount_minor,bulk_cart_eligible,is_active,updated_by
  ) values(
    public.cipmn_mock_seed_uuid('CIPMN-MOD-EL02:PRICING-POLICY'),
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
  v_exam_id constant uuid := public.cipmn_mock_seed_uuid('CIPMN-MOD-EL02:EXAM');
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

  if v_mcq<>25 then raise exception 'Expected 25 active EL02 MCQs, found %.',v_mcq; end if;
  if v_theory<>5 then raise exception 'Expected 5 active EL02 Theory questions, found %.',v_theory; end if;
  if v_keys<>25 then raise exception 'Expected 25 EL02 answer keys, found %.',v_keys; end if;
  if v_options<>100 then raise exception 'Expected 100 EL02 MCQ options, found %.',v_options; end if;
  if v_rubrics<>5 then raise exception 'Expected 5 EL02 Theory rubrics, found %.',v_rubrics; end if;
  if v_bad_options<>0 then raise exception 'Found % EL02 MCQ(s) with invalid/repeated options.',v_bad_options; end if;
  if v_bad_rubrics<>0 then raise exception 'Found % invalid EL02 Theory rubric(s).',v_bad_rubrics; end if;
  if v_duplicate_texts<>0 then raise exception 'Found % repeated active EL02 question text(s).',v_duplicate_texts; end if;
  if v_policy<>1 then raise exception 'EL02 proctoring policy invariant failed.'; end if;
  if v_pricing<>1 then raise exception 'EL02 pricing policy invariant failed.'; end if;
end
$verify$;

update public.examinations
set exam_format='cipmn_mixed',
    status='published',
    updated_at=now()
where id=public.cipmn_mock_seed_uuid('CIPMN-MOD-EL02:EXAM');

do $publish_verify$
declare
  v_exam_id constant uuid := public.cipmn_mock_seed_uuid('CIPMN-MOD-EL02:EXAM');
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
    raise exception 'Expected publish trigger to create 2 active EL02 prices, found %.',v_prices;
  end if;
  if v_published<>1 then
    raise exception 'EL02 publish invariant failed.';
  end if;
end
$publish_verify$;

commit;

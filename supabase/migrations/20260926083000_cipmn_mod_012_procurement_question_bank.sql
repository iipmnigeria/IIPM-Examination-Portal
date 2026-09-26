begin;

-- CIPMN-MOD-012 assessment conversion and source-strict bank refresh.
-- Sole official assessment source:
-- CIPMN_MOD012_Project_Procurement_and_Contract_Management.pdf
-- (38 pages; reviewed 2026-09-26).
-- Historical attempts, submitted answers, assignments and retired questions are preserved.

do $guard$
declare
  v_exam_id constant uuid := '5c49847b-3944-5034-b620-0a3c5a1c7523';
  v_live integer;
  v_format text;
  v_active integer;
  v_marker uuid := public.cipmn_mock_seed_uuid('CIPMN-MOD-012:PROC-PDF-V1:MCQ:1');
begin
  select exam_format into v_format
  from public.examinations
  where id=v_exam_id
  for update;

  if not found then raise exception 'CIPMN-MOD-012 examination not found.'; end if;

  if v_format not in ('standard','cipmn_mixed') then
    raise exception 'Unexpected CIPMN-MOD-012 exam format: %',v_format;
  end if;

  if exists(select 1 from public.questions where id=v_marker and is_active) then
    raise exception 'CIPMN-MOD-012 procurement bank is already active; refresh aborted.';
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
    raise exception 'CIPMN-MOD-012 has % genuinely live examination session(s); conversion aborted.',v_live;
  end if;

  select count(*) into v_active
  from public.questions
  where examination_id=v_exam_id and is_active;

  if v_format='standard' and v_active<>75 then
    raise exception 'Expected 75 active legacy Module 12 questions, found %.',v_active;
  end if;
end
$guard$;

update public.questions
set is_active=false,
    position=position+25000,
    updated_at=now()
where examination_id='5c49847b-3944-5034-b620-0a3c5a1c7523'
  and is_active=true;

do $mcq_insert$
declare
  v_exam_id constant uuid := '5c49847b-3944-5034-b620-0a3c5a1c7523';
  v_mcqs jsonb := $mcq$
[
  {
    "position": 1,
    "question": "Which statement best defines project procurement management in Module 12?",
    "options": [
      "Planning, sourcing and controlling external goods, works and services needed for project work.",
      "Managing only supplier invoices after contract award.",
      "Selecting the lowest-priced bidder regardless of risk.",
      "Preparing internal resources before procurement starts."
    ],
    "correct": 1
  },
  {
    "position": 2,
    "question": "Which statement best describes when contract management begins and ends according to the source?",
    "options": [
      "It begins once contractual obligations are agreed and continues through performance, acceptance, closeout and lessons learned.",
      "It begins only when a supplier breaches the contract.",
      "It ends immediately after the contract is signed.",
      "It begins at market analysis and ends at bid opening."
    ],
    "correct": 1
  },
  {
    "position": 3,
    "question": "Which sequence reflects the source's procurement-to-contract flow from need through performance?",
    "options": [
      "Supplier → Need → Budget → Contract → Specification → Performance.",
      "Specification → Performance → Market → Budget → Supplier → Contract.",
      "Need → Specification → Budget → Commitment → Market → Supplier → Contract → Performance.",
      "Budget → Contract → Market → Supplier → Need → Performance."
    ],
    "correct": 3
  },
  {
    "position": 4,
    "question": "In the rural-road case, which failure best illustrates why value for money must not be reduced to lowest price?",
    "options": [
      "The contractor was paid only after accepted work.",
      "The contractor lacked adequate equipment and capacity while material prices and availability risks were underestimated.",
      "The Ministry used too much market analysis before award.",
      "The project used a contract with excessive quality controls."
    ],
    "correct": 2
  },
  {
    "position": 5,
    "question": "How does Module 12 define Value for Money?",
    "options": [
      "The lowest tendered price that meets the deadline.",
      "The best combination of fitness for purpose, quality, whole-life cost, delivery capability, risk profile, contract protection and compliance.",
      "The highest technical score regardless of affordability.",
      "The fastest supplier that can mobilize immediately."
    ],
    "correct": 2
  },
  {
    "position": 6,
    "question": "Which statement correctly describes the Public Procurement Act 2007 in the module?",
    "options": [
      "It applies only to contract closeout and disputes.",
      "It replaces the need for internal approvals and records.",
      "It requires direct procurement as the default method.",
      "It is Nigeria's primary legal framework for public procurement and promotes transparency, accountability, competition and value for money."
    ],
    "correct": 4
  },
  {
    "position": 7,
    "question": "What is the role of the Bureau of Public Procurement (BPP) as presented in Module 12?",
    "options": [
      "To replace the Accounting Officer in all approvals.",
      "To act as the supplier evaluation committee.",
      "To execute every procurement on behalf of project teams.",
      "To monitor and oversee public procurement, issue guidance, certify applicable procurements and support standards/compliance."
    ],
    "correct": 4
  },
  {
    "position": 8,
    "question": "What does a Certificate of No Objection (CNO) signify in the module?",
    "options": [
      "That the lowest bidder must be selected.",
      "That a supplier cannot submit a claim.",
      "That compliance has been confirmed before certain public procurement awards.",
      "That the contract has reached final acceptance."
    ],
    "correct": 3
  },
  {
    "position": 9,
    "question": "Which group contains only procurement-planning activities taught in Module 12?",
    "options": [
      "Needs assessment, market analysis, risk review, procurement-method selection, evaluation criteria and approval path.",
      "Claims settlement, arbitration, litigation and closeout.",
      "Vendor onboarding, liquidation and payroll control.",
      "Lessons learned, retention release and final acceptance only."
    ],
    "correct": 1
  },
  {
    "position": 10,
    "question": "Which market-analysis question is explicitly emphasized before sourcing specialized equipment?",
    "options": [
      "Which bidder has the largest social-media following?",
      "Which supplier can waive all warranties?",
      "Can the evaluation committee avoid checking import exposure?",
      "Can the local market provide maintenance, training, spare parts and support after purchase?"
    ],
    "correct": 4
  },
  {
    "position": 11,
    "question": "Which procurement method is identified as the default route for transparency and broad competition?",
    "options": [
      "Open Competitive Bidding.",
      "Emergency Procurement.",
      "Restricted Tendering.",
      "Direct Procurement."
    ],
    "correct": 1
  },
  {
    "position": 12,
    "question": "Which situation best fits Restricted Tendering under the source's procurement-method logic?",
    "options": [
      "An urgent emergency requiring immediate response.",
      "Low-value office stationery available from many suppliers.",
      "A market where only a limited number of capable suppliers exist.",
      "A complex requirement that needs specification refinement."
    ],
    "correct": 3
  },
  {
    "position": 13,
    "question": "When is Two-Stage Tendering most appropriate according to Module 12?",
    "options": [
      "For simple, low-value readily available items.",
      "For complex requirements where specifications need refinement.",
      "Only when a single supplier exists.",
      "Only after a contract dispute."
    ],
    "correct": 2
  },
  {
    "position": 14,
    "question": "Which principle governs the use of Direct or Emergency Procurement in the module?",
    "options": [
      "They are exceptional routes that still require justification, documentation, approvals and audit trail.",
      "They remove the need for competition and value-for-money review.",
      "They automatically eliminate procurement risk.",
      "They are shortcuts that require less documentation."
    ],
    "correct": 1
  },
  {
    "position": 15,
    "question": "Which bid-evaluation practice is required by the source to protect fairness?",
    "options": [
      "Award primarily on relationship history.",
      "Ignore technical capacity if the financial proposal is low.",
      "Define criteria before bids are opened, apply them consistently and document the evaluation.",
      "Adjust criteria after seeing supplier prices."
    ],
    "correct": 3
  },
  {
    "position": 16,
    "question": "Which contract type is most suitable when scope is clearly defined and the buyer wants a fixed price?",
    "options": [
      "Framework Agreement.",
      "Lump Sum.",
      "Time & Materials.",
      "Cost Reimbursable."
    ],
    "correct": 2
  },
  {
    "position": 17,
    "question": "Which contract type is appropriate when payment depends on measured quantities that may vary?",
    "options": [
      "Unit Rate.",
      "Lump Sum.",
      "Cost Reimbursable.",
      "PPP / Concession."
    ],
    "correct": 1
  },
  {
    "position": 18,
    "question": "Why does the source warn that a lump-sum contract can create claims or poor-quality delivery when scope is unclear?",
    "options": [
      "Because lump-sum contracts prohibit performance monitoring.",
      "Because lump-sum contracts always transfer all risk to the buyer.",
      "Because lump-sum contracts cannot include quality requirements.",
      "Because fixed pricing depends on sufficiently clear specifications and risk allocation."
    ],
    "correct": 4
  },
  {
    "position": 19,
    "question": "Which document-control principle is emphasized during tender formation and contract signing?",
    "options": [
      "Bidder clarifications should be discarded after award.",
      "Approved addenda should remain outside the contract file.",
      "Tender instructions, clarifications, accepted proposal, award letter, terms, specifications and approved addenda incorporated into the contract should be controlled.",
      "Only the signed contract page needs to be retained."
    ],
    "correct": 3
  },
  {
    "position": 20,
    "question": "Which set best reflects the supplier-management lifecycle taught in Module 12?",
    "options": [
      "Qualify → Sign → Ignore until completion.",
      "Select → Onboard → Monitor → Resolve → Close.",
      "Advertise → Litigate → Close.",
      "Award → Pay → Disband."
    ],
    "correct": 2
  },
  {
    "position": 21,
    "question": "Which payment-control rule is explicitly taught in the source?",
    "options": [
      "Pay only for accepted work, valid invoices and milestones supported by certification.",
      "Pay mobilization and milestone claims before checking documentation.",
      "Release payment whenever the contractor reports progress verbally.",
      "Ignore retention and guarantee conditions if the project is delayed."
    ],
    "correct": 1
  },
  {
    "position": 22,
    "question": "Which sequence correctly represents variation control in Module 12?",
    "options": [
      "Approve first → assess impact later → update only if disputed.",
      "Implement verbally → document after completion.",
      "Reject every change after award.",
      "Document request → assess scope/cost/time/quality impact → approve or reject → update contract and baseline."
    ],
    "correct": 4
  },
  {
    "position": 23,
    "question": "Which item is central to claims management according to the source?",
    "options": [
      "Treating every delay as force majeure.",
      "Escalating directly to litigation without evidence review.",
      "Checking contractual entitlement, evidence, notice timing, cause, responsibility and mitigation action.",
      "Accepting all claims if the supplier submits an invoice."
    ],
    "correct": 3
  },
  {
    "position": 24,
    "question": "Which dispute-resolution sequence moves from collaborative resolution toward the most formal option in the source?",
    "options": [
      "Mediation → Procurement Planning → Court Award.",
      "Negotiation / Mediation or Conciliation → Arbitration → Litigation.",
      "Litigation → Negotiation → Mediation.",
      "Arbitration → Tender Evaluation → Litigation."
    ],
    "correct": 2
  },
  {
    "position": 25,
    "question": "Which practice is explicitly identified as unethical and prohibited in procurement control?",
    "options": [
      "Splitting contracts into smaller packages to avoid thresholds or approvals.",
      "Declaring conflicts of interest before evaluation.",
      "Keeping scoring sheets and approval records.",
      "Giving suppliers equal information and time."
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
    v_qid := public.cipmn_mock_seed_uuid('CIPMN-MOD-012:PROC-PDF-V1:MCQ:' || (v_item->>'position'));

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
      raise exception 'No correct option resolved for Module 12 MCQ position %.',v_item->>'position';
    end if;

    insert into public.question_answer_keys(question_id,correct_option_id)
    values(v_qid,v_correct_id);
  end loop;
end
$mcq_insert$;

do $theory_insert$
declare
  v_exam_id constant uuid := '5c49847b-3944-5034-b620-0a3c5a1c7523';
  v_theory jsonb := $theory$
[
  {
    "position":26,
    "question":"Using only Module 12: (a) define procurement, project procurement and contract management; (b) explain the source's Right Requirement, Right Supplier, Right Contract and Right Control model; (c) explain why procurement and contracts matter in the Nigerian project environment; (d) explain the procurement-to-contract flow; and (e) explain Value for Money using the rural-road case.",
    "criteria":[
      {"name":"Definitions","marks":2,"expected":"Defines procurement, project procurement and contract management using the source's planning/sourcing/control and obligations/performance/payment/change/claims/closure framing."},
      {"name":"Four-right model","marks":2,"expected":"Explains Right Requirement, Right Supplier, Right Contract and Right Control with source-supported decisions and controls."},
      {"name":"Nigerian realities","marks":2,"expected":"Explains exchange-rate/inflation, logistics/ports/roads/power/insecurity/site conditions, transparency/accountability, political pressure and weak administration risks."},
      {"name":"Lifecycle flow","marks":2,"expected":"Explains Need → Specification → Budget → Commitment → Market → Supplier → Contract → Performance and that procurement continues beyond award."},
      {"name":"VfM/rural-road application","marks":2,"expected":"Explains fitness, quality, whole-life cost, capability, risk, contract protection and compliance, and applies them to the road project's rushed planning/weak due diligence/lowest-bid bias."}
    ]
  },
  {
    "position":27,
    "question":"Using only Module 12: (a) explain the role of PPA 2007, BPP, CNO and the Accounting Officer; (b) explain procurement planning and its checklist; (c) explain market analysis and sourcing strategy; (d) compare Open Competitive Bidding, Restricted Tendering, Two-Stage Tendering, RFQ/Shopping, Direct Procurement and Emergency Procurement; and (e) explain why procurement exceptions require stronger documentation and approvals.",
    "criteria":[
      {"name":"PPA/BPP/CNO/Accounting Officer","marks":2,"expected":"Accurately explains PPA 2007, BPP oversight/guidance, CNO compliance confirmation before certain awards, and Accounting Officer accountability for compliance, planning, approvals and records."},
      {"name":"Planning/checklist","marks":2,"expected":"Explains needs, budget/funding, market review, risks, evaluation criteria/documents and approval/regulatory path."},
      {"name":"Market analysis","marks":2,"expected":"Explains supplier capability, price trends, local content, competition, import exposure and support/maintenance capacity."},
      {"name":"Methods comparison","marks":2,"expected":"Accurately compares Open Competitive, Restricted, Two-Stage, RFQ/Shopping, Direct and Emergency Procurement using the source's best-use logic."},
      {"name":"Exception control","marks":2,"expected":"Explains that exceptional methods are not shortcuts and require clear justification, documentation, approvals and audit trail."}
    ]
  },
  {
    "position":28,
    "question":"Using only Module 12: (a) explain bid responsiveness, technical capacity, financial proposal, risk profile, local content and evidence/due diligence; (b) explain why evaluation criteria must be set before bid opening; (c) compare Lump Sum, Unit Rate, Time & Materials, Cost Reimbursable, Framework Agreement and PPP/Concession; (d) explain how contract type allocates risk; and (e) explain the tender-document-to-contract-formation sequence and document-control rule.",
    "criteria":[
      {"name":"Bid evaluation factors","marks":2,"expected":"Explains responsiveness, technical capacity, financial proposal/whole-life cost, risk profile, local content and evidence/past performance/due diligence."},
      {"name":"Evaluation discipline","marks":2,"expected":"Explains upfront criteria, consistency and clear documentation to protect fairness and auditability."},
      {"name":"Contract types","marks":2,"expected":"Correctly compares Lump Sum, Unit Rate, Time & Materials, Cost Reimbursable, Framework Agreement and PPP/Concession."},
      {"name":"Risk allocation","marks":2,"expected":"Explains how contract type determines who bears scope/cost/quantity/operational risks and why unclear scope can undermine fixed-price delivery."},
      {"name":"Formation/document control","marks":2,"expected":"Explains Prepare → Invite → Evaluate → Approve → Sign and control of tender instructions, clarifications, accepted proposal, award letter, terms, specifications and approved addenda."}
    ]
  },
  {
    "position":29,
    "question":"Using only Module 12: (a) explain the vendor/supplier management lifecycle; (b) explain schedule, quality, cost, compliance, responsiveness and risk performance indicators; (c) explain the six contract-administration controls; (d) explain core clauses including scope, acceptance, payment, performance guarantee, liquidated damages, force majeure, dispute resolution and governing law; and (e) explain how disciplined supplier monitoring protects project value after award.",
    "criteria":[
      {"name":"Supplier lifecycle","marks":2,"expected":"Explains Select, Onboard, Monitor, Resolve and Close, with continuous communication and early treatment of deviations."},
      {"name":"Performance monitoring","marks":2,"expected":"Explains schedule/milestones, quality/defects, cost/invoice/variation impact, compliance, responsiveness and supplier/logistics/market risk."},
      {"name":"Administration controls","marks":2,"expected":"Explains kickoff, record keeping, performance tracking, payment administration, formal change control and closure."},
      {"name":"Core clauses","marks":2,"expected":"Explains scope/specifications, delivery/acceptance, payment terms, performance guarantee, liquidated damages, force majeure, dispute resolution and governing law."},
      {"name":"Post-award value protection","marks":2,"expected":"Explains that award/signature do not equal success and that monitoring, records, enforcement and collaboration convert contract rights into controlled performance."}
    ]
  },
  {
    "position":30,
    "question":"Using only Module 12: (a) explain variation control, claims management and payment discipline; (b) explain payment certification, retention/guarantees and audit readiness; (c) compare negotiation, mediation, conciliation, arbitration and litigation and explain escalation paths; (d) explain ethics, transparency and anti-corruption controls; and (e) explain how procurement tools, templates, digital systems and lessons learned support defensible contract management.",
    "criteria":[
      {"name":"Variations/claims/payments","marks":2,"expected":"Explains documented variation request, impact assessment, approval/rejection, contract/baseline update; claims entitlement/evidence/notices/cause/responsibility/mitigation; payment only for accepted certified work."},
      {"name":"Certification/audit readiness","marks":2,"expected":"Explains invoice/tax/milestone/measurement checks, engineer/supervisor/PM certification, retention/advance recovery/guarantee conditions, records/photos/tests and explainable payments."},
      {"name":"Disputes/escalation","marks":2,"expected":"Compares negotiation, mediation, conciliation, arbitration and litigation and explains defined escalation levels, evidence and decision timing."},
      {"name":"Ethics/anti-corruption","marks":2,"expected":"Explains conflict declaration, fair competition, no splitting, audit trails, no kickbacks and transparent reporting."},
      {"name":"Tools/digital/learning","marks":2,"expected":"Explains procurement plans, market surveys, risk matrices, tender/RFQ/RFP templates, scoring/due diligence tools, issue/variation/payment/SLA controls, e-procurement/ERP/spend/supplier dashboards, supplier scorecards and lessons learned."}
    ]
  }
]
$theory$::jsonb;
  v_item jsonb;
  v_qid uuid;
begin
  for v_item in select value from jsonb_array_elements(v_theory)
  loop
    v_qid := public.cipmn_mock_seed_uuid('CIPMN-MOD-012:PROC-PDF-V1:THEORY:' || ((v_item->>'position')::integer-25));

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
      'CIPMN_MOD012_Project_Procurement_and_Contract_Management.pdf (38 pages; reviewed 2026-09-26)',true
    );
  end loop;
end
$theory_insert$;

do $verify$
declare
  v_exam_id constant uuid := '5c49847b-3944-5034-b620-0a3c5a1c7523';
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

  if v_mcq<>25 then raise exception 'Expected 25 active Module 12 MCQs, found %.',v_mcq; end if;
  if v_theory<>5 then raise exception 'Expected 5 active Module 12 Theory questions, found %.',v_theory; end if;
  if v_keys<>25 then raise exception 'Expected 25 Module 12 answer keys, found %.',v_keys; end if;
  if v_options<>100 then raise exception 'Expected 100 active Module 12 MCQ options, found %.',v_options; end if;
  if v_rubrics<>5 then raise exception 'Expected 5 active Module 12 Theory rubrics, found %.',v_rubrics; end if;
  if v_bad_options<>0 then raise exception 'Found % Module 12 MCQ(s) with invalid/repeated options.',v_bad_options; end if;
  if v_bad_rubrics<>0 then raise exception 'Found % invalid Module 12 Theory rubric(s).',v_bad_rubrics; end if;
  if v_duplicate_texts<>0 then raise exception 'Found % repeated active Module 12 question text(s).',v_duplicate_texts; end if;
end
$verify$;

update public.examinations
set exam_format='cipmn_mixed',
    updated_at=now()
where id='5c49847b-3944-5034-b620-0a3c5a1c7523';

commit;

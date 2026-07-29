begin;

-- Replace the former CIPMN Module 012 international programmes and portfolios
-- question bank with 75 procurement and contract management questions aligned
-- to the approved CIPMN MOD-012 learning material. The deterministic
-- examination identifier, payment controls, orders, assignments and attempts
-- remain unchanged.

update public.examinations
set title = 'CIPMN-MOD-012 - Project Procurement and Contract Management Mock Examination',
    instructions = 'Answer all 75 questions. Select the most appropriate response for each procurement or contract-management case. The assessment covers procurement planning, PPA 2007 and BPP compliance, sourcing, tendering, value for money, contract types, supplier performance, payments, variations, claims, disputes, ethics and closeout. Payment, an applicable coupon or an administrator assignment is required before launch.',
    duration_minutes = 120,
    pass_mark = 70,
    status = 'published',
    max_attempts = 1,
    randomize_questions = true,
    randomize_options = true,
    allow_self_enrollment = false,
    requires_payment = true,
    updated_at = now()
where id = '5c49847b-3944-5034-b620-0a3c5a1c7523'::uuid
  and programme_id = (
    select id
    from public.programmes
    where code = 'CIPMN-MOCK'
      and is_active = true
    limit 1
  );

select public.seed_cipmn_mock_module(
  'CIPMN-MOD-012',
  $cards$[["Needs assessment and specification","A ministry procurement plans solar boreholes but has no confirmed locations, output standards, quantities, maintenance needs or acceptance tests.","Validate the need with users and specialists, then issue measurable specifications, quantities, acceptance criteria and budget assumptions.","Ask bidders to define the need after bid opening.","Reuse an old specification without validation.","Proceed broadly and clarify everything through variations.","Clear requirements make bids comparable and reduce disputes, variations and acceptance failure."],["Market analysis and sourcing","A hospital compares imaging equipment only by purchase price and ignores local support, spare parts, import risk and supplier depth.","Assess capable suppliers, whole-life cost, support, lead time, exchange-rate exposure, warranty, spare parts and competition before sourcing.","Buy the cheapest catalogue model and plan support later.","Single-source immediately because the equipment is specialised.","Estimate support cost from purchase price alone.","Market analysis reveals capability, pricing, logistics, competition and support risks before method selection."],["Procurement planning and approvals","A tender is ready, but the purchase is outside the approved plan, funding is unconfirmed and the approval path is unknown.","Confirm the approved plan, budget, funding, risks, timetable, evaluation basis and required approvals before advertising.","Advertise because tendering creates no commitment.","Let bidders finance the funding gap.","Split the requirement to avoid approvals.","Procurement planning connects need, timing, market approach, budget, risk and authority."],["PPA 2007, BPP and CNO","A federal entity wants to sign a high-value contract before obtaining an applicable Certificate of No Objection.","Complete evaluation and approvals and obtain the required BPP Certificate of No Objection before award and signature.","Sign first because the certificate is only administrative.","Replace BPP review with a bidder assurance letter.","Backdate the approval after signature.","Public procurement compliance must be transparent, approved and documented before award, not reconstructed afterward."],["Procurement method selection","An agency procurement covers common office supplies and a complex national platform whose final technical solution is not yet clear.","Use a proportionate competitive method for standard items and consider two-stage tendering to refine the complex platform requirement.","Use direct procurement for both to save time.","Use two-stage tendering for supplies and RFQ for the platform.","Declare both procurements emergencies.","Method selection should reflect value, complexity, urgency, competition and specification maturity."],["Tender documents and clarifications","One road bidder privately requests a clarification that could materially affect every bidder's price.","Issue the clarification equally through the controlled process, document any addendum and incorporate final tender documents into the contract.","Reply only to the bidder who asked.","Explain it only to evaluators after opening.","Change the requirement privately with the preferred bidder.","Material information must be shared equally and preserved in the procurement and contract audit trail."],["Bid evaluation and value for money","The lowest bridge bid omits mandatory work and shows weak equipment, poor performance and unrealistic delivery assumptions.","Apply pre-disclosed responsiveness, technical, financial, risk and due-diligence criteria and select defensible value for money.","Award automatically to the lowest price.","Ignore past performance and capability.","Add omitted requirements privately after evaluation.","Value for money balances fitness, quality, whole-life cost, capability, risk, compliance and delivery confidence."],["Supplier due diligence","A bidder submits impressive profiles, but workload, equipment, finance, compliance, references and personnel availability are unverified.","Verify current commitments, equipment, finance, compliance, references, personnel and past performance before award.","Accept the marketing profile as sufficient.","Check only company registration.","Conduct due diligence after contract signature.","Due diligence tests whether the supplier can actually perform the proposed contract."],["Contract type and risk allocation","Excavation quantities are uncertain, yet the buyer proposes a rigid lump-sum contract based on preliminary estimates.","Use a pricing and risk structure suited to uncertainty, such as measured unit rates with clear measurement and unforeseen-condition rules.","Keep lump sum and reject every quantity adjustment.","Use cost reimbursement without ceilings or audit rights.","Leave payment terms undecided until work starts.","Contract type allocates cost, quantity, performance and schedule risks and must match scope certainty."],["Core contract clauses","A supply agreement states price and date but omits specifications, acceptance tests, payment milestones, security, delay remedies, changes and disputes.","Add clear scope, acceptance, payment, guarantees, delay remedies, change and claim procedures, disputes, governing law and closeout terms.","Sign because invoices will fill the gaps.","Rely on verbal understandings.","Add only a termination clause.","Complete clauses convert procurement decisions into enforceable obligations and remedies."],["Performance monitoring and administration","A contractor is slipping, defects are rising and equipment has reduced, but the team monitors only expenditure.","Measure schedule, quality, cost, compliance, capacity and risk against the contract, require corrective action and monitor recovery.","Continue paying because expenditure shows progress.","Wait until completion before intervening.","Use informal calls instead of records.","Contract administration requires timely, documented monitoring and corrective action after award."],["Payment certification and guarantees","A contractor invoices 70 percent, measured work is 50 percent, tests are missing and the advance guarantee is expiring.","Certify only measured and accepted work after verifying tests, invoice, taxes, retention, advance recovery and guarantee validity.","Pay fully to support cash flow.","Accept the contractor's own progress report.","Release retention and guarantees early.","Payment must follow evidence, acceptance, measurements, guarantees and contractual entitlement."],["Variations and claims","A representative verbally orders extra drainage and the contractor later claims cost and time without formal approval.","Document the instruction, assess entitlement and scope, time, cost, quality and risk impacts, obtain approval and formalise any variation.","Approve because the work has started.","Reject every variation automatically.","Hide the work within existing quantities.","Variations and claims require notice, evidence, impact analysis, authority and contract amendment."],["Dispute resolution","A supplier challenges liquidated damages, records are weak and the contract requires negotiation, mediation and arbitration before litigation.","Organise evidence, follow notices and escalation, negotiate promptly and use the agreed mediation or arbitration process.","Ignore the matter until court action.","Terminate immediately without checking the contract.","Delete informal correspondence.","Good records and the agreed escalation path help resolve disputes early and fairly."],["Ethics, audit trail and closeout","An evaluator has a family interest, management suggests contract splitting, and the completed file lacks scoring and acceptance records.","Require disclosure and recusal, prohibit splitting, preserve records, complete acceptance and final-account checks, archive documents and lessons.","Keep the evaluator because of expertise.","Split the procurement as directed.","Close after payment without acceptance evidence.","Integrity and closeout controls protect competition, accountability, final acceptance, securities and organisational learning."]]$cards$::jsonb
);

do $verify$
declare
  v_programme_id uuid;
  v_exam_id uuid := '5c49847b-3944-5034-b620-0a3c5a1c7523'::uuid;
  v_active_questions integer;
  v_active_options integer;
  v_answer_keys integer;
  v_procurement_scenarios integer;
begin
  select id into v_programme_id
  from public.programmes
  where code = 'CIPMN-MOCK'
    and is_active = true
  limit 1;

  if v_programme_id is null then
    raise exception 'The active CIPMN-MOCK programme was not found.';
  end if;

  if not exists (
    select 1
    from public.examinations e
    where e.id = v_exam_id
      and e.programme_id = v_programme_id
      and e.title = 'CIPMN-MOD-012 - Project Procurement and Contract Management Mock Examination'
      and e.status = 'published'
      and e.duration_minutes = 120
      and e.pass_mark = 70
      and e.max_attempts = 1
      and e.requires_payment = true
      and e.allow_self_enrollment = false
      and e.randomize_questions = true
      and e.randomize_options = true
  ) then
    raise exception 'CIPMN Module 012 configuration or payment protection is invalid.';
  end if;

  select count(*) into v_active_questions
  from public.questions
  where examination_id = v_exam_id
    and is_active = true;

  select count(*) into v_active_options
  from public.question_options qo
  join public.questions q on q.id = qo.question_id
  where q.examination_id = v_exam_id
    and q.is_active = true;

  select count(*) into v_answer_keys
  from public.question_answer_keys k
  join public.questions q on q.id = k.question_id
  join public.question_options qo
    on qo.id = k.correct_option_id
   and qo.question_id = q.id
  where q.examination_id = v_exam_id
    and q.is_active = true;

  select count(*) into v_procurement_scenarios
  from public.questions q
  where q.examination_id = v_exam_id
    and q.is_active = true
    and q.question_text ~* '(procure|contract|tender|supplier|bid|payment|variation|claim|dispute|award|market|equipment|invoice|guarantee|evaluation|specification)';

  if v_active_questions <> 75 then
    raise exception 'Expected 75 active Module 012 questions, found %.', v_active_questions;
  end if;

  if v_active_options <> 300 then
    raise exception 'Expected 300 active Module 012 options, found %.', v_active_options;
  end if;

  if v_answer_keys <> 75 then
    raise exception 'Expected 75 protected Module 012 answer keys, found %.', v_answer_keys;
  end if;

  if v_procurement_scenarios <> 75 then
    raise exception 'Expected all 75 active questions to contain procurement or contract-management scenario markers, found %.', v_procurement_scenarios;
  end if;

  if exists (
    select 1
    from public.questions q
    where q.examination_id = v_exam_id
      and q.is_active = true
    group by q.question_text
    having count(*) > 1
  ) then
    raise exception 'Duplicate active Module 012 question text was detected.';
  end if;
end;
$verify$;

commit;

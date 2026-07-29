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
  '[["Procurement needs assessment and specification","A ministry wants to procure solar-powered boreholes, but the user department has described the need only as 'provide water systems' without locations, output requirements, maintenance expectations or acceptance criteria.","Pause the tender, validate the need with users and technical specialists, and prepare measurable specifications, quantities, acceptance criteria and budget assumptions before going to market.","Invite suppliers to define the requirement after bids are opened so the ministry can choose whichever proposal appears most attractive.","Use the previous year's specification without confirming whether locations, demand, technology or operating conditions have changed.","Proceed with a broad description and rely on contract variations to clarify the requirement during implementation.","Sound procurement starts with a validated need and clear, measurable requirements. Weak specifications create incomparable bids, scope disputes, uncontrolled variations and poor acceptance decisions."],["Market analysis and sourcing strategy","A teaching hospital plans to buy specialised imaging equipment based only on catalogue price, without checking local maintenance capacity, spare-parts availability, import exposure or the number of qualified suppliers.","Conduct market analysis covering capable suppliers, whole-life cost, local support, import and exchange-rate exposure, competition, lead time, warranty and spare-parts availability before selecting the sourcing approach.","Choose the cheapest catalogue model and leave maintenance arrangements for the contract-management stage.","Restrict the tender immediately to one familiar supplier because specialised equipment always justifies single sourcing.","Estimate future support costs from the purchase price alone and exclude supplier interviews or independent market evidence.","Market analysis makes supplier capability, pricing trends, competition, logistics and support risks visible before the procurement method and evaluation model are fixed."],["Procurement planning, budget and approvals","A project team has completed a tender package, but the procurement is absent from the approved procurement plan, funding availability has not been confirmed and the regulatory approval path is unclear.","Do not release the tender until the need is included in the approved plan, budget and funding are confirmed, risks and timelines are documented, and the required internal and regulatory approvals are identified.","Publish immediately because tendering does not create any financial or legal commitment.","Ask bidders to finance the procurement gap and recover it through higher prices after award.","Split the requirement into smaller procurements so that planning and approval requirements no longer apply.","A defensible procurement plan links need, timing, market approach, budget, risk, evaluation criteria and approvals. Tendering without these foundations exposes the project to cancellation, delay and non-compliance."],["PPA 2007, BPP oversight and Certificate of No Objection","A federal procuring entity is ready to award a high-value contract that requires BPP review, but management wants to sign first and obtain the Certificate of No Objection afterward to meet a public deadline.","Complete the required evaluation, approvals and BPP compliance process and obtain the applicable Certificate of No Objection before award and contract signature.","Sign the contract first because a Certificate of No Objection is only an internal filing formality.","Replace the BPP review with a letter from the preferred bidder confirming that the process was fair.","Backdate the approval documents after signature so the procurement file appears complete.","The Public Procurement Act framework requires transparent, accountable and properly approved procurement. Where applicable, the Certificate of No Objection confirms compliance before award; it should not be treated as retrospective paperwork."],["Selection of procurement method","An agency needs standard office consumables available from many suppliers, while a separate project requires a complex national data platform whose technical solution cannot yet be fully specified.","Use a proportionate competitive method such as RFQ or shopping for the low-value standard items, and consider two-stage tendering for the complex platform so technical requirements can be refined before final offers.","Use direct procurement for both requirements because different methods would increase administrative effort.","Use two-stage tendering for the office consumables and RFQ for the national platform regardless of value or complexity.","Declare both procurements emergencies because the agency wants faster delivery.","Procurement methods should match value, complexity, urgency, competition and specification maturity. Exceptions require stronger justification and documentation, not convenience."],["Tender documents, bidder communication and contract formation","During a road tender, one bidder privately asks for clarification about a material-testing requirement. The answer could materially affect pricing, but the procurement officer plans to reply only to that bidder.","Issue the clarification through the controlled tender process to all eligible bidders, preserve equal information and time, document any addendum, and incorporate the final tender documents and accepted offer into the contract.","Reply privately because the bidder took the initiative to ask first.","Wait until bid opening and then explain the requirement only to the evaluation committee.","Change the requirement during contract negotiation with the preferred bidder without informing other bidders.","Fair competition requires equal access to material information. Specifications, clarifications, addenda, accepted proposals, award terms and guarantees must form a controlled audit trail into the final agreement."],["Bid evaluation and value for money","The lowest-priced contractor for a bridge project has weak equipment capacity, poor recent performance, unrealistic delivery assumptions and a price that excludes several mandatory requirements.","Apply the pre-disclosed responsiveness, technical, financial, risk and due-diligence criteria consistently, reject materially non-responsive bids where required, and select the offer that provides defensible value for money rather than price alone.","Award to the lowest bidder because any higher award price automatically violates value-for-money principles.","Ignore past performance because only the written price schedule may be evaluated.","Negotiate privately with the lowest bidder to add omitted requirements after evaluation without revisiting fairness or responsiveness.","Value for money balances fitness for purpose, quality, whole-life cost, capability, risk, compliance and delivery confidence. Evaluation criteria must be set before opening and applied consistently."],["Supplier due diligence and capacity verification","A construction bidder submits impressive company profiles, but the evaluation team has not verified current workload, equipment ownership, financial capacity, tax and regulatory compliance, references or key personnel availability.","Complete proportionate due diligence using verifiable records, references, site or equipment checks, financial and compliance evidence, current commitments and confirmation that proposed resources are genuinely available.","Accept the marketing profile because requesting evidence may offend the bidder.","Verify only the company's registration certificate and assume all operational capacity is adequate.","Conduct due diligence only after contract signature so the procurement timetable is not delayed.","Due diligence tests whether the supplier can actually perform. It should verify experience, resources, finance, compliance, workload and past performance before award."],["Contract type and risk allocation","A project has uncertain excavation quantities because subsurface conditions are not fully known, but the buyer proposes an inflexible lump-sum contract based on preliminary estimates and intends to transfer all quantity risk to the contractor.","Use a contract structure that reflects the uncertainty, such as measured unit rates with clear measurement rules and risk provisions, while improving site information and defining how unforeseen conditions will be managed.","Use the lump-sum contract and refuse every future quantity adjustment regardless of actual conditions.","Use a cost-reimbursable contract without ceilings, audit rights or cost controls.","Leave the contract type unspecified so the parties can decide how to pay after work begins.","Contract type determines how cost, quantity, performance and schedule risks are allocated. A mismatch between scope certainty and pricing mechanism often produces claims, inflated contingencies or quality failure."],["Core contract clauses and performance protection","A supplier contract states the price and delivery date but omits detailed specifications, acceptance tests, payment milestones, performance security, delay remedies, change procedures, dispute resolution and governing law.","Complete the contract with clear scope and specifications, delivery and acceptance criteria, payment rules, guarantees, liquidated damages where appropriate, change and claim procedures, dispute escalation, governing law and closeout obligations.","Sign immediately because the purchase order and invoice will fill every contractual gap.","Rely on verbal understandings between the project manager and supplier.","Add only a termination clause because termination is the main purpose of contract management.","Contract clauses convert procurement decisions into enforceable obligations. Clear performance, payment, risk, remedy, change and dispute terms reduce ambiguity and protect both delivery and accountability."],["Supplier performance monitoring and contract administration","Six weeks after award, a contractor's milestone reports show slippage, rising defects and reduced equipment on site, but the project team reviews only total expenditure and has not held a formal performance meeting.","Use the contract baseline and agreed KPIs to review schedule, quality, cost, compliance, capacity and risks; document the variance, require a corrective plan, escalate under the contract and monitor recovery.","Continue paying because expenditure progress demonstrates satisfactory performance.","Wait until the completion date before addressing slippage so the contractor has maximum flexibility.","Replace formal records with informal telephone reminders to preserve the relationship.","Contract administration begins after award. Performance should be measured against deliverables, milestones, quality, compliance and risk indicators, with timely documented corrective action."],["Payment certification, retention and guarantees","A contractor submits an invoice for 70 percent of a building contract, but measured work is 50 percent complete, material tests are missing and the advance-payment guarantee is close to expiry.","Verify measured and accepted work, inspection and test evidence, invoice accuracy, tax and contract references; apply advance recovery and retention, confirm guarantee validity, and certify only the amount properly due.","Pay the full invoice to protect the contractor's cash flow and verify the work later.","Certify 70 percent because the contractor's progress report is signed by its own site manager.","Release retention and guarantees early so the supplier can finance remaining work.","Payment should not move faster than evidence. Certification links money to accepted work, valid documentation, measurements, guarantees, retention and contractual entitlement."],["Variations and claims management","A client representative verbally instructs additional drainage works. The contractor starts immediately and later submits a large claim for cost and time, but no formal variation, impact analysis or approval exists.","Record the instruction, stop unauthorised expansion where practicable, assess necessity and contractual entitlement, quantify scope, cost, time, quality and risk impacts, obtain the required approval, and formalise any accepted variation before baseline updates.","Approve the claim because the work has already started and therefore cannot be questioned.","Reject every variation automatically because contracts should never change.","Hide the additional work within existing quantities so no approval is needed.","Variations require documented request, impact assessment, authority and contract amendment. Claims should be tested against notice, cause, evidence, responsibility, mitigation and contractual entitlement."],["Dispute prevention, escalation and resolution","A supplier disputes liquidated damages for late delivery and threatens court action. Project records are incomplete, the contract requires negotiation followed by mediation and arbitration, and operational teams have begun exchanging accusatory emails.","Preserve and organise the evidence, separate facts from blame, follow the contractual notice and escalation path, attempt timely negotiation, and proceed to mediation or arbitration as required before litigation unless urgent legal protection is necessary.","Ignore the dispute until the supplier files in court.","Terminate the contract immediately without checking notice, cure or dispute provisions.","Delete informal correspondence so it cannot be used against the project.","Early communication, reliable records and adherence to the agreed escalation process reduce disruption. Negotiation, mediation, conciliation and arbitration can resolve disputes before litigation."],["Ethics, transparency, audit trail and closeout","An evaluation committee member has a family interest in one bidder, management suggests splitting the award to avoid an approval threshold, and the completed contract file lacks scoring sheets, acceptance records and lessons learned.","Require conflict disclosure and recusal, prohibit artificial contract splitting, preserve the full evaluation and approval trail, complete acceptance and final-account checks, release securities only when conditions are met, archive records and capture lessons.","Allow the member to remain because technical expertise is more important than perceived bias.","Split the procurement as directed because each smaller contract can be evaluated independently.","Close the file after final payment without acceptance evidence, guarantee review or archived records.","Integrity controls protect fair competition and public trust. Proper closeout confirms acceptance, final payment, claims status, retention and guarantee release, record archiving, supplier performance and lessons learned."]]'::jsonb
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

  if v_procurement_scenarios < 70 then
    raise exception 'Only % active questions contain procurement or contract-management scenario markers.', v_procurement_scenarios;
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

# Finance Operations and Governance Enhancement

## Purpose

This phase adds controlled operational governance above the completed Finance Console without replacing its existing payment, Paystack verification, order, fulfilment, receipt, recovery or certificate authorities.

The new **Operations & Governance** workspace provides:

- maker–checker finance operations cases;
- immutable review, approval and execution evidence;
- operational exception alerts;
- scheduled management-report definitions and delivery queueing;
- finance oversight scorecards and case timelines.

## Finance operations cases

Supported case types are:

- payment reconciliation;
- manual payment approval;
- paid-access recovery;
- refund review;
- payment reversal;
- finance adjustment;
- other finance exceptions.

Every case records its requester, description, priority, service deadline, linked order/reference, approval requirement, assignment, status, evidence timeline and outcome.

### Maker–checker controls

- the requester cannot approve or record execution of the same case;
- manual-payment, refund, reversal and adjustment cases require two independent approvals;
- one reviewer cannot approve the same case twice;
- approval does not itself modify a payment, order, entitlement or certificate;
- execution records evidence only after the approved action has been completed through the existing controlled authority;
- case events cannot be updated or deleted.

## Operational alerts

Initial alert rules detect:

- overdue finance cases;
- cases waiting too long for approval;
- paid or waived examination orders awaiting fulfilment;
- failed finance recovery actions.

Alert rules retain severity, threshold, staff recipients, email status and activation state. Alert email is queued through the existing controlled AgileCert communications outbox. Provider activation and delivery cutover remain governed by the communications system.

## Management reports

Super Administrators or explicitly delegated staff can schedule:

- revenue summaries;
- transaction-exception reports;
- coupon-performance reports;
- reconciliation-backlog reports;
- governance-case reports.

Schedules support daily, weekly and monthly cadence, a named time zone, active staff recipients and an audited subject. Due reports are generated from authoritative finance records and queued as operational administrator messages. The browser does not receive provider credentials.

## Permissions

New permissions:

- `finance.governance.view`;
- `finance.cases.submit`;
- `finance.cases.review`;
- `finance.alerts.manage`;
- `finance.reports.schedule`.

Examination Administrators receive governance viewing and case submission by default. Independent review, alert administration and report scheduling remain denied until a Super Administrator explicitly delegates them. Super Administrators retain complete authority.

## Preserved boundaries

This phase does not alter:

- examination or certification prices;
- coupon definitions or redemptions;
- Paystack keys, verification or webhook processing;
- individual or consolidated checkout;
- payment records;
- order statuses;
- access fulfilment;
- certificate eligibility, issuance or verification;
- historical finance records.

## Validation requirements

The dedicated validation workflow must pass:

- TypeScript validation and production build;
- Finance Governance workspace integration markers;
- complete isolated Supabase migration reset;
- Examination Administrator default access;
- requester self-approval denial;
- dual independent approval for a high-impact case;
- immutable timeline enforcement;
- operational alert generation;
- scheduled report queueing through the controlled outbox;
- candidate denial;
- direct authenticated table-access denial;
- preservation of protected finance and commerce record counts;
- exact phase file boundary.

Production migration and frontend publication remain separate controlled release actions after source validation and review.

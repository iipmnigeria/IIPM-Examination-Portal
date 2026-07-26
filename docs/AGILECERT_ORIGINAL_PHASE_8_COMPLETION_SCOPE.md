# AgileCert Original Roadmap Phase 8 Completion

Tracks #110.

## Objective
Complete Finance, Commerce and Institutional Sponsorship around the deployed individual examination and certificate checkout authorities without rebuilding or weakening them.

## Existing foundation preserved
- examination prices and candidate purchase quotes;
- Paystack examination checkout and verification;
- coupons, zero-payable waivers, examination orders and fulfilment;
- certificate prices, checkout and credential issuance;
- administrator pricing, coupon, order and payment controls;
- certificate, credential, identity, proctoring, examination and AI authorities.

## Release units
1. `202607271000_phase_8_finance_policy_customers.sql`
2. `202607271001_phase_8_quotes_invoices.sql`
3. `202607271002_phase_8_sponsorship_seats.sql`
4. `202607271003_phase_8_payments_receipts.sql`
5. `202607271004_phase_8_refunds_credits.sql`
6. `202607271005_phase_8_reconciliation_reporting.sql`
7. `202607271006_phase_8_privacy_permissions.sql`

## Delivered scope
- finance settings, tax profiles, approval thresholds and institutional discount controls;
- institutional sponsor/customer accounts and billing contacts;
- quotations, purchase-order references, invoices, line-item snapshots and payment schedules;
- paid or explicitly authorised sponsored seat pools;
- candidate nominations, acceptance, examination assignment and auditable access grants;
- manual bank-transfer and institutional payment review;
- payment allocation, receipts and invoice balance refresh;
- individual and institutional refund requests, decisions and payment tracking;
- credit notes and invoice credits;
- reconciliation batches and matched, unmatched, duplicate, short and over-payment controls;
- finance dashboard, ageing, revenue, sponsorship utilisation and audit reporting;
- candidate sponsored-access and refund workspace;
- administrator finance and sponsorship console;
- RPC-only browser writes and private finance records.

## Access rule
Sponsored examination access is granted only when the related invoice is fully paid or when a Super Administrator records an explicit, reasoned credit authorisation. Seat availability alone never unlocks an examination.

## Privacy and payment boundary
- no public institutional finance API;
- candidates see only their own nominations, grants and refund requests;
- billing contacts, tax identifiers, payment evidence and reconciliation data remain administrator-only;
- no Paystack secret, webhook or provider-authority change;
- no direct browser writes to finance tables;
- no question, answer-key, grading, certificate, credential, identity, proctoring or AI change;
- pending migration `202607261300_phase_7_ai_cv_profile_builder_foundation.sql` remains outside this release.

## Validation requirements
- exact seven-migration allow-list;
- complete isolated Supabase reset;
- customer → quote → invoice → payment → receipt lifecycle;
- seat purchase, nomination, acceptance and assignment lifecycle;
- unpaid-invoice and seat-limit blocking;
- refund, credit-note and reconciliation lifecycle;
- candidate privacy and direct-table-access denial;
- existing examination and certificate commerce regression;
- TypeScript validation, production build and compiled capability markers.

## Deployment boundary
Development, validation and merge are separate from production activation. Production migration and GitHub Pages deployment require explicit approval after the completed pull request is presented.
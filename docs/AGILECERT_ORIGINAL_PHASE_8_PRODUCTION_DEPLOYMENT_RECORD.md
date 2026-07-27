# AgileCert Original Roadmap Phase 8 Production Deployment Record

## Deployment status

Original Roadmap Phase 8 — **Finance, Commerce and Institutional Sponsorship** was completed and activated in production on 27 July 2026.

- Source pull request: `#111`
- Approved application/database source commit: `40b00516a4f301de52938069c83878f7fa7a330a`
- Production verification run: `30247765214`
- Permanent compiled Pages run: `30246868918`
- Production portal: `https://iipmnigeria.github.io/IIPM-Examination-Portal/`
- Supabase project: `cfecicvugfrrhcvhduzc`

## Production database release unit

The following nine approved migrations are applied and the linked production database reports no remaining migrations in the controlled Phase 8 window:

1. `202607271000_phase_8_finance_policy_customers.sql`
2. `202607271001_phase_8_quotes_invoices.sql`
3. `202607271002_phase_8_sponsorship_seats.sql`
4. `202607271003_phase_8_payments_receipts.sql`
5. `202607271004_phase_8_refunds_credits.sql`
6. `202607271005_phase_8_reconciliation_reporting.sql`
7. `202607271006_phase_8_privacy_permissions.sql`
8. `202607271007_phase_8_idempotency_refund_access.sql`
9. `202607271008_phase_8_ledger_driven_sponsorship.sql`

The unrelated pending migration `202607261300_phase_7_ai_cv_profile_builder_foundation.sql` was explicitly excluded and remained unapplied.

## Production capabilities

The live Phase 8 system provides:

- finance settings, tax profiles, institutional discount controls and approval thresholds;
- institutional customer and sponsor accounts with controlled contacts and private billing information;
- quotations, purchase-order references, invoices, payment schedules and finance-document generation;
- bulk examination and eligible-certificate seat pools;
- candidate nomination, acceptance, decline and sponsored-access allocation;
- paid-invoice access and explicit Super Administrator credit authorisation within approved credit limits;
- institutional payment review, allocation, receipts and balance recalculation;
- candidate and institutional refund requests, finance decisions and external refund references;
- credit notes, reversals and safe unused-access review after full refunds;
- reconciliation batches for matched, unmatched, duplicate, short and over payments;
- ageing, balances by currency, sponsorship utilisation and immutable finance audit reporting;
- candidate **Sponsored Access & Refunds** workspace; and
- administrator **Finance, Commerce & Institutional Sponsorship** console.

## Privacy and authority boundaries

- Candidates can view only their own nominations, access grants and refund requests.
- Institutional billing contacts, tax identifiers, addresses, payment evidence and reconciliation data remain restricted to authorised finance administrators.
- Browser writes are RPC-controlled and institutional finance evidence remains private.
- Existing Paystack secret, webhook and payment authority were not changed.
- Existing examination and certificate prices, coupons and individual checkout authorities were not rewritten.
- Questions, answer keys, grading, credentials, identity, proctoring and AI authorities were not replaced.

## Validation and evidence

Feature validation before merge:

- Phase 8 database lifecycle run: `30226904264`
- Phase 8 frontend/protected-scope run: `30226904266`

Production evidence:

- `original-phase-8-production-database-evidence`
  - artifact ID: `8645724708`
  - SHA-256: `8541244cdedac325537623dab6bc2a2a43280b41c025e441a4f9595c6be80484`
- `original-phase-8-production-pages-evidence`
  - artifact ID: `8645693004`
  - SHA-256: `39b2254b7ff13dcdab8d4994d8330aaaf4b409bf507b496928e687a93e156ab3`

Both artifacts are retained until 26 August 2026.

The first production run successfully applied the nine migrations and verified the compiled Pages deployment, but a deployment-control assertion referenced a nonexistent contact-table name. The control was corrected to the deployed `agilecert_institution_contacts` table and made idempotent. The final verification-only run confirmed the schema, exclusion boundary, live workspace markers and clean post-deployment migration state.

## Control cleanup

The trigger pull request `#113` was closed without merge after successful verification. The one-time deployment workflow was removed after this permanent record was created. The application source, live portal and deployed database remain unchanged by the cleanup.

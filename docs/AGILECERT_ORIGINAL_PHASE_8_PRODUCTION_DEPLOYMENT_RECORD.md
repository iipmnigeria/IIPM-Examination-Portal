# AgileCert Original Phase 8 Production Deployment Record

## Release
- Phase: Original Roadmap Phase 8 — Finance, Commerce and Institutional Sponsorship
- Approved source branch: `supabase-integration`
- Approved source commit: `40b00516a4f301de52938069c83878f7fa7a330a`
- Production database project: `cfecicvugfrrhcvhduzc`
- Production application: GitHub Pages
- Live URL: `https://iipmnigeria.github.io/IIPM-Examination-Portal/`
- Production verification date: 27 July 2026

## Database migrations deployed
1. `202607271000_phase_8_finance_policy_customers.sql`
2. `202607271001_phase_8_quotes_invoices.sql`
3. `202607271002_phase_8_sponsorship_seats.sql`
4. `202607271003_phase_8_payments_receipts.sql`
5. `202607271004_phase_8_refunds_credits.sql`
6. `202607271005_phase_8_reconciliation_reporting.sql`
7. `202607271006_phase_8_privacy_permissions.sql`
8. `202607271007_phase_8_idempotency_refund_access.sql`
9. `202607271008_phase_8_ledger_driven_sponsorship.sql`

## Production verification
Controlled deployment trigger PR #113 was closed without merge after workflow run `30247765214` completed successfully.

The production evidence confirmed:
- all nine approved Phase 8 migrations are present remotely;
- no Phase 8 migration remained pending after deployment;
- the finance and sponsorship schema contains all 17 required authority markers;
- the corrected deployed contact table is `agilecert_institution_contacts`;
- the pending Phase 7 migration `202607261300_phase_7_ai_cv_profile_builder_foundation.sql` remains unapplied;
- no Paystack authority was changed;
- the permanent compiled GitHub Pages deployment matches the approved source commit and passed live mount verification;
- the candidate `Sponsored Access & Refunds` workspace and administrator `Finance, Commerce & Institutional Sponsorship` console are present in the live bundle.

## Evidence
- Database artifact: `original-phase-8-production-database-evidence`
- Database artifact digest: `sha256:8541244cdedac325537623dab6bc2a2a43280b41c025e441a4f9595c6be80484`
- Pages artifact: `original-phase-8-production-pages-evidence`
- Pages artifact digest: `sha256:39b2254b7ff13dcdab8d4994d8330aaaf4b409bf507b496928e687a93e156ab3`

## Verification correction
The first production verification run applied the nine approved migrations successfully but used the nonexistent marker `agilecert_institution_billing_contacts`. PR #114 corrected the marker to `agilecert_institution_contacts` and made the workflow idempotent. The corrected rerun verified the already-applied release without reapplying migrations.

## Closed boundaries
- no Phase 7 AI CV migration was applied;
- no question, answer-key or grading authority was changed;
- no examination, certificate, credential, identity, proctoring or AI authority was replaced;
- no Paystack secret or webhook authority was changed;
- the one-time deployment workflow was removed after successful verification.

# AgileCert Phase 7 Production Deployment Record

## Release

- Phase: Phase 7 — AI CV and Professional Profile Builder
- Approved source branch: `supabase-integration`
- Approved source commit: `133c90474911736701501eb65ba5041cfce22333`
- Production Supabase project: `cfecicvugfrrhcvhduzc`
- Production application: GitHub Pages
- Live URL: `https://iipmnigeria.github.io/IIPM-Examination-Portal/`
- Production verification date: 27 July 2026

## Database migrations deployed

1. `202607261300_phase_7_ai_cv_profile_builder_foundation.sql`
2. `202607271100_phase_7_ai_cv_completion.sql`

## Edge Function deployed

- `agilecert-ai-cv`

## Production verification

Controlled deployment trigger PR #120 was closed without merge after workflow run `30251195701` completed successfully.

The production evidence confirmed:

- exactly the two approved Phase 7 migrations were applied;
- the private candidate CV document authority is present;
- explicit, withdrawable AI processing consent is present;
- private AI request audit and candidate-controlled suggestion application are present;
- no Phase 7 migration remains pending;
- only the `agilecert-ai-cv` Edge Function was deployed;
- unauthenticated access to the AI CV function is rejected;
- the permanent compiled GitHub Pages deployment matches the approved source commit;
- the live bundle contains the **Private AI CV Studio**, **Generate private suggestion** and **Apply reviewed suggestion** controls; and
- Paystack, examination, certificate, credential, identity, proctoring, answer-key and existing AI Certification Adviser authorities were unchanged.

## Evidence

- Database and function artifact: `agilecert-phase-7-production-database-function-evidence`
- Database and function digest: `sha256:03cc2dad4e142a24506fcdc902ace099f4f204fe04716d00b8bcf8b3cf34f658`
- Pages artifact: `agilecert-phase-7-production-pages-evidence`
- Pages digest: `sha256:df822d83d9b215100a0d26375d7cb5d6205d946b6c33b0cf57d266b00b68f29e`

## Deployment corrections

The first production dry-run stopped before applying migrations because pre-tracking local migration files appeared in the Supabase CLI window. PR #121 isolated migration files older than tracking boundary `202607230101`. A subsequent database connection attempt timed out before applying anything and was rerun unchanged. The final attempt applied and verified the exact approved Phase 7 release.

## Closed boundaries

- no public CV or portfolio publishing;
- no recruiter or employer discovery access;
- no external job-board connection or automatic job application;
- no CV file import or parsing;
- no payment or examination-authority changes;
- no certificate, credential, identity or proctoring-authority changes; and
- the one-time Phase 7 production workflow was removed after successful verification.

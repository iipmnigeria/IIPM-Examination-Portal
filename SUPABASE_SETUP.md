# IIPM Examination Portal — Supabase Activation

This branch introduces the Supabase-backed examination platform without changing the live GitHub Pages demonstration.

## Preview address

After the `Deploy Supabase Preview` workflow completes, use:

`https://iipmnigeria.github.io/IIPM-Examination-Portal/supabase-preview/`

The working demonstration remains at the repository root.

## Database migrations

The following migrations have been applied in this order:

1. `supabase/migrations/202607200001_initial_examination_schema.sql`
2. `supabase/migrations/202607200002_security_hardening.sql`
3. `supabase/migrations/202607200003_bootstrap_super_admin.sql`
4. `supabase/migrations/202607200004_exam_catalogue_and_start.sql`
5. `supabase/migrations/202607200005_secure_submit_and_attempts.sql`
6. `supabase/migrations/202607200006_assignment_management.sql`
7. `supabase/migrations/202607200007_hrmfc_pilot_catalogue.sql`

The first three migrations create the secure database foundation and activate `iipmonline@iipmi.org` as the first Super Administrator.

Migrations 4–7 add:

- Candidate-facing examination catalogue without answer keys
- Secure examination session creation and expiry
- Server-side grading and attempt persistence
- Proctor-event persistence and suspicious-score calculation
- Super Admin/exam-admin controlled examination assignment
- An HRMFC five-question pilot examination

## Supabase Auth URLs

Under **Authentication → URL Configuration**:

- Site URL: `https://iipmnigeria.github.io/IIPM-Examination-Portal/`
- Redirect URL: `https://iipmnigeria.github.io/IIPM-Examination-Portal/**`
- Local redirect URL: `http://localhost:5173/**`

Enable email/password authentication. Candidate sign-up should require email verification before production use.

## Super Administrator

- Email: `iipmonline@iipmi.org`
- Role: `super_admin`

Public registration cannot assign staff or administrator roles.

## Frontend security

Only the Supabase publishable browser key is present in the frontend. Never expose a Supabase secret/service-role key, database password or Gemini key in GitHub Pages.

The integration branch includes:

- Candidate registration and email/password login
- Authorised staff login
- Password reset and persistent sessions
- Supabase sign-out
- Disabled public auditor registration
- Supabase examination catalogue and attempt history
- Secure start and submit operations
- Server-side grading with protected answer keys
- Staff assignment RPC
- HRMFC pilot examination

## Pilot acceptance test

1. Open the Supabase preview address.
2. Register a separate candidate account and confirm its email.
3. Assign the HRMFC pilot examination to that candidate.
4. Sign in as the candidate, take the examination and submit it.
5. Confirm the score remains after logout and login.
6. Sign in as the Super Admin and confirm the attempt appears in the Control Hub.
7. Confirm a candidate cannot read `question_answer_keys` or another candidate’s attempt.

## Remaining production work

1. Add a full examination-authoring and assignment interface.
2. Migrate CHRMG, CHRMP and other approved question banks.
3. Add secure administrator review/override persistence.
4. Connect Gemini through a protected server function.
5. Add evidence retention controls, certificate issuance and public verification.
6. Complete multi-user, RLS and security acceptance testing.

The root GitHub Pages demonstration must remain live until Supabase authentication, secure grading, RLS isolation and multi-user persistence pass acceptance testing on the preview.

# IIPM Examination Portal — Supabase Activation

This branch introduces the Supabase-backed examination platform without changing the live GitHub Pages demonstration.

## 1. Apply the database migrations

In the Supabase dashboard, open **SQL Editor** and run these files in order:

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
- Staff-controlled examination assignment
- An HRMFC five-question pilot examination

## 2. Configure Supabase Auth URLs

Under **Authentication → URL Configuration** set:

- Site URL: `https://iipmnigeria.github.io/IIPM-Examination-Portal/`
- Redirect URL: `https://iipmnigeria.github.io/IIPM-Examination-Portal/**`
- Local redirect URL: `http://localhost:5173/**`

Enable email/password authentication. Candidate sign-up should require email verification before production use.

## 3. Super Administrator

The first Super Administrator is:

- Email: `iipmonline@iipmi.org`
- Role: `super_admin`

Public registration cannot assign staff or administrator roles.

## 4. Frontend configuration

The browser client is defined in `src/lib/supabase.ts` and supports:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Only the publishable browser key may be used in the frontend. Never expose a Supabase secret/service-role key or Gemini key in GitHub Pages.

The integration branch now includes:

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

## 5. Pilot acceptance test

1. Create a separate candidate account through the portal or **Authentication → Users**.
2. Confirm the candidate email.
3. Sign in as the candidate.
4. Open the HRMFC pilot examination.
5. Submit answers and confirm the score persists after logout and login.
6. Sign in as the Super Admin and confirm the attempt appears in the Control Hub.
7. Confirm a candidate cannot read `question_answer_keys` or another candidate’s attempt.

## 6. Remaining production work

1. Add a full examination-authoring and assignment interface.
2. Migrate CHRMG, CHRMP and other approved question banks.
3. Add secure administrator review/override persistence.
4. Connect Gemini through a protected server function.
5. Add evidence retention controls, certificate issuance and public verification.
6. Complete multi-user, RLS and security acceptance testing.

## 7. Production rule

The current GitHub Pages demo must remain live until Supabase authentication, secure grading, RLS isolation and multi-user persistence pass acceptance testing on the integration branch.

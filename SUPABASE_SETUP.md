# IIPM Examination Portal — Supabase Activation

This branch introduces the Supabase foundation without changing the live GitHub Pages portal.

## 1. Apply the database migrations

In the Supabase dashboard, open **SQL Editor** and run these files in order:

1. `supabase/migrations/202607200001_initial_examination_schema.sql`
2. `supabase/migrations/202607200002_security_hardening.sql`
3. `supabase/migrations/202607200003_bootstrap_super_admin.sql`

The first migration creates authentication profiles, programmes, examinations, questions, protected answer keys, assignments, sessions, answers, attempts, proctor events, certificates, audit logs, RLS policies and private storage buckets.

The second migration prevents candidate privilege escalation and reserves official examination writes and answer-key access for protected server operations.

The third migration promotes `iipmonline@iipmi.org` to the first active Super Administrator. Run it only after that email address has been created under **Authentication → Users**.

## 2. Configure Supabase Auth URLs

Under **Authentication → URL Configuration** set:

- Site URL: `https://iipmnigeria.github.io/IIPM-Examination-Portal/`
- Redirect URL: `https://iipmnigeria.github.io/IIPM-Examination-Portal/**`
- Local redirect URL: `http://localhost:5173/**`

Enable email/password authentication. Candidate sign-up should require email verification before production use.

## 3. Create the first Super Admin account

Open **Authentication → Users → Add user** and create:

- Email: `iipmonline@iipmi.org`
- Password: choose a strong private password
- Auto Confirm User: enabled for this administrator account
- User metadata `full_name`: `IIPM Super Administrator` when the dashboard provides a metadata field

After the Auth user exists, run:

`supabase/migrations/202607200003_bootstrap_super_admin.sql`

The script will stop with a clear error if the Auth user has not yet been created. Public registration cannot assign staff or administrator roles.

## 4. Frontend configuration

The browser client is defined in `src/lib/supabase.ts` and supports:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Only the publishable browser key may be used in the frontend. Never expose a Supabase secret/service-role key or Gemini key in GitHub Pages.

The integration branch now includes:

- Candidate registration through Supabase Auth
- Candidate email/password login
- Authorised staff email/password login
- Password reset
- Persistent session restoration
- Supabase sign-out
- Disabled public auditor registration

## 5. Remaining integration order

1. Add protected `start-exam` and `submit-exam` Edge Functions.
2. Move questions and grading from the in-memory Express server to Supabase.
3. Add examination assignment management and the auditor dashboard.
4. Add proctor-event submission and evidence storage.
5. Add certificate issuance and public verification.
6. Complete multi-user, RLS and security acceptance testing.

## 6. Production rule

The current GitHub Pages demo must remain live until Supabase authentication, RLS isolation, secure grading and multi-user persistence pass acceptance testing on the integration branch.

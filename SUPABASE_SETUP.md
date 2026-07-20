# IIPM Examination Portal — Supabase Activation

This branch introduces the Supabase foundation without changing the live GitHub Pages portal.

## 1. Apply the database migrations

In the Supabase dashboard, open **SQL Editor** and run these files in order:

1. `supabase/migrations/202607200001_initial_examination_schema.sql`
2. `supabase/migrations/202607200002_security_hardening.sql`

The first migration creates authentication profiles, programmes, examinations, questions, protected answer keys, assignments, sessions, answers, attempts, proctor events, certificates, audit logs, RLS policies and private storage buckets.

The second migration prevents candidate privilege escalation and reserves official examination writes and answer-key access for protected server operations.

## 2. Configure Supabase Auth URLs

Under **Authentication → URL Configuration** set:

- Site URL: `https://iipmnigeria.github.io/IIPM-Examination-Portal/`
- Redirect URL: `https://iipmnigeria.github.io/IIPM-Examination-Portal/**`
- Local redirect URL: `http://localhost:5173/**`

Enable email/password authentication. Candidate sign-up should require email verification before production use.

## 3. Create the first user

Create the intended Super Admin through **Authentication → Users → Add user** or through the candidate registration flow after it is wired.

Then promote the account in SQL Editor, replacing the email value:

```sql
update public.profiles
set role = 'super_admin', is_active = true
where lower(email) = lower('SUPER_ADMIN_EMAIL_HERE');
```

Do not create administrator roles from public registration metadata.

## 4. Frontend configuration

The browser client is defined in `src/lib/supabase.ts` and supports:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Only the publishable browser key may be used in the frontend. Never expose a Supabase secret/service-role key or Gemini key in GitHub Pages.

## 5. Integration order

After the migrations are applied:

1. Replace candidate registration/login with `src/services/authService.ts`.
2. Remove public auditor registration.
3. Add protected `start-exam` and `submit-exam` Edge Functions.
4. Move questions and grading from the in-memory Express server to Supabase.
5. Add assignment management and the auditor dashboard.
6. Add proctor event submission and evidence storage.
7. Add certificate issuance and verification.

## 6. Production rule

The current GitHub Pages demo must remain live until Supabase authentication, RLS isolation, secure grading and multi-user persistence pass acceptance testing on the integration branch.

# AgileCert Communications Automation — Production Release Record

## Release identity

- Approved source branch: `supabase-integration`
- Approved source commit: `00ff074d2143dfef66e92a4903f670d20f8b9411`
- Production project: `cfecicvugfrrhcvhduzc`
- Release date: 27 July 2026

## Production release units

1. `202607271200_communications_automation.sql`
2. `202607271201_communications_conversion_tracking.sql`
3. `202607271202_communications_conversion_trigger.sql`
4. Edge Function `agilecert-communications`
5. Exact compiled GitHub Pages bundle for the approved source commit

## Verified production state

- All three communications migrations are present in remote migration history.
- The linked production database reports no pending migration.
- The communications settings, preferences, outbox, events, suppressions and conversion-attribution authorities are present.
- The certificate-order conversion trigger is present.
- The Edge Function `agilecert-communications` is deployed.
- Candidate **Email Preferences** and administrator **Communications Automation** workspaces are present in the exact live Pages bundle.
- Provider delivery remains disabled by default: `provider_enabled=false`.
- The communications worker secret is not configured; unauthorised dispatch fails closed with `AGILECERT_COMMUNICATIONS_WORKER_TOKEN is not configured.`
- No outbound email was authorised or sent by the production deployment controls.
- The permanent hourly dispatcher remains unchanged and cannot deliver while provider delivery is disabled or the worker secret is absent.

## Validation evidence

### Pre-production validation

Workflow run `30253472103` passed:

- exact communications-only scope;
- TypeScript and production frontend bundle;
- Deno Edge Function boundary;
- full isolated database lifecycle covering idempotency, reminder cancellation after purchase, conversion attribution, credential follow-up, opt-out, cross-candidate privacy and hard-bounce suppression.

Artifact digests:

- Database: `sha256:c3c9e9cb67a0eab7f6b03e52d5dd8c5b9f072cc134c2d3652a08d912b6031103`
- Frontend: `sha256:4282216e231ea7c70b3a8096353d6203d728cddb3ba449294fc7641fbb17b47e`
- Edge Function: `sha256:4853a699613d44b9d4bae9d9a188486a671d9727be4006ad98fc0a5f90488098`

### Production activation and structural verification

- Initial activation run `30253933698` applied the three approved migrations and verified the exact Pages release. Its schema assertion stopped on a quoted pg_dump marker after successful migration application.
- Completion run `30254406700` confirmed the database was up to date, verified the provider-disabled schema and deployed `agilecert-communications`. The public probe returned the safe missing-worker-secret response rather than the originally expected HTTP code.
- Final structural run `30255059011` reconfirmed migration history, no pending migration, remote structural authority, function deployment and exact Pages evidence. The remaining red step was limited to the public-probe HTTP expectation; dispatch remained fail-closed.

Final structural evidence digests:

- Database/function: `sha256:a6b090a8365fe43d46e44a8b6031566be65c7b16a8dd0c4c6e61d441d5fdb2a7`
- Pages: `sha256:e102905b32f9c08f732712d39f4c930a6f354f12eee20cce6329c21886c6f9f0`

### Activation readiness audit

Read-only workflow run `30255486856` passed and inspected secret names only, never secret values.

It confirmed:

- `agilecert-communications` is active;
- worker and webhook actions fail closed because their required tokens are not configured;
- invalid unsubscribe links return HTTP 400;
- `SUPABASE_SECRET_KEY` is absent from the Supabase communications secret-name readiness set;
- `RESEND_API_KEY` is absent;
- `AGILECERT_COMMUNICATIONS_WORKER_TOKEN` is absent in Supabase;
- `AGILECERT_COMMUNICATIONS_WEBHOOK_TOKEN` is absent;
- `AGILECERT_COMMUNICATIONS_SIGNING_SECRET` is absent;
- the matching GitHub Actions hourly worker token is absent;
- `providerCredentialsReady=false`;
- `hourlyDispatcherReady=false`;
- `outboundDeliveryReady=false`; and
- zero outbound messages were sent by the readiness audit.

Readiness evidence artifact:

- `agilecert-communications-activation-readiness-evidence`
- Digest: `sha256:182ef2d987cd8df43b2ad35d5c57760c23138768ff2703ec9d668131d85bb4cc`

## Protected boundaries

The release did not change examination registration, payment, Paystack, examination start or submission, grading, results, questions, answer keys, certificate eligibility, certificate pricing or fulfilment, credential authority, identity assurance, proctoring, AI Certification Adviser or AI CV authority.

## Delivery activation remains separate

Actual outbound email delivery requires all of the following before an administrator may enable the provider:

- approved and verified sender domain/email;
- `SUPABASE_SECRET_KEY` in Supabase Edge Function secrets;
- `RESEND_API_KEY`;
- `AGILECERT_COMMUNICATIONS_WORKER_TOKEN` in Supabase;
- the identical `AGILECERT_COMMUNICATIONS_WORKER_TOKEN` in GitHub Actions for the hourly dispatcher;
- `AGILECERT_COMMUNICATIONS_WEBHOOK_TOKEN`;
- `AGILECERT_COMMUNICATIONS_SIGNING_SECRET`;
- Resend webhook configuration using the approved protected endpoint; and
- Super Administrator review of sender identity, reply-to address, suppression handling and controlled `provider_enabled=true` activation.

Until those controls are deliberately configured, the production communications system remains deployed but fail-closed for outbound delivery. The permanent hourly dispatcher remains installed and safely records a disabled state when its GitHub worker token is absent.

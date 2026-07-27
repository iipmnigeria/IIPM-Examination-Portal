# AgileCert Communications Automation — Production Release Record

## Release identity

- Communications source branch: `supabase-integration`
- Communications source commit: `00ff074d2143dfef66e92a4903f670d20f8b9411`
- Activation-safety source commit: `eaaa71de585f3a3a786451129598a3cb2ffce14a`
- Production project: `cfecicvugfrrhcvhduzc`
- Release date: 27 July 2026
- Live application: `https://iipmnigeria.github.io/IIPM-Examination-Portal/`

## Production release units

### Communications automation

1. `202607271200_communications_automation.sql`
2. `202607271201_communications_conversion_tracking.sql`
3. `202607271202_communications_conversion_trigger.sql`
4. Edge Function `agilecert-communications`
5. Candidate **Email Preferences** workspace
6. Administrator **Communications Automation** workspace

### Provider activation safety

1. `202607271300_communications_activation_safety.sql`
2. Edge Function `agilecert-communications-control`
3. Edge Function `agilecert-resend-webhook`
4. First-delivery cutover and pre-activation backlog cancellation
5. Browser activation denial and service-role-only activation authority
6. Verified sender-domain testing and signed Resend webhook boundary
7. Activation-aware administrator console

## Verified production state

- All communications migrations through `202607271300` are present in remote migration history.
- The linked production database reports no pending migration.
- The settings, preferences, outbox, events, suppressions and conversion-attribution authorities are present.
- The certificate-order conversion trigger is present.
- `agilecert-communications`, `agilecert-communications-control` and `agilecert-resend-webhook` are deployed.
- Candidate **Email Preferences** and administrator **Communications Automation** workspaces are present in the exact live Pages bundle.
- The administrator workspace exposes the verified sender domain and delivery cutover state.
- Provider delivery remains disabled: `provider_enabled=false`.
- No delivery cutover is created until the controlled activation workflow succeeds.
- Communications due before the first activation cutover cannot be claimed and are cancelled as `pre_activation_backlog`.
- A disabled provider cannot be enabled from the browser.
- The permanent hourly dispatcher remains installed and safely records a disabled state while its worker token is absent.
- No candidate email was authorised or sent by deployment, validation or readiness controls.

## Communications validation evidence

### Pre-production communications validation

Workflow run `30253541175` passed:

- exact communications-only scope;
- TypeScript and production frontend bundle;
- Deno Edge Function boundary;
- full isolated database lifecycle covering idempotency, reminder cancellation after purchase, conversion attribution, credential follow-up, opt-out, cross-candidate privacy and hard-bounce suppression.

Artifact digests:

- Database: `sha256:5352c8f24de3ce2b321e57796434f158dae18ee0b79842c0138cb9c9b087fff3`
- Frontend: `sha256:681ad0d114b785dc613912e4deb926122a9083082ebf1d5ce6d9de6c47f61825`
- Edge Function: `sha256:9df29a0f0b822120f7213601a9405ba4a5a5906643a492a885c3d9e8510c6880`

### Communications production activation and structural verification

- The initial production activation applied migrations `202607271200`–`202607271202` and verified the exact Pages release.
- Subsequent verification confirmed the database was up to date, the provider-disabled schema was live and `agilecert-communications` was deployed.
- Public probes confirmed dispatch remained fail-closed because the worker credential was not configured.

Permanent structural evidence digests:

- Database/function: `sha256:a6b090a8365fe43d46e44a8b6031566be65c7b16a8dd0c4c6e61d441d5fdb2a7`
- Pages: `sha256:e102905b32f9c08f732712d39f4c930a6f354f12eee20cce6329c21886c6f9f0`

### Activation-readiness audit

Read-only workflow run `30255486856` passed and inspected secret names only, never secret values.

It confirmed:

- `agilecert-communications` was active and fail-closed;
- invalid unsubscribe links returned HTTP 400;
- provider credentials were not configured;
- the matching GitHub Actions hourly worker token was absent;
- `providerCredentialsReady=false`;
- `hourlyDispatcherReady=false`;
- `outboundDeliveryReady=false`; and
- zero outbound messages were sent.

Readiness evidence:

- Artifact: `agilecert-communications-activation-readiness-evidence`
- Digest: `sha256:182ef2d987cd8df43b2ad35d5c57760c23138768ff2703ec9d668131d85bb4cc`

## Activation-safety validation evidence

### Source validation

Workflow run `30257214515` passed all four gates:

- exact eight-file activation-safety scope;
- TypeScript/lint and production frontend bundle;
- Deno type-check for provider control and signed webhook;
- complete isolated Supabase reset confirming service-role-only activation, browser activation denial, provider-disabled default and delivery-cutover enforcement.

Artifact digests:

- Database: `sha256:ea04ebd09c2e649a39e8604946e5156ecbd558c54ba6a152d40013fea95df495`
- Frontend: `sha256:c39655b68b94851dc7617817abdaa649edf997f8a858ed6012a1181fc544b8c7`
- Edge Functions: `sha256:484396b3eb7ac215e7a63eee6ecea23e7ddf84fc89e24e5ea7a1257cdb344450`

### Production deployment

Workflow run `30257795742` completed successfully:

- applied only `202607271300_communications_activation_safety.sql`;
- verified the remote cutover and provider-activation authority;
- confirmed no migration remained pending;
- deployed only `agilecert-communications-control` and `agilecert-resend-webhook`;
- confirmed both public endpoints fail closed without approved credentials or a valid signed webhook request;
- verified the exact activation-aware Pages release;
- did not enable the provider; and
- sent no candidate email.

Production evidence digests:

- Database/functions: `sha256:646fc6f16345a87939fbdebe8fb608e773111a0111a46580651945d7a6891a65`
- Pages: `sha256:d16ad957762b92f2f18007b12a80a5d63504ddcec1784ee1b0fe64924f64d49b`

## Permanent activation and rollback controls

The following permanent controls are installed on `main`:

- **Activate AgileCert Communications Provider** — validates credentials and sender identity, deploys approved safety functions, tests the sender through Resend's non-human test address, and establishes the cutover only in explicit activation mode.
- **Disable AgileCert Communications Provider** — immediately disables provider delivery through the private control authority.
- **AgileCert Hourly Communications Dispatcher** — refreshes and sends due post-cutover messages when the matching worker token is configured; otherwise it records a disabled state.
- Runbook: `docs/AGILECERT_COMMUNICATIONS_PROVIDER_ACTIVATION_RUNBOOK.md`.

## External activation still required

Actual outbound email delivery requires the credential owner to complete all of the following:

- verify the approved sender domain and sender email in Resend;
- create and securely store `RESEND_API_KEY` in GitHub Actions;
- register the signed Resend webhook endpoint and store `RESEND_WEBHOOK_SECRET` in GitHub Actions;
- generate and store `AGILECERT_COMMUNICATIONS_WORKER_TOKEN` in GitHub Actions;
- generate and store `AGILECERT_COMMUNICATIONS_SIGNING_SECRET` in GitHub Actions;
- retain the existing Supabase deployment credentials;
- run **Activate AgileCert Communications Provider** first in `validate_only` mode;
- review the non-human sender test and sanitized evidence; and
- rerun in `activate` mode with explicit delivery confirmation.

The activation workflow copies the approved provider secrets into Supabase without committing or printing their values. It then establishes the first delivery cutover and cancels pre-activation backlog before any due communication can be claimed.

## Protected boundaries

The release did not change examination registration, payment, Paystack, examination start or submission, grading, results, questions, answer keys, certificate eligibility, certificate pricing or fulfilment, credential authority, identity assurance, proctoring, AI Certification Adviser or AI CV authority.

Until the external credentials and sender-domain steps are deliberately completed, the production communications system remains fully deployed but fail-closed for outbound delivery.

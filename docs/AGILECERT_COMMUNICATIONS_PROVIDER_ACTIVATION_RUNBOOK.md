# AgileCert Communications Provider Activation Runbook

## Current state

The communications database, queue, sender function, candidate preferences and administrator console are deployed. Outbound delivery remains disabled until the credential and sender-domain controls below are completed.

## Activation safeguards

- A disabled provider cannot be enabled from the browser.
- First activation establishes a production delivery cutover.
- Queued or newly derived messages due before the cutover are cancelled as `pre_activation_backlog`.
- The activation workflow tests the sender with Resend's non-human `delivered@resend.dev` address before enabling delivery.
- The Resend webhook endpoint accepts only Svix-signed requests.
- A Super Administrator can disable an active provider from the portal; the emergency workflow provides a second disable path.

## Required external setup

### 1. Verify the sender domain in Resend

Create and verify the selected sender domain in Resend. Complete all DNS records shown by Resend and confirm that the domain status is verified.

Recommended sender identity:

- Sender name: `AgileCert Global`
- Sender email: a dedicated address on the verified domain, for example `notifications@certifications.iipmi.org`
- Reply-to: an actively monitored support or certification address

The exact sender email must use the verified domain.

### 2. Create a Resend sending API key

Create a sending-only API key restricted to the verified sender domain where possible. Store it in GitHub Actions as:

- `RESEND_API_KEY`

Do not commit or paste the key into source files, issues or pull requests.

### 3. Configure the signed Resend webhook

Create a Resend webhook endpoint using:

`https://cfecicvugfrrhcvhduzc.supabase.co/functions/v1/agilecert-resend-webhook`

Subscribe to:

- `email.delivered`
- `email.opened`
- `email.clicked`
- `email.bounced`
- `email.complained`

Copy the webhook signing secret and store it in GitHub Actions as:

- `RESEND_WEBHOOK_SECRET`

### 4. Create private communications secrets

Generate two different long random secrets. Store them in GitHub Actions as:

- `AGILECERT_COMMUNICATIONS_WORKER_TOKEN`
- `AGILECERT_COMMUNICATIONS_SIGNING_SECRET`

The worker token authorises the hourly dispatcher and provider-control function. The signing secret protects candidate unsubscribe links. Do not reuse the webhook signing secret for either purpose.

### 5. Confirm Supabase deployment credentials

The existing production deployment controls require:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_DB_PASSWORD`

These are deployment credentials and are separate from the communications provider credentials.

## Validation before activation

Run the GitHub Actions workflow **Activate AgileCert Communications Provider** with:

- Mode: `validate_only`
- Sender name, sender email and reply-to email completed
- Sender domain verified: confirmed
- Resend webhook registered: confirmed
- Hourly batch size: start with `10`
- Maximum attempts: `5`

Validation will:

1. require all credential names without printing values;
2. copy the approved provider secrets into Supabase Edge Function secrets;
3. deploy only the approved communications control and signed webhook functions;
4. verify that the control function is private;
5. send one test-mode message only to `delivered@resend.dev`;
6. save the reviewed sender identity while leaving `provider_enabled=false`;
7. confirm that no delivery cutover has been created.

Do not proceed to activation unless validation succeeds.

## Controlled activation

Run **Activate AgileCert Communications Provider** again with:

- Mode: `activate`
- the same approved sender details;
- both activation confirmations enabled;
- the reviewed starting batch size;
- `Reset delivery cutover` disabled for first activation.

Activation will:

1. repeat the non-human Resend sender test;
2. set `provider_enabled=true`;
3. establish the first production delivery cutover;
4. cancel all queued or failed communications due before the cutover;
5. verify the active sender domain and cutover;
6. leave the hourly dispatcher to deliver only post-cutover due communications.

## Post-activation checks

After the first hourly dispatcher run, review the administrator **Communications Automation** workspace:

- `Processing` should return to zero after dispatch completes.
- `Failed` should remain low and should not grow continuously.
- `Sent` should increase only for post-cutover communications.
- `Suppressed` should reflect hard bounces, complaints or unsubscribe controls.
- No item with `failure_code=pre_activation_backlog` should be sent.

Review Resend for sender reputation, delivery, bounce and complaint evidence before increasing the hourly batch size.

## Emergency disable

Use either path:

1. In the portal, a Super Administrator clears **Keep provider delivery enabled** and saves; or
2. Run **Disable AgileCert Communications Provider** from GitHub Actions with a reason.

Disabling provider delivery does not delete the outbox, preferences, events or suppression records. Re-enabling always requires the credential-gated activation workflow.

## Secret rotation

- Rotate the Resend API key when exposure is suspected or on the approved security schedule.
- Rotate the worker token in GitHub and Supabase together.
- Avoid rotating the unsubscribe signing secret casually because previously issued unsubscribe links depend on it.
- Updating the Resend webhook signing secret requires updating `RESEND_WEBHOOK_SECRET` and redeploying the webhook function through validation mode.

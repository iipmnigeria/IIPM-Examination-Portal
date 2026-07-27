# AgileCert Communications Automation Workstream

Tracks the remaining automation requirements in issue #2 without changing the authoritative examination, payment, certificate, credential, identity or proctoring systems.

## Objective

Deliver privacy-controlled and auditable email automation from registration/payment outcomes through certificate purchase, credential issuance and relevant-course follow-up.

## Authoritative event sources

The communication system derives messages from existing server-owned records:

- paid or waived `exam_orders` and fulfilled examination access;
- passed and integrity-cleared `agilecert_certificate_eligibility_records`;
- verified paid or waived `agilecert_certificate_orders`;
- active `agilecert_paid_credentials`; and
- published examination catalogue records.

It does not write to those authorities or decide payment, eligibility, score, identity, certificate or credential outcomes.

## Automated candidate journeys

### Examination payment and preparation access

After a paid or authorised examination order is fulfilled, queue one operational **preparation material/access ready** message.

### Post-pass certificate sequence

For an eligible, integrity-cleared examination attempt with no paid or waived certificate order, queue:

1. immediate congratulations and certificate offer;
2. day 2 reminder;
3. day 5 reminder; and
4. final day 7 early-price reminder.

All unsent reminders are cancelled immediately when:

- a certificate order becomes paid or waived;
- eligibility is blocked, revoked or otherwise no longer valid; or
- the candidate disables certificate reminders.

### Certificate purchase and credential delivery

- Queue one operational certificate-purchase confirmation after verified payment or authorised waiver.
- Queue one operational credential-ready message after an active paid credential is issued.
- Attribute a verified certificate purchase conversion to any previously sent certificate-offer email for that eligibility.

### Relevant-course follow-up

After credential issuance, queue one optional course-recommendation message based on the currently published examination catalogue, excluding the source examination.

## Data model

### `agilecert_communication_settings`

- provider activation state;
- verified sender and reply-to configuration;
- hourly batch size and retry limit;
- provider remains disabled by default.

### `agilecert_communication_preferences`

Candidate-owned preference state for:

- certificate reminders;
- relevant-course recommendations; and
- operational delivery.

Candidates may update optional preferences through authenticated RPCs. Operational delivery remains separate so paid and issued services can be fulfilled.

### `agilecert_communication_outbox`

- one idempotent `event_key` per communication;
- recipient and email hash;
- message type and category;
- due time, processing state, retries and backoff;
- provider message ID and minimal delivery evidence.

### `agilecert_communication_events`

Tracks queued, sent, delivered, opened, clicked, bounced, complained, unsubscribed, cancelled, failed and conversion events.

### `agilecert_communication_suppressions`

Stores hashed-email suppression for unsubscribe, hard bounce, complaint and authorised manual suppression. Raw email is not stored in the suppression table.

## Delivery authority

Edge Function: `agilecert-communications`

Supported actions:

- `scan-and-send` — worker-token protected outbox refresh, claim and provider delivery;
- `webhook` — webhook-token protected delivery-event ingestion; and
- signed `GET` unsubscribe links.

Provider adapter: Resend.

Required server-only secrets:

- `RESEND_API_KEY`;
- `AGILECERT_COMMUNICATIONS_WORKER_TOKEN`;
- `AGILECERT_COMMUNICATIONS_WEBHOOK_TOKEN`; and
- `AGILECERT_COMMUNICATIONS_SIGNING_SECRET`.

Provider delivery cannot be enabled until a verified sender domain/email and all required secrets are configured. Queue derivation and candidate preferences remain safe while delivery is disabled.

## Candidate and administrator workspaces

### Candidate Email Preferences

Candidates can:

- enable or disable certificate reminders;
- enable or disable relevant-course recommendations; and
- understand why operational delivery remains distinct.

### Administrator Communications Console

Examination administrators can view:

- queued, processing, sent, failed, suppressed and cancelled counts;
- recent outbox metadata without recipient emails; and
- recent provider and conversion events.

Super Administrators can configure sender identity, batching, retries and controlled provider activation.

## Privacy and security boundaries

- direct browser writes to outbox, events and suppression records are denied;
- candidates read only their own preference row;
- recipient emails are excluded from administrator RPC responses;
- worker, webhook, signing and provider secrets remain server-only;
- unsubscribe links use signed tokens;
- hard bounces and complaints suppress all further delivery;
- optional preferences cancel only optional queued work;
- Paystack secrets, webhooks and payment authority are unchanged;
- examination questions, answers, scores and grading are never placed in provider audit metadata beyond the candidate-facing pass result required for a certificate offer;
- identity and proctoring evidence are never included in email payloads.

## Release units

### Database

1. `202607271200_communications_automation.sql`
2. `202607271201_communications_conversion_tracking.sql`
3. `202607271202_communications_conversion_trigger.sql`

### Edge Function

- `supabase/functions/agilecert-communications/index.ts`

### Frontend

- `src/services/communicationsService.ts`
- `src/components/CandidateCommunicationPreferences.tsx`
- `src/components/AdminCommunicationsLauncher.tsx`
- `src/main.tsx`

### Configuration and validation

- `supabase/config.toml`
- `.env.example`
- `scripts/communications-automation-behaviour.sql`
- `.github/workflows/validate-agilecert-communications.yml`

## Acceptance requirements

- complete isolated Supabase reset succeeds;
- one fulfilled exam order creates one preparation-access message;
- one eligible attempt creates exactly four idempotent certificate reminders;
- provider-disabled state claims no messages;
- enabling delivery claims only due messages;
- verified certificate purchase cancels remaining reminders and queues confirmation;
- sent reminder receives conversion attribution after purchase;
- issued credential queues credential-ready and relevant-course follow-up;
- optional opt-out cancels optional work without deleting required operational delivery;
- bounce and complaint events create suppression;
- another candidate cannot read preference, outbox, event or suppression data;
- TypeScript and production bundle pass;
- Edge Function type-checks and contains no Paystack, question-answer or identity-evidence authority;
- production deployment keeps provider delivery disabled unless sender credentials are verified and secrets are present.

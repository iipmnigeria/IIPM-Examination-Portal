# AgileCert Communications Activation Safety

## Objective

Prepare the deployed communications automation for controlled provider activation without sending historical reminders, exposing credentials or weakening existing examination, payment, certificate, credential, identity, proctoring or AI authorities.

## Included

- first-production-delivery cutover stored in the communications settings authority;
- automatic cancellation of queued or newly derived communications due before the cutover;
- service-role-only provider activation RPC;
- prevention of browser-based activation of a disabled provider;
- verified sender email/domain matching;
- Resend test-mode sender validation using `delivered@resend.dev` before configuration can succeed;
- dedicated worker-token-protected communications control Edge Function;
- dedicated Resend webhook receiver using Svix signature verification and the raw request body;
- administrator visibility of the verified sender domain and delivery cutover;
- safe browser-based disable behaviour after activation;
- preserved hourly batching, retry, preference, suppression, unsubscribe and idempotency controls.

## Activation principles

1. A disabled provider cannot be enabled from the browser.
2. The sender must pass Resend test-mode delivery before provider configuration succeeds.
3. The first activation establishes a delivery cutover at the activation time.
4. Communications due before the cutover are cancelled with `pre_activation_backlog` and are never claimed.
5. Resend webhooks are accepted only after Svix signature verification.
6. Provider configuration and emergency disable are authorised by the same private worker token used by the hourly dispatcher.
7. The production provider remains disabled until the separate credential-gated activation workflow is deliberately executed.

## Release units

- `202607271300_communications_activation_safety.sql`
- `agilecert-communications-control`
- `agilecert-resend-webhook`
- communications administrator cutover/status refinements
- Supabase function configuration updates

## Excluded

- automatic creation or disclosure of GitHub or Resend credentials;
- automatic DNS changes;
- automatic activation without explicit operator confirmation;
- bulk transmission of the pre-activation queue;
- changes to examination runtime, Paystack, grading, results, certificate eligibility or fulfilment, credential issuance, identity assurance, proctoring, AI Adviser or AI CV authority.

# AgileCert Paystack Live Examination Activation Runbook

## Approved scope

This control activates real Paystack collections for individual AgileCert examination orders only.

It deploys only:

- `initialize-exam-payment`
- `verify-exam-payment`
- `paystack-webhook`

It does not change examination prices, academic grading, questions, answer keys, certificates, communications, finance-refund authority or institutional sponsorship.

## Current CIPMN coupon

The single programme-wide coupon already deployed to production is:

- **Code:** `CIPMN12-ACCESS88`
- **Scope:** all 12 examinations under programme `CIPMN-MOCK`
- **Discount:** 88%
- **Standard module fee:** NGN 25,000
- **Candidate payable amount:** NGN 3,000 per module
- **Candidate usage:** once per module, up to 12 total redemptions
- **Overall redemption limit:** none during the active window
- **Production start:** 25 July 2026, 17:06 UTC
- **Production expiry:** 8 August 2026, 17:06 UTC

Do not create a second overlapping CIPMN coupon. Extend or replace the expiry only through a separately reviewed migration.

## Paystack Dashboard preparation

1. Confirm the Paystack business is approved for live collections and settlement details are complete.
2. Open **API Keys & Webhooks** in the Paystack Dashboard or the Developers area in Paystack Canvas.
3. Copy the **live secret key** beginning with `sk_live_`.
4. Set the live webhook URL to:

   `https://cfecicvugfrrhcvhduzc.supabase.co/functions/v1/paystack-webhook`

5. The application supplies the callback URL per transaction as:

   `https://iipmnigeria.github.io/IIPM-Examination-Portal/?payment=callback`

6. Do not paste the live secret key into source code, a pull request, an issue, a workflow input or chat.
7. Do not enable Paystack live-secret IP restriction unless the production Supabase functions use a confirmed stable outbound IPv4 address included in the allow-list.

## GitHub secret

In the repository, open:

**Settings → Secrets and variables → Actions → New repository secret**

Create:

- **Name:** `PAYSTACK_LIVE_SECRET_KEY`
- **Value:** the Paystack live secret beginning with `sk_live_`

The existing repository secret `SUPABASE_ACCESS_TOKEN` must also remain configured.

## Validation run

After the activation-control pull request is merged into `main`:

1. Open **Actions**.
2. Select **Activate Paystack Live Examination Payments**.
3. Select **Run workflow** on branch `main`.
4. Choose `validate_only`.
5. Confirm the Paystack account is live.
6. Confirm the webhook URL is registered.
7. Leave the real-payment confirmation unchecked.
8. Run the workflow.

A successful validation confirms:

- the secret has the `sk_live_` prefix without printing it;
- Paystack accepts the live credential through a read-only integration request;
- the approved server-side payment source is intact;
- the CIPMN coupon source is the existing programme-scoped 88% coupon;
- the current Supabase payment-function deployment is inventoried;
- no transaction or real charge is created.

## Activation run

After `validate_only` succeeds:

1. Run the same workflow again.
2. Choose `activate`.
3. Check all three confirmations, including authorisation for real payments.
4. Run the workflow.

The workflow will:

- install the live key as the Supabase secret `PAYSTACK_SECRET_KEY`;
- set the approved portal callback origin;
- deploy only the three examination-payment functions;
- confirm the functions are listed as deployed;
- prove that unauthenticated initialization and verification fail closed;
- prove that an unsigned webhook is rejected;
- create no real charge;
- upload sanitized activation evidence.

## Controlled real-payment smoke test

Use one internal candidate account and one CIPMN module only.

1. Sign in as the internal candidate.
2. Select one CIPMN module examination.
3. Enter coupon `CIPMN12-ACCESS88`.
4. Confirm the quote shows:
   - list amount: NGN 25,000;
   - discount: NGN 22,000;
   - payable amount: NGN 3,000.
5. Continue to Paystack and complete the NGN 3,000 payment using an authorised real payment method.
6. Confirm Paystack shows a successful live transaction.
7. Confirm the candidate returns to the portal and the transaction is verified.
8. Confirm the order becomes paid, the payment becomes successful and examination access is unlocked exactly once.
9. Confirm the Paystack `charge.success` webhook is delivered successfully.
10. Confirm a refresh does not create duplicate access or duplicate fulfilment.

## Stop conditions

Do not continue with a live payment when:

- the checkout amount is not NGN 3,000 after the coupon;
- the coupon is expired or applies outside the CIPMN programme;
- the Paystack checkout appears in test mode;
- the callback domain is unexpected;
- the webhook URL is missing or failing;
- the candidate email or transaction reference does not match the order;
- the portal unlocks access before server verification;
- any live secret appears in logs or source.

## Rollback

For an urgent stop:

1. Remove or replace `PAYSTACK_SECRET_KEY` in Supabase with a non-live controlled value, or delete the secret.
2. Disable the payment action in the examination catalogue if immediate candidate blocking is required.
3. Keep the webhook URL registered while investigating already-completed transactions.
4. Reconcile all Paystack transactions created after activation against `exam_orders` and `exam_payments`.
5. Do not delete successful payment records or coupon redemptions.
6. Rotate the Paystack live secret immediately if exposure is suspected.

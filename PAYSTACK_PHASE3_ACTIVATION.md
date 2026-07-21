# Phase 3 — Paystack Activation

## 1. Rotate the test secret key

The Paystack test secret key previously shared in chat must be regenerated before activation. Do not reuse the exposed value.

The browser application does not require a Paystack public key because transaction initialization is performed by the Supabase Edge Function.

## 2. Add Supabase Edge Function secrets

Open the Supabase project `cfecicvugfrrhcvhduzc`.

Go to **Edge Functions → Secrets** and add:

```text
PAYSTACK_SECRET_KEY=<new rotated Paystack test secret key>
IIPM_PORTAL_URL=https://iipmnigeria.github.io/IIPM-Examination-Portal/
```

Never prefix the Paystack secret with `VITE_` and never commit it to GitHub.

## 3. Run checkout hardening migration

Run this file in **Supabase → SQL Editor**:

```text
supabase/migrations/202607210011_paystack_checkout_hardening.sql
```

This ensures a candidate changing currency or coupon cannot accidentally reuse an incompatible pending order.

## 4. Configure GitHub deployment access

Create a Supabase personal access token from the Supabase account settings.

In GitHub, open:

**Repository → Settings → Secrets and variables → Actions → New repository secret**

Create:

```text
Name: SUPABASE_ACCESS_TOKEN
Value: <Supabase personal access token>
```

This token deploys Edge Function source code. It is separate from the Paystack secret.

## 5. Deploy the Edge Functions

Open **GitHub → Actions → Deploy Supabase Payment Functions → Run workflow**.

The workflow deploys:

- `initialize-exam-payment`
- `verify-exam-payment`
- `paystack-webhook`

## 6. Configure the Paystack webhook

In the Paystack test dashboard, set the webhook URL to:

```text
https://cfecicvugfrrhcvhduzc.supabase.co/functions/v1/paystack-webhook
```

Do not use the WordPress/WooCommerce webhook for the examination portal.

## 7. Publish the frontend

After the Edge Functions are deployed, open:

**GitHub → Actions → Recover IIPM Examination Portal → Run workflow**

The workflow builds and publishes the `supabase-integration` branch.

## 8. Test transaction

1. Register or sign in as a candidate.
2. Select a locked examination.
3. Confirm the fee is NGN 25,000.
4. Click **Pay and Unlock**.
5. Create the secure payment order.
6. Complete a Paystack test payment.
7. Confirm the portal returns to the verification panel.
8. Confirm the examination changes to **Unlocked**.
9. Launch the examination.
10. Confirm questions are unavailable before payment and available after verified payment.

## Security checks

- The Paystack secret must exist only in Supabase Edge Function secrets.
- The webhook validates `x-paystack-signature` using HMAC SHA-512.
- The webhook and candidate return path independently verify the transaction with Paystack.
- The amount, currency, reference and candidate email must match the database order.
- Duplicate webhook events must not create duplicate examination assignments.

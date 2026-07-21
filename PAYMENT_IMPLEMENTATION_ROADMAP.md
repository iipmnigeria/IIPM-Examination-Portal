# IIPM Examination Portal — Payment Implementation Roadmap

## Security prerequisite

The Paystack test secret key previously shared in chat must be rotated before Edge Functions are deployed. Store the replacement secret only in Supabase Edge Function secrets. Never commit it to GitHub or expose it through Vite/browser environment variables.

The Paystack public key may be used by the checkout interface, but transaction amounts and references must be created and verified server-side.

## Phase 1 — Commerce and access foundation

Migrations:

1. `202607210009_exam_commerce_foundation.sql`
2. `202607210010_exam_commerce_hardening.sql`

Deliverables:

- All published examinations appear in the candidate catalogue.
- Questions are removed from catalogue responses.
- Examination questions are released only by `start_exam_secure` after access is unlocked.
- Default price is NGN 25,000 per examination.
- Multi-currency price records are supported.
- Orders, payments, coupons and coupon redemptions are persisted.
- Percentage, fixed-value and 100% scholarship coupons are supported.
- Paid or waived orders create examination access automatically.
- RLS separates candidate records from administrator controls.

## Phase 2 — Candidate purchase interface

Deliverables:

- Locked and unlocked examination cards.
- Currency selector with country-aware default routing.
- Price formatting by currency.
- Coupon entry and server-side quote validation.
- Pay and Unlock action.
- Automatic launch state refresh after fulfilment.

## Phase 3 — Paystack Edge Functions

Functions:

- `initialize-exam-payment`
- `verify-exam-payment`
- `paystack-webhook`

Deliverables:

- Server-side Paystack transaction initialisation.
- Amount, currency, candidate and examination metadata validation.
- Paystack signature validation on webhook events.
- Idempotent fulfilment of successful transactions.
- Dedicated webhook URL for the examination portal.
- No use of the WooCommerce webhook URL.

## Phase 4 — Administrator commerce console

Deliverables:

- Create and edit examination prices.
- Configure currency availability and country routing.
- Create percentage, fixed and scholarship coupons.
- Set coupon scope, dates, limits and per-candidate usage.
- View orders, successful payments, failed payments and redemptions.
- Manually verify or refund only through audited administrator actions.

## Phase 5 — Acceptance testing and production activation

Tests:

- Candidate sees every published examination.
- Unpaid candidate cannot retrieve questions or start an examination.
- Correct NGN amount sent to Paystack is 2,500,000 kobo.
- Currency-specific price is selected correctly.
- Invalid, expired and exhausted coupons are rejected.
- 100% coupon unlocks without opening Paystack.
- Successful payment unlocks exactly once.
- Duplicate webhook events do not duplicate assignments.
- Candidate A cannot see Candidate B's orders or payments.
- Secret and service-role keys do not appear in the compiled frontend.

Production activation requires replacement live Paystack keys, a production webhook configuration, and final end-to-end payment testing.

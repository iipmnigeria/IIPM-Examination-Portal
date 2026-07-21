# Phase 5 — Acceptance Testing and Production Readiness

Use the Paystack **test environment** only. Do not activate live keys until every test below passes.

## Prerequisites

- Migrations 009 through 013 have completed successfully.
- A rotated Paystack test secret is stored as the Supabase Edge Function secret `PAYSTACK_SECRET_KEY`.
- `IIPM_PORTAL_URL` is set to `https://iipmnigeria.github.io/IIPM-Examination-Portal/`.
- `initialize-exam-payment`, `verify-exam-payment` and `paystack-webhook` are deployed.
- Paystack test webhook points to:
  `https://cfecicvugfrrhcvhduzc.supabase.co/functions/v1/paystack-webhook`
- The portal frontend has been deployed from `supabase-integration`.
- One Super Administrator account and two separate candidate accounts are available.

## A. Automated checks

1. Open **GitHub → Actions → Phase 5 Production Readiness**.
2. Confirm the workflow is green.
3. Confirm all of these steps passed:
   - TypeScript validation
   - Vite production build
   - Source secret scan
   - Compiled bundle readiness scan
4. Run `supabase/verification/phase5_production_readiness.sql` in the Supabase SQL Editor.
5. Every row marked as a required check should return `PASS`.
6. `stale_pending_orders` may return `WARNING`; cancel or expire those orders before launch.

## B. Catalogue and access protection

1. Sign in as Candidate A.
2. Confirm every published examination is visible.
3. Confirm an unpaid examination displays `Payment Required` and cannot launch.
4. Open browser developer tools and confirm the catalogue response contains no question text or answer options.
5. Attempt to launch the unpaid examination directly.
6. Confirm the server rejects the request with a payment or access-required message.

Expected result: published examinations are discoverable, but questions remain server-protected until access is granted.

## C. Standard NGN price

1. Sign in as a Super Administrator.
2. Open **Commerce Console → Pricing**.
3. Confirm every published examination has an active NGN default price of `25,000`.
4. Sign in as Candidate A.
5. Confirm the candidate sees `₦25,000` before discounts.

Expected result: Paystack receives `2,500,000` kobo for a full-price NGN examination.

## D. 100% scholarship coupon

1. In **Commerce Console → Coupons**, create a test coupon:
   - Code: `TESTSCHOLAR100`
   - Type: Percentage
   - Value: 100
   - Scope: one examination
   - Candidate limit: 1
   - Maximum redemptions: 2
   - Active: Yes
2. Sign in as Candidate A.
3. Enter the coupon and validate it.
4. Confirm amount payable becomes zero.
5. Apply the scholarship.
6. Confirm Paystack does not open.
7. Confirm the examination changes to `Unlocked`.
8. Confirm the examination can launch and returns questions.
9. Sign in as Candidate B and use the second permitted redemption.
10. Confirm a third attempted redemption is rejected.

Expected result: a valid 100% coupon creates a waived order, records redemption and grants access exactly once per candidate.

## E. Percentage discount payment

1. Create a test coupon:
   - Code: `TEST20`
   - Type: Percentage
   - Value: 20
   - Currency: NGN or unrestricted
   - Scope: one examination
   - Candidate limit: 1
2. Sign in as a candidate who has not unlocked that examination.
3. Validate the coupon.
4. Confirm:
   - List fee: ₦25,000
   - Discount: ₦5,000
   - Amount payable: ₦20,000
5. Continue to Paystack test checkout.
6. Complete the test payment.
7. Confirm the portal returns to payment verification.
8. Confirm the examination becomes unlocked.
9. Confirm the order is `paid`, payment is `success`, and coupon redemption is `redeemed`.

Expected result: Paystack receives `2,000,000` kobo and access is granted once.

## F. Full-price Paystack payment

1. Choose a locked examination without a coupon.
2. Confirm amount payable is ₦25,000.
3. Complete Paystack test checkout.
4. Confirm the candidate returns to the portal.
5. Confirm transaction verification succeeds.
6. Confirm the examination changes to `Unlocked`.
7. Confirm the candidate can launch the examination.

Expected result: amount, currency, reference and candidate email match the database order before fulfilment.

## G. Duplicate webhook protection

1. Use the Paystack test dashboard to resend the successful webhook event, or repeat the verification request for the same reference.
2. Confirm no second assignment is created.
3. Confirm no duplicate successful payment record is created.
4. Confirm the existing order remains fulfilled.

Expected result: fulfilment is idempotent.

## H. Failed or abandoned payment

1. Start checkout for a locked examination.
2. Abandon or fail the Paystack test transaction.
3. Return to the portal.
4. Confirm the examination remains locked.
5. Confirm no successful payment or assignment exists.
6. In Commerce Console, cancel the pending order.
7. Confirm any reserved coupon is released.

Expected result: only verified successful transactions unlock examinations.

## I. Currency routing

1. In **Commerce Console → Pricing**, create a non-NGN test price for one examination.
2. Add appropriate two-letter country routing codes.
3. Sign in using a browser locale matching one of those country codes.
4. Confirm the routed currency is selected by default.
5. Change the currency manually and confirm the price changes to the configured amount.
6. Confirm a pending order created under one currency is not reused after switching currency or coupon.

Expected result: currency routing uses administrator-configured prices; it does not perform uncontrolled live exchange-rate conversion.

## J. Administrator permissions

1. Sign in as a normal candidate.
2. Confirm **Commerce Console** and **Assign Examination** are not visible.
3. Sign in as an auditor account.
4. Confirm commerce-management actions are unavailable.
5. Sign in as an `exam_admin` or `super_admin`.
6. Confirm pricing, coupon, order and payment records are available.
7. Change a price, disable a coupon and cancel a pending order.
8. Confirm corresponding audit-log entries are created.

Expected result: commerce administration is restricted to examination administrators and Super Administrators.

## K. Candidate data isolation

1. Sign in as Candidate A and create an order.
2. Sign out and sign in as Candidate B.
3. Confirm Candidate B cannot see Candidate A's orders, payments, coupon redemptions or examination assignments.
4. Attempt to verify Candidate A's payment reference while signed in as Candidate B.
5. Confirm the request is rejected.

Expected result: RLS and server-side ownership checks prevent cross-candidate access.

## L. Production activation gate

Live activation is approved only when:

- Automated Phase 5 workflow is green.
- Supabase readiness SQL returns PASS for all required checks.
- All test scenarios A through K pass.
- The previously exposed Paystack test secret has been rotated.
- No test coupon remains active unless intentionally retained.
- No stale pending orders remain.
- Live Paystack secret is stored only in Supabase Edge Function secrets.
- Live Paystack webhook is configured and tested.
- A low-value controlled live transaction is completed and reconciled before public launch.

Record the tester, date, transaction reference and outcome for each scenario before approving production use.

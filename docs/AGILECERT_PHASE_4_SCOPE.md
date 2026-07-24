# AgileCert Global Phase 4 — Certificate Payment and Credential Issuance

## Status

Phase 4 is a controlled draft increment on branch:

`phase-4-certificate-payment-credential-issuance`

It must not be merged into `supabase-integration` or deployed without a separate explicit approval.

The frozen `certificate-commerce-v2` branch remains reference-only and must not be merged or deployed.

## Objective

Phase 4 connects the Phase 3 certificate authority to a separate certificate-payment and credential-issuance workflow.

Passing an examination continues to establish eligibility only. New certificate ownership is authorised only by:

1. a verified certificate payment; or
2. an explicit administrator waiver with a recorded reason.

Existing Phase 3 certificates are grandfathered and remain active and verifiable.

## Certificate products and prices

### Certificate of Achievement

| Market | Early price — within seven days | Standard price |
|---|---:|---:|
| Nigeria | NGN 20,000 | NGN 25,000 |
| International | USD 35 | USD 50 |

Includes:

- Digital certificate
- Unique certificate and credential codes
- Public verification
- Achievement badge

### Professional Certificate

| Market | Early price — within seven days | Standard price |
|---|---:|---:|
| Nigeria | NGN 50,000 | NGN 75,000 |
| International | USD 60 | USD 75 |

Its product and prices are visible in Phase 4, but checkout, waiver and issuance remain blocked until the later identity-verification phase is implemented. Phase 4 therefore does not collect payment for an unavailable Professional Certificate.

## Server pricing

- Currency is derived from the candidate profile.
- `preferred_currency` takes precedence.
- Nigeria defaults to NGN; other markets default to USD.
- The seven-day early-price window starts from the authoritative server-recorded passing timestamp.
- The browser cannot submit or override an amount.
- Orders store list amount, discount, payable amount, pricing window and currency in minor units.
- Active orders are idempotent and expire after 30 minutes if payment is not completed.

## Payment security

Certificate payment uses a separate server secret:

`AGILECERT_PAYSTACK_SECRET_KEY`

It is never placed in browser code or committed to the repository.

The certificate-payment Edge Functions:

- authenticate the candidate before checkout or callback verification;
- initialise Paystack from the server-calculated order;
- verify successful status, reference, currency, amount and candidate email;
- accept webhook fulfilment only after HMAC SHA-512 signature validation;
- re-query Paystack before webhook fulfilment;
- use service-role access only inside Edge Functions;
- fulfil an order idempotently.

The existing examination Paystack secret, examination orders, examination payment functions and webhook router remain unchanged.

## Credential issuance

A paid or waived Certificate of Achievement creates:

- the Phase 3 server-issued certificate record;
- a paid credential record;
- a credential code;
- a badge code;
- a public verification URL;
- LinkedIn-ready credential information.

The Professional Certificate additionally supports a transcript code, but its issuance remains blocked until identity verification is available.

Candidate-facing badge SVGs and transcript PDFs are rendered from immutable server-owned credential data. Phase 4 does not create public credential storage buckets or reusable private-file links.

## Public verification

Public verification accepts:

- certificate number;
- certificate verification code;
- paid credential code;
- badge code; and
- transcript code, where present.

The response may show credential type and payment-authorised status. It must not expose:

- payment amount;
- transaction reference;
- candidate email;
- candidate account identifier;
- examination answers;
- proctor logs; or
- private provider payloads.

## Administrator controls

Active `exam_admin` and `super_admin` users may:

- review certificate orders;
- review paid and waived credentials;
- update NGN and USD early and standard prices;
- issue an Achievement credential through a documented waiver;
- review the commerce audit trail.

A waiver reason is mandatory and permanently audited.

Administrators cannot use the legacy Phase 3 issue action to bypass payment. The legacy action now resolves only an existing paid or waived order.

## Candidate experience

The Credential Store provides:

- server-priced certificate offers;
- seven-day pricing countdown;
- separate certificate-fee disclosure;
- secure Paystack checkout;
- payment-return verification;
- order history;
- paid credential register;
- badge download;
- transcript download when included;
- public verification link; and
- verification-link copying.

The Professional Certificate card clearly states that checkout opens only after identity verification is implemented.

## Database unit

Phase 4 contains one migration only:

`supabase/migrations/202607240105_phase_4_certificate_payment_credential_issuance.sql`

It has not been applied to production.

## Edge Function unit

Phase 4 contains exactly three deployable Edge Functions:

- `initialize-certificate-payment`
- `verify-certificate-payment`
- `paystack-certificate-webhook`

It also contains one private shared Paystack helper used only by those functions.

None has been deployed to production.

## Explicit exclusions

Phase 4 does not implement or change:

- examination prices, orders, payments or Paystack functions;
- examination start, submission, grading or results;
- proctoring or proctor-audit workflows;
- preparation-material entitlement or delivery;
- government-ID verification;
- selfie capture, facial matching or biometrics;
- identity-provider integrations;
- email or messaging automation;
- reminder scheduling;
- cross-selling automation;
- AI Certification Adviser;
- refunds or dispute automation;
- public certificate-payment details;
- credential asset storage buckets; or
- the frozen reference branch.

## Acceptance controls

Before Phase 4 can be proposed for merge and deployment, it must pass:

- TypeScript validation;
- production build;
- Deno type-checks for all three Edge Functions;
- exact migration and function scope checks;
- secret and payment-security checks;
- Phase 1 regression validation;
- isolated PostgreSQL behaviour tests;
- read-only production migration dry run; and
- explicit review of all changed files.

No Phase 4 merge or deployment may occur without explicit approval.

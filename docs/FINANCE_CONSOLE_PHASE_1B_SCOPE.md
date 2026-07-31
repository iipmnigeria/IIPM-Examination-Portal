# Finance Console Phase 1B — Certification Products and Fee Administration

## Purpose

Phase 1B centralises the financial administration of the existing AgileCert Certificate of Achievement and Professional Certificate products inside the protected Finance Console.

## Delivered controls

- Dedicated **Certification Fees** Finance Console tab.
- Certificate of Achievement and Professional Certificate product activation.
- NGN and USD pricing markets with country-code routing.
- Early and standard certification fees.
- Three payment treatments:
  - separate certificate payment;
  - included with the applicable examination arrangement;
  - free certification.
- Effective start and end dates for certification pricing.
- Product applicability to:
  - all programmes;
  - selected programmes;
  - selected examinations.
- Certification order and payment visibility.
- Dedicated `finance.certificate_prices.manage` permission.
- Super Administrator permission control and Examination Administrator delegation.
- Immutable finance audit evidence for product, pricing and applicability changes.
- Server-authoritative certification price and applicability resolution.

## Candidate behaviour

- Separate-payment offers continue through the existing Paystack certificate checkout.
- Included or free offers create a no-charge authorised order and issue the eligible credential without sending a zero-value payment to Paystack.
- Professional Certificates still require an approved, unexpired identity-assurance record before checkout or no-charge issuance.
- Inactive products, inactive or expired pricing, unmatched country markets, and non-applicable programmes or examinations do not generate candidate offers.

## Compatibility and exclusions

- Existing paid orders, issued certificates, badges, transcripts and verification codes are unchanged.
- Existing certificate payment verification and Paystack Edge Functions are unchanged.
- Examination checkout, multi-module cart, examination sessions and examination payment authority are unchanged.
- The legacy Certificate Commerce price updater remains available only as a compatibility bridge and now obeys the dedicated Finance Console certification-fee permission.

## Validation requirements

- TypeScript and production build.
- Complete isolated Supabase schema reset.
- Super Administrator, Examination Administrator and candidate permission tests.
- Price mode, market, effective-date and applicability tests.
- Immutable audit verification.
- Candidate order-authority definition checks for separate-payment, included and free modes.
- Explicit confirmation that certificate Paystack functions and examination runtime files remain unchanged.

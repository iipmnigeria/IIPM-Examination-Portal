# Finance Console Phase 1 Production Release

**Release date:** 31 July 2026  
**Status:** Completed and production-verified

## Delivered scope

- Finance Console foundation and administration workspace.
- Examination fee management by examination and currency.
- Effective dates, country routing, default-price and active-price controls.
- Explicit finance permission definitions and Examination Administrator grants.
- Super Administrator-only finance-permission administration.
- Immutable audit evidence for fee and permission changes.
- Server-side RPC and row-level-security enforcement.
- Compatibility bridge preserving existing checkout, cart, coupon and Paystack authority.

## Source and pull requests

- Phase 1 feature: PR #214.
- Production compatibility correction: PR #232.
- Approved production source commit: `0793caab245b0942bc4b779826a60a2f3a977a45`.
- Compatibility merge commit on `supabase-integration`: `8d63470401630a5717823cdeaa4d136e5612ae1e`.
- GitHub Pages publication: PR #235, merge commit `067af8238af7a34856446baf48f40661dd148d80`.

## Database release

Controlled production run: `30619124916`.

Applied migrations:

1. `202607310699_finance_console_legacy_rpc_compatibility.sql`
2. `202607310700_finance_console_pricing_permissions.sql`

Post-deployment verification confirmed:

- 5 active finance permission definitions.
- 4 default Examination Administrator grants.
- 4 protected finance/commerce tables with row-level security.
- 6 legacy Commerce Console bridge functions restored as internal security-definer functions.
- Direct authenticated access to the permission and finance-audit tables denied.
- Direct authenticated execution of the legacy price RPC denied.
- Execution of the approved permission-scoped price RPC allowed.
- Production migration ledger current after deployment.

## Frontend deployment

- Namecheap workflow run: `30619080904` — successful.
- GitHub Pages workflow run: `30620402322` — successful.
- Approved and live JavaScript bundle SHA-256:
  `2448d19df3ad5c88467953005991d69169ebf507c48b8b7365cf02ee0f6228fe`
- The public GitHub Pages bundle matched the approved source byte-for-byte.
- Verified live markers:
  - `Finance Console`
  - `Examination Fees`
  - `get_finance_console_snapshot`
  - `finance_upsert_exam_price`

## Live authority verification

Controlled verification run: `30620643646`.

A production transaction exercised and verified:

- Super Administrator Finance Console authority.
- Examination Administrator permission revocation.
- Examination Administrator permission restoration.
- Examination-fee save lifecycle.
- Immutable finance-audit enforcement.
- Candidate Finance Console denial.
- Legacy price RPC denial.

The complete verification transaction was rolled back. No synthetic user, fee, permission or audit test data was retained.

## Access model accepted

| Role | Finance Console | Examination fees | Coupons/orders | Finance permissions |
|---|---:|---:|---:|---:|
| Super Administrator | Yes | Yes | Yes | Yes |
| Examination Administrator | Yes, subject to grants | Yes, subject to grants | Yes, subject to grants | No |
| Candidate | No | No | No | No |

## Regression boundary

The Phase 1 release did not modify Paystack Edge Functions, candidate cart runtime, payment-return handling or examination-session runtime. Existing candidate purchases and payment authority remain intact.

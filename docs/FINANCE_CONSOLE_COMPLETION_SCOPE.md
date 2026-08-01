# Finance Console Completion Package

## Purpose

This package closes the capabilities that remained partial after Finance Console Phase 1 and Phase 1B. It extends the protected Finance Console without replacing the existing examination checkout, consolidated cart, coupon reservation, Paystack verification or entitlement functions.

## Completed controls

### Examination pricing

- standard and temporary promotional fees;
- effective promotion start and expiry dates;
- paid, free, scholarship and invitation-only access modes;
- candidate scholarship and invitation grants;
- attempts included and retake fees;
- consolidated-cart eligibility;
- active and inactive policy status;
- current-policy enforcement for individual and consolidated orders;
- transaction minimum and maximum enforcement;
- immutable before-and-after audit evidence.

### Coupons

- percentage and fixed discounts;
- multiple selected programme and examination targets;
- minimum purchase value and module count;
- consolidated-cart permission or prohibition;
- total and per-candidate redemption limits;
- maximum-discount caps;
- effective start and expiry dates;
- remaining-redemption and candidate-usage reporting;
- reasoned activation, deactivation and edit audit evidence;
- existing coupon identifiers and redemption history remain intact.

### General settings

- default and supported currencies;
- non-secret Paystack enabled/environment/configuration status;
- tax/VAT status and tax-profile selection;
- receipt and payment-reference prefixes;
- payment-expiry and abandoned-order rules;
- refund, reversal and manual-approval controls;
- bank-transfer instructions;
- transaction minimum and maximum values;
- partial-payment and overpayment settings;
- reasoned immutable setting changes.

### Transactions and reconciliation

- one unified view of individual and consolidated orders;
- gross, discount, payable and paid amounts;
- coupon, candidate, programme, examination and provider details;
- successful, pending, failed, abandoned and expired statuses;
- provisioning status and paid-but-unfulfilled identification;
- controlled Paystack verification through a server-only Edge Function;
- idempotent individual and consolidated access recovery;
- recovery-action queue and audit history;
- downloadable PDF receipts;
- CSV transaction exports with export audit evidence.

### Dashboard and reports

- revenue and discounts by currency;
- revenue by programme and examination;
- coupon performance and remaining redemptions;
- successful, failed and unfulfilled order indicators;
- daily and monthly performance;
- downloadable dashboard exports.

### Permissions

- `finance.settings.manage`;
- `finance.transactions.reconcile`;
- `finance.access.recover`;
- `finance.adjustments.approve`;
- `finance.receipts.manage`;
- `finance.exports.download`;
- `finance.dashboard.view`.

High-impact permissions are not granted to Examination Administrators by default. Super Administrators remain the only role that can delegate finance permissions.

## Security boundaries

- Paystack keys remain server-side and are never returned by a browser RPC.
- Direct authenticated access to the new finance tables is revoked.
- New browser writes use permission-checked security-definer RPCs.
- Manual Paystack verification validates reference, status, currency, amount and candidate email before using the existing fulfilment authority.
- Existing paid orders, issued certificates, assignments, receipts and verification records are not rewritten.
- Existing checkout, consolidated-cart, Paystack webhook and examination-runtime authorities are not replaced.

## Release boundary

This development branch contains source, migration, Edge Function and validation work only. It does not apply the migration to production, deploy the Edge Function or publish the frontend.

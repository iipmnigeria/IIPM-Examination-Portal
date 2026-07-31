# Finance Console Phase 1B Production Release

## Release scope

Finance Console Phase 1B centralises administrative control of the existing Certificate of Achievement and Professional Certificate products.

Production now supports:

- certificate product activation and deactivation;
- NGN and USD early and standard fees;
- separate-payment, included-with-examination and free certification modes;
- country routing and effective dates;
- all-programme, selected-programme and selected-examination applicability;
- certification order and payment visibility;
- the `finance.certificate_prices.manage` permission;
- immutable finance audit evidence;
- protected Professional Certificate identity routing;
- preserved existing paid certificate checkout and issuance authority.

## Approved source

- Phase 1B pull request: #239
- Approved source commit: `1a9d6f44f3423b7757f9a07f809fccf46765fe42`

## Production database release

Controlled workflow run: `30642248708`

Applied migrations:

1. `202607311100_finance_console_certification_products_fees.sql`
2. `202607311101_finance_console_certification_pricing_rules.sql`
3. `202607311102_finance_console_certification_identity_route_hardening.sql`

The pre-deployment dry run showed exactly these three migrations. The post-deployment dry run confirmed that the remote migration ledger was current.

Production verification confirmed:

- three protected certification finance tables;
- row-level security on certification applicability;
- two configured certificate products;
- active certification finance permission;
- protected pricing and applicability RPCs;
- authenticated candidate access only to approved certificate-order functions;
- no browser execution of internal no-charge or legacy bridge functions;
- no direct authenticated access to the applicability table.

All three production lifecycle tests passed inside rolled-back transactions:

- certification fee and permission lifecycle;
- pricing mode and applicability lifecycle;
- Professional Certificate identity route protection.

Production evidence artifact:

- `finance-console-phase1b-production-evidence`
- SHA-256: `eeff2488785746375f5a573c8f159df4057afecc8acba0b39333d29a3cd3f33b`

## Frontend publication

- Namecheap deployment run: `30641552770`
- GitHub Pages deployment run: `30642494788`
- Pages trigger commit: `f142b077ffdaf21aab1f81a4b3b28a8ed32d0bf7`

Approved and live JavaScript bundle:

- Asset: `assets/index-Ba-jbo85.js`
- SHA-256: `7b6dcc2808097391d74684839c06d9ceda78aa66cd27230af8b20ecc6bd91b9c`

The public GitHub Pages bundle matched the approved build byte-for-byte and contained all required Finance Console Phase 1B markers.

## Final live verification

Controlled verifier run: `30642911797`

The verifier confirmed:

- successful authorised GitHub Pages and Namecheap deployment runs;
- exact public bundle identity;
- live Certification Fees workspace markers;
- successful rolled-back certification fee, pricing-rule and identity-route tests.

Verification evidence artifact:

- `finance-console-phase1b-production-verification`
- SHA-256: `fb7963f5c9f7ad2f3cc7ca59f6a5bb073db9bba96f74572823d2f13644ba6c20`

## Safety boundaries

No Paystack Edge Function, examination checkout, multi-module cart, examination runtime, grading, previously issued certificate or verification code was changed by this release.

The production and verification trigger pull requests were closed without merge. The temporary deployment and verification workflows were removed after successful release verification.

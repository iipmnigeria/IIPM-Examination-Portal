# AgileCert Original Roadmap Phase 4 — Credentials, Badges and Candidate Records

## Status

Controlled development increment on branch:

`phase-4-professional-credential-system`

Tracks issue #83. Nothing in this branch may be merged or deployed without isolated migration validation, protected-system regression checks, review and explicit production approval.

## Objective

Complete the original Roadmap Phase 4 professional credential system while preserving the deployed certificate authority, certificate commerce, identity assurance, examination runtime and AI Certification Adviser.

## Existing foundation retained

- Paid and waived credential issuance linked to server-issued certificates
- Unique credential, badge and optional transcript codes
- Public certificate and credential verification
- Candidate certificate-commerce workspace
- Achievement and Professional Certificate products
- Credential status synchronisation with certificate suspension and revocation
- LinkedIn-ready credential name and verification URL
- Certificate-commerce audit trail

## Phase 4 completion scope

### Candidate credential wallet

The wallet consolidates active, suspended, revoked and expired credentials with:

- certificate and credential identifiers;
- programme and examination details;
- issue, validity, expiry and renewal dates;
- effective lifecycle status;
- downloadable badge assertion and badge artwork;
- public verification link;
- candidate-controlled temporary share links;
- LinkedIn Add-to-Profile support;
- renewal and CPD status.

### Digital badges

Each paid or waived credential receives a standards-aligned badge assertion containing:

- credential and badge identifiers;
- issuer identity;
- achievement name and description;
- programme and examination references;
- issue and validity dates;
- public verification URL;
- current lifecycle status.

The implementation will provide downloadable SVG artwork and JSON badge assertion data. It will not claim cryptographic signing or external accreditation that has not been configured.

### Examination history and transcript

The candidate record will consolidate:

- completed and graded examination attempts;
- scores and pass marks;
- result status;
- linked certificates and credentials;
- credential issue and expiry status;
- a formal downloadable transcript generated from server-owned records.

A stable candidate transcript identifier will be created. Public transcript access remains disabled by default and is exposed only through a candidate-controlled share link or an explicitly enabled transcript record.

### Continuing professional development

Candidates may record CPD activities with title, provider, type, completion date, hours and evidence reference. Records pass through draft, submitted, approved, changes-requested or rejected states. Administrator decisions and reasons are audited.

### Expiry and renewal

Credential validity is controlled by programme-and-product policy. The policy supports:

- optional validity period in months;
- renewal-window days;
- required approved CPD hours;
- default share-link validity;
- active/inactive policy state.

No arbitrary expiry will be imposed by default. Existing and new credentials remain non-expiring until an administrator configures a validity period. Renewal requests become available only for credentials governed by an expiring policy.

### Sharing and LinkedIn

Candidates may create revocable, expiring links for either one credential or their consolidated transcript. Public responses remain privacy-bounded.

LinkedIn currently uses a static Add-to-Profile experience and no longer guarantees third-party field prefill. AgileCert will open LinkedIn's official certification form and provide copy-ready credential details beside the action.

### Employer and institutional verification

A public verification workspace will accept certificate, credential, badge, transcript or candidate-created share codes. It may display only approved professional-record fields and must not expose:

- payment amounts or transaction references;
- candidate email or private account identifiers;
- examination answers;
- proctor or identity evidence;
- provider payloads;
- private CPD evidence.

### Audit and administration

Administrators receive controls for:

- validity and renewal policies;
- CPD review;
- renewal decisions;
- credential lifecycle reporting;
- share-link and verification activity;
- transcript and wallet audit history.

## Database units

Five forward-only, sequential migration units are used so each capability can be reviewed and validated independently:

1. `supabase/migrations/202607261200_phase_4_credential_core.sql`
2. `supabase/migrations/202607261201_phase_4_wallet_cpd.sql`
3. `supabase/migrations/202607261202_phase_4_sharing_renewal.sql`
4. `supabase/migrations/202607261203_phase_4_credential_admin.sql`
5. `supabase/migrations/202607261204_phase_4_public_privacy.sql`

All five migration versions are later than the deployed Phase 3 completion migration `202607251800`. They form one controlled Phase 4 release unit and must be applied together in sequence.

## Safety boundaries

Phase 4 completion must not modify:

- examination prices, orders or Paystack functions;
- certificate prices or certificate checkout logic;
- certificate eligibility, approval, QR/PDF, correction or reissuance controls;
- identity-document or identity-review controls;
- examination start, submission, grading, result or proctoring functions;
- AI Adviser functions;
- the existing credential issuance authorisation boundary.

## Acceptance criteria

Phase 4 is complete only when isolated tests prove that:

1. A paid or waived credential appears in one candidate wallet.
2. The badge JSON and SVG are generated from server-owned credential data.
3. Examination history and a consolidated transcript are produced correctly.
4. CPD records can be submitted and independently reviewed.
5. Configured validity dates drive renewal eligibility and effective status.
6. Approved renewal extends validity and preserves renewal history.
7. Share links can be created, verified, counted, expired and revoked.
8. Transcript sharing remains disabled until the candidate enables or shares it.
9. Public verification never returns private payment, identity or examination data.
10. Existing certificate commerce, Phase 3 lifecycle, identity, examination and AI functions remain unchanged and pass regression validation.

# AgileCert Global — Phase 3 Scope

## Objective

Replace the legacy browser-generated certificate authority with server-owned eligibility, controlled issuance, certificate lifecycle management and privacy-bounded public verification, without changing examination payments, examination runtime, preparation-material delivery or future certificate-commerce pricing.

## Phase 3 build unit — Certificate eligibility, issuance and verification

### Authoritative eligibility

- Certificate eligibility is calculated from the authoritative `attempts` record.
- The examination pass mark remains authoritative unless an administrator sets a certificate-policy override.
- Candidate account status, attempt completion status, score and proctor suspicious score are re-evaluated before every request and issuance.
- Passing candidates with cleared integrity are `eligible`.
- Candidate issuance requests move an eligible record to `requested`.
- Flagged, terminated, incomplete, below-pass-mark or inactive-policy results remain `blocked` or `revoked`.
- Existing completed attempts are reconciled into eligibility records when the migration is applied.
- Later changes to an authoritative attempt automatically re-evaluate eligibility and can suspend an active certificate.

### Controlled issuance

- Candidates cannot insert, update or issue certificate records directly.
- Candidates may request certificate issuance only for their own eligible attempt.
- Only active `exam_admin` and `super_admin` accounts may issue a certificate.
- Issuance re-checks the authoritative attempt immediately before creating the certificate.
- A completed candidate legal name is required before issuance.
- Each issued certificate receives:
  - A unique IIPM certificate number
  - A high-entropy verification code
  - The candidate legal name
  - Certificate and examination titles
  - Programme code
  - Authoritative score and pass mark
  - Issue date and issuing administrator
  - Active, suspended or revoked lifecycle status
- One certificate may be issued per eligibility record and attempt.
- Certificate lifecycle changes take effect immediately in public verification.

### Candidate certificate workspace

- Candidates can review eligibility across their completed examinations.
- Eligible candidates can submit an issuance request.
- Requested candidates can see that administrator review is pending.
- Issued certificates show the certificate number, verification code, issue date and current lifecycle status.
- Downloadable certificate PDFs are rendered only from an issued server record.
- Suspended or revoked certificates cannot be downloaded as active credentials.
- The PDF contains a verification code and public verification URL.

### Public verification

- Certificate verification is available before sign-in.
- The public lookup accepts either the certificate number or verification code.
- The response exposes only bounded certificate evidence:
  - Holder name
  - Certificate and examination titles
  - Programme code
  - Score and pass mark
  - Issue date
  - Issuer
  - Current lifecycle status
- Verification does not expose candidate account IDs, email addresses, answers, proctor logs, payment records or private profile fields.
- Active certificates return a valid result.
- Suspended and revoked certificates remain discoverable but return an invalid/restricted status.

### Administrator certificate authority

- Examination administrators and super administrators may:
  - Review eligibility and issuance requests
  - Reconcile completed attempts
  - Issue eligible certificates
  - Activate, suspend or revoke certificates
  - Record a reason for suspension or revocation
  - Configure certificate title, optional pass-mark override, maximum suspicious score and active/inactive policy by examination
- Auditors, candidates and anonymous users cannot access these controls.

### Legacy-certificate security boundary

The existing gradebook contains historical browser-only certificate preview and jsPDF controls. Phase 3 removes their authority by replacing those button event handlers in the rendered candidate dashboard:

- `View Verifiable Certificate` becomes a route to the server-authorised certificate workspace.
- `Download Certificate PDF (jsPDF)` becomes disabled until an issued server record exists.
- The old client-derived certificate number, score threshold and browser PDF cannot create a verifiable certificate record.
- The legacy dashboard itself is not rewritten in this increment, reducing examination-runtime regression risk.

## Database objects

### Tables

- `agilecert_certificate_policies`
- `agilecert_certificate_eligibility_records`
- `agilecert_issued_certificates`

### Candidate functions

- `get_my_agilecert_certificate_workspace()`
- `request_my_agilecert_certificate(uuid)`

### Administrator functions

- `issue_agilecert_certificate(uuid)`
- `set_agilecert_certificate_status(uuid, text, text)`
- `upsert_agilecert_certificate_policy(uuid, text, numeric, numeric, boolean)`
- `reconcile_agilecert_certificate_eligibilities(uuid)`
- `get_agilecert_certificate_admin_console(integer)`

### Public function

- `verify_agilecert_certificate(text)`

### Internal functions and trigger

- `agilecert_is_certificate_admin()`
- `agilecert_require_certificate_admin()`
- `evaluate_agilecert_certificate_eligibility(uuid)`
- `agilecert_sync_certificate_eligibility_from_attempt()`
- `agilecert_certificate_eligibility_attempt_trigger`

## Explicit exclusions from Phase 3

- Certificate prices, product tiers or discount windows
- Certificate orders or certificate-payment initialization
- Paystack certificate payment, callback or webhook functions
- Automatic certificate issuance after payment
- Certificate or transcript storage buckets
- Pre-generated PDF assets or permanent certificate URLs
- Digital badges
- Formal examination transcripts
- LinkedIn credential publishing
- Public candidate profiles
- Government-ID, selfie, facial recognition or biometric verification
- Identity-provider integration
- Automated email, SMS or WhatsApp reminders
- AI Certification Adviser
- Changes to examination catalogue, start, submission, grading or result logic
- Changes to exam pricing, exam orders or examination payment verification
- Changes to preparation-material entitlement, upload or secure delivery
- Changes to proctor-audit review workflow

## Production-safety rules

- Base branch: `supabase-integration`
- Current development branch: `phase-3-certificate-eligibility-issuance-verification`
- Frozen reference only: `certificate-commerce-v2`
- The frozen reference branch and pull request must not be merged or deployed.
- Only migration `202607240104_phase_3_certificate_eligibility_issuance_verification.sql` is permitted in this increment.
- No Supabase Edge Function is permitted in this increment.
- No service-role credential may appear in frontend or committed configuration.
- Candidate and public functions must not return candidate IDs, email addresses, answers or proctor logs.
- Certificate issuance and lifecycle changes must remain restricted to active `exam_admin` and `super_admin` roles.
- The public verification function may be executable by anonymous and authenticated roles but must expose only bounded certificate evidence.
- Existing Phase 1 and Phase 2 candidate, payment, examination, auditor and material-delivery journeys must remain operational.
- No Phase 3 merge or deployment may occur without explicit approval.

## Phase 3 acceptance checks

1. Candidate registration and sign-in remain unchanged.
2. The public landing page remains non-blank and renders AgileCert Global content.
3. Existing examination catalogue, payment, start, submit and result flows remain unchanged.
4. Existing preparation-material catalogue, administration and secure delivery remain unchanged.
5. Auditors retain the existing proctor-audit interface.
6. Certificate eligibility is derived from authoritative attempts, not browser state.
7. The applicable examination pass mark is used unless a certificate-policy override exists.
8. Submitted, passing and integrity-cleared attempts become eligible.
9. Below-pass-mark, flagged, terminated and incomplete attempts cannot be issued.
10. Candidates can see only their own eligibility and certificate records.
11. Candidates can request issuance but cannot issue certificates.
12. Only active examination administrators and super administrators can issue certificates.
13. Issuance re-evaluates eligibility immediately before writing the certificate.
14. Legal candidate name is required for issuance.
15. Certificate numbers and verification codes are unique.
16. One certificate is issued per attempt and eligibility record.
17. Active, suspended and revoked lifecycle statuses are supported.
18. Suspended and revoked certificates do not verify as valid.
19. Anonymous users can verify a certificate number or verification code.
20. Public verification does not disclose candidate ID, email, answers, proctor logs or payment information.
21. Candidate PDF generation requires an issued server certificate record.
22. Legacy browser-generated certificate buttons cannot create or download an authoritative certificate.
23. Certificate pricing, orders, Paystack and certificate-payment code are absent.
24. Identity verification, badges, transcripts, LinkedIn, communications and AI functions are absent.
25. No Edge Function or service-role frontend credential is added.
26. Row-level security and function grants restrict private certificate data.
27. TypeScript validation passes.
28. Production build passes.
29. Phase 1 regression validation remains green.
30. Phase 2 validation is not incorrectly applied to the Phase 3 branch.

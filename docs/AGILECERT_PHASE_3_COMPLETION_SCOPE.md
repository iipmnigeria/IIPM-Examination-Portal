# AgileCert Global — Original Roadmap Phase 3 Completion

## Objective

Close the remaining gaps in the original Phase 3 — Certificate Eligibility, Issuance and Verification — while preserving the deployed Phase 3 certificate authority, Phase 4 certificate commerce, Phase 5 identity assurance, examination runtime, preparation materials and AI Adviser.

## Existing production foundation retained

- Authoritative eligibility from completed examination attempts
- Configurable pass-mark override and proctor-integrity threshold
- Candidate certificate request
- Payment- or waiver-authorised certificate issuance
- Administrator issuance after verified payment or waiver
- Unique certificate numbers and verification codes
- Active, suspended and revoked certificate lifecycle
- Candidate certificate workspace and downloadable PDF
- Public verification by certificate number or verification code
- Paid credential, badge, transcript and LinkedIn-ready records

## Completion capabilities

### 1. Approval workflow

- Each examination policy may use `automatic` or `manual` approval mode.
- Automatic mode preserves the current paid/waived fulfilment behaviour.
- Manual mode requires an approved request before a certificate can be inserted.
- Candidate requests become `pending` for manual review.
- Examination administrators and super administrators may approve, reject or request changes.
- Rejection and changes-requested decisions require a reason.
- Every decision is immutable and audited.

### 2. Programme certificate templates

- Templates are versioned by programme and certificate product.
- One active template may exist for each programme/product combination.
- Template configuration includes certificate title, issuer, subtitle, signatory names and titles, primary/accent colours and extensible layout metadata.
- Existing programmes receive default Achievement and Professional templates.
- Issued certificates retain the template ID and version used at issuance.

### 3. Correction and reissuance

- Administrators may correct a holder name or certificate title and reissue the certificate.
- A clear correction reason is mandatory.
- The previous immutable certificate snapshot is stored as a superseded revision.
- The current certificate receives a new certificate number and verification code.
- Existing paid credential and verification links are updated to the current certificate.
- Previous numbers and codes remain publicly discoverable as superseded, but are never valid active credentials.

### 4. QR-coded PDF rendering

- Candidate PDF rendering uses the immutable server certificate and template payload.
- A real QR code encodes the public verification URL.
- PDF-render requests are recorded in the certificate audit trail.
- Suspended or revoked certificates remain non-downloadable as active credentials.

### 5. Lifecycle and verification audit

- Audit events cover request, decision, issuance, status change, correction, reissuance, PDF rendering and public verification.
- Anonymous lookup codes are stored only as SHA-256 hashes in the audit trail.
- Administrators may inspect recent decisions, revisions and audit events.
- Candidate IDs, emails, payment references, answers and proctor logs remain excluded from anonymous verification responses.

## Database unit

One forward-only migration:

`supabase/migrations/202607251800_phase_3_certificate_completion.sql`

The timestamp follows the separate CIPMN mock-examination migration range `202607251701`–`202607251713` and must not modify those files.

## Frontend unit

- `src/services/certificateCompletionService.ts`
- `src/components/AdminCertificateCompletionLauncher.tsx`
- `src/components/AdminCertificateCompletionPanel.tsx`
- `src/services/certificatePdfService.ts`
- Focused integration into `src/main.tsx` and the existing candidate certificate download control
- `qrcode` browser dependency for standards-compliant QR generation

## Explicit exclusions

- Examination question banks, grading, results, timing or proctoring
- Examination or certificate price changes
- Paystack initialisation, callback or webhook changes
- Refunds or disputes
- Government ID, selfie, facial matching or biometrics
- Digital-badge redesign, transcript redesign or LinkedIn API publishing
- Email, SMS or WhatsApp automation
- AI Adviser changes
- CIPMN mock-examination migrations or branch

## Acceptance criteria

1. Existing automatic paid/waived issuance continues to work under automatic policies.
2. Manual policies block certificate insertion until an administrator approves the request.
3. Rejected and changes-requested decisions retain reasons and audit records.
4. Active templates are unique by programme and certificate product.
5. Issued certificates retain template identity and version.
6. Certificate correction archives the previous immutable snapshot.
7. Reissue generates a new certificate number and verification code.
8. Old certificate numbers verify as superseded and invalid.
9. Current certificate numbers verify as active when lifecycle status is active.
10. Paid credential records remain linked to the reissued certificate.
11. Candidate PDF contains a real QR code pointing to public verification.
12. PDF rendering and public lookups create audit records.
13. Anonymous verification remains privacy-bounded.
14. TypeScript validation and production build pass.
15. Isolated Supabase reset and behaviour tests pass.
16. Existing Phase 3, Phase 4, Phase 5 and AI Adviser regressions remain green.
17. No production deployment occurs until the completion PR is reviewed and explicitly approved.

## Validation trigger

The completed source is validated from an authorised branch commit so GitHub Actions can run the full migration, regression and frontend suites without recursive workflow suppression.

The final validation uses the corrected PostgreSQL template-backfill query and schema-qualified pgcrypto functions from the current branch head.

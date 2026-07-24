# AgileCert Global Phase 5 — Identity Verification and Professional Certificate Release

## Status

Phase 5 is a controlled development increment on branch:

`phase-5-identity-verification-professional-credential`

It must not be merged into `supabase-integration` or deployed without a separate explicit approval.

## Objective

Phase 5 introduces a privacy-first, administrator-reviewed identity-verification workflow and uses an approved verification record to unlock Professional Certificate checkout, waiver and issuance.

The phase preserves all existing registration, authentication, examination, examination-payment, grading, result, proctoring, material-delivery, Certificate of Achievement and public-verification behaviour.

## Verification model

The candidate provides:

- the legal name already held in the candidate profile;
- the existing private profile photograph;
- one private supporting professional document;
- a declaration that the information is accurate and belongs to the candidate.

Accepted supporting-document categories are:

- professional membership card or licence;
- employer identity card;
- qualification or training certificate; or
- another administrator-approved professional document.

Phase 5 does not request or process:

- government identity documents;
- passports, national identity numbers or driving licences;
- selfie capture;
- facial recognition or image matching;
- biometric templates;
- external identity-provider checks; or
- automated identity scoring.

## Candidate workflow

Candidates may:

1. review the legal name and profile-photo requirements;
2. upload one private supporting document;
3. select the evidence category;
4. submit an identity-verification request with a mandatory declaration;
5. view pending, approved, rejected or resubmission-required status;
6. replace evidence only when no review is in progress or when resubmission is requested; and
7. proceed to Professional Certificate checkout only after approval.

## Administrator workflow

Active `exam_admin` and `super_admin` users may:

- review submitted requests and private evidence through short-lived signed URLs;
- approve a request;
- reject a request with a mandatory reason;
- request resubmission with a mandatory reason;
- view verification history and audit records; and
- revoke an approved verification with a mandatory reason.

Administrators cannot silently approve, reject or revoke a verification. Every decision is permanently audited.

## Data protection

- Evidence is stored in a private Supabase Storage bucket.
- Candidate and administrator access is mediated by authenticated policies and short-lived signed URLs.
- Evidence paths are deterministic and candidate-scoped.
- Public certificate verification never exposes identity evidence, review notes, private candidate identifiers or evidence URLs.
- Verification approval stores a server-owned snapshot of the approved legal name and evidence category.

## Professional Certificate release

A Professional Certificate offer becomes available only when the candidate has an active approved verification.

Server controls enforce this rule in:

- the candidate certificate-commerce workspace;
- certificate-order creation;
- administrator waiver; and
- paid credential fulfilment.

The browser cannot override identity status.

An approved Professional Certificate creates the existing Phase 4 outputs:

- Professional Certificate;
- enhanced badge;
- transcript code and PDF;
- public verification URL; and
- LinkedIn-ready credential information.

## Database unit

Phase 5 uses one additive migration:

`supabase/migrations/202607250101_phase_5_identity_verification_professional_credential.sql`

The migration creates identity-verification records, audit records, private evidence storage and reviewed RPCs, then safely updates only the Phase 4 certificate-commerce functions needed to enforce approved identity verification.

## Frontend unit

Phase 5 adds:

- candidate Identity Verification Centre;
- administrator Identity Review Console;
- identity-verification service; and
- Professional Certificate status guidance inside the Credential Store.

## Explicit exclusions

Phase 5 does not implement or change:

- government-ID verification;
- selfie capture or liveness checks;
- facial recognition, biometrics or automated image comparison;
- external identity-provider integration;
- examination registration, runtime, grading, results or proctoring;
- examination-payment pricing, orders, functions or webhooks;
- preparation-material entitlement or delivery;
- email, SMS or WhatsApp automation;
- refund or dispute automation;
- AI Certification Adviser; or
- the frozen `certificate-commerce-v2` branch.

## Acceptance controls

Before Phase 5 may be proposed for merge and deployment, it must pass:

- TypeScript validation;
- production build;
- exact migration and changed-file scope review;
- candidate and administrator access-control checks;
- private-storage policy checks;
- professional checkout and waiver gating tests;
- Phase 1–4 regression validation;
- isolated PostgreSQL behaviour tests;
- read-only production migration dry run; and
- explicit review of all changed files.

No Phase 5 merge or deployment may occur without separate explicit approval.

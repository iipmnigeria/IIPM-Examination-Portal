# AgileCert Global Phase 5 — Identity Assurance and Professional Certificate Enablement

## Status

Phase 5 is a controlled development increment on branch:

`phase-5-identity-assurance-professional-certificate`

It must not be merged into `supabase-integration` or deployed without a separate explicit approval.

The frozen `certificate-commerce-v2` branch remains reference-only and must not be merged or deployed.

## Objective

Phase 5 introduces an IIPM-administered identity-assurance workflow and uses an approved verification record to unlock Professional Certificate checkout, payment-authorised issuance, badge generation, transcript generation and public professional credential verification.

The workflow is intentionally manual and privacy-bounded. It does not use automated facial recognition, biometrics, government-ID validation services or external identity providers.

## Identity-assurance model

A candidate may create one active verification submission containing:

- confirmed legal name from the existing candidate profile;
- current phone and country;
- professional or institutional affiliation details;
- one private supporting evidence file;
- an accuracy and consent attestation; and
- optional reviewer-facing notes.

Permitted evidence categories are limited to:

- professional membership card or licence;
- employer confirmation letter;
- educational or training credential;
- institutional identity card; or
- other non-government professional evidence approved by IIPM.

The candidate interface must clearly instruct users not to upload passports, national identity cards, driving licences, voter cards, selfies or biometric material in this phase.

## Verification lifecycle

A submission may move through:

- `draft`;
- `submitted`;
- `under_review`;
- `changes_requested`;
- `approved`;
- `rejected`;
- `withdrawn`; or
- `expired`.

Only active `exam_admin` and `super_admin` users may review a submitted record.

Every decision requires a recorded reason or review note. Approval records the reviewer, approval timestamp, verified legal-name snapshot and evidence category. Candidate edits to legal name, phone or country after approval automatically expire the approval and require a new submission.

Identity changes and withdrawal are blocked while a non-expired Professional Certificate payment is active, preventing a verified payment from becoming detached from its approved identity record.

## Private evidence storage

Phase 5 uses a private Supabase Storage bucket dedicated to identity evidence.

Controls must include:

- no public bucket access;
- candidate uploads restricted to their own user path;
- candidate access restricted to their own current submission files;
- administrator access restricted to active authorised roles;
- short-lived signed downloads only;
- file-type and size validation;
- no reusable public URLs; and
- permanent audit entries for submission, replacement, withdrawal, review and decision events.

## Professional Certificate unlock

Professional Certificate checkout becomes available only when all of the following are true:

1. the candidate has an active approved identity-assurance record;
2. the verified legal-name snapshot matches the current certificate holder name;
3. the examination eligibility record remains eligible and integrity-cleared;
4. the Professional Certificate product and market price remain active; and
5. no active or fulfilled Professional Certificate order already exists for the eligibility record.

The browser may display the verification status, but the server remains authoritative.

The certificate-payment Edge Function must enforce approved identity status before creating or initialising a Professional Certificate order.

The order stores the exact approved identity-verification identifier, verified name and approval timestamp used at checkout.

## Professional credential issuance

Before issuing a Professional Certificate, the server must re-check the same approved identity-assurance record captured on the order. A different or expired approval cannot silently replace it.

The immutable credential metadata must include:

- identity-verification record identifier;
- verified legal-name snapshot;
- approval timestamp;
- reviewer identifier;
- evidence category; and
- verification method `manual_iipm_review`.

Public verification may state that identity was manually verified by IIPM, but must not expose the evidence file, reviewer notes, phone number, email address, internal user identifier or private document metadata.

## Candidate experience

The candidate workspace provides:

- identity-verification status and progress;
- legal-name and professional-affiliation confirmation;
- private evidence upload;
- submission and withdrawal controls;
- reviewer feedback and change requests;
- approval confirmation;
- Professional Certificate unlock status; and
- a direct return to the Credential Store after approval.

## Administrator experience

The administrator console provides:

- pending and in-review queues;
- candidate profile and legal-name snapshot;
- private evidence inspection through short-lived signed access;
- approve, reject and request-changes actions;
- mandatory review notes;
- decision history;
- status, reviewer and date filters; and
- an immutable identity-assurance audit trail.

## Database and function boundaries

Phase 5 uses two numbered migrations because validation identified a lifecycle and payment-binding hardening unit that is safer to review independently:

1. `202607250101_phase_5_identity_assurance_professional_certificate.sql` — identity submissions, private storage, manual review, Professional Certificate order creation and identity-aware fulfilment;
2. `202607250102_phase_5_identity_assurance_hardening.sql` — profile-change invalidation, active-payment withdrawal guards and exact identity-record binding at issuance.

Phase 5 may add:

- identity-verification submissions;
- identity evidence metadata;
- review decisions and audit records;
- candidate and administrator RPCs;
- a private storage bucket and storage policies;
- server checks that unlock Professional Certificate order creation; and
- issuance checks and identity snapshots for Professional Credentials.

## Explicit exclusions

Phase 5 does not implement or change:

- passports, national identity cards, driving licences, voter cards or other government-ID collection;
- selfie capture;
- facial comparison;
- fingerprint, voiceprint or other biometric processing;
- third-party KYC or identity-provider integrations;
- automated identity scoring;
- examination registration, start, submission, grading or results;
- examination fees or examination Paystack functions;
- preparation-material entitlement or delivery;
- email, SMS or WhatsApp automation;
- refunds or disputes;
- AI Certification Adviser;
- cross-selling automation; or
- the frozen reference branch.

## Acceptance controls

Before Phase 5 can be proposed for merge and deployment, it must pass:

- TypeScript validation;
- production build;
- exact two-migration and file-scope review;
- isolated PostgreSQL behaviour tests;
- storage-policy and private-file access tests;
- candidate isolation tests;
- administrator authorisation tests;
- approval invalidation and resubmission tests;
- active-payment profile-change and withdrawal-guard tests;
- Professional Certificate checkout lock/unlock tests;
- exact order-to-identity issuance-binding tests;
- payment and issuance regression tests;
- Phase 1 through Phase 4 regression validation;
- read-only production migration dry run; and
- explicit review of every changed file.

No Phase 5 merge or deployment may occur without separate explicit approval.

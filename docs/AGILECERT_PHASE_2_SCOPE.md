# AgileCert Global — Phase 2 Scope

## Objective

Build the candidate profile and preparation-material experience progressively without disturbing the accepted Phase 1 public entry, authentication, examination, payment, result or administration journeys.

## Delivery increments

### Phase 2.1 — Candidate profile foundation — completed and deployed

- Candidate-owned profile/settings table
- Authenticated profile read and save service
- Candidate profile and communication-settings screen
- Profile completion indicator
- Password-reset access through the existing Supabase Auth flow
- Row-level security and server-controlled profile upsert

### Phase 2.2A — Private candidate profile photo — completed and deployed

- Dedicated private profile-photo bucket
- JPEG, PNG and WebP allow-list
- 3 MB server-side bucket limit
- One deterministic object path per candidate
- Candidate-only storage policies for select, upload, replacement and deletion
- Server-controlled photo-path linkage bound to `auth.uid()`
- Authenticated temporary signed-image display
- Candidate upload, replacement and removal service
- Clear separation from future identity verification

### Phase 2.2B — Profile-page and header-avatar integration — completed and deployed

- Reusable signed candidate-avatar component
- Authenticated header avatar with initials fallback
- Header avatar opens the candidate Profile & Settings page
- Inline profile-photo editor within the candidate profile route
- Automatic avatar refresh after photo changes
- Signed-image URL renewal during long authenticated sessions
- Responsive candidate identity treatment for mobile and desktop
- Temporary floating photo launcher removed

### Phase 2.3A — Preparation-material catalogue and entitlement foundation — current build unit

- Logical preparation-material records
- Separate versioned storage-metadata records
- Examination-to-material mapping with order and availability controls
- Candidate entitlement records derived from authoritative server data
- Verified paid-order, waived-order and administrator-assignment sources
- Successful `exam_payments` confirmation for paid-order entitlements
- Locked, scheduled, available, expired and revoked candidate states
- Candidate Preparation Materials workspace and grouped examination library
- No candidate-facing storage bucket, storage path, signed URL or download function

### Phase 2.3B — Administrator material publication and mapping tools — next increment

- Staff catalogue management interface
- Material version publication and retirement controls
- Examination mapping and ordering interface
- Availability-window management
- Entitlement reconciliation and administrator review

### Phase 2.4 — Secure material delivery and audit

- Authorised material-download function
- Candidate-specific access checks
- Temporary signed file links
- Download audit records
- Copyright notice and future watermarking hooks

## Phase 2.3A scope controls

Phase 2.3A establishes authoritative records and entitlement states but deliberately stops before file delivery. Storage metadata is retained only for later server-side delivery. Candidate RPC responses contain the material title, type, version label, file name, MIME type, size and access state, but never expose the storage bucket, storage path or checksum.

A paid-order entitlement is valid only when all of the following are true:

1. The candidate has an examination assignment.
2. The related `exam_orders` record has status `paid` and a non-null `fulfilled_at` value.
3. A successful `exam_payments` record is present for the fulfilled order.
4. The payment amount and currency match the fulfilled order.

A waived order must have status `waived` and a non-null `fulfilled_at` value. Administrator assignments are recognised only when `exam_assignments.assigned_by` is present. Client-side payment flags are never used as entitlement evidence.

Entitlements are refreshed when assignments, orders, payments, examination mappings, material publication states or published material versions change. Removing a mapping, retiring the only published version, refunding a payment, revoking an assignment or expiring an assignment removes active candidate access.

## Explicit exclusions from Phase 2.3A

- Candidate material download links
- Public or signed storage URLs
- Direct candidate access to storage bucket or path fields
- Download audit records
- Material watermarking
- Staff material-management interface
- Government-ID or selfie verification
- Facial recognition or biometric comparison
- Certificate eligibility, pricing, payment or issuance changes
- Credential, badge, transcript or LinkedIn functions
- Automated reminder campaigns
- AI Certification Adviser
- New Supabase Edge Functions
- Changes to Paystack initialization or verification functions
- Changes to examination start, submission, grading or result logic

## Production-safety rules

- Base branch: `supabase-integration`
- Current development branch: `phase-2-3a-material-entitlements`
- Frozen reference only: `certificate-commerce-v2`
- Do not merge or deploy the frozen reference pull request.
- Only migration `202607240101_phase_2_3a_preparation_material_entitlements.sql` is permitted in this increment.
- The migration must reuse existing `exam_assignments`, `exam_orders` and `exam_payments` authority.
- No secret or service-role credential may be added to frontend code.
- Storage bucket and path values must remain absent from candidate RPC output.
- Existing candidate and staff journeys must remain operational.

## Phase 2.3A acceptance checks

1. Candidate registration and sign-in remain unchanged.
2. The public landing page remains non-blank and renders AgileCert Global content.
3. Existing examination catalogue, payment, start, submit and result flows remain unchanged.
4. Logical material records and material-version records are separate.
5. Examination mappings support ordering, required status and availability windows.
6. Paid entitlement requires a fulfilled paid order and matching successful payment.
7. Waived entitlement requires a fulfilled waived order.
8. Administrator assignment entitlement requires a non-null assigning administrator.
9. Candidates cannot write entitlement records directly.
10. Candidates can view only their own entitlement rows.
11. Candidate material metadata never contains storage bucket, storage path or checksum.
12. Candidate library displays locked, scheduled, available, expired and revoked states.
13. The interface clearly states that secure delivery activates in Phase 2.4.
14. No download function, signed material URL or Edge Function is introduced.
15. No certificate, credential, identity-verification or AI-adviser object is introduced.
16. TypeScript validation passes.
17. Production build passes.
18. The Phase 1 regression validation remains green.

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

### Phase 2.3A — Preparation-material catalogue and entitlement foundation — completed and deployed

- Logical preparation-material records
- Separate versioned storage-metadata records
- Examination-to-material mapping with order and availability controls
- Candidate entitlement records derived from authoritative server data
- Verified paid-order, waived-order and administrator-assignment sources
- Successful `exam_payments` confirmation for paid-order entitlements
- Locked, scheduled, available, expired and revoked candidate states
- Candidate Preparation Materials workspace and grouped examination library
- No candidate-facing storage bucket, storage path, signed URL or download function

### Phase 2.3B — Administrator material publication and mapping tools — completed and deployed

- Examination-administrator and super-administrator access only
- Administrator catalogue summary and entitlement statistics
- Logical material creation and editing
- Private material-version metadata registration
- One-current-version publication and retirement control
- Examination mapping, ordering, required/optional and active/inactive controls
- Availability and expiry-window management
- Entitlement reconciliation for one examination or the full catalogue
- Automatic creator and update timestamp stamping
- Unique material-version numbers and unique private storage object paths
- Existing proctor-audit screen preserved without modification

### Phase 2.4 — Secure material delivery and audit — current build unit

- Dedicated private preparation-material storage bucket
- Administrator-only upload, replacement, read and deletion policies
- Actual private file upload with MIME, size and SHA-256 metadata
- Publication blocked when the referenced private object is missing
- Service-role-only candidate download authorisation
- Fresh candidate, assignment, payment, mapping, publication and access-window checks
- Internal 60-second signed storage URL
- Edge Function file streaming without exposing storage metadata to the browser
- Requested, delivered, denied and failed download audit records
- Candidate secure-download controls and copyright notice
- Administrator recent-download audit reporting
- Future watermarking hooks without implementing document transformation

## Phase 2.4 security model

Candidates have no direct `storage.objects` policy for the preparation-material bucket. Examination administrators and super administrators may upload and manage private objects only while their accounts remain active.

The browser calls `agilecert-material-delivery` with the candidate access token and safe examination/material identifiers. The Edge Function verifies the token, then uses the service role to call `authorize_agilecert_material_download`. That database function is not executable by anonymous or authenticated browser roles.

The service-only authorisation function refreshes the authoritative material entitlement and checks:

1. Active candidate account
2. Existing examination and material
3. Active examination mapping
4. Published examination and material
5. Mapping availability and expiry windows
6. A published private file version
7. Active candidate entitlement derived from verified payment, waiver or administrator assignment
8. Candidate entitlement availability and expiry windows

Only the Edge Function receives the private bucket and object path. It creates a short-lived signed storage URL internally, retrieves the object and streams it to the browser as an attachment. The signed storage URL and private object path are never returned in candidate JSON or shown in the candidate interface.

Every valid request creates an audit record. Delivery completion updates that record to `delivered` or `failed`; access refusals are recorded as `denied` with a bounded failure code. Raw IP addresses are not stored in this phase.

## Phase 2.4 upload controls

- Bucket: `agilecert-preparation-materials`
- Private/public flag: private
- Maximum object size: 250 MB
- Accepted files: PDF, Word, PowerPoint, Excel, text, CSV, ZIP and MP4
- Object names are generated from the material UUID, a random UUID and a sanitised file name
- SHA-256 checksum is calculated before metadata registration
- Failed metadata writes remove the newly uploaded object
- Replacing a draft version removes the superseded private object after a successful metadata update
- Published versions must be retired before file replacement
- Publishing verifies the storage object exists in the dedicated private bucket

## Explicit exclusions from Phase 2.4

- Candidate direct storage policies
- Candidate-facing bucket or object-path values
- Public material URLs
- Signed URLs returned directly to the candidate browser
- Permanent or reusable download links
- Actual PDF or Office-document watermark transformation
- Government-ID or selfie verification
- Facial recognition or biometric comparison
- Certificate eligibility, pricing, payment or issuance changes
- Credential, badge, transcript or LinkedIn functions
- Automated reminder campaigns
- AI Certification Adviser
- Changes to Paystack initialization or verification functions
- Changes to examination start, submission, grading or result logic
- Changes to the existing proctor-audit workflow

## Production-safety rules

- Base branch: `supabase-integration`
- Current development branch: `phase-2-4-secure-material-delivery`
- Frozen reference only: `certificate-commerce-v2`
- Do not merge or deploy the frozen reference pull request.
- Only migration `202607240103_phase_2_4_secure_material_delivery.sql` is permitted in this increment.
- The migration must build on deployed migrations `202607230101`, `202607230102`, `202607240101` and `202607240102`.
- The only new Edge Function permitted is `supabase/functions/agilecert-material-delivery/index.ts`.
- No service-role credential may be added to frontend code.
- The service-role key may be read only from the managed Edge Function environment.
- Candidate catalogue RPC output must remain free of storage bucket, storage path and checksum values.
- Material storage management must be restricted to active `exam_admin` and `super_admin` roles.
- Download authorisation metadata must remain service-role only.
- Existing candidate, auditor, payment and examination journeys must remain operational.
- No Phase 2.4 merge or deployment may occur without explicit approval.

## Phase 2.4 acceptance checks

1. Candidate registration and sign-in remain unchanged.
2. The public landing page remains non-blank and renders AgileCert Global content.
3. Existing examination catalogue, payment, start, submit and result flows remain unchanged.
4. Auditors retain the existing proctor-audit interface.
5. Candidates and auditors do not see administrator upload controls.
6. Active examination administrators and super administrators can upload allowed private files.
7. Unsupported or oversized files are rejected.
8. Uploaded objects use the dedicated private bucket and generated object paths.
9. SHA-256 metadata is stored with the version record.
10. Published versions cannot reference a missing private object.
11. Candidates have no direct preparation-material storage policy.
12. The candidate catalogue RPC still omits storage bucket, path and checksum.
13. Available candidates can request a secure download.
14. Locked, scheduled, expired and revoked candidates cannot download.
15. Download authorisation is executable only by the service role.
16. The Edge Function authenticates the candidate before authorisation.
17. The internal signed URL expires within 120 seconds and is not returned to the browser.
18. The Edge Function streams the file with `no-store` and attachment headers.
19. Requested, delivered, denied and failed outcomes are audited.
20. Administrators can review recent audit records.
21. Copyright and future-watermarking notices are present.
22. No service-role secret appears in frontend or committed configuration.
23. TypeScript validation passes.
24. Production build passes.
25. The Phase 1 regression validation remains green.

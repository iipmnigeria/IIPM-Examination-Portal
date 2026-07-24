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

### Phase 2.3B — Administrator material publication and mapping tools — current build unit

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

### Phase 2.4 — Secure material delivery and audit — next increment

- Authorised material-download function
- Candidate-specific access checks
- Temporary signed file links
- Download audit records
- Copyright notice and future watermarking hooks

## Phase 2.3B scope controls

Phase 2.3B gives active `exam_admin` and `super_admin` accounts a dedicated preparation-material management workspace. Auditor and candidate accounts must not see the launcher and cannot execute the administrator RPCs.

Logical material records and private version metadata remain separate. New versions are created as drafts. Publishing a version retires any previously published version for the same material and publishes the logical material. Retiring the final published version returns the logical material to draft status.

Administrator writes continue to use the Phase 2.3A row-level security policies. Database triggers stamp `created_by`, `created_at` and `updated_at`, while trusted server/database operations without an end-user UID remain possible for later controlled delivery workflows.

The administrator console may display private storage bucket, path and checksum metadata because it is restricted to authorised examination administrators. The candidate RPC remains unchanged and never returns those fields.

Entitlement reconciliation reuses `refresh_agilecert_material_entitlements` and the authoritative Phase 2.3A payment chain. It does not create access from client-side flags and does not change Paystack initialization or verification.

## Explicit exclusions from Phase 2.3B

- Candidate material download links
- Signed material URLs
- Candidate-facing storage bucket, storage path or checksum
- Actual file upload or storage-object creation
- Download audit records
- Material watermarking
- New Supabase Edge Functions
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
- Current development branch: `phase-2-3b-material-admin-tools`
- Frozen reference only: `certificate-commerce-v2`
- Do not merge or deploy the frozen reference pull request.
- Only migration `202607240102_phase_2_3b_material_admin_tools.sql` is permitted in this increment.
- The migration must build on deployed migrations `202607230101`, `202607230102` and `202607240101`.
- No secret or service-role credential may be added to frontend code.
- Candidate RPC output must remain free of storage bucket, path and checksum values.
- Material management must be restricted to `exam_admin` and `super_admin` roles.
- Existing candidate, auditor and examination-commerce journeys must remain operational.

## Phase 2.3B acceptance checks

1. Candidate registration and sign-in remain unchanged.
2. The public landing page remains non-blank and renders AgileCert Global content.
3. Existing examination catalogue, payment, start, submit and result flows remain unchanged.
4. Auditors retain the existing proctor-audit interface.
5. Candidates and auditors do not see the Material Management launcher.
6. Active examination administrators and super administrators can open the management workspace.
7. Administrators can create and edit logical material records.
8. Administrators can register draft private version metadata.
9. Material version number is unique within each logical material.
10. Private storage bucket and path pairs are unique.
11. Publishing a version retires any previously published version for that material.
12. Retiring the final published version returns the logical material to draft.
13. Administrators can map materials to examinations with position, required status and availability windows.
14. Mapping changes continue to refresh candidate entitlements.
15. Administrators can reconcile one examination or the full entitlement catalogue.
16. Candidate material metadata never contains storage bucket, storage path or checksum.
17. No candidate download function, signed material URL or Edge Function is introduced.
18. No payment, certificate, credential, identity-verification or AI-adviser function is introduced.
19. TypeScript validation passes.
20. Production build passes.
21. The Phase 1 regression validation remains green.

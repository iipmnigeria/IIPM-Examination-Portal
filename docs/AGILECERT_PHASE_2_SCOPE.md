# AgileCert Global — Phase 2 Scope

## Objective

Build the candidate profile and preparation-material experience progressively without disturbing the accepted Phase 1 public entry, authentication, examination, payment, result or administration journeys.

## Delivery increments

### Phase 2.1 — Candidate profile foundation — completed

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

### Phase 2.2B — Profile-page and header-avatar integration — current build unit

- Reusable signed candidate-avatar component
- Authenticated header avatar with initials fallback
- Header avatar opens the candidate Profile & Settings page
- Inline profile-photo editor within the candidate profile route
- Upload, replace and remove controls moved out of the temporary floating launcher
- Automatic avatar refresh after photo changes
- Signed-image URL renewal during long authenticated sessions
- Responsive candidate identity treatment for mobile and desktop
- Keyboard-accessible buttons and descriptive labels
- No database migration or storage-policy change

### Phase 2.3 — Preparation-material records and entitlements — next increment

- Examination-to-material mapping
- Payment-verified candidate entitlements
- Locked and available material states
- Secure storage metadata and material versions

### Phase 2.4 — Secure material delivery and audit

- Authorised material-download function
- Candidate-specific access checks
- Download audit records
- Copyright notice and future watermarking hooks

## Phase 2.2B scope controls

Phase 2.2B is a frontend integration increment only. It reuses the private storage bucket, deterministic candidate object path, profile linkage and signed-image service deployed in Phase 2.2A.

The candidate image remains private and is displayed only through a temporary authenticated signed URL. The header and profile-page integrations must fall back safely to candidate initials when no photo exists or when the temporary image link cannot be refreshed.

The temporary floating profile-photo launcher is removed. Photo management is available only from the authenticated candidate Profile & Settings route.

## Explicit exclusions from Phase 2.2B

- New database tables, columns, policies or migrations
- Government-ID or selfie verification
- Facial recognition or biometric comparison
- Public profile-photo publication
- Staff review of candidate photos
- Preparation-material catalogue, entitlements or downloads
- Certificate eligibility, pricing, payment or issuance
- Credential, badge, transcript or LinkedIn functions
- Automated reminder campaigns
- AI Certification Adviser
- Supabase Edge Functions
- Any change to existing examination-payment processing
- Any change to examination start, submission, grading or result logic

## Production-safety rules

- Base branch: `supabase-integration`
- Current development branch: `phase-2-2b-profile-avatar-integration`
- Frozen reference only: `certificate-commerce-v2`
- Do not merge or deploy the frozen reference pull request.
- Phase 2.2B must not add or modify a Supabase migration.
- No secret or service-role credential may be added to frontend code.
- Profile-photo storage must remain private.
- Existing candidate and staff journeys must remain operational.

## Phase 2.2B acceptance checks

1. Candidate registration and sign-in remain unchanged.
2. The public landing page remains non-blank and renders AgileCert Global content.
3. The authenticated candidate header displays a signed photo or initials fallback.
4. Selecting the header identity opens Profile & Settings.
5. The Profile & Settings route contains the private photo editor.
6. Candidates can upload, replace and remove JPEG, PNG or WebP images up to 3 MB.
7. Photo changes refresh the header avatar without a full page reload.
8. Signed photo links renew during long authenticated sessions.
9. The temporary floating photo launcher is removed.
10. No public image URL or privileged frontend credential is introduced.
11. No database migration or Edge Function is changed.
12. Existing examination catalogue, start, submit, result and staff controls remain unchanged.
13. Mobile header controls remain usable without candidate-name overflow.
14. TypeScript validation passes.
15. Production build passes.
16. No Phase 3–6 functions are introduced.

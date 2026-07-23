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

### Phase 2.2A — Private candidate profile photo — current build unit

- Dedicated private profile-photo bucket
- JPEG, PNG and WebP allow-list
- 3 MB server-side bucket limit
- One deterministic object path per candidate
- Candidate-only storage policies for select, upload, replacement and deletion
- Server-controlled photo-path linkage bound to `auth.uid()`
- Authenticated temporary signed-image display
- Candidate upload, replacement and removal interface
- Clear separation from future identity verification

### Phase 2.2B — Candidate workspace refinement — next increment

- Candidate workspace navigation refinement
- Profile-page photo integration
- Header avatar integration
- Profile validation and usability improvements
- Mobile and keyboard-accessibility refinement

### Phase 2.3 — Preparation-material records and entitlements

- Examination-to-material mapping
- Payment-verified candidate entitlements
- Locked and available material states
- Secure storage metadata and material versions

### Phase 2.4 — Secure material delivery and audit

- Authorised material-download function
- Candidate-specific access checks
- Download audit records
- Copyright notice and future watermarking hooks

## Phase 2.2A scope controls

The candidate profile photo is an optional workspace image only. It is stored privately and delivered through a temporary signed URL. It is not treated as government-ID evidence, proctoring evidence or identity-verification proof.

The object path is fixed as:

`<authenticated-user-id>/profile/avatar`

Candidates cannot choose an arbitrary object path and cannot read, replace or delete another candidate's image.

## Explicit exclusions from Phase 2.2A

- Government-ID or selfie verification
- Facial recognition or biometric comparison
- Public profile-photo publication
- Staff review of candidate photos
- Preparation-material catalogue, entitlements or downloads
- Certificate eligibility and certificate sales
- Seven-day certificate pricing
- Certificate payment
- Credential, badge, transcript or LinkedIn functions
- Automated reminder campaigns
- AI Certification Adviser
- Supabase Edge Functions
- Any change to existing examination-payment processing

## Production-safety rules

- Base branch: `supabase-integration`
- Current development branch: `phase-2-2-profile-photo`
- Frozen reference only: `certificate-commerce-v2`
- Do not merge or deploy the frozen reference pull request.
- Each increment must preserve existing candidate and staff journeys.
- Database changes must be narrowly scoped and manually reviewed before application.
- No secret or service-role credential may be added to frontend code.
- Profile-photo storage must remain private.

## Phase 2.2A acceptance checks

1. Candidate registration and sign-in remain unchanged.
2. Only authenticated, active candidate accounts may link a profile photo.
3. The storage bucket is private.
4. Only JPEG, PNG and WebP images are accepted.
5. The storage bucket rejects files above 3 MB.
6. A candidate may access only `<auth.uid()>/profile/avatar`.
7. Photo replacement uses the same deterministic object path.
8. Photo display uses a temporary signed URL rather than a public URL.
9. Removing a photo clears both the private object and profile linkage.
10. The interface states that a profile photo is not identity-verification evidence.
11. Existing profile editing, examination, result and staff controls remain unchanged.
12. TypeScript validation passes.
13. Production build passes.
14. No Phase 3–6 functions are introduced.

# AgileCert Global — Phase 2 Scope

## Objective

Build the candidate profile and preparation-material experience progressively without disturbing the accepted Phase 1 public entry, authentication, examination, payment, result or administration journeys.

## Delivery increments

### Phase 2.1 — Candidate profile foundation

- Candidate-owned profile/settings table
- Authenticated profile read and save service
- Candidate profile and communication-settings screen
- Profile completion indicator
- Password-reset access through the existing Supabase Auth flow
- Row-level security and server-controlled profile upsert

### Phase 2.2 — Profile media and workspace refinement

- Private profile-photo storage and controlled upload
- Candidate workspace navigation refinement
- Profile validation and usability improvements

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

## Phase 2.1 included in the current build unit

- Legal name
- Authenticated account email display
- Telephone
- Country
- Preferred currency and language
- Time zone
- Professional headline
- Employer and industry
- Education summary
- Skills and certification interests
- Public-profile preference
- Marketing consent
- Certificate email preference
- Course-recommendation email preference
- Account password-reset access

The preferred currency is a candidate preference only. It must not override later server-owned examination or certificate pricing.

## Explicit exclusions from Phase 2.1

- Profile-photo upload
- Study-material catalogue or downloads
- Certificate eligibility and certificate sales
- Seven-day certificate pricing
- Certificate payment
- Credential, badge, transcript or LinkedIn functions
- Identity verification
- Automated reminder campaigns
- AI Certification Adviser
- Any change to existing examination-payment processing

## Production-safety rules

- Base branch: `supabase-integration`
- Development branch: `phase-2-candidate-profile-materials`
- Frozen reference only: `certificate-commerce-v2`
- Do not merge or deploy the frozen reference pull request.
- Each increment must preserve existing candidate and staff journeys.
- Database changes must be narrowly scoped and manually reviewed before application.
- No secret or service-role credential may be added to frontend code.

## Phase 2.1 acceptance checks

1. Candidate registration and sign-in remain unchanged.
2. Only authenticated, active candidate accounts may save a candidate profile.
3. A candidate may read only their own extended profile.
4. Direct client writes to the profile table are not permitted.
5. Profile saving occurs through a security-definer RPC bound to `auth.uid()`.
6. Candidate profile changes persist after reload once the migration is applied.
7. The candidate can request a password-reset email through the existing Auth service.
8. Existing examination catalogue, start, submit, result and staff controls remain unchanged.
9. TypeScript validation passes.
10. Production build passes.
11. No Phase 3–6 functions are introduced.

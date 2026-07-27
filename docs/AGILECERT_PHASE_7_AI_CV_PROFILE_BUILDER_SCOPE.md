# AgileCert Phase 7 — AI CV and Professional Profile Builder

## Objective

Phase 7 gives authenticated candidates a private, structured CV and professional-profile workspace with candidate-controlled AI assistance. It reuses the existing candidate profile and credential ecosystem without changing examination, payment, certificate, identity, proctoring or AI Certification Adviser authorities.

This release completes issue #99 through two forward-only units.

## Phase 7.1 — private CV foundation

### Candidate workspace

- Dedicated **CV Builder** navigation item for authenticated candidates.
- One private candidate-owned CV document.
- Professional identity, contact details, target role and professional summary.
- Skills and languages.
- Structured experience, education, certifications, projects, awards and affiliations.
- References and draft/readiness status.
- Live professional preview.
- Downloadable A4 PDF through the existing jsPDF dependency.

### Existing-profile reuse

When no CV draft exists, the builder pre-populates available candidate profile information, including the professional headline, account email, telephone, location seed, skills and education summary. The candidate remains responsible for reviewing and correcting all content.

### Data and privacy controls

- Supabase table: `agilecert_candidate_cv_documents`.
- One row per authenticated candidate.
- Candidate-owned row-level reads only.
- Direct client inserts, updates and deletes disabled.
- Writes use `upsert_my_agilecert_candidate_cv_document`, bound to `auth.uid()`.
- Structured section and content-size limits enforced server-side.

## Phase 7.2 — consent-gated AI CV assistance

### Candidate capabilities

The private **AI CV Studio** supports four controlled actions:

1. professional-summary improvement;
2. target-role tailoring;
3. fact-preserving achievement-bullet rewriting; and
4. grounded skills refinement.

The assistant returns suggestions only. No CV field changes until the candidate reviews and explicitly applies the suggestion.

### Provider and factual-integrity controls

- Uses the existing server-side Gemini authority and secret.
- Requires an authenticated, active candidate and an already-saved private CV.
- Requires explicit, withdrawable AI processing consent.
- Contact details, identity evidence, payments and examination records are excluded from the provider context.
- The model is instructed not to invent employers, dates, qualifications, certifications, projects, metrics or achievements.
- Experience suggestions are accepted only for existing supplied experience identifiers.
- Candidate instructions are treated as untrusted and prompt-injection signals are recorded.
- Hourly limit: 12 AI CV requests per candidate.

### Audit and retention

- Supabase table: `agilecert_ai_cv_requests`.
- Candidates may read only their own request metadata.
- Direct browser writes are disabled.
- Service-role-only registration and completion functions.
- Raw CV content, full prompts and provider responses are not retained in the audit table.
- Minimal request metadata is retained for 90 days.
- Applied suggestions are marked separately and update `ai_last_enhanced_at`.

## Release units

### Database

1. `supabase/migrations/202607261300_phase_7_ai_cv_profile_builder_foundation.sql`
2. `supabase/migrations/202607271100_phase_7_ai_cv_completion.sql`

### Edge Function

- `supabase/functions/agilecert-ai-cv/index.ts`

### Frontend

- `src/services/aiCvProfileBuilderService.ts`
- `src/services/cvPdfService.ts`
- `src/components/AiCvProfileBuilder.tsx`
- `src/services/aiCvEnhancementService.ts`
- `src/components/AiCvEnhancementLauncher.tsx`
- `src/App.tsx`
- `src/main.tsx`

### Validation

- `.github/workflows/validate-agilecert-phase-7.yml`
- `.github/workflows/validate-agilecert-phase-7-completion.yml`
- `scripts/phase7-completion-behaviour.sql`

## Explicit boundaries

Phase 7 does not include:

- public CV or portfolio publishing;
- recruiter or employer discovery access;
- external job-board integration;
- automatic job applications;
- CV file import or parsing;
- examination registration, pricing, payment, start, submission, grading or results changes;
- certificate pricing, payment, issuance or verification changes;
- credential-wallet, CPD or renewal changes;
- identity-assurance or proctoring changes;
- examination questions, answer keys or candidate-answer access; or
- replacement or modification of the existing AI Certification Adviser.

Public publishing, recruiter access, file parsing and external job-board connections are separate future products requiring new privacy, moderation, consent and commercial approvals; they are not required for the completed private Phase 7 candidate capability.

## Acceptance checks

Phase 7 is complete only when:

- TypeScript validation and the production bundle succeed;
- the Phase 7.1 foundation and Phase 7.2 completion migrations apply in an isolated full reset;
- the AI CV Edge Function type-checks;
- an active candidate can save a private CV and enable or withdraw AI consent;
- a consented request is rate-limited and minimally audited;
- provider context excludes contact, identity, payment and examination data;
- suggestions remain unapplied until the candidate confirms them;
- a candidate can apply a reviewed suggestion and receive an enhancement timestamp;
- another candidate cannot read the CV document or AI request audit;
- direct browser writes and service-role AI authorities remain protected;
- the production deployment applies exactly the two pending Phase 7 migrations and deploys only `agilecert-ai-cv`;
- the live bundle contains the private AI CV Studio; and
- protected examination, commerce, certificate, credential, identity, proctoring and AI Adviser authorities remain unchanged.

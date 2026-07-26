# AgileCert Phase 7 — AI CV and Professional Profile Builder

## Objective

Phase 7 extends the authenticated candidate workspace with a private CV and professional-profile builder. It reuses the existing candidate profile foundation and provides a practical CV product before AI rewriting is activated.

This increment tracks issue #99.

## Phase 7.1 delivered scope

### Candidate workspace

- Dedicated **CV Builder** navigation item for authenticated candidates.
- Private candidate-owned CV document.
- Professional identity, contact details, target role and professional summary.
- Skills and languages.
- Structured professional experience with achievement bullets.
- Structured education history.
- Professional certifications and credential links.
- Selected projects and outcomes.
- Awards and recognition.
- Professional affiliations.
- References and draft/readiness status.
- Live professional preview.
- A4 PDF download through the existing jsPDF dependency.

### Existing-profile reuse

When no CV draft exists, the builder pre-populates available candidate profile information, including:

- professional headline;
- account email;
- telephone;
- country code/location seed;
- skills; and
- existing education summary.

The candidate remains responsible for reviewing and correcting all CV content.

### Data and privacy controls

- Supabase table: `agilecert_candidate_cv_documents`.
- One private CV document per authenticated candidate.
- Row-level security permits candidates to read only their own row.
- Direct client inserts, updates and deletes are disabled.
- All writes use `upsert_my_agilecert_candidate_cv_document`.
- The RPC binds ownership to `auth.uid()` and confirms the account is an active candidate.
- Structured section and content-size limits are enforced server-side.
- Public CV sharing, employer search and recruiter access are not included.

## AI boundary

The interface is branded as the **AI CV & Professional Profile Builder**, but Phase 7.1 does not transmit CV content to any AI provider.

A candidate may record consent for a later AI-assistance increment. AI rewriting, role-tailoring and summarisation remain disabled until:

1. the OpenAI quota/billing issue is resolved;
2. provider-side privacy and rate-limit controls are approved;
3. server-authoritative prompts and audit controls are validated; and
4. the later increment receives explicit production approval.

## Explicit exclusions

Phase 7.1 does not include:

- AI-generated or AI-rewritten CV content;
- CV or résumé import/parsing;
- public portfolio pages;
- recruiter or employer access;
- job-board integrations;
- candidate discovery or search;
- automatic job applications;
- changes to examination pricing, payment or checkout;
- changes to certificate pricing, payment, issuance or verification;
- changes to proctoring, grading or protected answer keys;
- changes to identity assurance; or
- changes to the existing AI Certification Adviser.

## Release unit

- `supabase/migrations/202607261300_phase_7_ai_cv_profile_builder_foundation.sql`
- `src/services/aiCvProfileBuilderService.ts`
- `src/services/cvPdfService.ts`
- `src/components/AiCvProfileBuilder.tsx`
- `src/App.tsx`
- `.github/workflows/validate-agilecert-phase-7.yml`

## Acceptance checks

Phase 7.1 is acceptable only when:

- TypeScript validation succeeds;
- the production bundle builds;
- the CV navigation and compiled capability markers are present;
- an isolated Supabase reset applies the full migration history;
- the candidate CV table, RLS policy and RPC exist;
- direct authenticated writes remain revoked;
- an authenticated active candidate can create and update one CV document;
- a second candidate cannot read the first candidate’s document;
- invalid role, status, template and oversized sections are rejected;
- existing examination, payment, certificate, credential and AI Adviser files remain outside the change boundary.

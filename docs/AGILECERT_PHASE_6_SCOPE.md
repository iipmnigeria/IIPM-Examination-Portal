# AgileCert Global Phase 6 — AI Certification Adviser

## Status

Phase 6 is a controlled development increment on branch:

`phase-6-ai-certification-adviser`

It must not be merged into `supabase-integration` or deployed without a separate explicit approval.

The frozen `certificate-commerce-v2` branch remains reference-only and must not be merged or deployed.

## Objective

Phase 6 introduces a privacy-bounded AI Certification Adviser that helps public visitors and signed-in candidates understand the published AgileCert Global examination catalogue, compare suitable specialist examinations, understand examination and certificate pricing, and identify the correct next step.

The adviser is guidance-only. It cannot register candidates, start examinations, initialise or verify payments, alter examination results, approve identity assurance, issue certificates, process refunds or make official decisions.

## Grounded adviser model

The Edge Function builds each response from current server-side records only:

- active programmes;
- published examinations;
- active examination prices;
- active certificate products; and
- active certificate-product prices.

The model receives no examination questions, answer options, answer keys, candidate answers, proctoring evidence, payment payloads, identity evidence, private certificate records or administrator notes.

Recommendations returned to the browser must reference examination identifiers that exist in the current published catalogue. Unknown or invented identifiers are removed before the response is returned.

## Candidate and visitor experience

The adviser provides:

- a floating, responsive chat launcher;
- concise catalogue and pathway guidance;
- quick prompts for common questions;
- published examination recommendations with reasons;
- clear separation between examination fees and optional certificate fees;
- an explanation of Certificate of Achievement and Professional Certificate requirements;
- guidance back to the examination catalogue or candidate-access section;
- a visible privacy and accuracy notice;
- explicit consent before the first message is submitted;
- an hourly message-limit indicator; and
- human-support escalation for matters requiring authorised review.

The user is instructed not to submit passwords, payment references, identity documents, examination questions, answer keys or other sensitive personal information.

## Safety boundaries

The adviser must:

- never disclose, reconstruct, infer or discuss live examination questions, answer keys or correct answers;
- never claim affiliation, endorsement, authorisation or equivalence with any third-party professional body unless it is explicitly present in approved catalogue content;
- never change scores, examination status, payment status, identity status or credential status;
- never promise a refund, approval, certificate, job, membership or professional recognition;
- never expose private candidate, payment, identity, proctoring or administrator information;
- distinguish AgileCert Global modular examination-led credentials from IIPM full professional programmes;
- state clearly that examination payment and optional certificate payment are separate;
- require human support for refunds, disputes, suspected fraud, identity rejection, legal complaints, inaccessible paid services or account-specific decisions; and
- remain commercially helpful without pressure or invented claims.

## Privacy, consent and retention

A random browser session identifier is stored locally. The raw identifier is never stored in the database. The Edge Function hashes it with a server-side `AGILECERT_CHAT_SALT` before registration.

The server stores private, row-level-security-protected session and message audit records for safety, quality review, rate limiting and escalation handling. Browser roles receive no direct read or write permission to these tables.

The first submitted message requires explicit user consent acknowledging the privacy notice. Chat audit records are retention-bounded and may be removed after 90 days through the server-owned registration workflow.

## Rate limiting and abuse controls

The adviser uses a server-authoritative hourly message limit per hashed browser session. The browser may display the remaining count, but cannot reset or override the rate window.

Inputs are length-limited and control characters are removed. Only the most recent bounded conversation history is sent to the model. Model output is constrained to structured JSON and is validated before use.

## AI provider boundary

The Edge Function uses the server-side `GEMINI_API_KEY` secret and an environment-selected model through `AGILECERT_GEMINI_MODEL`, defaulting to `gemini-3.6-flash`.

No Gemini API key, chat salt, service-role credential or privileged database value may be exposed to the browser bundle.

## Database and function scope

Phase 6 may add exactly one migration:

`202607250103_phase_6_ai_certification_adviser.sql`

The migration may add:

- private AI adviser sessions;
- private AI adviser message records;
- server-only rate-limit registration;
- server-only response recording;
- consent timestamps;
- escalation and lead-intent metadata; and
- retention-bounded cleanup.

Phase 6 may add exactly one Edge Function:

`agilecert-ai-adviser`

## Explicit exclusions

Phase 6 does not implement or change:

- examination registration, payment, start, submission, grading or results;
- examination questions, answer keys or proctoring controls;
- preparation-material storage, entitlements or delivery;
- certificate eligibility, pricing, checkout, payment or issuance;
- identity-assurance submission or review;
- government-ID collection, selfies, facial matching or biometrics;
- email, SMS or WhatsApp campaigns;
- automated lead follow-up;
- refunds or dispute processing;
- administrator account actions;
- external CRM synchronisation; or
- the frozen reference branch.

## Acceptance controls

Before Phase 6 can be proposed for merge and deployment, it must pass:

- TypeScript validation;
- production build;
- Deno type-check for the new Edge Function;
- exact one-migration and one-function scope review;
- server-only chat-table permissions;
- session hashing and explicit-consent checks;
- hourly rate-limit tests;
- 90-day retention checks;
- catalogue-only grounding checks;
- recommendation identifier allow-listing;
- examination-content and answer-key exclusion checks;
- prompt-injection and sensitive-data safety assertions;
- human-escalation assertions;
- browser-bundle secret exclusion checks;
- Phase 1 through Phase 5 regression validation; and
- explicit review of every changed file.

No Phase 6 merge or deployment may occur without separate explicit approval.

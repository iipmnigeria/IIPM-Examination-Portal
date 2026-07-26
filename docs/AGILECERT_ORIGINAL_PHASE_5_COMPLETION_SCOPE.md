# AgileCert Original Roadmap Phase 5 Completion

Tracks #101.

## Objective
Complete identity verification and advanced proctoring without rebuilding the deployed manual identity-assurance and Professional Certificate gate.

## Existing foundation preserved
- private professional evidence submission;
- manual IIPM approval, rejection and changes-requested decisions;
- Professional Certificate checkout and issuance identity gate;
- private evidence storage and signed access;
- candidate/admin identity workspaces and audit history;
- secure examination start, answer submission, grading and certificate eligibility.

## Completion release units
1. `202607261400_phase_5_identity_policy_consent.sql`
2. `202607261401_phase_5_sensitive_identity_exam_check.sql`
3. `202607261402_phase_5_live_proctoring_events.sql`
4. `202607261403_phase_5_incidents_misconduct_appeals.sql`
5. `202607261404_phase_5_candidate_admin_workspaces.sql`
6. `202607261405_phase_5_privacy_permissions.sql`
7. `202607261406_phase_5_result_integrity_compatibility.sql`

The seventh unit is a forward-only compatibility correction discovered by the completion lifecycle audit. It aligns misconduct and appeal outcomes with the authoritative attempt status, candidate submission response and Phase 3 certificate eligibility without changing examination scores, answers or answer keys.

## Candidate capabilities
- view examination-specific identity and proctoring requirements;
- accept a versioned privacy, identity and proctoring consent;
- submit government-ID metadata using data minimisation: one-way digest plus last four only;
- upload government-ID and selfie evidence to candidate-owned private storage;
- complete an examination-day identity attestation;
- see identity-check, session-risk, incident, misconduct and appeal status;
- provide an incident explanation;
- submit one appeal after a misconduct decision.

## Examination runtime capabilities
- open one server-authoritative proctoring session per secure exam session;
- persist focus, visibility, fullscreen, clipboard, camera, connectivity and approved AI-detection events while the examination is active;
- prevent camera access and AI visual processing unless the active examination policy permits them;
- strip question, answer and answer-key data from event metadata;
- calculate risk server-side from configured severity weights;
- create an incident automatically when the configured threshold is reached;
- close the proctoring session on assessment submission;
- return the authoritative held or cleared attempt status to the candidate.

## Administrator capabilities
- configure identity/proctoring policy per examination;
- review sensitive identity documents and examination-day checks;
- inspect proctoring sessions and event timelines;
- create or classify incidents;
- request a candidate explanation;
- decide no-violation, warning, flagged-attempt, invalidated-attempt or candidate suspension outcomes;
- place or release a result hold without changing answer keys or score calculations;
- decide appeals and restore certificate eligibility when a result is cleared;
- retain a full audit trail.

## Privacy and safety defaults
- external KYC disabled;
- automated facial matching disabled;
- liveness scoring disabled;
- microphone recording disabled;
- routine webcam-image retention disabled;
- raw government-ID number never stored;
- sensitive files remain private and are never exposed by public verification APIs;
- retention is policy driven and defaults to 365 days until issue #102 is resolved.

## Protected boundaries
No changes to examination prices, Paystack, coupons, certificate pricing, credential wallet, badges, transcripts, CPD, renewal, AI Adviser prompts/secrets, question content, answer keys or grading calculations.

## Acceptance gates
- exact seven-migration allow-list;
- complete isolated Supabase reset;
- candidate/admin authorization and private-storage tests;
- identity-number minimisation and public-response privacy tests;
- protected question-withholding and proctoring preflight tests;
- live proctor-event, risk and automatic-incident lifecycle tests;
- examination submission and authoritative result-hold response tests;
- candidate explanation, misconduct decision and appeal tests;
- cleared-appeal certificate-eligibility restoration test;
- score and answer-key immutability checks;
- TypeScript, production build and browser event-capture smoke test;
- protected payment, certificate, credential and AI regressions;
- separate explicit approval before production merge and deployment.

## Validation status
The full historical migration reset and the first schema/privacy/permission gate have passed. A dedicated end-to-end lifecycle gate now exercises protected examination start, question withholding, live risk scoring, automatic incident creation, result hold, submission, explanation, misconduct decision, appeal, final result restoration, certificate eligibility and protected answer-key integrity. Production remains unchanged.

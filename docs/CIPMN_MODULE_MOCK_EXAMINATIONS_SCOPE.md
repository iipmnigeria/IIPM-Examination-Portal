# CIPMN Professional Licensing Module Mock Examinations

## Scope

This phase adds a dedicated catalogue for the twelve CIPMN licensing modules under the programme code `CIPMN-MOCK`.

Each module is configured as a separate paid mock examination with:

- 75 multiple-choice questions
- four options per question
- one protected answer key and explanation per question
- case-based, scenario-based and application-focused wording
- 120-minute duration
- 50% pass mark, aligned with the CIPMN licensing curriculum structure
- one permitted attempt per purchase/assignment
- question and option randomisation
- payment or approved assignment required before launch
- the portal's current standard examination price of NGN 25,000

The mock examinations support professional preparation. Passing a mock examination does not by itself confer a CIPMN licence.

## Included modules

1. CIPMN-MOD-001 - Principles of Project Management
2. CIPMN-MOD-002 - Understanding Project Management Methodologies
3. CIPMN-MOD-003 - Project Delivery Conceptual Tools
4. CIPMN-MOD-004 - Requirements Engineering in Project Management
5. CIPMN-MOD-005 - Project Risk and Issues Management
6. CIPMN-MOD-006 - Project Planning and Scheduling
7. CIPMN-MOD-007 - Project Scope and Change Management
8. CIPMN-MOD-008 - Project Quality Management
9. CIPMN-MOD-009 - Agile Delivery
10. CIPMN-MOD-010 - Project Leadership and Building High-Performing Teams
11. CIPMN-MOD-011 - Understanding DUCAP Methodology
12. CIPMN-MOD-012 - Managing Successful International Programs and Portfolios

## Data and security design

The examination catalogue and question banks are seeded through Supabase migrations. Candidate-facing question records remain separate from `question_answer_keys`, preserving the portal's server-authoritative grading and answer-key protection.

## Validation gate

The phase validation workflow resets an isolated Supabase environment and verifies:

- 12 published examinations
- 75 active questions per examination
- 900 active questions in total
- 3,600 options in total
- exactly four options and one valid answer key per question
- unique question text within each module examination
- case/application framing for every question
- NGN 25,000 pricing for every module
- 120-minute duration and 50% pass mark

## Coupon sequence

The 88% programme-wide coupon is intentionally excluded from the examination creation migrations. It will be added only after the twelve examinations and all 900 questions pass the validation gate. Its 14-day validity window will begin when the coupon migration is deployed.

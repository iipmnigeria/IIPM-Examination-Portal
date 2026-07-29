# CIPMN Professional Licensing Module Mock Examinations

## Scope

This phase adds a dedicated catalogue for the twelve CIPMN licensing modules under the programme code `CIPMN-MOCK`.

Each module is configured as a separate paid mock examination with:

- 75 multiple-choice questions
- four options per question
- one protected answer key and explanation per question
- case-based, scenario-based and application-focused wording
- 120-minute duration
- 70% pass mark
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

## Paid preparation-material catalogue

Each CIPMN module now has a deterministic preparation-material mapping containing:

- one required PDF study-material record at position 1
- one optional embedded-video placeholder at position 2
- the shared `ESG in Project Management Practice` reference at position 3

The PDF source manifest records the approved Google Drive file ID, original file name, file size and intended private Supabase storage path. These source details are administrator-only and are never returned by the candidate preparation-material RPC.

All newly mapped materials start in `draft` status. A PDF becomes candidate-visible only after an examination administrator:

1. imports the source file into the private `agilecert-preparation-materials` bucket;
2. creates and publishes a material version; and
3. publishes the logical material record.

The existing entitlement triggers then make the resource available only where the candidate has a verified paid or waived order, or an authorised administrator assignment, for that exact examination. Paying for one CIPMN module does not unlock another module's PDF or video.

The ESG reference is mapped to all twelve CIPMN examinations and therefore becomes available within each module only when that module's own entitlement is valid.

### Video provision

Each module has a reserved `video` material record and an administrator-only source-manifest row with `delivery_mode = embedded_video`. The provider can later be set to Google Drive, YouTube, Vimeo or another approved host without changing the examination-to-material mapping or payment entitlement model.

### Source-title reconciliation note

The supplied file numbered `CIPMN_MOD012` is titled `Project Procurement and Contract Management`, while the current examination catalogue names Module 012 `Managing Successful International Programs and Portfolios`. The migration matches the PDF to Module 012 by the authoritative module code and records the source filename unchanged for administrator review. The curriculum title should be reconciled before the material is published.

## Data and security design

The examination catalogue and question banks are seeded through Supabase migrations. Candidate-facing question records remain separate from `question_answer_keys`, preserving the portal's server-authoritative grading and answer-key protection.

Preparation files remain protected by the existing private-storage delivery path. Candidate clients do not receive Google Drive file IDs, storage bucket names or object paths. Every download is re-authorised against the candidate's current examination assignment and verified payment or waiver before the Edge Function streams the private file.

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
- 120-minute duration and 70% pass mark

The preparation-material migration additionally verifies:

- 12 required module PDF mappings
- 12 module video placeholders
- the ESG reference mapped to all 12 module examinations
- no published CIPMN material version without a matching private storage object

The examination portal build and the complete database integrity test passed successfully before the programme coupon was activated. A corrective migration sets and verifies the approved 70% pass mark across all twelve module examinations.

## Active 88% programme coupon

- Coupon code: `CIPMN12-ACCESS88`
- Scope: all 12 `CIPMN-MOCK` module examinations
- Discount: 88%
- Standard price: NGN 25,000 per module
- Discounted amount payable: NGN 3,000 per module
- Currency: NGN
- Validity: 14 days from deployment of the coupon migration
- Automatic expiry: enabled
- Candidate limit: one redemption per module, up to 12 redemptions per candidate
- Overall redemption ceiling: none during the active window

A separate isolated workflow validates the coupon configuration and confirms that it produces the correct NGN 3,000 checkout quote for every one of the twelve module examinations.

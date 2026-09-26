# CIPMN October 2026 — First-Wave Email Preview

Snapshot basis: 26 September 2026, approximately 13:40 WAT.

Campaign remains disabled. No email in this document has been queued or sent.

## Proposed next safe send window

The production-ready scheduler uses two controlled WAT windows: approximately 08:30 and 14:30.

For this snapshot, the next eligible window is:

**26 September 2026 — 14:30 WAT**

The hourly communications worker runs at approximately :17 each hour. If activation does not occur in time for the 14:30 window, these emails automatically roll forward to the next eligible 08:30 WAT window.

Monitoring copy for every CIPMN campaign email:

**CC: iipmnigeria@gmail.com**

## Registered AgileCert candidates — first prioritized email

| Candidate | Recipient | First-wave subject | Modules / action |
| --- | --- | --- | --- |
| Bello Alhaji Abubakar | belloncy007@gmail.com | Start the CIPMN mock examinations already available to you | Start MOD-002, MOD-003, MOD-004, MOD-005, MOD-006, MOD-007, MOD-008, MOD-009, MOD-010, MOD-011 |
| Benjamin Edache Ikwulono | boldbenedoh104@gmail.com | Start the CIPMN mock examinations already available to you | Start MOD-002, MOD-003, MOD-004, MOD-005, MOD-006, MOD-007, MOD-008, MOD-010, MOD-011 |
| Emmanuel Habu Ikrenwo | habuikrenwo@gmail.com | Start the CIPMN mock examinations already available to you | Start MOD-001 |
| Hafsat Funmilayo Bankole | hafsatfunmilayo2015@gmail.com | Your remaining CIPMN preparation modules on AgileCert | Purchase/activate MOD-001 through MOD-012 and EL01 through EL05 |
| Iwajomo Adeboye | iwajomoa@gmail.com | Your remaining CIPMN preparation modules on AgileCert | Purchase/activate MOD-012, EL01, EL02, EL03, EL04, EL05 |
| Izedonmen Friday Egbokhare | izedonmenfriday@gmail.com | Complete your AgileCert payment for MOD-011 | Recover unresolved MOD-011 payment; payment reference IIPM-B3E11715BFB14F6D9CB1 |
| Mary Ekikereobong Matthew | maryimoh.b@gmail.com | Start the CIPMN mock examinations already available to you | Start MOD-004, MOD-005, MOD-006, MOD-007, MOD-008 |
| Ohilebo David Moshope | shopeohilebo@gmail.com | Your remaining CIPMN preparation modules on AgileCert | Purchase/activate MOD-006, MOD-007, MOD-008, MOD-009, MOD-010, MOD-011, MOD-012, EL01, EL02, EL03, EL04, EL05 |
| Umaina Ibrahim Muhammad | umainaibrahim@gmail.com | Start the CIPMN mock examinations already available to you | Start MOD-006, MOD-007, MOD-008, MOD-009, MOD-010, MOD-011 |

## Official candidates not yet registered on AgileCert

These contacts are intentionally excluded from the existing candidate-ID outbox until a reviewed email-only onboarding path is added. No synthetic AgileCert account will be created.

| Candidate | Recipient | Proposed outreach subject | Action |
| --- | --- | --- | --- |
| Chiemerie Nnenna Awuzie | chiemerieejiogu@gmail.com | Your CIPMN examination preparation access on AgileCert | Create/confirm AgileCert account and begin preparation |
| Fatima Adamu Muhammed | adamuphateema@gmail.com | Your CIPMN examination preparation access on AgileCert | Create/confirm AgileCert account and begin preparation |
| Ofoegbu Lotanna Steven | lotanna@gmail.com | Your CIPMN examination preparation access on AgileCert | Create/confirm AgileCert account and begin preparation |

## Cadence after the first wave

- Payment recovery: first eligible after at least 1 hour unresolved; then 48-hour cadence, becoming daily when the relevant official examination is within 3 days.
- Mock resume: 24-hour cadence while still incomplete.
- Mock start: 48-hour cadence, becoming daily within 3 days of the relevant examination.
- Unpurchased modules: 72-hour cadence, becoming daily within 3 days of the nearest missing official examination.
- General examination preparation: every 3 days through 5 October; daily from 6 October through 18 October.
- Maximum two CIPMN campaign emails per candidate per WAT calendar day.
- Minimum six hours between CIPMN campaign emails.
- General preparation is suppressed when a more specific payment, mock, or purchase action is due.

## Final pre-send stop checks

Immediately before Resend is called, the worker rechecks live data.

A claimed CIPMN email is cancelled instead of sent when, for example:

- payment has since succeeded or a paid/waived replacement exists;
- an unpurchased module has since been purchased;
- a never-started mock has since been started;
- an incomplete mock has since been completed;
- all related official examination dates have passed.

The official 17-module timetable remains authoritative. Candidate-facing MOD-012 continues to map internally to the live international-programmes examination record; the internal EL06 code is not exposed as an official timetable module.

# CIPMN October 2026 — Simulated Send Matrix

Generated from live AgileCert state during the controlled build on 26 September 2026.

No production email was sent by this simulation.

## Delivery architecture

- Existing AgileCert outbox eligible: candidates with a real `profiles.id`.
- Registration outreach only: official candidates not yet represented by an AgileCert profile.
- Monitoring copy for every future CIPMN campaign email: `iipmnigeria@gmail.com`.
- Maximum two CIPMN campaign emails per candidate per WAT calendar day.
- Priority: payment recovery → mock resume → mock start → unpurchased modules → general preparation.

## Candidate plan

| Candidate | AgileCert | Primary simulated email | Secondary simulated email | Key current state |
| --- | --- | --- | --- | --- |
| Bello Alhaji Abubakar | Registered | Mock start | Unpurchased modules | 1 completed; 10 purchased/not started; 6 official modules unpurchased |
| Benjamin Edache Ikwulono | Registered | Mock start | Unpurchased modules | 1 completed; 9 purchased/not started; 7 official modules unpurchased |
| Chiemerie Nnenna Awuzie | Not registered | Registration outreach | — | No AgileCert profile under supplied email; 17 official modules outstanding |
| Emmanuel Habu Ikrenwo | Registered | Mock start | Unpurchased modules | MOD-001 purchased/not started; 16 official modules unpurchased |
| Fatima Adamu Muhammed | Not registered | Registration outreach | — | No AgileCert profile under supplied email; 17 official modules outstanding |
| Hafsat Funmilayo Bankole | Registered | Unpurchased modules | — | Registered, but no official October module purchased |
| Iwajomo Adeboye | Registered | Unpurchased modules | — | 11 official modules completed; 6 unpurchased |
| Izedonmen Friday Egbokhare | Registered | Payment recovery | Mock resume | MOD-011 unresolved payment; MOD-002 in progress; 1 completed |
| Mary Ekikereobong Matthew | Registered | Mock start | Unpurchased modules | 6 completed; 5 purchased/not started; 6 unpurchased |
| Ofoegbu Lotanna Steven | Not registered | Registration outreach | — | No AgileCert profile under supplied email; 17 official modules outstanding |
| Ohilebo David Moshope | Registered | Unpurchased modules | — | 5 completed; 12 unpurchased |
| Umaina Ibrahim Muhammad | Registered | Mock start | Unpurchased modules | 5 completed; 6 purchased/not started; 6 unpurchased |

## Current valid payment-recovery target

Only one unresolved order remains eligible after suppressing historical cancelled/expired orders that were later successfully repurchased:

- Izedonmen Friday Egbokhare — MOD-011
- Candidate email: izedonmenfriday@gmail.com
- Current order state: pending
- Latest payment state: initiated
- No paid/waived replacement exists for the same official module
- Official examination date: 14 October 2026

## State precedence

For each candidate/module, communication state is resolved in this order:

1. examination passed → no campaign message;
2. unregistered → registration outreach only;
3. unpurchased → purchase reminder;
4. completed attempt → no start/resume reminder;
5. started but incomplete → resume reminder;
6. paid/waived but never started → start reminder.

Completed attempts always override older incomplete sessions.

## Official campaign mapping note

The official timetable contains 17 modules.

Official MOD-012 — Managing Successful International Programs and Portfolios — is mapped internally to the current AgileCert record whose live code is `CIPMN-MOD-EL06`.

That live code must never be exposed to candidates as an official October timetable code. Candidate-facing communication uses `MOD-012`.

The current live `CIPMN-MOD-012 - Project Procurement and Contract Management` record is excluded from this October campaign because official EL04 represents Project Procurement Management.

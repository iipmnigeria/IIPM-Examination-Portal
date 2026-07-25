# CIPMN Module Mock Examination Production Deployment Record

## Deployment status

Production deployment completed successfully on 25 July 2026 from exact approved integration commit `232df17d08687673446dd1708e2c137458596faf`.

The controlled deployment used the confirmed production migration-history boundary `202607230101`, required exactly migrations `202607251701` through `202607251715` to be pending, applied the migrations to the linked production Supabase project, verified the live records, and confirmed that no migration remained pending.

## Live verification

- 12 published CIPMN module mock examinations
- 75 active questions per module
- 900 active questions in total
- 3,600 answer options
- 900 valid protected answer keys
- 120-minute duration
- 70% pass mark
- NGN 25,000 standard fee per module
- coupon code `CIPMN12-ACCESS88`
- 88% discount, leaving NGN 3,000 payable per module
- 12 successful module coupon quotes
- coupon active from 25 July 2026 at 17:06:00 UTC
- coupon expires automatically on 8 August 2026 at 17:06:00 UTC

The production trigger pull request was closed without merging after successful deployment. The temporary deployment workflow was then removed from the active `main` branch while remaining available in repository history for audit purposes.

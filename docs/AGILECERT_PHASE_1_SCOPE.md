# AgileCert Global — Phase 1 Scope

## Objective

Reposition the existing IIPM Examination Portal public entry experience as **AgileCert Global — Powered by IIPM** without changing the current examination, payment, assessment, result or administration logic.

## Included

- AgileCert Global public landing page
- AgileCert Global browser title and static startup shell
- Specialist modular examination positioning
- Clear distinction between AgileCert Global and IIPM full professional programmes
- Existing candidate registration and sign-in embedded in the landing page
- Existing candidate dashboard and examination catalogue
- Existing examination-payment process
- Existing secure examination and result functions
- Existing administration and commerce controls
- Clear disclosure that examination and future certificate fees are separate

## Excluded

The following must not be introduced through Phase 1:

- New certificate eligibility logic
- Certificate of Achievement or Professional Certificate checkout
- New certificate pricing or discounts
- New certificate PDF, transcript, badge or LinkedIn functions
- Candidate profile and settings expansion
- Preparation-material entitlements or downloads
- Identity verification
- Automated sales or credential emails
- AI Certification Adviser
- New Supabase migrations
- New Supabase Edge Functions
- New payment gateway secrets or webhook changes

## Acceptance checks

1. Public visitors see AgileCert Global branding and positioning.
2. Registration and sign-in continue to work through the existing authentication logic.
3. Existing candidates can access their dashboard and examinations.
4. Existing examination payments remain unchanged.
5. Existing secure examination submission and results remain unchanged.
6. Staff can access the existing administration controls.
7. The browser title, loading shell and startup diagnostic use AgileCert Global.
8. TypeScript validation and the production build pass.
9. No Supabase migration or Edge Function is included in the Phase 1 diff.
10. Production remains unchanged until the Phase 1 pull request is reviewed and approved.

## Branches

- Production base: `supabase-integration`
- Phase 1 development: `phase-1-agilecert-branding`
- Frozen full-development reference: `certificate-commerce-v2`

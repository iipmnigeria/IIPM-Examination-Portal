# Certificate Renderer Examination-Code Compatibility

## Purpose

The Certificate Management Console and Phase 1C server-render context expose an examination or module code. The production `examinations` table predates that field, so the first managed certificate render would otherwise fail when the database function reads `examination.code`.

This compatibility package adds the missing field without changing examination identity, results, pass marks, pricing, payments, certificate eligibility, issued credentials or public verification.

## Derivation order

A code is preserved when an existing valid code is present. Missing codes are derived in this order:

1. a `CIPMN-MOD-###` token found in the examination title;
2. the examination programme code;
3. a stable `EXAM-XXXXXXXX` fallback derived from the examination UUID.

Codes are upper-case, limited to 80 characters and restricted to letters, numbers, dots, underscores and hyphens.

## Future examinations

A server-controlled trigger derives the code for new examinations and whenever the title, programme or code is updated. Existing application inserts do not need to provide the new field.

## Security boundary

The derivation helpers are security-definer functions and are not executable by browser roles. The trigger is the normal write path. The package adds no candidate, Examination Administrator or anonymous permission.

## Preserved authorities

The package does not recreate or replace:

- examination creation, scheduling, attempts, scoring or result authority;
- certificate eligibility, issuance, numbering, status or verification authority;
- checkout, pricing, payments, Paystack or fulfilment authority;
- certificate master, overlay, assignment or renderer activation records.

## Release boundary

This source package is development and validation only. Production migration deployment remains a separate controlled release after the complete migration-history and Phase 1C regression tests pass.

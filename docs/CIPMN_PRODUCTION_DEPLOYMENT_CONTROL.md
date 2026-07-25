# CIPMN Module Mock Examination Production Deployment Control

The controlled production workflow checks out the exact approved integration commit, isolates the confirmed production migration-history window, requires the exact fifteen CIPMN migrations to be pending, applies them to the linked production Supabase project, verifies the live examination bank and ACCESS88 coupon, and confirms that no migrations remain pending.

The production trigger is submitted through a separate pull request to `main` and is closed without merging after successful deployment.

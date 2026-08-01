# Finance Console Completion — Production Release and Commissioning Record

**Release date:** 1 August 2026  
**Final status:** Production deployed, hotfixed, verified and commissioned  
**Application:** IIPM Examination Portal / AgileCert  
**Production source branch:** `supabase-integration`

## 1. Release summary

The Finance Console completion package closes the capabilities that remained partial after Finance Console Phase 1 and Phase 1B.

The commissioned production package includes:

- advanced examination pricing, promotions, access modes, attempts and retake fees;
- scholarship and invitation access grants;
- advanced coupon targeting, cart conditions, caps, limits and redemption visibility;
- editable general finance settings;
- unified individual and consolidated transaction review;
- server-side Paystack verification and controlled paid-access recovery;
- PDF receipt payloads and CSV/Excel-compatible exports;
- revenue, programme, examination, coupon, currency and period reporting;
- separated settings, reconciliation, recovery, adjustment, receipt, export and dashboard permissions;
- immutable finance audit controls.

Existing examination checkout, consolidated cart, Paystack webhook, order fulfilment and examination-runtime authorities remain authoritative.

## 2. Source integration

### Finance Console completion

- Pull request: **#256 — Complete Finance Console administration**
- Validated source commit: `aae034afffd70fc548b551157d0c7a8963cde273`
- Merged `supabase-integration` commit: `39255e9ea56178ef2b362a089bd0788846dcbbd7`

The source package was limited to the approved Finance Console completion files and passed frontend, Edge Function, complete migration-history reset, database lifecycle and protected-boundary validation.

### Superseded source

- Pull request **#255** was closed without merge after PR #256 replaced it with the latest validated integration source.

## 3. Initial production backend deployment

Temporary production release pull request **#257** deployed the backend from exact merged commit `39255e9ea56178ef2b362a089bd0788846dcbbd7`.

### Production run

- Workflow run: `30694718590`
- Migration applied: `202608010600_finance_console_completion.sql`
- Edge Functions deployed:
  - `admin-verify-exam-payment`
  - `finance-gateway-status`

### Verified controls

- `PAYSTACK_SECRET_KEY` remained server-side;
- the approved Finance Console migration was the only pending production migration;
- seven new finance permission definitions were installed;
- high-impact Examination Administrator permissions remained denied by default;
- pricing-policy, access-grant, coupon-target and recovery-action tables were installed;
- existing examination prices were backfilled into pricing policies;
- browser writes remained permission-checked and RPC-controlled;
- protected order and fulfilment function definitions were unchanged;
- historical order, payment, bulk-order, bulk-payment and coupon record counts did not decrease;
- both new Edge Functions failed closed without authentication;
- no migration remained pending.

### Evidence

- Artifact: `finance-console-completion-production-evidence`
- Artifact ID: `8816859581`
- Digest: `sha256:3a939929edf3a9342832052d8a16b9c542cd411f88df68381f3f1c48193e4095`
- Retention: through 31 August 2026

PR #257 was closed without merge so its temporary release workflow was not retained.

## 4. Frontend publication and verification

Pull request **#258** triggered the authorised `main` GitHub Pages workflow to publish the current validated `supabase-integration` frontend.

- Main publication commit: `ea411c4b0dd8f4549b9a863271256256f93ced70`

Temporary verification pull request **#259** then rebuilt the exact approved application source and compared the live GitHub Pages files with the local production build.

### Frontend verification run

- Workflow run: `30694987264`
- Live `index.html`: exact byte-for-byte match
- Referenced application assets: exact byte-for-byte match
- Finance Console completion markers: present in the live JavaScript

### Evidence

- Artifact: `finance-console-completion-frontend-production-evidence`
- Artifact ID: `8816942710`
- Digest: `sha256:2bbfa597573a5e7c9d36b291dc785a71f552df775a25ada97407653f5a224754`
- Retention: through 31 August 2026

PR #259 was closed without merge because its files were verification-only controls.

## 5. Commissioning defect and corrective hotfix

Controlled production commissioning identified a PostgreSQL defect in `get_finance_console_completion_snapshot(...)`.

The original `couponPerformance` expression nested `count()` and `sum()` directly inside `jsonb_agg()`, causing PostgreSQL error `42803: aggregate function calls cannot be nested` when the live dashboard snapshot was executed.

No commissioning transaction committed while this defect was present.

### Hotfix source

Pull request **#261 — Fix Finance Console snapshot coupon aggregation** introduced a forward-only database correction:

- Migration: `202608011130_finance_console_snapshot_coupon_aggregate_fix.sql`
- Merged `supabase-integration` commit: `4175b8f6cda2e3f1bc34ade449d43490ef12e21b`

The hotfix:

- pre-aggregates coupon redemption and discount metrics per coupon;
- constructs the coupon JSON array from scalar grouped values;
- patches only the `couponPerformance` field of the existing snapshot RPC;
- keeps the helper inaccessible as a standalone authenticated browser RPC;
- preserves authenticated execution of the main Finance Console snapshot RPC;
- does not change frontend, Edge Functions, checkout, Paystack, order, payment, pricing, receipt, entitlement or fulfilment authority.

### Hotfix validation

- Workflow run: `30697625160`
- Complete isolated Supabase migration-history reset: passed
- Corrected helper returned a JSON array: passed
- Invalid nested aggregate expression absent: passed
- Snapshot used pre-aggregated coupon metrics: passed
- Direct authenticated helper execution denied: passed
- Authenticated snapshot execution preserved: passed

Validation evidence:

- Artifact: `finance-console-snapshot-aggregate-fix-evidence`
- Artifact ID: `8817778158`
- Digest: `sha256:ef5882663edb220417e24d0f6461adb1e43b2afacd66809c8f7d11d3876d6cfa`
- Retention: through 31 August 2026

### Hotfix production deployment

Temporary production release pull request **#262** deployed only the approved hotfix migration.

- Workflow run: `30697967605`
- Exact approved source: `4175b8f6cda2e3f1bc34ade449d43490ef12e21b`
- Only pending migration: confirmed
- Live Super Administrator snapshot call: passed
- `dashboard.couponPerformance`: returned as a JSON array
- Protected checkout and fulfilment hashes: unchanged
- Order, payment, coupon, redemption and examination-price counts: unchanged
- Remote migration ledger: clean

Production evidence:

- Artifact: `finance-console-snapshot-hotfix-production-evidence-v2`
- Artifact ID: `8817872887`
- Digest: `sha256:1eb1ad276d663dfdf00169111c3c0aa2ad8d6b730598467892336757648c4c7a`
- Retention: through 31 August 2026

PR #262 was closed without merge so its temporary deployment files were not retained.

## 6. Final production UAT and commissioning

Temporary commissioning pull request **#260** executed the final controlled UAT against corrected source commit `4175b8f6cda2e3f1bc34ade449d43490ef12e21b`.

### Commissioning run

- Workflow run: `30698179751`
- Final result: passed

### Functional controls passed

- candidate Finance Console access denial;
- Examination Administrator default dashboard, receipt and export permissions;
- denial of high-impact Examination Administrator settings, reconciliation, recovery and adjustment permissions by default;
- complete Super Administrator Finance Console authority;
- temporary permission delegation and revocation;
- general finance settings update;
- advanced examination pricing;
- active promotional pricing;
- attempt and retake settings;
- advanced coupon conditions;
- selected programme and examination coupon targets;
- Finance Console snapshot and dashboard;
- export audit creation;
- receipt and recovery controls when eligible production records were available;
- finance audit creation inside the test transaction;
- unauthenticated denial for both Finance Console Edge Functions.

### Rollback and preservation

All write-capable commissioning actions executed inside one explicit database transaction followed by `ROLLBACK`.

Pre- and post-UAT hashes and counts matched for:

- finance settings;
- Finance Console role permissions;
- profile roles and account status;
- protected checkout and fulfilment functions;
- examination prices;
- coupons;
- individual examination orders and payments;
- consolidated orders and payments;
- Finance Console audit events;
- general audit logs.

Post-UAT cleanup confirmed:

- zero synthetic pricing policies;
- zero synthetic examination prices;
- zero synthetic coupons;
- zero synthetic finance audit records;
- zero retained high-impact Examination Administrator grants;
- transaction rolled back successfully.

### Live frontend and Edge Function verification

- Live `index.html`: exact match with the commissioned build
- Live JavaScript: exact match
- Live CSS: exact match
- Finance Console completion markers: present
- `admin-verify-exam-payment` without authentication: failed closed with HTTP 400
- `finance-gateway-status` without authentication: failed closed with HTTP 400
- No secret value was returned in either denial response

### Commissioning evidence

- Artifact: `finance-console-completion-production-commissioning-v7`
- Artifact ID: `8817942989`
- Digest: `sha256:332d24b74e7ac49c668df817f98bf90eeb78c3c5b0943cf2000a04837fbeb493`
- Retention: through 31 August 2026

PR #260 was closed without merge so its temporary UAT workflows and harnesses were not retained.

## 7. Production state at commissioning close

At commissioning close, production contained:

- 1 active Super Administrator;
- 0 active Examination Administrators;
- 8 active candidates;
- 48 individual examination orders;
- 32 individual examination payments;
- 1 consolidated order;
- 1 consolidated payment.

The commissioning harness temporarily assigned the Examination Administrator role to a second candidate through the authorised `update_agilecert_person_admin(...)` RPC. That role assignment existed only inside the rollback transaction. The post-UAT profile-role hash matched the pre-UAT hash, and production returned to zero active Examination Administrators.

## 8. Operational follow-up

A real staff account should be appointed as an active Examination Administrator before routine delegated Finance Console operations begin.

Recommended initial delegation:

- keep dashboard, receipt and export permissions enabled;
- keep settings, transaction reconciliation, access recovery and adjustment approval disabled until a named accountable officer is approved;
- grant any high-impact permission individually, with a written reason and periodic access review.

## 9. Final release decision

The Finance Console completion package is accepted as:

- merged into the controlled integration source;
- deployed to the production database and Edge Functions;
- published to the live GitHub Pages portal;
- corrected for the commissioning-discovered coupon aggregate defect;
- validated through complete migration resets and live production checks;
- commissioned through rollback-protected role and finance UAT;
- verified to preserve existing checkout, Paystack, order, payment, fulfilment and examination-runtime authorities.

**Final status: Production live and technically commissioned.**

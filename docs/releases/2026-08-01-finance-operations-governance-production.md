# Finance Operations and Governance — Production Release Record

**Release date:** 1 August 2026  
**Final status:** Production backend active, frontend published and verified  
**Application:** IIPM Examination Portal / AgileCert  
**Production source branch:** `supabase-integration`

## 1. Release summary

The Finance Operations and Governance Enhancement adds a controlled governance layer above the commissioned Finance Console.

The production package includes:

- an **Operations & Governance** workspace inside the Finance Console;
- finance operations cases with maker–checker review;
- two independent approvals for manual-payment, refund, reversal and adjustment cases;
- an immutable case-event timeline;
- case assignment, notes, decisions, cancellation and execution evidence;
- operational alert rules and alert administration;
- daily, weekly and monthly management-report schedules;
- report queueing through the existing controlled communications outbox;
- management scorecards for cases, approvals, deadlines, alerts and report schedules;
- dedicated least-privilege governance permissions.

The package records governance decisions and execution evidence. It does not directly alter payment, order, Paystack, fulfilment, access, certificate, price, coupon or finance-setting records.

## 2. Source integration

- Pull request: **#272 — Add Finance Operations and Governance Enhancement**
- Final validated head: `55bce60dc707a23ffe0a13f2684292c52e14cd90`
- Merged `supabase-integration` commit: `f2fbdc44f0ba36ff0d0af7da72b89cb78c4ed3ad`
- Changed files: 7

The approved source package contains:

- `.github/workflows/validate-finance-operations-governance.yml`;
- `docs/FINANCE_OPERATIONS_GOVERNANCE.md`;
- `src/components/AdminFinanceConsole.tsx`;
- `src/components/FinanceGovernancePanel.tsx`;
- `src/services/financeGovernanceService.ts`;
- `supabase/migrations/202608011500_finance_operations_governance.sql`;
- `supabase/tests/finance_operations_governance_smoke.sql`.

## 3. Development validation

Dedicated validation workflow run `30717619771` passed completely.

### Passed gates

- exact seven-file governance scope;
- protected checkout, Paystack, fulfilment, pricing, coupon and Finance Console completion authorities untouched;
- TypeScript validation and production frontend build;
- complete isolated Supabase migration-history reset;
- Examination Administrator governance view and case-submission defaults;
- denial of review, alert-management and report-scheduling permissions by default;
- requester self-approval denial;
- two independent approvals for high-impact cases;
- immutable case-event update and deletion denial;
- server-authoritative operational alert generation;
- scheduled-report queueing through the communications outbox;
- candidate access denial;
- direct authenticated table access denial;
- preservation of order, payment, coupon, redemption and examination-price record counts.

The final smoke test corrected two test-harness issues without weakening production controls:

1. `psql` variables were replaced with transaction-local test IDs because variable substitution does not occur inside dollar-quoted `DO` blocks.
2. The simulated `authenticated` role received access only to the test-session temporary ID table.

No production permission or table grant was changed by those test corrections.

## 4. Production backend deployment

Temporary release-control pull request **#276** deployed the backend from exact approved source commit `f2fbdc44f0ba36ff0d0af7da72b89cb78c4ed3ad`.

Because production already contained a later migration, the release used Supabase's controlled `--include-all` path and failed closed unless exactly one approved migration was pending.

### Deployment run

- Workflow run: `30718091692`
- Migration applied: `202608011500_finance_operations_governance.sql`
- Pending migration check: exactly one approved migration
- Migration result: applied successfully

### Captured pre-migration production baseline

- active Examination Administrators: 1;
- individual examination orders: 64;
- individual examination payments: 48;
- consolidated orders: 2;
- consolidated payments: 2;
- coupons: 24;
- coupon redemptions: 59;
- examination prices: 23;
- finance audit events: 7.

Hashes were also captured for:

- finance settings;
- non-governance finance role permissions;
- profile roles and active status;
- protected finance, checkout and fulfilment functions.

### Initial verifier correction

The migration intentionally extends `get_my_finance_console_access(...)` with governance access fields.

The initial post-deployment verifier incorrectly included this approved function change inside an unchanged-function hash. The migration itself had applied successfully, and all governance structure and permission checks completed before the comparison failed.

No rollback was required. The release control was converted to a read-only verifier that treated the access-snapshot extension as an intended change while continuing to protect checkout, fulfilment and Finance Console completion authorities.

### Initial deployment evidence

- Artifact: `finance-governance-production-evidence`
- Artifact ID: `8823975602`
- Digest: `sha256:f4c944d6d446d0d6c448dc1bf148cd89019039c168f377a2b1f658ca0608067c`
- Retention: through 31 August 2026

## 5. Final backend production verification

Read-only workflow run `30718213532` passed completely.

### Verified production authority

- migration version `202608011500` is recorded as applied;
- five governance permission definitions are active;
- Examination Administrators receive:
  - `finance.governance.view`;
  - `finance.cases.submit`;
- Examination Administrators remain denied by default:
  - `finance.cases.review`;
  - `finance.alerts.manage`;
  - `finance.reports.schedule`;
- all six governance tables exist;
- row-level security is enabled on all six governance tables;
- authenticated, anonymous and public roles have no direct governance-table grants;
- the case-event immutable trigger is active;
- all 12 governance RPCs are security-definer controlled;
- authenticated users can invoke the RPC layer subject to server-side permissions;
- anonymous users cannot invoke the governance RPCs;
- the internal report-scheduling helper remains browser-inaccessible;
- four initial operational alert rules are installed;
- no synthetic case, event, alert, schedule or report-run records remain.

### Verified preservation

The following matched the captured pre-migration production baseline:

- finance settings hash;
- all non-governance permission state;
- profile role and account-status hash;
- active Examination Administrator count;
- individual and consolidated order counts;
- individual and consolidated payment counts;
- coupon count;
- coupon-redemption count;
- examination-price count;
- finance audit-event count.

Protected checkout, fulfilment and Finance Console completion functions were not recreated by the governance migration.

The production migration ledger reported the remote database as current.

### Final backend evidence

- Artifact: `finance-governance-production-verification-evidence`
- Artifact ID: `8824012031`
- Digest: `sha256:0bf8229a9400c7cb2ecb2f9b6db0e3f570bdd548db6624ab628bf1accfbbf9a4`
- Retention: through 31 August 2026

PR #276 was closed without merge so its temporary release and verification controls were not retained.

## 6. Frontend publication

Pull request **#277 — Publish Finance Operations Governance frontend** changed only the release-marker comment in `.github/workflows/deploy.yml`.

- Publication merge commit: `dffb1f139672127b073a1e5f7f85fd4649c6799d`
- Deployment method: authorised `main` GitHub Pages workflow
- Built source: current validated `supabase-integration`

No application, database, payment, examination, certificate or Finance Console source file was changed by the publication trigger.

## 7. Live frontend verification

Temporary read-only verification pull request **#279** rebuilt exact approved source commit `f2fbdc44f0ba36ff0d0af7da72b89cb78c4ed3ad` and compared it with the live GitHub Pages application.

### Frontend verification run

- Workflow run: `30718804106`
- Production asset: `./assets/index-BaiIIgrJ.js`
- Expected SHA-256: `bb5da4f5fc25ba6e4af44589a98be63be34d6f165f598b093a1386ee0ecc72f3`
- Live SHA-256: `bb5da4f5fc25ba6e4af44589a98be63be34d6f165f598b093a1386ee0ecc72f3`
- Byte-for-byte match: passed

The live JavaScript contains the required governance markers:

- `get_finance_governance_snapshot`;
- `finance_create_operation_case`;
- `finance_decide_operation_case`;
- `finance_process_due_report_schedules`;
- `Operations & Governance`.

### Frontend evidence

- Artifact: `finance-governance-frontend-evidence`
- Artifact ID: `8824184293`
- Digest: `sha256:5efb2ac4215ddee5b1c7b64167ef9078e147a05caf51572aec05eea7062691c2`
- Retention: through 31 August 2026

PR #279 was closed without merge because its workflow and trigger were read-only verification controls.

## 8. Production access model

### Examination Administrator

Enabled by default:

- Finance Console access;
- existing revenue dashboard, receipt, export and transaction-review permissions;
- Operations & Governance workspace visibility;
- finance case submission;
- own-case timeline and permitted case visibility.

Restricted by default:

- reviewing or approving cases;
- executing approved governance cases;
- managing alert rules;
- resolving or suppressing alerts requiring alert-manager authority;
- creating or editing scheduled management reports;
- finance permission administration;
- direct changes to payments, orders, Paystack verification, access, fulfilment, certificates, prices, coupons or settings.

### Super Administrator

Super Administrators retain complete governance authority, including review, alert administration, scheduled reports and explicit delegation of supported permissions.

### Candidate

Candidate Finance Console and Governance access remains denied.

## 9. Operational use

On an authorised Examination Administrator account:

1. Sign out completely.
2. Close and reopen the portal, or press `Ctrl + F5`.
3. Sign in again.
4. Open **Admin Tools**.
5. Select **Finance Console**.
6. Open the **Operations & Governance** tab.

The Finance Console remains a separate tool from Finance and Sponsorship.

## 10. Final release decision

The Finance Operations and Governance Enhancement is accepted as:

- validated through a complete migration-history rebuild and lifecycle tests;
- merged into the controlled integration source;
- applied to the production database through an exact-migration release gate;
- verified against captured production baselines;
- published through the authorised GitHub Pages workflow;
- confirmed live through byte-for-byte application-bundle verification;
- least-privilege by default for Examination Administrators;
- denied to candidates;
- non-mutating to protected commerce, payment, fulfilment, certificate and historical finance records.

**Final status: Production live, verified and operationally ready.**

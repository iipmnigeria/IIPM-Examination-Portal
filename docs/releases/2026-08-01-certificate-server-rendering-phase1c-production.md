# Certificate Server Rendering Phase 1C — Production Release Record

**Release date:** 1 August 2026  
**Final status:** Production infrastructure live and verified; assignment activation remains deliberately disabled  
**Application:** IIPM Examination Portal / AgileCert  
**Production source branch:** `supabase-integration`

## 1. Release summary

Phase 1C introduces controlled server-side generation of print-quality certificate PDFs using approved Certificate Management Phase 1A masters and Phase 1B visual overlays.

The production package includes:

- authenticated certificate rendering through the `render-certificate-pdf` Supabase Edge Function;
- controlled resolution of published certificate-master assignments;
- an explicit per-assignment server-renderer switch that defaults to disabled;
- immutable first-managed-render binding of an issued certificate to one approved assignment and master version;
- SHA-256 verification of private certificate masters and approved institutional assets before rendering;
- percentage-based dynamic overlays for participant, programme, examination, certificate, verification, institution and signatory fields;
- server-generated verification QR codes;
- one-page PDF, PNG and JPEG master support;
- privacy-minimised render-job evidence without retaining generated PDF bytes;
- a Server Rendering administration workspace inside Certificate Management;
- a separate `certificate.render.manage` permission for renderer activation and suspension.

The release does not automatically switch any certificate to the new renderer. All assignments remain on the existing renderer until a separately authorised Super Administrator explicitly commissions an approved assignment.

## 2. Source integration

- Pull request: **#278 — Add Phase 1C server-side certificate rendering**
- Final validated source head: `597dd89e5ab7e3834c5e8c06a5f44649d3c3e383`
- Merged `supabase-integration` commit: `0e42b3ea39835f897e04c13aece5ec08c3d7c56d`
- Approved changed files: 12

The source package contains:

- `.github/workflows/validate-certificate-server-rendering-phase1c.yml`;
- `docs/CERTIFICATE_SERVER_RENDERING_PHASE1C_SCOPE.md`;
- `src/components/AdminCertificateManagementLauncher.tsx`;
- `src/components/AdminCertificateRendererConsole.tsx`;
- `src/services/certificatePdfService.ts`;
- `src/services/certificateRendererAdminService.ts`;
- `src/services/serverCertificatePdfService.ts`;
- `supabase/functions/render-certificate-pdf/index.ts`;
- `supabase/functions/render-certificate-pdf/render.ts`;
- `supabase/functions/render-certificate-pdf/render.test.ts`;
- `supabase/migrations/202608012200_certificate_server_rendering_phase1c.sql`;
- `supabase/tests/certificate_server_rendering_phase1c_smoke.sql`.

Temporary SQL-repair and materialisation controls were removed before final validation. The approved branch contained only the 12 Phase 1C files above.

## 3. Development validation

Dedicated workflow run `30719604412` passed completely against exact source commit `597dd89e5ab7e3834c5e8c06a5f44649d3c3e383`.

### Passed gates

- exact 12-file Phase 1C scope;
- protected certificate issuance, examination, payment, Paystack, fulfilment and public-verification authorities untouched;
- frontend TypeScript validation;
- Phase 1C browser-module compilation;
- complete production application build;
- Deno type checking for the renderer Edge Function;
- deterministic one-page PDF rendering tests;
- complete isolated Supabase migration-history rebuild;
- Phase 1A Certificate Management regression smoke test;
- Phase 1B Visual Designer regression smoke test;
- Phase 1C renderer authority and least-privilege smoke test;
- immutable render-binding enforcement;
- candidate ownership enforcement;
- explicit legacy-fallback behaviour when no assignment is enabled;
- fail-closed handling for assigned-master, digest, asset, overlay and renderer failures.

### SQL correction

The initial Phase 1C migration used an invalid composite-row assignment while capturing the assignment's pre-update audit state. It was corrected to load the row into its declared row type and then convert that value to JSONB.

The correction changed only the renderer-activation function's row-loading syntax. It did not alter permissions, activation criteria, certificate records, payment records, examinations, eligibility, issuance or public verification.

### Development evidence

- Artifact: `certificate-server-rendering-phase1c-evidence`
- Artifact ID: `8824454621`
- Digest: `sha256:7caf37ffa4c7ebf211a4e8e094c12924ce1df044deabedd899e21c4574d8f95c`
- Retention: through 31 August 2026

## 4. Production backend and Edge Function release

Temporary release-control pull request **#282 — Deploy Certificate Server Rendering Phase 1C to production** deployed from exact approved source commit `0e42b3ea39835f897e04c13aece5ec08c3d7c56d`.

### Production release run

- Workflow run: `30719842024`
- Migration applied: `202608012200_certificate_server_rendering_phase1c.sql`
- Edge Function deployed: `render-certificate-pdf`
- Pending migration check: exactly one approved migration
- Final migration-ledger state: remote database current

### Pre-migration baseline

Before applying the migration, the workflow captured counts and hashes for:

- protected certificate eligibility, issuance, status and verification functions;
- protected examination order, payment and fulfilment functions;
- Phase 1A master-resolution authority;
- Phase 1B overlay-validation and design-authority functions;
- legacy certificate templates;
- eligibility records and issued certificates;
- certificate audit events;
- examination attempts;
- individual and consolidated orders and payments;
- coupons;
- master templates, versions, institutional assets and assignments;
- master-audit events;
- overlay schemas;
- assignment scope and resolution authority;
- all existing certificate permission definitions and role permissions excluding the new Phase 1C permission.

### Verified live Phase 1C authority

The production verifier confirmed:

- migration version `202608012200` is recorded as applied;
- all seven renderer-control columns exist on certificate-master assignments;
- the `certificate.render.manage` permission definition is active;
- the Examination Administrator permission row exists and remains denied by default;
- both Phase 1C tables exist:
  - `agilecert_certificate_render_bindings`;
  - `agilecert_certificate_render_jobs`;
- row-level security is enabled on both tables;
- authenticated, anonymous and public roles have no direct table grants;
- the immutable render-binding trigger is active;
- all six Phase 1C functions are security-definer controlled;
- authenticated invocation is limited to the intended RPC surface and remains subject to server-side ownership and permission checks;
- anonymous invocation of the Phase 1C functions is denied;
- the deployed Edge Function rejects unauthenticated requests;
- no certificate-master assignment was renderer-enabled;
- no render binding was created;
- no render job was created.

### Verified production preservation

The complete post-deployment comparison matched the captured baseline for:

- protected function count and definition hash;
- legacy certificate-template count;
- eligibility-record count;
- issued-certificate count;
- certificate audit-event count;
- examination-attempt count;
- individual and consolidated order and payment counts;
- coupon count;
- master-template, version, asset and assignment counts;
- master-audit-event count;
- overlay-schema hash;
- assignment-authority hash;
- all pre-existing certificate permission definitions and role permissions.

No certificate, examination, payment, Paystack, fulfilment, master, overlay, assignment or historical audit record was changed by the release.

### Backend production evidence

- Artifact: `certificate-server-rendering-phase1c-production-evidence`
- Artifact ID: `8824511006`
- Digest: `sha256:7e3aee36369b008749572446050e83e1e08691b0a12b68fa8134f04b66e1e067`
- Retention: through 31 August 2026

PR #282 was closed without merge because its two files were disposable release controls.

## 5. Renderer operating boundary

### No enabled assignment

When an authenticated candidate downloads an active certificate and no assignment has been explicitly enabled for server rendering:

1. the server records an explicit legacy-fallback decision only when the Phase 1C render context is invoked;
2. the Edge Function returns `LEGACY_RENDER_REQUIRED` with `NO_RENDERER_ASSIGNMENT`;
3. the portal continues through the existing approved client-side renderer.

This preserves current certificate delivery while controlled commissioning remains pending.

### Enabled assignment

After a separately authorised activation, the server renderer will proceed only when:

- the assignment is active;
- the master version is published;
- print quality has passed or received a formal waiver;
- the master format is PDF, PNG or JPEG;
- the master has an immutable SHA-256 digest;
- the Phase 1B overlay passes server validation;
- every referenced asset is approved, institution-matched, digest-protected and PNG or JPEG;
- the requester owns the active issued certificate or has authorised certificate-administration access.

Once a managed certificate is first rendered, its binding to the assignment and master version is immutable.

### Fail-closed behaviour

After an assignment is enabled, the portal does not silently fall back to another layout when integrity fails. A changed master digest, changed overlay hash, unavailable asset, changed assignment state, unsupported format or rendering failure stops the managed render and records controlled evidence.

## 6. Frontend publication

Pull request **#283 — Publish Certificate Server Rendering Phase 1C frontend** changed only the release-marker comment in `.github/workflows/deploy.yml`.

- Publication merge commit: `036ca670eb22cc59a0759cdba1d59383185602f3`
- Deployment method: authorised `main` GitHub Pages workflow
- Built source: current validated `supabase-integration`

No application, database, Edge Function, examination, payment or certificate source file was changed by the publication trigger.

## 7. Live frontend verification

Temporary read-only pull request **#284 — Verify Certificate Server Rendering Phase 1C frontend** rebuilt exact approved source commit `0e42b3ea39835f897e04c13aece5ec08c3d7c56d` and compared its production bundle with the live portal.

### Final verification run

- Workflow run: `30720016492`
- Production asset: `./assets/index-DBSgIRsr.js`
- Expected SHA-256: `ed1c50edd98484de10c2b0aba66bccbb22f5956c9678cee30b563e4385aaec06`
- Live SHA-256: `ed1c50edd98484de10c2b0aba66bccbb22f5956c9678cee30b563e4385aaec06`
- Phase 1C runtime markers: verified
- Byte-for-byte match: passed

The live bundle contains the expected production runtime markers for:

- the Server Rendering administration workspace;
- `certificate.render.manage`;
- the Phase 1C client identifier;
- `LEGACY_RENDER_REQUIRED`;
- the `render-certificate-pdf` Edge Function route.

The first read-only verifier attempt checked a TypeScript export name that Vite correctly minified away. The verifier was corrected to use stable runtime strings. No production source or deployed asset was changed by that test-only correction.

### Frontend evidence

- Artifact: `certificate-server-rendering-phase1c-frontend-evidence`
- Artifact ID: `8824564622`
- Digest: `sha256:c776484b04169ce096f588949bfb5853eeb570cb8f39285d829f61158ca91d0f`
- Retention: through 31 August 2026

PR #284 was closed without merge because its workflow and trigger were disposable read-only controls.

## 8. Production access model

### Super Administrator

Super Administrators can:

- view the Server Rendering workspace;
- review renderer readiness and recent render evidence;
- explicitly enable or suspend an approved assignment;
- record the required activation or suspension reason;
- delegate the separate renderer-management permission where organisational policy permits.

### Examination Administrator

Examination Administrators can use their existing Certificate Management viewing authority to review renderer status where permitted.

They do not receive `certificate.render.manage` by default and therefore cannot:

- enable server rendering for an assignment;
- suspend an enabled assignment;
- bypass print-quality, digest, overlay or asset-readiness requirements;
- alter immutable certificate render bindings;
- complete server render jobs with service-role authority.

### Candidate

Candidates:

- cannot access the Certificate Management console;
- can request a PDF only for their own active issued certificate;
- continue through the existing renderer while no server-rendered assignment is enabled;
- cannot select, activate, replace or modify certificate masters, overlays, assets or assignments.

## 9. Commissioning status

The Phase 1C infrastructure is live, but commissioning is intentionally separate from deployment.

At release completion:

- renderer-enabled assignments: **0**;
- managed render bindings: **0**;
- render jobs created by deployment: **0**.

Before enabling the first assignment, an authorised Super Administrator should confirm:

1. the institution and certificate category;
2. the published master version;
3. the print-quality result or approved waiver;
4. the final Phase 1B overlay;
5. all logo, seal, signature and watermark assets;
6. the master and asset SHA-256 digests;
7. a controlled test certificate and printed proof;
8. the activation reason and rollback authority.

Activation should begin with one narrowly scoped examination or programme assignment rather than a global assignment.

## 10. Final release decision

Certificate Server Rendering Phase 1C is accepted as:

- fully validated through deterministic PDF tests and a complete migration-history rebuild;
- merged into the controlled integration source;
- applied to the production database through an exact one-migration release gate;
- deployed as an authenticated Supabase Edge Function;
- verified against captured production baselines;
- published through the authorised GitHub Pages workflow;
- confirmed live through byte-for-byte bundle verification;
- least-privilege by default;
- non-mutating to protected certificate, examination, payment, Paystack, fulfilment and historical records;
- safely inactive until explicit assignment commissioning.

**Final status: Production infrastructure live, verified and ready for controlled assignment commissioning.**
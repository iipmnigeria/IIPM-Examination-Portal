# Certificate Master Bootstrap Phase 1D

## Package

**Phase 1D — Approved CIPMN Master Bootstrap and Isolated Pilot Preparation**

Phase 1D converts the already approved CIPMN completion-certificate composition in `src/services/cipmnCertificateRenderer.ts` into a deterministic, immutable master PDF and a controlled Phase 1B overlay contract suitable for the Phase 1C server renderer.

This package prepares the source artifact and template-contract authority. It does not write production template records, upload the master file, create an assignment, enable the renderer or generate a production certificate.

## Approved design source

The bootstrap does not introduce a new certificate design. It reproduces the existing approved CIPMN landscape certificate, including:

- IIPM and CIPMN institutional identity;
- green, gold and red print borders;
- Certificate of Completion heading;
- collaboration wording;
- score and certificate-information panels;
- the approved Programme Coordinator / Executive Director signature;
- QR-verification area and digital-verification notice.

The source renderer remains unchanged and continues to serve as the legacy fallback until a later controlled pilot assignment is explicitly commissioned.

## Static and dynamic boundary

Fixed institutional artwork is embedded directly into the one-page PDF master:

- logos;
- signature;
- borders and decorative marks;
- static headings and explanatory wording;
- information-box shells and labels;
- signatory name and title;
- scan and verification instructions.

Only these eight issued-certificate values remain dynamic:

1. participant name;
2. examination/module title;
3. examination/module code;
4. score;
5. completion date;
6. certificate number;
7. verification QR code;
8. verification code.

No external asset record is required for this first managed master because the fixed, approved logos and signature are embedded in the immutable PDF. Future template versions may use the separate private asset library where appropriate.

## Deterministic artifact contract

The generator creates:

- `cipmn-approved-completion-master-v1.pdf`;
- `cipmn-approved-completion-overlay-v1.json`;
- `cipmn-approved-completion-manifest-v1.json`;
- a managed-render sample PDF during validation;
- a machine-readable quality test report.

The artifact uses:

- one A4 landscape PDF page;
- fixed document metadata and file identifier;
- reproducible embedded source assets;
- an immutable SHA-256 digest;
- percentage-based overlay coordinates;
- standard embedded PDF fonts through the Phase 1C renderer.

## Print-quality validation

The dedicated test requires:

- deterministic master bytes and digest across repeated generation;
- one-page A4 landscape dimensions;
- non-empty print-quality PDF output;
- unique overlay IDs and field bindings;
- all overlay boxes within the page;
- exact alignment between the eight required fields and the overlay;
- zero external asset references;
- successful Phase 1C managed rendering;
- long participant-name fitting;
- long examination-title fitting;
- server-generated verification QR code;
- one-page managed output with the original page dimensions preserved.

Deno-specific document and assertion types are explicit so the generator and its quality tests are checked under the same strict runtime used by the production renderer.

## Controlled template contract authority

Phase 1D adds `certificate_admin_set_template_contract(...)` so authorised template managers can define the exact required dynamic fields and print-quality rules before design review.

The RPC:

- requires `certificate.templates.manage`;
- operates only on draft or in-review templates;
- accepts only active dynamic-field definitions;
- rejects duplicate and unknown fields;
- requires a supported master format;
- requires 150–2400 minimum print DPI;
- requires a single-page master;
- requires long-name and QR scan testing;
- records an immutable certificate master audit event;
- grants no anonymous or direct table authority.

It does not publish a version, assign a template or enable server rendering.

## Production commissioning boundary

After this source package passes and is merged, a separate fail-closed commissioning control may:

1. generate the exact validated master and manifest;
2. select the CIPMN examination with the smallest matching active-certificate population;
3. upload the PDF to the private `certificate-masters` bucket;
4. create the institution/category/template/version records through controlled authority;
5. set the eight-field template contract;
6. save and validate the overlay;
7. record print-quality review and publish the version;
8. create one examination-specific assignment;
9. enable only that assignment after all preservation checks pass.

A global assignment is prohibited for the first pilot. Commissioning must create no synthetic issued certificate, payment, order, entitlement, render binding or render job.

## Preserved systems

Phase 1D does not change:

- certificate eligibility, issuance, numbering, status or verification;
- examination identity, attempts, results, pass marks or proctoring;
- pricing, checkout, payments, Paystack or fulfilment;
- the approved legacy CIPMN renderer;
- any existing production certificate, master, assignment or audit record.

## Release boundary

This pull request is source generation, contract authority and validation only. Production migration deployment, artifact upload, master registration, quality approval, assignment and renderer activation remain separate controlled actions.

# Certificate Management Console — Phase 1A

## Purpose

Phase 1A introduces a controlled, multi-institution Certificate Management Console for every certificate category issued through the IIPM Examination Portal. It is not limited to CIPMN programmes or to one certificate design.

The console extends the existing Certificate Authority administration. Existing eligibility, issuance, payment, examination, verification and lifecycle records remain authoritative and unchanged.

## Supported certificate administration model

### Issuing institutions

Certificate masters and institutional assets belong to an issuing institution. The initial institutions are:

- Integrated Institute of Professional Management (IIPM)
- Chartered Institute of Project Managers of Nigeria (CIPMN)

Additional institutions, partners and awarding bodies can be registered without application-code changes.

### Certificate categories

The initial categories are:

- Certificate of Completion
- Certificate of Achievement
- Professional Certificate

Categories are database-managed and extensible. Future categories may include membership certificates, licences, fellowships, accreditation certificates and other approved credentials.

## Phase 1A capabilities

### Master template administration

Authorised administrators can:

- create an institution- and category-specific template definition;
- upload a print-ready PDF, SVG, PNG or JPEG master;
- retain each upload as an immutable version;
- review the uploaded master against quality evidence;
- submit, return, approve, publish, supersede or retire a version;
- preserve the source filename, MIME type, size, SHA-256 digest and image dimensions when available.

PDF and SVG are the preferred master formats. PNG and JPEG are accepted only where the uploaded source is genuinely suitable for print.

### Institutional asset library

Institutional logos, seals, signatures, watermarks, backgrounds and emblems are maintained separately from frontend source code.

Each asset:

- belongs to an issuing institution;
- is uploaded into private storage;
- receives an immutable version number;
- records file integrity and dimensions;
- passes through draft, approval, rejection and retirement states;
- is never silently overwritten by a later file.

### Approval workflow

Template versions follow this controlled sequence:

`Draft → In Review → Approved → Published → Superseded/Retired`

Reviewers can request changes or reject a version. Approval requires a passed or explicitly waived print-quality review. Publication is a distinct restricted action.

The quality record can retain evidence for:

- side-by-side comparison with the approved source;
- page size and single-page output;
- long participant-name tests;
- long programme-title tests;
- logo, seal and signature clarity;
- QR-code scanning;
- physical print review;
- reviewer notes and approval references.

A successful TypeScript build or PDF generation test is not treated as visual approval.

### Template assignment

A published template version can be assigned at one of three scopes:

1. Examination-specific
2. Programme-specific
3. Global category default

Resolution uses the most specific active assignment. An examination assignment overrides a programme assignment; a programme assignment overrides a global category default.

Assignments are effective-dated, auditable and cannot point to an unpublished version.

### Permissions

The console has dedicated permissions separate from Finance Console authority and certificate issuance authority.

Examination Administrators receive view, template-draft, template-review and asset-upload access by default. Restricted actions—including institution governance, approval, publication, assignments, asset approval and permission management—remain with Super Administrators unless explicitly delegated.

Certificate permission-management authority cannot be delegated to Examination Administrators.

### Audit and storage security

- Master files are stored privately in `certificate-masters`.
- Institutional assets are stored privately in `certificate-assets`.
- Direct browser access to certificate administration tables is revoked.
- Browser writes use permission-checked security-definer RPCs.
- Administration audit events are immutable.
- Existing issued certificates are not rewritten when a master is replaced or retired.

## Existing authority preserved

Phase 1A does not alter:

- candidate certificate eligibility;
- examination pass marks or results;
- examination integrity decisions;
- certification product prices or payments;
- Paystack processing;
- certificate numbers;
- verification codes;
- issued certificate records;
- revocation or suspension records;
- public certificate verification;
- current production PDF renderers.

The existing Certificate Authority workspace remains available as **Issuance & Lifecycle** inside the unified console.

## Server-side renderer preparation

Phase 1A includes a private resolver that can identify the appropriate published master by certificate category, examination and programme. It is not executable by browser roles and is reserved for a later controlled server-side renderer.

## Deferred to Phase 1B

Phase 1B should add:

- visual drag-and-drop field mapping;
- overlay schema administration;
- font, alignment, wrapping and auto-fit rules;
- live stress-test previews;
- approved asset placement;
- server-side PDF rendering from uploaded masters;
- generated-certificate storage and immutable renderer-version binding;
- production cutover only after formal visual and physical print approval.

## Release boundary

This package is development and validation only. Merging the source does not by itself apply the production migration, deploy storage policies or publish a frontend release. Production activation must remain a separate, controlled release with migration, access and visual acceptance evidence.

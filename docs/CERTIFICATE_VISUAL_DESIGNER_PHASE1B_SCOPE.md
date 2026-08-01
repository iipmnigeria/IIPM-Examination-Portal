# Certificate Management Console Phase 1B

## Visual Certificate Designer, Dynamic Field Mapping and Master Preview

Phase 1B extends the Phase 1A master-template foundation with a protected visual design workspace. It prepares approved master versions for a later server-side renderer without activating a new renderer or changing any issued credential.

## Delivered capabilities

- drag-and-position visual overlays on immutable PDF, SVG, PNG and JPEG masters;
- exact percentage-based X, Y, width and height controls for print portability;
- typography controls for font family, point size, weight, alignment, colour, line height, spacing, rotation, opacity, prefix, suffix and uppercase display;
- extensible dynamic-field definitions for participant, programme, assessment, certificate, verification, institution and signatory content;
- approved asset binding for institutional logos, seals and signatures;
- representative sample data for long names, programme titles, dates, scores, certificate numbers and verification codes;
- live verification QR preview generated from sample verification data;
- safe-area and grid overlays plus 75%, 100% and 125% design zoom;
- server-side validation for required fields, duplicate mappings, page bounds, font sizes and approved institutional assets;
- preview profiles and validation reports retained separately from issued certificate records;
- immutable audit events for each saved design.

## Editing boundary

Only template versions in `draft` or `changes_requested` status can be changed. Approved, published, superseded, rejected and retired versions remain read-only in the designer.

The underlying master file remains immutable. Phase 1B stores only:

- `overlay_schema` visual mapping metadata;
- designer schema version and audit timestamps;
- non-authoritative preview sample data;
- preview preferences;
- the latest design-validation report.

## Dynamic field model

The initial field palette includes:

- participant name;
- certificate title;
- programme title and code;
- examination title and code;
- score and grade;
- issue and completion dates;
- certificate number and verification code;
- verification QR code;
- institution name, logo and seal;
- authorised signature, signatory name and title;
- repeatable approved static text.

The field registry is data-driven, so future certificate data fields can be introduced without rebuilding the designer interface.

## Security and authority

- viewing requires `certificate.console.view`;
- saving requires `certificate.templates.manage`;
- all new tables use RLS and deny direct browser access;
- browser operations use security-definer RPCs with existing Certificate Management permissions;
- asset fields accept only approved assets belonging to the same issuing institution;
- every save writes to the immutable Phase 1A certificate master audit log;
- the existing server-side master resolver remains browser-inaccessible.

## Explicitly unchanged

Phase 1B does not modify or activate:

- certificate eligibility;
- certificate issuance;
- certificate numbers or verification codes;
- existing certificate PDF renderers;
- examination questions, answers, scores, attempts, integrity or pass marks;
- examination or certificate pricing;
- Paystack, payment verification, checkout or fulfilment;
- public certificate verification;
- historical issued certificates.

## Later renderer integration

A subsequent controlled phase may convert a published master plus its validated overlay into a server-side PDF. That future phase must preserve the existing issued-certificate authority, use server-issued data only, generate the existing verification destination, and pass physical print and visual approval before activation.

# Certificate Management Phase 1C Scope

## Package

**Phase 1C — Server-Side Certificate Rendering, Controlled Template Resolution and Print-Quality PDF Generation**

Phase 1C converts approved Phase 1A masters and Phase 1B overlays into a controlled server-rendering capability. It does not automatically replace the current certificate renderer. Every existing and future master assignment remains on the legacy renderer until a separately authorised administrator explicitly enables server rendering for that assignment.

## Delivered capability

- Private server-side loading of approved certificate masters and institutional assets.
- SHA-256 validation of every master and referenced asset before rendering.
- One-page PDF generation from approved PDF, PNG or JPEG masters.
- Percentage-based application of Phase 1B dynamic overlays.
- Text wrapping and automatic font-size reduction for long participant and programme names.
- Dynamic certificate, programme, examination, score, date, verification, institution and signatory fields.
- Server-generated verification QR code.
- Approved PNG/JPEG institutional logos, seals, signatures, watermarks and emblems.
- Immutable first-managed-render binding of an issued certificate to one assignment and master version.
- Privacy-minimised render-job evidence containing hashes, status, size and page count, but not retained PDF bytes.
- Administrator workspace for enabling, suspending and reviewing server-rendered assignments.

## Explicit activation boundary

Server rendering is enabled only when all of the following are true:

1. The master assignment is active.
2. The master version is published.
3. Print quality is passed or formally waived.
4. The master is PDF, PNG or JPEG.
5. The master has an immutable SHA-256 digest.
6. The Phase 1B overlay passes server-side validation.
7. Every referenced asset is approved, belongs to the issuing institution, has a SHA-256 digest and is PNG or JPEG.
8. A user with `certificate.render.manage` records an activation reason.

Examination Administrators do not receive `certificate.render.manage` by default. Super Administrators retain implicit authority, and any delegation remains explicit and auditable.

## Candidate rendering behaviour

- No renderer-enabled assignment: the Edge Function returns an explicit legacy-render instruction and the existing client-side renderer continues unchanged.
- Renderer-enabled assignment: the certificate is bound to the approved assignment and version, and the server renderer is used.
- Assigned master or asset integrity failure: rendering fails closed; the browser does not silently revert to another layout.
- Suspended assignment after a certificate has been bound: rendering fails closed until governance restores or deliberately replaces the approved authority in a later controlled phase.

## Print-quality boundary

Phase 1C supports one-page PDF, PNG and JPEG masters. SVG masters and SVG assets remain valid Phase 1A administration formats but are not activated for Phase 1C server rendering. This avoids non-deterministic SVG parsing and external-resource risks in the production renderer.

Only standard embedded PDF fonts are used in Phase 1C. Custom-font administration and embedding are outside this package.

## Preserved authorities

Phase 1C does not modify:

- certificate eligibility or issuance rules;
- issued certificate identity, number, verification code, status or revision authority;
- existing CIPMN and default client renderers except for the explicit managed-render attempt and legacy fallback decision;
- public certificate verification;
- examination results, pass marks, integrity controls or attempts;
- certificate or examination prices, checkout, Paystack, fulfilment or finance records;
- historical certificate records or previously generated PDFs.

## Production boundary

This pull request is development and validation only. It does not apply the production migration, deploy the `render-certificate-pdf` Edge Function, publish the frontend or enable any assignment. Those are separate controlled release and commissioning actions.

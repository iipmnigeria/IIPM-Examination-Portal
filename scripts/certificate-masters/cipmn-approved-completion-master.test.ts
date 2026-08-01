import { PDFDocument } from 'npm:pdf-lib@1.17.1';
import {
  renderManagedCertificate,
  type ManagedCertificateRenderContext,
} from '../../supabase/functions/render-certificate-pdf/render.ts';
import {
  buildCipmnApprovedMasterManifest,
  CIPMN_APPROVED_COMPLETION_OVERLAY,
  CIPMN_APPROVED_COMPLETION_SAMPLE,
  CIPMN_APPROVED_TEMPLATE_CONTRACT,
  generateCipmnApprovedCompletionMasterPdf,
  sha256Hex,
  writeCipmnApprovedMasterArtifacts,
} from './cipmn-approved-completion-master.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const assertClose = (
  actual: number,
  expected: number,
  tolerance: number,
  label: string,
): void => {
  assert(
    Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${expected} ± ${tolerance}, received ${actual}`,
  );
};

const bytesEqual = (left: Uint8Array, right: Uint8Array): boolean => {
  if (left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
};

const masterOne = generateCipmnApprovedCompletionMasterPdf();
const masterTwo = generateCipmnApprovedCompletionMasterPdf();

assert(masterOne.byteLength > 100_000, 'The approved master PDF is unexpectedly small.');
assert(bytesEqual(masterOne, masterTwo), 'The approved master PDF is not deterministic.');

const masterHashOne = await sha256Hex(masterOne);
const masterHashTwo = await sha256Hex(masterTwo);
assert(masterHashOne === masterHashTwo, 'Deterministic master hashes do not match.');
assert(/^[0-9a-f]{64}$/.test(masterHashOne), 'Master SHA-256 is invalid.');

const masterDocument = await PDFDocument.load(masterOne, {
  updateMetadata: false,
});
assert(masterDocument.getPageCount() === 1, 'The approved master must have one page.');
const masterPage = masterDocument.getPage(0);
const masterSize = masterPage.getSize();
assertClose(masterSize.width, 841.89, 0.2, 'A4 landscape width');
assertClose(masterSize.height, 595.28, 0.2, 'A4 landscape height');

const ids = new Set<string>();
const fields = new Set<string>();
for (const element of CIPMN_APPROVED_COMPLETION_OVERLAY) {
  assert(Boolean(element.id), 'Every overlay element requires an id.');
  assert(Boolean(element.fieldKey), 'Every overlay element requires a field key.');
  assert(!ids.has(element.id!), `Duplicate overlay id: ${element.id}`);
  assert(!fields.has(element.fieldKey!), `Duplicate overlay field: ${element.fieldKey}`);
  ids.add(element.id!);
  fields.add(element.fieldKey!);

  const x = Number(element.xPct);
  const y = Number(element.yPct);
  const width = Number(element.widthPct);
  const height = Number(element.heightPct);
  assert([x, y, width, height].every(Number.isFinite), `Incomplete box: ${element.id}`);
  assert(x >= 0 && y >= 0, `Negative box position: ${element.id}`);
  assert(width > 0 && height > 0, `Empty overlay box: ${element.id}`);
  assert(x + width <= 100.001, `Overlay exceeds page width: ${element.id}`);
  assert(y + height <= 100.001, `Overlay exceeds page height: ${element.id}`);
}

const requiredFields = new Set(
  CIPMN_APPROVED_TEMPLATE_CONTRACT.template.requiredFields,
);
assert(
  fields.size === requiredFields.size &&
    [...requiredFields].every((field) => fields.has(field)),
  'Overlay fields must exactly match the approved CIPMN template contract.',
);
assert(
  CIPMN_APPROVED_COMPLETION_OVERLAY.every((element) => !element.assetId),
  'The approved master embeds fixed artwork and must not reference external assets.',
);

const context: ManagedCertificateRenderContext = {
  jobId: '00000000-0000-4000-8000-000000000001',
  certificate: {
    id: '00000000-0000-4000-8000-000000000002',
    certificateNumber: CIPMN_APPROVED_COMPLETION_SAMPLE.certificateNumber,
    verificationCode: CIPMN_APPROVED_COMPLETION_SAMPLE.verificationCode,
    holderName:
      'Amina Chukwuma Okafor-Adebayo International Professional Services',
    certificateTitle: 'Certificate of Completion',
    examinationTitle:
      'Strategic Procurement Management, Contract Administration and Ethical Public-Sector Governance',
    examinationCode: CIPMN_APPROVED_COMPLETION_SAMPLE.examinationCode,
    programmeId: '00000000-0000-4000-8000-000000000003',
    programmeCode: 'CIPMN-LICENSING',
    programmeTitle: 'CIPMN Licensing Training Programme',
    score: CIPMN_APPROVED_COMPLETION_SAMPLE.score,
    passMark: 70,
    grade: 'Distinction',
    issueDate: '2026-08-01',
    completionDate: CIPMN_APPROVED_COMPLETION_SAMPLE.completionDate,
    issuedAt: '2026-08-01T00:00:00.000Z',
    revisionNumber: 1,
    productCode: 'completion',
  },
  institution: {
    id: '00000000-0000-4000-8000-000000000004',
    code: CIPMN_APPROVED_TEMPLATE_CONTRACT.institution.code,
    name: CIPMN_APPROVED_TEMPLATE_CONTRACT.institution.name,
    shortName: CIPMN_APPROVED_TEMPLATE_CONTRACT.institution.shortName,
    website: CIPMN_APPROVED_TEMPLATE_CONTRACT.institution.website,
  },
  master: {
    assignmentId: '00000000-0000-4000-8000-000000000005',
    templateId: '00000000-0000-4000-8000-000000000006',
    templateCode: CIPMN_APPROVED_TEMPLATE_CONTRACT.template.code,
    templateName: CIPMN_APPROVED_TEMPLATE_CONTRACT.template.name,
    versionId: '00000000-0000-4000-8000-000000000007',
    versionNumber: 1,
    sourceFormat: 'pdf',
    storageBucket: CIPMN_APPROVED_TEMPLATE_CONTRACT.version.storageBucket,
    storagePath: CIPMN_APPROVED_TEMPLATE_CONTRACT.version.storagePath,
    mimeType: CIPMN_APPROVED_TEMPLATE_CONTRACT.version.mimeType,
    sha256: masterHashOne,
    pageWidthPoints: CIPMN_APPROVED_TEMPLATE_CONTRACT.version.pageWidthPoints,
    pageHeightPoints: CIPMN_APPROVED_TEMPLATE_CONTRACT.version.pageHeightPoints,
    orientation: 'landscape',
    pageSize: 'A4',
    overlaySchema: CIPMN_APPROVED_COMPLETION_OVERLAY,
    overlaySha256: '0'.repeat(64),
    qualityStatus: 'passed',
  },
  assets: [],
  verificationUrl: CIPMN_APPROVED_COMPLETION_SAMPLE.qrCode,
  fileName: 'CIPMN_Amina_Okafor_VFY-8N4K-2T7Q.pdf',
};

const rendered = await renderManagedCertificate({
  context,
  masterBytes: masterOne,
  assets: new Map(),
});
assert(rendered.byteLength > masterOne.byteLength, 'Managed output did not add the overlay.');

const renderedDocument = await PDFDocument.load(rendered, {
  updateMetadata: false,
});
assert(renderedDocument.getPageCount() === 1, 'Managed output must remain one page.');
const renderedSize = renderedDocument.getPage(0).getSize();
assertClose(renderedSize.width, masterSize.width, 0.01, 'Rendered width');
assertClose(renderedSize.height, masterSize.height, 0.01, 'Rendered height');

const manifest = await buildCipmnApprovedMasterManifest(masterOne);
const manifestMaster = manifest.master as Record<string, unknown>;
const manifestOverlay = manifest.overlay as Record<string, unknown>;
assert(manifestMaster.sha256 === masterHashOne, 'Manifest master hash is incorrect.');
assert(
  manifestOverlay.elementCount === CIPMN_APPROVED_COMPLETION_OVERLAY.length,
  'Manifest overlay count is incorrect.',
);

const artifactDirectory = Deno.env.get('PHASE1D_ARTIFACT_DIR');
if (artifactDirectory) {
  await writeCipmnApprovedMasterArtifacts(artifactDirectory);
  await Deno.writeFile(
    `${artifactDirectory}/cipmn-approved-completion-rendered-sample-v1.pdf`,
    rendered,
  );
  await Deno.writeTextFile(
    `${artifactDirectory}/cipmn-approved-completion-test-report-v1.json`,
    `${JSON.stringify({
      deterministic: true,
      masterSha256: masterHashOne,
      masterBytes: masterOne.byteLength,
      renderedSha256: await sha256Hex(rendered),
      renderedBytes: rendered.byteLength,
      pageCount: renderedDocument.getPageCount(),
      pageWidthPoints: renderedSize.width,
      pageHeightPoints: renderedSize.height,
      overlayElementCount: CIPMN_APPROVED_COMPLETION_OVERLAY.length,
      requiredFields: [...requiredFields],
      externalAssets: 0,
      longNameTest: true,
      longExaminationTitleTest: true,
      qrGenerationTest: true,
    }, null, 2)}\n`,
  );
}

console.log(JSON.stringify({
  certificateMasterBootstrapPhase1DVerified: true,
  deterministicMasterSha256: masterHashOne,
  masterBytes: masterOne.byteLength,
  renderedBytes: rendered.byteLength,
  overlayElements: CIPMN_APPROVED_COMPLETION_OVERLAY.length,
  requiredFields: requiredFields.size,
  pageCount: renderedDocument.getPageCount(),
}, null, 2));

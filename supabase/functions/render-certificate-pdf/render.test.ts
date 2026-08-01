import { PDFDocument } from 'npm:pdf-lib@1.17.1';
import {
  renderManagedCertificate,
  type ManagedCertificateRenderContext,
} from './render.ts';

type Assertion = (condition: unknown, message: string) => asserts condition;

const assert: Assertion = (condition, message) => {
  if (!condition) throw new Error(message);
};

const buildMaster = async (): Promise<Uint8Array> => {
  const document = await PDFDocument.create();
  const page = document.addPage([841.89, 595.28]);
  page.drawRectangle({
    x: 12,
    y: 12,
    width: 817.89,
    height: 571.28,
    borderWidth: 2,
  });
  return await document.save({ useObjectStreams: false });
};

const context = (): ManagedCertificateRenderContext => ({
  jobId: '10000000-0000-4000-8000-000000000001',
  certificate: {
    id: '20000000-0000-4000-8000-000000000001',
    certificateNumber: 'IIPM-2026-000184',
    verificationCode: 'VFY-8N4K-2T7Q',
    holderName:
      'AMINA CHUKWUMA OKAFOR-OLUWASEGUN ADEBAYO NWANKWO INTERNATIONAL',
    certificateTitle: 'Certificate of Achievement',
    examinationTitle:
      'Advanced Strategic Agile Project Leadership and Enterprise Transformation Examination',
    examinationCode: 'AGILE-PRO-001',
    programmeId: '30000000-0000-4000-8000-000000000001',
    programmeCode: 'CAPMP',
    programmeTitle:
      'Certified Agile Project Management Professional and Enterprise Transformation Programme',
    score: 86,
    passMark: 70,
    grade: 'Distinction',
    issueDate: '2026-08-01',
    completionDate: '2026-07-31',
    issuedAt: '2026-08-01T10:00:00Z',
    revisionNumber: 1,
    productCode: 'achievement',
  },
  institution: {
    id: '40000000-0000-4000-8000-000000000001',
    code: 'IIPM',
    name: 'Integrated Institute of Professional Management',
    shortName: 'IIPM',
    website: 'https://iipmi.org',
  },
  master: {
    assignmentId: '50000000-0000-4000-8000-000000000001',
    templateId: '60000000-0000-4000-8000-000000000001',
    templateCode: 'IIPM-ACHIEVEMENT',
    templateName: 'IIPM Achievement Master',
    versionId: '70000000-0000-4000-8000-000000000001',
    versionNumber: 1,
    sourceFormat: 'pdf',
    storageBucket: 'certificate-masters',
    storagePath: 'test/master.pdf',
    mimeType: 'application/pdf',
    sha256: 'a'.repeat(64),
    pageWidthPoints: 841.89,
    pageHeightPoints: 595.28,
    orientation: 'landscape',
    pageSize: 'A4',
    qualityStatus: 'passed',
    overlaySha256: 'b'.repeat(64),
    overlaySchema: [
      {
        id: 'holder',
        fieldKey: 'holderName',
        dataType: 'text',
        xPct: 12,
        yPct: 31,
        widthPct: 76,
        heightPct: 12,
        fontSizePt: 28,
        fontFamily: 'serif',
        fontWeight: 700,
        textAlign: 'center',
        color: '#0f2a4a',
        lineHeight: 1.05,
        letterSpacing: 0,
        rotation: 0,
        opacity: 1,
        uppercase: true,
      },
      {
        id: 'programme',
        fieldKey: 'programmeTitle',
        dataType: 'text',
        xPct: 16,
        yPct: 49,
        widthPct: 68,
        heightPct: 14,
        fontSizePt: 18,
        fontFamily: 'sans',
        fontWeight: 700,
        textAlign: 'center',
        color: '#0f2a4a',
        lineHeight: 1.05,
        letterSpacing: 0,
        rotation: 0,
        opacity: 1,
      },
      {
        id: 'number',
        fieldKey: 'certificateNumber',
        dataType: 'text',
        xPct: 8,
        yPct: 88,
        widthPct: 38,
        heightPct: 5,
        fontSizePt: 8,
        fontFamily: 'mono',
        fontWeight: 700,
        textAlign: 'left',
        color: '#334155',
        lineHeight: 1,
        letterSpacing: 0,
        rotation: 0,
        opacity: 1,
        prefix: 'Certificate No: ',
      },
      {
        id: 'qr',
        fieldKey: 'qrCode',
        dataType: 'qr',
        xPct: 82,
        yPct: 76,
        widthPct: 12,
        heightPct: 17,
        color: '#0f2a4a',
        opacity: 1,
      },
    ],
  },
  assets: [],
  verificationUrl:
    'https://iipmnigeria.github.io/IIPM-Examination-Portal/?verify=VFY-8N4K-2T7Q',
  fileName: 'IIPM_AMINA_VFY-8N4K-2T7Q.pdf',
});

Deno.test('renders one-page print PDF with long dynamic content and QR', async () => {
  const masterBytes = await buildMaster();
  const output = await renderManagedCertificate({
    context: context(),
    masterBytes,
    assets: new Map(),
  });

  assert(output.byteLength > masterBytes.byteLength, 'Rendered PDF should contain overlay data.');
  const rendered = await PDFDocument.load(output, { updateMetadata: false });
  assert(rendered.getPageCount() === 1, 'Managed certificate must remain one page.');
  assert(
    rendered.getTitle()?.includes('AMINA CHUKWUMA'),
    'Certificate metadata should contain the holder name.',
  );
  assert(
    rendered.getProducer()?.includes('phase1c-pdf-lib-1'),
    'Renderer version should be recorded in PDF metadata.',
  );
});

Deno.test('rejects an overlay element outside the certificate page', async () => {
  const invalid = context();
  invalid.master.overlaySchema = [
    {
      id: 'outside',
      fieldKey: 'holderName',
      dataType: 'text',
      xPct: 90,
      yPct: 10,
      widthPct: 20,
      heightPct: 10,
      fontSizePt: 12,
    },
  ];

  let rejected = false;
  try {
    await renderManagedCertificate({
      context: invalid,
      masterBytes: await buildMaster(),
      assets: new Map(),
    });
  } catch (error) {
    rejected = /outside the certificate page/i.test(
      error instanceof Error ? error.message : String(error),
    );
  }
  assert(rejected, 'Out-of-bounds overlay should fail closed.');
});

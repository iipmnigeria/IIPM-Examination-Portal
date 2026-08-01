/// <reference lib="deno.ns" />

import { jsPDF } from 'npm:jspdf@4.2.1';

type JsPdfDocument = InstanceType<typeof jsPDF>;
import type { CertificateOverlayElement } from '../../supabase/functions/render-certificate-pdf/render.ts';
import { IIPM_CERTIFICATE_LOGO_DATA_URI } from '../../src/assets/cipmnCertificateIipmLogo.ts';
import { CIPMN_CERTIFICATE_LOGO_DATA_URI } from '../../src/assets/cipmnCertificateCipmnLogo.ts';
import { BANITO_SIGNATURE_DATA_URI } from '../../src/assets/cipmnCertificateBanitoSignature.ts';

export const CIPMN_APPROVED_MASTER_FILENAME =
  'cipmn-approved-completion-master-v1.pdf';
export const CIPMN_APPROVED_OVERLAY_FILENAME =
  'cipmn-approved-completion-overlay-v1.json';
export const CIPMN_APPROVED_MANIFEST_FILENAME =
  'cipmn-approved-completion-manifest-v1.json';

export const CIPMN_APPROVED_TEMPLATE_CONTRACT = {
  institution: {
    code: 'IIPM-CIPMN',
    name: 'Integrated Institute of Professional Management in Collaboration with CIPMN',
    shortName: 'IIPM / CIPMN',
    legalName: 'Integrated Institute of Professional Management',
    countryCode: 'NG',
    website: 'https://iipmi.org',
  },
  category: {
    code: 'completion',
    name: 'Certificate of Completion',
    description:
      'Completion certificate for approved CIPMN licensing training modules delivered through IIPM.',
    requiresIdentityVerification: false,
    requiresScore: true,
    sortOrder: 20,
  },
  template: {
    code: 'CIPMN_COMPLETION_APPROVED',
    name: 'Approved CIPMN Licensing Module Completion Certificate',
    description:
      'Managed one-page A4 landscape master reproducing the approved CIPMN completion certificate composition.',
    orientation: 'landscape',
    pageSize: 'A4',
    requiredFields: [
      'holderName',
      'examinationTitle',
      'examinationCode',
      'score',
      'completionDate',
      'certificateNumber',
      'verificationCode',
      'qrCode',
    ],
    qualityStandard: {
      minimumPrintDpi: 300,
      masterFormats: ['pdf'],
      singlePageRequired: true,
      physicalPrintReviewRequired: true,
      longNameTestRequired: true,
      qrScanTestRequired: true,
      approvedLayoutSource: 'src/services/cipmnCertificateRenderer.ts',
      fixedArtworkEmbedded: true,
      referencedAssetsRequired: false,
    },
  },
  version: {
    sourceFormat: 'pdf',
    storageBucket: 'certificate-masters',
    storagePath: 'managed/cipmn/completion/v1/cipmn-approved-completion-master-v1.pdf',
    originalFilename: CIPMN_APPROVED_MASTER_FILENAME,
    mimeType: 'application/pdf',
    pageWidthPoints: 841.89,
    pageHeightPoints: 595.28,
  },
} as const;

export const CIPMN_APPROVED_COMPLETION_OVERLAY: CertificateOverlayElement[] = [
  {
    id: 'cipmn-holder-name',
    fieldKey: 'holderName',
    label: 'Participant name',
    dataType: 'text',
    xPct: 12.5,
    yPct: 39.5,
    widthPct: 75,
    heightPct: 8.5,
    fontSizePt: 23.5,
    fontFamily: 'serif',
    fontWeight: 700,
    textAlign: 'center',
    color: '#08523d',
    lineHeight: 1.02,
    uppercase: true,
    zIndex: 10,
  },
  {
    id: 'cipmn-examination-title',
    fieldKey: 'examinationTitle',
    label: 'Licensing module title',
    dataType: 'text',
    xPct: 12,
    yPct: 53,
    widthPct: 76,
    heightPct: 8.8,
    fontSizePt: 14.2,
    fontFamily: 'sans',
    fontWeight: 700,
    textAlign: 'center',
    color: '#be2b2d',
    lineHeight: 1.02,
    uppercase: true,
    zIndex: 20,
  },
  {
    id: 'cipmn-examination-code',
    fieldKey: 'examinationCode',
    label: 'Module code',
    dataType: 'text',
    xPct: 36,
    yPct: 59.2,
    widthPct: 28,
    heightPct: 4.2,
    fontSizePt: 8.7,
    fontFamily: 'sans',
    fontWeight: 500,
    textAlign: 'center',
    color: '#08523d',
    uppercase: true,
    zIndex: 30,
  },
  {
    id: 'cipmn-score',
    fieldKey: 'score',
    label: 'Score value',
    dataType: 'number',
    xPct: 49.2,
    yPct: 65.2,
    widthPct: 8.8,
    heightPct: 5.8,
    fontSizePt: 10.5,
    fontFamily: 'sans',
    fontWeight: 700,
    textAlign: 'left',
    color: '#08523d',
    zIndex: 40,
  },
  {
    id: 'cipmn-completion-date',
    fieldKey: 'completionDate',
    label: 'Date of completion',
    dataType: 'date',
    xPct: 34.8,
    yPct: 75,
    widthPct: 12.8,
    heightPct: 4.8,
    fontSizePt: 7.3,
    fontFamily: 'sans',
    fontWeight: 700,
    textAlign: 'left',
    color: '#08523d',
    uppercase: true,
    zIndex: 50,
  },
  {
    id: 'cipmn-certificate-number',
    fieldKey: 'certificateNumber',
    label: 'Certificate number',
    dataType: 'text',
    xPct: 56.2,
    yPct: 75,
    widthPct: 14.5,
    heightPct: 4.8,
    fontSizePt: 7.3,
    fontFamily: 'sans',
    fontWeight: 700,
    textAlign: 'left',
    color: '#08523d',
    zIndex: 60,
  },
  {
    id: 'cipmn-verification-qr',
    fieldKey: 'qrCode',
    label: 'Verification QR code',
    dataType: 'qr',
    xPct: 82.3,
    yPct: 70.6,
    widthPct: 9.8,
    heightPct: 13.8,
    color: '#08523d',
    zIndex: 70,
  },
  {
    id: 'cipmn-verification-code',
    fieldKey: 'verificationCode',
    label: 'Verification code',
    dataType: 'text',
    xPct: 80.8,
    yPct: 86.1,
    widthPct: 12.8,
    heightPct: 3.5,
    fontSizePt: 5.6,
    fontFamily: 'sans',
    fontWeight: 500,
    textAlign: 'center',
    color: '#475569',
    zIndex: 80,
  },
];

export const CIPMN_APPROVED_COMPLETION_SAMPLE = {
  holderName: 'Amina Chukwuma Okafor-Adebayo',
  examinationTitle: 'Procurement Management and Contract Administration',
  examinationCode: 'CIPMN-MOD-012',
  score: 86,
  completionDate: '2026-07-31',
  certificateNumber: 'CIPMN-2026-000184',
  verificationCode: 'VFY-8N4K-2T7Q',
  qrCode:
    'https://iipmnigeria.github.io/IIPM-Examination-Portal/?verify=VFY-8N4K-2T7Q',
};

const PAGE_WIDTH_MM = 297;
const CENTRE_X = PAGE_WIDTH_MM / 2;
const PRIMARY: [number, number, number] = [8, 82, 61];
const NAVY: [number, number, number] = [20, 43, 83];
const RED: [number, number, number] = [190, 43, 45];
const GOLD: [number, number, number] = [198, 147, 38];
const MUTED: [number, number, number] = [71, 85, 105];
const LIGHT_GREEN: [number, number, number] = [246, 250, 247];
const BORDER_GREEN: [number, number, number] = [5, 77, 57];
const BOX_BORDER: [number, number, number] = [191, 219, 205];

const drawCornerMark = (doc: JsPdfDocument, x: number, y: number): void => {
  doc.setFillColor(...BORDER_GREEN);
  doc.circle(x, y, 1.15, 'F');
  doc.setFillColor(...GOLD);
  doc.circle(x, y, 0.45, 'F');
};

const drawCalendarIcon = (doc: JsPdfDocument, x: number, y: number): void => {
  doc.setDrawColor(...PRIMARY);
  doc.setLineWidth(0.55);
  doc.roundedRect(x, y + 1.2, 6.4, 6.2, 0.7, 0.7, 'S');
  doc.line(x, y + 3.1, x + 6.4, y + 3.1);
  doc.line(x + 1.7, y, x + 1.7, y + 2.1);
  doc.line(x + 4.7, y, x + 4.7, y + 2.1);
  doc.setFillColor(...PRIMARY);
  doc.circle(x + 2, y + 4.7, 0.32, 'F');
  doc.circle(x + 4.4, y + 4.7, 0.32, 'F');
};

const drawCertificateIcon = (doc: JsPdfDocument, x: number, y: number): void => {
  doc.setDrawColor(...PRIMARY);
  doc.setLineWidth(0.5);
  doc.roundedRect(x, y, 7.2, 6.1, 0.6, 0.6, 'S');
  doc.line(x + 1.3, y + 1.7, x + 5.7, y + 1.7);
  doc.line(x + 1.3, y + 3.1, x + 4.7, y + 3.1);
  doc.circle(x + 6, y + 5.7, 1.35, 'S');
  doc.line(x + 5.4, y + 6.8, x + 5.1, y + 8.2);
  doc.line(x + 6.6, y + 6.8, x + 6.9, y + 8.2);
};

const drawInformationBoxShell = (
  doc: JsPdfDocument,
  x: number,
  y: number,
  width: number,
  label: string,
  icon: 'calendar' | 'certificate',
): void => {
  doc.setFillColor(...LIGHT_GREEN);
  doc.setDrawColor(...BOX_BORDER);
  doc.setLineWidth(0.35);
  doc.roundedRect(x, y, width, 14.2, 2, 2, 'FD');

  if (icon === 'calendar') {
    drawCalendarIcon(doc, x + 4.5, y + 3.2);
  } else {
    drawCertificateIcon(doc, x + 4.2, y + 3.1);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.7);
  doc.setTextColor(...MUTED);
  doc.text(label.toUpperCase(), x + 14.5, y + 5.2);
};

export const generateCipmnApprovedCompletionMasterPdf = (): Uint8Array => {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
    compress: false,
    putOnlyUsedFonts: true,
    precision: 4,
  });

  doc.setCreationDate(new Date('2026-08-01T00:00:00.000Z'));
  doc.setFileId('4349504D4E32303236303830314D5354');
  doc.setProperties({
    title: 'Approved CIPMN Licensing Module Completion Certificate Master',
    subject: 'Static approved artwork for managed certificate rendering',
    author: 'Integrated Institute of Professional Management',
    creator: 'AgileCert Certificate Master Bootstrap Phase 1D',
    keywords: 'IIPM,CIPMN,certificate,completion,managed master',
  });

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, 297, 210, 'F');

  doc.setDrawColor(...BORDER_GREEN);
  doc.setLineWidth(1.65);
  doc.roundedRect(6.2, 6.2, 284.6, 197.6, 2.4, 2.4, 'S');
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.42);
  doc.roundedRect(8.6, 8.6, 279.8, 192.8, 1.9, 1.9, 'S');
  doc.setDrawColor(...RED);
  doc.setLineWidth(0.35);
  doc.roundedRect(10.5, 10.5, 276, 189, 1.55, 1.55, 'S');
  drawCornerMark(doc, 8.6, 8.6);
  drawCornerMark(doc, 288.4, 8.6);
  drawCornerMark(doc, 8.6, 201.4);
  drawCornerMark(doc, 288.4, 201.4);

  doc.addImage(
    IIPM_CERTIFICATE_LOGO_DATA_URI,
    'JPEG',
    81,
    13.1,
    35,
    35,
    'iipm-logo',
    'FAST',
  );
  doc.addImage(
    CIPMN_CERTIFICATE_LOGO_DATA_URI,
    'JPEG',
    123,
    16.1,
    95,
    25.5,
    'cipmn-logo',
    'FAST',
  );
  doc.setFillColor(255, 255, 255);
  doc.rect(122.8, 15.8, 17.5, 26.2, 'F');
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.45);
  doc.line(125.5, 16, 125.5, 43.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.4);
  doc.setTextColor(...RED);
  doc.text('IN COLLABORATION WITH', CENTRE_X, 51.2, { align: 'center' });
  doc.setFontSize(7.2);
  doc.setTextColor(...PRIMARY);
  doc.text(
    'CHARTERED INSTITUTE OF PROJECT MANAGERS OF NIGERIA (CIPMN)',
    CENTRE_X,
    56.4,
    { align: 'center' },
  );

  doc.setFont('times', 'bold');
  doc.setFontSize(19.5);
  doc.setTextColor(...NAVY);
  doc.text('CERTIFICATE OF COMPLETION', CENTRE_X, 70.2, {
    align: 'center',
  });
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.55);
  doc.line(113.8, 73, 183.2, 73);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.8);
  doc.setTextColor(...MUTED);
  doc.text('This is to certify that', CENTRE_X, 82, { align: 'center' });

  doc.setDrawColor(194, 209, 221);
  doc.setLineWidth(0.32);
  doc.line(66, 99.5, 231, 99.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.7);
  doc.setTextColor(...MUTED);
  doc.text(
    'has successfully completed the CIPMN Licensing Training Module in',
    CENTRE_X,
    108.5,
    { align: 'center' },
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.1);
  doc.setTextColor(...MUTED);
  doc.text(
    'Delivered through IIPM in collaboration with CIPMN.',
    CENTRE_X,
    131.5,
    { align: 'center' },
  );

  doc.setFillColor(...LIGHT_GREEN);
  doc.setDrawColor(...BOX_BORDER);
  doc.setLineWidth(0.38);
  doc.roundedRect(125.2, 136, 46.6, 12.2, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...MUTED);
  doc.text('SCORE:', 145.2, 144.1, { align: 'right' });

  drawInformationBoxShell(
    doc,
    90.5,
    151.2,
    52,
    'Date of Completion',
    'calendar',
  );
  drawInformationBoxShell(
    doc,
    153.5,
    151.2,
    59,
    'Certificate Number',
    'certificate',
  );

  doc.addImage(
    BANITO_SIGNATURE_DATA_URI,
    'JPEG',
    40,
    156,
    24,
    20,
    'banito-signature',
    'FAST',
  );
  doc.setDrawColor(139, 159, 179);
  doc.setLineWidth(0.32);
  doc.line(20, 178.4, 86.5, 178.4);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(...PRIMARY);
  doc.text('EBURUCHE OBINNA CHIMEZIE BANITO', 20, 183.5, {
    maxWidth: 70,
  });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.1);
  doc.setTextColor(...MUTED);
  doc.text(
    'Programme Coordinator / Executive Director, IIPM',
    20,
    188,
    { maxWidth: 72 },
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.3);
  doc.setTextColor(...PRIMARY);
  doc.text('SCAN TO VERIFY', 259, 183.5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.2);
  doc.setTextColor(116, 132, 148);
  doc.text(
    'This certificate is digitally verifiable. Scan the QR code or use the certificate number on the AgileCert portal.',
    CENTRE_X,
    195,
    { align: 'center', maxWidth: 170 },
  );

  return new Uint8Array(doc.output('arraybuffer'));
};

export const sha256Hex = async (bytes: Uint8Array): Promise<string> => {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const digest = await crypto.subtle.digest('SHA-256', copy.buffer);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
};

export const buildCipmnApprovedMasterManifest = async (
  masterBytes: Uint8Array,
): Promise<Record<string, unknown>> => {
  const overlayBytes = new TextEncoder().encode(
    JSON.stringify(CIPMN_APPROVED_COMPLETION_OVERLAY),
  );
  return {
    schemaVersion: 1,
    generatedAt: '2026-08-01T00:00:00.000Z',
    contract: CIPMN_APPROVED_TEMPLATE_CONTRACT,
    requiredFields: CIPMN_APPROVED_TEMPLATE_CONTRACT.template.requiredFields,
    master: {
      ...CIPMN_APPROVED_TEMPLATE_CONTRACT.version,
      fileName: CIPMN_APPROVED_MASTER_FILENAME,
      fileSizeBytes: masterBytes.byteLength,
      sha256: await sha256Hex(masterBytes),
    },
    overlay: {
      fileName: CIPMN_APPROVED_OVERLAY_FILENAME,
      elementCount: CIPMN_APPROVED_COMPLETION_OVERLAY.length,
      sha256: await sha256Hex(overlayBytes),
      elements: CIPMN_APPROVED_COMPLETION_OVERLAY,
    },
    previewSample: CIPMN_APPROVED_COMPLETION_SAMPLE,
  };
};

export const writeCipmnApprovedMasterArtifacts = async (
  outputDirectory: string,
): Promise<Record<string, unknown>> => {
  await Deno.mkdir(outputDirectory, { recursive: true });
  const masterBytes = generateCipmnApprovedCompletionMasterPdf();
  const manifest = await buildCipmnApprovedMasterManifest(masterBytes);

  await Deno.writeFile(
    `${outputDirectory}/${CIPMN_APPROVED_MASTER_FILENAME}`,
    masterBytes,
  );
  await Deno.writeTextFile(
    `${outputDirectory}/${CIPMN_APPROVED_OVERLAY_FILENAME}`,
    `${JSON.stringify(CIPMN_APPROVED_COMPLETION_OVERLAY, null, 2)}\n`,
  );
  await Deno.writeTextFile(
    `${outputDirectory}/${CIPMN_APPROVED_MANIFEST_FILENAME}`,
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  return manifest;
};

if (import.meta.main) {
  const outputDirectory = Deno.args[0] || 'certificate-master-artifacts';
  const manifest = await writeCipmnApprovedMasterArtifacts(outputDirectory);
  console.log(JSON.stringify(manifest, null, 2));
}

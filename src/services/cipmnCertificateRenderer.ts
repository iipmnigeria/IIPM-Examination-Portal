import type { jsPDF } from 'jspdf';
import {
  BANITO_SIGNATURE_DATA_URI,
  CIPMN_CERTIFICATE_LOGO_DATA_URI,
  IIPM_CERTIFICATE_LOGO_DATA_URI,
} from '../assets/cipmnCertificateAssets';

export interface CipmnCertificateRenderInput {
  holderName: string;
  examinationTitle: string;
  examinationCode?: string | null;
  programmeCode?: string | null;
  score: number;
  completionDate: string;
  certificateNumber: string;
  verificationCode: string;
  verificationUrl: string;
}

const PAGE_WIDTH = 297;
const CENTRE_X = PAGE_WIDTH / 2;
const PRIMARY: [number, number, number] = [8, 82, 61];
const NAVY: [number, number, number] = [20, 43, 83];
const RED: [number, number, number] = [190, 43, 45];
const GOLD: [number, number, number] = [198, 147, 38];
const MUTED: [number, number, number] = [71, 85, 105];
const LIGHT_GREEN: [number, number, number] = [244, 249, 246];
const BORDER_GREEN: [number, number, number] = [5, 77, 57];

const formatDate = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const fitFontSize = (
  doc: jsPDF,
  text: string,
  preferred: number,
  minimum: number,
  maxWidth: number,
): number => {
  let size = preferred;
  doc.setFontSize(size);
  while (size > minimum && doc.getTextWidth(text) > maxWidth) {
    size -= 0.5;
    doc.setFontSize(size);
  }
  return size;
};

const cleanModuleCode = (input: CipmnCertificateRenderInput): string => {
  const direct = input.examinationCode?.trim();
  if (direct) return direct.replace(/\s+MOCK EXAMINATION$/i, '').trim();

  const titleMatch = input.examinationTitle.match(/\bCIPMN-MOD-\d{3}\b/i);
  if (titleMatch) return titleMatch[0].toUpperCase();

  const programme = input.programmeCode?.trim();
  return programme || 'CIPMN';
};

const drawCornerMark = (doc: jsPDF, x: number, y: number): void => {
  doc.setFillColor(...BORDER_GREEN);
  doc.circle(x, y, 1.15, 'F');
  doc.setFillColor(...GOLD);
  doc.circle(x, y, 0.45, 'F');
};

const drawInformationBox = (
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  label: string,
  value: string,
): void => {
  doc.setFillColor(...LIGHT_GREEN);
  doc.setDrawColor(189, 218, 204);
  doc.setLineWidth(0.35);
  doc.roundedRect(x, y, width, 16, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.2);
  doc.setTextColor(...MUTED);
  doc.text(label.toUpperCase(), x + 4, y + 5.2);

  doc.setFont('helvetica', 'bold');
  const valueSize = fitFontSize(doc, value, 8.2, 5.8, width - 8);
  doc.setFontSize(valueSize);
  doc.setTextColor(...PRIMARY);
  doc.text(value, x + 4, y + 11.8, { maxWidth: width - 8 });
};

export const isCipmnCertificate = (programmeCode?: string | null): boolean =>
  /^CIPMN(?:-|$)/i.test(programmeCode?.trim() || '');

export function renderCipmnCompletionCertificate(
  doc: jsPDF,
  input: CipmnCertificateRenderInput,
  qrDataUrl: string,
): void {
  const moduleCode = cleanModuleCode(input);
  const title = input.examinationTitle
    .replace(/^CIPMN-MOD-\d{3}\s*[-–—:]?\s*/i, '')
    .replace(/\s+Mock Examination$/i, '')
    .trim();

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, 297, 210, 'F');

  doc.setDrawColor(...BORDER_GREEN);
  doc.setLineWidth(1.6);
  doc.roundedRect(6.5, 6.5, 284, 197, 2.3, 2.3, 'S');
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.45);
  doc.roundedRect(9.2, 9.2, 278.6, 191.6, 1.8, 1.8, 'S');
  doc.setDrawColor(...RED);
  doc.setLineWidth(0.35);
  doc.roundedRect(11.2, 11.2, 274.6, 187.6, 1.5, 1.5, 'S');
  drawCornerMark(doc, 9.2, 9.2);
  drawCornerMark(doc, 287.8, 9.2);
  drawCornerMark(doc, 9.2, 200.8);
  drawCornerMark(doc, 287.8, 200.8);

  doc.addImage(IIPM_CERTIFICATE_LOGO_DATA_URI, 'JPEG', 72, 14, 29, 29, 'iipm-logo', 'FAST');
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.45);
  doc.line(108, 16, 108, 43);
  doc.addImage(CIPMN_CERTIFICATE_LOGO_DATA_URI, 'JPEG', 115, 18, 105, 21.5, 'cipmn-logo', 'FAST');

  doc.setFont('times', 'bold');
  doc.setFontSize(21);
  doc.setTextColor(...NAVY);
  doc.text('CERTIFICATE OF COMPLETION', CENTRE_X, 58, { align: 'center' });
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.6);
  doc.line(116, 63, 181, 63);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(...MUTED);
  doc.text('This is to certify that', CENTRE_X, 73, { align: 'center' });

  doc.setFont('times', 'bold');
  const holderName = input.holderName.toUpperCase();
  const holderSize = fitFontSize(doc, holderName, 25, 15, 220);
  doc.setFontSize(holderSize);
  doc.setTextColor(...PRIMARY);
  doc.text(holderName, CENTRE_X, 90, { align: 'center', maxWidth: 220 });
  doc.setDrawColor(194, 209, 221);
  doc.setLineWidth(0.35);
  doc.line(58, 96, 239, 96);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.2);
  doc.setTextColor(...MUTED);
  doc.text(
    'has successfully completed the CIPMN Licensing Training Module in',
    CENTRE_X,
    106,
    { align: 'center' },
  );

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...RED);
  let examFontSize = 16;
  doc.setFontSize(examFontSize);
  let titleLines = doc.splitTextToSize(title.toUpperCase(), 220) as string[];
  if (titleLines.length > 2) {
    examFontSize = 13;
    doc.setFontSize(examFontSize);
    titleLines = doc.splitTextToSize(title.toUpperCase(), 220) as string[];
  }
  doc.text(titleLines, CENTRE_X, 117, {
    align: 'center',
    lineHeightFactor: 1.08,
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...PRIMARY);
  doc.text(moduleCode.toUpperCase(), CENTRE_X, 133, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text('Delivered through IIPM in collaboration with CIPMN.', CENTRE_X, 140, {
    align: 'center',
  });

  doc.setFillColor(...LIGHT_GREEN);
  doc.setDrawColor(183, 214, 198);
  doc.setLineWidth(0.4);
  doc.roundedRect(127.5, 144, 42, 13, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.2);
  doc.setTextColor(...MUTED);
  doc.text('SCORE:', 142.5, 152.5, { align: 'right' });
  doc.setTextColor(...PRIMARY);
  doc.text(`${Number(input.score).toFixed(Number(input.score) % 1 === 0 ? 0 : 1)}%`, 145, 152.5);

  drawInformationBox(doc, 88, 160, 55, 'Date of Completion', formatDate(input.completionDate));
  drawInformationBox(doc, 149, 160, 70, 'Certificate Number', input.certificateNumber);

  doc.addImage(BANITO_SIGNATURE_DATA_URI, 'JPEG', 25, 157, 37, 25, 'banito-signature', 'FAST');
  doc.setDrawColor(139, 159, 179);
  doc.setLineWidth(0.35);
  doc.line(20, 183, 84, 183);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.4);
  doc.setTextColor(...PRIMARY);
  doc.text('EBURUCHE OBINNA CHIMEZIE BANITO', 20, 188.5, { maxWidth: 72 });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.3);
  doc.setTextColor(...MUTED);
  doc.text('Programme Coordinator / Executive Director, IIPM', 20, 193, { maxWidth: 72 });

  doc.addImage(qrDataUrl, 'PNG', 247, 158, 27, 27, 'verification-qr', 'FAST');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(...PRIMARY);
  doc.text('SCAN TO VERIFY', 260.5, 190, { align: 'center' });
  doc.setFont('courier', 'normal');
  doc.setFontSize(5.2);
  doc.setTextColor(...MUTED);
  doc.text(input.verificationCode, 260.5, 194, { align: 'center', maxWidth: 35 });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.3);
  doc.setTextColor(130, 145, 160);
  doc.text(
    'This certificate is digitally verifiable. Scan the QR code or use the certificate number on the AgileCert portal.',
    CENTRE_X,
    202,
    { align: 'center', maxWidth: 150 },
  );
}

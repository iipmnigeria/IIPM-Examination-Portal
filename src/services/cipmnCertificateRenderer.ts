import type { jsPDF } from 'jspdf';
import { IIPM_CERTIFICATE_LOGO_DATA_URI } from '../assets/cipmnCertificateIipmLogo';
import { CIPMN_CERTIFICATE_LOGO_DATA_URI } from '../assets/cipmnCertificateCipmnLogo';
import { BANITO_SIGNATURE_DATA_URI } from '../assets/cipmnCertificateBanitoSignature';

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
const LIGHT_GREEN: [number, number, number] = [246, 250, 247];
const BORDER_GREEN: [number, number, number] = [5, 77, 57];
const BOX_BORDER: [number, number, number] = [191, 219, 205];

const formatDate = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.toUpperCase();
  return date
    .toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
    .toUpperCase();
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

const drawCalendarIcon = (doc: jsPDF, x: number, y: number): void => {
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

const drawCertificateIcon = (doc: jsPDF, x: number, y: number): void => {
  doc.setDrawColor(...PRIMARY);
  doc.setLineWidth(0.5);
  doc.roundedRect(x, y, 7.2, 6.1, 0.6, 0.6, 'S');
  doc.line(x + 1.3, y + 1.7, x + 5.7, y + 1.7);
  doc.line(x + 1.3, y + 3.1, x + 4.7, y + 3.1);
  doc.circle(x + 6, y + 5.7, 1.35, 'S');
  doc.line(x + 5.4, y + 6.8, x + 5.1, y + 8.2);
  doc.line(x + 6.6, y + 6.8, x + 6.9, y + 8.2);
};

const drawInformationBox = (
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  label: string,
  value: string,
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

  const textX = x + 14.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.7);
  doc.setTextColor(...MUTED);
  doc.text(label.toUpperCase(), textX, y + 5.2);

  doc.setFont('helvetica', 'bold');
  const valueSize = fitFontSize(doc, value, 7.3, 5.3, width - 18);
  doc.setFontSize(valueSize);
  doc.setTextColor(...PRIMARY);
  doc.text(value, textX, y + 10.6, { maxWidth: width - 18 });
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

  // Exact approved landscape composition. Sample-only watermark wording is deliberately omitted.
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

  // Balanced institutional identity exactly as approved.
  doc.addImage(IIPM_CERTIFICATE_LOGO_DATA_URI, 'JPEG', 81, 13.1, 35, 35, 'iipm-logo', 'FAST');
  doc.addImage(CIPMN_CERTIFICATE_LOGO_DATA_URI, 'JPEG', 123, 16.1, 95, 25.5, 'cipmn-logo', 'FAST');
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
  doc.text('CHARTERED INSTITUTE OF PROJECT MANAGERS OF NIGERIA (CIPMN)', CENTRE_X, 56.4, {
    align: 'center',
  });

  doc.setFont('times', 'bold');
  doc.setFontSize(19.5);
  doc.setTextColor(...NAVY);
  doc.text('CERTIFICATE OF COMPLETION', CENTRE_X, 70.2, { align: 'center' });
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.55);
  doc.line(113.8, 73, 183.2, 73);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.8);
  doc.setTextColor(...MUTED);
  doc.text('This is to certify that', CENTRE_X, 82, { align: 'center' });

  const holderName = input.holderName.toUpperCase();
  doc.setFont('times', 'bold');
  const holderSize = fitFontSize(doc, holderName, 23.5, 14.5, 219);
  doc.setFontSize(holderSize);
  doc.setTextColor(...PRIMARY);
  doc.text(holderName, CENTRE_X, 96, { align: 'center', maxWidth: 219 });
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

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...RED);
  let examFontSize = 14.2;
  doc.setFontSize(examFontSize);
  let titleLines = doc.splitTextToSize(title.toUpperCase(), 224) as string[];
  while (titleLines.length > 2 && examFontSize > 10.8) {
    examFontSize -= 0.5;
    doc.setFontSize(examFontSize);
    titleLines = doc.splitTextToSize(title.toUpperCase(), 224) as string[];
  }
  doc.text(titleLines.slice(0, 2), CENTRE_X, 116.5, {
    align: 'center',
    lineHeightFactor: 1.02,
  });

  const titleEndY = 116.5 + (Math.min(titleLines.length, 2) - 1) * examFontSize * 0.36;
  const moduleCodeY = Math.max(125.3, titleEndY + 4.2);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.7);
  doc.setTextColor(...PRIMARY);
  doc.text(moduleCode.toUpperCase(), CENTRE_X, moduleCodeY, { align: 'center' });

  const collaborationY = Math.max(131.5, moduleCodeY + 5.7);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.1);
  doc.setTextColor(...MUTED);
  doc.text('Delivered through IIPM in collaboration with CIPMN.', CENTRE_X, collaborationY, {
    align: 'center',
  });

  const scoreBoxY = Math.max(136, collaborationY + 5.2);
  doc.setFillColor(...LIGHT_GREEN);
  doc.setDrawColor(...BOX_BORDER);
  doc.setLineWidth(0.38);
  doc.roundedRect(125.2, scoreBoxY, 46.6, 12.2, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...MUTED);
  doc.text('SCORE:', 145.2, scoreBoxY + 8.1, { align: 'right' });
  doc.setTextColor(...PRIMARY);
  const score = Number(input.score);
  const scoreText = Number.isFinite(score)
    ? `${score.toFixed(score % 1 === 0 ? 0 : 1)}%`
    : `${input.score}%`;
  doc.text(scoreText, 147.2, scoreBoxY + 8.1);

  const infoY = Math.max(151.2, scoreBoxY + 15.2);
  drawInformationBox(doc, 90.5, infoY, 52, 'Date of Completion', formatDate(input.completionDate), 'calendar');
  drawInformationBox(doc, 153.5, infoY, 59, 'Certificate Number', input.certificateNumber, 'certificate');

  // Single approved signatory.
  doc.addImage(BANITO_SIGNATURE_DATA_URI, 'JPEG', 40, 156, 24, 20, 'banito-signature', 'FAST');
  doc.setDrawColor(139, 159, 179);
  doc.setLineWidth(0.32);
  doc.line(20, 178.4, 86.5, 178.4);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(...PRIMARY);
  doc.text('EBURUCHE OBINNA CHIMEZIE BANITO', 20, 183.5, { maxWidth: 70 });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.1);
  doc.setTextColor(...MUTED);
  doc.text('Programme Coordinator / Executive Director, IIPM', 20, 188, { maxWidth: 72 });

  doc.addImage(qrDataUrl, 'PNG', 244.5, 148.2, 29, 29, 'verification-qr', 'FAST');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.3);
  doc.setTextColor(...PRIMARY);
  doc.text('SCAN TO VERIFY', 259, 183.5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.6);
  doc.setTextColor(...MUTED);
  doc.text(input.verificationCode, 259, 187.3, { align: 'center', maxWidth: 38 });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.2);
  doc.setTextColor(116, 132, 148);
  doc.text(
    'This certificate is digitally verifiable. Scan the QR code or use the certificate number on the AgileCert portal.',
    CENTRE_X,
    195,
    { align: 'center', maxWidth: 170 },
  );
}

import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import {
  getCertificateRenderPayload,
  type CertificateRenderPayload,
  type CertificateRenderTemplate,
} from './certificateCompletionService';
import {
  isCipmnCertificate,
  renderCipmnCompletionCertificate,
} from './cipmnCertificateRenderer';

const defaultTemplate: Omit<CertificateRenderTemplate, 'id' | 'programmeId'> = {
  productCode: 'achievement',
  templateName: 'IIPM Default Certificate Template',
  version: 1,
  certificateTitle: 'Certificate of Achievement',
  issuerName: 'Integrated Institute of Professional Management (IIPM)',
  subtitle: 'AgileCert Global · Server-issued and publicly verifiable',
  leftSignatoryName: 'Certificate Authority',
  leftSignatoryTitle: 'Integrated Institute of Professional Management',
  rightSignatoryName: 'Registrar',
  rightSignatoryTitle: 'AgileCert Global by IIPM',
  primaryColour: '#0f2a4a',
  accentColour: '#d97706',
  layoutConfig: {},
};

type CertificateWithExaminationCode = CertificateRenderPayload['certificate'] & {
  examinationCode?: string | null;
};

const hexToRgb = (hex: string): [number, number, number] => {
  const normalized = /^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : '0f2a4a';
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
};

const formatDate = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const safeFilePart = (value: string): string =>
  value.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 80);

const renderDefaultCertificate = (
  doc: jsPDF,
  payload: CertificateRenderPayload,
  template: CertificateRenderTemplate,
  qrDataUrl: string,
): void => {
  const certificate = payload.certificate;
  const primary = hexToRgb(template.primaryColour);
  const accent = hexToRgb(template.accentColour);

  doc.setFillColor(255, 254, 248);
  doc.rect(0, 0, 297, 210, 'F');
  doc.setDrawColor(...primary);
  doc.setLineWidth(1.4);
  doc.rect(9, 9, 279, 192);
  doc.setLineWidth(0.45);
  doc.rect(12, 12, 273, 186);
  doc.setDrawColor(...accent);
  doc.setLineWidth(0.8);
  doc.line(72, 43, 225, 43);

  doc.setTextColor(...primary);
  doc.setFont('times', 'bold');
  doc.setFontSize(19);
  doc.text(template.issuerName.toUpperCase(), 148.5, 30, { align: 'center', maxWidth: 250 });
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text(template.subtitle.toUpperCase(), 148.5, 38, { align: 'center', maxWidth: 220 });

  doc.setFont('times', 'bold');
  doc.setFontSize(26);
  doc.text(certificate.certificateTitle.toUpperCase(), 148.5, 59, {
    align: 'center',
    maxWidth: 230,
  });
  doc.setFont('times', 'italic');
  doc.setFontSize(13);
  doc.setTextColor(71, 85, 105);
  doc.text('This is to certify that', 148.5, 73, { align: 'center' });

  doc.setFont('times', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(...primary);
  doc.text(certificate.holderName.toUpperCase(), 148.5, 91, {
    align: 'center',
    maxWidth: 220,
  });
  doc.setLineWidth(0.35);
  doc.line(65, 95, 232, 95);

  doc.setFont('times', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(71, 85, 105);
  doc.text('has satisfied the examination and integrity requirements for', 148.5, 108, {
    align: 'center',
  });
  doc.setFont('times', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...primary);
  const titleLines = doc.splitTextToSize(certificate.examinationTitle.toUpperCase(), 205);
  doc.text(titleLines, 148.5, 119, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Assessment score: ${certificate.score}% · Required pass mark: ${certificate.passMark}% · Programme: ${certificate.programmeCode || 'IIPM'}`,
    148.5,
    141,
    { align: 'center', maxWidth: 230 },
  );
  doc.text(
    `Issued on ${formatDate(certificate.issueDate)} · Revision ${certificate.revisionNumber}`,
    148.5,
    149,
    { align: 'center' },
  );

  doc.setDrawColor(203, 213, 225);
  doc.line(25, 171, 98, 171);
  doc.line(199, 171, 272, 171);
  doc.setTextColor(...primary);
  doc.setFont('times', 'bold');
  doc.setFontSize(10);
  doc.text(template.leftSignatoryName, 61.5, 177, { align: 'center', maxWidth: 70 });
  doc.text(template.rightSignatoryName, 235.5, 177, { align: 'center', maxWidth: 70 });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(template.leftSignatoryTitle, 61.5, 183, { align: 'center', maxWidth: 70 });
  doc.text(template.rightSignatoryTitle, 235.5, 183, { align: 'center', maxWidth: 70 });

  doc.setFillColor(...primary);
  doc.circle(148.5, 174, 11, 'F');
  doc.setDrawColor(...accent);
  doc.setLineWidth(0.5);
  doc.circle(148.5, 174, 8.5, 'D');
  doc.setTextColor(255, 255, 255);
  doc.setFont('times', 'bold');
  doc.setFontSize(7);
  doc.text('IIPM', 148.5, 173, { align: 'center' });
  doc.setFontSize(4.5);
  doc.text('VERIFIED', 148.5, 177, { align: 'center' });

  doc.setTextColor(71, 85, 105);
  doc.setFont('courier', 'bold');
  doc.setFontSize(7.2);
  doc.text(`Certificate No: ${certificate.certificateNumber}`, 16, 191);
  doc.text(`Verification Code: ${certificate.verificationCode}`, 16, 197);
  doc.addImage(qrDataUrl, 'PNG', 247, 164, 32, 32, undefined, 'FAST');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.text('Scan to verify', 263, 200, { align: 'center' });
  const verifyLines = doc.splitTextToSize(payload.verificationUrl, 82);
  doc.text(verifyLines, 238, 202, { align: 'right' });

  doc.setTextColor(148, 163, 184);
  doc.setFontSize(5.3);
  doc.text(
    `Template ${template.templateName} v${template.version} · This PDF renders the current immutable server-issued record.`,
    148.5,
    205,
    { align: 'center', maxWidth: 240 },
  );
};

export async function renderCertificatePdf(payload: CertificateRenderPayload): Promise<void> {
  const certificate = payload.certificate as CertificateWithExaminationCode;
  const template = payload.template || {
    ...defaultTemplate,
    id: 'default',
    programmeId: 'default',
  };
  const cipmn = isCipmnCertificate(certificate.programmeCode);
  const qrColour = cipmn ? '#08523d' : template.primaryColour;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const qrDataUrl = await QRCode.toDataURL(payload.verificationUrl, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 360,
    color: {
      dark: qrColour,
      light: '#ffffff',
    },
  });

  if (cipmn) {
    renderCipmnCompletionCertificate(doc, {
      holderName: certificate.holderName,
      examinationTitle: certificate.examinationTitle,
      examinationCode: certificate.examinationCode,
      programmeCode: certificate.programmeCode,
      score: certificate.score,
      completionDate: certificate.issueDate,
      certificateNumber: certificate.certificateNumber,
      verificationCode: certificate.verificationCode,
      verificationUrl: payload.verificationUrl,
    }, qrDataUrl);
  } else {
    renderDefaultCertificate(doc, payload, template, qrDataUrl);
  }

  const safeName = safeFilePart(certificate.holderName) || 'Certificate';
  const prefix = cipmn ? 'IIPM_CIPMN' : 'IIPM';
  doc.save(`${prefix}_${safeName}_${certificate.verificationCode}.pdf`);
}

export async function downloadCertificatePdf(certificateId: string): Promise<void> {
  const payload = await getCertificateRenderPayload(certificateId);
  await renderCertificatePdf(payload);
}

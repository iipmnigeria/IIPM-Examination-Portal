import { jsPDF } from 'jspdf';
import type {
  CandidateCvAffiliation,
  CandidateCvAward,
  CandidateCvCertification,
  CandidateCvDocument,
  CandidateCvEducation,
  CandidateCvExperience,
  CandidateCvProject,
} from './aiCvProfileBuilderService';

interface RenderCandidateCvPdfInput {
  candidateName: string;
  document: CandidateCvDocument;
}

const safeFilePart = (value: string): string =>
  value.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 80);

const cleanDateRange = (startDate: string, endDate: string, current = false): string => {
  const values = [startDate.trim(), current ? 'Present' : endDate.trim()].filter(Boolean);
  return values.join(' – ');
};

const cleanText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

export function renderCandidateCvPdf({ candidateName, document }: RenderCandidateCvPdfInput): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 17;
  const contentWidth = pageWidth - marginX * 2;
  const bottomMargin = 18;
  let y = 18;

  const ensureSpace = (height: number) => {
    if (y + height <= pageHeight - bottomMargin) return;
    doc.addPage();
    y = 18;
  };

  const drawRule = () => {
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.25);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 5;
  };

  const sectionHeading = (title: string) => {
    ensureSpace(13);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(5, 150, 105);
    doc.text(title.toUpperCase(), marginX, y);
    y += 3;
    drawRule();
  };

  const paragraph = (text: string, fontSize = 9.2, lineHeight = 4.4) => {
    const clean = text.trim();
    if (!clean) return;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(fontSize);
    doc.setTextColor(51, 65, 85);
    const lines = doc.splitTextToSize(clean, contentWidth);
    const height = Math.max(lineHeight, lines.length * lineHeight);
    ensureSpace(height + 2);
    doc.text(lines, marginX, y);
    y += height + 2;
  };

  const bulletList = (items: string[]) => {
    const cleanItems = items.map((item) => item.trim()).filter(Boolean);
    cleanItems.forEach((item) => {
      const lines = doc.splitTextToSize(item, contentWidth - 7);
      const height = Math.max(4.2, lines.length * 4.2);
      ensureSpace(height + 1.5);
      doc.setFillColor(5, 150, 105);
      doc.circle(marginX + 1.5, y - 1.1, 0.8, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.8);
      doc.setTextColor(51, 65, 85);
      doc.text(lines, marginX + 5, y);
      y += height + 1.5;
    });
  };

  const itemHeader = (title: string, subtitle: string, dateText = '') => {
    ensureSpace(12);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.6);
    doc.setTextColor(15, 23, 42);
    doc.text(title || 'Untitled entry', marginX, y, { maxWidth: contentWidth - 42 });
    if (dateText) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(dateText, pageWidth - marginX, y, { align: 'right', maxWidth: 40 });
    }
    y += 4.5;
    if (subtitle) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.6);
      doc.setTextColor(71, 85, 105);
      doc.text(subtitle, marginX, y, { maxWidth: contentWidth });
      y += 5;
    }
  };

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 47, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(21);
  doc.setTextColor(255, 255, 255);
  doc.text(candidateName.trim() || 'Professional Candidate', marginX, 20, { maxWidth: contentWidth });

  const headline = cleanText(document.target_role) || cleanText(document.document_title);
  if (headline) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.setTextColor(167, 243, 208);
    doc.text(headline, marginX, 28, { maxWidth: contentWidth });
  }

  const contactParts = [
    cleanText(document.contact_email),
    cleanText(document.contact_phone),
    cleanText(document.contact_location),
  ].filter(Boolean);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(203, 213, 225);
  if (contactParts.length > 0) doc.text(contactParts.join('  •  '), marginX, 36, { maxWidth: contentWidth });

  const links = [cleanText(document.linkedin_url), cleanText(document.portfolio_url)].filter(Boolean);
  if (links.length > 0) doc.text(links.join('  •  '), marginX, 41.5, { maxWidth: contentWidth });
  y = 56;

  if (cleanText(document.professional_summary)) {
    sectionHeading('Professional Summary');
    paragraph(document.professional_summary || '');
  }

  if (document.skills.length > 0) {
    sectionHeading('Core Skills');
    paragraph(document.skills.join('  •  '), 8.8, 4.1);
  }

  if (document.experience.length > 0) {
    sectionHeading('Professional Experience');
    document.experience.forEach((item: CandidateCvExperience) => {
      const subtitle = [cleanText(item.organisation), cleanText(item.location)].filter(Boolean).join(' · ');
      itemHeader(cleanText(item.role), subtitle, cleanDateRange(cleanText(item.startDate), cleanText(item.endDate), Boolean(item.current)));
      bulletList(Array.isArray(item.highlights) ? item.highlights : []);
      y += 2;
    });
  }

  if (document.education.length > 0) {
    sectionHeading('Education');
    document.education.forEach((item: CandidateCvEducation) => {
      const subtitle = [cleanText(item.institution), cleanText(item.location)].filter(Boolean).join(' · ');
      itemHeader(cleanText(item.qualification), subtitle, cleanDateRange(cleanText(item.startDate), cleanText(item.endDate)));
      if (cleanText(item.details)) paragraph(item.details, 8.6, 4.1);
      y += 1.5;
    });
  }

  if (document.certifications.length > 0) {
    sectionHeading('Certifications');
    document.certifications.forEach((item: CandidateCvCertification) => {
      const subtitleParts = [cleanText(item.issuer), cleanText(item.credentialId) ? `Credential ${cleanText(item.credentialId)}` : ''].filter(Boolean);
      itemHeader(cleanText(item.name), subtitleParts.join(' · '), cleanText(item.issueDate));
      if (cleanText(item.credentialUrl)) paragraph(item.credentialUrl, 7.8, 3.8);
      y += 1;
    });
  }

  if (document.projects.length > 0) {
    sectionHeading('Selected Projects');
    document.projects.forEach((item: CandidateCvProject) => {
      itemHeader(cleanText(item.title), cleanText(item.role), cleanText(item.year));
      if (cleanText(item.description)) paragraph(item.description, 8.6, 4.1);
      bulletList(Array.isArray(item.outcomes) ? item.outcomes : []);
      y += 1.5;
    });
  }

  if (document.awards.length > 0) {
    sectionHeading('Awards and Recognition');
    document.awards.forEach((item: CandidateCvAward) => {
      itemHeader(cleanText(item.title), cleanText(item.issuer), cleanText(item.year));
      if (cleanText(item.description)) paragraph(item.description, 8.6, 4.1);
      y += 1;
    });
  }

  if (document.affiliations.length > 0) {
    sectionHeading('Professional Affiliations');
    document.affiliations.forEach((item: CandidateCvAffiliation) => {
      itemHeader(cleanText(item.organisation), cleanText(item.membership), cleanText(item.since));
      y += 1;
    });
  }

  if (document.languages.length > 0) {
    sectionHeading('Languages');
    paragraph(document.languages.join('  •  '), 8.8, 4.1);
  }

  if (cleanText(document.references_text)) {
    sectionHeading('References');
    paragraph(document.references_text || '', 8.8, 4.2);
  }

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(226, 232, 240);
    doc.line(marginX, pageHeight - 12, pageWidth - marginX, pageHeight - 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text('Prepared through AgileCert Global — Powered by IIPM', marginX, pageHeight - 7);
    doc.text(`${page} / ${pageCount}`, pageWidth - marginX, pageHeight - 7, { align: 'right' });
  }

  const safeName = safeFilePart(candidateName) || 'Candidate';
  const safeTitle = safeFilePart(document.document_title) || 'Professional_CV';
  doc.save(`${safeName}_${safeTitle}.pdf`);
}

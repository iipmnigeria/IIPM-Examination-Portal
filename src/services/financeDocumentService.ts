import { jsPDF } from 'jspdf';
import { getFinanceDocument, type FinanceRecord } from './financeSponsorshipService';

const formatMoney = (amountMinor: number | string | null | undefined, currency = 'NGN') => {
  const amount = Number(amountMinor || 0) / 100;
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  }
};

const dateText = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-US', { dateStyle: 'medium' });
};

const safeFilename = (value: string) => value.replace(/[^A-Za-z0-9._-]+/g, '-');

export async function downloadFinanceDocument(documentType: string, documentId: string): Promise<void> {
  const payload = await getFinanceDocument(documentType, documentId);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const currency = payload.currency || 'NGN';
  const title = String(payload.documentType || documentType).replaceAll('_', ' ').toUpperCase();
  let y = 20;

  const write = (text: string, x = 18, size = 10, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, 174);
    if (y + lines.length * 5 > 278) {
      doc.addPage();
      y = 20;
    }
    doc.text(lines, x, y);
    y += lines.length * 5 + 1;
  };

  doc.setTextColor(15, 42, 74);
  write('INTEGRATED INSTITUTE OF PROFESSIONAL MANAGEMENT', 18, 13, true);
  write(title, 18, 22, true);
  doc.setTextColor(30, 41, 59);
  write(`Document number: ${payload.documentNumber || '—'}`, 18, 10, true);
  write(`Status: ${String(payload.status || 'issued').toUpperCase()}`);
  if (payload.issueDate || payload.issuedAt) write(`Issue date: ${dateText(payload.issueDate || payload.issuedAt)}`);
  if (payload.dueDate) write(`Due date: ${dateText(payload.dueDate)}`);
  if (payload.validUntil) write(`Valid until: ${dateText(payload.validUntil)}`);
  if (payload.purchaseOrderReference) write(`Purchase order: ${payload.purchaseOrderReference}`);

  y += 3;
  doc.setDrawColor(203, 213, 225);
  doc.line(18, y, 192, y);
  y += 8;

  const customer = (payload.customer || {}) as FinanceRecord;
  write('BILL TO', 18, 11, true);
  write(customer.legalName || customer.tradingName || 'Institutional customer', 18, 11, true);
  if (customer.billingEmail) write(customer.billingEmail);
  if (customer.billingPhone) write(customer.billingPhone);
  if (customer.billingAddress && typeof customer.billingAddress === 'object') {
    const address = Object.values(customer.billingAddress).filter(Boolean).join(', ');
    if (address) write(address);
  }
  if (customer.registrationNumber) write(`Registration: ${customer.registrationNumber}`);
  if (customer.taxIdentifier) write(`Tax ID: ${customer.taxIdentifier}`);

  const items = Array.isArray(payload.items) ? payload.items : [];
  if (items.length) {
    y += 3;
    write('ITEMS', 18, 11, true);
    items.forEach((item: FinanceRecord, index: number) => {
      if (y > 260) {
        doc.addPage();
        y = 20;
      }
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(18, y - 4, 174, 24, 2, 2, 'F');
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(`${index + 1}. ${item.description || item.productType || 'Finance item'}`, 22, y + 1);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.text(`Quantity: ${item.quantity || 1} × ${formatMoney(item.unitAmountMinor, currency)}`, 22, y + 7);
      doc.text(`Discount: ${item.discountPercent || 0}% · Tax: ${item.taxRatePercent || 0}%`, 22, y + 12);
      doc.setFont('helvetica', 'bold');
      doc.text(formatMoney(item.lineTotalMinor, currency), 188, y + 7, { align: 'right' });
      y += 28;
    });
  }

  const allocations = Array.isArray(payload.allocations) ? payload.allocations : [];
  if (allocations.length) {
    write('ALLOCATIONS', 18, 11, true);
    allocations.forEach((allocation: FinanceRecord) => {
      write(`${allocation.invoiceNumber || allocation.invoiceId}: ${formatMoney(allocation.amountMinor, currency)}`);
    });
  }

  y += 2;
  doc.line(110, y, 192, y);
  y += 7;
  const totals: Array<[string, unknown]> = [
    ['Subtotal', payload.subtotalMinor],
    ['Discount', payload.discountAmountMinor],
    ['Tax', payload.taxAmountMinor],
    ['Total', payload.totalAmountMinor ?? payload.amountMinor],
    ['Paid', payload.paidAmountMinor],
    ['Credits', payload.creditedAmountMinor],
    ['Balance', payload.balanceAmountMinor],
  ];
  totals.filter(([, value]) => value !== undefined && value !== null).forEach(([label, value]) => {
    doc.setFont('helvetica', label === 'Total' || label === 'Balance' ? 'bold' : 'normal');
    doc.setFontSize(label === 'Total' || label === 'Balance' ? 11 : 9);
    doc.text(label, 112, y);
    doc.text(formatMoney(value as number, currency), 192, y, { align: 'right' });
    y += 6;
  });

  if (payload.reason) {
    y += 3;
    write(`Reason: ${payload.reason}`);
  }
  if (payload.notes) write(`Notes: ${payload.notes}`);
  if (payload.terms) write(`Terms: ${payload.terms}`);

  if (y > 270) {
    doc.addPage();
    y = 20;
  }
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Generated from the server-owned AgileCert finance ledger. Verify institutional records with IIPM Finance.', 105, 288, { align: 'center' });

  doc.save(`${safeFilename(payload.documentNumber || `${documentType}-${documentId}`)}.pdf`);
}

import { writeFile } from 'node:fs/promises';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { renderCipmnCompletionCertificate } from '../src/services/cipmnCertificateRenderer';

const render = async (
  output: string,
  holderName: string,
  title: string,
  code: string,
  score: number,
) => {
  const verificationCode = `SAMPLE-${score}-${code.replace(/[^A-Z0-9]/g, '')}`;
  const verificationUrl =
    `https://iipmnigeria.github.io/IIPM-Examination-Portal/?verify=${verificationCode}`;
  const qr = await QRCode.toDataURL(verificationUrl, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 360,
    color: { dark: '#08523d', light: '#ffffff' },
  });
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  renderCipmnCompletionCertificate(doc, {
    holderName,
    examinationTitle: title,
    examinationCode: code,
    programmeCode: 'CIPMN-MOCK',
    score,
    completionDate: '2026-07-31',
    certificateNumber: `CIPMN-COMP-2026-${String(score).padStart(6, '0')}`,
    verificationCode,
    verificationUrl,
  }, qr);
  await writeFile(output, Buffer.from(doc.output('arraybuffer')));
};

const main = async () => {
  await render(
    'cipmn-certificate-standard-sample.pdf',
    'Sample Candidate',
    'Project Procurement and Contract Management',
    'CIPMN-MOD-012',
    86,
  );
  await render(
    'cipmn-certificate-long-content-sample.pdf',
    'Christopher Chukwuemeka Adekunle-Williams',
    'Project Leadership and Building High-Performing Teams',
    'CIPMN-MOD-010',
    74.5,
  );
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

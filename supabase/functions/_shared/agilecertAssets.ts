import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';
import QRCode from 'npm:qrcode@1.5.4';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

type CredentialRow = {
  id: string;
  credential_code: string;
  verification_slug: string;
  candidate_id: string;
  eligibility_id: string;
  certificate_order_id: string;
  product_code: 'achievement' | 'professional';
  credential_title: string;
  holder_name: string;
  examination_title: string;
  score: number;
  issue_date: string;
  issued_at: string;
  status: string;
  certificate_storage_path: string | null;
  transcript_storage_path: string | null;
  metadata: Record<string, unknown> | null;
};

type EligibilityRow = {
  pass_mark: number;
  passed_at: string;
  integrity_status: string;
  programme_code: string | null;
};

type OrderRow = {
  reference: string;
  currency: string;
  payable_amount_minor: number;
  paid_at: string | null;
  pricing_window: string;
};

type BadgeRow = {
  id: string;
  badge_code: string;
  badge_class: string;
  badge_assertion: Record<string, unknown> | null;
  image_storage_path: string | null;
};

type PlatformSettingsRow = {
  portal_url: string;
  brand_name: string;
  endorsement_line: string;
  legal_entity_name: string;
  independence_disclosure: string;
};

type AutomationJobRow = {
  id: string;
  attempt_count: number;
  payload: Record<string, unknown> | null;
};

export interface AgileCertGeneratedAssets {
  credentialId: string;
  certificateStoragePath: string;
  transcriptStoragePath: string | null;
  badgeStoragePath: string;
  badgePublicUrl: string;
  verificationUrl: string;
}

const PRIVATE_ASSET_BUCKET = 'agilecert-credential-assets';
const BADGE_ASSET_BUCKET = 'agilecert-badge-assets';

function pdfText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/[^\x20-\x7E]/g, '?');
}

function xmlText(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatDate(value: string | null): string {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function wrapText(
  text: string,
  maxWidth: number,
  font: { widthOfTextAtSize: (value: string, size: number) => number },
  size: number,
): string[] {
  const words = pdfText(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
      continue;
    }

    if (current) lines.push(current);
    current = word;
  }

  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

function dataUrlBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] || '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function qrPngBytes(value: string): Promise<Uint8Array> {
  const dataUrl = await QRCode.toDataURL(value, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 360,
    color: { dark: '#0f172a', light: '#ffffff' },
  });
  return dataUrlBytes(dataUrl);
}

async function createCertificatePdf(input: {
  credential: CredentialRow;
  eligibility: EligibilityRow;
  platform: PlatformSettingsRow;
  verificationUrl: string;
}): Promise<Uint8Array> {
  const { credential, eligibility, platform, verificationUrl } = input;
  const pdf = await PDFDocument.create();
  pdf.setTitle(pdfText(credential.credential_title));
  pdf.setAuthor(pdfText(`${platform.brand_name} by ${platform.legal_entity_name}`));
  pdf.setSubject(pdfText(`Verifiable credential ${credential.credential_code}`));
  pdf.setKeywords(['AgileCert Global', 'IIPM', 'credential', 'verification']);
  pdf.setCreationDate(new Date(credential.issued_at));

  const page = pdf.addPage([842, 595]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const qrImage = await pdf.embedPng(await qrPngBytes(verificationUrl));

  const navy = rgb(0.058, 0.09, 0.16);
  const emerald = rgb(0.02, 0.58, 0.39);
  const slate = rgb(0.27, 0.33, 0.42);
  const pale = rgb(0.94, 0.98, 0.96);
  const gold = rgb(0.78, 0.58, 0.18);

  page.drawRectangle({ x: 0, y: 0, width: 842, height: 595, color: rgb(1, 1, 1) });
  page.drawRectangle({ x: 18, y: 18, width: 806, height: 559, borderColor: navy, borderWidth: 3 });
  page.drawRectangle({ x: 26, y: 26, width: 790, height: 543, borderColor: emerald, borderWidth: 1.5 });
  page.drawRectangle({ x: 36, y: 487, width: 770, height: 66, color: navy });
  page.drawRectangle({ x: 36, y: 72, width: 770, height: 58, color: pale });

  const brand = pdfText(platform.brand_name).toUpperCase();
  page.drawText(brand, {
    x: 60,
    y: 520,
    size: 24,
    font: bold,
    color: rgb(1, 1, 1),
  });
  page.drawText(pdfText(platform.endorsement_line), {
    x: 62,
    y: 501,
    size: 10,
    font: regular,
    color: rgb(0.75, 0.84, 0.8),
  });
  page.drawText(
    credential.product_code === 'professional' ? 'HIGHER-ASSURANCE PROFESSIONAL CREDENTIAL' : 'SPECIALIST ACHIEVEMENT CREDENTIAL',
    {
      x: credential.product_code === 'professional' ? 557 : 583,
      y: 519,
      size: 8.5,
      font: bold,
      color: credential.product_code === 'professional' ? gold : rgb(0.55, 0.9, 0.73),
    },
  );

  const certificateLabel = credential.product_code === 'professional'
    ? 'PROFESSIONAL CERTIFICATE'
    : 'CERTIFICATE OF ACHIEVEMENT';
  const labelWidth = bold.widthOfTextAtSize(certificateLabel, 21);
  page.drawText(certificateLabel, {
    x: (842 - labelWidth) / 2,
    y: 441,
    size: 21,
    font: bold,
    color: emerald,
  });

  const awardedText = 'This is to certify that';
  page.drawText(awardedText, {
    x: (842 - italic.widthOfTextAtSize(awardedText, 12)) / 2,
    y: 410,
    size: 12,
    font: italic,
    color: slate,
  });

  const holder = pdfText(credential.holder_name).toUpperCase();
  let holderSize = 30;
  while (holderSize > 18 && bold.widthOfTextAtSize(holder, holderSize) > 680) holderSize -= 1;
  page.drawText(holder, {
    x: (842 - bold.widthOfTextAtSize(holder, holderSize)) / 2,
    y: 366,
    size: holderSize,
    font: bold,
    color: navy,
  });
  page.drawLine({ start: { x: 118, y: 357 }, end: { x: 724, y: 357 }, thickness: 1, color: emerald });

  const completionText = credential.product_code === 'professional'
    ? 'has successfully met the professional competency, integrity and identity requirements for'
    : 'has successfully met the required pass mark in the specialist competency examination';
  page.drawText(completionText, {
    x: (842 - regular.widthOfTextAtSize(completionText, 10.5)) / 2,
    y: 330,
    size: 10.5,
    font: regular,
    color: slate,
  });

  const examLines = wrapText(credential.examination_title, 610, bold, 20);
  examLines.slice(0, 2).forEach((line, index) => {
    page.drawText(line, {
      x: (842 - bold.widthOfTextAtSize(line, 20)) / 2,
      y: 286 - index * 25,
      size: 20,
      font: bold,
      color: navy,
    });
  });

  page.drawText(`Verified score: ${Number(credential.score).toFixed(2)}%`, {
    x: 142,
    y: 212,
    size: 11,
    font: bold,
    color: emerald,
  });
  page.drawText(`Pass mark: ${Number(eligibility.pass_mark).toFixed(2)}%`, {
    x: 142,
    y: 192,
    size: 10,
    font: regular,
    color: slate,
  });
  page.drawText(`Issue date: ${formatDate(credential.issue_date)}`, {
    x: 142,
    y: 172,
    size: 10,
    font: regular,
    color: slate,
  });
  page.drawText(`Credential ID: ${pdfText(credential.credential_code)}`, {
    x: 142,
    y: 152,
    size: 10,
    font: bold,
    color: navy,
  });

  page.drawImage(qrImage, { x: 646, y: 143, width: 104, height: 104 });
  page.drawText('Scan to verify', {
    x: 663,
    y: 132,
    size: 8.5,
    font: bold,
    color: slate,
  });

  page.drawText('Digitally issued by AgileCert Global', {
    x: 60,
    y: 104,
    size: 10,
    font: bold,
    color: navy,
  });
  page.drawText(pdfText(platform.endorsement_line), {
    x: 60,
    y: 88,
    size: 9,
    font: regular,
    color: slate,
  });
  page.drawText('This credential is valid only when the public registry confirms an active status.', {
    x: 309,
    y: 101,
    size: 8.5,
    font: regular,
    color: slate,
  });
  page.drawText(pdfText(verificationUrl), {
    x: 309,
    y: 85,
    size: 7.5,
    font: regular,
    color: emerald,
  });

  const disclosure = wrapText(platform.independence_disclosure, 750, regular, 6.5).slice(0, 2);
  disclosure.forEach((line, index) => {
    page.drawText(line, { x: 46, y: 50 - index * 8, size: 6.5, font: regular, color: slate });
  });

  return pdf.save();
}

async function createTranscriptPdf(input: {
  credential: CredentialRow;
  eligibility: EligibilityRow;
  order: OrderRow;
  platform: PlatformSettingsRow;
  verificationUrl: string;
}): Promise<Uint8Array> {
  const { credential, eligibility, order, platform, verificationUrl } = input;
  const pdf = await PDFDocument.create();
  pdf.setTitle(pdfText(`Formal Examination Transcript - ${credential.holder_name}`));
  pdf.setAuthor(pdfText(`${platform.brand_name} by ${platform.legal_entity_name}`));
  pdf.setSubject(pdfText(`Transcript for ${credential.credential_code}`));

  const page = pdf.addPage([595, 842]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const qrImage = await pdf.embedPng(await qrPngBytes(verificationUrl));
  const navy = rgb(0.058, 0.09, 0.16);
  const emerald = rgb(0.02, 0.58, 0.39);
  const slate = rgb(0.27, 0.33, 0.42);
  const pale = rgb(0.95, 0.98, 0.96);

  page.drawRectangle({ x: 0, y: 0, width: 595, height: 842, color: rgb(1, 1, 1) });
  page.drawRectangle({ x: 24, y: 24, width: 547, height: 794, borderColor: navy, borderWidth: 2 });
  page.drawRectangle({ x: 34, y: 736, width: 527, height: 66, color: navy });
  page.drawText(pdfText(platform.brand_name).toUpperCase(), {
    x: 52,
    y: 773,
    size: 19,
    font: bold,
    color: rgb(1, 1, 1),
  });
  page.drawText('FORMAL EXAMINATION TRANSCRIPT', {
    x: 52,
    y: 751,
    size: 11,
    font: bold,
    color: rgb(0.55, 0.9, 0.73),
  });

  page.drawText('Credential Holder', { x: 52, y: 700, size: 8, font: bold, color: slate });
  page.drawText(pdfText(credential.holder_name), { x: 52, y: 678, size: 18, font: bold, color: navy });
  page.drawText(pdfText(credential.credential_title), { x: 52, y: 655, size: 10, font: regular, color: emerald });

  const fields: Array<[string, string]> = [
    ['Examination', credential.examination_title],
    ['Programme code', eligibility.programme_code || 'MOD'],
    ['Verified score', `${Number(credential.score).toFixed(2)}%`],
    ['Pass mark', `${Number(eligibility.pass_mark).toFixed(2)}%`],
    ['Result', 'PASS'],
    ['Integrity status', eligibility.integrity_status.toUpperCase()],
    ['Passed at', formatDate(eligibility.passed_at)],
    ['Credential issue date', formatDate(credential.issue_date)],
    ['Credential ID', credential.credential_code],
    ['Certificate order', order.reference],
    ['Pricing window', order.pricing_window.toUpperCase()],
    ['Payment currency', order.currency],
  ];

  let y = 613;
  fields.forEach(([label, value], index) => {
    const rowHeight = index === 0 ? 54 : 38;
    page.drawRectangle({
      x: 52,
      y: y - rowHeight + 8,
      width: 491,
      height: rowHeight,
      color: index % 2 === 0 ? pale : rgb(1, 1, 1),
      borderColor: rgb(0.86, 0.89, 0.91),
      borderWidth: 0.5,
    });
    page.drawText(pdfText(label).toUpperCase(), {
      x: 65,
      y: y - 8,
      size: 7.5,
      font: bold,
      color: slate,
    });

    const lines = wrapText(value, 330, regular, 10).slice(0, 2);
    lines.forEach((line, lineIndex) => {
      page.drawText(line, {
        x: 200,
        y: y - 8 - lineIndex * 14,
        size: 10,
        font: label === 'Verified score' || label === 'Result' ? bold : regular,
        color: label === 'Result' || label === 'Verified score' ? emerald : navy,
      });
    });
    y -= rowHeight;
  });

  page.drawImage(qrImage, { x: 52, y: 55, width: 88, height: 88 });
  page.drawText('PUBLIC VERIFICATION', { x: 158, y: 124, size: 8, font: bold, color: slate });
  page.drawText(pdfText(verificationUrl), { x: 158, y: 106, size: 7.5, font: regular, color: emerald });
  page.drawText('This transcript is digitally issued and has no handwritten signature requirement.', {
    x: 158,
    y: 85,
    size: 8.5,
    font: regular,
    color: slate,
  });
  page.drawText(pdfText(platform.independence_disclosure), {
    x: 52,
    y: 39,
    size: 5.8,
    font: regular,
    color: slate,
    maxWidth: 491,
  });

  return pdf.save();
}

async function createBadgeSvg(input: {
  credential: CredentialRow;
  badge: BadgeRow;
  platform: PlatformSettingsRow;
  verificationUrl: string;
}): Promise<string> {
  const { credential, badge, platform, verificationUrl } = input;
  const qrDataUrl = await QRCode.toDataURL(verificationUrl, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 280,
    color: { dark: '#0f172a', light: '#ffffff' },
  });
  const title = credential.product_code === 'professional'
    ? 'Professional Certificate'
    : 'Certificate of Achievement';
  const exam = credential.examination_title.length > 58
    ? `${credential.examination_title.slice(0, 55)}...`
    : credential.examination_title;
  const holder = credential.holder_name.length > 38
    ? `${credential.holder_name.slice(0, 35)}...`
    : credential.holder_name;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200" role="img" aria-labelledby="title description">
  <title id="title">${xmlText(title)} - ${xmlText(credential.holder_name)}</title>
  <desc id="description">Verifiable ${xmlText(platform.brand_name)} digital badge for ${xmlText(credential.examination_title)}.</desc>
  <defs>
    <linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#020617"/>
      <stop offset="0.55" stop-color="#0f172a"/>
      <stop offset="1" stop-color="#064e3b"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="20" flood-color="#000000" flood-opacity="0.35"/>
    </filter>
  </defs>
  <rect width="1200" height="1200" rx="110" fill="url(#background)"/>
  <rect x="42" y="42" width="1116" height="1116" rx="82" fill="none" stroke="#34d399" stroke-width="8"/>
  <rect x="67" y="67" width="1066" height="1066" rx="68" fill="none" stroke="#a7f3d0" stroke-opacity="0.45" stroke-width="2"/>
  <circle cx="600" cy="248" r="128" fill="#059669" filter="url(#shadow)"/>
  <circle cx="600" cy="248" r="105" fill="#ecfdf5"/>
  <path d="M548 250l34 34 72-84" fill="none" stroke="#047857" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="600" y="455" text-anchor="middle" fill="#6ee7b7" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="800" letter-spacing="7">${xmlText(platform.brand_name.toUpperCase())}</text>
  <text x="600" y="512" text-anchor="middle" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="48" font-weight="900">${xmlText(title)}</text>
  <text x="600" y="578" text-anchor="middle" fill="#cbd5e1" font-family="Arial, Helvetica, sans-serif" font-size="27" font-weight="600">${xmlText(exam)}</text>
  <line x1="215" y1="628" x2="985" y2="628" stroke="#34d399" stroke-opacity="0.55" stroke-width="2"/>
  <text x="600" y="700" text-anchor="middle" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="42" font-weight="900">${xmlText(holder)}</text>
  <text x="600" y="752" text-anchor="middle" fill="#94a3b8" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700">VERIFIED SCORE ${Number(credential.score).toFixed(2)}%</text>
  <rect x="160" y="828" width="600" height="190" rx="30" fill="#ffffff" fill-opacity="0.06" stroke="#ffffff" stroke-opacity="0.12"/>
  <text x="195" y="885" fill="#94a3b8" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="700">CREDENTIAL ID</text>
  <text x="195" y="930" fill="#ffffff" font-family="Courier New, monospace" font-size="25" font-weight="700">${xmlText(credential.credential_code)}</text>
  <text x="195" y="977" fill="#6ee7b7" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="700">Issued ${xmlText(formatDate(credential.issue_date))} · ${xmlText(platform.endorsement_line)}</text>
  <rect x="805" y="812" width="235" height="235" rx="24" fill="#ffffff"/>
  <image href="${qrDataUrl}" x="823" y="830" width="199" height="199"/>
  <text x="600" y="1100" text-anchor="middle" fill="#94a3b8" font-family="Arial, Helvetica, sans-serif" font-size="18">Verify this badge on the official AgileCert Global credential registry.</text>
  <metadata>${xmlText(JSON.stringify({
    type: 'OpenBadgeCredential',
    badgeCode: badge.badge_code,
    badgeClass: badge.badge_class,
    credentialCode: credential.credential_code,
    verificationUrl,
  }))}</metadata>
</svg>`;
}

async function setAssetJobStatus(
  admin: SupabaseClient,
  credentialId: string,
  status: 'processing' | 'sent' | 'failed',
  details: Record<string, unknown> = {},
  errorMessage: string | null = null,
): Promise<void> {
  const { data: jobData } = await admin
    .from('agilecert_automation_jobs')
    .select('id, attempt_count, payload')
    .eq('job_type', 'credential_generate_assets')
    .contains('payload', { credentialId })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!jobData) return;
  const job = jobData as AutomationJobRow;
  await admin
    .from('agilecert_automation_jobs')
    .update({
      status,
      attempt_count: status === 'processing' ? Number(job.attempt_count || 0) + 1 : Number(job.attempt_count || 0),
      last_error: errorMessage,
      sent_at: status === 'sent' ? new Date().toISOString() : null,
      payload: {
        ...(job.payload || {}),
        ...details,
        assetStatus: status,
        assetUpdatedAt: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', job.id);
}

export async function generateAgileCertCredentialAssets(
  admin: SupabaseClient,
  credentialId: string,
): Promise<AgileCertGeneratedAssets> {
  const cleanCredentialId = credentialId.trim();
  if (!cleanCredentialId) throw new Error('A credential identifier is required for asset generation.');

  await setAssetJobStatus(admin, cleanCredentialId, 'processing');

  try {
    const { data: credentialData, error: credentialError } = await admin
      .from('agilecert_credentials')
      .select('*')
      .eq('id', cleanCredentialId)
      .single();
    if (credentialError) throw new Error(credentialError.message);
    const credential = credentialData as CredentialRow;

    if (credential.status !== 'active') {
      throw new Error(`Credential assets cannot be generated from status ${credential.status}.`);
    }

    const [eligibilityResult, orderResult, badgeResult, platformResult] = await Promise.all([
      admin
        .from('agilecert_certificate_eligibilities')
        .select('pass_mark, passed_at, integrity_status, programme_code')
        .eq('id', credential.eligibility_id)
        .single(),
      admin
        .from('agilecert_certificate_orders')
        .select('reference, currency, payable_amount_minor, paid_at, pricing_window')
        .eq('id', credential.certificate_order_id)
        .single(),
      admin
        .from('agilecert_digital_badges')
        .select('id, badge_code, badge_class, badge_assertion, image_storage_path')
        .eq('credential_id', credential.id)
        .single(),
      admin
        .from('agilecert_platform_settings')
        .select('portal_url, brand_name, endorsement_line, legal_entity_name, independence_disclosure')
        .eq('singleton', true)
        .single(),
    ]);

    if (eligibilityResult.error) throw new Error(eligibilityResult.error.message);
    if (orderResult.error) throw new Error(orderResult.error.message);
    if (badgeResult.error) throw new Error(badgeResult.error.message);
    if (platformResult.error) throw new Error(platformResult.error.message);

    const eligibility = eligibilityResult.data as EligibilityRow;
    const order = orderResult.data as OrderRow;
    const badge = badgeResult.data as BadgeRow;
    const platform = platformResult.data as PlatformSettingsRow;
    const verificationUrl = `${platform.portal_url.replace(/\/+$/, '')}/?verify=${encodeURIComponent(credential.verification_slug)}`;

    const certificatePath = `${credential.candidate_id}/${credential.id}/certificate.pdf`;
    const transcriptPath = credential.product_code === 'professional'
      ? `${credential.candidate_id}/${credential.id}/transcript.pdf`
      : null;
    const badgePath = `badges/${credential.id}/${badge.badge_code}.svg`;

    const certificateBytes = await createCertificatePdf({
      credential,
      eligibility,
      platform,
      verificationUrl,
    });
    const certificateUpload = await admin.storage
      .from(PRIVATE_ASSET_BUCKET)
      .upload(certificatePath, certificateBytes, {
        contentType: 'application/pdf',
        cacheControl: '3600',
        upsert: true,
      });
    if (certificateUpload.error) throw new Error(certificateUpload.error.message);

    if (transcriptPath) {
      const transcriptBytes = await createTranscriptPdf({
        credential,
        eligibility,
        order,
        platform,
        verificationUrl,
      });
      const transcriptUpload = await admin.storage
        .from(PRIVATE_ASSET_BUCKET)
        .upload(transcriptPath, transcriptBytes, {
          contentType: 'application/pdf',
          cacheControl: '3600',
          upsert: true,
        });
      if (transcriptUpload.error) throw new Error(transcriptUpload.error.message);
    }

    const badgeSvg = await createBadgeSvg({ credential, badge, platform, verificationUrl });
    const badgeUpload = await admin.storage
      .from(BADGE_ASSET_BUCKET)
      .upload(badgePath, new Blob([badgeSvg], { type: 'image/svg+xml' }), {
        contentType: 'image/svg+xml',
        cacheControl: '3600',
        upsert: true,
      });
    if (badgeUpload.error) throw new Error(badgeUpload.error.message);

    const { data: badgePublicData } = admin.storage
      .from(BADGE_ASSET_BUCKET)
      .getPublicUrl(badgePath);
    const badgePublicUrl = badgePublicData.publicUrl;

    const generatedAt = new Date().toISOString();
    const credentialUpdate = await admin
      .from('agilecert_credentials')
      .update({
        certificate_storage_path: certificatePath,
        transcript_storage_path: transcriptPath,
        metadata: {
          ...(credential.metadata || {}),
          assetGenerationStatus: 'ready',
          assetGeneratedAt: generatedAt,
          certificateStorageBucket: PRIVATE_ASSET_BUCKET,
          badgeStorageBucket: BADGE_ASSET_BUCKET,
          verificationUrl,
        },
        updated_at: generatedAt,
      })
      .eq('id', credential.id);
    if (credentialUpdate.error) throw new Error(credentialUpdate.error.message);

    const badgeUpdate = await admin
      .from('agilecert_digital_badges')
      .update({
        image_storage_path: badgePath,
        share_url: verificationUrl,
        badge_assertion: {
          ...(badge.badge_assertion || {}),
          image: badgePublicUrl,
          verificationUrl,
          issuer: `${platform.brand_name} by ${platform.legal_entity_name}`,
          assetGeneratedAt: generatedAt,
        },
        updated_at: generatedAt,
      })
      .eq('id', badge.id);
    if (badgeUpdate.error) throw new Error(badgeUpdate.error.message);

    const result: AgileCertGeneratedAssets = {
      credentialId: credential.id,
      certificateStoragePath: certificatePath,
      transcriptStoragePath: transcriptPath,
      badgeStoragePath: badgePath,
      badgePublicUrl,
      verificationUrl,
    };

    await setAssetJobStatus(admin, credential.id, 'sent', result);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Credential asset generation failed.';
    await setAssetJobStatus(admin, cleanCredentialId, 'failed', {}, message);
    throw error;
  }
}

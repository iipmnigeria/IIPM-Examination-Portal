import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'npm:pdf-lib@1.17.1';
// @ts-types="npm:@types/qrcode@1.5.5"
import QRCode from 'npm:qrcode@1.5.4';

type AgileCertCredential = {
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

type AgileCertBadge = {
  id: string;
  credential_id: string;
  badge_code: string;
  badge_class: string;
  badge_assertion: Record<string, unknown> | null;
  image_storage_path: string | null;
  share_url: string | null;
};

export type AgileCertCredentialAssetResult = {
  credentialId: string;
  credentialCode: string;
  certificatePath: string;
  transcriptPath: string | null;
  badgeImagePath: string;
  badgeImageUrl: string;
  badgeAssertionPath: string;
  badgeAssertionUrl: string;
  verificationUrl: string;
  generatedAt: string;
};

const CREDENTIAL_BUCKET = 'agilecert-credential-assets';
const BADGE_BUCKET = 'agilecert-badge-assets';
const NAVY = rgb(0.047, 0.137, 0.251);
const GREEN = rgb(0.02, 0.55, 0.36);
const SLATE = rgb(0.28, 0.33, 0.41);
const LIGHT = rgb(0.965, 0.976, 0.988);

function pdfSafe(value: unknown): string {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '?')
    .trim();
}

function xmlEscape(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] || '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = pdfSafe(text).split(/\s+/).filter(Boolean);
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

function drawCentered(
  page: PDFPage,
  text: string,
  y: number,
  font: PDFFont,
  size: number,
  color = NAVY,
) {
  const safe = pdfSafe(text);
  const pageWidth = page.getWidth();
  const width = font.widthOfTextAtSize(safe, size);
  page.drawText(safe, {
    x: Math.max(28, (pageWidth - width) / 2),
    y,
    size,
    font,
    color,
  });
}

function drawCenteredWrapped(
  page: PDFPage,
  text: string,
  startY: number,
  font: PDFFont,
  size: number,
  maxWidth: number,
  color = NAVY,
  lineGap = 5,
): number {
  const lines = wrapText(text, font, size, maxWidth);
  let y = startY;
  for (const line of lines) {
    drawCentered(page, line, y, font, size, color);
    y -= size + lineGap;
  }
  return y;
}

async function createCertificatePdf(
  credential: AgileCertCredential,
  verificationUrl: string,
): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  const page = document.addPage([842, 595]);
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const italic = await document.embedFont(StandardFonts.HelveticaOblique);

  page.drawRectangle({ x: 0, y: 0, width: 842, height: 595, color: rgb(0.995, 0.992, 0.975) });
  page.drawRectangle({ x: 18, y: 18, width: 806, height: 559, borderColor: NAVY, borderWidth: 3 });
  page.drawRectangle({ x: 25, y: 25, width: 792, height: 545, borderColor: GREEN, borderWidth: 1 });
  page.drawRectangle({ x: 31, y: 31, width: 780, height: 533, borderColor: NAVY, borderWidth: 0.5 });

  drawCentered(page, 'AGILECERT GLOBAL', 525, bold, 28, NAVY);
  drawCentered(page, 'Powered by the Integrated Institute of Professional Management (IIPM)', 500, regular, 10, SLATE);
  page.drawLine({ start: { x: 265, y: 485 }, end: { x: 577, y: 485 }, color: GREEN, thickness: 2 });

  const certificateHeading = credential.product_code === 'professional'
    ? 'PROFESSIONAL CERTIFICATE'
    : 'CERTIFICATE OF ACHIEVEMENT';
  drawCentered(page, certificateHeading, 445, bold, 24, NAVY);
  drawCentered(page, 'This independently verifies that', 414, italic, 12, SLATE);

  drawCenteredWrapped(page, credential.holder_name.toUpperCase(), 370, bold, 30, 690, NAVY, 4);
  page.drawLine({ start: { x: 150, y: 345 }, end: { x: 692, y: 345 }, color: NAVY, thickness: 0.75 });

  drawCentered(page, 'met the required standard in the specialist competency examination', 315, regular, 12, SLATE);
  const nextY = drawCenteredWrapped(page, credential.examination_title, 280, bold, 21, 680, NAVY, 5);
  drawCentered(page, `with a verified score of ${Number(credential.score).toFixed(2)}%.`, nextY - 5, regular, 12, SLATE);

  if (credential.product_code === 'professional') {
    drawCentered(
      page,
      'Higher-assurance credential: identity verified and examination integrity cleared.',
      nextY - 34,
      bold,
      10,
      GREEN,
    );
  }

  const issued = new Date(`${credential.issue_date}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  page.drawRectangle({ x: 55, y: 70, width: 520, height: 86, color: LIGHT, borderColor: rgb(0.8, 0.84, 0.89), borderWidth: 0.5 });
  page.drawText(`Credential ID: ${pdfSafe(credential.credential_code)}`, { x: 72, y: 128, size: 10, font: bold, color: NAVY });
  page.drawText(`Issued: ${pdfSafe(issued)}`, { x: 72, y: 107, size: 10, font: regular, color: SLATE });
  page.drawText('Verify online:', { x: 72, y: 86, size: 9, font: bold, color: NAVY });
  const verificationLines = wrapText(verificationUrl, regular, 7.5, 440);
  verificationLines.slice(0, 2).forEach((line, index) => {
    page.drawText(line, { x: 137, y: 86 - index * 10, size: 7.5, font: regular, color: SLATE });
  });

  const qrDataUrl = await QRCode.toDataURL(verificationUrl, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 300,
  });
  const qrImage = await document.embedPng(dataUrlToBytes(qrDataUrl));
  page.drawImage(qrImage, { x: 650, y: 65, width: 105, height: 105 });
  page.drawText('SCAN TO VERIFY', { x: 659, y: 52, size: 8, font: bold, color: GREEN });

  drawCentered(
    page,
    'AgileCert Global credentials are independently developed and issued. External framework references do not imply affiliation or endorsement.',
    38,
    regular,
    6.7,
    SLATE,
  );

  return document.save();
}

async function createTranscriptPdf(
  credential: AgileCertCredential,
  verificationUrl: string,
): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  const page = document.addPage([595, 842]);
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);

  page.drawRectangle({ x: 0, y: 0, width: 595, height: 842, color: rgb(1, 1, 1) });
  page.drawRectangle({ x: 28, y: 28, width: 539, height: 786, borderColor: NAVY, borderWidth: 1.5 });
  page.drawRectangle({ x: 42, y: 740, width: 511, height: 58, color: NAVY });
  page.drawText('AGILECERT GLOBAL', { x: 60, y: 770, size: 20, font: bold, color: rgb(1, 1, 1) });
  page.drawText('Professional Examination Transcript', { x: 60, y: 750, size: 11, font: regular, color: rgb(0.82, 0.93, 0.9) });

  const metadata = credential.metadata || {};
  const entries: Array<[string, string]> = [
    ['Candidate', credential.holder_name],
    ['Credential', credential.credential_title],
    ['Examination', credential.examination_title],
    ['Verified score', `${Number(credential.score).toFixed(2)}%`],
    ['Pass mark', `${Number(metadata.passMark ?? 0).toFixed(2)}%`],
    ['Credential ID', credential.credential_code],
    ['Issue date', credential.issue_date],
    ['Examination integrity', String(metadata.integrityStatus ?? 'cleared')],
    ['Identity verification', String(metadata.identityVerificationStatus ?? 'verified')],
    ['Assessment pathway', 'Independent specialist competency examination'],
  ];

  let y = 690;
  for (const [label, value] of entries) {
    page.drawRectangle({ x: 58, y: y - 12, width: 480, height: 38, color: y % 2 === 0 ? LIGHT : rgb(1, 1, 1) });
    page.drawText(pdfSafe(label), { x: 72, y: y + 3, size: 9, font: bold, color: SLATE });
    const lines = wrapText(value, regular, 10, 300);
    lines.slice(0, 2).forEach((line, index) => {
      page.drawText(line, { x: 225, y: y + 3 - index * 12, size: 10, font: regular, color: NAVY });
    });
    y -= 48;
  }

  page.drawText('Verification URL', { x: 72, y: 185, size: 9, font: bold, color: SLATE });
  wrapText(verificationUrl, regular, 8, 420).slice(0, 3).forEach((line, index) => {
    page.drawText(line, { x: 72, y: 165 - index * 11, size: 8, font: regular, color: NAVY });
  });

  page.drawText(
    'This transcript is system-generated from the authoritative AgileCert Global examination and credential registry.',
    { x: 72, y: 90, size: 8, font: regular, color: SLATE },
  );
  page.drawText('Powered by IIPM', { x: 72, y: 70, size: 9, font: bold, color: GREEN });

  return document.save();
}

function createBadgeSvg(credential: AgileCertCredential, verificationUrl: string): string {
  const label = credential.product_code === 'professional' ? 'PROFESSIONAL' : 'ACHIEVEMENT';
  const accent = credential.product_code === 'professional' ? '#047857' : '#0f766e';
  const title = xmlEscape(credential.examination_title);
  const holder = xmlEscape(credential.holder_name);
  const code = xmlEscape(credential.credential_code);
  const verification = xmlEscape(verificationUrl);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="720" height="720" viewBox="0 0 720 720" role="img" aria-labelledby="title description">
  <title id="title">AgileCert Global ${label} Digital Badge</title>
  <desc id="description">Verifiable digital badge issued to ${holder} for ${title}</desc>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#071426"/>
      <stop offset="1" stop-color="${accent}"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="14" stdDeviation="18" flood-color="#020617" flood-opacity="0.35"/>
    </filter>
  </defs>
  <rect width="720" height="720" rx="70" fill="#f8fafc"/>
  <circle cx="360" cy="332" r="276" fill="url(#bg)" filter="url(#shadow)"/>
  <circle cx="360" cy="332" r="244" fill="none" stroke="#d1fae5" stroke-width="6"/>
  <circle cx="360" cy="332" r="215" fill="none" stroke="#6ee7b7" stroke-width="2" opacity="0.7"/>
  <text x="360" y="170" text-anchor="middle" fill="#a7f3d0" font-family="Arial, sans-serif" font-size="28" font-weight="800" letter-spacing="4">AGILECERT GLOBAL</text>
  <text x="360" y="215" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="21" font-weight="700">POWERED BY IIPM</text>
  <path d="M360 250 l30 58 64 9-47 45 11 64-58-30-58 30 11-64-47-45 64-9z" fill="#fbbf24" stroke="#fde68a" stroke-width="5"/>
  <text x="360" y="475" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="34" font-weight="900">${label}</text>
  <foreignObject x="125" y="500" width="470" height="86">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Arial,sans-serif;font-size:24px;font-weight:800;text-align:center;color:#d1fae5;line-height:1.25;">${title}</div>
  </foreignObject>
  <path d="M250 580 L205 690 L360 635 L515 690 L470 580" fill="${accent}" stroke="#071426" stroke-width="6"/>
  <text x="360" y="620" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="16" font-weight="700">${code}</text>
  <metadata>{"holder":"${holder}","verification":"${verification}"}</metadata>
</svg>`;
}

function createBadgeAssertion(
  credential: AgileCertCredential,
  badge: AgileCertBadge,
  verificationUrl: string,
  badgeImageUrl: string,
): Record<string, unknown> {
  const existing = badge.badge_assertion || {};
  const description = credential.product_code === 'professional'
    ? `Higher-assurance professional credential for passing the ${credential.examination_title} examination with identity and integrity verification.`
    : `Achievement credential for passing the ${credential.examination_title} specialist competency examination.`;

  return {
    ...existing,
    '@context': [
      'https://www.w3.org/2018/credentials/v1',
      'https://purl.imsglobal.org/spec/ob/v3p0/context.json',
    ],
    id: verificationUrl,
    type: ['VerifiableCredential', 'OpenBadgeCredential'],
    name: credential.credential_title,
    issuer: {
      id: 'https://iipmi.org',
      type: ['Profile'],
      name: 'AgileCert Global by IIPM',
      url: 'https://iipmi.org',
    },
    validFrom: credential.issued_at,
    credentialSubject: {
      type: ['AchievementSubject'],
      name: credential.holder_name,
      achievement: {
        id: `${verificationUrl}#achievement`,
        type: ['Achievement'],
        name: credential.credential_title,
        description,
        criteria: {
          narrative: `Passed the ${credential.examination_title} examination with a verified score of ${Number(credential.score).toFixed(2)}%.`,
        },
        image: {
          id: badgeImageUrl,
          type: 'Image',
        },
      },
    },
    evidence: [
      {
        id: verificationUrl,
        type: ['Evidence'],
        name: 'AgileCert Global public verification record',
      },
    ],
    credentialStatus: {
      id: verificationUrl,
      type: 'CredentialStatus',
    },
    badgeCode: badge.badge_code,
    credentialCode: credential.credential_code,
  };
}

async function markAssetJob(
  admin: SupabaseClient,
  credential: AgileCertCredential,
  status: 'sent' | 'failed',
  payload: Record<string, unknown>,
  lastError?: string,
) {
  await admin
    .from('agilecert_automation_jobs')
    .update({
      status,
      sent_at: status === 'sent' ? new Date().toISOString() : null,
      last_error: lastError || null,
      payload,
      updated_at: new Date().toISOString(),
    })
    .eq('certificate_order_id', credential.certificate_order_id)
    .eq('job_type', 'credential_generate_assets')
    .in('status', ['pending', 'processing', 'failed']);
}

export async function generateAgileCertCredentialAssets(
  admin: SupabaseClient,
  credentialId: string,
): Promise<AgileCertCredentialAssetResult> {
  const { data: credentialData, error: credentialError } = await admin
    .from('agilecert_credentials')
    .select(
      'id, credential_code, verification_slug, candidate_id, eligibility_id, certificate_order_id, product_code, credential_title, holder_name, examination_title, score, issue_date, issued_at, status, certificate_storage_path, transcript_storage_path, metadata',
    )
    .eq('id', credentialId)
    .single();

  if (credentialError) throw new Error(credentialError.message);
  const credential = credentialData as AgileCertCredential;

  if (credential.status !== 'active') {
    throw new Error(`Credential assets cannot be generated while status is ${credential.status}.`);
  }

  const { data: badgeData, error: badgeError } = await admin
    .from('agilecert_digital_badges')
    .select('id, credential_id, badge_code, badge_class, badge_assertion, image_storage_path, share_url')
    .eq('credential_id', credential.id)
    .single();

  if (badgeError) throw new Error(badgeError.message);
  const badge = badgeData as AgileCertBadge;

  const { data: settingsData, error: settingsError } = await admin
    .from('agilecert_platform_settings')
    .select('portal_url')
    .eq('singleton', true)
    .single();

  if (settingsError) throw new Error(settingsError.message);
  const portalUrl = String(settingsData.portal_url || '').trim().replace(/\/$/, '');
  if (!portalUrl) throw new Error('The AgileCert public portal URL is not configured.');

  const verificationUrl = `${portalUrl}/?verify=${encodeURIComponent(credential.verification_slug)}`;
  const basePath = `${credential.candidate_id}/${credential.id}`;
  const certificatePath = `${basePath}/certificate.pdf`;
  const transcriptPath = credential.product_code === 'professional'
    ? `${basePath}/professional-transcript.pdf`
    : null;
  const badgeImagePath = `${credential.id}/badge.svg`;
  const badgeAssertionPath = `${credential.id}/assertion.json`;
  const generatedAt = new Date().toISOString();

  try {
    await admin
      .from('agilecert_automation_jobs')
      .update({ status: 'processing', updated_at: generatedAt })
      .eq('certificate_order_id', credential.certificate_order_id)
      .eq('job_type', 'credential_generate_assets')
      .in('status', ['pending', 'failed']);

    const certificatePdf = await createCertificatePdf(credential, verificationUrl);
    const { error: certificateUploadError } = await admin.storage
      .from(CREDENTIAL_BUCKET)
      .upload(certificatePath, certificatePdf, {
        contentType: 'application/pdf',
        cacheControl: '3600',
        upsert: true,
      });
    if (certificateUploadError) throw new Error(certificateUploadError.message);

    if (transcriptPath) {
      const transcriptPdf = await createTranscriptPdf(credential, verificationUrl);
      const { error: transcriptUploadError } = await admin.storage
        .from(CREDENTIAL_BUCKET)
        .upload(transcriptPath, transcriptPdf, {
          contentType: 'application/pdf',
          cacheControl: '3600',
          upsert: true,
        });
      if (transcriptUploadError) throw new Error(transcriptUploadError.message);
    }

    const badgeSvg = createBadgeSvg(credential, verificationUrl);
    const { error: badgeUploadError } = await admin.storage
      .from(BADGE_BUCKET)
      .upload(badgeImagePath, new TextEncoder().encode(badgeSvg), {
        contentType: 'image/svg+xml; charset=utf-8',
        cacheControl: '3600',
        upsert: true,
      });
    if (badgeUploadError) throw new Error(badgeUploadError.message);

    const badgeImageUrl = admin.storage.from(BADGE_BUCKET).getPublicUrl(badgeImagePath).data.publicUrl;
    const assertion = createBadgeAssertion(credential, badge, verificationUrl, badgeImageUrl);
    const { error: assertionUploadError } = await admin.storage
      .from(BADGE_BUCKET)
      .upload(
        badgeAssertionPath,
        new TextEncoder().encode(JSON.stringify(assertion, null, 2)),
        {
          contentType: 'application/json; charset=utf-8',
          cacheControl: '3600',
          upsert: true,
        },
      );
    if (assertionUploadError) throw new Error(assertionUploadError.message);

    const badgeAssertionUrl = admin.storage.from(BADGE_BUCKET).getPublicUrl(badgeAssertionPath).data.publicUrl;

    const { error: credentialUpdateError } = await admin
      .from('agilecert_credentials')
      .update({
        certificate_storage_path: certificatePath,
        transcript_storage_path: transcriptPath,
        metadata: {
          ...(credential.metadata || {}),
          assetsGeneratedAt: generatedAt,
          verificationUrl,
          badgeImageUrl,
          badgeAssertionUrl,
        },
        updated_at: generatedAt,
      })
      .eq('id', credential.id);
    if (credentialUpdateError) throw new Error(credentialUpdateError.message);

    const { error: badgeUpdateError } = await admin
      .from('agilecert_digital_badges')
      .update({
        badge_assertion: assertion,
        image_storage_path: badgeImagePath,
        share_url: verificationUrl,
        updated_at: generatedAt,
      })
      .eq('id', badge.id);
    if (badgeUpdateError) throw new Error(badgeUpdateError.message);

    const result: AgileCertCredentialAssetResult = {
      credentialId: credential.id,
      credentialCode: credential.credential_code,
      certificatePath,
      transcriptPath,
      badgeImagePath,
      badgeImageUrl,
      badgeAssertionPath,
      badgeAssertionUrl,
      verificationUrl,
      generatedAt,
    };

    await markAssetJob(admin, credential, 'sent', {
      credentialId: credential.id,
      badgeId: badge.id,
      ...result,
    });

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Credential asset generation failed.';
    await markAssetJob(
      admin,
      credential,
      'failed',
      {
        credentialId: credential.id,
        badgeId: badge.id,
        failedAt: new Date().toISOString(),
      },
      message,
    );
    throw error;
  }
}

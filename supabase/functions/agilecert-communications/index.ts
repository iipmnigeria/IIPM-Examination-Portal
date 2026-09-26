import { adminClient, requiredEnvironment } from '../_shared/supabase.ts';

type OutboxRow = {
  id: string;
  candidate_id: string;
  recipient_email: string;
  recipient_email_hash: string;
  message_type: string;
  category: 'operational' | 'certificate_reminder' | 'marketing';
  event_key: string;
  payload: Record<string, unknown>;
  attempts: number;
};

type CommunicationSettings = {
  provider: 'resend';
  provider_enabled: boolean;
  from_name: string;
  from_email: string | null;
  reply_to_email: string | null;
  monitor_copy_email: string | null;
  portal_url: string;
  hourly_batch_size: number;
  max_attempts: number;
};

type RenderedMessage = {
  subject: string;
  html: string;
  text: string;
};

const encoder = new TextEncoder();

function cleanText(value: unknown, maxLength: number): string {
  return String(value || '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLength);
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function safeUrl(value: unknown, fallback: string): string {
  try {
    const url = new URL(String(value || fallback));
    if (!['https:', 'http:'].includes(url.protocol)) return fallback;
    return url.toString();
  } catch {
    return fallback;
  }
}

function money(amountMinor: unknown, currency: unknown): string {
  const amount = Number(amountMinor || 0) / 100;
  const code = cleanText(currency, 3).toUpperCase() || 'NGN';
  try {
    return new Intl.NumberFormat(code === 'NGN' ? 'en-NG' : 'en-US', {
      style: 'currency',
      currency: code,
      maximumFractionDigits: code === 'NGN' ? 0 : 2,
    }).format(amount);
  } catch {
    return `${code} ${amount.toFixed(2)}`;
  }
}

function formatDate(value: unknown): string {
  const date = new Date(String(value || ''));
  return Number.isNaN(date.getTime())
    ? 'the stated date'
    : new Intl.DateTimeFormat('en-GB', {
        dateStyle: 'long',
        timeStyle: 'short',
        timeZone: 'Africa/Lagos',
      }).format(date);
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function hmacHex(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

function json(payload: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function htmlPage(title: string, body: string, status = 200): Response {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head><body style="margin:0;background:#f8fafc;color:#0f172a;font-family:Arial,sans-serif"><main style="max-width:680px;margin:48px auto;padding:24px"><section style="background:#fff;border:1px solid #e2e8f0;border-radius:20px;padding:32px;box-shadow:0 18px 50px rgba(15,23,42,.08)"><h1 style="margin:0 0 16px">${escapeHtml(title)}</h1>${body}</section></main></body></html>`,
    {
      status,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    },
  );
}

function requireWorker(request: Request): void {
  const configured = requiredEnvironment('AGILECERT_COMMUNICATIONS_WORKER_TOKEN');
  const supplied = request.headers.get('x-agilecert-worker-token')?.trim() || '';
  if (!supplied || !timingSafeEqual(configured, supplied)) {
    throw new Error('Communications worker authorisation failed.');
  }
}

function requireWebhook(request: Request): void {
  const configured = requiredEnvironment('AGILECERT_COMMUNICATIONS_WEBHOOK_TOKEN');
  const url = new URL(request.url);
  const supplied =
    request.headers.get('x-agilecert-webhook-token')?.trim() ||
    url.searchParams.get('token')?.trim() ||
    '';
  if (!supplied || !timingSafeEqual(configured, supplied)) {
    throw new Error('Communications webhook authorisation failed.');
  }
}

async function unsubscribeToken(candidateId: string, scope: string): Promise<string> {
  const secret = requiredEnvironment('AGILECERT_COMMUNICATIONS_SIGNING_SECRET');
  const message = `${candidateId}.${scope}`;
  return `${message}.${await hmacHex(secret, message)}`;
}

async function verifyUnsubscribeToken(
  token: string,
): Promise<{ candidateId: string; scope: string } | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [candidateId, scope, signature] = parts;
  if (!/^[0-9a-f-]{36}$/i.test(candidateId)) return null;
  if (!['certificate_reminders', 'course_recommendations', 'all_optional', 'all_email'].includes(scope)) {
    return null;
  }
  const expected = await hmacHex(
    requiredEnvironment('AGILECERT_COMMUNICATIONS_SIGNING_SECRET'),
    `${candidateId}.${scope}`,
  );
  return timingSafeEqual(expected, signature) ? { candidateId, scope } : null;
}

async function candidateName(candidateId: string): Promise<string> {
  const { data } = await adminClient()
    .from('profiles')
    .select('full_name')
    .eq('id', candidateId)
    .maybeSingle();
  return cleanText(data?.full_name, 180) || 'Candidate';
}

async function courseRecommendations(sourceExaminationId: string): Promise<Array<{ title: string; description: string }>> {
  const admin = adminClient();
  const { data, error } = await admin
    .from('examinations')
    .select('title, programme:programmes(description)')
    .eq('status', 'published')
    .neq('id', sourceExaminationId)
    .order('title')
    .limit(3);
  if (error) return [];
  return (data || []).map((row: any) => ({
    title: cleanText(row.title, 240),
    description: cleanText(row.programme?.description, 500) || 'A focused specialist certification pathway.',
  }));
}

function emailFrame(input: {
  heading: string;
  intro: string;
  content: string;
  actionLabel: string;
  actionUrl: string;
  footer: string;
}): string {
  return `<!doctype html><html lang="en"><body style="margin:0;background:#f1f5f9;color:#0f172a;font-family:Arial,sans-serif"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:28px 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:680px;margin:0 auto;background:#fff;border-radius:20px;overflow:hidden"><tr><td style="padding:24px 30px;background:#020617;color:#fff"><div style="font-size:13px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#a7f3d0">AgileCert Global · Powered by IIPM</div><h1 style="margin:10px 0 0;font-size:26px;line-height:1.25">${escapeHtml(input.heading)}</h1></td></tr><tr><td style="padding:30px"><p style="font-size:16px;line-height:1.7;margin:0 0 18px">${escapeHtml(input.intro)}</p>${input.content}<p style="margin:26px 0"><a href="${escapeHtml(input.actionUrl)}" style="display:inline-block;padding:13px 20px;border-radius:10px;background:#047857;color:#fff;text-decoration:none;font-weight:800">${escapeHtml(input.actionLabel)}</a></p><div style="margin-top:28px;padding-top:18px;border-top:1px solid #e2e8f0;font-size:12px;line-height:1.6;color:#64748b">${input.footer}</div></td></tr></table></td></tr></table></body></html>`;
}

async function renderMessage(
  row: OutboxRow,
  settings: CommunicationSettings,
): Promise<RenderedMessage> {
  const payload = row.payload || {};
  const name = await candidateName(row.candidate_id);
  const portalUrl = safeUrl(settings.portal_url, 'https://iipmnigeria.github.io/IIPM-Examination-Portal/');
  const preferencesToken = await unsubscribeToken(row.candidate_id, 'all_optional');
  const functionUrl = `${requiredEnvironment('SUPABASE_URL').replace(/\/$/, '')}/functions/v1/agilecert-communications`;
  const unsubscribeUrl = `${functionUrl}?action=unsubscribe&token=${encodeURIComponent(preferencesToken)}`;
  const optionalFooter = row.category === 'operational'
    ? `This is an operational message about an examination, payment or credential. Manage optional reminders in the portal.`
    : `You may <a href="${escapeHtml(unsubscribeUrl)}" style="color:#475569">unsubscribe from optional AgileCert emails</a> or manage preferences in the portal.`;


  if (row.message_type === 'cipmn_exam_preparation') {
    const nextModules = cleanText(payload.moduleCodes, 500) || 'your remaining CIPMN modules';
    const nextDate = cleanText(payload.nextExaminationDate, 80) || 'your next examination date';
    return {
      subject: 'CIPMN examination preparation: keep moving before your next paper',
      html: emailFrame({
        heading: 'Your CIPMN examination preparation continues',
        intro: `Hello ${name}, the CIPMN Licensing Examination is approaching and your preparation should stay focused on the papers still ahead.`,
        content: `<p style="line-height:1.7"><strong>Next relevant modules:</strong> ${escapeHtml(nextModules)}</p><p style="line-height:1.7"><strong>Next examination date:</strong> ${escapeHtml(nextDate)}</p><p style="line-height:1.7">Use AgileCert to revise the available preparation materials and practise the current MCQ + Theory mock format before the corresponding examination date.</p>`,
        actionLabel: 'Continue CIPMN preparation',
        actionUrl: portalUrl,
        footer: optionalFooter,
      }),
      text: `Hello ${name}, continue preparing for your remaining CIPMN papers. Next relevant modules: ${nextModules}. Next examination date: ${nextDate}. Open AgileCert: ${portalUrl}`,
    };
  }

  if (row.message_type === 'cipmn_payment_recovery') {
    const moduleCode = cleanText(payload.moduleCode, 80) || 'your CIPMN module';
    const examinationDate = cleanText(payload.examinationDate, 80) || 'the scheduled examination date';
    const reference = cleanText(payload.reference, 120);
    return {
      subject: `Complete your AgileCert payment for ${moduleCode}`,
      html: emailFrame({
        heading: 'Your CIPMN preparation payment is still incomplete',
        intro: `Hello ${name}, your AgileCert payment for ${moduleCode} has not yet been completed.`,
        content: `<p style="line-height:1.7">Your preparation access for this module will remain unavailable until payment is successfully completed.</p><p style="line-height:1.7"><strong>Examination date:</strong> ${escapeHtml(examinationDate)}${reference ? `<br><strong>Payment reference:</strong> ${escapeHtml(reference)}` : ''}</p><p style="line-height:1.7">If you have already completed payment using another transaction, no further action is required once AgileCert confirms the successful order.</p>`,
        actionLabel: 'Complete payment',
        actionUrl: portalUrl,
        footer: optionalFooter,
      }),
      text: `Hello ${name}, your AgileCert payment for ${moduleCode} is still incomplete. Examination date: ${examinationDate}. Complete payment in AgileCert: ${portalUrl}`,
    };
  }

  if (row.message_type === 'cipmn_unpurchased_modules') {
    const modules = cleanText(payload.moduleCodes, 1200) || 'your remaining modules';
    const nearestDate = cleanText(payload.nearestExaminationDate, 80) || 'the next scheduled examination date';
    const discountCode = cleanText(payload.discountCode, 80);
    const discountExpiresAt = cleanText(payload.discountExpiresAt, 80);
    const offer = discountCode
      ? `<p style="line-height:1.7"><strong>Current access code:</strong> ${escapeHtml(discountCode)}${discountExpiresAt ? `<br><strong>Offer ends:</strong> ${escapeHtml(discountExpiresAt)}` : ''}</p>`
      : '';
    return {
      subject: 'Your remaining CIPMN preparation modules on AgileCert',
      html: emailFrame({
        heading: 'Complete the preparation modules still ahead',
        intro: `Hello ${name}, you still have CIPMN examination modules that are not yet active in your AgileCert account.`,
        content: `<p style="line-height:1.7"><strong>Modules not yet purchased:</strong> ${escapeHtml(modules)}</p><p style="line-height:1.7"><strong>Nearest relevant examination:</strong> ${escapeHtml(nearestDate)}</p>${offer}<p style="line-height:1.7">Modules whose official examination dates have passed are automatically removed from these reminders.</p>`,
        actionLabel: 'Review remaining modules',
        actionUrl: portalUrl,
        footer: optionalFooter,
      }),
      text: `Hello ${name}, your remaining unpurchased CIPMN preparation modules are: ${modules}. Nearest relevant examination: ${nearestDate}. Review them in AgileCert: ${portalUrl}`,
    };
  }

  if (row.message_type === 'cipmn_mock_start') {
    const modules = cleanText(payload.moduleCodes, 1200) || 'your purchased CIPMN modules';
    const nearestDate = cleanText(payload.nearestExaminationDate, 80) || 'your next examination date';
    return {
      subject: 'Start the CIPMN mock examinations already available to you',
      html: emailFrame({
        heading: 'You have purchased mocks that are still untouched',
        intro: `Hello ${name}, some CIPMN mock examinations already available in your AgileCert account have not yet been started.`,
        content: `<p style="line-height:1.7"><strong>Ready to start:</strong> ${escapeHtml(modules)}</p><p style="line-height:1.7"><strong>Nearest relevant examination:</strong> ${escapeHtml(nearestDate)}</p><p style="line-height:1.7">Starting now gives you time to identify weak areas, revisit the preparation material and practise the MCQ + Theory format before the real examination.</p>`,
        actionLabel: 'Start your mock',
        actionUrl: portalUrl,
        footer: optionalFooter,
      }),
      text: `Hello ${name}, these purchased CIPMN mocks are still untouched: ${modules}. Nearest relevant examination: ${nearestDate}. Start in AgileCert: ${portalUrl}`,
    };
  }

  if (row.message_type === 'cipmn_mock_resume') {
    const modules = cleanText(payload.moduleCodes, 1200) || 'your incomplete CIPMN mock';
    const nearestDate = cleanText(payload.nearestExaminationDate, 80) || 'your next examination date';
    return {
      subject: 'Resume your incomplete CIPMN mock examination',
      html: emailFrame({
        heading: 'Your CIPMN mock is waiting for you',
        intro: `Hello ${name}, you started a CIPMN mock examination but have not yet completed it.`,
        content: `<p style="line-height:1.7"><strong>Incomplete mock:</strong> ${escapeHtml(modules)}</p><p style="line-height:1.7"><strong>Nearest relevant examination:</strong> ${escapeHtml(nearestDate)}</p><p style="line-height:1.7">Return to AgileCert and complete the mock while there is still time to review the areas that need more attention.</p>`,
        actionLabel: 'Resume your mock',
        actionUrl: portalUrl,
        footer: optionalFooter,
      }),
      text: `Hello ${name}, resume your incomplete CIPMN mock: ${modules}. Nearest relevant examination: ${nearestDate}. Continue in AgileCert: ${portalUrl}`,
    };
  }

  if (row.message_type === 'preparation_material_ready') {
    const title = cleanText(payload.examinationTitle, 240) || 'your examination';
    return {
      subject: `Your ${title} preparation access is ready`,
      html: emailFrame({
        heading: 'Your preparation access is ready',
        intro: `Hello ${name}, your verified examination access for ${title} is active.`,
        content: '<p style="line-height:1.7">Sign in to view the examination workspace and any preparation material currently mapped to the examination.</p>',
        actionLabel: 'Open examination portal',
        actionUrl: portalUrl,
        footer: optionalFooter,
      }),
      text: `Hello ${name}, your verified examination access for ${title} is active. Sign in at ${portalUrl}.`,
    };
  }

  if (row.message_type.startsWith('certificate_offer_')) {
    const title = cleanText(payload.examinationTitle, 240) || 'your examination';
    const score = Number(payload.score || 0);
    const passMark = Number(payload.passMark || 0);
    const expiry = formatDate(payload.earlyPriceExpiresAt);
    const finalNotice = row.message_type === 'certificate_offer_day_7';
    return {
      subject: finalNotice
        ? `Final early-price reminder for your ${title} certificate`
        : `You passed ${title} — choose your certificate`,
      html: emailFrame({
        heading: finalNotice ? 'Your early certificate price is ending' : 'Congratulations on passing',
        intro: `Hello ${name}, you achieved ${score.toFixed(0)}% against the ${passMark.toFixed(0)}% pass mark in ${title}.`,
        content: `<p style="line-height:1.7">You may choose a Certificate of Achievement or, where identity and integrity requirements are satisfied, a Professional Certificate. Certificate purchase is optional and separate from the examination fee.</p><p style="line-height:1.7"><strong>Early-price window:</strong> until ${escapeHtml(expiry)}.</p>`,
        actionLabel: 'Review certificate options',
        actionUrl: portalUrl,
        footer: optionalFooter,
      }),
      text: `Hello ${name}, you passed ${title} with ${score.toFixed(0)}%. Review optional certificate choices before ${expiry}: ${portalUrl}.`,
    };
  }

  if (row.message_type === 'certificate_purchase_confirmation') {
    const product = cleanText(payload.productTitle, 180) || 'certificate';
    const reference = cleanText(payload.reference, 120);
    const amount = money(payload.amountMinor, payload.currency);
    return {
      subject: `${product} purchase confirmed`,
      html: emailFrame({
        heading: 'Certificate purchase confirmed',
        intro: `Hello ${name}, your ${product} order has been verified.`,
        content: `<p style="line-height:1.7"><strong>Reference:</strong> ${escapeHtml(reference)}<br><strong>Amount:</strong> ${escapeHtml(amount)}</p><p style="line-height:1.7">Certificate reminder emails for this examination have stopped. Your credential will appear in the portal when issuance is complete.</p>`,
        actionLabel: 'View credential store',
        actionUrl: portalUrl,
        footer: optionalFooter,
      }),
      text: `Hello ${name}, your ${product} order ${reference} for ${amount} has been verified. View status at ${portalUrl}.`,
    };
  }

  if (row.message_type === 'credential_ready') {
    const credentialName = cleanText(payload.linkedinCredentialName, 220) || 'AgileCert credential';
    const credentialCode = cleanText(payload.credentialCode, 120);
    const verificationUrl = safeUrl(payload.verificationUrl, portalUrl);
    return {
      subject: `${credentialName} is ready`,
      html: emailFrame({
        heading: 'Your professional credential is ready',
        intro: `Hello ${name}, your ${credentialName} has been issued.`,
        content: `<p style="line-height:1.7"><strong>Credential code:</strong> ${escapeHtml(credentialCode)}</p><p style="line-height:1.7">Your credential wallet contains the available certificate, badge, transcript and public verification information for this product.</p>`,
        actionLabel: 'Open verified credential',
        actionUrl: verificationUrl,
        footer: optionalFooter,
      }),
      text: `Hello ${name}, your ${credentialName} (${credentialCode}) is ready: ${verificationUrl}.`,
    };
  }

  const sourceId = cleanText(payload.sourceExaminationId, 80);
  const recommendations = await courseRecommendations(sourceId);
  const listHtml = recommendations.length
    ? `<ul style="padding-left:20px;line-height:1.7">${recommendations.map((item) => `<li><strong>${escapeHtml(item.title)}</strong> — ${escapeHtml(item.description)}</li>`).join('')}</ul>`
    : '<p style="line-height:1.7">Explore the currently published specialist examinations in the portal.</p>';
  return {
    subject: 'Continue your professional certification pathway',
    html: emailFrame({
      heading: 'Recommended next certification pathways',
      intro: `Hello ${name}, congratulations again on your newly issued AgileCert credential.`,
      content: `${listHtml}<p style="line-height:1.7">These are optional recommendations based on the published catalogue, not guaranteed career or membership outcomes.</p>`,
      actionLabel: 'Explore published examinations',
      actionUrl: portalUrl,
      footer: optionalFooter,
    }),
    text: `Hello ${name}, explore optional next specialist examinations in the AgileCert portal: ${portalUrl}.`,
  };
}

async function sendWithResend(
  row: OutboxRow,
  settings: CommunicationSettings,
  rendered: RenderedMessage,
): Promise<{ id: string; payload: Record<string, unknown> }> {
  const apiKey = requiredEnvironment('RESEND_API_KEY');
  const fromEmail = settings.from_email?.trim();
  if (!fromEmail) throw new Error('A verified sender email is not configured.');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': row.event_key,
    },
    body: JSON.stringify({
      from: `${settings.from_name} <${fromEmail}>`,
      to: [row.recipient_email],
      cc: row.event_key.startsWith('cipmn-oct-2026:') && settings.monitor_copy_email?.trim()
        ? [settings.monitor_copy_email.trim()]
        : undefined,
      reply_to: settings.reply_to_email || undefined,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      tags: [
        { name: 'message_type', value: row.message_type.slice(0, 50) },
        { name: 'category', value: row.category.slice(0, 50) },
      ],
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(cleanText((payload as any)?.message || `Resend HTTP ${response.status}`, 1000));
  }
  const id = cleanText(payload.id, 200);
  if (!id) throw new Error('The email provider did not return a message identifier.');
  return { id, payload };
}


const CIPMN_OCT_2026_MODULES: Record<string, { examinationId: string; examinationDate: string }> = {
  'MOD-001': { examinationId: '2e5fea8b-a4de-5c61-9a43-e53e9d28403f', examinationDate: '2026-10-08' },
  'MOD-002': { examinationId: 'fe7a116b-72ef-5d1f-acc8-36938ee8b0cf', examinationDate: '2026-10-09' },
  'MOD-003': { examinationId: '916ed55c-e157-5e23-9d46-43ad4e2b9c2a', examinationDate: '2026-10-10' },
  'MOD-004': { examinationId: '5322572d-27b0-5467-ab89-c6b45612b960', examinationDate: '2026-10-10' },
  'MOD-005': { examinationId: 'd0c77c9c-a711-5864-97ac-c930ca231773', examinationDate: '2026-10-10' },
  'MOD-006': { examinationId: '63311ad6-4bc2-59b6-a5fd-283423c4a2ac', examinationDate: '2026-10-11' },
  'MOD-007': { examinationId: 'a573f28c-a38a-5978-a6a9-42b1d8239935', examinationDate: '2026-10-11' },
  'MOD-008': { examinationId: '2eec289b-9c0b-57e4-a2c6-e288fa6d4a28', examinationDate: '2026-10-11' },
  'MOD-009': { examinationId: '8305ebe1-ea1e-5089-bf4c-cb5bac29a918', examinationDate: '2026-10-12' },
  'MOD-010': { examinationId: '37eaf7f3-42c8-525c-8c28-cd9c3327da13', examinationDate: '2026-10-13' },
  'MOD-011': { examinationId: '6561efd6-938e-5da0-aae3-520349741cc9', examinationDate: '2026-10-14' },
  // Official MOD-012 maps internally to the live international-programmes examination.
  'MOD-012': { examinationId: '3327bd65-d739-9b41-78f5-1c54da529c35', examinationDate: '2026-10-15' },
  'EL01': { examinationId: '9eb84cf2-bd25-f4ed-084b-413d7a976237', examinationDate: '2026-10-16' },
  'EL02': { examinationId: '98eedf01-59f6-979f-b2b9-2f55a640e6d0', examinationDate: '2026-10-17' },
  'EL03': { examinationId: '76f9ca55-0ecb-ac3b-a823-7e350b857e84', examinationDate: '2026-10-17' },
  'EL04': { examinationId: '00dbbdb2-03a4-52d6-6ff6-6310520d23b2', examinationDate: '2026-10-17' },
  'EL05': { examinationId: '5e3969ef-fbd3-84e9-e853-2f27ed0ce264', examinationDate: '2026-10-18' },
};

function lagosDateString(value = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function cipmnPayloadCodes(row: OutboxRow): string[] {
  const raw = cleanText(row.payload?.moduleCodes || row.payload?.moduleCode, 2000);
  return Array.from(new Set(raw.split(',').map((value) => value.trim()).filter(Boolean)));
}

async function validateCipmnCampaignRow(
  row: OutboxRow,
): Promise<{ valid: boolean; reason: string }> {
  if (!row.event_key.startsWith('cipmn-oct-2026:')) {
    return { valid: true, reason: 'not_cipmn_campaign' };
  }

  const today = lagosDateString();
  const codes = cipmnPayloadCodes(row)
    .filter((code) => CIPMN_OCT_2026_MODULES[code]?.examinationDate >= today);

  if (!codes.length) {
    return { valid: false, reason: 'all_related_examinations_have_passed' };
  }

  const moduleEntries = codes.map((code) => ({
    code,
    ...CIPMN_OCT_2026_MODULES[code],
  }));
  const examinationIds = moduleEntries.map((entry) => entry.examinationId);
  const admin = adminClient();

  const [{ data: orders, error: orderError }, { data: attempts, error: attemptError }, { data: sessions, error: sessionError }] =
    await Promise.all([
      admin
        .from('exam_orders')
        .select('examination_id,status')
        .eq('candidate_id', row.candidate_id)
        .in('examination_id', examinationIds),
      admin
        .from('attempts')
        .select('examination_id,status,submitted_at')
        .eq('candidate_id', row.candidate_id)
        .in('examination_id', examinationIds),
      admin
        .from('exam_sessions')
        .select('examination_id,started_at,submitted_at')
        .eq('candidate_id', row.candidate_id)
        .in('examination_id', examinationIds),
    ]);

  if (orderError) throw new Error(orderError.message);
  if (attemptError) throw new Error(attemptError.message);
  if (sessionError) throw new Error(sessionError.message);

  const entitled = new Set(
    (orders || [])
      .filter((order: any) => ['paid', 'waived'].includes(String(order.status || '').toLowerCase()))
      .map((order: any) => String(order.examination_id)),
  );
  const unresolved = new Set(
    (orders || [])
      .filter((order: any) => ['pending', 'cancelled', 'expired', 'failed'].includes(String(order.status || '').toLowerCase()))
      .map((order: any) => String(order.examination_id)),
  );
  const completed = new Set(
    (attempts || [])
      .filter((attempt: any) =>
        Boolean(attempt.submitted_at) ||
        ['submitted', 'graded', 'completed'].includes(String(attempt.status || '').toLowerCase())
      )
      .map((attempt: any) => String(attempt.examination_id)),
  );
  const started = new Set(
    (sessions || [])
      .filter((session: any) => Boolean(session.started_at))
      .map((session: any) => String(session.examination_id)),
  );

  const stillDue = moduleEntries.some((entry) => {
    const id = entry.examinationId;
    if (row.message_type === 'cipmn_payment_recovery') {
      return unresolved.has(id) && !entitled.has(id);
    }
    if (row.message_type === 'cipmn_unpurchased_modules') {
      return !entitled.has(id);
    }
    if (row.message_type === 'cipmn_mock_start') {
      return entitled.has(id) && !completed.has(id) && !started.has(id);
    }
    if (row.message_type === 'cipmn_mock_resume') {
      return entitled.has(id) && !completed.has(id) && started.has(id);
    }
    if (row.message_type === 'cipmn_exam_preparation') {
      return true;
    }
    return false;
  });

  return {
    valid: stillDue,
    reason: stillDue ? 'still_due' : 'campaign_condition_resolved',
  };
}

async function cancelClaimedCipmnRow(row: OutboxRow, reason: string): Promise<void> {
  const admin = adminClient();
  const now = new Date().toISOString();
  const { error } = await admin
    .from('agilecert_communication_outbox')
    .update({
      status: 'cancelled',
      cancelled_at: now,
      updated_at: now,
      failure_code: 'cipmn_campaign_no_longer_due',
      failure_message: cleanText(reason, 500),
    })
    .eq('id', row.id)
    .eq('status', 'processing');
  if (error) throw new Error(error.message);

  const { error: eventError } = await admin
    .from('agilecert_communication_events')
    .insert({
      outbox_id: row.id,
      candidate_id: row.candidate_id,
      event_type: 'cancelled',
      metadata: {
        campaign: 'cipmn-oct-2026',
        reason,
        messageType: row.message_type,
      },
    });
  if (eventError) throw new Error(eventError.message);
}

async function scanAndSend(): Promise<Record<string, unknown>> {
  const admin = adminClient();
  const { data: settingsData, error: settingsError } = await admin
    .from('agilecert_communication_settings')
    .select('*')
    .eq('singleton', true)
    .single();
  if (settingsError) throw new Error(settingsError.message);
  const settings = settingsData as CommunicationSettings;

  const refreshNow = new Date().toISOString();

  const { data: cipmnRefresh, error: cipmnRefreshError } = await admin.rpc(
    'refresh_cipmn_oct_2026_email_outbox',
    { p_now: refreshNow },
  );
  if (cipmnRefreshError) throw new Error(cipmnRefreshError.message);

  const { data: refresh, error: refreshError } = await admin.rpc(
    'refresh_agilecert_communication_outbox',
    { p_now: refreshNow },
  );
  if (refreshError) throw new Error(refreshError.message);

  if (!settings.provider_enabled) {
    return {
      providerEnabled: false,
      refresh,
    cipmnRefresh,
      claimed: 0,
      sent: 0,
      failed: 0,
      message: 'The outbox was refreshed, but provider delivery remains disabled.',
    };
  }

  const { data: claimedData, error: claimError } = await admin.rpc(
    'claim_agilecert_communication_outbox',
    {
      p_batch_size: settings.hourly_batch_size,
      p_now: new Date().toISOString(),
    },
  );
  if (claimError) throw new Error(claimError.message);
  const claimed = (claimedData || []) as OutboxRow[];
  let sent = 0;
  let failed = 0;

  for (const row of claimed) {
    try {
      if (row.event_key.startsWith('cipmn-oct-2026:')) {
        const validity = await validateCipmnCampaignRow(row);
        if (!validity.valid) {
          await cancelClaimedCipmnRow(row, validity.reason);
          continue;
        }
      }

      const rendered = await renderMessage(row, settings);
      const provider = await sendWithResend(row, settings, rendered);
      const { error } = await admin.rpc('complete_agilecert_communication_delivery', {
        p_outbox_id: row.id,
        p_succeeded: true,
        p_provider: 'resend',
        p_provider_message_id: provider.id,
        p_subject: rendered.subject,
        p_failure_code: null,
        p_failure_message: null,
        p_provider_metadata: provider.payload,
      });
      if (error) throw new Error(error.message);
      sent += 1;
    } catch (error) {
      failed += 1;
      await admin.rpc('complete_agilecert_communication_delivery', {
        p_outbox_id: row.id,
        p_succeeded: false,
        p_provider: 'resend',
        p_provider_message_id: null,
        p_subject: null,
        p_failure_code: 'provider_delivery_failed',
        p_failure_message: error instanceof Error ? error.message : 'Provider delivery failed.',
        p_provider_metadata: {},
      });
    }
  }

  return { providerEnabled: true, refresh, claimed: claimed.length, sent, failed };
}

async function handleWebhook(request: Request): Promise<Response> {
  requireWebhook(request);
  const payload = (await request.json()) as Record<string, any>;
  const rawType = cleanText(payload.type, 120).toLowerCase();
  const typeMap: Record<string, string> = {
    'email.delivered': 'delivered',
    'email.opened': 'opened',
    'email.clicked': 'clicked',
    'email.bounced': 'bounced',
    'email.complained': 'complained',
  };
  const eventType = typeMap[rawType];
  if (!eventType) return json({ accepted: true, ignored: true });

  const data = (payload.data || {}) as Record<string, any>;
  const providerMessageId = cleanText(data.email_id || data.id, 200);
  const recipients = Array.isArray(data.to) ? data.to : [data.to];
  const email = cleanText(recipients[0], 320).toLowerCase();
  const emailHash = email ? await sha256Hex(email) : '';
  const { error } = await adminClient().rpc('record_agilecert_communication_provider_event', {
    p_provider_message_id: providerMessageId || null,
    p_event_type: eventType,
    p_email_hash: emailHash || null,
    p_metadata: {
      providerType: rawType,
      occurredAt: cleanText(payload.created_at || data.created_at, 100) || new Date().toISOString(),
    },
  });
  if (error) throw new Error(error.message);
  return json({ accepted: true });
}

async function handleUnsubscribe(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const verified = await verifyUnsubscribeToken(url.searchParams.get('token') || '');
  if (!verified) {
    return htmlPage(
      'Unsubscribe link unavailable',
      '<p style="line-height:1.7">This unsubscribe link is invalid. Sign in to the AgileCert portal to manage communication preferences.</p>',
      400,
    );
  }

  const admin = adminClient();
  const { data: userData, error: userError } = await admin.auth.admin.getUserById(verified.candidateId);
  if (userError || !userData.user?.email) {
    return htmlPage('Candidate account unavailable', '<p>The communication preference could not be updated.</p>', 404);
  }
  const emailHash = await sha256Hex(userData.user.email.toLowerCase());
  const { error } = await admin.rpc('register_agilecert_communication_unsubscribe', {
    p_candidate_id: verified.candidateId,
    p_email_hash: emailHash,
    p_scope: verified.scope,
    p_source: 'signed_email_link',
  });
  if (error) throw new Error(error.message);

  return htmlPage(
    'Communication preference updated',
    '<p style="line-height:1.7">Your optional AgileCert email preference has been updated. Operational messages required to deliver paid or issued services may continue unless all email was disabled.</p><p><a href="https://iipmnigeria.github.io/IIPM-Examination-Portal/">Return to AgileCert Global</a></p>',
  );
}

Deno.serve(async (request: Request) => {
  const url = new URL(request.url);
  if (request.method === 'GET' && url.searchParams.get('action') === 'unsubscribe') {
    try {
      return await handleUnsubscribe(request);
    } catch (error) {
      console.error('Communications unsubscribe failed:', error);
      return htmlPage('Preference update failed', '<p>The preference could not be updated. Sign in to the portal or contact authorised support.</p>', 500);
    }
  }

  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  try {
    const body = (await request.clone().json().catch(() => ({}))) as Record<string, unknown>;
    const action = cleanText(body.action || url.searchParams.get('action'), 80);

    if (action === 'webhook') return await handleWebhook(request);
    if (action !== 'scan-and-send') return json({ error: 'Unsupported communications action.' }, 400);

    requireWorker(request);
    return json(await scanAndSend());
  } catch (error) {
    console.error('AgileCert communications function failed:', error);
    const message = error instanceof Error ? error.message : 'Communications processing failed.';
    const status = /authorisation failed/i.test(message) ? 401 : 500;
    return json({ error: message }, status);
  }
});

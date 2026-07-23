export type AgileCertEmailContext = {
  jobId: string;
  jobType: string;
  candidateName: string;
  recipientEmail: string;
  examinationTitle?: string | null;
  score?: number | null;
  passMark?: number | null;
  earlyPriceExpiresAt?: string | null;
  currency?: string | null;
  achievementPriceMinor?: number | null;
  professionalPriceMinor?: number | null;
  credentialTitle?: string | null;
  credentialCode?: string | null;
  verificationUrl?: string | null;
  portalUrl: string;
  profileUrl: string;
  recommendedProgrammes?: string[];
};

export type AgileCertRenderedEmail = {
  subject: string;
  html: string;
  text: string;
};

export type AgileCertSentEmail = {
  id: string;
};

function requiredEnvironment(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function money(amountMinor: number | null | undefined, currency: string | null | undefined): string {
  if (!Number.isFinite(Number(amountMinor)) || !currency) return 'See current price';
  return new Intl.NumberFormat(currency === 'NGN' ? 'en-NG' : 'en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'NGN' ? 0 : 2,
  }).format(Number(amountMinor) / 100);
}

function friendlyDeadline(value: string | null | undefined): string {
  if (!value) return 'your offer deadline';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'your offer deadline';
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  });
}

function layout(input: {
  preheader: string;
  heading: string;
  bodyHtml: string;
  actionLabel: string;
  actionUrl: string;
  footerNote?: string;
}): string {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif;color:#0f172a;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(input.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 12px 35px rgba(15,23,42,.08);">
        <tr><td style="background:#071426;padding:24px 30px;color:#ffffff;">
          <div style="font-size:13px;font-weight:800;letter-spacing:2px;color:#6ee7b7;">AGILECERT GLOBAL</div>
          <div style="font-size:12px;margin-top:5px;color:#cbd5e1;">Powered by IIPM</div>
        </td></tr>
        <tr><td style="padding:34px 30px;">
          <h1 style="margin:0 0 18px;font-size:26px;line-height:1.25;color:#0f172a;">${escapeHtml(input.heading)}</h1>
          <div style="font-size:15px;line-height:1.7;color:#334155;">${input.bodyHtml}</div>
          <div style="margin-top:28px;">
            <a href="${escapeHtml(input.actionUrl)}" style="display:inline-block;background:#059669;color:#ffffff;text-decoration:none;padding:13px 21px;border-radius:10px;font-weight:800;font-size:14px;">${escapeHtml(input.actionLabel)}</a>
          </div>
          <p style="margin:26px 0 0;font-size:12px;line-height:1.6;color:#64748b;">${escapeHtml(input.footerNote || 'Sign in to AgileCert Global to review your records and communication settings.')}</p>
        </td></tr>
        <tr><td style="padding:20px 30px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:11px;line-height:1.6;color:#64748b;">
          AgileCert Global provides independently developed specialist competency examinations and credentials. References to external standards or organisations do not imply affiliation, endorsement or authorisation.<br><br>
          Manage certificate and recommendation emails after signing in and opening <strong>My AgileCert → Profile &amp; Settings</strong>.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function offerBody(context: AgileCertEmailContext, message: string): string {
  return `
    <p style="margin:0 0 14px;">Hello <strong>${escapeHtml(context.candidateName)}</strong>,</p>
    <p style="margin:0 0 14px;">${message}</p>
    <div style="margin:20px 0;padding:18px;border-radius:12px;background:#ecfdf5;border:1px solid #a7f3d0;">
      <div style="font-size:13px;color:#047857;font-weight:800;">${escapeHtml(context.examinationTitle || 'Specialist competency examination')}</div>
      ${context.score !== null && context.score !== undefined ? `<div style="margin-top:7px;font-size:24px;font-weight:900;color:#065f46;">Score: ${escapeHtml(context.score)}%</div>` : ''}
      <div style="margin-top:10px;font-size:13px;color:#334155;">Certificate of Achievement: <strong>${escapeHtml(money(context.achievementPriceMinor, context.currency))}</strong></div>
      <div style="margin-top:5px;font-size:13px;color:#334155;">Professional Certificate: <strong>${escapeHtml(money(context.professionalPriceMinor, context.currency))}</strong></div>
    </div>
    <p style="margin:0;">Early pricing remains available until <strong>${escapeHtml(friendlyDeadline(context.earlyPriceExpiresAt))}</strong>.</p>`;
}

export function renderAgileCertAutomationEmail(context: AgileCertEmailContext): AgileCertRenderedEmail {
  const exam = context.examinationTitle || 'your specialist examination';
  const deadline = friendlyDeadline(context.earlyPriceExpiresAt);

  switch (context.jobType) {
    case 'certificate_offer_immediate':
      return {
        subject: `Congratulations — you passed ${exam}`,
        html: layout({
          preheader: 'You are now eligible to obtain an AgileCert Global credential.',
          heading: 'Congratulations on passing your examination',
          bodyHtml: offerBody(
            context,
            `You met the required pass mark in <strong>${escapeHtml(exam)}</strong>. You may now choose the Certificate of Achievement or the higher-assurance Professional Certificate.`,
          ),
          actionLabel: 'View Certificate Options',
          actionUrl: context.portalUrl,
        }),
        text: `Congratulations ${context.candidateName}. You passed ${exam}${context.score != null ? ` with ${context.score}%` : ''}. Certificate of Achievement: ${money(context.achievementPriceMinor, context.currency)}. Professional Certificate: ${money(context.professionalPriceMinor, context.currency)}. Early pricing ends ${deadline}. Open ${context.portalUrl}`,
      };

    case 'certificate_reminder_day_2':
      return {
        subject: `Your AgileCert early certificate price is active`,
        html: layout({
          preheader: 'Secure your verifiable certificate and digital badge while early pricing remains active.',
          heading: 'Turn your passing result into a verifiable credential',
          bodyHtml: offerBody(
            context,
            `Your passing result in <strong>${escapeHtml(exam)}</strong> is ready to become a certificate and digital badge.`,
          ),
          actionLabel: 'Select My Credential',
          actionUrl: context.portalUrl,
        }),
        text: `Your AgileCert certificate offer for ${exam} is active. Early pricing ends ${deadline}. Open ${context.portalUrl}`,
      };

    case 'certificate_reminder_day_5':
      return {
        subject: `Two days left on your AgileCert certificate discount`,
        html: layout({
          preheader: 'Your seven-day early certificate price is nearing its end.',
          heading: 'Your early certificate price ends soon',
          bodyHtml: offerBody(
            context,
            `Only a short time remains to claim the early certificate price for <strong>${escapeHtml(exam)}</strong>.`,
          ),
          actionLabel: 'Use Early Price',
          actionUrl: context.portalUrl,
        }),
        text: `Your early AgileCert certificate price for ${exam} ends ${deadline}. Open ${context.portalUrl}`,
      };

    case 'certificate_reminder_day_7':
      return {
        subject: `Final notice — AgileCert certificate discount ends today`,
        html: layout({
          preheader: 'This is the final reminder before standard certificate pricing applies.',
          heading: 'Final day for your early certificate price',
          bodyHtml: offerBody(
            context,
            `This is the final early-price reminder for your credential in <strong>${escapeHtml(exam)}</strong>. Standard pricing applies after the deadline.`,
          ),
          actionLabel: 'Claim Credential Today',
          actionUrl: context.portalUrl,
        }),
        text: `Final notice: your early AgileCert certificate price for ${exam} ends ${deadline}. Open ${context.portalUrl}`,
      };

    case 'certificate_standard_price_offer':
    case 'certificate_standard_price_reminder':
      return {
        subject: `Your AgileCert credential remains available`,
        html: layout({
          preheader: 'Your passing result remains eligible for certification at the standard price.',
          heading: 'Your certificate eligibility remains active',
          bodyHtml: offerBody(
            context,
            `You can still obtain a verifiable certificate and digital badge for <strong>${escapeHtml(exam)}</strong>. The early-price period has ended, so the current standard price will apply.`,
          ),
          actionLabel: 'View Current Certificate Price',
          actionUrl: context.portalUrl,
        }),
        text: `Your AgileCert credential for ${exam} remains available at the current standard price. Open ${context.portalUrl}`,
      };

    case 'credential_delivery_email':
      return {
        subject: `${context.credentialTitle || 'Your AgileCert credential'} is ready`,
        html: layout({
          preheader: 'Your certificate, badge and verification record are ready.',
          heading: 'Your AgileCert credential has been issued',
          bodyHtml: `
            <p style="margin:0 0 14px;">Hello <strong>${escapeHtml(context.candidateName)}</strong>,</p>
            <p style="margin:0 0 14px;">Your <strong>${escapeHtml(context.credentialTitle || 'AgileCert credential')}</strong> for ${escapeHtml(exam)} has been issued.</p>
            <div style="margin:20px 0;padding:18px;border-radius:12px;background:#eff6ff;border:1px solid #bfdbfe;">
              <div style="font-size:12px;font-weight:800;color:#1d4ed8;">Credential ID</div>
              <div style="margin-top:6px;font-family:monospace;font-size:16px;font-weight:800;color:#1e3a8a;">${escapeHtml(context.credentialCode || '')}</div>
            </div>
            <p style="margin:0;">Open your workspace to download the certificate, access the digital badge, add the credential to LinkedIn and view the public verification record.</p>`,
          actionLabel: 'Open My Credential',
          actionUrl: context.verificationUrl || context.portalUrl,
        }),
        text: `${context.credentialTitle || 'Your AgileCert credential'} is ready. Credential ID: ${context.credentialCode || ''}. Verify at ${context.verificationUrl || context.portalUrl}`,
      };

    case 'course_cross_sell': {
      const recommendations = context.recommendedProgrammes?.length
        ? context.recommendedProgrammes
        : ['Project Planning and Schedule Management', 'Project Risk and Quality Management', 'Agile Project Management'];
      return {
        subject: `Recommended next credentials for your professional growth`,
        html: layout({
          preheader: 'Build on your recent AgileCert achievement with another focused credential.',
          heading: 'Continue building your specialist credential portfolio',
          bodyHtml: `
            <p style="margin:0 0 14px;">Hello <strong>${escapeHtml(context.candidateName)}</strong>,</p>
            <p style="margin:0 0 14px;">Based on your recent achievement, these modular credentials may complement your professional profile:</p>
            <ul style="margin:0;padding-left:22px;line-height:1.9;">${recommendations.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
            <p style="margin:16px 0 0;">For full professional training and certification pathways, explore IIPM programmes separately.</p>`,
          actionLabel: 'Explore Specialist Certifications',
          actionUrl: context.portalUrl,
        }),
        text: `Recommended next AgileCert credentials: ${recommendations.join('; ')}. Explore at ${context.portalUrl}`,
      };
    }

    default:
      throw new Error(`Unsupported AgileCert email job type ${context.jobType}.`);
  }
}

export async function sendAgileCertEmail(
  context: AgileCertEmailContext,
  email: AgileCertRenderedEmail,
): Promise<AgileCertSentEmail> {
  const apiKey = requiredEnvironment('RESEND_API_KEY');
  const from = requiredEnvironment('AGILECERT_EMAIL_FROM');
  const replyTo = Deno.env.get('AGILECERT_EMAIL_REPLY_TO')?.trim() || undefined;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `agilecert-job-${context.jobId}`.slice(0, 256),
    },
    body: JSON.stringify({
      from,
      to: [context.recipientEmail],
      subject: email.subject,
      html: email.html,
      text: email.text,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });

  let payload: Record<string, unknown> = {};
  try {
    payload = (await response.json()) as Record<string, unknown>;
  } catch {
    // The HTTP status below remains authoritative.
  }

  if (!response.ok) {
    throw new Error(String(payload.message || payload.error || `Resend returned ${response.status}.`));
  }

  const id = String(payload.id || '').trim();
  if (!id) throw new Error('Resend did not return an email identifier.');
  return { id };
}

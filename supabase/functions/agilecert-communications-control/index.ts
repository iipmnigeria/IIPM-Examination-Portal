import { adminClient, requiredEnvironment } from '../_shared/supabase.ts';

type JsonRecord = Record<string, unknown>;

function cleanText(value: unknown, maxLength: number): string {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLength);
}

function json(payload: JsonRecord, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

function requireWorker(request: Request): void {
  const configured = requiredEnvironment('AGILECERT_COMMUNICATIONS_WORKER_TOKEN');
  const supplied = request.headers.get('x-agilecert-worker-token')?.trim() || '';
  if (!supplied || !timingSafeEqual(configured, supplied)) {
    throw new Error('Communications worker authorisation failed.');
  }
}

function senderDomain(email: string): string {
  const normalized = email.trim().toLowerCase();
  const separator = normalized.lastIndexOf('@');
  return separator > 0 ? normalized.slice(separator + 1) : '';
}

async function testVerifiedSender(input: {
  fromName: string;
  fromEmail: string;
  replyToEmail: string;
}): Promise<{ providerMessageId: string; verifiedDomain: string }> {
  const apiKey = requiredEnvironment('RESEND_API_KEY');
  const verifiedDomain = senderDomain(input.fromEmail);
  if (!verifiedDomain) throw new Error('A valid verified sender email is required.');

  const dateKey = new Date().toISOString().slice(0, 10);
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `agilecert-provider-activation-${verifiedDomain}-${dateKey}`,
    },
    body: JSON.stringify({
      from: `${cleanText(input.fromName, 120) || 'AgileCert Global'} <${input.fromEmail.trim().toLowerCase()}>`,
      to: ['delivered@resend.dev'],
      reply_to: input.replyToEmail.trim().toLowerCase() || undefined,
      subject: 'AgileCert communications provider activation check',
      text: 'This is a Resend test-mode delivery used to verify the approved AgileCert sender domain. It is not sent to a human recipient.',
      tags: [
        { name: 'message_type', value: 'provider_activation' },
        { name: 'category', value: 'system_validation' },
      ],
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as JsonRecord;
  if (!response.ok) {
    throw new Error(cleanText(payload.message || `Resend HTTP ${response.status}`, 1000));
  }

  const providerMessageId = cleanText(payload.id, 200);
  if (!providerMessageId) throw new Error('Resend did not return a test-message identifier.');
  return { providerMessageId, verifiedDomain };
}

async function readiness(): Promise<JsonRecord> {
  const admin = adminClient();
  const { data, error } = await admin
    .from('agilecert_communication_settings')
    .select('provider_enabled,from_name,from_email,reply_to_email,verified_sender_domain,delivery_cutover_at,initial_provider_activated_at,last_provider_disabled_at,hourly_batch_size,max_attempts')
    .eq('singleton', true)
    .single();
  if (error) throw new Error(error.message);

  return {
    providerEnabled: Boolean(data.provider_enabled),
    fromName: data.from_name,
    fromEmail: data.from_email,
    replyToEmail: data.reply_to_email,
    verifiedSenderDomain: data.verified_sender_domain,
    deliveryCutoverAt: data.delivery_cutover_at,
    initialProviderActivatedAt: data.initial_provider_activated_at,
    lastProviderDisabledAt: data.last_provider_disabled_at,
    hourlyBatchSize: data.hourly_batch_size,
    maxAttempts: data.max_attempts,
    resendApiKeyConfigured: Boolean(Deno.env.get('RESEND_API_KEY')?.trim()),
    workerTokenConfigured: Boolean(Deno.env.get('AGILECERT_COMMUNICATIONS_WORKER_TOKEN')?.trim()),
    webhookSecretConfigured: Boolean(Deno.env.get('RESEND_WEBHOOK_SECRET')?.trim()),
    unsubscribeSigningSecretConfigured: Boolean(Deno.env.get('AGILECERT_COMMUNICATIONS_SIGNING_SECRET')?.trim()),
  };
}

async function configureProvider(body: JsonRecord): Promise<JsonRecord> {
  const fromName = cleanText(body.fromName, 120) || 'AgileCert Global';
  const fromEmail = cleanText(body.fromEmail, 320).toLowerCase();
  const replyToEmail = cleanText(body.replyToEmail, 320).toLowerCase();
  const enable = body.enable === true;
  const resetCutover = body.resetCutover === true;
  const hourlyBatchSize = Math.max(1, Math.min(Number(body.hourlyBatchSize || 40), 100));
  const maxAttempts = Math.max(1, Math.min(Number(body.maxAttempts || 5), 12));
  const activationNotes = cleanText(body.activationNotes, 500);

  const test = await testVerifiedSender({ fromName, fromEmail, replyToEmail });
  const { data, error } = await adminClient().rpc(
    'configure_agilecert_communication_provider_activation',
    {
      p_provider_enabled: enable,
      p_from_name: fromName,
      p_from_email: fromEmail,
      p_reply_to_email: replyToEmail || null,
      p_hourly_batch_size: hourlyBatchSize,
      p_max_attempts: maxAttempts,
      p_verified_sender_domain: test.verifiedDomain,
      p_reset_cutover: resetCutover,
      p_activation_notes: activationNotes || 'Controlled provider activation workflow',
    },
  );
  if (error) throw new Error(error.message);

  return {
    configured: true,
    providerTestPassed: true,
    providerTestMessageId: test.providerMessageId,
    verifiedSenderDomain: test.verifiedDomain,
    providerEnabled: enable,
    activation: data,
  };
}

async function disableProvider(body: JsonRecord): Promise<JsonRecord> {
  const admin = adminClient();
  const { data: settings, error: settingsError } = await admin
    .from('agilecert_communication_settings')
    .select('from_name,from_email,reply_to_email,verified_sender_domain,hourly_batch_size,max_attempts')
    .eq('singleton', true)
    .single();
  if (settingsError) throw new Error(settingsError.message);

  const { data, error } = await admin.rpc(
    'configure_agilecert_communication_provider_activation',
    {
      p_provider_enabled: false,
      p_from_name: settings.from_name,
      p_from_email: settings.from_email,
      p_reply_to_email: settings.reply_to_email,
      p_hourly_batch_size: settings.hourly_batch_size,
      p_max_attempts: settings.max_attempts,
      p_verified_sender_domain: settings.verified_sender_domain,
      p_reset_cutover: false,
      p_activation_notes: cleanText(body.reason, 500) || 'Emergency provider disable workflow',
    },
  );
  if (error) throw new Error(error.message);
  return { disabled: true, providerEnabled: false, activation: data };
}

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  try {
    requireWorker(request);
    const body = (await request.json().catch(() => ({}))) as JsonRecord;
    const action = cleanText(body.action, 80);

    if (action === 'activation-readiness') return json(await readiness());
    if (action === 'configure-provider') return json(await configureProvider(body));
    if (action === 'disable-provider') return json(await disableProvider(body));
    return json({ error: 'Unsupported communications control action.' }, 400);
  } catch (error) {
    console.error('AgileCert communications control failed:', error);
    const message = error instanceof Error ? error.message : 'Communications control failed.';
    const status = /authorisation failed/i.test(message) ? 401 : 500;
    return json({ error: message }, status);
  }
});

import { Webhook } from 'npm:svix@1';
import { adminClient, requiredEnvironment } from '../_shared/supabase.ts';

type JsonRecord = Record<string, unknown>;

const encoder = new TextEncoder();

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

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function requiredHeader(request: Request, name: string): string {
  const value = request.headers.get(name)?.trim();
  if (!value) throw new Error(`Missing ${name} webhook header.`);
  return value;
}

async function verifiedPayload(request: Request): Promise<Record<string, any>> {
  const rawPayload = await request.text();
  const webhook = new Webhook(requiredEnvironment('RESEND_WEBHOOK_SECRET'));

  try {
    return webhook.verify(rawPayload, {
      'svix-id': requiredHeader(request, 'svix-id'),
      'svix-timestamp': requiredHeader(request, 'svix-timestamp'),
      'svix-signature': requiredHeader(request, 'svix-signature'),
    }) as Record<string, any>;
  } catch {
    throw new Error('Invalid Resend webhook signature.');
  }
}

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  try {
    const payload = await verifiedPayload(request);
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
        svixId: cleanText(request.headers.get('svix-id'), 200),
        occurredAt: cleanText(payload.created_at || data.created_at, 100) || new Date().toISOString(),
      },
    });
    if (error) throw new Error(error.message);

    return json({ accepted: true });
  } catch (error) {
    console.error('AgileCert Resend webhook failed:', error);
    const message = error instanceof Error ? error.message : 'Webhook processing failed.';
    const status = /signature|header/i.test(message) ? 401 : 500;
    return json({ error: message }, status);
  }
});

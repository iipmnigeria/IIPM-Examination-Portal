import { Webhook } from 'npm:svix@1.76.1';
import { jsonResponse, preflightResponse } from '../_shared/http.ts';
import { adminClient } from '../_shared/supabase.ts';

type ResendWebhookEvent = {
  type?: string;
  created_at?: string;
  data?: {
    email_id?: string;
    to?: string[];
    subject?: string;
    [key: string]: unknown;
  };
};

function requiredHeader(request: Request, name: string): string {
  const value = request.headers.get(name)?.trim();
  if (!value) throw new Error(`Missing ${name} webhook header.`);
  return value;
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return preflightResponse(request);
  if (request.method !== 'POST') {
    return jsonResponse(request, { error: 'Method not allowed.' }, 405);
  }

  try {
    const signingSecret = Deno.env.get('RESEND_WEBHOOK_SECRET')?.trim();
    if (!signingSecret) throw new Error('RESEND_WEBHOOK_SECRET is not configured.');

    const rawBody = await request.text();
    const eventId = requiredHeader(request, 'svix-id');
    const eventTimestamp = requiredHeader(request, 'svix-timestamp');
    const eventSignature = requiredHeader(request, 'svix-signature');

    const verifier = new Webhook(signingSecret);
    const event = verifier.verify(rawBody, {
      'svix-id': eventId,
      'svix-timestamp': eventTimestamp,
      'svix-signature': eventSignature,
    }) as ResendWebhookEvent;

    const eventType = String(event.type || '').trim().toLowerCase();
    const providerMessageId = String(event.data?.email_id || '').trim();
    const recipientEmail = String(event.data?.to?.[0] || '').trim().toLowerCase();
    const occurredAt = event.created_at ? new Date(event.created_at).toISOString() : new Date().toISOString();

    if (!eventType) {
      return jsonResponse(request, { received: true, ignored: true, reason: 'missing_event_type' });
    }

    const supportedEvents = new Set([
      'email.sent',
      'email.delivered',
      'email.delivery_delayed',
      'email.bounced',
      'email.failed',
      'email.suppressed',
      'email.complained',
      'email.opened',
      'email.clicked',
    ]);

    if (!supportedEvents.has(eventType)) {
      return jsonResponse(request, {
        received: true,
        ignored: true,
        eventType,
        reason: 'unsupported_event_type',
      });
    }

    const admin = adminClient();
    const { data, error } = await admin.rpc('record_agilecert_email_event', {
      p_provider: 'resend',
      p_provider_event_id: eventId,
      p_provider_message_id: providerMessageId || null,
      p_event_type: eventType,
      p_recipient_email: recipientEmail || null,
      p_occurred_at: occurredAt,
      p_payload: event,
    });

    if (error) throw new Error(error.message);

    return jsonResponse(request, {
      received: true,
      recorded: true,
      eventType,
      providerMessageId: providerMessageId || null,
      eventRecordId: (data as Record<string, unknown> | null)?.id || null,
    });
  } catch (error) {
    console.error('resend-email-webhook failed:', error);
    const message = error instanceof Error ? error.message : 'Resend webhook processing failed.';
    return jsonResponse(request, { error: message }, 400);
  }
});

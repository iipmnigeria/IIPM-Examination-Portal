import { jsonResponse, preflightResponse } from '../_shared/http.ts';
import {
  paystackRequestedAmount,
  verifyPaystackTransaction,
  verifyPaystackWebhookSignature,
} from '../_shared/paystack.ts';
import { adminClient } from '../_shared/supabase.ts';

type PaystackWebhookEvent = {
  event?: string;
  data?: {
    id?: number | string;
    status?: string;
    reference?: string;
    amount?: number;
    requested_amount?: number;
    currency?: string;
    customer?: { email?: string };
    [key: string]: unknown;
  };
};

type ExamOrder = {
  id: string;
  reference: string;
  candidate_id: string;
  examination_id: string;
  currency: string;
  payable_amount_minor: number;
  status: string;
  fulfilled_at: string | null;
};

const legacyWebhookUrl = (
  Deno.env.get('LEGACY_PAYSTACK_WEBHOOK_URL') ||
  'https://iipmi.org/wc-api/Tbz_WC_Paystack_Webhook/'
).trim();

async function forwardToLegacyWebhook(rawBody: string, signature: string) {
  if (!legacyWebhookUrl) {
    throw new Error('The legacy Paystack webhook URL is not configured.');
  }

  const response = await fetch(legacyWebhookUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-paystack-signature': signature,
      'x-iipm-webhook-router': 'supabase-examination-portal',
    },
    body: rawBody,
  });

  if (!response.ok) {
    const responseText = await response.text().catch(() => '');
    throw new Error(
      `Legacy Paystack webhook returned ${response.status}${responseText ? `: ${responseText.slice(0, 300)}` : ''}.`,
    );
  }

  return {
    received: true,
    forwarded: true,
    destination: 'legacy_woocommerce',
    status: response.status,
  };
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return preflightResponse(request);
  if (request.method !== 'POST') {
    return jsonResponse(request, { error: 'Method not allowed.' }, 405);
  }

  try {
    const rawBody = await request.text();
    const suppliedSignature = request.headers.get('x-paystack-signature') || '';
    const signatureValid = await verifyPaystackWebhookSignature(rawBody, suppliedSignature);

    if (!signatureValid) {
      console.warn('Rejected Paystack webhook with an invalid signature.');
      return jsonResponse(request, { error: 'Invalid Paystack signature.' }, 401);
    }

    let event: PaystackWebhookEvent;
    try {
      event = JSON.parse(rawBody) as PaystackWebhookEvent;
    } catch {
      return jsonResponse(request, { error: 'Invalid webhook JSON.' }, 400);
    }

    if (event.event !== 'charge.success') {
      const forwarded = await forwardToLegacyWebhook(rawBody, suppliedSignature);
      return jsonResponse(request, forwarded);
    }

    const reference = String(event.data?.reference || '').trim();
    if (!reference) {
      const forwarded = await forwardToLegacyWebhook(rawBody, suppliedSignature);
      return jsonResponse(request, {
        ...forwarded,
        reason: 'missing_examination_reference',
      });
    }

    const admin = adminClient();
    const { data: orderData, error: orderError } = await admin
      .from('exam_orders')
      .select('id, reference, candidate_id, examination_id, currency, payable_amount_minor, status, fulfilled_at')
      .eq('reference', reference)
      .maybeSingle();

    if (orderError) throw new Error(orderError.message);
    if (!orderData) {
      console.info(`Routing non-examination Paystack reference ${reference} to WooCommerce.`);
      const forwarded = await forwardToLegacyWebhook(rawBody, suppliedSignature);
      return jsonResponse(request, {
        ...forwarded,
        reference,
      });
    }

    const order = orderData as ExamOrder;

    if (['paid', 'waived'].includes(order.status) && order.fulfilled_at) {
      return jsonResponse(request, {
        received: true,
        alreadyFulfilled: true,
        orderId: order.id,
      });
    }

    if (order.status !== 'pending') {
      return jsonResponse(request, {
        received: true,
        ignored: true,
        reason: `order_status_${order.status}`,
      });
    }

    const transaction = await verifyPaystackTransaction(reference);
    const transactionReference = String(transaction.reference || '');
    const transactionCurrency = String(transaction.currency || '').toUpperCase();
    const requestedAmount = paystackRequestedAmount(transaction);
    const transactionStatus = String(transaction.status || '').toLowerCase();
    const transactionEmail = String(transaction.customer?.email || '').toLowerCase();

    if (transactionStatus !== 'success') {
      throw new Error(`Paystack verification returned status ${transactionStatus || 'unknown'}.`);
    }
    if (transactionReference !== order.reference) {
      throw new Error('Webhook transaction reference does not match the order.');
    }
    if (transactionCurrency !== order.currency.toUpperCase()) {
      throw new Error('Webhook transaction currency does not match the order.');
    }
    if (requestedAmount !== Number(order.payable_amount_minor)) {
      throw new Error('Webhook transaction amount does not match the order.');
    }

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('email')
      .eq('id', order.candidate_id)
      .single();

    if (profileError) throw new Error(profileError.message);
    const candidateEmail = String(profile.email || '').toLowerCase();
    if (transactionEmail && candidateEmail && transactionEmail !== candidateEmail) {
      throw new Error('Webhook transaction email does not match the order candidate.');
    }

    const { data: fulfilment, error: fulfilmentError } = await admin.rpc(
      'fulfil_paid_exam_order',
      {
        p_order_id: order.id,
        p_provider_transaction_id: String(transaction.id || event.data?.id || ''),
        p_provider_payload: transaction,
      },
    );

    if (fulfilmentError) throw new Error(fulfilmentError.message);

    return jsonResponse(request, {
      received: true,
      fulfilled: true,
      orderId: order.id,
      examinationId: order.examination_id,
      result: fulfilment,
    });
  } catch (error) {
    console.error('paystack-webhook failed:', error);
    const message = error instanceof Error ? error.message : 'Webhook processing failed.';
    return jsonResponse(request, { error: message }, 502);
  }
});

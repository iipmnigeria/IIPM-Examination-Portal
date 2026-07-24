import { jsonResponse, preflightResponse } from '../_shared/http.ts';
import {
  agileCertCertificateRequestedAmount,
  verifyAgileCertCertificateTransaction,
  verifyAgileCertCertificateWebhookSignature,
} from '../_shared/agilecertCertificatePaystack.ts';
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

type CertificateOrder = {
  id: string;
  reference: string;
  candidate_id: string;
  eligibility_id: string;
  product_code: string;
  currency: string;
  payable_amount_minor: number;
  status: string;
  fulfilled_at: string | null;
};

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return preflightResponse(request);
  if (request.method !== 'POST') {
    return jsonResponse(request, { error: 'Method not allowed.' }, 405);
  }

  try {
    const rawBody = await request.text();
    const suppliedSignature = request.headers.get('x-paystack-signature') || '';
    const signatureValid = await verifyAgileCertCertificateWebhookSignature(
      rawBody,
      suppliedSignature,
    );

    if (!signatureValid) {
      console.warn('Rejected AgileCert certificate webhook with an invalid signature.');
      return jsonResponse(request, { error: 'Invalid Paystack signature.' }, 401);
    }

    let event: PaystackWebhookEvent;
    try {
      event = JSON.parse(rawBody) as PaystackWebhookEvent;
    } catch {
      return jsonResponse(request, { error: 'Invalid webhook JSON.' }, 400);
    }

    if (event.event !== 'charge.success') {
      return jsonResponse(request, {
        received: true,
        ignored: true,
        reason: `unsupported_event_${event.event || 'unknown'}`,
      });
    }

    const reference = String(event.data?.reference || '').trim();
    if (!reference) {
      return jsonResponse(request, {
        received: true,
        ignored: true,
        reason: 'missing_certificate_reference',
      });
    }

    const admin = adminClient();
    const { data: orderData, error: orderError } = await admin
      .from('agilecert_certificate_orders')
      .select('id, reference, candidate_id, eligibility_id, product_code, currency, payable_amount_minor, status, fulfilled_at')
      .eq('reference', reference)
      .maybeSingle();

    if (orderError) throw new Error(orderError.message);
    if (!orderData) {
      return jsonResponse(request, {
        received: true,
        ignored: true,
        reason: 'unknown_certificate_reference',
        reference,
      });
    }

    const order = orderData as CertificateOrder;

    if (['paid', 'waived'].includes(order.status) && order.fulfilled_at) {
      return jsonResponse(request, {
        received: true,
        alreadyFulfilled: true,
        orderId: order.id,
      });
    }

    if (!['pending', 'initialized'].includes(order.status)) {
      return jsonResponse(request, {
        received: true,
        ignored: true,
        reason: `certificate_order_status_${order.status}`,
        orderId: order.id,
      });
    }

    const transaction = await verifyAgileCertCertificateTransaction(reference);
    const transactionReference = String(transaction.reference || '');
    const transactionCurrency = String(transaction.currency || '').toUpperCase();
    const requestedAmount = agileCertCertificateRequestedAmount(transaction);
    const transactionStatus = String(transaction.status || '').toLowerCase();
    const transactionEmail = String(transaction.customer?.email || '').toLowerCase();

    if (transactionStatus !== 'success') {
      throw new Error(`Paystack verification returned status ${transactionStatus || 'unknown'}.`);
    }
    if (transactionReference !== order.reference) {
      throw new Error('Webhook certificate transaction reference does not match the order.');
    }
    if (transactionCurrency !== order.currency.toUpperCase()) {
      throw new Error('Webhook certificate transaction currency does not match the order.');
    }
    if (requestedAmount !== Number(order.payable_amount_minor)) {
      throw new Error('Webhook certificate transaction amount does not match the order.');
    }

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('email')
      .eq('id', order.candidate_id)
      .single();

    if (profileError) throw new Error(profileError.message);
    const candidateEmail = String(profile.email || '').toLowerCase();
    if (transactionEmail && candidateEmail && transactionEmail !== candidateEmail) {
      throw new Error('Webhook certificate transaction email does not match the candidate.');
    }

    const { data: fulfilment, error: fulfilmentError } = await admin.rpc(
      'fulfil_paid_agilecert_certificate_order',
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
      eligibilityId: order.eligibility_id,
      productCode: order.product_code,
      result: fulfilment,
    });
  } catch (error) {
    console.error('paystack-certificate-webhook failed:', error);
    const message = error instanceof Error ? error.message : 'Certificate webhook processing failed.';
    return jsonResponse(request, { error: message }, 502);
  }
});

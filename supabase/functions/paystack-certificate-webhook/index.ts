import { jsonResponse, preflightResponse } from '../_shared/http.ts';
import {
  agileCertPaystackRequestedAmount,
  verifyAgileCertPaystackTransaction,
  verifyAgileCertPaystackWebhookSignature,
} from '../_shared/agilecertPaystack.ts';
import { generateAgileCertCredentialAssets } from '../_shared/credentialAssets.ts';
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
};

async function generateAssetsBestEffort(admin: ReturnType<typeof adminClient>, credentialId: string | null) {
  if (!credentialId) {
    return { assetsReady: false, assetsPending: true, assetError: 'credential_id_missing' };
  }

  try {
    const assets = await generateAgileCertCredentialAssets(admin, credentialId);
    return { assetsReady: true, assetsPending: false, assets };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Credential assets are pending.';
    console.error('Credential was issued but webhook asset generation is pending:', error);
    return { assetsReady: false, assetsPending: true, assetError: message };
  }
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return preflightResponse(request);
  if (request.method !== 'POST') {
    return jsonResponse(request, { error: 'Method not allowed.' }, 405);
  }

  try {
    const rawBody = await request.text();
    const suppliedSignature = request.headers.get('x-paystack-signature') || '';
    const signatureValid = await verifyAgileCertPaystackWebhookSignature(rawBody, suppliedSignature);

    if (!signatureValid) {
      console.warn('Rejected AgileCert Paystack webhook with an invalid signature.');
      return jsonResponse(request, { error: 'Invalid AgileCert Paystack signature.' }, 401);
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
      .select('id, reference, candidate_id, eligibility_id, product_code, currency, payable_amount_minor, status')
      .eq('reference', reference)
      .maybeSingle();

    if (orderError) throw new Error(orderError.message);
    if (!orderData) {
      return jsonResponse(request, {
        received: true,
        ignored: true,
        reason: 'unknown_agilecert_certificate_reference',
        reference,
      });
    }

    const order = orderData as CertificateOrder;

    if (['paid', 'waived'].includes(order.status)) {
      const { data: existingCredential, error: credentialError } = await admin
        .from('agilecert_credentials')
        .select('id, credential_code, verification_slug')
        .eq('certificate_order_id', order.id)
        .maybeSingle();

      if (credentialError) throw new Error(credentialError.message);
      const assetResult = await generateAssetsBestEffort(admin, existingCredential?.id || null);

      return jsonResponse(request, {
        received: true,
        alreadyFulfilled: Boolean(existingCredential),
        orderId: order.id,
        credentialId: existingCredential?.id || null,
        credentialCode: existingCredential?.credential_code || null,
        verificationSlug: existingCredential?.verification_slug || null,
        ...assetResult,
      });
    }

    if (!['pending', 'initialized'].includes(order.status)) {
      return jsonResponse(request, {
        received: true,
        ignored: true,
        reason: `certificate_order_status_${order.status}`,
      });
    }

    const transaction = await verifyAgileCertPaystackTransaction(reference);
    const transactionReference = String(transaction.reference || '');
    const transactionCurrency = String(transaction.currency || '').toUpperCase();
    const requestedAmount = agileCertPaystackRequestedAmount(transaction);
    const transactionStatus = String(transaction.status || '').toLowerCase();
    const transactionEmail = String(transaction.customer?.email || '').toLowerCase();

    if (transactionStatus !== 'success') {
      throw new Error(`AgileCert Paystack verification returned status ${transactionStatus || 'unknown'}.`);
    }
    if (transactionReference !== order.reference) {
      throw new Error('Webhook transaction reference does not match the certificate order.');
    }
    if (transactionCurrency !== order.currency.toUpperCase()) {
      throw new Error('Webhook transaction currency does not match the certificate order.');
    }
    if (requestedAmount !== Number(order.payable_amount_minor)) {
      throw new Error('Webhook transaction amount does not match the certificate order.');
    }

    const { data: candidateResult, error: candidateError } = await admin.auth.admin.getUserById(
      order.candidate_id,
    );
    if (candidateError) throw new Error(candidateError.message);

    const candidateEmail = String(candidateResult.user?.email || '').toLowerCase();
    if (transactionEmail && candidateEmail && transactionEmail !== candidateEmail) {
      throw new Error('Webhook transaction email does not match the certificate-order candidate.');
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

    const fulfilmentPayload = (fulfilment || {}) as Record<string, unknown>;
    const credentialId = typeof fulfilmentPayload.credentialId === 'string'
      ? fulfilmentPayload.credentialId
      : null;
    const assetResult = await generateAssetsBestEffort(admin, credentialId);

    return jsonResponse(request, {
      received: true,
      fulfilled: true,
      orderId: order.id,
      eligibilityId: order.eligibility_id,
      productCode: order.product_code,
      result: fulfilmentPayload,
      ...assetResult,
    });
  } catch (error) {
    console.error('paystack-certificate-webhook failed:', error);
    const message = error instanceof Error ? error.message : 'AgileCert certificate webhook processing failed.';
    return jsonResponse(request, { error: message }, 502);
  }
});

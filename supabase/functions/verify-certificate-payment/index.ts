import { jsonResponse, preflightResponse } from '../_shared/http.ts';
import {
  agileCertPaystackRequestedAmount,
  verifyAgileCertPaystackTransaction,
} from '../_shared/agilecertPaystack.ts';
import { generateAgileCertCredentialAssets } from '../_shared/credentialAssets.ts';
import { adminClient, requireAuthenticatedUser } from '../_shared/supabase.ts';

type VerifyCertificateRequest = {
  reference?: string;
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
    console.error('Credential was issued but asset generation is pending:', error);
    return { assetsReady: false, assetsPending: true, assetError: message };
  }
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return preflightResponse(request);
  if (request.method !== 'POST') {
    return jsonResponse(request, { error: 'Method not allowed.' }, 405);
  }

  try {
    const user = await requireAuthenticatedUser(request);
    const body = (await request.json()) as VerifyCertificateRequest;
    const reference = body.reference?.trim();

    if (!reference) {
      return jsonResponse(request, { error: 'A certificate transaction reference is required.' }, 400);
    }

    const admin = adminClient();
    const { data: orderData, error: orderError } = await admin
      .from('agilecert_certificate_orders')
      .select('id, reference, candidate_id, eligibility_id, product_code, currency, payable_amount_minor, status')
      .eq('reference', reference)
      .single();

    if (orderError) throw new Error(orderError.message);
    const order = orderData as CertificateOrder;

    if (order.candidate_id !== user.id) {
      return jsonResponse(request, { error: 'This certificate transaction does not belong to the signed-in candidate.' }, 403);
    }

    if (['paid', 'waived'].includes(order.status)) {
      const { data: credential, error: credentialError } = await admin
        .from('agilecert_credentials')
        .select('id, credential_code, verification_slug, status')
        .eq('certificate_order_id', order.id)
        .maybeSingle();

      if (credentialError) throw new Error(credentialError.message);
      const assetResult = await generateAssetsBestEffort(admin, credential?.id || null);

      return jsonResponse(request, {
        orderId: order.id,
        reference: order.reference,
        eligibilityId: order.eligibility_id,
        productCode: order.product_code,
        status: order.status,
        credentialId: credential?.id || null,
        credentialCode: credential?.credential_code || null,
        verificationSlug: credential?.verification_slug || null,
        verified: true,
        alreadyFulfilled: Boolean(credential),
        ...assetResult,
      });
    }

    if (!['pending', 'initialized'].includes(order.status)) {
      throw new Error(`This certificate payment cannot be verified from status ${order.status}.`);
    }

    const transaction = await verifyAgileCertPaystackTransaction(reference);
    const transactionReference = String(transaction.reference || '');
    const transactionCurrency = String(transaction.currency || '').toUpperCase();
    const requestedAmount = agileCertPaystackRequestedAmount(transaction);
    const transactionStatus = String(transaction.status || '').toLowerCase();
    const transactionEmail = String(transaction.customer?.email || '').toLowerCase();

    if (transactionStatus !== 'success') {
      throw new Error(`AgileCert Paystack reports transaction status ${transactionStatus || 'unknown'}.`);
    }
    if (transactionReference !== order.reference) {
      throw new Error('The AgileCert Paystack transaction reference does not match the certificate order.');
    }
    if (transactionCurrency !== order.currency.toUpperCase()) {
      throw new Error('The AgileCert Paystack transaction currency does not match the certificate order.');
    }
    if (requestedAmount !== Number(order.payable_amount_minor)) {
      throw new Error('The AgileCert Paystack transaction amount does not match the certificate order.');
    }
    if (transactionEmail && user.email && transactionEmail !== user.email.toLowerCase()) {
      throw new Error('The AgileCert Paystack customer email does not match the signed-in candidate.');
    }

    const { data: fulfilment, error: fulfilmentError } = await admin.rpc(
      'fulfil_paid_agilecert_certificate_order',
      {
        p_order_id: order.id,
        p_provider_transaction_id: String(transaction.id || ''),
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
      ...fulfilmentPayload,
      reference: order.reference,
      eligibilityId: order.eligibility_id,
      productCode: order.product_code,
      verified: true,
      ...assetResult,
    });
  } catch (error) {
    console.error('verify-certificate-payment failed:', error);
    const message = error instanceof Error ? error.message : 'Certificate payment verification failed.';
    return jsonResponse(request, { error: message }, 400);
  }
});

import { jsonResponse, preflightResponse } from '../_shared/http.ts';
import { agileCertPaystackRequest } from '../_shared/agilecertPaystack.ts';
import {
  adminClient,
  requireAuthenticatedUser,
  userClient,
} from '../_shared/supabase.ts';

type InitializeCertificateRequest = {
  eligibilityId?: string;
  productCode?: 'achievement' | 'professional';
  currency?: 'NGN' | 'USD';
};

type CertificateOrder = {
  id: string;
  reference: string;
  candidate_id: string;
  eligibility_id: string;
  product_code: string;
  currency: string;
  pricing_window: string;
  list_amount_minor: number;
  discount_amount_minor: number;
  payable_amount_minor: number;
  status: string;
  expires_at: string | null;
  gateway_authorization_url: string | null;
  gateway_access_code: string | null;
};

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return preflightResponse(request);
  if (request.method !== 'POST') {
    return jsonResponse(request, { error: 'Method not allowed.' }, 405);
  }

  try {
    const user = await requireAuthenticatedUser(request);
    const body = (await request.json()) as InitializeCertificateRequest;
    const eligibilityId = body.eligibilityId?.trim();
    const productCode = body.productCode?.trim().toLowerCase();
    const currency = body.currency?.trim().toUpperCase();

    if (!eligibilityId) {
      return jsonResponse(request, { error: 'A certificate eligibility identifier is required.' }, 400);
    }
    if (!['achievement', 'professional'].includes(productCode || '')) {
      return jsonResponse(request, { error: 'A valid certificate option is required.' }, 400);
    }
    if (currency && !['NGN', 'USD'].includes(currency)) {
      return jsonResponse(request, { error: 'Certificate payment currency must be NGN or USD.' }, 400);
    }

    const candidateClient = userClient(request);
    const { data: orderResult, error: orderRpcError } = await candidateClient.rpc(
      'create_agilecert_certificate_order',
      {
        p_eligibility_id: eligibilityId,
        p_product_code: productCode,
        p_currency: currency || null,
      },
    );

    if (orderRpcError) throw new Error(orderRpcError.message);
    if (!orderResult || typeof orderResult !== 'object') {
      throw new Error('The certificate payment order was not returned.');
    }

    const orderSummary = orderResult as Record<string, unknown>;
    if (
      orderSummary.paymentRequired === false ||
      ['already_issued', 'paid', 'waived'].includes(String(orderSummary.status || ''))
    ) {
      return jsonResponse(request, {
        ...orderSummary,
        paymentRequired: false,
        authorizationUrl: null,
      });
    }

    const orderId = String(orderSummary.orderId || '');
    if (!orderId) throw new Error('The certificate order identifier is missing.');

    const admin = adminClient();
    const { data: orderData, error: orderFetchError } = await admin
      .from('agilecert_certificate_orders')
      .select(
        'id, reference, candidate_id, eligibility_id, product_code, currency, pricing_window, list_amount_minor, discount_amount_minor, payable_amount_minor, status, expires_at, gateway_authorization_url, gateway_access_code',
      )
      .eq('id', orderId)
      .single();

    if (orderFetchError) throw new Error(orderFetchError.message);
    const order = orderData as CertificateOrder;

    if (order.candidate_id !== user.id) {
      return jsonResponse(request, { error: 'This certificate order does not belong to the signed-in candidate.' }, 403);
    }
    if (!['pending', 'initialized'].includes(order.status)) {
      throw new Error(`This certificate order cannot be paid from status ${order.status}.`);
    }
    if (order.expires_at && new Date(order.expires_at).getTime() <= Date.now()) {
      throw new Error('This certificate payment order has expired. Create a new order.');
    }
    if (!Number.isSafeInteger(Number(order.payable_amount_minor)) || order.payable_amount_minor <= 0) {
      throw new Error('The certificate payable amount is invalid.');
    }

    if (order.gateway_authorization_url && order.gateway_access_code) {
      return jsonResponse(request, {
        orderId: order.id,
        reference: order.reference,
        eligibilityId: order.eligibility_id,
        productCode: order.product_code,
        currency: order.currency,
        pricingWindow: order.pricing_window,
        listAmountMinor: order.list_amount_minor,
        discountAmountMinor: order.discount_amount_minor,
        payableAmountMinor: order.payable_amount_minor,
        status: order.status,
        authorizationUrl: order.gateway_authorization_url,
        accessCode: order.gateway_access_code,
        paymentRequired: true,
        expiresAt: order.expires_at,
      });
    }

    const portalUrl = (
      Deno.env.get('AGILECERT_PORTAL_URL') ||
      Deno.env.get('IIPM_PORTAL_URL') ||
      'https://iipmnigeria.github.io/IIPM-Examination-Portal/'
    ).trim();

    const productLabel = order.product_code === 'professional'
      ? 'Professional Certificate'
      : 'Certificate of Achievement';

    const paystackPayload = await agileCertPaystackRequest('/transaction/initialize', {
      method: 'POST',
      body: JSON.stringify({
        email: user.email,
        amount: String(order.payable_amount_minor),
        currency: order.currency,
        reference: order.reference,
        callback_url: `${portalUrl.replace(/\/$/, '')}/?certificate_payment=callback`,
        metadata: JSON.stringify({
          commerceType: 'agilecert_certificate',
          orderId: order.id,
          candidateId: order.candidate_id,
          eligibilityId: order.eligibility_id,
          productCode: order.product_code,
          productLabel,
          pricingWindow: order.pricing_window,
          platform: 'AgileCert Global by IIPM',
        }),
      }),
    });

    const authorizationUrl = String(paystackPayload.data?.authorization_url || '');
    const accessCode = String(paystackPayload.data?.access_code || '');

    if (!authorizationUrl || !accessCode) {
      throw new Error('AgileCert Paystack did not return a checkout URL.');
    }

    const { error: updateError } = await admin
      .from('agilecert_certificate_orders')
      .update({
        status: 'initialized',
        gateway_authorization_url: authorizationUrl,
        gateway_access_code: accessCode,
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id)
      .in('status', ['pending', 'initialized']);

    if (updateError) throw new Error(updateError.message);

    return jsonResponse(request, {
      orderId: order.id,
      reference: order.reference,
      eligibilityId: order.eligibility_id,
      productCode: order.product_code,
      productLabel,
      currency: order.currency,
      pricingWindow: order.pricing_window,
      listAmountMinor: order.list_amount_minor,
      discountAmountMinor: order.discount_amount_minor,
      payableAmountMinor: order.payable_amount_minor,
      status: 'initialized',
      authorizationUrl,
      accessCode,
      paymentRequired: true,
      expiresAt: order.expires_at,
    });
  } catch (error) {
    console.error('initialize-certificate-payment failed:', error);
    const message = error instanceof Error ? error.message : 'Certificate payment initialization failed.';
    return jsonResponse(request, { error: message }, 400);
  }
});

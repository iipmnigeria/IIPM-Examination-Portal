import { jsonResponse, preflightResponse } from '../_shared/http.ts';
import { paystackRequest } from '../_shared/paystack.ts';
import {
  adminClient,
  requireAuthenticatedUser,
  userClient,
} from '../_shared/supabase.ts';

type InitializeRequest = {
  currency?: string;
  couponCode?: string;
  checkoutSource?: string;
};

type BulkOrder = {
  id: string;
  reference: string;
  candidate_id: string;
  currency: string;
  item_count: number;
  list_amount_minor: number;
  discount_amount_minor: number;
  payable_amount_minor: number;
  status: string;
  expires_at: string;
  gateway_authorization_url: string | null;
  gateway_access_code: string | null;
  fulfilled_at: string | null;
};

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return preflightResponse(request);
  if (request.method !== 'POST') {
    return jsonResponse(request, { error: 'Method not allowed.' }, 405);
  }

  try {
    const user = await requireAuthenticatedUser(request);
    const body = (await request.json().catch(() => ({}))) as InitializeRequest;
    const currency = body.currency?.trim().toUpperCase() || '';
    const couponCode = body.couponCode?.trim() || null;
    const checkoutSource = body.checkoutSource === 'agilecert_mobile'
      ? 'agilecert_mobile'
      : 'agilecert_portal';

    if (!/^[A-Z]{3}$/.test(currency)) {
      throw new Error('A valid location-routed payment currency is required before checkout.');
    }

    const candidateClient = userClient(request);
    const { data: orderResult, error: orderError } = await candidateClient.rpc(
      'create_my_exam_bulk_order',
      {
        p_currency: currency,
        p_coupon_code: couponCode,
      },
    );

    if (orderError) throw new Error(orderError.message);
    if (!orderResult || typeof orderResult !== 'object') {
      throw new Error('The consolidated examination order was not returned.');
    }

    const orderSummary = orderResult as Record<string, unknown>;
    const status = String(orderSummary.status || '');
    const bulkOrderId = String(orderSummary.bulkOrderId || '');

    if (!bulkOrderId) {
      throw new Error('The consolidated order identifier is missing.');
    }

    if (status === 'fulfilled' || status === 'already_unlocked') {
      return jsonResponse(request, {
        ...orderSummary,
        authorizationUrl: null,
        paymentRequired: false,
        canLaunch: true,
      });
    }

    const admin = adminClient();
    const { data: orderData, error: fetchError } = await admin
      .from('exam_bulk_orders')
      .select(
        'id, reference, candidate_id, currency, item_count, list_amount_minor, discount_amount_minor, payable_amount_minor, status, expires_at, gateway_authorization_url, gateway_access_code, fulfilled_at',
      )
      .eq('id', bulkOrderId)
      .single();

    if (fetchError) throw new Error(fetchError.message);
    const order = orderData as BulkOrder;

    if (order.candidate_id !== user.id) {
      return jsonResponse(
        request,
        { error: 'This cart order does not belong to the signed-in candidate.' },
        403,
      );
    }
    if (order.status !== 'pending') {
      throw new Error(`This consolidated order cannot be paid from status ${order.status}.`);
    }
    if (new Date(order.expires_at).getTime() <= Date.now()) {
      throw new Error('This consolidated payment order has expired. Review the cart and create a new order.');
    }
    if (!Number.isSafeInteger(Number(order.payable_amount_minor)) || order.payable_amount_minor <= 0) {
      throw new Error('The consolidated payable amount is invalid.');
    }

    if (order.currency.toUpperCase() !== currency) {
      throw new Error('The server-routed order currency changed. Refresh the cart before paying.');
    }

    if (order.gateway_authorization_url && order.gateway_access_code) {
      return jsonResponse(request, {
        bulkOrderId: order.id,
        reference: order.reference,
        itemCount: order.item_count,
        currency: order.currency,
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
      Deno.env.get('IIPM_PORTAL_URL') ||
      'https://iipmnigeria.github.io/IIPM-Examination-Portal/'
    ).trim();
    const callbackBase = portalUrl.replace(/\/$/, '');

    const paystackPayload = await paystackRequest('/transaction/initialize', {
      method: 'POST',
      body: JSON.stringify({
        email: user.email,
        amount: String(order.payable_amount_minor),
        currency: order.currency,
        reference: order.reference,
        callback_url: `${callbackBase}/?payment=callback&view=exams`,
        metadata: JSON.stringify({
          bulkOrderId: order.id,
          candidateId: order.candidate_id,
          itemCount: order.item_count,
          checkoutType: 'agilecert_exam_cart',
          checkoutSource,
          pricingRoute: 'location_routed',
          portal: 'AgileCert Global',
        }),
      }),
    });

    const authorizationUrl = String(paystackPayload.data?.authorization_url || '');
    const accessCode = String(paystackPayload.data?.access_code || '');

    if (!authorizationUrl || !accessCode) {
      throw new Error('Paystack did not return a consolidated checkout URL.');
    }

    const { error: updateError } = await admin
      .from('exam_bulk_orders')
      .update({
        gateway_authorization_url: authorizationUrl,
        gateway_access_code: accessCode,
      })
      .eq('id', order.id)
      .eq('status', 'pending');

    if (updateError) throw new Error(updateError.message);

    const { error: paymentError } = await admin
      .from('exam_bulk_payments')
      .upsert(
        {
          bulk_order_id: order.id,
          provider: 'paystack',
          reference: order.reference,
          status: 'initiated',
          amount_minor: order.payable_amount_minor,
          currency: order.currency,
          provider_payload: {
            access_code: accessCode,
            initialized_at: new Date().toISOString(),
            checkout_type: 'agilecert_exam_cart',
            checkout_source: checkoutSource,
            pricing_route: 'location_routed',
          },
        },
        { onConflict: 'provider,reference' },
      );

    if (paymentError) throw new Error(paymentError.message);

    return jsonResponse(request, {
      bulkOrderId: order.id,
      reference: order.reference,
      itemCount: order.item_count,
      currency: order.currency,
      listAmountMinor: order.list_amount_minor,
      discountAmountMinor: order.discount_amount_minor,
      payableAmountMinor: order.payable_amount_minor,
      status: order.status,
      authorizationUrl,
      accessCode,
      paymentRequired: true,
      expiresAt: order.expires_at,
      pricingRoute: 'location_routed',
    });
  } catch (error) {
    console.error('initialize-exam-cart-payment failed:', error);
    const message = error instanceof Error
      ? error.message
      : 'Consolidated payment initialization failed.';
    return jsonResponse(request, { error: message }, 400);
  }
});

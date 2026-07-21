import { jsonResponse, preflightResponse } from '../_shared/http.ts';
import { paystackRequest } from '../_shared/paystack.ts';
import {
  adminClient,
  requireAuthenticatedUser,
  userClient,
} from '../_shared/supabase.ts';

type InitializeRequest = {
  examinationId?: string;
  currency?: string;
  couponCode?: string;
};

type ExamOrder = {
  id: string;
  reference: string;
  candidate_id: string;
  examination_id: string;
  currency: string;
  list_amount_minor: number;
  discount_amount_minor: number;
  payable_amount_minor: number;
  status: string;
  expires_at: string;
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
    const body = (await request.json()) as InitializeRequest;
    const examinationId = body.examinationId?.trim();
    const currency = (body.currency || 'NGN').trim().toUpperCase();
    const couponCode = body.couponCode?.trim() || null;

    if (!examinationId) {
      return jsonResponse(request, { error: 'An examination identifier is required.' }, 400);
    }

    const candidateClient = userClient(request);
    const { data: orderResult, error: orderError } = await candidateClient.rpc(
      'create_exam_order',
      {
        p_examination_id: examinationId,
        p_currency: currency,
        p_coupon_code: couponCode,
      },
    );

    if (orderError) throw new Error(orderError.message);
    if (!orderResult || typeof orderResult !== 'object') {
      throw new Error('The examination order was not returned.');
    }

    const orderSummary = orderResult as Record<string, unknown>;
    const status = String(orderSummary.status || '');

    if (
      Boolean(orderSummary.canLaunch) ||
      status === 'waived' ||
      status === 'already_unlocked'
    ) {
      return jsonResponse(request, {
        ...orderSummary,
        authorizationUrl: null,
        paymentRequired: false,
      });
    }

    const orderId = String(orderSummary.orderId || '');
    if (!orderId) throw new Error('The pending order identifier is missing.');

    const admin = adminClient();
    const { data: orderData, error: orderFetchError } = await admin
      .from('exam_orders')
      .select(
        'id, reference, candidate_id, examination_id, currency, list_amount_minor, discount_amount_minor, payable_amount_minor, status, expires_at, gateway_authorization_url, gateway_access_code',
      )
      .eq('id', orderId)
      .single();

    if (orderFetchError) throw new Error(orderFetchError.message);
    const order = orderData as ExamOrder;

    if (order.candidate_id !== user.id) {
      return jsonResponse(request, { error: 'This order does not belong to the signed-in candidate.' }, 403);
    }
    if (order.status !== 'pending') {
      throw new Error(`This order cannot be paid from status ${order.status}.`);
    }
    if (new Date(order.expires_at).getTime() <= Date.now()) {
      throw new Error('This payment order has expired. Create a new order.');
    }
    if (!Number.isSafeInteger(Number(order.payable_amount_minor)) || order.payable_amount_minor <= 0) {
      throw new Error('The payable amount is invalid.');
    }

    if (order.gateway_authorization_url && order.gateway_access_code) {
      return jsonResponse(request, {
        orderId: order.id,
        reference: order.reference,
        examinationId: order.examination_id,
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

    const paystackPayload = await paystackRequest('/transaction/initialize', {
      method: 'POST',
      body: JSON.stringify({
        email: user.email,
        amount: String(order.payable_amount_minor),
        currency: order.currency,
        reference: order.reference,
        callback_url: `${portalUrl.replace(/\/$/, '')}/?payment=callback`,
        metadata: JSON.stringify({
          orderId: order.id,
          candidateId: order.candidate_id,
          examinationId: order.examination_id,
          portal: 'IIPM Examination Portal',
        }),
      }),
    });

    const authorizationUrl = String(paystackPayload.data?.authorization_url || '');
    const accessCode = String(paystackPayload.data?.access_code || '');

    if (!authorizationUrl || !accessCode) {
      throw new Error('Paystack did not return a checkout URL.');
    }

    const { error: updateError } = await admin
      .from('exam_orders')
      .update({
        gateway_authorization_url: authorizationUrl,
        gateway_access_code: accessCode,
      })
      .eq('id', order.id)
      .eq('status', 'pending');

    if (updateError) throw new Error(updateError.message);

    const { error: paymentError } = await admin
      .from('exam_payments')
      .upsert(
        {
          order_id: order.id,
          provider: 'paystack',
          reference: order.reference,
          status: 'initiated',
          amount_minor: order.payable_amount_minor,
          currency: order.currency,
          provider_payload: {
            access_code: accessCode,
            initialized_at: new Date().toISOString(),
          },
        },
        { onConflict: 'provider,reference' },
      );

    if (paymentError) throw new Error(paymentError.message);

    return jsonResponse(request, {
      orderId: order.id,
      reference: order.reference,
      examinationId: order.examination_id,
      currency: order.currency,
      listAmountMinor: order.list_amount_minor,
      discountAmountMinor: order.discount_amount_minor,
      payableAmountMinor: order.payable_amount_minor,
      status: order.status,
      authorizationUrl,
      accessCode,
      paymentRequired: true,
      expiresAt: order.expires_at,
    });
  } catch (error) {
    console.error('initialize-exam-payment failed:', error);
    const message = error instanceof Error ? error.message : 'Payment initialization failed.';
    return jsonResponse(request, { error: message }, 400);
  }
});

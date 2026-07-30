import { jsonResponse, preflightResponse } from '../_shared/http.ts';
import {
  paystackRequestedAmount,
  verifyPaystackTransaction,
} from '../_shared/paystack.ts';
import { adminClient, requireAuthenticatedUser } from '../_shared/supabase.ts';

type VerifyRequest = {
  reference?: string;
};

type BulkOrder = {
  id: string;
  reference: string;
  candidate_id: string;
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
    const user = await requireAuthenticatedUser(request);
    const body = (await request.json()) as VerifyRequest;
    const reference = body.reference?.trim();

    if (!reference) {
      return jsonResponse(request, { error: 'A consolidated transaction reference is required.' }, 400);
    }

    const admin = adminClient();
    const { data: orderData, error: orderError } = await admin
      .from('exam_bulk_orders')
      .select('id, reference, candidate_id, currency, payable_amount_minor, status, fulfilled_at')
      .eq('reference', reference)
      .single();

    if (orderError) throw new Error(orderError.message);
    const order = orderData as BulkOrder;

    if (order.candidate_id !== user.id) {
      return jsonResponse(request, { error: 'This transaction does not belong to the signed-in candidate.' }, 403);
    }

    if (order.status === 'fulfilled' && order.fulfilled_at) {
      const { data: existingResult, error: existingError } = await admin.rpc(
        'agilecert_exam_bulk_order_payload',
        {
          p_bulk_order_id: order.id,
          p_candidate_id: order.candidate_id,
        },
      );
      if (existingError) throw new Error(existingError.message);
      return jsonResponse(request, {
        ...(existingResult as Record<string, unknown>),
        reference: order.reference,
        canLaunch: true,
        verified: true,
        alreadyFulfilled: true,
      });
    }

    if (!['pending', 'paid', 'partially_fulfilled'].includes(order.status)) {
      throw new Error(`This consolidated payment cannot be verified from status ${order.status}.`);
    }

    const transaction = await verifyPaystackTransaction(reference);
    const transactionReference = String(transaction.reference || '');
    const transactionCurrency = String(transaction.currency || '').toUpperCase();
    const requestedAmount = paystackRequestedAmount(transaction);
    const transactionStatus = String(transaction.status || '').toLowerCase();
    const transactionEmail = String(transaction.customer?.email || '').toLowerCase();

    if (transactionStatus !== 'success') {
      throw new Error(`Paystack reports transaction status ${transactionStatus || 'unknown'}.`);
    }
    if (transactionReference !== order.reference) {
      throw new Error('The Paystack transaction reference does not match the consolidated order.');
    }
    if (transactionCurrency !== order.currency.toUpperCase()) {
      throw new Error('The Paystack transaction currency does not match the consolidated order.');
    }
    if (requestedAmount !== Number(order.payable_amount_minor)) {
      throw new Error('The Paystack transaction amount does not match the consolidated order.');
    }
    if (transactionEmail && user.email && transactionEmail !== user.email.toLowerCase()) {
      throw new Error('The Paystack customer email does not match the signed-in candidate.');
    }

    const { data: fulfilment, error: fulfilmentError } = await admin.rpc(
      'fulfil_paid_exam_bulk_order',
      {
        p_bulk_order_id: order.id,
        p_provider_transaction_id: String(transaction.id || ''),
        p_provider_payload: transaction,
      },
    );

    if (fulfilmentError) throw new Error(fulfilmentError.message);
    const result = fulfilment as Record<string, unknown>;
    const finalStatus = String(result.status || '');

    return jsonResponse(request, {
      ...result,
      reference: order.reference,
      canLaunch: finalStatus === 'fulfilled' || Number(result.itemCount || 0) > 0,
      verified: true,
      requiresSupport: finalStatus === 'partially_fulfilled',
    });
  } catch (error) {
    console.error('verify-exam-cart-payment failed:', error);
    const message = error instanceof Error ? error.message : 'Consolidated payment verification failed.';
    return jsonResponse(request, { error: message }, 400);
  }
});

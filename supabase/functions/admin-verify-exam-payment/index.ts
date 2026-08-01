import { jsonResponse, preflightResponse } from '../_shared/http.ts';
import {
  paystackRequestedAmount,
  verifyPaystackTransaction,
} from '../_shared/paystack.ts';
import {
  adminClient,
  requireAuthenticatedUser,
  userClient,
} from '../_shared/supabase.ts';

type VerifyRequest = {
  reference?: string;
};

type FinanceAccess = {
  canReconcileTransactions?: boolean;
  permissions?: string[];
  role?: string;
};

type OrderRecord = {
  id: string;
  reference: string;
  candidate_id: string;
  currency: string;
  payable_amount_minor: number;
  status: string;
  fulfilled_at: string | null;
};

const completeRecoveryRecord = async (
  reference: string,
  actorId: string,
  succeeded: boolean,
  outcome: Record<string, unknown>,
) => {
  const admin = adminClient();
  const { data: pending } = await admin
    .from('agilecert_finance_recovery_actions')
    .select('id')
    .eq('reference', reference)
    .eq('action', 'manual_verification')
    .in('status', ['queued', 'processing'])
    .order('requested_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (pending?.id) {
    await admin
      .from('agilecert_finance_recovery_actions')
      .update({
        status: succeeded ? 'succeeded' : 'failed',
        outcome,
        processed_by: actorId,
        processed_at: new Date().toISOString(),
      })
      .eq('id', pending.id);
  }
};

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return preflightResponse(request);
  if (request.method !== 'POST') {
    return jsonResponse(request, { error: 'Method not allowed.' }, 405);
  }

  let reference = '';
  let actorId = '';
  try {
    const user = await requireAuthenticatedUser(request);
    actorId = user.id;
    const body = (await request.json()) as VerifyRequest;
    reference = body.reference?.trim() || '';
    if (!reference) {
      return jsonResponse(request, { error: 'A payment reference is required.' }, 400);
    }

    const actorClient = userClient(request);
    const { data: accessData, error: accessError } = await actorClient.rpc(
      'get_my_finance_console_access',
    );
    if (accessError) throw new Error(accessError.message);
    const access = (accessData || {}) as FinanceAccess;
    const authorised = access.role === 'super_admin'
      || access.canReconcileTransactions === true
      || access.permissions?.includes('finance.transactions.reconcile');
    if (!authorised) {
      return jsonResponse(request, {
        error: 'This account does not have permission to reconcile transactions.',
      }, 403);
    }

    const admin = adminClient();
    const { data: individualData, error: individualError } = await admin
      .from('exam_orders')
      .select('id, reference, candidate_id, currency, payable_amount_minor, status, fulfilled_at')
      .eq('reference', reference)
      .maybeSingle();
    if (individualError) throw new Error(individualError.message);

    const orderType = individualData ? 'exam' : 'bulk';
    let order = individualData as OrderRecord | null;
    if (!order) {
      const { data: bulkData, error: bulkError } = await admin
        .from('exam_bulk_orders')
        .select('id, reference, candidate_id, currency, payable_amount_minor, status, fulfilled_at')
        .eq('reference', reference)
        .maybeSingle();
      if (bulkError) throw new Error(bulkError.message);
      order = bulkData as OrderRecord | null;
    }
    if (!order) throw new Error('No individual or consolidated order matches this reference.');

    if (orderType === 'exam' && ['paid', 'waived'].includes(order.status) && order.fulfilled_at) {
      const result = {
        orderType,
        orderId: order.id,
        reference,
        status: order.status,
        alreadyFulfilled: true,
      };
      await completeRecoveryRecord(reference, actorId, true, result);
      return jsonResponse(request, result);
    }
    if (orderType === 'bulk' && order.status === 'fulfilled' && order.fulfilled_at) {
      const result = {
        orderType,
        orderId: order.id,
        reference,
        status: order.status,
        alreadyFulfilled: true,
      };
      await completeRecoveryRecord(reference, actorId, true, result);
      return jsonResponse(request, result);
    }

    const { data: candidate, error: candidateError } = await admin
      .from('profiles')
      .select('email')
      .eq('id', order.candidate_id)
      .single();
    if (candidateError) throw new Error(candidateError.message);

    const transaction = await verifyPaystackTransaction(reference);
    const transactionReference = String(transaction.reference || '');
    const transactionCurrency = String(transaction.currency || '').toUpperCase();
    const requestedAmount = paystackRequestedAmount(transaction);
    const transactionStatus = String(transaction.status || '').toLowerCase();
    const transactionEmail = String(transaction.customer?.email || '').toLowerCase();
    const candidateEmail = String(candidate?.email || '').toLowerCase();

    if (transactionStatus !== 'success') {
      throw new Error(`Paystack reports transaction status ${transactionStatus || 'unknown'}.`);
    }
    if (transactionReference !== order.reference) {
      throw new Error('The Paystack transaction reference does not match the order.');
    }
    if (transactionCurrency !== order.currency.toUpperCase()) {
      throw new Error('The Paystack transaction currency does not match the order.');
    }
    if (requestedAmount !== Number(order.payable_amount_minor)) {
      throw new Error('The Paystack transaction amount does not match the order.');
    }
    if (transactionEmail && candidateEmail && transactionEmail !== candidateEmail) {
      throw new Error('The Paystack customer email does not match the order candidate.');
    }

    const rpcName = orderType === 'bulk'
      ? 'fulfil_paid_exam_bulk_order'
      : 'fulfil_paid_exam_order';
    const rpcArgs = orderType === 'bulk'
      ? {
          p_bulk_order_id: order.id,
          p_provider_transaction_id: String(transaction.id || ''),
          p_provider_payload: transaction,
        }
      : {
          p_order_id: order.id,
          p_provider_transaction_id: String(transaction.id || ''),
          p_provider_payload: transaction,
        };

    const { data: fulfilment, error: fulfilmentError } = await admin.rpc(rpcName, rpcArgs);
    if (fulfilmentError) throw new Error(fulfilmentError.message);

    const result = {
      ...(fulfilment as Record<string, unknown>),
      orderType,
      orderId: order.id,
      reference,
      verified: true,
      verifiedBy: actorId,
    };

    await admin.from('agilecert_finance_audit_events').insert({
      actor_id: actorId,
      entity_type: orderType === 'bulk' ? 'exam_bulk_order' : 'exam_order',
      entity_id: order.id,
      action: 'administrator_paystack_verification_completed',
      metadata: {
        reference,
        providerTransactionId: String(transaction.id || ''),
        result,
      },
    });
    await completeRecoveryRecord(reference, actorId, true, result);

    return jsonResponse(request, result);
  } catch (error) {
    console.error('admin-verify-exam-payment failed:', error);
    const message = error instanceof Error ? error.message : 'Payment verification failed.';
    if (reference && actorId) {
      await completeRecoveryRecord(reference, actorId, false, { error: message });
    }
    return jsonResponse(request, { error: message }, 400);
  }
});

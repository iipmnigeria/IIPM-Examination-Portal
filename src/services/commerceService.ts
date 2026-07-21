import { supabase } from '../lib/supabase';

export interface ExamPrice {
  id: string;
  currency: string;
  amountMinor: number;
  countryCodes?: string[];
  isDefault?: boolean;
}

export interface PurchaseQuote {
  examinationId: string;
  priceId: string;
  currency: string;
  listAmountMinor: number;
  couponId?: string | null;
  couponCode?: string | null;
  discountAmountMinor: number;
  payableAmountMinor: number;
}

export interface ExamOrder {
  orderId?: string;
  reference?: string;
  examinationId: string;
  currency?: string;
  listAmountMinor?: number;
  discountAmountMinor?: number;
  payableAmountMinor?: number;
  status: string;
  canLaunch?: boolean;
  paymentRequired?: boolean;
  authorizationUrl?: string | null;
  accessCode?: string | null;
  expiresAt?: string;
}

export interface PaymentVerification {
  orderId?: string;
  reference?: string;
  examinationId?: string;
  assignmentId?: string;
  status: string;
  canLaunch: boolean;
  verified?: boolean;
  alreadyFulfilled?: boolean;
}

async function functionErrorMessage(error: any, fallback: string): Promise<string> {
  const context = error?.context;

  if (context instanceof Response) {
    try {
      const payload = await context.clone().json();
      if (payload?.error) return String(payload.error);
      if (payload?.message) return String(payload.message);
    } catch {
      try {
        const text = await context.clone().text();
        if (text.trim()) return text.trim();
      } catch {
        // Use the normal error message below.
      }
    }
  }

  return error?.message || fallback;
}

export async function quoteExamPurchase(input: {
  examinationId: string;
  currency: string;
  couponCode?: string;
}): Promise<PurchaseQuote> {
  const { data, error } = await supabase.rpc('quote_exam_purchase', {
    p_examination_id: input.examinationId,
    p_currency: input.currency,
    p_coupon_code: input.couponCode?.trim() || null,
  });

  if (error) throw new Error(error.message);
  if (!data || typeof data !== 'object') {
    throw new Error('The examination price quote was not returned.');
  }

  return data as PurchaseQuote;
}

export async function createExamOrder(input: {
  examinationId: string;
  currency: string;
  couponCode?: string;
}): Promise<ExamOrder> {
  const { data, error } = await supabase.functions.invoke('initialize-exam-payment', {
    body: {
      examinationId: input.examinationId,
      currency: input.currency,
      couponCode: input.couponCode?.trim() || null,
    },
  });

  if (error) {
    throw new Error(await functionErrorMessage(error, 'The secure payment session could not be initialized.'));
  }
  if (!data || typeof data !== 'object') {
    throw new Error('The examination payment order was not returned.');
  }

  const order = data as ExamOrder;

  if (order.reference) {
    sessionStorage.setItem('iipm_pending_payment_reference', order.reference);
  }

  if (order.authorizationUrl) {
    window.location.assign(order.authorizationUrl);
  }

  return order;
}

export async function verifyExamPayment(reference: string): Promise<PaymentVerification> {
  const cleanReference = reference.trim();
  if (!cleanReference) throw new Error('The payment reference is missing.');

  const { data, error } = await supabase.functions.invoke('verify-exam-payment', {
    body: { reference: cleanReference },
  });

  if (error) {
    throw new Error(await functionErrorMessage(error, 'The Paystack transaction could not be verified.'));
  }
  if (!data || typeof data !== 'object') {
    throw new Error('The payment verification result was not returned.');
  }

  return data as PaymentVerification;
}

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
  expiresAt?: string;
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
  const { data, error } = await supabase.rpc('create_exam_order', {
    p_examination_id: input.examinationId,
    p_currency: input.currency,
    p_coupon_code: input.couponCode?.trim() || null,
  });

  if (error) throw new Error(error.message);
  if (!data || typeof data !== 'object') {
    throw new Error('The examination order was not returned.');
  }

  return data as ExamOrder;
}

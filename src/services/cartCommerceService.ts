import { supabase } from '../lib/supabase';

export type CartItemStatus =
  | 'quoted'
  | 'pending'
  | 'waived'
  | 'fulfilled'
  | 'already_unlocked'
  | 'failed'
  | 'cancelled';

export interface ExamCartItem {
  examinationId: string;
  examinationTitle: string;
  programmeCode: string;
  position: number;
  canLaunch?: boolean;
}

export interface ExamCart {
  cartId: string;
  currency: string;
  couponCode?: string | null;
  lastBulkOrderId?: string | null;
  itemCount: number;
  items: ExamCartItem[];
}

export interface ExamCartQuoteItem {
  examinationId: string;
  examinationTitle: string;
  programmeCode?: string;
  position: number;
  status: CartItemStatus;
  priceId?: string | null;
  couponId?: string | null;
  couponCode?: string | null;
  currency: string;
  listAmountMinor: number;
  discountAmountMinor: number;
  payableAmountMinor: number;
}

export interface ExamCartQuote {
  cartId: string;
  cartFingerprint: string;
  bulkOrderId?: string;
  reference?: string;
  currency: string;
  couponCode?: string | null;
  itemCount: number;
  quotedItemCount: number;
  alreadyUnlockedCount: number;
  listAmountMinor: number;
  discountAmountMinor: number;
  payableAmountMinor: number;
  status: 'quoted' | 'waived' | 'already_unlocked' | 'existing_order';
  items: ExamCartQuoteItem[];
}

export interface ExamBulkOrderItem {
  itemId: string;
  examinationId: string;
  examinationTitle: string;
  childOrderId?: string | null;
  position: number;
  currency: string;
  listAmountMinor: number;
  discountAmountMinor: number;
  payableAmountMinor: number;
  status: CartItemStatus;
  fulfilledAt?: string | null;
  failureCode?: string | null;
  failureMessage?: string | null;
}

export interface ExamBulkOrder {
  bulkOrderId: string;
  reference: string;
  cartId?: string | null;
  currency: string;
  couponCode?: string | null;
  itemCount: number;
  listAmountMinor: number;
  discountAmountMinor: number;
  payableAmountMinor: number;
  status: string;
  paymentRequired?: boolean;
  authorizationUrl?: string | null;
  accessCode?: string | null;
  expiresAt?: string;
  paidAt?: string | null;
  fulfilledAt?: string | null;
  paymentStatus?: string | null;
  items: ExamBulkOrderItem[];
}

export interface ExamCartPaymentVerification extends ExamBulkOrder {
  canLaunch: boolean;
  verified?: boolean;
  alreadyFulfilled?: boolean;
  requiresSupport?: boolean;
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

export async function getMyExamCart(): Promise<ExamCart> {
  const { data, error } = await supabase.rpc('get_my_exam_cart');
  if (error) throw new Error(error.message);
  if (!data || typeof data !== 'object') throw new Error('The examination cart was not returned.');
  return data as ExamCart;
}

export async function setMyExamCartItem(input: {
  examinationId: string;
  selected: boolean;
}): Promise<ExamCart> {
  const { data, error } = await supabase.rpc('set_my_exam_cart_item', {
    p_examination_id: input.examinationId,
    p_selected: input.selected,
  });
  if (error) throw new Error(error.message);
  if (!data || typeof data !== 'object') throw new Error('The examination cart was not updated.');
  return data as ExamCart;
}

export async function configureMyExamCart(input: {
  currency: string;
  couponCode?: string;
}): Promise<ExamCart> {
  const { data, error } = await supabase.rpc('configure_my_exam_cart', {
    p_currency: input.currency,
    p_coupon_code: input.couponCode?.trim() || null,
  });
  if (error) throw new Error(error.message);
  if (!data || typeof data !== 'object') throw new Error('The examination cart settings were not updated.');
  return data as ExamCart;
}

export async function quoteMyExamCart(input: {
  currency: string;
  couponCode?: string;
}): Promise<ExamCartQuote> {
  const { data, error } = await supabase.rpc('quote_my_exam_cart', {
    p_currency: input.currency,
    p_coupon_code: input.couponCode?.trim() || null,
  });
  if (error) throw new Error(error.message);
  if (!data || typeof data !== 'object') throw new Error('The consolidated cart quote was not returned.');
  return data as ExamCartQuote;
}

export async function initializeExamCartPayment(input: {
  currency: string;
  couponCode?: string;
}): Promise<ExamBulkOrder> {
  const { data, error } = await supabase.functions.invoke('initialize-exam-cart-payment', {
    body: {
      currency: input.currency,
      couponCode: input.couponCode?.trim() || null,
    },
  });

  if (error) {
    throw new Error(await functionErrorMessage(error, 'Unable to initialize the consolidated payment.'));
  }
  if (!data || typeof data !== 'object') {
    throw new Error('The consolidated payment response was not returned.');
  }
  return data as ExamBulkOrder;
}

export async function verifyExamCartPayment(reference: string): Promise<ExamCartPaymentVerification> {
  const { data, error } = await supabase.functions.invoke('verify-exam-cart-payment', {
    body: { reference },
  });

  if (error) {
    throw new Error(await functionErrorMessage(error, 'Unable to verify the consolidated payment.'));
  }
  if (!data || typeof data !== 'object') {
    throw new Error('The consolidated payment verification was not returned.');
  }
  return data as ExamCartPaymentVerification;
}

export async function getMyExamBulkOrders(): Promise<ExamBulkOrder[]> {
  const { data, error } = await supabase.rpc('get_my_exam_bulk_orders');
  if (error) throw new Error(error.message);
  const payload = data as { orders?: ExamBulkOrder[] } | null;
  return Array.isArray(payload?.orders) ? payload.orders : [];
}

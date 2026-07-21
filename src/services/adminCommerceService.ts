import { supabase } from '../lib/supabase';

export interface AdminPaidCurrencySummary {
  currency: string;
  amountMinor: number;
  transactions: number;
}

export interface AdminCommerceSummary {
  publishedExaminations: number;
  activePrices: number;
  activeCoupons: number;
  pendingOrders: number;
  paidOrders: number;
  waivedOrders: number;
  failedOrders: number;
  paidByCurrency: AdminPaidCurrencySummary[];
}

export interface AdminExamPrice {
  id: string;
  currency: string;
  amountMinor: number;
  countryCodes: string[];
  isDefault: boolean;
  isActive: boolean;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  updatedAt?: string;
}

export interface AdminCommerceExamination {
  id: string;
  programmeId: string;
  course: string;
  title: string;
  status: string;
  requiresPayment: boolean;
  prices: AdminExamPrice[];
}

export interface AdminCommerceProgramme {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

export interface AdminCoupon {
  id: string;
  code: string;
  name?: string | null;
  description?: string | null;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  currency?: string | null;
  scope: 'all' | 'programme' | 'examination';
  programmeId?: string | null;
  examinationId?: string | null;
  minimumAmountMinor: number;
  maximumDiscountMinor?: number | null;
  startsAt?: string | null;
  expiresAt?: string | null;
  maximumRedemptions?: number | null;
  perCandidateLimit: number;
  isActive: boolean;
  reservedCount: number;
  redeemedCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminExamOrder {
  id: string;
  reference: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  examinationId: string;
  course: string;
  examinationTitle: string;
  couponCode?: string | null;
  currency: string;
  listAmountMinor: number;
  discountAmountMinor: number;
  payableAmountMinor: number;
  status: string;
  gateway: string;
  expiresAt?: string | null;
  paidAt?: string | null;
  fulfilledAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminExamPayment {
  id: string;
  orderId: string;
  reference: string;
  provider: string;
  providerTransactionId?: string | null;
  candidateName: string;
  candidateEmail: string;
  course: string;
  examinationTitle: string;
  status: string;
  amountMinor: number;
  currency: string;
  paidAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminCouponRedemption {
  id: string;
  couponCode: string;
  candidateName: string;
  candidateEmail: string;
  course: string;
  examinationTitle: string;
  orderReference: string;
  currency: string;
  discountAmountMinor: number;
  status: string;
  redeemedAt?: string | null;
  releasedAt?: string | null;
  createdAt: string;
}

export interface AdminCommerceSnapshot {
  generatedAt: string;
  summary: AdminCommerceSummary;
  examinations: AdminCommerceExamination[];
  programmes: AdminCommerceProgramme[];
  coupons: AdminCoupon[];
  orders: AdminExamOrder[];
  payments: AdminExamPayment[];
  redemptions: AdminCouponRedemption[];
}

export async function getAdminCommerceSnapshot(limit = 100): Promise<AdminCommerceSnapshot> {
  const { data, error } = await supabase.rpc('get_admin_commerce_snapshot', {
    p_limit: limit,
  });

  if (error) throw new Error(error.message);
  if (!data || typeof data !== 'object') {
    throw new Error('The administrator commerce snapshot was not returned.');
  }

  return data as AdminCommerceSnapshot;
}

export async function upsertExamPrice(input: {
  examinationId: string;
  currency: string;
  amountMinor: number;
  countryCodes: string[];
  isDefault: boolean;
  isActive: boolean;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
}): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.rpc('admin_upsert_exam_price', {
    p_examination_id: input.examinationId,
    p_currency: input.currency.trim().toUpperCase(),
    p_amount_minor: input.amountMinor,
    p_country_codes: input.countryCodes,
    p_is_default: input.isDefault,
    p_is_active: input.isActive,
    p_effective_from: input.effectiveFrom || new Date().toISOString(),
    p_effective_to: input.effectiveTo || null,
  });

  if (error) throw new Error(error.message);
  return (data || {}) as Record<string, unknown>;
}

export async function upsertCoupon(input: {
  couponId?: string | null;
  code: string;
  name?: string;
  description?: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  currency?: string | null;
  scope: 'all' | 'programme' | 'examination';
  programmeId?: string | null;
  examinationId?: string | null;
  minimumAmountMinor: number;
  maximumDiscountMinor?: number | null;
  startsAt?: string | null;
  expiresAt?: string | null;
  maximumRedemptions?: number | null;
  perCandidateLimit: number;
  isActive: boolean;
}): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.rpc('admin_upsert_coupon', {
    p_coupon_id: input.couponId || null,
    p_code: input.code.trim().toUpperCase(),
    p_name: input.name?.trim() || null,
    p_description: input.description?.trim() || null,
    p_discount_type: input.discountType,
    p_discount_value: input.discountValue,
    p_currency: input.currency?.trim().toUpperCase() || null,
    p_scope: input.scope,
    p_programme_id: input.scope === 'programme' ? input.programmeId || null : null,
    p_examination_id: input.scope === 'examination' ? input.examinationId || null : null,
    p_minimum_amount_minor: input.minimumAmountMinor,
    p_maximum_discount_minor: input.maximumDiscountMinor ?? null,
    p_starts_at: input.startsAt || null,
    p_expires_at: input.expiresAt || null,
    p_maximum_redemptions: input.maximumRedemptions ?? null,
    p_per_candidate_limit: input.perCandidateLimit,
    p_is_active: input.isActive,
  });

  if (error) throw new Error(error.message);
  return (data || {}) as Record<string, unknown>;
}

export async function setCouponActive(couponId: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.rpc('admin_set_coupon_active', {
    p_coupon_id: couponId,
    p_is_active: isActive,
  });
  if (error) throw new Error(error.message);
}

export async function setExamPriceActive(priceId: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.rpc('admin_set_exam_price_active', {
    p_price_id: priceId,
    p_is_active: isActive,
  });
  if (error) throw new Error(error.message);
}

export async function cancelExamOrder(orderId: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc('admin_cancel_exam_order', {
    p_order_id: orderId,
    p_reason: reason.trim() || 'Cancelled by examination administrator',
  });
  if (error) throw new Error(error.message);
}

import { supabase } from '../lib/supabase';
import type {
  AdminCommerceSnapshot,
  AdminCoupon,
  AdminExamOrder,
  AdminExamPrice,
} from './adminCommerceService';

export type FinancePermissionKey =
  | 'finance.console.view'
  | 'finance.exam_prices.manage'
  | 'finance.coupons.manage'
  | 'finance.orders.manage'
  | 'finance.permissions.manage';

export interface FinanceConsoleAccess {
  actorId: string;
  role: string;
  permissions: FinancePermissionKey[];
  canViewConsole: boolean;
  canManageExamPrices: boolean;
  canManageCoupons: boolean;
  canManageOrders: boolean;
  canManagePermissions: boolean;
}

export interface FinancePermissionGrant {
  role: 'exam_admin';
  permissionKey: FinancePermissionKey;
  name: string;
  description: string;
  category: string;
  riskLevel: 'standard' | 'sensitive' | 'restricted';
  isGranted: boolean;
  updatedAt?: string | null;
}

export interface FinanceSettingsSummary {
  defaultCurrency?: string;
  quotePrefix?: string;
  invoicePrefix?: string;
  receiptPrefix?: string;
  quoteValidityDays?: number;
  invoicePaymentTermsDays?: number;
  allowPartialPayments?: boolean;
  allowOverpayments?: boolean;
  updatedAt?: string;
}

export interface FinanceAuditEvent {
  id: number;
  actorId?: string | null;
  actorName?: string | null;
  entityType: string;
  entityId?: string | null;
  action: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface FinanceConsoleSnapshot extends AdminCommerceSnapshot {
  access: FinanceConsoleAccess;
  permissionMatrix: FinancePermissionGrant[];
  financeSettings: FinanceSettingsSummary;
  financeAudit: FinanceAuditEvent[];
}

export async function getMyFinanceConsoleAccess(): Promise<FinanceConsoleAccess> {
  const { data, error } = await supabase.rpc('get_my_finance_console_access');
  if (error) throw new Error(error.message);
  if (!data || typeof data !== 'object') {
    throw new Error('Finance Console access information was not returned.');
  }
  return data as FinanceConsoleAccess;
}

export async function getFinanceConsoleSnapshot(limit = 200): Promise<FinanceConsoleSnapshot> {
  const { data, error } = await supabase.rpc('get_finance_console_snapshot', {
    p_limit: limit,
  });
  if (error) throw new Error(error.message);
  if (!data || typeof data !== 'object') {
    throw new Error('The Finance Console snapshot was not returned.');
  }
  return data as FinanceConsoleSnapshot;
}

export async function saveFinanceExamPrice(input: {
  examinationId: string;
  currency: string;
  amountMinor: number;
  countryCodes: string[];
  isDefault: boolean;
  isActive: boolean;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  changeReason: string;
}): Promise<AdminExamPrice> {
  const { data, error } = await supabase.rpc('finance_upsert_exam_price', {
    p_examination_id: input.examinationId,
    p_currency: input.currency.trim().toUpperCase(),
    p_amount_minor: input.amountMinor,
    p_country_codes: input.countryCodes,
    p_is_default: input.isDefault,
    p_is_active: input.isActive,
    p_effective_from: input.effectiveFrom || new Date().toISOString(),
    p_effective_to: input.effectiveTo || null,
    p_change_reason: input.changeReason.trim(),
  });
  if (error) throw new Error(error.message);
  return (data || {}) as AdminExamPrice;
}

export async function setFinanceExamPriceActive(input: {
  priceId: string;
  isActive: boolean;
  changeReason: string;
}): Promise<void> {
  const { error } = await supabase.rpc('finance_set_exam_price_active', {
    p_price_id: input.priceId,
    p_is_active: input.isActive,
    p_change_reason: input.changeReason.trim(),
  });
  if (error) throw new Error(error.message);
}

export async function saveFinanceCoupon(input: {
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
}): Promise<AdminCoupon> {
  const { data, error } = await supabase.rpc('finance_upsert_coupon', {
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
  return (data || {}) as AdminCoupon;
}

export async function setFinanceCouponActive(
  couponId: string,
  isActive: boolean,
): Promise<void> {
  const { error } = await supabase.rpc('finance_set_coupon_active', {
    p_coupon_id: couponId,
    p_is_active: isActive,
  });
  if (error) throw new Error(error.message);
}

export async function cancelFinanceExamOrder(
  order: AdminExamOrder,
  reason: string,
): Promise<void> {
  const { error } = await supabase.rpc('finance_cancel_exam_order', {
    p_order_id: order.id,
    p_reason: reason.trim(),
  });
  if (error) throw new Error(error.message);
}

export async function setFinanceRolePermission(input: {
  role: 'exam_admin';
  permissionKey: FinancePermissionKey;
  isGranted: boolean;
  reason: string;
}): Promise<void> {
  const { error } = await supabase.rpc('admin_set_finance_role_permission', {
    p_role: input.role,
    p_permission_key: input.permissionKey,
    p_is_granted: input.isGranted,
    p_reason: input.reason.trim(),
  });
  if (error) throw new Error(error.message);
}

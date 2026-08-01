import { supabase } from '../lib/supabase';

export type FinanceOrderType = 'exam' | 'bulk';
export type FinanceAccessMode = 'paid' | 'free' | 'scholarship' | 'invitation_only';
export type FinanceRecoveryAction = 'manual_verification' | 'access_recovery' | 'refund_review' | 'reversal_review';

export interface FinanceCompletionAccess {
  canViewConsole: boolean;
  canViewDashboard: boolean;
  canManageExamPrices: boolean;
  canManageCoupons: boolean;
  canManageSettings: boolean;
  canReconcileTransactions: boolean;
  canRecoverAccess: boolean;
  canApproveAdjustments: boolean;
  canManageReceipts: boolean;
  canExportTransactions: boolean;
  canManagePermissions: boolean;
  permissions: string[];
  role: string;
}

export interface FinanceGeneralSettings {
  defaultCurrency: string;
  supportedCurrencies: string[];
  paystackEnabled: boolean;
  paystackEnvironment: 'test' | 'production';
  paystackConfigured: boolean;
  paystackStatusNote?: string | null;
  taxEnabled: boolean;
  taxLabel: string;
  defaultTaxProfileId?: string | null;
  receiptPrefix: string;
  paymentReferencePrefix: string;
  paymentExpiryMinutes: number;
  abandonedOrderHours: number;
  refundsEnabled: boolean;
  reversalsEnabled: boolean;
  manualPaymentApprovalEnabled: boolean;
  bankTransferInstructions?: string | null;
  minimumTransactionMinor: number;
  maximumTransactionMinor?: number | null;
  allowPartialPayments: boolean;
  allowOverpayments: boolean;
  updatedAt?: string;
}

export interface FinanceTaxProfile {
  id: string;
  code: string;
  name: string;
  ratePercent: number;
  countryCode?: string | null;
  registrationNumber?: string | null;
  isDefault: boolean;
  isActive: boolean;
}

export interface FinanceExamPricingPolicy {
  id: string;
  examinationId: string;
  examinationTitle: string;
  programmeId: string;
  programmeCode: string;
  programmeName: string;
  currency: string;
  standardAmountMinor: number;
  promotionalAmountMinor?: number | null;
  promotionName?: string | null;
  promotionStartsAt?: string | null;
  promotionEndsAt?: string | null;
  accessMode: FinanceAccessMode;
  attemptsIncluded: number;
  retakeAmountMinor?: number | null;
  bulkCartEligible: boolean;
  isActive: boolean;
  updatedAt: string;
}

export interface FinanceCandidate {
  id: string;
  fullName: string;
  email: string;
}

export interface FinanceExamAccessGrant {
  id: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  examinationId: string;
  examinationTitle: string;
  accessMode: 'scholarship' | 'invitation_only';
  grantCode?: string | null;
  validFrom: string;
  validTo?: string | null;
  status: 'active' | 'used' | 'revoked' | 'expired';
  reason: string;
  createdAt: string;
  updatedAt: string;
}

export interface FinanceCouponTarget {
  id: string;
  couponId: string;
  couponCode: string;
  targetType: 'programme' | 'examination';
  programmeId?: string | null;
  programmeCode?: string | null;
  programmeName?: string | null;
  examinationId?: string | null;
  examinationTitle?: string | null;
  isActive: boolean;
}

export interface FinanceCouponPolicy {
  couponId: string;
  couponCode: string;
  minimumAmountMinor: number;
  minimumModuleCount: number;
  allowMultiModuleCart: boolean;
  maximumDiscountMinor?: number | null;
  maximumRedemptions?: number | null;
  perCandidateLimit: number;
}

export interface FinanceCouponUsage {
  id: string;
  couponId: string;
  couponCode: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  orderId: string;
  orderReference: string;
  examinationTitle: string;
  programmeCode: string;
  currency: string;
  discountAmountMinor: number;
  status: string;
  redeemedAt?: string | null;
  createdAt: string;
}

export interface FinanceUnifiedTransaction {
  orderType: FinanceOrderType;
  orderId: string;
  reference: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  programmeCode: string;
  programmeName: string;
  examinationTitle: string;
  itemCount: number;
  currency: string;
  grossAmountMinor: number;
  discountAmountMinor: number;
  payableAmountMinor: number;
  amountPaidMinor: number;
  couponCode?: string | null;
  orderStatus: string;
  paymentStatus?: string | null;
  provider?: string | null;
  providerTransactionId?: string | null;
  paidAt?: string | null;
  fulfilledAt?: string | null;
  expiresAt?: string | null;
  provisioningStatus: 'fulfilled' | 'paid_unfulfilled' | 'not_due';
  createdAt: string;
  items?: Array<Record<string, unknown>>;
}

export interface FinanceRecoveryRecord {
  id: string;
  orderType: FinanceOrderType;
  orderId: string;
  reference: string;
  action: FinanceRecoveryAction;
  status: string;
  reason: string;
  outcome: Record<string, unknown>;
  requestedBy: string;
  requestedAt: string;
  processedAt?: string | null;
}

export interface FinanceCurrencyPerformance {
  currency: string;
  grossAmountMinor: number;
  discountAmountMinor: number;
  paidAmountMinor: number;
  transactions: number;
}

export interface FinanceProgrammePerformance {
  programmeCode: string;
  programmeName: string;
  currency: string;
  paidAmountMinor: number;
  discountAmountMinor: number;
  orders: number;
}

export interface FinanceExaminationPerformance {
  examinationId: string;
  examinationTitle: string;
  programmeCode: string;
  currency: string;
  paidAmountMinor: number;
  discountAmountMinor: number;
  orders: number;
}

export interface FinanceCouponPerformance {
  couponCode: string;
  redemptions: number;
  discountAmountMinor: number;
  maximumRedemptions?: number | null;
  remainingRedemptions?: number | null;
}

export interface FinanceTimePerformance {
  date?: string;
  month?: string;
  week?: string;
  currency: string;
  paidAmountMinor: number;
  discountAmountMinor: number;
  orders: number;
}

export interface FinanceDashboard {
  individualOrders: number;
  bulkOrders: number;
  failedTransactions: number;
  unfulfilledOrders: number;
  revenueByCurrency: FinanceCurrencyPerformance[];
  revenueByProgramme: FinanceProgrammePerformance[];
  revenueByExamination: FinanceExaminationPerformance[];
  couponPerformance: FinanceCouponPerformance[];
  dailyPerformance: FinanceTimePerformance[];
  weeklyPerformance: FinanceTimePerformance[];
  monthlyPerformance: FinanceTimePerformance[];
}

export interface FinanceCompletionSnapshot {
  generatedAt: string;
  from: string;
  to: string;
  access: FinanceCompletionAccess;
  settings: FinanceGeneralSettings;
  taxProfiles: FinanceTaxProfile[];
  pricingPolicies: FinanceExamPricingPolicy[];
  candidates: FinanceCandidate[];
  accessGrants: FinanceExamAccessGrant[];
  couponPolicies: FinanceCouponPolicy[];
  couponTargets: FinanceCouponTarget[];
  couponUsage: FinanceCouponUsage[];
  transactions: FinanceUnifiedTransaction[];
  recoveryActions: FinanceRecoveryRecord[];
  dashboard: FinanceDashboard;
}

export interface FinanceReceiptPayload {
  receiptNumber: string;
  orderType: FinanceOrderType;
  orderId: string;
  reference: string;
  candidateName: string;
  candidateEmail: string;
  programmeCode?: string;
  programmeName?: string;
  examinationTitle?: string;
  itemCount?: number;
  currency: string;
  grossAmountMinor: number;
  discountAmountMinor: number;
  amountPaidMinor: number;
  couponCode?: string | null;
  status: string;
  paidAt?: string | null;
  fulfilledAt?: string | null;
  issuedAt: string;
  items?: Array<Record<string, unknown>>;
}

const emptyDashboard: FinanceDashboard = {
  individualOrders: 0,
  bulkOrders: 0,
  failedTransactions: 0,
  unfulfilledOrders: 0,
  revenueByCurrency: [],
  revenueByProgramme: [],
  revenueByExamination: [],
  couponPerformance: [],
  dailyPerformance: [],
  weeklyPerformance: [],
  monthlyPerformance: [],
};

export async function getFinanceCompletionSnapshot(input?: {
  limit?: number;
  from?: string;
  to?: string;
}): Promise<FinanceCompletionSnapshot> {
  const { data, error } = await supabase.rpc('get_finance_console_completion_snapshot', {
    p_limit: input?.limit || 500,
    p_from: input?.from || null,
    p_to: input?.to || null,
  });
  if (error) throw new Error(error.message);
  if (!data || typeof data !== 'object') throw new Error('Finance completion data was not returned.');
  const raw = data as Partial<FinanceCompletionSnapshot>;
  let gatewayStatus: Partial<FinanceGeneralSettings> = {};
  try {
    const { data: gatewayData } = await supabase.functions.invoke('finance-gateway-status');
    if (gatewayData && typeof gatewayData === 'object') {
      gatewayStatus = gatewayData as Partial<FinanceGeneralSettings>;
    }
  } catch (gatewayError) {
    console.warn('Unable to load server-side gateway status:', gatewayError);
  }
  return {
    generatedAt: raw.generatedAt || new Date().toISOString(),
    from: raw.from || input?.from || '',
    to: raw.to || input?.to || '',
    access: (raw.access || {}) as FinanceCompletionAccess,
    settings: { ...((raw.settings || {}) as FinanceGeneralSettings), ...gatewayStatus },
    taxProfiles: Array.isArray(raw.taxProfiles) ? raw.taxProfiles : [],
    pricingPolicies: Array.isArray(raw.pricingPolicies) ? raw.pricingPolicies : [],
    candidates: Array.isArray(raw.candidates) ? raw.candidates : [],
    accessGrants: Array.isArray(raw.accessGrants) ? raw.accessGrants : [],
    couponPolicies: Array.isArray(raw.couponPolicies) ? raw.couponPolicies : [],
    couponTargets: Array.isArray(raw.couponTargets) ? raw.couponTargets : [],
    couponUsage: Array.isArray(raw.couponUsage) ? raw.couponUsage : [],
    transactions: Array.isArray(raw.transactions) ? raw.transactions : [],
    recoveryActions: Array.isArray(raw.recoveryActions) ? raw.recoveryActions : [],
    dashboard: { ...emptyDashboard, ...(raw.dashboard || {}) },
  };
}

export async function saveAdvancedExamPricing(input: {
  examinationId: string;
  currency: string;
  standardAmountMinor: number;
  promotionalAmountMinor?: number | null;
  promotionName?: string | null;
  promotionStartsAt?: string | null;
  promotionEndsAt?: string | null;
  accessMode: FinanceAccessMode;
  attemptsIncluded: number;
  retakeAmountMinor?: number | null;
  bulkCartEligible: boolean;
  isActive: boolean;
  changeReason: string;
}): Promise<void> {
  const { error } = await supabase.rpc('finance_upsert_exam_pricing_policy', {
    p_examination_id: input.examinationId,
    p_currency: input.currency.trim().toUpperCase(),
    p_standard_amount_minor: input.standardAmountMinor,
    p_promotional_amount_minor: input.promotionalAmountMinor ?? null,
    p_promotion_name: input.promotionName?.trim() || null,
    p_promotion_starts_at: input.promotionStartsAt || null,
    p_promotion_ends_at: input.promotionEndsAt || null,
    p_access_mode: input.accessMode,
    p_attempts_included: input.attemptsIncluded,
    p_retake_amount_minor: input.retakeAmountMinor ?? null,
    p_bulk_cart_eligible: input.bulkCartEligible,
    p_is_active: input.isActive,
    p_change_reason: input.changeReason.trim(),
  });
  if (error) throw new Error(error.message);
}

export async function saveExamAccessGrant(input: {
  grantId?: string | null;
  candidateId: string;
  examinationId: string;
  accessMode: 'scholarship' | 'invitation_only';
  grantCode?: string | null;
  validFrom?: string | null;
  validTo?: string | null;
  status: 'active' | 'used' | 'revoked' | 'expired';
  reason: string;
}): Promise<void> {
  const { error } = await supabase.rpc('finance_upsert_exam_access_grant', {
    p_grant_id: input.grantId || null,
    p_candidate_id: input.candidateId,
    p_examination_id: input.examinationId,
    p_access_mode: input.accessMode,
    p_grant_code: input.grantCode?.trim() || null,
    p_valid_from: input.validFrom || new Date().toISOString(),
    p_valid_to: input.validTo || null,
    p_status: input.status,
    p_reason: input.reason.trim(),
  });
  if (error) throw new Error(error.message);
}

export async function saveAdvancedCoupon(input: {
  couponId?: string | null;
  code: string;
  name?: string;
  description?: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  currency?: string | null;
  programmeIds: string[];
  examinationIds: string[];
  minimumAmountMinor: number;
  minimumModuleCount: number;
  allowMultiModuleCart: boolean;
  maximumDiscountMinor?: number | null;
  startsAt?: string | null;
  expiresAt?: string | null;
  maximumRedemptions?: number | null;
  perCandidateLimit: number;
  isActive: boolean;
  changeReason: string;
}): Promise<void> {
  const { error } = await supabase.rpc('finance_upsert_coupon_advanced', {
    p_coupon_id: input.couponId || null,
    p_code: input.code.trim().toUpperCase(),
    p_name: input.name?.trim() || null,
    p_description: input.description?.trim() || null,
    p_discount_type: input.discountType,
    p_discount_value: input.discountValue,
    p_currency: input.currency?.trim().toUpperCase() || null,
    p_programme_ids: input.programmeIds,
    p_examination_ids: input.examinationIds,
    p_minimum_amount_minor: input.minimumAmountMinor,
    p_minimum_module_count: input.minimumModuleCount,
    p_allow_multi_module_cart: input.allowMultiModuleCart,
    p_maximum_discount_minor: input.maximumDiscountMinor ?? null,
    p_starts_at: input.startsAt || null,
    p_expires_at: input.expiresAt || null,
    p_maximum_redemptions: input.maximumRedemptions ?? null,
    p_per_candidate_limit: input.perCandidateLimit,
    p_is_active: input.isActive,
    p_change_reason: input.changeReason.trim(),
  });
  if (error) throw new Error(error.message);
}

export async function setAdvancedCouponActive(input: {
  couponId: string;
  isActive: boolean;
  changeReason: string;
}): Promise<void> {
  const { error } = await supabase.rpc('finance_set_coupon_active_audited', {
    p_coupon_id: input.couponId,
    p_is_active: input.isActive,
    p_change_reason: input.changeReason.trim(),
  });
  if (error) throw new Error(error.message);
}

export async function saveGeneralFinanceSettings(
  settings: FinanceGeneralSettings,
  changeReason: string,
): Promise<void> {
  const { error } = await supabase.rpc('finance_upsert_general_settings', {
    p_default_currency: settings.defaultCurrency,
    p_supported_currencies: settings.supportedCurrencies,
    p_paystack_enabled: settings.paystackEnabled,
    p_paystack_environment: settings.paystackEnvironment,
    p_paystack_status_note: settings.paystackStatusNote || null,
    p_tax_enabled: settings.taxEnabled,
    p_tax_label: settings.taxLabel,
    p_default_tax_profile_id: settings.defaultTaxProfileId || null,
    p_receipt_prefix: settings.receiptPrefix,
    p_payment_reference_prefix: settings.paymentReferencePrefix,
    p_payment_expiry_minutes: settings.paymentExpiryMinutes,
    p_abandoned_order_hours: settings.abandonedOrderHours,
    p_refunds_enabled: settings.refundsEnabled,
    p_reversals_enabled: settings.reversalsEnabled,
    p_manual_payment_approval_enabled: settings.manualPaymentApprovalEnabled,
    p_bank_transfer_instructions: settings.bankTransferInstructions || null,
    p_minimum_transaction_minor: settings.minimumTransactionMinor,
    p_maximum_transaction_minor: settings.maximumTransactionMinor ?? null,
    p_allow_partial_payments: settings.allowPartialPayments,
    p_allow_overpayments: settings.allowOverpayments,
    p_change_reason: changeReason.trim(),
  });
  if (error) throw new Error(error.message);
}

export async function processAbandonedOrders(): Promise<void> {
  const { error } = await supabase.rpc('finance_mark_abandoned_orders');
  if (error) throw new Error(error.message);
}

export async function queueRecoveryAction(input: {
  orderType: FinanceOrderType;
  orderId: string;
  action: FinanceRecoveryAction;
  reason: string;
}): Promise<void> {
  const { error } = await supabase.rpc('finance_queue_recovery_action', {
    p_order_type: input.orderType,
    p_order_id: input.orderId,
    p_action: input.action,
    p_reason: input.reason.trim(),
  });
  if (error) throw new Error(error.message);
}

export async function recoverPaidAccess(input: {
  orderType: FinanceOrderType;
  orderId: string;
  reason: string;
}): Promise<Record<string, unknown>> {
  const functionName = input.orderType === 'bulk'
    ? 'finance_recover_paid_bulk_order'
    : 'finance_recover_paid_exam_order';
  const args = input.orderType === 'bulk'
    ? { p_bulk_order_id: input.orderId, p_reason: input.reason.trim() }
    : { p_order_id: input.orderId, p_reason: input.reason.trim() };
  const { data, error } = await supabase.rpc(functionName, args);
  if (error) throw new Error(error.message);
  return (data || {}) as Record<string, unknown>;
}

export async function verifyFinancePayment(reference: string): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.functions.invoke('admin-verify-exam-payment', {
    body: { reference: reference.trim() },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(String(data.error));
  return (data || {}) as Record<string, unknown>;
}

export async function getFinanceReceipt(
  orderType: FinanceOrderType,
  orderId: string,
): Promise<FinanceReceiptPayload> {
  const { data, error } = await supabase.rpc('finance_get_receipt_payload', {
    p_order_type: orderType,
    p_order_id: orderId,
  });
  if (error) throw new Error(error.message);
  if (!data || typeof data !== 'object') throw new Error('Receipt data was not returned.');
  return data as FinanceReceiptPayload;
}

export async function recordFinanceExport(
  exportType: string,
  rowCount: number,
  filters: Record<string, unknown> = {},
): Promise<void> {
  const { error } = await supabase.rpc('finance_record_export', {
    p_export_type: exportType,
    p_row_count: rowCount,
    p_filters: filters,
  });
  if (error) throw new Error(error.message);
}

export async function setFinancePermission(input: {
  permissionKey: string;
  isGranted: boolean;
  reason: string;
}): Promise<void> {
  const { error } = await supabase.rpc('admin_set_finance_role_permission', {
    p_role: 'exam_admin',
    p_permission_key: input.permissionKey,
    p_is_granted: input.isGranted,
    p_reason: input.reason.trim(),
  });
  if (error) throw new Error(error.message);
}

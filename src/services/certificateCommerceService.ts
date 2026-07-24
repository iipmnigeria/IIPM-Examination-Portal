import { supabase } from '../lib/supabase';

export type CertificateProductCode = 'achievement' | 'professional';
export type CertificateCommerceCurrency = 'NGN' | 'USD';
export type CertificatePricingWindow = 'early' | 'standard' | 'waived';

export interface CertificateCommerceOffer {
  eligibilityId: string;
  attemptId: string;
  examinationId: string;
  examinationTitle: string;
  programmeCode: string | null;
  score: number;
  passMark: number;
  integrityStatus: string;
  eligibilityStatus: string;
  passedAt: string;
  earlyPriceExpiresAt: string;
  productCode: CertificateProductCode;
  productTitle: string;
  productDescription: string;
  currency: CertificateCommerceCurrency;
  earlyAmountMinor: number;
  standardAmountMinor: number;
  payableAmountMinor: number;
  pricingWindow: 'early' | 'standard';
  checkoutAvailable: boolean;
  blockedReason: string | null;
  requiresIdentityVerification: boolean;
  includesBadge: boolean;
  includesTranscript: boolean;
  benefits: string[];
}

export interface CertificateCommerceOrder {
  orderId: string;
  reference: string;
  eligibilityId: string;
  productCode: CertificateProductCode;
  productTitle?: string;
  currency: CertificateCommerceCurrency;
  pricingWindow: CertificatePricingWindow;
  listAmountMinor: number;
  discountAmountMinor: number;
  payableAmountMinor: number;
  status: string;
  paymentProvider?: string;
  authorizationUrl?: string | null;
  accessCode?: string | null;
  expiresAt?: string | null;
  paidAt?: string | null;
  fulfilledAt?: string | null;
  createdAt?: string;
  paymentRequired?: boolean;
  alreadyPaid?: boolean;
  alreadyFulfilled?: boolean;
  certificateId?: string;
  certificateNumber?: string;
  verificationCode?: string;
  credentialId?: string;
  credentialCode?: string;
  badgeCode?: string;
  transcriptCode?: string | null;
  verificationUrl?: string;
}

export interface CertificateCommerceCredential {
  id: string;
  orderId: string;
  certificateId: string;
  productCode: CertificateProductCode;
  productTitle: string;
  credentialCode: string;
  badgeCode: string;
  transcriptCode: string | null;
  verificationUrl: string;
  linkedinCredentialName: string;
  status: 'active' | 'suspended' | 'revoked';
  issuedAt: string;
  certificate: {
    id: string;
    certificateNumber: string;
    verificationCode: string;
    holderName: string;
    certificateTitle: string;
    examinationTitle: string;
    programmeCode: string | null;
    score: number;
    passMark: number;
    issueDate: string;
    issuedAt: string;
    status: 'active' | 'suspended' | 'revoked';
  };
}

export interface CandidateCertificateCommerce {
  marketCurrency: CertificateCommerceCurrency;
  offers: CertificateCommerceOffer[];
  orders: CertificateCommerceOrder[];
  credentials: CertificateCommerceCredential[];
  counts: {
    offers: number;
    pendingOrders: number;
    paidOrders: number;
    credentials: number;
  };
}

export interface AdminCertificatePrice {
  productCode: CertificateProductCode;
  productTitle: string;
  currency: CertificateCommerceCurrency;
  earlyAmountMinor: number;
  standardAmountMinor: number;
  active: boolean;
  requiresIdentityVerification: boolean;
  updatedAt: string;
}

export interface AdminCertificateOrder extends CertificateCommerceOrder {
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  examinationTitle: string;
  waivedAt?: string | null;
  waiverReason?: string | null;
}

export interface AdminPaidCredential {
  id: string;
  orderId: string;
  certificateId: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  productCode: CertificateProductCode;
  credentialCode: string;
  badgeCode: string;
  transcriptCode: string | null;
  verificationUrl: string;
  status: string;
  issuedAt: string;
  certificateNumber: string;
  verificationCode: string;
  examinationTitle: string;
}

export interface CertificateCommerceAudit {
  id: string;
  actorId: string | null;
  candidateId: string | null;
  orderId: string | null;
  action: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AdminCertificateCommerceConsole {
  prices: AdminCertificatePrice[];
  orders: AdminCertificateOrder[];
  credentials: AdminPaidCredential[];
  audits: CertificateCommerceAudit[];
  counts: {
    pendingOrders: number;
    paidOrders: number;
    waivedOrders: number;
    credentials: number;
  };
}

const emptyCandidateCommerce: CandidateCertificateCommerce = {
  marketCurrency: 'USD',
  offers: [],
  orders: [],
  credentials: [],
  counts: { offers: 0, pendingOrders: 0, paidOrders: 0, credentials: 0 },
};

const emptyAdminCommerce: AdminCertificateCommerceConsole = {
  prices: [],
  orders: [],
  credentials: [],
  audits: [],
  counts: { pendingOrders: 0, paidOrders: 0, waivedOrders: 0, credentials: 0 },
};

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
        // Use the regular function error below.
      }
    }
  }
  return error?.message || fallback;
}

export function formatCertificateMoney(
  amountMinor: number,
  currency: CertificateCommerceCurrency,
): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'NGN' ? 0 : 2,
  }).format(Number(amountMinor || 0) / 100);
}

export async function getMyCertificateCommerce(): Promise<CandidateCertificateCommerce> {
  const { data, error } = await supabase.rpc('get_my_agilecert_certificate_commerce');
  if (error) throw new Error(`Unable to load certificate commerce: ${error.message}`);
  if (!data || typeof data !== 'object') return emptyCandidateCommerce;

  const payload = data as Partial<CandidateCertificateCommerce>;
  return {
    marketCurrency: payload.marketCurrency === 'NGN' ? 'NGN' : 'USD',
    offers: Array.isArray(payload.offers) ? payload.offers : [],
    orders: Array.isArray(payload.orders) ? payload.orders : [],
    credentials: Array.isArray(payload.credentials) ? payload.credentials : [],
    counts: { ...emptyCandidateCommerce.counts, ...(payload.counts || {}) },
  };
}

export async function initializeCertificatePayment(input: {
  eligibilityId: string;
  productCode: CertificateProductCode;
  currency: CertificateCommerceCurrency;
}): Promise<CertificateCommerceOrder> {
  const { data, error } = await supabase.functions.invoke('initialize-certificate-payment', {
    body: {
      eligibilityId: input.eligibilityId,
      productCode: input.productCode,
      currency: input.currency,
    },
  });

  if (error) {
    throw new Error(
      await functionErrorMessage(error, 'The secure certificate checkout could not be initialized.'),
    );
  }
  if (!data || typeof data !== 'object') {
    throw new Error('The certificate payment order was not returned.');
  }

  const order = data as CertificateCommerceOrder;
  if (order.reference) {
    sessionStorage.setItem('agilecert_pending_certificate_reference', order.reference);
  }
  if (order.authorizationUrl) {
    window.location.assign(order.authorizationUrl);
  }
  return order;
}

export async function verifyCertificatePayment(
  reference: string,
): Promise<CertificateCommerceOrder & { verified?: boolean }> {
  const cleanReference = reference.trim();
  if (!cleanReference) throw new Error('The certificate payment reference is missing.');

  const { data, error } = await supabase.functions.invoke('verify-certificate-payment', {
    body: { reference: cleanReference },
  });

  if (error) {
    throw new Error(
      await functionErrorMessage(error, 'The certificate payment could not be verified.'),
    );
  }
  if (!data || typeof data !== 'object') {
    throw new Error('The certificate payment verification result was not returned.');
  }
  return data as CertificateCommerceOrder & { verified?: boolean };
}

export async function getCertificateCommerceAdminConsole(
  limit = 100,
): Promise<AdminCertificateCommerceConsole> {
  const { data, error } = await supabase.rpc('get_agilecert_certificate_commerce_admin_console', {
    p_limit: limit,
  });
  if (error) throw new Error(`Unable to load certificate commerce administration: ${error.message}`);
  if (!data || typeof data !== 'object') return emptyAdminCommerce;

  const payload = data as Partial<AdminCertificateCommerceConsole>;
  return {
    prices: Array.isArray(payload.prices) ? payload.prices : [],
    orders: Array.isArray(payload.orders) ? payload.orders : [],
    credentials: Array.isArray(payload.credentials) ? payload.credentials : [],
    audits: Array.isArray(payload.audits) ? payload.audits : [],
    counts: { ...emptyAdminCommerce.counts, ...(payload.counts || {}) },
  };
}

export async function updateCertificateProductPrice(input: {
  productCode: CertificateProductCode;
  currency: CertificateCommerceCurrency;
  earlyAmountMinor: number;
  standardAmountMinor: number;
  active: boolean;
}): Promise<AdminCertificatePrice> {
  const { data, error } = await supabase.rpc('upsert_agilecert_certificate_product_price', {
    p_product_code: input.productCode,
    p_currency: input.currency,
    p_early_amount_minor: input.earlyAmountMinor,
    p_standard_amount_minor: input.standardAmountMinor,
    p_active: input.active,
  });
  if (error) throw new Error(error.message);
  if (!data || typeof data !== 'object') throw new Error('The certificate price update was not returned.');
  return data as AdminCertificatePrice;
}

export async function waiveCertificateOrder(input: {
  eligibilityId: string;
  productCode: CertificateProductCode;
  currency?: CertificateCommerceCurrency;
  reason: string;
}): Promise<CertificateCommerceOrder> {
  const { data, error } = await supabase.rpc('waive_agilecert_certificate_order', {
    p_eligibility_id: input.eligibilityId,
    p_product_code: input.productCode,
    p_currency: input.currency || null,
    p_reason: input.reason.trim(),
  });
  if (error) throw new Error(error.message);
  if (!data || typeof data !== 'object') throw new Error('The certificate waiver result was not returned.');
  return data as CertificateCommerceOrder;
}

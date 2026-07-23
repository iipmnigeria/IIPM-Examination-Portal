import { supabase } from '../lib/supabase';
import type {
  AgileCertCertificateProductCode,
  AgileCertCurrency,
} from '../config/agileCert';

export interface AgileCertCertificateOrder {
  orderId?: string;
  reference?: string;
  eligibilityId?: string;
  productCode?: AgileCertCertificateProductCode;
  productLabel?: string;
  currency?: AgileCertCurrency;
  pricingWindow?: 'early' | 'standard' | 'waived';
  listAmountMinor?: number;
  discountAmountMinor?: number;
  payableAmountMinor?: number;
  status: string;
  paymentRequired?: boolean;
  authorizationUrl?: string | null;
  accessCode?: string | null;
  expiresAt?: string | null;
  credentialId?: string | null;
  credentialCode?: string | null;
  verificationSlug?: string | null;
  alreadyPaid?: boolean;
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
        // Use the normal function error below.
      }
    }
  }

  return error?.message || fallback;
}

export async function initializeAgileCertCertificatePayment(input: {
  eligibilityId: string;
  productCode: AgileCertCertificateProductCode;
  currency: AgileCertCurrency;
}): Promise<AgileCertCertificateOrder> {
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

  const order = data as AgileCertCertificateOrder;

  if (order.reference) {
    sessionStorage.setItem('agilecert_pending_certificate_reference', order.reference);
  }

  if (order.authorizationUrl) {
    window.location.assign(order.authorizationUrl);
  }

  return order;
}

export async function verifyAgileCertCertificatePayment(
  reference: string,
): Promise<AgileCertCertificateOrder & { verified?: boolean }> {
  const cleanReference = reference.trim();
  if (!cleanReference) throw new Error('The certificate payment reference is missing.');

  const { data, error } = await supabase.functions.invoke('verify-certificate-payment', {
    body: { reference: cleanReference },
  });

  if (error) {
    throw new Error(
      await functionErrorMessage(error, 'The AgileCert certificate payment could not be verified.'),
    );
  }
  if (!data || typeof data !== 'object') {
    throw new Error('The certificate payment verification result was not returned.');
  }

  return data as AgileCertCertificateOrder & { verified?: boolean };
}

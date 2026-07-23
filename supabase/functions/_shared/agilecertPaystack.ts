const PAYSTACK_API_BASE = 'https://api.paystack.co';

export interface AgileCertPaystackTransactionData {
  id?: number | string;
  status?: string;
  reference?: string;
  amount?: number;
  requested_amount?: number;
  currency?: string;
  authorization_url?: string;
  access_code?: string;
  metadata?: Record<string, unknown> | string | null;
  customer?: {
    email?: string;
  };
  [key: string]: unknown;
}

interface PaystackResponse {
  status: boolean;
  message: string;
  data?: AgileCertPaystackTransactionData;
}

export function agileCertPaystackSecretKey(): string {
  const value = Deno.env.get('AGILECERT_PAYSTACK_SECRET_KEY')?.trim();
  if (!value) throw new Error('AGILECERT_PAYSTACK_SECRET_KEY is not configured.');
  return value;
}

export function agileCertPaystackRequestedAmount(
  transaction: AgileCertPaystackTransactionData,
): number {
  const requestedAmount = Number(transaction.requested_amount);
  if (Number.isSafeInteger(requestedAmount) && requestedAmount >= 0) {
    return requestedAmount;
  }

  return Number(transaction.amount);
}

export async function agileCertPaystackRequest(
  path: string,
  init: RequestInit = {},
): Promise<PaystackResponse> {
  const response = await fetch(`${PAYSTACK_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${agileCertPaystackSecretKey()}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });

  let payload: PaystackResponse;
  try {
    payload = (await response.json()) as PaystackResponse;
  } catch {
    throw new Error(`AgileCert Paystack returned an unreadable response (${response.status}).`);
  }

  if (!response.ok || !payload.status) {
    throw new Error(payload.message || `AgileCert Paystack request failed (${response.status}).`);
  }

  return payload;
}

export async function verifyAgileCertPaystackTransaction(
  reference: string,
): Promise<AgileCertPaystackTransactionData> {
  const payload = await agileCertPaystackRequest(
    `/transaction/verify/${encodeURIComponent(reference)}`,
    { method: 'GET' },
  );

  if (!payload.data) throw new Error('AgileCert Paystack did not return transaction details.');
  return payload.data;
}

function bytesToHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return result === 0;
}

export async function verifyAgileCertPaystackWebhookSignature(
  rawBody: string,
  suppliedSignature: string,
): Promise<boolean> {
  if (!suppliedSignature) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(agileCertPaystackSecretKey()),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign'],
  );

  const digest = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(rawBody),
  );

  return constantTimeEqual(bytesToHex(digest), suppliedSignature.toLowerCase());
}

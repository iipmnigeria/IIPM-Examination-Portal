const PAYSTACK_API_BASE = 'https://api.paystack.co';

export interface PaystackTransactionData {
  id?: number | string;
  status?: string;
  reference?: string;
  amount?: number;
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
  data?: PaystackTransactionData;
}

export function paystackSecretKey(): string {
  const value = Deno.env.get('PAYSTACK_SECRET_KEY')?.trim();
  if (!value) throw new Error('PAYSTACK_SECRET_KEY is not configured.');
  return value;
}

export async function paystackRequest(
  path: string,
  init: RequestInit = {},
): Promise<PaystackResponse> {
  const response = await fetch(`${PAYSTACK_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${paystackSecretKey()}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });

  let payload: PaystackResponse;
  try {
    payload = (await response.json()) as PaystackResponse;
  } catch {
    throw new Error(`Paystack returned an unreadable response (${response.status}).`);
  }

  if (!response.ok || !payload.status) {
    throw new Error(payload.message || `Paystack request failed (${response.status}).`);
  }

  return payload;
}

export async function verifyPaystackTransaction(
  reference: string,
): Promise<PaystackTransactionData> {
  const payload = await paystackRequest(
    `/transaction/verify/${encodeURIComponent(reference)}`,
    { method: 'GET' },
  );

  if (!payload.data) throw new Error('Paystack did not return transaction details.');
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

export async function verifyPaystackWebhookSignature(
  rawBody: string,
  suppliedSignature: string,
): Promise<boolean> {
  if (!suppliedSignature) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(paystackSecretKey()),
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

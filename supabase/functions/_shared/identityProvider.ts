export type AgileCertIdentityProviderInput = {
  requestId: string;
  requestReference: string;
  candidateId: string;
  legalName: string;
  documentType: string;
  issuingCountryCode: string;
  documentNumberLast4: string | null;
  documentUrl: string;
  selfieUrl: string;
};

export type AgileCertIdentityProviderResult = {
  status: 'processing' | 'verified' | 'rejected';
  provider: string;
  providerReference: string | null;
  documentAuthenticityScore: number | null;
  identityMatchScore: number | null;
  expiresAt: string | null;
  rejectionReason: string | null;
  raw: Record<string, unknown>;
};

function optionalEnvironment(name: string): string {
  return Deno.env.get(name)?.trim() || '';
}

function numericScore(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const score = Number(value);
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    throw new Error('The identity provider returned an invalid verification score.');
  }
  return score;
}

export function agileCertIdentityProviderConfigured(): boolean {
  return Boolean(
    optionalEnvironment('AGILECERT_IDENTITY_PROVIDER_URL') &&
      optionalEnvironment('AGILECERT_IDENTITY_PROVIDER_API_KEY'),
  );
}

export async function verifyAgileCertIdentity(
  input: AgileCertIdentityProviderInput,
): Promise<AgileCertIdentityProviderResult | null> {
  const endpoint = optionalEnvironment('AGILECERT_IDENTITY_PROVIDER_URL');
  const apiKey = optionalEnvironment('AGILECERT_IDENTITY_PROVIDER_API_KEY');
  const providerName = optionalEnvironment('AGILECERT_IDENTITY_PROVIDER_NAME') || 'configured_provider';

  if (!endpoint || !apiKey) return null;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `agilecert-identity-${input.requestId}`,
    },
    body: JSON.stringify({
      requestId: input.requestId,
      requestReference: input.requestReference,
      candidateId: input.candidateId,
      legalName: input.legalName,
      documentType: input.documentType,
      issuingCountryCode: input.issuingCountryCode,
      documentNumberLast4: input.documentNumberLast4,
      documentUrl: input.documentUrl,
      selfieUrl: input.selfieUrl,
      callbackMetadata: {
        platform: 'AgileCert Global',
        poweredBy: 'IIPM',
      },
    }),
  });

  let payload: Record<string, unknown> = {};
  try {
    payload = (await response.json()) as Record<string, unknown>;
  } catch {
    // The HTTP status below remains authoritative.
  }

  if (!response.ok) {
    throw new Error(
      String(payload.message || payload.error || `Identity provider returned ${response.status}.`),
    );
  }

  const status = String(payload.status || '').trim().toLowerCase();
  if (!['processing', 'verified', 'rejected'].includes(status)) {
    throw new Error('The identity provider returned an unsupported decision status.');
  }

  return {
    status: status as AgileCertIdentityProviderResult['status'],
    provider: String(payload.provider || providerName).trim() || providerName,
    providerReference: String(payload.providerReference || payload.reference || '').trim() || null,
    documentAuthenticityScore: numericScore(
      payload.documentAuthenticityScore ?? payload.document_score,
    ),
    identityMatchScore: numericScore(payload.identityMatchScore ?? payload.face_match_score),
    expiresAt: String(payload.expiresAt || '').trim() || null,
    rejectionReason: String(payload.rejectionReason || payload.reason || '').trim() || null,
    raw: payload,
  };
}

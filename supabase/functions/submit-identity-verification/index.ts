import { jsonResponse, preflightResponse } from '../_shared/http.ts';
import {
  agileCertIdentityProviderConfigured,
  verifyAgileCertIdentity,
} from '../_shared/identityProvider.ts';
import { adminClient, requireAuthenticatedUser, userClient } from '../_shared/supabase.ts';

type SubmitIdentityRequest = {
  requestId?: string;
  documentPath?: string;
  selfiePath?: string;
};

type IdentityRequestRecord = {
  id: string;
  request_reference: string;
  candidate_id: string;
  document_type: string;
  issuing_country_code: string;
  document_number_last4: string | null;
  document_storage_path: string | null;
  selfie_storage_path: string | null;
  status: string;
};

type CandidateProfile = {
  legal_name: string | null;
};

async function objectExists(
  admin: ReturnType<typeof adminClient>,
  storagePath: string,
): Promise<boolean> {
  const segments = storagePath.split('/').filter(Boolean);
  const filename = segments.pop();
  const folder = segments.join('/');
  if (!filename || !folder) return false;

  const { data, error } = await admin.storage
    .from('agilecert-identity-documents')
    .list(folder, { limit: 20, search: filename });

  if (error) throw new Error(error.message);
  return Boolean(data?.some((object) => object.name === filename));
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return preflightResponse(request);
  if (request.method !== 'POST') {
    return jsonResponse(request, { error: 'Method not allowed.' }, 405);
  }

  try {
    const user = await requireAuthenticatedUser(request);
    const body = (await request.json()) as SubmitIdentityRequest;
    const requestId = String(body.requestId || '').trim();
    const documentPath = String(body.documentPath || '').trim();
    const selfiePath = String(body.selfiePath || '').trim();

    if (!requestId || !documentPath || !selfiePath) {
      return jsonResponse(
        request,
        { error: 'Identity request, government document and selfie paths are required.' },
        400,
      );
    }

    const expectedPrefix = `${user.id}/${requestId}/`;
    if (!documentPath.startsWith(expectedPrefix) || !selfiePath.startsWith(expectedPrefix)) {
      return jsonResponse(request, { error: 'The identity file paths are invalid.' }, 403);
    }

    const admin = adminClient();
    const [documentExists, selfieExists] = await Promise.all([
      objectExists(admin, documentPath),
      objectExists(admin, selfiePath),
    ]);

    if (!documentExists || !selfieExists) {
      return jsonResponse(
        request,
        { error: 'Both the government identity document and the identity selfie must be uploaded.' },
        400,
      );
    }

    const candidate = userClient(request);
    const { data: submittedData, error: submitError } = await candidate.rpc(
      'submit_my_agilecert_identity_request',
      {
        p_request_id: requestId,
        p_document_storage_path: documentPath,
        p_selfie_storage_path: selfiePath,
      },
    );

    if (submitError) throw new Error(submitError.message);
    if (!submittedData || typeof submittedData !== 'object') {
      throw new Error('The identity-verification request was not submitted.');
    }

    const identityRequest = submittedData as IdentityRequestRecord;
    if (identityRequest.candidate_id !== user.id) {
      throw new Error('The identity-verification request does not belong to the signed-in candidate.');
    }

    if (!agileCertIdentityProviderConfigured()) {
      return jsonResponse(request, {
        requestId: identityRequest.id,
        requestReference: identityRequest.request_reference,
        status: identityRequest.status,
        providerConfigured: false,
        message: 'Identity documents were submitted securely and are pending exception review.',
      });
    }

    const [{ data: profileData, error: profileError }, documentSigned, selfieSigned] = await Promise.all([
      admin
        .from('agilecert_candidate_profiles')
        .select('legal_name')
        .eq('user_id', user.id)
        .single(),
      admin.storage
        .from('agilecert-identity-documents')
        .createSignedUrl(documentPath, 600),
      admin.storage
        .from('agilecert-identity-documents')
        .createSignedUrl(selfiePath, 600),
    ]);

    if (profileError) throw new Error(profileError.message);
    if (documentSigned.error) throw new Error(documentSigned.error.message);
    if (selfieSigned.error) throw new Error(selfieSigned.error.message);
    if (!documentSigned.data?.signedUrl || !selfieSigned.data?.signedUrl) {
      throw new Error('Temporary identity-provider document URLs could not be created.');
    }

    const profile = profileData as CandidateProfile;
    const providerResult = await verifyAgileCertIdentity({
      requestId: identityRequest.id,
      requestReference: identityRequest.request_reference,
      candidateId: user.id,
      legalName: String(profile.legal_name || '').trim(),
      documentType: identityRequest.document_type,
      issuingCountryCode: identityRequest.issuing_country_code,
      documentNumberLast4: identityRequest.document_number_last4,
      documentUrl: documentSigned.data.signedUrl,
      selfieUrl: selfieSigned.data.signedUrl,
    });

    if (!providerResult) {
      throw new Error('The configured identity provider did not return a verification result.');
    }

    const { data: decisionData, error: decisionError } = await admin.rpc(
      'record_agilecert_identity_provider_decision',
      {
        p_request_id: identityRequest.id,
        p_decision: providerResult.status,
        p_provider: providerResult.provider,
        p_provider_reference: providerResult.providerReference,
        p_rejection_reason: providerResult.rejectionReason,
        p_expires_at: providerResult.expiresAt,
        p_document_authenticity_score: providerResult.documentAuthenticityScore,
        p_identity_match_score: providerResult.identityMatchScore,
        p_provider_payload: providerResult.raw,
      },
    );

    if (decisionError) throw new Error(decisionError.message);
    const decision = (decisionData || {}) as Record<string, unknown>;

    return jsonResponse(request, {
      requestId: identityRequest.id,
      requestReference: identityRequest.request_reference,
      status: decision.status || providerResult.status,
      providerConfigured: true,
      provider: providerResult.provider,
      documentAuthenticityScore: providerResult.documentAuthenticityScore,
      identityMatchScore: providerResult.identityMatchScore,
      rejectionReason: providerResult.rejectionReason,
      message: providerResult.status === 'verified'
        ? 'Identity verification completed successfully.'
        : providerResult.status === 'rejected'
          ? 'Identity verification could not be approved.'
          : 'Identity verification is still processing.',
    });
  } catch (error) {
    console.error('submit-identity-verification failed:', error);
    const message = error instanceof Error ? error.message : 'Identity verification submission failed.';
    return jsonResponse(request, { error: message }, 400);
  }
});

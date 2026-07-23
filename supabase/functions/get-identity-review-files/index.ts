import { jsonResponse, preflightResponse } from '../_shared/http.ts';
import { adminClient, requireAuthenticatedUser } from '../_shared/supabase.ts';

type ReviewFilesRequest = {
  requestId?: string;
};

type IdentityRequest = {
  id: string;
  candidate_id: string;
  request_reference: string;
  document_storage_path: string | null;
  selfie_storage_path: string | null;
  status: string;
};

async function requireStaff(
  admin: ReturnType<typeof adminClient>,
  userId: string,
): Promise<void> {
  const { data, error } = await admin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (error) throw new Error(error.message);
  if (!['admin', 'proctor', 'reviewer'].includes(String(data.role || ''))) {
    throw new Error('Staff access is required.');
  }
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return preflightResponse(request);
  if (request.method !== 'POST') {
    return jsonResponse(request, { error: 'Method not allowed.' }, 405);
  }

  try {
    const user = await requireAuthenticatedUser(request);
    const body = (await request.json()) as ReviewFilesRequest;
    const requestId = body.requestId?.trim();

    if (!requestId) {
      return jsonResponse(request, { error: 'An identity-review request identifier is required.' }, 400);
    }

    const admin = adminClient();
    await requireStaff(admin, user.id);

    const { data: requestData, error: requestError } = await admin
      .from('agilecert_identity_verification_requests')
      .select('id, candidate_id, request_reference, document_storage_path, selfie_storage_path, status')
      .eq('id', requestId)
      .single();

    if (requestError) throw new Error(requestError.message);
    const identityRequest = requestData as IdentityRequest;

    if (!identityRequest.document_storage_path || !identityRequest.selfie_storage_path) {
      throw new Error('The candidate identity files have not been submitted.');
    }

    const expiresIn = 600;
    const [documentResult, selfieResult] = await Promise.all([
      admin.storage
        .from('agilecert-identity-documents')
        .createSignedUrl(identityRequest.document_storage_path, expiresIn),
      admin.storage
        .from('agilecert-identity-documents')
        .createSignedUrl(identityRequest.selfie_storage_path, expiresIn),
    ]);

    if (documentResult.error) throw new Error(documentResult.error.message);
    if (selfieResult.error) throw new Error(selfieResult.error.message);
    if (!documentResult.data?.signedUrl || !selfieResult.data?.signedUrl) {
      throw new Error('Secure identity-review links could not be created.');
    }

    const { error: auditError } = await admin.from('audit_logs').insert({
      actor_id: user.id,
      action: 'agilecert_identity_files_reviewed',
      entity_type: 'agilecert_identity_verification_request',
      entity_id: identityRequest.id,
      metadata: {
        requestReference: identityRequest.request_reference,
        candidateId: identityRequest.candidate_id,
        requestStatus: identityRequest.status,
        signedUrlExpiresInSeconds: expiresIn,
      },
    });

    if (auditError) throw new Error(auditError.message);

    return jsonResponse(request, {
      requestId: identityRequest.id,
      requestReference: identityRequest.request_reference,
      status: identityRequest.status,
      expiresIn,
      documentUrl: documentResult.data.signedUrl,
      selfieUrl: selfieResult.data.signedUrl,
    });
  } catch (error) {
    console.error('get-identity-review-files failed:', error);
    const message = error instanceof Error ? error.message : 'Identity-review files could not be opened.';
    return jsonResponse(request, { error: message }, 400);
  }
});

import { jsonResponse, preflightResponse } from '../_shared/http.ts';
import { adminClient, requireAuthenticatedUser, userClient } from '../_shared/supabase.ts';

type IdentityUploadRequest = {
  documentType?: string;
  issuingCountryCode?: string;
  documentNumberLast4?: string;
  documentMimeType?: string;
  selfieMimeType?: string;
};

type IdentityRequestRecord = {
  id: string;
  request_reference: string;
  candidate_id: string;
  status: string;
  document_type: string;
  issuing_country_code: string;
};

const allowedDocumentTypes = new Set([
  'passport',
  'national_id',
  'drivers_licence',
  'voters_card',
  'residence_permit',
  'other_government_id',
]);

const extensionByMime: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function mimeExtension(value: string | undefined, kind: 'document' | 'selfie'): string {
  const mime = String(value || '').trim().toLowerCase();
  const extension = extensionByMime[mime];
  if (!extension) {
    throw new Error(`${kind === 'document' ? 'Identity document' : 'Selfie'} must be PDF, JPG, PNG or WEBP.`);
  }
  if (kind === 'selfie' && mime === 'application/pdf') {
    throw new Error('The identity selfie must be an image, not a PDF.');
  }
  return extension;
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return preflightResponse(request);
  if (request.method !== 'POST') {
    return jsonResponse(request, { error: 'Method not allowed.' }, 405);
  }

  try {
    const user = await requireAuthenticatedUser(request);
    const body = (await request.json()) as IdentityUploadRequest;
    const documentType = String(body.documentType || '').trim();
    const issuingCountryCode = String(body.issuingCountryCode || '').trim().toUpperCase();
    const documentNumberLast4 = String(body.documentNumberLast4 || '').trim().toUpperCase() || null;

    if (!allowedDocumentTypes.has(documentType)) {
      return jsonResponse(request, { error: 'Select a valid government-issued identity document type.' }, 400);
    }
    if (!/^[A-Z]{2}$/.test(issuingCountryCode)) {
      return jsonResponse(request, { error: 'A two-letter issuing-country code is required.' }, 400);
    }
    if (documentNumberLast4 && !/^[A-Z0-9]{2,4}$/.test(documentNumberLast4)) {
      return jsonResponse(request, { error: 'Enter only the final two to four characters of the document number.' }, 400);
    }

    const documentExtension = mimeExtension(body.documentMimeType, 'document');
    const selfieExtension = mimeExtension(body.selfieMimeType, 'selfie');
    const candidate = userClient(request);
    const { data: requestData, error: requestError } = await candidate.rpc(
      'create_my_agilecert_identity_request',
      {
        p_document_type: documentType,
        p_issuing_country_code: issuingCountryCode,
        p_document_number_last4: documentNumberLast4,
      },
    );

    if (requestError) throw new Error(requestError.message);
    if (!requestData || typeof requestData !== 'object') {
      throw new Error('The identity-verification request was not created.');
    }

    const identityRequest = requestData as IdentityRequestRecord;
    if (identityRequest.candidate_id !== user.id) {
      throw new Error('The identity-verification request does not belong to the signed-in candidate.');
    }
    if (!['draft', 'rejected'].includes(identityRequest.status)) {
      return jsonResponse(request, {
        requestId: identityRequest.id,
        requestReference: identityRequest.request_reference,
        status: identityRequest.status,
        uploadRequired: false,
      });
    }

    const folder = `${user.id}/${identityRequest.id}`;
    const documentPath = `${folder}/document.${documentExtension}`;
    const selfiePath = `${folder}/selfie.${selfieExtension}`;
    const admin = adminClient();

    const [documentUpload, selfieUpload] = await Promise.all([
      admin.storage
        .from('agilecert-identity-documents')
        .createSignedUploadUrl(documentPath, { upsert: true }),
      admin.storage
        .from('agilecert-identity-documents')
        .createSignedUploadUrl(selfiePath, { upsert: true }),
    ]);

    if (documentUpload.error) throw new Error(documentUpload.error.message);
    if (selfieUpload.error) throw new Error(selfieUpload.error.message);
    if (!documentUpload.data?.token || !selfieUpload.data?.token) {
      throw new Error('Secure identity upload tokens were not returned.');
    }

    return jsonResponse(request, {
      requestId: identityRequest.id,
      requestReference: identityRequest.request_reference,
      status: identityRequest.status,
      uploadRequired: true,
      bucket: 'agilecert-identity-documents',
      document: {
        path: documentPath,
        token: documentUpload.data.token,
        mimeType: body.documentMimeType,
      },
      selfie: {
        path: selfiePath,
        token: selfieUpload.data.token,
        mimeType: body.selfieMimeType,
      },
    });
  } catch (error) {
    console.error('initialize-identity-verification failed:', error);
    const message = error instanceof Error ? error.message : 'Identity verification could not be initialized.';
    return jsonResponse(request, { error: message }, 400);
  }
});

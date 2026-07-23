import { jsonResponse, preflightResponse } from '../_shared/http.ts';
import { generateAgileCertCredentialAssets } from '../_shared/credentialAssets.ts';
import { adminClient, requireAuthenticatedUser } from '../_shared/supabase.ts';

type CredentialAssetType = 'certificate' | 'transcript';

type CredentialAssetRequest = {
  credentialId?: string;
  assetType?: CredentialAssetType;
};

type CredentialRecord = {
  id: string;
  candidate_id: string;
  credential_code: string;
  credential_title: string;
  product_code: string;
  status: string;
  certificate_storage_path: string | null;
  transcript_storage_path: string | null;
};

function safeFilename(title: string, code: string, assetType: CredentialAssetType): string {
  const base = `${title}-${code}-${assetType}`
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
  return `${base || `agilecert-${assetType}`}.pdf`;
}

async function readCredential(
  admin: ReturnType<typeof adminClient>,
  credentialId: string,
): Promise<CredentialRecord> {
  const { data, error } = await admin
    .from('agilecert_credentials')
    .select(
      'id, candidate_id, credential_code, credential_title, product_code, status, certificate_storage_path, transcript_storage_path',
    )
    .eq('id', credentialId)
    .single();

  if (error) throw new Error(error.message);
  return data as CredentialRecord;
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return preflightResponse(request);
  if (request.method !== 'POST') {
    return jsonResponse(request, { error: 'Method not allowed.' }, 405);
  }

  try {
    const user = await requireAuthenticatedUser(request);
    const body = (await request.json()) as CredentialAssetRequest;
    const credentialId = body.credentialId?.trim();
    const assetType = body.assetType;

    if (!credentialId) {
      return jsonResponse(request, { error: 'A credential identifier is required.' }, 400);
    }
    if (!assetType || !['certificate', 'transcript'].includes(assetType)) {
      return jsonResponse(request, { error: 'A valid credential asset type is required.' }, 400);
    }

    const admin = adminClient();
    let credential = await readCredential(admin, credentialId);

    if (credential.candidate_id !== user.id) {
      return jsonResponse(request, { error: 'This credential does not belong to the signed-in candidate.' }, 403);
    }
    if (credential.status !== 'active') {
      return jsonResponse(
        request,
        { error: `Credential downloads are unavailable while status is ${credential.status}.` },
        403,
      );
    }
    if (assetType === 'transcript' && credential.product_code !== 'professional') {
      return jsonResponse(
        request,
        { error: 'A formal examination transcript is included only with the Professional Certificate.' },
        400,
      );
    }

    let storagePath = assetType === 'certificate'
      ? credential.certificate_storage_path
      : credential.transcript_storage_path;

    if (!storagePath) {
      await generateAgileCertCredentialAssets(admin, credential.id);
      credential = await readCredential(admin, credential.id);
      storagePath = assetType === 'certificate'
        ? credential.certificate_storage_path
        : credential.transcript_storage_path;
    }

    if (!storagePath) {
      throw new Error(`The ${assetType} file is still being prepared. Try again shortly.`);
    }

    const expiresIn = 300;
    const filename = safeFilename(
      credential.credential_title,
      credential.credential_code,
      assetType,
    );
    const { data: signedData, error: signedError } = await admin.storage
      .from('agilecert-credential-assets')
      .createSignedUrl(storagePath, expiresIn, { download: filename });

    if (signedError) throw new Error(signedError.message);
    if (!signedData?.signedUrl) throw new Error('A secure credential download link could not be created.');

    const { error: auditError } = await admin.from('audit_logs').insert({
      actor_id: user.id,
      action: 'agilecert_credential_asset_download',
      entity_type: 'agilecert_credential',
      entity_id: credential.id,
      metadata: {
        credentialCode: credential.credential_code,
        assetType,
        storagePath,
        signedUrlExpiresInSeconds: expiresIn,
        userAgent: request.headers.get('user-agent')?.slice(0, 500) || null,
      },
    });

    if (auditError) throw new Error(auditError.message);

    return jsonResponse(request, {
      credentialId: credential.id,
      credentialCode: credential.credential_code,
      assetType,
      filename,
      signedUrl: signedData.signedUrl,
      expiresIn,
    });
  } catch (error) {
    console.error('download-credential-asset failed:', error);
    const message = error instanceof Error ? error.message : 'The credential asset could not be downloaded.';
    return jsonResponse(request, { error: message }, 400);
  }
});

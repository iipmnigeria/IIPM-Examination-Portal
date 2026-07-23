import { jsonResponse, preflightResponse } from '../_shared/http.ts';
import { adminClient, requireAuthenticatedUser } from '../_shared/supabase.ts';

type DownloadRequest = {
  materialId?: string;
};

type StudyMaterial = {
  id: string;
  examination_id: string;
  title: string;
  version: string;
  storage_bucket: string;
  storage_path: string;
  mime_type: string;
  copyright_notice: string | null;
  watermark_required: boolean;
  active: boolean;
};

type Entitlement = {
  id: string;
  candidate_id: string;
  examination_id: string;
  revoked_at: string | null;
};

function safeFilename(title: string, version: string): string {
  const base = `${title}-${version}`
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);

  return `${base || 'agilecert-study-material'}.pdf`;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function requestIpHash(request: Request): Promise<string | null> {
  const address =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    '';
  const salt = Deno.env.get('AGILECERT_AUDIT_SALT')?.trim() || '';

  if (!address || !salt) return null;
  return sha256Hex(`${salt}:${address}`);
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return preflightResponse(request);
  if (request.method !== 'POST') {
    return jsonResponse(request, { error: 'Method not allowed.' }, 405);
  }

  try {
    const user = await requireAuthenticatedUser(request);
    const body = (await request.json()) as DownloadRequest;
    const materialId = body.materialId?.trim();

    if (!materialId) {
      return jsonResponse(request, { error: 'A study material identifier is required.' }, 400);
    }

    const admin = adminClient();
    const { data: materialData, error: materialError } = await admin
      .from('agilecert_study_materials')
      .select(
        'id, examination_id, title, version, storage_bucket, storage_path, mime_type, copyright_notice, watermark_required, active',
      )
      .eq('id', materialId)
      .eq('active', true)
      .maybeSingle();

    if (materialError) throw new Error(materialError.message);
    if (!materialData) {
      return jsonResponse(request, { error: 'This preparation material is not available.' }, 404);
    }

    const material = materialData as StudyMaterial;
    if (material.mime_type !== 'application/pdf') {
      throw new Error('Only PDF preparation materials may be downloaded from this endpoint.');
    }

    const { data: entitlementData, error: entitlementError } = await admin
      .from('agilecert_study_material_entitlements')
      .select('id, candidate_id, examination_id, revoked_at')
      .eq('candidate_id', user.id)
      .eq('examination_id', material.examination_id)
      .is('revoked_at', null)
      .maybeSingle();

    if (entitlementError) throw new Error(entitlementError.message);
    if (!entitlementData) {
      return jsonResponse(
        request,
        { error: 'Verified examination payment is required before this material can be downloaded.' },
        403,
      );
    }

    const entitlement = entitlementData as Entitlement;
    const expiresIn = 300;
    const filename = safeFilename(material.title, material.version);
    const { data: signedData, error: signedError } = await admin.storage
      .from(material.storage_bucket)
      .createSignedUrl(material.storage_path, expiresIn, { download: filename });

    if (signedError) throw new Error(signedError.message);
    if (!signedData?.signedUrl) throw new Error('A secure material download link could not be created.');

    const { error: auditError } = await admin
      .from('agilecert_material_download_audit')
      .insert({
        candidate_id: user.id,
        material_id: material.id,
        entitlement_id: entitlement.id,
        ip_hash: await requestIpHash(request),
        user_agent: request.headers.get('user-agent')?.slice(0, 500) || null,
        metadata: {
          signed_url_expires_in_seconds: expiresIn,
          storage_bucket: material.storage_bucket,
          storage_path: material.storage_path,
          watermark_required: material.watermark_required,
        },
      });

    if (auditError) throw new Error(auditError.message);

    return jsonResponse(request, {
      materialId: material.id,
      title: material.title,
      version: material.version,
      filename,
      signedUrl: signedData.signedUrl,
      expiresIn,
      watermarkRequired: material.watermark_required,
      copyrightNotice: material.copyright_notice,
    });
  } catch (error) {
    console.error('download-study-material failed:', error);
    const message = error instanceof Error ? error.message : 'The study material could not be downloaded.';
    return jsonResponse(request, { error: message }, 400);
  }
});

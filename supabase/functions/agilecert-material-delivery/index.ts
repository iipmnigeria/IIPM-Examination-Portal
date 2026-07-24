import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Expose-Headers': 'Content-Disposition, X-AgileCert-Download-Audit',
};

const jsonResponse = (status: number, payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });

const isUuid = (value: unknown): value is string =>
  typeof value === 'string'
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const contentDisposition = (fileName: string): string => {
  const safeAscii = fileName
    .replace(/[^\x20-\x7E]/g, '_')
    .replace(/["\\]/g, '_')
    .slice(0, 180) || 'agilecert-material';
  return `attachment; filename="${safeAscii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
};

interface DeliveryAuthorization {
  authorized: boolean;
  auditId?: string;
  requestId?: string;
  reason?: string;
  message?: string;
  storageBucket?: string;
  storagePath?: string;
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  signedUrlTtlSeconds?: number;
  copyrightNotice?: string;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Only POST requests are supported.' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const publishableKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
    console.error('Phase 2.4 delivery environment is incomplete.');
    return jsonResponse(500, { error: 'Secure material delivery is not configured.' });
  }

  const authorizationHeader = request.headers.get('Authorization') || '';
  const accessToken = authorizationHeader.startsWith('Bearer ')
    ? authorizationHeader.slice('Bearer '.length).trim()
    : '';

  if (!accessToken) {
    return jsonResponse(401, { error: 'Authentication is required.' });
  }

  let requestBody: Record<string, unknown>;
  try {
    requestBody = await request.json();
  } catch {
    return jsonResponse(400, { error: 'A valid JSON request body is required.' });
  }

  const examinationId = requestBody.examinationId;
  const materialId = requestBody.materialId;
  if (!isUuid(examinationId) || !isUuid(materialId)) {
    return jsonResponse(400, { error: 'Valid examination and material identifiers are required.' });
  }

  const userClient = createClient(supabaseUrl, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser(accessToken);
  if (userError || !userData.user) {
    return jsonResponse(401, { error: 'Your authenticated session is invalid or has expired.' });
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const requestId = crypto.randomUUID();
  const { data: authorizationData, error: authorizationError } = await serviceClient.rpc(
    'authorize_agilecert_material_download',
    {
      p_candidate_id: userData.user.id,
      p_examination_id: examinationId,
      p_material_id: materialId,
      p_request_id: requestId,
      p_user_agent: request.headers.get('user-agent'),
    },
  );

  if (authorizationError) {
    console.error('Material authorization RPC failed.', authorizationError.message);
    return jsonResponse(500, { error: 'The material access check could not be completed.' });
  }

  const authorization = authorizationData as DeliveryAuthorization | null;
  if (!authorization?.authorized) {
    return jsonResponse(403, {
      error: authorization?.message || 'You are not authorised to download this material.',
      code: authorization?.reason || 'access_denied',
      auditId: authorization?.auditId || null,
    });
  }

  if (
    !authorization.auditId
    || !authorization.storageBucket
    || !authorization.storagePath
    || !authorization.fileName
  ) {
    console.error('Authorised delivery response omitted required private metadata.');
    return jsonResponse(500, { error: 'The secure material record is incomplete.' });
  }

  const markAudit = async (
    status: 'delivered' | 'failed',
    bytesDelivered: number | null,
    failureCode: string | null,
  ) => {
    const { error } = await serviceClient
      .from('agilecert_material_download_audits')
      .update({
        status,
        bytes_delivered: bytesDelivered,
        failure_code: failureCode,
        completed_at: new Date().toISOString(),
      })
      .eq('id', authorization.auditId!);

    if (error) console.error('Material delivery audit update failed.', error.message);
  };

  const ttlSeconds = Math.max(30, Math.min(Number(authorization.signedUrlTtlSeconds) || 60, 120));
  const { data: signedData, error: signedError } = await serviceClient.storage
    .from(authorization.storageBucket)
    .createSignedUrl(authorization.storagePath, ttlSeconds, {
      download: authorization.fileName,
    });

  if (signedError || !signedData?.signedUrl) {
    console.error('Signed material URL creation failed.', signedError?.message);
    await markAudit('failed', null, 'signed_url_failed');
    return jsonResponse(500, { error: 'A secure material link could not be created.' });
  }

  let storageResponse: Response;
  try {
    storageResponse = await fetch(signedData.signedUrl, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('Private material retrieval failed.', String(error));
    await markAudit('failed', null, 'storage_fetch_failed');
    return jsonResponse(502, { error: 'The private material file could not be retrieved.' });
  }

  if (!storageResponse.ok || !storageResponse.body) {
    console.error('Private material storage returned an error.', storageResponse.status);
    await markAudit('failed', null, `storage_http_${storageResponse.status}`);
    return jsonResponse(502, { error: 'The private material file is temporarily unavailable.' });
  }

  const responseLength = Number(storageResponse.headers.get('content-length'));
  const bytesDelivered = Number.isFinite(responseLength) && responseLength >= 0
    ? responseLength
    : Number(authorization.sizeBytes) || null;
  await markAudit('delivered', bytesDelivered, null);

  return new Response(storageResponse.body, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': storageResponse.headers.get('content-type')
        || authorization.mimeType
        || 'application/octet-stream',
      'Content-Disposition': contentDisposition(authorization.fileName),
      'Content-Length': String(bytesDelivered || ''),
      'Cache-Control': 'private, no-store, max-age=0',
      Pragma: 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'X-AgileCert-Download-Audit': authorization.auditId,
      'X-AgileCert-Copyright': 'Authorised candidate use only',
    },
  });
});

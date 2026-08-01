import { corsHeaders, jsonResponse, preflightResponse } from '../_shared/http.ts';
import {
  adminClient,
  requireAuthenticatedUser,
  userClient,
} from '../_shared/supabase.ts';
import {
  CERTIFICATE_RENDERER_VERSION,
  renderManagedCertificate,
  type LoadedCertificateAsset,
  type ManagedCertificateRenderContext,
} from './render.ts';

type RenderRequest = {
  certificateId?: string;
};

type RenderContextResponse =
  | {
      mode: 'legacy';
      reasonCode: string;
      jobId?: string;
    }
  | ({
      mode: 'managed';
    } & ManagedCertificateRenderContext);

class RenderFailure extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 422,
  ) {
    super(message);
  }
}

const safeFileName = (value: string): string => {
  const cleaned = String(value || 'Certificate.pdf')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 180);
  return cleaned.toLowerCase().endsWith('.pdf') ? cleaned : `${cleaned}.pdf`;
};

const sha256 = async (bytes: Uint8Array): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
};

const downloadPrivateFile = async (
  bucket: string,
  path: string,
  maximumBytes: number,
): Promise<Uint8Array> => {
  const admin = adminClient();
  const { data, error } = await admin.storage.from(bucket).download(path);
  if (error || !data) {
    throw new RenderFailure(
      'PRIVATE_FILE_UNAVAILABLE',
      'An approved private certificate file could not be loaded.',
      503,
    );
  }
  if (data.size <= 0 || data.size > maximumBytes) {
    throw new RenderFailure(
      'PRIVATE_FILE_SIZE_INVALID',
      'An approved private certificate file has an invalid size.',
    );
  }
  return new Uint8Array(await data.arrayBuffer());
};

const completeRender = async (input: {
  jobId: string;
  succeeded: boolean;
  outputSha256?: string;
  outputSizeBytes?: number;
  outputPageCount?: number;
  failureCode?: string;
  failureMessage?: string;
}): Promise<void> => {
  const admin = adminClient();
  const { error } = await admin.rpc('complete_agilecert_certificate_server_render', {
    p_job_id: input.jobId,
    p_succeeded: input.succeeded,
    p_renderer_version: CERTIFICATE_RENDERER_VERSION,
    p_output_sha256: input.outputSha256 || null,
    p_output_size_bytes: input.outputSizeBytes || null,
    p_output_page_count: input.outputPageCount || null,
    p_failure_code: input.failureCode || null,
    p_failure_message: input.failureMessage || null,
  });
  if (error) {
    throw new Error(`Unable to complete certificate render evidence: ${error.message}`);
  }
};

const loadAssets = async (
  context: ManagedCertificateRenderContext,
): Promise<Map<string, LoadedCertificateAsset>> => {
  const loaded = new Map<string, LoadedCertificateAsset>();

  await Promise.all(
    (context.assets || []).map(async (asset) => {
      if (!['image/png', 'image/jpeg'].includes(asset.mimeType)) {
        throw new RenderFailure(
          'ASSET_FORMAT_UNSUPPORTED',
          `Certificate asset ${asset.id} must be PNG or JPEG.`,
        );
      }
      const bytes = await downloadPrivateFile(
        asset.storageBucket,
        asset.storagePath,
        10 * 1024 * 1024,
      );
      const digest = await sha256(bytes);
      if (digest !== asset.sha256) {
        throw new RenderFailure(
          'ASSET_DIGEST_MISMATCH',
          `Certificate asset ${asset.id} failed its immutable digest check.`,
        );
      }
      loaded.set(asset.id, {
        id: asset.id,
        mimeType: asset.mimeType,
        bytes,
        metadata: asset.metadata,
      });
    }),
  );

  return loaded;
};

const pdfResponse = (
  request: Request,
  bytes: Uint8Array,
  fileName: string,
  jobId: string,
): Response =>
  new Response(bytes, {
    status: 200,
    headers: {
      ...corsHeaders(request),
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${safeFileName(fileName)}"`,
      'Access-Control-Expose-Headers': 'Content-Disposition, Content-Length, X-Certificate-Render-Mode, X-Certificate-Render-Job, X-Certificate-Renderer-Version',
      'Content-Length': String(bytes.byteLength),
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
      'X-Certificate-Render-Mode': 'managed',
      'X-Certificate-Render-Job': jobId,
      'X-Certificate-Renderer-Version': CERTIFICATE_RENDERER_VERSION,
    },
  });

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return preflightResponse(request);
  if (request.method !== 'POST') {
    return jsonResponse(request, {
      code: 'METHOD_NOT_ALLOWED',
      error: 'Method not allowed.',
    }, 405);
  }

  let jobId = '';
  try {
    await requireAuthenticatedUser(request);

    const body = (await request.json()) as RenderRequest;
    const certificateId = String(body.certificateId || '').trim();
    if (!/^[0-9a-f-]{36}$/i.test(certificateId)) {
      return jsonResponse(request, {
        code: 'CERTIFICATE_ID_REQUIRED',
        error: 'A valid issued certificate id is required.',
      }, 400);
    }

    const actorClient = userClient(request);
    const { data, error } = await actorClient.rpc(
      'get_agilecert_certificate_server_render_context',
      { p_certificate_id: certificateId },
    );
    if (error) throw new RenderFailure('RENDER_CONTEXT_REJECTED', error.message, 403);
    if (!data || typeof data !== 'object') {
      throw new RenderFailure(
        'RENDER_CONTEXT_EMPTY',
        'The certificate render context was not returned.',
        500,
      );
    }

    const context = data as RenderContextResponse;
    jobId = context.jobId || '';

    if (context.mode === 'legacy') {
      return jsonResponse(request, {
        code: 'LEGACY_RENDER_REQUIRED',
        reasonCode: context.reasonCode || 'NO_RENDERER_ASSIGNMENT',
        message: 'No explicitly enabled server-rendered master is assigned to this certificate.',
      }, 409);
    }

    if (!context.master?.sha256 || !context.master?.storageBucket || !context.master?.storagePath) {
      throw new RenderFailure(
        'MASTER_CONTEXT_INCOMPLETE',
        'The approved master render context is incomplete.',
        500,
      );
    }
    if (!['pdf', 'png', 'jpeg'].includes(context.master.sourceFormat)) {
      throw new RenderFailure(
        'MASTER_FORMAT_UNSUPPORTED',
        'The assigned server-rendered master must be PDF, PNG or JPEG.',
      );
    }

    const masterBytes = await downloadPrivateFile(
      context.master.storageBucket,
      context.master.storagePath,
      25 * 1024 * 1024,
    );
    const masterDigest = await sha256(masterBytes);
    if (masterDigest !== context.master.sha256) {
      throw new RenderFailure(
        'MASTER_DIGEST_MISMATCH',
        'The certificate master failed its immutable SHA-256 check.',
      );
    }

    const assets = await loadAssets(context);
    const output = await renderManagedCertificate({
      context,
      masterBytes,
      assets,
    });
    if (output.byteLength < 500 || output.byteLength > 40 * 1024 * 1024) {
      throw new RenderFailure(
        'OUTPUT_SIZE_INVALID',
        'The generated certificate PDF has an invalid output size.',
      );
    }

    const outputDigest = await sha256(output);
    await completeRender({
      jobId: context.jobId,
      succeeded: true,
      outputSha256: outputDigest,
      outputSizeBytes: output.byteLength,
      outputPageCount: 1,
    });

    return pdfResponse(request, output, context.fileName, context.jobId);
  } catch (error) {
    const failure = error instanceof RenderFailure
      ? error
      : new RenderFailure(
          'SERVER_RENDER_FAILED',
          error instanceof Error ? error.message : 'Server certificate rendering failed.',
          500,
        );

    console.error('render-certificate-pdf failed:', failure.code);

    if (jobId) {
      try {
        await completeRender({
          jobId,
          succeeded: false,
          failureCode: failure.code,
          failureMessage: failure.message,
        });
      } catch (completionError) {
        console.error(
          'render-certificate-pdf evidence completion failed:',
          completionError instanceof Error ? completionError.message : 'unknown',
        );
      }
    }

    const authenticationFailure = /authentication|session|sign in/i.test(failure.message);
    return jsonResponse(request, {
      code: failure.code,
      error: failure.message,
    }, authenticationFailure ? 401 : failure.status);
  }
});

import {
  supabase,
  supabasePublishableKey,
  supabaseUrl,
} from '../lib/supabase';

type RenderErrorPayload = {
  code?: string;
  error?: string;
  message?: string;
};

const legacyFallbackCodes = new Set([
  'LEGACY_RENDER_REQUIRED',
  'NO_RENDERER_ASSIGNMENT',
]);

const parseDownloadFileName = (
  contentDisposition: string | null,
  fallback: string,
): string => {
  if (!contentDisposition) return fallback;
  const utf8 = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const plain = contentDisposition.match(/filename="?([^";]+)"?/i)?.[1];
  const candidate = utf8 || plain;
  if (!candidate) return fallback;
  try {
    return decodeURIComponent(candidate).replace(/[^A-Za-z0-9._-]+/g, '_');
  } catch {
    return candidate.replace(/[^A-Za-z0-9._-]+/g, '_');
  }
};

const triggerBrowserDownload = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
};

const readErrorPayload = async (response: Response): Promise<RenderErrorPayload> => {
  try {
    return (await response.json()) as RenderErrorPayload;
  } catch {
    return { error: `Certificate rendering failed with HTTP ${response.status}.` };
  }
};

/**
 * Returns true when the Phase 1C server renderer produced and downloaded a PDF.
 * Returns false only when the server explicitly confirms that no renderer-enabled
 * master assignment exists, preserving the existing client-side renderer.
 * Every assigned-master integrity or render error fails closed.
 */
export async function tryDownloadManagedCertificatePdf(
  certificateId: string,
): Promise<boolean> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(error.message);

  const accessToken = data.session?.access_token;
  if (!accessToken) {
    throw new Error('Sign in again before downloading your certificate.');
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/render-certificate-pdf`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: supabasePublishableKey,
      'Content-Type': 'application/json',
      'X-Client-Info': 'iipm-examination-portal-phase1c',
    },
    body: JSON.stringify({ certificateId }),
  });

  if (!response.ok) {
    const payload = await readErrorPayload(response);
    const code = payload.code?.trim() || '';
    if (response.status === 409 && legacyFallbackCodes.has(code)) {
      return false;
    }
    throw new Error(
      payload.error ||
        payload.message ||
        `The server certificate renderer returned HTTP ${response.status}.`,
    );
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/pdf')) {
    throw new Error('The server renderer did not return a PDF document.');
  }

  const blob = await response.blob();
  if (blob.size < 500) {
    throw new Error('The server renderer returned an incomplete PDF document.');
  }

  const fallbackName = `Certificate_${certificateId}.pdf`;
  const fileName = parseDownloadFileName(
    response.headers.get('content-disposition'),
    fallbackName,
  );
  triggerBrowserDownload(blob, fileName);
  return true;
}

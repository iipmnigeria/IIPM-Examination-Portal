import { supabase } from '../lib/supabase';

export type AgileCertCredentialAssetType = 'certificate' | 'transcript';

export interface SecureCredentialAssetDownload {
  credentialId: string;
  credentialCode: string;
  assetType: AgileCertCredentialAssetType;
  filename: string;
  signedUrl: string;
  expiresIn: number;
}

async function functionErrorMessage(error: any, fallback: string): Promise<string> {
  const context = error?.context;

  if (context instanceof Response) {
    try {
      const payload = await context.clone().json();
      if (payload?.error) return String(payload.error);
      if (payload?.message) return String(payload.message);
    } catch {
      try {
        const text = await context.clone().text();
        if (text.trim()) return text.trim();
      } catch {
        // Use the normal function error below.
      }
    }
  }

  return error?.message || fallback;
}

export async function createSecureCredentialAssetDownload(input: {
  credentialId: string;
  assetType: AgileCertCredentialAssetType;
}): Promise<SecureCredentialAssetDownload> {
  const credentialId = input.credentialId.trim();
  if (!credentialId) throw new Error('The credential identifier is missing.');

  const { data, error } = await supabase.functions.invoke('download-credential-asset', {
    body: {
      credentialId,
      assetType: input.assetType,
    },
  });

  if (error) {
    throw new Error(
      await functionErrorMessage(error, 'The secure credential download could not be created.'),
    );
  }
  if (!data || typeof data !== 'object') {
    throw new Error('The secure credential download was not returned.');
  }

  return data as SecureCredentialAssetDownload;
}

export async function downloadAgileCertCredentialAsset(input: {
  credentialId: string;
  assetType: AgileCertCredentialAssetType;
}): Promise<void> {
  const download = await createSecureCredentialAssetDownload(input);
  const anchor = document.createElement('a');
  anchor.href = download.signedUrl;
  anchor.download = download.filename;
  anchor.rel = 'noopener noreferrer';
  anchor.style.display = 'none';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}

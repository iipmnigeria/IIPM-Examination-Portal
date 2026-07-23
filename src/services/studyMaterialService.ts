import { supabase } from '../lib/supabase';

export interface SecureStudyMaterialDownload {
  materialId: string;
  title: string;
  version: string;
  filename: string;
  signedUrl: string;
  expiresIn: number;
  watermarkRequired: boolean;
  copyrightNotice: string | null;
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

export async function createSecureStudyMaterialDownload(
  materialId: string,
): Promise<SecureStudyMaterialDownload> {
  const cleanMaterialId = materialId.trim();
  if (!cleanMaterialId) throw new Error('The preparation material identifier is missing.');

  const { data, error } = await supabase.functions.invoke('download-study-material', {
    body: { materialId: cleanMaterialId },
  });

  if (error) {
    throw new Error(
      await functionErrorMessage(error, 'The secure preparation-material download could not be created.'),
    );
  }
  if (!data || typeof data !== 'object') {
    throw new Error('The secure preparation-material download was not returned.');
  }

  return data as SecureStudyMaterialDownload;
}

export async function downloadAgileCertStudyMaterial(materialId: string): Promise<void> {
  const download = await createSecureStudyMaterialDownload(materialId);

  const anchor = document.createElement('a');
  anchor.href = download.signedUrl;
  anchor.download = download.filename;
  anchor.rel = 'noopener noreferrer';
  anchor.style.display = 'none';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}

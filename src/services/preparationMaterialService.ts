import {
  supabase,
  supabasePublishableKey,
  supabaseUrl,
} from '../lib/supabase';

export type PreparationMaterialAccessStatus =
  | 'locked'
  | 'scheduled'
  | 'available'
  | 'expired'
  | 'revoked';

export type PreparationMaterialType =
  | 'study_guide'
  | 'workbook'
  | 'mock_exam'
  | 'checklist'
  | 'video'
  | 'reference'
  | 'other';

export interface CandidatePreparationMaterial {
  materialId: string;
  examinationId: string;
  examinationTitle: string;
  programmeCode: string;
  title: string;
  description: string;
  materialType: PreparationMaterialType;
  versionNumber: number;
  versionLabel: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  isRequired: boolean;
  position: number;
  accessStatus: PreparationMaterialAccessStatus;
  availableFrom?: string | null;
  expiresAt?: string | null;
  unlockReason?: string | null;
}

export interface MaterialDownloadReceipt {
  fileName: string;
  auditId?: string | null;
}

export async function getMyPreparationMaterials(): Promise<CandidatePreparationMaterial[]> {
  const { data, error } = await supabase.rpc('get_my_agilecert_preparation_materials');

  if (error) {
    throw new Error(`Unable to load preparation materials: ${error.message}`);
  }

  return Array.isArray(data) ? (data as CandidatePreparationMaterial[]) : [];
}

const extractFileName = (headerValue: string | null, fallback: string): string => {
  if (!headerValue) return fallback;

  const utf8Match = headerValue.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].trim());
    } catch {
      // Fall through to the ASCII filename.
    }
  }

  const asciiMatch = headerValue.match(/filename="?([^";]+)"?/i);
  return asciiMatch?.[1]?.trim() || fallback;
};

const parseDeliveryError = async (response: Response): Promise<string> => {
  try {
    const payload = await response.json() as { error?: string };
    return payload.error || 'The secure material download was not authorised.';
  } catch {
    return 'The secure material download could not be completed.';
  }
};

export async function downloadPreparationMaterial(
  material: Pick<CandidatePreparationMaterial, 'materialId' | 'examinationId' | 'fileName'>,
): Promise<MaterialDownloadReceipt> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session?.access_token) {
    throw new Error('Your session has expired. Sign in again before downloading this material.');
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/agilecert-material-delivery`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sessionData.session.access_token}`,
      apikey: supabasePublishableKey,
      'Content-Type': 'application/json',
      'X-Client-Info': 'iipm-examination-portal-phase-2-4',
    },
    body: JSON.stringify({
      examinationId: material.examinationId,
      materialId: material.materialId,
    }),
  });

  if (!response.ok) {
    throw new Error(await parseDeliveryError(response));
  }

  const blob = await response.blob();
  if (!blob.size) {
    throw new Error('The secure material file was empty. Please contact an examination administrator.');
  }

  const fileName = extractFileName(response.headers.get('content-disposition'), material.fileName);
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);

  return {
    fileName,
    auditId: response.headers.get('x-agilecert-download-audit'),
  };
}

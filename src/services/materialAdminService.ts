import { supabase } from '../lib/supabase';

export type MaterialType =
  | 'study_guide'
  | 'workbook'
  | 'mock_exam'
  | 'checklist'
  | 'video'
  | 'reference'
  | 'other';

export type MaterialStatus = 'draft' | 'published' | 'archived';
export type MaterialVersionStatus = 'draft' | 'published' | 'retired';

export interface MaterialAdminSummary {
  materials: number;
  publishedMaterials: number;
  versions: number;
  publishedVersions: number;
  activeMappings: number;
  activeEntitlements: number;
  scheduledEntitlements: number;
}

export interface MaterialAdminProgramme {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

export interface MaterialAdminExamination {
  id: string;
  programmeId: string;
  programmeCode: string;
  programmeName: string;
  title: string;
  status: string;
  requiresPayment: boolean;
}

export interface MaterialAdminVersion {
  id: string;
  versionNumber: number;
  versionLabel: string;
  storageBucket: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256?: string | null;
  status: MaterialVersionStatus;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MaterialAdminMapping {
  examinationId: string;
  examinationTitle: string;
  programmeCode: string;
  position: number;
  isRequired: boolean;
  availableFrom?: string | null;
  expiresAt?: string | null;
  isActive: boolean;
  updatedAt: string;
}

export interface MaterialEntitlementSummary {
  available: number;
  scheduled: number;
  expired: number;
  revoked: number;
}

export interface MaterialAdminRecord {
  id: string;
  title: string;
  description: string;
  materialType: MaterialType;
  status: MaterialStatus;
  createdAt: string;
  updatedAt: string;
  versions: MaterialAdminVersion[];
  mappings: MaterialAdminMapping[];
  entitlementSummary: MaterialEntitlementSummary;
}

export interface MaterialAdminConsole {
  generatedAt: string;
  summary: MaterialAdminSummary;
  programmes: MaterialAdminProgramme[];
  examinations: MaterialAdminExamination[];
  materials: MaterialAdminRecord[];
}

export interface MaterialInput {
  id?: string;
  title: string;
  description?: string;
  materialType: MaterialType;
  status?: Exclude<MaterialStatus, 'published'>;
}

export interface MaterialVersionInput {
  id?: string;
  materialId: string;
  versionLabel?: string;
  storageBucket: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256?: string;
}

export interface MaterialMappingInput {
  examinationId: string;
  materialId: string;
  position: number;
  isRequired: boolean;
  availableFrom?: string | null;
  expiresAt?: string | null;
  isActive: boolean;
}

export interface EntitlementReconciliation {
  examinationId?: string | null;
  assignmentsProcessed: number;
  activeEntitlements: number;
  scheduledEntitlements: number;
  expiredEntitlements: number;
  revokedEntitlements: number;
}

const cleanOptional = (value?: string | null): string | null => {
  const clean = value?.trim();
  return clean ? clean : null;
};

export async function getMaterialAdminConsole(): Promise<MaterialAdminConsole> {
  const { data, error } = await supabase.rpc('get_agilecert_material_admin_console');
  if (error) throw new Error(error.message);
  if (!data || typeof data !== 'object') {
    throw new Error('The preparation-material administration console was not returned.');
  }
  return data as MaterialAdminConsole;
}

export async function savePreparationMaterial(input: MaterialInput): Promise<void> {
  const payload = {
    title: input.title.trim(),
    description: cleanOptional(input.description),
    material_type: input.materialType,
    status: input.status || 'draft',
  };

  if (!payload.title) throw new Error('A material title is required.');

  if (input.id) {
    const { error } = await supabase
      .from('agilecert_preparation_materials')
      .update(payload)
      .eq('id', input.id);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await supabase.from('agilecert_preparation_materials').insert(payload);
  if (error) throw new Error(error.message);
}

async function nextVersionNumber(materialId: string): Promise<number> {
  const { data, error } = await supabase
    .from('agilecert_preparation_material_versions')
    .select('version_number')
    .eq('material_id', materialId)
    .order('version_number', { ascending: false })
    .limit(1);

  if (error) throw new Error(error.message);
  const latest = Array.isArray(data) && data[0] ? Number(data[0].version_number) : 0;
  return latest + 1;
}

export async function saveMaterialVersion(input: MaterialVersionInput): Promise<void> {
  if (!input.storageBucket.trim() || !input.storagePath.trim()) {
    throw new Error('Private storage bucket and path metadata are required.');
  }
  if (!input.fileName.trim() || !input.mimeType.trim()) {
    throw new Error('File name and MIME type are required.');
  }
  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes < 0) {
    throw new Error('File size must be zero or greater.');
  }

  const payload = {
    material_id: input.materialId,
    version_label: cleanOptional(input.versionLabel),
    storage_bucket: input.storageBucket.trim(),
    storage_path: input.storagePath.trim(),
    file_name: input.fileName.trim(),
    mime_type: input.mimeType.trim().toLowerCase(),
    size_bytes: Math.round(input.sizeBytes),
    checksum_sha256: cleanOptional(input.checksumSha256)?.toLowerCase() || null,
  };

  if (input.id) {
    const { error } = await supabase
      .from('agilecert_preparation_material_versions')
      .update(payload)
      .eq('id', input.id)
      .neq('status', 'published');
    if (error) throw new Error(error.message);
    return;
  }

  const versionNumber = await nextVersionNumber(input.materialId);
  const { error } = await supabase.from('agilecert_preparation_material_versions').insert({
    ...payload,
    version_number: versionNumber,
    status: 'draft',
  });
  if (error) throw new Error(error.message);
}

export async function setMaterialVersionStatus(
  versionId: string,
  status: MaterialVersionStatus,
): Promise<void> {
  const { error } = await supabase.rpc('set_agilecert_material_version_status', {
    p_version_id: versionId,
    p_status: status,
  });
  if (error) throw new Error(error.message);
}

export async function saveMaterialMapping(input: MaterialMappingInput): Promise<void> {
  if (!Number.isInteger(input.position) || input.position < 1) {
    throw new Error('Mapping position must be at least 1.');
  }
  if (input.availableFrom && input.expiresAt) {
    if (new Date(input.expiresAt).getTime() <= new Date(input.availableFrom).getTime()) {
      throw new Error('The expiry time must be later than the availability time.');
    }
  }

  const { error } = await supabase.from('agilecert_exam_materials').upsert(
    {
      examination_id: input.examinationId,
      material_id: input.materialId,
      position: input.position,
      is_required: input.isRequired,
      available_from: input.availableFrom || null,
      expires_at: input.expiresAt || null,
      is_active: input.isActive,
    },
    { onConflict: 'examination_id,material_id' },
  );
  if (error) throw new Error(error.message);
}

export async function removeMaterialMapping(
  examinationId: string,
  materialId: string,
): Promise<void> {
  const { error } = await supabase
    .from('agilecert_exam_materials')
    .delete()
    .eq('examination_id', examinationId)
    .eq('material_id', materialId);
  if (error) throw new Error(error.message);
}

export async function reconcileMaterialEntitlements(
  examinationId?: string,
): Promise<EntitlementReconciliation> {
  const { data, error } = await supabase.rpc('reconcile_agilecert_material_entitlements', {
    p_examination_id: examinationId || null,
  });
  if (error) throw new Error(error.message);
  if (!data || typeof data !== 'object') {
    throw new Error('The entitlement reconciliation result was not returned.');
  }
  return data as EntitlementReconciliation;
}

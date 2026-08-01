import { supabase } from '../lib/supabase';

export type CertificatePermissionKey =
  | 'certificate.console.view'
  | 'certificate.institutions.manage'
  | 'certificate.categories.manage'
  | 'certificate.templates.manage'
  | 'certificate.templates.review'
  | 'certificate.templates.approve'
  | 'certificate.templates.publish'
  | 'certificate.assets.manage'
  | 'certificate.assets.approve'
  | 'certificate.assignments.manage'
  | 'certificate.permissions.manage';

export type CertificateTemplateStatus = 'draft' | 'in_review' | 'approved' | 'published' | 'retired';
export type CertificateTemplateVersionStatus =
  | 'draft'
  | 'in_review'
  | 'changes_requested'
  | 'approved'
  | 'published'
  | 'superseded'
  | 'rejected'
  | 'retired';
export type CertificateQualityStatus = 'pending' | 'passed' | 'failed' | 'waived';
export type CertificateSourceFormat = 'pdf' | 'svg' | 'png' | 'jpeg';
export type CertificateAssetType = 'logo' | 'seal' | 'signature' | 'watermark' | 'background' | 'emblem' | 'other';
export type CertificateAssignmentScope = 'global' | 'programme' | 'examination';

export interface CertificateManagementAccess {
  actorId: string;
  role: string;
  permissions: CertificatePermissionKey[];
  canViewConsole: boolean;
  canManageInstitutions: boolean;
  canManageCategories: boolean;
  canManageTemplates: boolean;
  canReviewTemplates: boolean;
  canApproveTemplates: boolean;
  canPublishTemplates: boolean;
  canManageAssets: boolean;
  canApproveAssets: boolean;
  canManageAssignments: boolean;
  canManagePermissions: boolean;
}

export interface CertificateInstitution {
  id: string;
  code: string;
  name: string;
  shortName?: string | null;
  legalName?: string | null;
  registrationDetails?: string | null;
  countryCode: string;
  website?: string | null;
  contactEmail?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CertificateCategory {
  id: string;
  code: string;
  name: string;
  description: string;
  requiresIdentityVerification: boolean;
  requiresScore: boolean;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CertificateTemplate {
  id: string;
  institutionId: string;
  institutionCode: string;
  institutionName: string;
  categoryId: string;
  categoryCode: string;
  categoryName: string;
  code: string;
  name: string;
  description: string;
  orientation: 'portrait' | 'landscape';
  pageSize: 'A4' | 'Letter' | 'Legal' | 'Custom';
  status: CertificateTemplateStatus;
  currentVersionId?: string | null;
  currentVersionNumber?: number | null;
  requiredFields: string[];
  qualityStandard: Record<string, unknown>;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CertificateTemplateVersion {
  id: string;
  templateId: string;
  templateName: string;
  templateCode: string;
  institutionCode: string;
  categoryName: string;
  versionNumber: number;
  sourceFormat: CertificateSourceFormat;
  storageBucket: string;
  storagePath: string;
  originalFilename: string;
  mimeType: string;
  fileSizeBytes: number;
  sha256?: string | null;
  pageWidthPoints?: number | null;
  pageHeightPoints?: number | null;
  pixelWidth?: number | null;
  pixelHeight?: number | null;
  overlaySchema: unknown[];
  status: CertificateTemplateVersionStatus;
  qualityStatus: CertificateQualityStatus;
  qualityReport: Record<string, unknown>;
  notes?: string | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  approvedAt?: string | null;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CertificateAsset {
  id: string;
  institutionId: string;
  institutionCode: string;
  institutionName: string;
  assetType: CertificateAssetType;
  name: string;
  versionNumber: number;
  storageBucket: string;
  storagePath: string;
  originalFilename: string;
  mimeType: string;
  fileSizeBytes: number;
  pixelWidth?: number | null;
  pixelHeight?: number | null;
  sha256?: string | null;
  status: 'draft' | 'approved' | 'retired' | 'rejected';
  reviewNotes?: string | null;
  approvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CertificateTemplateAssignment {
  id: string;
  categoryId: string;
  categoryCode: string;
  categoryName: string;
  templateId: string;
  templateName: string;
  templateCode: string;
  institutionCode: string;
  templateVersionId: string;
  versionNumber: number;
  scopeType: CertificateAssignmentScope;
  programmeId?: string | null;
  programmeCode?: string | null;
  programmeName?: string | null;
  examinationId?: string | null;
  examinationTitle?: string | null;
  priority: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CertificateProgrammeOption {
  id: string;
  code: string;
  name: string;
}

export interface CertificateExaminationOption {
  id: string;
  programmeId?: string | null;
  programmeCode?: string | null;
  code?: string | null;
  title: string;
}

export interface CertificatePermissionGrant {
  permissionKey: CertificatePermissionKey;
  name: string;
  description: string;
  category: string;
  riskLevel: 'standard' | 'sensitive' | 'restricted';
  isGranted: boolean;
  updatedAt?: string | null;
}

export interface CertificateTemplateAuditEvent {
  id: number;
  actorId?: string | null;
  actorName?: string | null;
  entityType: string;
  entityId?: string | null;
  action: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface CertificateManagementSnapshot {
  access: CertificateManagementAccess;
  summary: {
    institutions: number;
    categories: number;
    templates: number;
    publishedTemplates: number;
    versionsAwaitingReview: number;
    approvedAssets: number;
    activeAssignments: number;
  };
  institutions: CertificateInstitution[];
  categories: CertificateCategory[];
  templates: CertificateTemplate[];
  versions: CertificateTemplateVersion[];
  assets: CertificateAsset[];
  assignments: CertificateTemplateAssignment[];
  programmes: CertificateProgrammeOption[];
  examinations: CertificateExaminationOption[];
  permissionMatrix: CertificatePermissionGrant[];
  audit: CertificateTemplateAuditEvent[];
}

const emptyAccess: CertificateManagementAccess = {
  actorId: '',
  role: '',
  permissions: [],
  canViewConsole: false,
  canManageInstitutions: false,
  canManageCategories: false,
  canManageTemplates: false,
  canReviewTemplates: false,
  canApproveTemplates: false,
  canPublishTemplates: false,
  canManageAssets: false,
  canApproveAssets: false,
  canManageAssignments: false,
  canManagePermissions: false,
};

const emptySnapshot: CertificateManagementSnapshot = {
  access: emptyAccess,
  summary: {
    institutions: 0,
    categories: 0,
    templates: 0,
    publishedTemplates: 0,
    versionsAwaitingReview: 0,
    approvedAssets: 0,
    activeAssignments: 0,
  },
  institutions: [],
  categories: [],
  templates: [],
  versions: [],
  assets: [],
  assignments: [],
  programmes: [],
  examinations: [],
  permissionMatrix: [],
  audit: [],
};

const assertObject = <T>(value: unknown, message: string): T => {
  if (!value || typeof value !== 'object') throw new Error(message);
  return value as T;
};

export async function getCertificateManagementAccess(): Promise<CertificateManagementAccess> {
  const { data, error } = await supabase.rpc('get_my_certificate_management_access');
  if (error) throw new Error(error.message);
  return assertObject<CertificateManagementAccess>(data, 'Certificate Management Console access was not returned.');
}

export async function getCertificateManagementSnapshot(limit = 300): Promise<CertificateManagementSnapshot> {
  const { data, error } = await supabase.rpc('get_certificate_management_console_snapshot', {
    p_limit: limit,
  });
  if (error) throw new Error(error.message);
  if (!data || typeof data !== 'object') return emptySnapshot;
  const payload = data as Partial<CertificateManagementSnapshot>;
  return {
    ...emptySnapshot,
    ...payload,
    access: { ...emptyAccess, ...(payload.access || {}) },
    summary: { ...emptySnapshot.summary, ...(payload.summary || {}) },
    institutions: Array.isArray(payload.institutions) ? payload.institutions : [],
    categories: Array.isArray(payload.categories) ? payload.categories : [],
    templates: Array.isArray(payload.templates) ? payload.templates : [],
    versions: Array.isArray(payload.versions) ? payload.versions : [],
    assets: Array.isArray(payload.assets) ? payload.assets : [],
    assignments: Array.isArray(payload.assignments) ? payload.assignments : [],
    programmes: Array.isArray(payload.programmes) ? payload.programmes : [],
    examinations: Array.isArray(payload.examinations) ? payload.examinations : [],
    permissionMatrix: Array.isArray(payload.permissionMatrix) ? payload.permissionMatrix : [],
    audit: Array.isArray(payload.audit) ? payload.audit : [],
  };
}

export async function saveCertificateInstitution(input: {
  id?: string | null;
  code: string;
  name: string;
  shortName?: string;
  legalName?: string;
  registrationDetails?: string;
  countryCode?: string;
  website?: string;
  contactEmail?: string;
  isActive?: boolean;
}): Promise<void> {
  const { error } = await supabase.rpc('certificate_admin_upsert_institution', {
    p_id: input.id || null,
    p_code: input.code,
    p_name: input.name,
    p_short_name: input.shortName || null,
    p_legal_name: input.legalName || null,
    p_registration_details: input.registrationDetails || null,
    p_country_code: input.countryCode || 'NG',
    p_website: input.website || null,
    p_contact_email: input.contactEmail || null,
    p_is_active: input.isActive ?? true,
  });
  if (error) throw new Error(error.message);
}

export async function saveCertificateCategory(input: {
  id?: string | null;
  code: string;
  name: string;
  description?: string;
  requiresIdentityVerification?: boolean;
  requiresScore?: boolean;
  sortOrder?: number;
  isActive?: boolean;
}): Promise<void> {
  const { error } = await supabase.rpc('certificate_admin_upsert_category', {
    p_id: input.id || null,
    p_code: input.code,
    p_name: input.name,
    p_description: input.description || '',
    p_requires_identity_verification: input.requiresIdentityVerification ?? false,
    p_requires_score: input.requiresScore ?? false,
    p_sort_order: input.sortOrder ?? 100,
    p_is_active: input.isActive ?? true,
  });
  if (error) throw new Error(error.message);
}

export async function createCertificateTemplate(input: {
  institutionId: string;
  categoryId: string;
  code: string;
  name: string;
  description?: string;
  orientation?: 'portrait' | 'landscape';
  pageSize?: 'A4' | 'Letter' | 'Legal' | 'Custom';
  notes?: string;
}): Promise<{ id: string }> {
  const { data, error } = await supabase.rpc('certificate_admin_create_template', {
    p_institution_id: input.institutionId,
    p_category_id: input.categoryId,
    p_code: input.code,
    p_name: input.name,
    p_description: input.description || '',
    p_orientation: input.orientation || 'landscape',
    p_page_size: input.pageSize || 'A4',
    p_notes: input.notes || null,
  });
  if (error) throw new Error(error.message);
  return assertObject<{ id: string }>(data, 'The certificate template was not returned.');
}

const safeFilename = (name: string): string => {
  const cleaned = name
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return cleaned || 'certificate-file';
};

const fileHash = async (file: File): Promise<string | null> => {
  if (!globalThis.crypto?.subtle) return null;
  const digest = await globalThis.crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, '0')).join('');
};

const imageDimensions = async (file: File): Promise<{ width: number | null; height: number | null }> => {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
    return { width: null, height: null };
  }
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const result = { width: image.naturalWidth || null, height: image.naturalHeight || null };
      URL.revokeObjectURL(url);
      resolve(result);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ width: null, height: null });
    };
    image.src = url;
  });
};

const sourceFormat = (file: File): CertificateSourceFormat => {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (file.type === 'application/pdf' || extension === 'pdf') return 'pdf';
  if (file.type === 'image/svg+xml' || extension === 'svg') return 'svg';
  if (file.type === 'image/png' || extension === 'png') return 'png';
  if (['image/jpeg', 'image/jpg'].includes(file.type) || ['jpg', 'jpeg'].includes(extension || '')) return 'jpeg';
  throw new Error('Upload a PDF, SVG, PNG or JPEG certificate master.');
};

export async function uploadCertificateMaster(input: {
  templateId: string;
  file: File;
  notes?: string;
}): Promise<void> {
  if (input.file.size <= 0) throw new Error('The selected master file is empty.');
  if (input.file.size > 25 * 1024 * 1024) throw new Error('Certificate master files must not exceed 25 MB.');

  const format = sourceFormat(input.file);
  const [sha256, dimensions] = await Promise.all([fileHash(input.file), imageDimensions(input.file)]);
  const objectPath = `templates/${input.templateId}/${Date.now()}-${crypto.randomUUID()}-${safeFilename(input.file.name)}`;
  const upload = await supabase.storage.from('certificate-masters').upload(objectPath, input.file, {
    cacheControl: '31536000',
    contentType: input.file.type || undefined,
    upsert: false,
  });
  if (upload.error) throw new Error(`Certificate master upload failed: ${upload.error.message}`);

  const { error } = await supabase.rpc('certificate_admin_register_template_version', {
    p_template_id: input.templateId,
    p_source_format: format,
    p_storage_bucket: 'certificate-masters',
    p_storage_path: upload.data.path,
    p_original_filename: input.file.name,
    p_mime_type: input.file.type || `application/${format}`,
    p_file_size_bytes: input.file.size,
    p_sha256: sha256,
    p_pixel_width: dimensions.width,
    p_pixel_height: dimensions.height,
    p_notes: input.notes || null,
  });
  if (error) throw new Error(error.message);
}

export async function uploadCertificateAsset(input: {
  institutionId: string;
  institutionCode: string;
  assetType: CertificateAssetType;
  name: string;
  file: File;
}): Promise<void> {
  if (input.file.size <= 0) throw new Error('The selected asset file is empty.');
  if (input.file.size > 10 * 1024 * 1024) throw new Error('Certificate assets must not exceed 10 MB.');
  sourceFormat(input.file);

  const [sha256, dimensions] = await Promise.all([fileHash(input.file), imageDimensions(input.file)]);
  const objectPath = `institutions/${safeFilename(input.institutionCode)}/${input.assetType}/${Date.now()}-${crypto.randomUUID()}-${safeFilename(input.file.name)}`;
  const upload = await supabase.storage.from('certificate-assets').upload(objectPath, input.file, {
    cacheControl: '31536000',
    contentType: input.file.type || undefined,
    upsert: false,
  });
  if (upload.error) throw new Error(`Certificate asset upload failed: ${upload.error.message}`);

  const { error } = await supabase.rpc('certificate_admin_register_asset', {
    p_institution_id: input.institutionId,
    p_asset_type: input.assetType,
    p_name: input.name,
    p_storage_bucket: 'certificate-assets',
    p_storage_path: upload.data.path,
    p_original_filename: input.file.name,
    p_mime_type: input.file.type || 'application/octet-stream',
    p_file_size_bytes: input.file.size,
    p_sha256: sha256,
    p_pixel_width: dimensions.width,
    p_pixel_height: dimensions.height,
  });
  if (error) throw new Error(error.message);
}

export async function createCertificateFileSignedUrl(
  bucket: string,
  path: string,
  expiresInSeconds = 300,
): Promise<string> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
  if (error) throw new Error(error.message);
  if (!data.signedUrl) throw new Error('The private certificate file URL was not returned.');
  return data.signedUrl;
}

export async function reviewCertificateTemplateQuality(input: {
  versionId: string;
  qualityStatus: Exclude<CertificateQualityStatus, 'pending'>;
  report: Record<string, unknown>;
  notes?: string;
}): Promise<void> {
  const { error } = await supabase.rpc('certificate_admin_record_quality_review', {
    p_version_id: input.versionId,
    p_quality_status: input.qualityStatus,
    p_report: input.report,
    p_notes: input.notes || null,
  });
  if (error) throw new Error(error.message);
}

export async function transitionCertificateTemplateVersion(input: {
  versionId: string;
  action: 'submit_review' | 'request_changes' | 'reject' | 'approve' | 'publish' | 'retire';
  notes?: string;
}): Promise<void> {
  const { error } = await supabase.rpc('certificate_admin_transition_template_version', {
    p_version_id: input.versionId,
    p_action: input.action,
    p_notes: input.notes || null,
  });
  if (error) throw new Error(error.message);
}

export async function setCertificateAssetStatus(input: {
  assetId: string;
  status: 'approved' | 'rejected' | 'retired';
  notes?: string;
}): Promise<void> {
  const { error } = await supabase.rpc('certificate_admin_set_asset_status', {
    p_asset_id: input.assetId,
    p_status: input.status,
    p_notes: input.notes || null,
  });
  if (error) throw new Error(error.message);
}

export async function assignCertificateTemplate(input: {
  templateId: string;
  templateVersionId: string;
  scopeType: CertificateAssignmentScope;
  programmeId?: string | null;
  examinationId?: string | null;
  priority?: number;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
}): Promise<void> {
  const { error } = await supabase.rpc('certificate_admin_assign_template', {
    p_template_id: input.templateId,
    p_template_version_id: input.templateVersionId,
    p_scope_type: input.scopeType,
    p_programme_id: input.programmeId || null,
    p_examination_id: input.examinationId || null,
    p_priority: input.priority ?? 100,
    p_effective_from: input.effectiveFrom || new Date().toISOString(),
    p_effective_to: input.effectiveTo || null,
  });
  if (error) throw new Error(error.message);
}

export async function setCertificateAssignmentActive(input: {
  assignmentId: string;
  isActive: boolean;
  reason: string;
}): Promise<void> {
  const { error } = await supabase.rpc('certificate_admin_set_assignment_active', {
    p_assignment_id: input.assignmentId,
    p_is_active: input.isActive,
    p_reason: input.reason,
  });
  if (error) throw new Error(error.message);
}

export async function setCertificatePermission(input: {
  permissionKey: CertificatePermissionKey;
  isGranted: boolean;
  reason: string;
}): Promise<void> {
  const { error } = await supabase.rpc('certificate_admin_set_permission', {
    p_permission_key: input.permissionKey,
    p_is_granted: input.isGranted,
    p_reason: input.reason,
  });
  if (error) throw new Error(error.message);
}

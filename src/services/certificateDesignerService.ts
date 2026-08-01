import QRCode from 'qrcode';
import { supabase } from '../lib/supabase';
import {
  createCertificateFileSignedUrl,
  type CertificateAssetType,
  type CertificateManagementAccess,
  type CertificateQualityStatus,
  type CertificateSourceFormat,
  type CertificateTemplateVersionStatus,
} from './certificateTemplateAdminService';

export type CertificateDesignerDataType = 'text' | 'date' | 'number' | 'qr' | 'asset';
export type CertificateDesignerTextAlign = 'left' | 'center' | 'right';
export type CertificateDesignerFontFamily = 'serif' | 'sans' | 'mono';

export interface CertificateDesignerFieldDefinition {
  fieldKey: string;
  label: string;
  description: string;
  dataType: CertificateDesignerDataType;
  category: string;
  sampleValue: string;
  defaultStyle: Record<string, unknown>;
  sortOrder: number;
  isRequiredDefault: boolean;
}

export interface CertificateDesignerVersion {
  id: string;
  templateId: string;
  templateName: string;
  templateCode: string;
  institutionId: string;
  institutionCode: string;
  institutionName: string;
  categoryId: string;
  categoryCode: string;
  categoryName: string;
  orientation: 'portrait' | 'landscape';
  pageSize: 'A4' | 'Letter' | 'Legal' | 'Custom';
  requiredFields: string[];
  versionNumber: number;
  sourceFormat: CertificateSourceFormat;
  storageBucket: string;
  storagePath: string;
  originalFilename: string;
  mimeType: string;
  pageWidthPoints?: number | null;
  pageHeightPoints?: number | null;
  pixelWidth?: number | null;
  pixelHeight?: number | null;
  overlaySchema: CertificateDesignElement[];
  designerSchemaVersion: number;
  designerUpdatedAt?: string | null;
  status: CertificateTemplateVersionStatus;
  qualityStatus: CertificateQualityStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CertificateDesignerAsset {
  id: string;
  institutionId: string;
  institutionCode: string;
  assetType: CertificateAssetType;
  name: string;
  versionNumber: number;
  storageBucket: string;
  storagePath: string;
  originalFilename: string;
  mimeType: string;
  pixelWidth?: number | null;
  pixelHeight?: number | null;
  sha256?: string | null;
  status: 'approved';
}

export interface CertificateDesignElement {
  id: string;
  fieldKey: string;
  label: string;
  dataType: CertificateDesignerDataType;
  xPct: number;
  yPct: number;
  widthPct: number;
  heightPct: number;
  fontSizePt: number;
  fontFamily: CertificateDesignerFontFamily;
  fontWeight: number;
  textAlign: CertificateDesignerTextAlign;
  color: string;
  lineHeight: number;
  letterSpacing: number;
  rotation: number;
  opacity: number;
  uppercase: boolean;
  prefix: string;
  suffix: string;
  customText: string;
  assetId?: string | null;
}

export interface CertificateDesignerPreviewProfile {
  versionId: string;
  samplePayload: Record<string, string>;
  previewOptions: {
    showSafeArea?: boolean;
    showGrid?: boolean;
    zoom?: number;
    backgroundMode?: 'master' | 'plain';
  };
  lastValidationReport: CertificateDesignValidation;
  updatedAt: string;
}

export interface CertificateDesignValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  missingRequiredFields: string[];
  elementCount: number;
  schemaVersion?: number;
}

export interface CertificateDesignerSnapshot {
  access: CertificateManagementAccess;
  fieldDefinitions: CertificateDesignerFieldDefinition[];
  versions: CertificateDesignerVersion[];
  assets: CertificateDesignerAsset[];
  previewProfiles: CertificateDesignerPreviewProfile[];
}

const emptySnapshot: CertificateDesignerSnapshot = {
  access: {
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
  },
  fieldDefinitions: [],
  versions: [],
  assets: [],
  previewProfiles: [],
};

const toNumber = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const clamp = (value: number, minimum: number, maximum: number): number => (
  Math.min(maximum, Math.max(minimum, value))
);

export const normaliseDesignElement = (
  element: Partial<CertificateDesignElement>,
  definition?: CertificateDesignerFieldDefinition,
): CertificateDesignElement => {
  const style = definition?.defaultStyle || {};
  const dataType = element.dataType || definition?.dataType || 'text';
  return {
    id: element.id || crypto.randomUUID(),
    fieldKey: element.fieldKey || definition?.fieldKey || 'customText',
    label: element.label || definition?.label || 'Custom approved text',
    dataType,
    xPct: clamp(toNumber(element.xPct, 20), 0, 98),
    yPct: clamp(toNumber(element.yPct, 20), 0, 98),
    widthPct: clamp(toNumber(element.widthPct ?? style.widthPct, dataType === 'asset' || dataType === 'qr' ? 12 : 60), 2, 100),
    heightPct: clamp(toNumber(element.heightPct ?? style.heightPct, dataType === 'asset' || dataType === 'qr' ? 16 : 8), 2, 100),
    fontSizePt: clamp(toNumber(element.fontSizePt ?? style.fontSizePt, 12), 4, 160),
    fontFamily: (element.fontFamily || style.fontFamily || 'sans') as CertificateDesignerFontFamily,
    fontWeight: clamp(toNumber(element.fontWeight ?? style.fontWeight, 500), 100, 900),
    textAlign: (element.textAlign || style.textAlign || 'center') as CertificateDesignerTextAlign,
    color: element.color || String(style.color || '#0f172a'),
    lineHeight: clamp(toNumber(element.lineHeight ?? style.lineHeight, 1.15), 0.8, 3),
    letterSpacing: clamp(toNumber(element.letterSpacing ?? style.letterSpacing, 0), -2, 12),
    rotation: clamp(toNumber(element.rotation, 0), -180, 180),
    opacity: clamp(toNumber(element.opacity, 1), 0.05, 1),
    uppercase: Boolean(element.uppercase ?? style.uppercase ?? false),
    prefix: element.prefix || '',
    suffix: element.suffix || '',
    customText: element.customText || '',
    assetId: element.assetId || null,
  };
};

export async function getCertificateDesignerSnapshot(
  versionId?: string | null,
): Promise<CertificateDesignerSnapshot> {
  const { data, error } = await supabase.rpc('get_certificate_template_designer_snapshot', {
    p_version_id: versionId || null,
  });
  if (error) throw new Error(error.message);
  if (!data || typeof data !== 'object') return emptySnapshot;
  const payload = data as Partial<CertificateDesignerSnapshot>;
  return {
    ...emptySnapshot,
    ...payload,
    access: { ...emptySnapshot.access, ...(payload.access || {}) },
    fieldDefinitions: Array.isArray(payload.fieldDefinitions) ? payload.fieldDefinitions : [],
    versions: Array.isArray(payload.versions)
      ? payload.versions.map((version) => ({
          ...version,
          requiredFields: Array.isArray(version.requiredFields) ? version.requiredFields : [],
          overlaySchema: Array.isArray(version.overlaySchema)
            ? version.overlaySchema.map((element) => normaliseDesignElement(element))
            : [],
        }))
      : [],
    assets: Array.isArray(payload.assets) ? payload.assets : [],
    previewProfiles: Array.isArray(payload.previewProfiles) ? payload.previewProfiles : [],
  };
}

export async function saveCertificateTemplateDesign(input: {
  versionId: string;
  overlaySchema: CertificateDesignElement[];
  samplePayload: Record<string, string>;
  previewOptions: CertificateDesignerPreviewProfile['previewOptions'];
  pageWidthPoints?: number | null;
  pageHeightPoints?: number | null;
  notes?: string;
}): Promise<{ validation: CertificateDesignValidation }> {
  const { data, error } = await supabase.rpc('certificate_admin_save_template_design', {
    p_version_id: input.versionId,
    p_overlay_schema: input.overlaySchema,
    p_sample_payload: input.samplePayload,
    p_preview_options: input.previewOptions,
    p_page_width_points: input.pageWidthPoints ?? null,
    p_page_height_points: input.pageHeightPoints ?? null,
    p_notes: input.notes || null,
  });
  if (error) throw new Error(error.message);
  if (!data || typeof data !== 'object') {
    throw new Error('The saved certificate design was not returned.');
  }
  return data as { validation: CertificateDesignValidation };
}

export async function validateCertificateTemplateDesign(
  versionId: string,
  overlaySchema: CertificateDesignElement[],
): Promise<CertificateDesignValidation> {
  const { data, error } = await supabase.rpc('certificate_designer_validate_overlay', {
    p_version_id: versionId,
    p_overlay_schema: overlaySchema,
  });
  if (error) throw new Error(error.message);
  if (!data || typeof data !== 'object') {
    throw new Error('The certificate design validation report was not returned.');
  }
  return data as CertificateDesignValidation;
}

export async function createCertificateDesignerSignedUrl(
  bucket: string,
  path: string,
  expiresInSeconds = 600,
): Promise<string> {
  return createCertificateFileSignedUrl(bucket, path, expiresInSeconds);
}

export async function createCertificateQrPreview(value: string): Promise<string> {
  return QRCode.toDataURL(value || 'https://agilecert.iipmi.org/verify', {
    width: 512,
    margin: 1,
    errorCorrectionLevel: 'M',
  });
}

export const defaultSamplePayload = (
  definitions: CertificateDesignerFieldDefinition[],
): Record<string, string> => Object.fromEntries(
  definitions.map((definition) => [definition.fieldKey, definition.sampleValue || definition.label]),
);

export const certificatePageRatio = (version?: CertificateDesignerVersion | null): number => {
  if (!version) return 297 / 210;
  if (version.pageWidthPoints && version.pageHeightPoints) {
    return version.pageWidthPoints / version.pageHeightPoints;
  }
  if (version.pixelWidth && version.pixelHeight) {
    return version.pixelWidth / version.pixelHeight;
  }
  return version.orientation === 'portrait' ? 210 / 297 : 297 / 210;
};

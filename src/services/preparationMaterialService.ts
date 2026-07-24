import { supabase } from '../lib/supabase';

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

export async function getMyPreparationMaterials(): Promise<CandidatePreparationMaterial[]> {
  const { data, error } = await supabase.rpc('get_my_agilecert_preparation_materials');

  if (error) {
    throw new Error(`Unable to load preparation materials: ${error.message}`);
  }

  return Array.isArray(data) ? (data as CandidatePreparationMaterial[]) : [];
}

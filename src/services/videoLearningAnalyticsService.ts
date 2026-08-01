import { supabase } from '../lib/supabase';

export interface CandidateVideoLearningProgress {
  candidateId: string;
  examinationId: string;
  examinationTitle: string;
  programmeCode: string;
  materialId: string;
  materialTitle: string;
  position: number;
  firstOpenedAt?: string | null;
  lastOpenedAt?: string | null;
  openCount: number;
  engagedSeconds: number;
  lastPositionSeconds?: number | null;
  durationSeconds?: number | null;
  completionPercent: number;
  completed: boolean;
  completedAt?: string | null;
  completionSource?: 'manual' | 'player' | 'administrator' | null;
  provider: string;
  exactResumeSupported: boolean;
  progressMode: 'authorisation_and_manual_completion' | 'player_progress';
}

export interface AdminVideoLearningAnalyticsRecord {
  candidateId: string;
  candidateName: string;
  email: string;
  candidateCode?: string | null;
  programmeCode: string;
  examinationId: string;
  examinationTitle: string;
  materialId: string;
  materialTitle: string;
  firstOpenedAt?: string | null;
  lastOpenedAt?: string | null;
  openCount: number;
  engagedSeconds: number;
  lastPositionSeconds?: number | null;
  durationSeconds?: number | null;
  completionPercent: number;
  completed: boolean;
  completedAt?: string | null;
  completionSource?: string | null;
  provider: string;
  exactResumeSupported: boolean;
}

export interface AdminVideoLearningAnalyticsSummary {
  lessonRecords: number;
  engagedCandidates: number;
  authorisedOpens: number;
  completedLessons: number;
  activeLast30Days: number;
  completionRate: number;
  exactResumeSupportedForGoogleDrive: boolean;
}

export interface AdminVideoLearningAnalyticsResponse {
  summary: AdminVideoLearningAnalyticsSummary;
  total: number;
  records: AdminVideoLearningAnalyticsRecord[];
}

export async function getMyVideoLearningProgress(): Promise<CandidateVideoLearningProgress[]> {
  const { data, error } = await supabase.rpc('get_my_agilecert_video_learning_progress');
  if (error) throw new Error(`Unable to load video learning progress: ${error.message}`);
  return Array.isArray(data) ? data as CandidateVideoLearningProgress[] : [];
}

export async function setMyVideoLessonCompletion(input: {
  examinationId: string;
  materialId: string;
  completed: boolean;
}): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.rpc('set_my_agilecert_video_lesson_completion', {
    p_examination_id: input.examinationId,
    p_material_id: input.materialId,
    p_completed: input.completed,
  });
  if (error) throw new Error(`Unable to update lesson completion: ${error.message}`);
  return (data || {}) as Record<string, unknown>;
}

export async function getAdminVideoLearningAnalytics(input: {
  programmeCode?: string;
  search?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<AdminVideoLearningAnalyticsResponse> {
  const { data, error } = await supabase.rpc('get_agilecert_video_learning_analytics', {
    p_programme_code: input.programmeCode?.trim() || null,
    p_search: input.search?.trim() || null,
    p_limit: input.limit || 500,
    p_offset: input.offset || 0,
  });
  if (error) throw new Error(`Unable to load video learning analytics: ${error.message}`);

  const payload = (data || {}) as Record<string, unknown>;
  const summary = (payload.summary || {}) as Record<string, unknown>;
  return {
    summary: {
      lessonRecords: Number(summary.lessonRecords || 0),
      engagedCandidates: Number(summary.engagedCandidates || 0),
      authorisedOpens: Number(summary.authorisedOpens || 0),
      completedLessons: Number(summary.completedLessons || 0),
      activeLast30Days: Number(summary.activeLast30Days || 0),
      completionRate: Number(summary.completionRate || 0),
      exactResumeSupportedForGoogleDrive: Boolean(summary.exactResumeSupportedForGoogleDrive),
    },
    total: Number(payload.total || 0),
    records: Array.isArray(payload.records)
      ? payload.records as AdminVideoLearningAnalyticsRecord[]
      : [],
  };
}

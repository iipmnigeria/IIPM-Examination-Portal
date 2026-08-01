import { supabase } from '../lib/supabase';

export interface CertificateRendererAccess {
  canManageRenderer: boolean;
}

export interface CertificateRendererAssignment {
  id: string;
  scopeType: 'global' | 'programme' | 'examination';
  programmeId: string | null;
  programmeCode: string | null;
  programmeName: string | null;
  examinationId: string | null;
  examinationCode: string | null;
  examinationTitle: string | null;
  priority: number;
  isActive: boolean;
  rendererEnabled: boolean;
  rendererEnabledAt: string | null;
  rendererDisabledAt: string | null;
  rendererReason: string | null;
  templateCode: string;
  templateName: string;
  categoryCode: string;
  categoryName: string;
  institutionCode: string;
  institutionName: string;
  versionId: string;
  versionNumber: number;
  sourceFormat: 'pdf' | 'svg' | 'png' | 'jpeg';
  versionStatus: string;
  qualityStatus: string;
  sourceSha256: string | null;
  overlayElementCount: number;
  bindingCount: number;
  createdAt: string;
}

export interface CertificateRendererJob {
  id: string;
  certificateId: string;
  certificateNumber: string;
  holderName: string;
  renderMode: 'managed' | 'legacy_fallback';
  status: 'requested' | 'rendered' | 'failed' | 'legacy_fallback';
  categoryCode: string;
  rendererVersion: string | null;
  outputSizeBytes: number | null;
  outputPageCount: number | null;
  failureCode: string | null;
  requestedAt: string;
  completedAt: string | null;
}

export interface CertificateRendererConsoleSnapshot {
  access: CertificateRendererAccess;
  assignments: CertificateRendererAssignment[];
  recentJobs: CertificateRendererJob[];
}

const emptySnapshot: CertificateRendererConsoleSnapshot = {
  access: { canManageRenderer: false },
  assignments: [],
  recentJobs: [],
};

export async function getCertificateRendererConsoleSnapshot(
  limit = 100,
): Promise<CertificateRendererConsoleSnapshot> {
  const { data, error } = await supabase.rpc(
    'get_certificate_renderer_console_snapshot',
    { p_limit: limit },
  );
  if (error) throw new Error(`Unable to load server-rendering controls: ${error.message}`);
  if (!data || typeof data !== 'object') return emptySnapshot;

  const snapshot = data as Partial<CertificateRendererConsoleSnapshot>;
  return {
    access: snapshot.access || emptySnapshot.access,
    assignments: Array.isArray(snapshot.assignments) ? snapshot.assignments : [],
    recentJobs: Array.isArray(snapshot.recentJobs) ? snapshot.recentJobs : [],
  };
}

export async function setCertificateAssignmentRendererEnabled(input: {
  assignmentId: string;
  enabled: boolean;
  reason: string;
}): Promise<void> {
  const reason = input.reason.trim();
  if (reason.length < 8) {
    throw new Error('Enter an activation or suspension reason of at least 8 characters.');
  }

  const { error } = await supabase.rpc(
    'certificate_admin_set_assignment_renderer_enabled',
    {
      p_assignment_id: input.assignmentId,
      p_enabled: input.enabled,
      p_reason: reason,
    },
  );
  if (error) throw new Error(error.message);
}

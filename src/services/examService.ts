import { supabase } from '../lib/supabase';
import type { Attempt, ProctorLogEvent, Test } from '../types';

function browserFingerprint(): Record<string, unknown> {
  if (typeof window === 'undefined') return {};

  return {
    userAgent: navigator.userAgent,
    language: navigator.language,
    platform: navigator.platform,
    screen: {
      width: window.screen.width,
      height: window.screen.height,
      pixelRatio: window.devicePixelRatio,
    },
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

export async function getAvailableTests(): Promise<Test[]> {
  const { data, error } = await supabase.rpc('get_available_exams');
  if (error) throw new Error(`Unable to load examinations: ${error.message}`);
  return Array.isArray(data) ? (data as Test[]) : [];
}

export async function startSecureExam(examinationId: string): Promise<Test> {
  const { data, error } = await supabase.rpc('start_exam_secure', {
    p_examination_id: examinationId,
    p_client_fingerprint: browserFingerprint(),
  });

  if (error) throw new Error(error.message);
  if (!data || typeof data !== 'object') throw new Error('The examination session could not be created.');
  return data as Test;
}

export async function getPortalAttempts(): Promise<Attempt[]> {
  const { data, error } = await supabase.rpc('get_portal_attempts');
  if (error) throw new Error(`Unable to load examination attempts: ${error.message}`);
  return Array.isArray(data) ? (data as Attempt[]) : [];
}

export async function submitSecureExam(input: {
  sessionId: string;
  answers: Record<string, number>;
  logs: ProctorLogEvent[];
  tabAwayCount: number;
}): Promise<Attempt> {
  const safeLogs = input.logs.map(({ snapshotUrl: _snapshotUrl, ...log }) => log);

  const { data, error } = await supabase.rpc('submit_exam_secure', {
    p_session_id: input.sessionId,
    p_answers: input.answers,
    p_logs: safeLogs,
    p_tab_away_count: input.tabAwayCount,
  });

  if (error) throw new Error(error.message);
  if (!data || typeof data !== 'object') throw new Error('The assessment result was not returned.');
  return data as Attempt;
}

export async function assignExamToCandidate(input: {
  examinationId: string;
  candidateEmail: string;
  availableFrom?: string | null;
  expiresAt?: string | null;
  maxAttempts?: number | null;
}): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.rpc('assign_exam_to_candidate', {
    p_examination_id: input.examinationId,
    p_candidate_email: input.candidateEmail.trim().toLowerCase(),
    p_available_from: input.availableFrom || new Date().toISOString(),
    p_expires_at: input.expiresAt || null,
    p_max_attempts: input.maxAttempts || null,
  });

  if (error) throw new Error(error.message);
  return (data || {}) as Record<string, unknown>;
}

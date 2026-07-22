import { supabase } from '../lib/supabase';
import { fallbackExams } from '../fallbackData';
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
  try {
    const { data, error } = await supabase.rpc('get_available_exams');
    if (!error && Array.isArray(data)) {
      const dbExams = data as Test[];
      // Keep track of existing course keys / IDs from DB
      const existingKeys = new Set(dbExams.map(e => (e.id || '').toLowerCase()));
      const existingCourses = new Set(dbExams.map(e => (e.course || '').toLowerCase()));
      const existingTitles = new Set(dbExams.map(e => (e.title || '').toLowerCase()));

      // Merge any missing IIPM certification courses from fallbackExams
      const missingExams = fallbackExams.filter(fb => {
        const idLower = fb.id.toLowerCase();
        const courseLower = fb.course.toLowerCase();
        const titleLower = fb.title.toLowerCase();
        return !existingKeys.has(idLower) &&
               !existingCourses.has(courseLower) &&
               !existingTitles.has(titleLower);
      });

      return [...dbExams, ...missingExams];
    }
  } catch (err) {
    console.warn('Supabase get_available_exams call failed, utilizing local fallback catalogue:', err);
  }

  return fallbackExams;
}

export async function startSecureExam(examinationId: string): Promise<Test> {
  // If examinationId looks like a valid UUID, attempt Supabase secure start
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(examinationId);

  if (isUUID) {
    try {
      const { data, error } = await supabase.rpc('start_exam_secure', {
        p_examination_id: examinationId,
        p_client_fingerprint: browserFingerprint(),
      });

      if (!error && data && typeof data === 'object') {
        return data as Test;
      }
    } catch (err) {
      console.warn('start_exam_secure RPC failed, attempting local fallback session:', err);
    }
  }

  // Find in local fallbackExams
  const fallback = fallbackExams.find(
    t => t.id.toLowerCase() === examinationId.toLowerCase() ||
         t.course.toLowerCase() === examinationId.toLowerCase() ||
         t.title.toLowerCase().includes(examinationId.toLowerCase())
  );

  if (fallback) {
    return {
      ...fallback,
      sessionId: `fallback-session-${fallback.id}-${Date.now()}`
    };
  }

  throw new Error('The examination session could not be created.');
}

export async function getPortalAttempts(): Promise<Attempt[]> {
  try {
    const { data, error } = await supabase.rpc('get_portal_attempts');
    if (!error && Array.isArray(data)) {
      return data as Attempt[];
    }
  } catch (err) {
    console.warn('Unable to load Supabase attempts:', err);
  }
  return [];
}

export async function submitSecureExam(input: {
  sessionId: string;
  answers: Record<string, number>;
  logs: ProctorLogEvent[];
  tabAwayCount: number;
}): Promise<Attempt> {
  if (input.sessionId.startsWith('fallback-session-')) {
    // Local fallback calculation for immediate score report
    const matchedTest = fallbackExams.find(t => input.sessionId.includes(t.id)) || fallbackExams[0];
    let correctCount = 0;
    matchedTest.questions.forEach((q, idx) => {
      const userChoice = input.answers[q.id] ?? input.answers[idx];
      if (userChoice === q.correctOptionIndex) {
        correctCount++;
      }
    });

    const totalQ = matchedTest.questions.length || 1;
    const score = Math.round((correctCount / totalQ) * 100);
    const passed = score >= 70;

    return {
      id: `att-${Date.now()}`,
      testId: matchedTest.id,
      testTitle: matchedTest.title,
      studentName: localStorage.getItem('aura_student_name') || 'Candidate',
      startTime: new Date(Date.now() - matchedTest.durationMinutes * 60000).toISOString(),
      endTime: new Date().toISOString(),
      answers: input.answers,
      score,
      logs: input.logs,
      status: passed ? 'submitted' : 'submitted',
      suspiciousScore: Math.min(100, input.tabAwayCount * 15 + input.logs.length * 5)
    };
  }

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

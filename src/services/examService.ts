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

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, encoded] = dataUrl.split(',', 2);
  if (!header || !encoded || !header.startsWith('data:image/')) {
    throw new Error('The proctor evidence snapshot format is invalid.');
  }

  const mimeType = header.match(/^data:([^;]+);base64$/)?.[1] || 'image/jpeg';
  const bytes = atob(encoded);
  const buffer = new Uint8Array(bytes.length);
  for (let index = 0; index < bytes.length; index += 1) buffer[index] = bytes.charCodeAt(index);
  return new Blob([buffer], { type: mimeType });
}

async function persistProctorSnapshots(sessionId: string, logs: ProctorLogEvent[]): Promise<ProctorLogEvent[]> {
  const visualTypes = new Set(['no_face', 'multiple_people', 'phone_detected', 'looking_away', 'notes_detected']);
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Sign in before submitting examination evidence.');

  return Promise.all(logs.map(async (log) => {
    if (!log.snapshotUrl) return { ...log, snapshotUrl: undefined };

    try {
      const blob = dataUrlToBlob(log.snapshotUrl);
      const extension = blob.type === 'image/png' ? 'png' : 'jpg';
      const path = `${data.user.id}/${sessionId}/${log.id}-${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from('agilecert-proctor-evidence')
        .upload(path, blob, {
          cacheControl: '0',
          contentType: blob.type,
          upsert: false,
        });

      if (uploadError) throw uploadError;
      return { ...log, snapshotUrl: undefined, snapshotPath: path };
    } catch (snapshotError) {
      console.warn('A proctor evidence snapshot could not be retained:', snapshotError);
      return {
        ...log,
        snapshotUrl: undefined,
        snapshotPath: undefined,
        message: visualTypes.has(log.type)
          ? `${log.message} Visual snapshot retention failed; this visual event must be treated as insufficient evidence.`
          : log.message,
      };
    }
  }));
}

export async function getAvailableTests(): Promise<Test[]> {
  try {
    const { data, error } = await supabase.rpc('get_available_exams');
    if (!error && Array.isArray(data)) {
      const dbExams = data as Test[];
      const existingKeys = new Set(dbExams.map((exam) => (exam.id || '').toLowerCase()));
      const existingCourses = new Set(dbExams.map((exam) => (exam.course || '').toLowerCase()));
      const existingTitles = new Set(dbExams.map((exam) => (exam.title || '').toLowerCase()));

      const missingExams = fallbackExams.filter((fallback) => {
        const idLower = fallback.id.toLowerCase();
        const courseLower = fallback.course.toLowerCase();
        const titleLower = fallback.title.toLowerCase();
        return !existingKeys.has(idLower)
          && !existingCourses.has(courseLower)
          && !existingTitles.has(titleLower);
      });

      return [...dbExams, ...missingExams];
    }
  } catch (error) {
    console.warn('Supabase get_available_exams call failed, utilizing local fallback catalogue:', error);
  }

  return fallbackExams;
}

export async function startSecureExam(examinationId: string): Promise<Test> {
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(examinationId);

  if (isUUID) {
    try {
      const { data, error } = await supabase.rpc('start_exam_secure', {
        p_examination_id: examinationId,
        p_client_fingerprint: browserFingerprint(),
      });

      if (!error && data && typeof data === 'object') return data as Test;
    } catch (error) {
      console.warn('start_exam_secure RPC failed, attempting local fallback session:', error);
    }
  }

  const fallback = fallbackExams.find(
    (test) => test.id.toLowerCase() === examinationId.toLowerCase()
      || test.course.toLowerCase() === examinationId.toLowerCase()
      || test.title.toLowerCase().includes(examinationId.toLowerCase()),
  );

  if (fallback) {
    return {
      ...fallback,
      sessionId: `fallback-session-${fallback.id}-${Date.now()}`,
    };
  }

  throw new Error('The examination session could not be created.');
}

export async function getPortalAttempts(): Promise<Attempt[]> {
  try {
    const { data, error } = await supabase.rpc('get_portal_attempts');
    if (!error && Array.isArray(data)) return data as Attempt[];
  } catch (error) {
    console.warn('Unable to load Supabase attempts:', error);
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
    const matchedTest = fallbackExams.find((test) => input.sessionId.includes(test.id)) || fallbackExams[0];
    let correctCount = 0;
    matchedTest.questions.forEach((question, index) => {
      const userChoice = input.answers[question.id] ?? input.answers[index];
      if (userChoice === question.correctOptionIndex) correctCount += 1;
    });

    const totalQuestions = matchedTest.questions.length || 1;
    const score = Math.round((correctCount / totalQuestions) * 100);
    const evidenceScore = Math.min(100, input.logs.reduce((sum, log) => {
      const weight = log.severity === 'high' ? 15 : log.severity === 'medium' ? 7 : 2;
      return sum + weight;
    }, 0));

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
      status: evidenceScore >= 60 ? 'flagged' : 'submitted',
      suspiciousScore: evidenceScore,
      evidenceStatus: input.logs.length ? 'event_evidence' : 'no_evidence',
    };
  }

  const evidenceLogs = await persistProctorSnapshots(input.sessionId, input.logs);
  const safeLogs = evidenceLogs.map(({ snapshotUrl: _snapshotUrl, ...log }) => log);

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

import { supabase } from '../lib/supabase';

export type CipmnRemediationAttempt = {
  attemptId: string;
  examinationId: string;
  examinationTitle: string;
  attemptNumber: number;
  maxAttempts: number;
  score: number;
  passMark: number;
  status: 'submitted' | 'flagged' | 'terminated' | 'reviewed';
  submittedAt: string;
  reviewAvailable: boolean;
  incorrectCount: number | null;
  questionCount: number | null;
  reviewEmailStatus: 'queued' | 'processing' | 'sent' | 'failed' | 'cancelled' | 'suppressed' | null;
};

export type CipmnRemediationItem = {
  questionId: string;
  questionNumber: number;
  questionText: string;
  selectedOptionPosition: number | null;
  selectedOptionText: string | null;
  correctOptionPosition: number;
  correctOptionText: string;
  explanation: string;
};

export type CipmnAttemptReview = {
  attemptId: string;
  examinationId: string;
  examinationTitle: string;
  attemptNumber: number;
  score: number;
  passMark: number;
  questionCount: number;
  incorrectCount: number;
  submittedAt: string;
  reviewUnlockedAt: string;
  items: CipmnRemediationItem[];
};

const message = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message ? error.message : fallback;

export async function getMyCipmnRemediationAttempts(): Promise<CipmnRemediationAttempt[]> {
  const { data, error } = await supabase.rpc('get_my_cipmn_remediation_attempts');
  if (error) throw new Error(error.message);

  const rows = Array.isArray(data?.attempts) ? data.attempts : [];
  return rows.map((row: any) => ({
    attemptId: String(row.attemptId || ''),
    examinationId: String(row.examinationId || ''),
    examinationTitle: String(row.examinationTitle || 'CIPMN module examination'),
    attemptNumber: Number(row.attemptNumber || 0),
    maxAttempts: Number(row.maxAttempts || 3),
    score: Number(row.score || 0),
    passMark: Number(row.passMark || 0),
    status: row.status,
    submittedAt: String(row.submittedAt || ''),
    reviewAvailable: Boolean(row.reviewAvailable),
    incorrectCount: row.incorrectCount == null ? null : Number(row.incorrectCount),
    questionCount: row.questionCount == null ? null : Number(row.questionCount),
    reviewEmailStatus: row.reviewEmailStatus || null,
  }));
}

export async function getMyCipmnAttemptReview(attemptId: string): Promise<CipmnAttemptReview> {
  if (!attemptId) throw new Error('A valid attempt is required.');

  try {
    const { data, error } = await supabase.rpc('get_my_cipmn_attempt_review', {
      p_attempt_id: attemptId,
    });
    if (error) throw new Error(error.message);
    if (!data || typeof data !== 'object') throw new Error('The remediation review is unavailable.');

    return {
      attemptId: String(data.attemptId || attemptId),
      examinationId: String(data.examinationId || ''),
      examinationTitle: String(data.examinationTitle || 'CIPMN module examination'),
      attemptNumber: Number(data.attemptNumber || 3),
      score: Number(data.score || 0),
      passMark: Number(data.passMark || 0),
      questionCount: Number(data.questionCount || 0),
      incorrectCount: Number(data.incorrectCount || 0),
      submittedAt: String(data.submittedAt || ''),
      reviewUnlockedAt: String(data.reviewUnlockedAt || ''),
      items: (Array.isArray(data.items) ? data.items : []).map((item: any) => ({
        questionId: String(item.questionId || ''),
        questionNumber: Number(item.questionNumber || 0),
        questionText: String(item.questionText || ''),
        selectedOptionPosition: item.selectedOptionPosition == null ? null : Number(item.selectedOptionPosition),
        selectedOptionText: item.selectedOptionText == null ? null : String(item.selectedOptionText),
        correctOptionPosition: Number(item.correctOptionPosition || 0),
        correctOptionText: String(item.correctOptionText || ''),
        explanation: String(item.explanation || ''),
      })),
    };
  } catch (error) {
    throw new Error(message(error, 'Unable to load the protected CIPMN remediation review.'));
  }
}

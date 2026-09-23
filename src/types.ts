export type QuestionType = 'mcq' | 'theory';
export type ExamSection = 'mcq' | 'theory';
export type ExamAnswer = number | string;

export interface Question {
  id: string;
  text: string;
  options: string[];
  correctOptionIndex?: number;
  type?: QuestionType;
  section?: ExamSection;
  points?: number;
}

export interface Test {
  id: string;
  title: string;
  course: string;
  durationMinutes: number;
  questionCount: number;
  description: string;
  questions: Question[];
  sessionId?: string;
  assignmentId?: string;
  expiresAt?: string;
  examFormat?: 'standard' | 'cipmn_mixed';
  mcqCount?: number;
  theoryCount?: number;
  currentSection?: ExamSection;
  mcqScore?: number;
}

export type ProctorEventType =
  | 'tab_away'
  | 'no_face'
  | 'multiple_people'
  | 'phone_detected'
  | 'looking_away'
  | 'notes_detected'
  | 'camera_disabled'
  | 'manual_flag'
  | 'unauthorized_copy';

export interface ProctorLogEvent {
  id: string;
  timestamp: string;
  type: ProctorEventType;
  severity: 'low' | 'medium' | 'high';
  message: string;
  snapshotUrl?: string;
}

export interface Attempt {
  id: string;
  studentName: string;
  testId: string;
  testTitle: string;
  startTime: string;
  endTime?: string;
  answers: Record<string, ExamAnswer>;
  score?: number;
  mcqScore?: number;
  theoryScore?: number;
  gradingStatus?: 'mcq_complete' | 'pending_theory_review' | 'final';
  logs: ProctorLogEvent[];
  status: 'ongoing' | 'submitted' | 'flagged' | 'terminated';
  suspiciousScore: number;
}

export interface ProctorAnalysisResult {
  isSuspicious: boolean;
  confidence: number;
  reason: string;
  detections: string[];
}

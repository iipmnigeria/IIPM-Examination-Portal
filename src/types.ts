export interface Question {
  id: string;
  text: string;
  options: string[];
  correctOptionIndex?: number;
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
  answers: Record<string, number>;
  score?: number;
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

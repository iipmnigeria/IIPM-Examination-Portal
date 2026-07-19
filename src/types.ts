export interface Question {
  id: string;
  text: string;
  options: string[];
  correctOptionIndex: number;
}

export interface Test {
  id: string;
  title: string;
  course: string;
  durationMinutes: number;
  questionCount: number;
  description: string;
  questions: Question[];
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
  timestamp: string; // ISO string
  type: ProctorEventType;
  severity: 'low' | 'medium' | 'high';
  message: string;
  snapshotUrl?: string; // base64 format for visualization
}

export interface Attempt {
  id: string;
  studentName: string;
  testId: string;
  testTitle: string;
  startTime: string; // ISO string
  endTime?: string; // ISO string
  answers: Record<string, number>; // questionId -> selectedOptionIndex
  score?: number; // percentage (0-100)
  logs: ProctorLogEvent[];
  status: 'ongoing' | 'submitted' | 'flagged' | 'terminated';
  suspiciousScore: number; // 0 to 100 index
}

export interface ProctorAnalysisResult {
  isSuspicious: boolean;
  confidence: number; // 0 to 1
  reason: string;
  detections: string[];
}

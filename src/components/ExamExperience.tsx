import { useEffect, useState } from 'react';
import type { ProctorLogEvent, ProctorEventType, Test } from '../types';
import ExamScreen from './ExamScreen';
import LiveProctoringEventBridge from './LiveProctoringEventBridge';
import SecureExamIntegrityPreflight from './SecureExamIntegrityPreflight';

interface ExamExperienceProps {
  test: Test;
  studentName: string;
  simType: string;
  onSubmitExam: (answers: Record<string, number>, logs: ProctorLogEvent[], tabAwayCount: number) => void;
  onExitExam: () => void;
}

const detectionType = (detections: unknown): ProctorEventType => {
  const values = Array.isArray(detections) ? detections.map(String) : [];
  if (values.includes('phone_detected')) return 'phone_detected';
  if (values.includes('multiple_people')) return 'multiple_people';
  if (values.includes('no_face')) return 'no_face';
  if (values.includes('notes_detected')) return 'notes_detected';
  return 'looking_away';
};

export default function ExamExperience(props: ExamExperienceProps) {
  const [activeTest, setActiveTest] = useState(props.test);

  useEffect(() => {
    const policy = activeTest.proctoringPolicy;
    if (!policy || activeTest.proctorPreflightRequired) return;

    sessionStorage.setItem('agilecert_active_proctoring_policy', JSON.stringify(policy));
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (!url.includes('/api/proctor/analyze')) return originalFetch(input, init);

      if (!policy.aiVisualAnalysisEnabled) {
        return new Response(JSON.stringify({
          isSuspicious: false,
          confidence: 0,
          reason: 'AI visual analysis is disabled by the active examination policy.',
          detections: [],
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const response = await originalFetch(input, init);
      if (response.ok && policy.liveEventCaptureEnabled) {
        void response.clone().json().then((payload: Record<string, unknown>) => {
          if (!payload?.isSuspicious) return;
          const detail = {
            id: `ai-${Date.now()}-${crypto.randomUUID()}`,
            timestamp: new Date().toISOString(),
            type: detectionType(payload.detections),
            severity: Number(payload.confidence || 0) >= 0.8 ? 'high' : 'medium',
            message: String(payload.reason || 'AI visual-analysis risk indicator recorded.'),
            aiGenerated: true,
          };
          window.dispatchEvent(new CustomEvent('agilecert-proctor-event', { detail }));
        }).catch(() => undefined);
      }
      return response;
    };

    return () => {
      window.fetch = originalFetch;
      sessionStorage.removeItem('agilecert_active_proctoring_policy');
    };
  }, [activeTest.proctorPreflightRequired, activeTest.proctoringPolicy]);

  if (activeTest.proctorPreflightRequired) {
    return (
      <SecureExamIntegrityPreflight
        test={activeTest}
        onReady={setActiveTest}
        onCancel={props.onExitExam}
      />
    );
  }

  return (
    <>
      <LiveProctoringEventBridge
        proctoringSessionId={activeTest.proctoringSessionId}
        policy={activeTest.proctoringPolicy}
      />
      <ExamScreen {...props} test={activeTest} />
    </>
  );
}

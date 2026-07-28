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

const requestSnapshot = (body: BodyInit | null | undefined): string | undefined => {
  if (typeof body !== 'string') return undefined;
  try {
    const payload = JSON.parse(body) as Record<string, unknown>;
    return typeof payload.image === 'string' && payload.image.startsWith('data:image/')
      ? payload.image
      : undefined;
  } catch {
    return undefined;
  }
};

export default function ExamExperience(props: ExamExperienceProps) {
  const [activeTest, setActiveTest] = useState(props.test);
  const [runtimeReady, setRuntimeReady] = useState(!props.test.proctoringPolicy);
  const [runtimeError, setRuntimeError] = useState('');

  useEffect(() => {
    const policy = activeTest.proctoringPolicy;
    if (!policy || activeTest.proctorPreflightRequired) {
      setRuntimeReady(!policy);
      return undefined;
    }

    setRuntimeReady(false);
    setRuntimeError('');
    sessionStorage.setItem('agilecert_active_proctoring_policy', JSON.stringify(policy));

    const originalFetch = window.fetch.bind(window);
    const mediaDevices = navigator.mediaDevices;
    const originalGetUserMedia = mediaDevices?.getUserMedia?.bind(mediaDevices);
    let mediaGuardInstalled = false;

    try {
      if (mediaDevices && originalGetUserMedia && !policy.requireCamera && !policy.aiVisualAnalysisEnabled) {
        mediaDevices.getUserMedia = (async (constraints?: MediaStreamConstraints) => {
          const requestsVideo = Boolean(constraints && typeof constraints === 'object' && constraints.video);
          if (requestsVideo) return new MediaStream();
          return originalGetUserMedia(constraints);
        }) as typeof mediaDevices.getUserMedia;
        mediaGuardInstalled = true;
      }

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

        const capturedFrame = policy.retainWebcamImages ? requestSnapshot(init?.body) : undefined;
        const response = await originalFetch(input, init);
        if (response.ok && policy.liveEventCaptureEnabled) {
          void response.clone().json().then((payload: Record<string, unknown>) => {
            if (!payload?.isSuspicious) return;
            const confidence = Math.max(0, Math.min(1, Number(payload.confidence || 0)));
            const detail = {
              id: `ai-${Date.now()}-${crypto.randomUUID()}`,
              timestamp: new Date().toISOString(),
              type: detectionType(payload.detections),
              severity: confidence >= 0.8 ? 'high' : 'medium',
              message: String(payload.reason || 'AI visual-analysis risk indicator recorded.'),
              aiGenerated: true,
              confidence,
              snapshotUrl: capturedFrame,
            };
            window.dispatchEvent(new CustomEvent('agilecert-proctor-event', { detail }));
          }).catch(() => undefined);
        }
        return response;
      };

      setRuntimeReady(true);
    } catch (error) {
      window.fetch = originalFetch;
      if (mediaGuardInstalled && mediaDevices && originalGetUserMedia) {
        mediaDevices.getUserMedia = originalGetUserMedia;
      }
      sessionStorage.removeItem('agilecert_active_proctoring_policy');
      setRuntimeError(error instanceof Error ? error.message : 'The examination privacy runtime could not be prepared.');
    }

    return () => {
      window.fetch = originalFetch;
      if (mediaGuardInstalled && mediaDevices && originalGetUserMedia) {
        mediaDevices.getUserMedia = originalGetUserMedia;
      }
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

  if (activeTest.proctoringPolicy && !runtimeReady) {
    return (
      <div className="min-h-screen bg-slate-950 p-6 text-white flex items-center justify-center">
        <div className="w-full max-w-xl rounded-3xl border border-slate-800 bg-slate-900 p-8 text-center shadow-2xl">
          <h1 className="text-xl font-black">Preparing secure examination runtime</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Camera and AI processing are being restricted to the permissions allowed by the active examination policy.
          </p>
          {runtimeError && (
            <div className="mt-5 rounded-2xl border border-rose-800 bg-rose-950/40 p-4 text-sm font-bold text-rose-200">
              {runtimeError}
            </div>
          )}
          {runtimeError && (
            <button type="button" onClick={props.onExitExam} className="mt-5 rounded-xl border border-slate-700 px-5 py-3 text-sm font-black text-slate-200 hover:bg-slate-800">
              Return to dashboard
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <LiveProctoringEventBridge
        examSessionId={activeTest.sessionId}
        proctoringSessionId={activeTest.proctoringSessionId}
        policy={activeTest.proctoringPolicy}
      />
      <ExamScreen {...props} test={activeTest} />
    </>
  );
}

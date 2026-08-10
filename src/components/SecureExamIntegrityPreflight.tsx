import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, Loader2, RefreshCw, ShieldCheck, X } from 'lucide-react';
import type { Test } from '../types';
import {
  getProctoredExamPayload,
  openProctoringSession,
  recordIdentityProctoringConsent,
} from '../services/identityProctoringService';

interface SecureExamIntegrityPreflightProps {
  test: Test;
  onReady: (test: Test) => void;
  onCancel: () => void;
}

const waitForLiveVideo = (video: HTMLVideoElement): Promise<void> => new Promise((resolve, reject) => {
  const timeout = window.setTimeout(() => reject(new Error('The camera opened but no live picture was received. Check the camera cover, lighting, or another application using the camera.')), 8000);
  const verify = () => {
    if (video.videoWidth > 0 && video.videoHeight > 0 && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      window.clearTimeout(timeout);
      resolve();
    }
  };
  video.addEventListener('loadeddata', verify, { once: true });
  video.addEventListener('playing', verify, { once: true });
  void video.play().then(verify).catch(() => undefined);
});

export default function SecureExamIntegrityPreflight({ test, onReady, onCancel }: SecureExamIntegrityPreflightProps) {
  const [requesting, setRequesting] = useState(false);
  const [opening, setOpening] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [error, setError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const requestedRef = useRef(false);
  const policy = test.proctoringPolicy;

  const stopPreview = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const requestCamera = useCallback(async () => {
    if (!policy?.requireCamera) {
      setError('This examination does not have its mandatory camera policy. Return to the dashboard and contact the examination administrator.');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('This browser cannot provide secure camera access. Use an updated Chrome, Edge, Safari, or Firefox browser on a device with a working webcam.');
      return;
    }

    setRequesting(true);
    setCameraReady(false);
    setError('');
    stopPreview();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false,
      });
      const track = stream.getVideoTracks()[0];
      if (!track || track.readyState !== 'live' || !track.enabled) {
        stream.getTracks().forEach((item) => item.stop());
        throw new Error('A live webcam video track was not detected.');
      }
      streamRef.current = stream;
      if (!videoRef.current) throw new Error('The secure camera preview could not be prepared.');
      videoRef.current.srcObject = stream;
      await waitForLiveVideo(videoRef.current);
      setCameraReady(true);
    } catch (cameraError) {
      stopPreview();
      setError(cameraError instanceof Error
        ? `${cameraError.message} Camera permission and a visible live preview are required before questions can open.`
        : 'Camera permission was denied or the webcam is unavailable. Enable camera access and retry.');
    } finally {
      setRequesting(false);
    }
  }, [policy?.requireCamera, stopPreview]);

  useEffect(() => {
    if (requestedRef.current) return;
    requestedRef.current = true;
    void requestCamera();
    return stopPreview;
  }, [requestCamera, stopPreview]);

  const openQuestions = async () => {
    if (!test.sessionId || !policy || !cameraReady || !streamRef.current?.getVideoTracks().some((track) => track.readyState === 'live' && track.enabled)) {
      setError('Confirm a working live camera preview before opening the examination questions.');
      return;
    }

    setOpening(true);
    setError('');
    try {
      await recordIdentityProctoringConsent({
        examinationId: test.id,
        identityProcessingAccepted: true,
        proctoringProcessingAccepted: true,
        cameraPermissionAccepted: true,
        microphonePermissionAccepted: false,
        fullscreenMonitoringAccepted: policy.requireFullscreen,
        automatedProcessingAccepted: policy.aiVisualAnalysisEnabled,
      });
      const proctoring = await openProctoringSession({
        sessionId: test.sessionId,
        cameraPermission: 'granted',
        microphonePermission: 'not_requested',
        fullscreenStatus: 'not_requested',
      });
      const hydrated = await getProctoredExamPayload(test.sessionId);
      stopPreview();
      onReady({
        ...hydrated,
        proctoringSessionId: proctoring.id,
        proctoringPolicy: policy,
        proctorPreflightRequired: false,
      });
    } catch (preflightError) {
      setError(preflightError instanceof Error ? preflightError.message : 'The secure examination preflight could not be completed.');
    } finally {
      setOpening(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4 text-white md:p-10">
      <div className="mx-auto max-w-4xl overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-800 p-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">Mandatory secure camera preflight</p>
            <h1 className="mt-2 text-2xl font-black">Your camera is coming on</h1>
            <p className="mt-2 text-sm leading-6 text-slate-300">Allow browser camera permission and confirm that your live picture is visible before continuing to {test.title}.</p>
          </div>
          <button type="button" onClick={() => { stopPreview(); onCancel(); }} className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Return to dashboard"><X className="h-5 w-5" /></button>
        </header>

        <div className="grid gap-6 p-6 md:grid-cols-[1.35fr_0.65fr] md:p-8">
          <section>
            <div className="relative aspect-video overflow-hidden rounded-2xl border border-slate-700 bg-black">
              <video ref={videoRef} autoPlay playsInline muted className="h-full w-full scale-x-[-1] object-cover" />
              {!cameraReady && <div className="absolute inset-0 grid place-items-center bg-slate-950/85 p-6 text-center"><div><Camera className="mx-auto h-10 w-10 text-emerald-400" /><p className="mt-3 text-sm font-black">{requesting ? 'Waiting for camera permission…' : 'Live camera preview required'}</p></div></div>}
              {cameraReady && <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-emerald-600 px-3 py-1 text-xs font-black"><span className="h-2 w-2 rounded-full bg-white" /> Camera live</div>}
            </div>
            {error && <div className="mt-4 rounded-2xl border border-rose-800 bg-rose-950/40 p-4 text-sm font-bold leading-6 text-rose-200">{error}</div>}
          </section>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-emerald-900/70 bg-emerald-950/40 p-5"><ShieldCheck className="h-7 w-7 text-emerald-400" /><h2 className="mt-3 font-black">Questions remain protected</h2><p className="mt-2 text-xs leading-5 text-emerald-100/80">No examination question is released until camera permission and a visible live video track are verified.</p></div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 text-xs leading-5 text-slate-300">By continuing, you consent to mandatory live camera proctoring and approved AI visual analysis for examination integrity. Routine webcam images are not retained unless separately authorised by policy.</div>
            <button type="button" disabled={!cameraReady || opening || requesting} onClick={() => void openQuestions()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40">
              {opening ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              My camera is working — open questions
            </button>
            <button type="button" disabled={requesting || opening} onClick={() => void requestCamera()} className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 px-5 py-3 text-sm font-black text-slate-200 hover:bg-slate-800 disabled:opacity-40"><RefreshCw className="h-4 w-4" /> Retry camera</button>
          </aside>
        </div>
      </div>
    </div>
  );
}

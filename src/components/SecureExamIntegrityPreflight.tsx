import { useState } from 'react';
import { Camera, Expand, Loader2, Mic, ShieldCheck, X } from 'lucide-react';
import type { Test } from '../types';
import { getProctoredExamPayload, openProctoringSession } from '../services/identityProctoringService';

interface SecureExamIntegrityPreflightProps {
  test: Test;
  onReady: (test: Test) => void;
  onCancel: () => void;
}

export default function SecureExamIntegrityPreflight({ test, onReady, onCancel }: SecureExamIntegrityPreflightProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const policy = test.proctoringPolicy;

  const begin = async () => {
    if (!test.sessionId || !policy) {
      setError('The secure examination preflight payload is incomplete. Return to the dashboard and start again.');
      return;
    }

    setBusy(true);
    setError('');
    let cameraPermission: 'not_requested' | 'granted' | 'denied' | 'unavailable' = 'not_requested';
    let microphonePermission: 'not_requested' | 'granted' | 'denied' | 'unavailable' = 'not_requested';
    let fullscreenStatus: 'not_requested' | 'entered' | 'exited' | 'unavailable' = 'not_requested';

    try {
      if (policy.requireCamera || policy.requireMicrophone) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: policy.requireCamera,
            audio: policy.requireMicrophone,
          });
          cameraPermission = policy.requireCamera ? 'granted' : 'not_requested';
          microphonePermission = policy.requireMicrophone ? 'granted' : 'not_requested';
          stream.getTracks().forEach((track) => track.stop());
        } catch (permissionError) {
          if (policy.requireCamera) cameraPermission = navigator.mediaDevices ? 'denied' : 'unavailable';
          if (policy.requireMicrophone) microphonePermission = navigator.mediaDevices ? 'denied' : 'unavailable';
          throw permissionError;
        }
      }

      if (policy.requireFullscreen) {
        if (!document.fullscreenEnabled) {
          fullscreenStatus = 'unavailable';
          throw new Error('This browser does not provide the required fullscreen examination mode.');
        }
        await document.documentElement.requestFullscreen();
        fullscreenStatus = document.fullscreenElement ? 'entered' : 'exited';
      }

      const proctoring = await openProctoringSession({
        sessionId: test.sessionId,
        cameraPermission,
        microphonePermission,
        fullscreenStatus,
      });
      const hydrated = await getProctoredExamPayload(test.sessionId);
      onReady({ ...hydrated, proctoringSessionId: proctoring.id, proctoringPolicy: policy, proctorPreflightRequired: false });
    } catch (preflightError) {
      setError(preflightError instanceof Error ? preflightError.message : 'The secure examination preflight could not be completed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4 text-white md:p-10">
      <div className="mx-auto max-w-3xl overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-800 p-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">Server-authorised examination preflight</p>
            <h1 className="mt-2 text-2xl font-black">Identity and proctoring check</h1>
            <p className="mt-2 text-sm leading-6 text-slate-300">{test.title}</p>
          </div>
          <button type="button" onClick={onCancel} className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Return to dashboard"><X className="h-5 w-5" /></button>
        </header>

        <div className="space-y-6 p-6 md:p-8">
          <div className="rounded-2xl border border-emerald-900/70 bg-emerald-950/40 p-5">
            <div className="flex items-center gap-3"><ShieldCheck className="h-7 w-7 text-emerald-400" /><div><h2 className="font-black">Questions remain protected</h2><p className="mt-1 text-sm text-emerald-100/80">The server has not released examination questions to this browser. They are returned only after this required preflight succeeds.</p></div></div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className={`rounded-2xl border p-4 ${policy?.requireCamera ? 'border-blue-500/50 bg-blue-950/30' : 'border-slate-800 bg-slate-950/30'}`}><Camera className="h-5 w-5 text-blue-400" /><p className="mt-3 text-sm font-black">Camera</p><p className="mt-1 text-xs text-slate-400">{policy?.requireCamera ? 'Required for this examination' : 'Not required by policy'}</p></div>
            <div className={`rounded-2xl border p-4 ${policy?.requireMicrophone ? 'border-violet-500/50 bg-violet-950/30' : 'border-slate-800 bg-slate-950/30'}`}><Mic className="h-5 w-5 text-violet-400" /><p className="mt-3 text-sm font-black">Microphone permission</p><p className="mt-1 text-xs text-slate-400">{policy?.requireMicrophone ? 'Permission required; no recording in this release' : 'Not required by policy'}</p></div>
            <div className={`rounded-2xl border p-4 ${policy?.requireFullscreen ? 'border-amber-500/50 bg-amber-950/30' : 'border-slate-800 bg-slate-950/30'}`}><Expand className="h-5 w-5 text-amber-400" /><p className="mt-3 text-sm font-black">Fullscreen</p><p className="mt-1 text-xs text-slate-400">{policy?.requireFullscreen ? 'Required while questions are visible' : 'Not required by policy'}</p></div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 text-sm leading-6 text-slate-300">
            Browser-focus, visibility, fullscreen, clipboard, connectivity and approved AI detection events may be recorded. Event metadata cannot contain questions, answers or answer keys. Routine webcam images are not retained unless a separately approved policy explicitly enables them.
          </div>

          {error && <div className="rounded-2xl border border-rose-800 bg-rose-950/40 p-4 text-sm font-bold text-rose-200">{error}</div>}

          <div className="flex flex-wrap gap-3">
            <button type="button" disabled={busy} onClick={() => void begin()} className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white hover:bg-emerald-500 disabled:opacity-50">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Complete check and open questions
            </button>
            <button type="button" disabled={busy} onClick={onCancel} className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-black text-slate-300 hover:bg-slate-800">Return to dashboard</button>
          </div>
        </div>
      </div>
    </div>
  );
}

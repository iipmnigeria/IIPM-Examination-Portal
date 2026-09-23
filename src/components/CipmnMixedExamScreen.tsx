import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle, ChevronLeft, ChevronRight, Lock, RefreshCw, ShieldAlert, Video } from 'lucide-react';
import type { ProctorEventType, ProctorLogEvent, Question, Test } from '../types';
import { clearSecuredCameraStream, takeSecuredCameraStream } from '../services/secureCameraSession';

const API_BASE = (() => {
  if (typeof window === 'undefined') return '';
  const hostname = window.location.hostname;
  if (
    hostname.includes('localhost') ||
    hostname.includes('run.app') ||
    hostname.includes('0.0.0.0') ||
    hostname.includes('127.0.0.1')
  ) return '';
  if (hostname.includes('github.io')) {
    return 'https://ais-pre-y7jivk2vjghx37l36lh74p-385275779151.europe-west2.run.app';
  }
  return 'https://ais-dev-y7jivk2vjghx37l36lh74p-385275779151.europe-west2.run.app';
})();

interface Props {
  test: Test;
  studentName: string;
  onSubmitMcq: (answers: Record<string, number>, logs: ProctorLogEvent[], tabAwayCount: number) => Promise<number>;
  onSubmitTheory: (answers: Record<string, string>, logs: ProctorLogEvent[], tabAwayCount: number) => Promise<void>;
  simType?: string;
}

export default function CipmnMixedExamScreen({ test, studentName, onSubmitMcq, onSubmitTheory, simType = 'none' }: Props) {
  const mcqs = useMemo(() => test.questions.filter(q => (q.section || q.type) !== 'theory'), [test.questions]);
  const theory = useMemo(() => test.questions.filter(q => q.section === 'theory' || q.type === 'theory'), [test.questions]);
  const initialSection = test.currentSection === 'theory' ? 'theory' : 'mcq';
  const [section, setSection] = useState<'mcq'|'mcq_result'|'theory'>(initialSection);
  const [index, setIndex] = useState(0);
  const [mcqAnswers, setMcqAnswers] = useState<Record<string, number>>({});
  const [theoryAnswers, setTheoryAnswers] = useState<Record<string, string>>({});
  const [mcqScore, setMcqScore] = useState<number | null>(test.mcqScore ?? null);
  const [busy, setBusy] = useState(false);

  // Original secured-exam proctoring/integrity state.
  const cameraRequired = Boolean(test.proctoringPolicy?.requireCamera);
  const [cameraState, setCameraState] = useState<'starting' | 'active' | 'blocked'>('starting');
  const [cameraError, setCameraError] = useState('');
  const [cameraRetry, setCameraRetry] = useState(0);
  const [proctorLogs, setProctorLogs] = useState<ProctorLogEvent[]>([]);
  const [tabAwayCount, setTabAwayCount] = useState(0);
  const [showBlurModal, setShowBlurModal] = useState(false);
  const [proctorStatus, setProctorStatus] = useState<'healthy' | 'warning' | 'critical'>('healthy');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [nextCheckIn, setNextCheckIn] = useState(12);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const playAlertSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.type = 'sine';
      oscillator.frequency.value = 440;
      gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
      oscillator.start();
      setTimeout(() => {
        oscillator.stop();
        audioCtx.close();
      }, 200);
    } catch {
      console.log('Audio Context beep play blocked or unsupported by browser sandbox.');
    }
  };

  const addProctorLog = (
    type: ProctorEventType,
    severity: 'low' | 'medium' | 'high',
    message: string,
    snapshotUrl?: string,
  ) => {
    const newLog: ProctorLogEvent = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      timestamp: new Date().toISOString(),
      type,
      severity,
      message,
      snapshotUrl,
    };
    window.dispatchEvent(new CustomEvent('agilecert-proctor-event', { detail: newLog }));
    setProctorLogs((previous) => {
      const updated = [newLog, ...previous];
      const highAlerts = updated.filter((log) => log.severity === 'high').length;
      const mediumAlerts = updated.filter((log) => log.severity === 'medium').length;
      if (highAlerts >= 3 || updated.length >= 8) setProctorStatus('critical');
      else if (highAlerts > 0 || mediumAlerts > 1) setProctorStatus('warning');
      else setProctorStatus('healthy');
      return updated;
    });
  };

  useEffect(() => {
    let activeStream: MediaStream | null = null;
    let muteTimer: number | null = null;
    let disposed = false;

    const blockCamera = (message: string) => {
      if (disposed) return;
      setCameraState('blocked');
      setCameraError(message);
      addProctorLog('camera_disabled', 'high', message);
    };

    async function startWebcam() {
      if (!cameraRequired) {
        setCameraState('active');
        return;
      }
      setCameraState('starting');
      setCameraError('');
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('This browser does not support secure webcam access.');
        const heldStream = takeSecuredCameraStream();
        const stream = heldStream?.getVideoTracks().some((item) => item.readyState === 'live' && item.enabled)
          ? heldStream
          : await navigator.mediaDevices.getUserMedia({
              video: { width: 320, height: 240, facingMode: 'user' },
              audio: false,
            });
        const track = stream.getVideoTracks()[0];
        if (!track || track.readyState !== 'live' || !track.enabled) {
          stream.getTracks().forEach((item) => item.stop());
          throw new Error('No live webcam video track was detected.');
        }
        activeStream = stream;
        track.addEventListener('ended', () => blockCamera('The webcam disconnected or camera permission was withdrawn. The examination is paused.'));
        track.addEventListener('mute', () => {
          muteTimer = window.setTimeout(() => {
            if (track.muted) blockCamera('The webcam stopped providing video. The examination is paused until the camera is restored.');
          }, 2000);
        });
        track.addEventListener('unmute', () => {
          if (muteTimer) window.clearTimeout(muteTimer);
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        if (!disposed) setCameraState('active');
      } catch (error) {
        blockCamera(error instanceof Error
          ? `${error.message} Camera access is mandatory and the examination is paused.`
          : 'The examination camera is disabled or unavailable. Camera access is mandatory and the examination is paused.');
      }
    }
    void startWebcam();
    return () => {
      disposed = true;
      if (muteTimer) window.clearTimeout(muteTimer);
      if (activeStream) activeStream.getTracks().forEach((track) => track.stop());
      clearSecuredCameraStream(false);
    };
  }, [cameraRequired, cameraRetry]);

  useEffect(() => {
    const handleWindowBlur = () => {
      setTabAwayCount((previous) => {
        const next = previous + 1;
        addProctorLog('tab_away', 'high', `Security Alert: Student blurred or exited the exam viewport (${next} time). Logged onto credentials.`);
        setShowBlurModal(true);
        playAlertSound();
        return next;
      });
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        setTabAwayCount((previous) => {
          const next = previous + 1;
          addProctorLog('tab_away', 'high', `Security Alert: Student minimized or switched browser tab (${next} time).`);
          setShowBlurModal(true);
          playAlertSound();
          return next;
        });
      }
    };
    const blockClipboard = (event: ClipboardEvent) => {
      event.preventDefault();
      addProctorLog('unauthorized_copy', event.type === 'paste' ? 'medium' : 'high', `Security Alert: ${event.type} operation blocked during the secured examination.`);
      playAlertSound();
    };
    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      addProctorLog('unauthorized_copy', 'medium', 'Security Warning: Right-click context menu is disabled to prevent inspector operations or saving question assets.');
      playAlertSound();
    };
    const handleDragStart = (event: DragEvent) => event.preventDefault();
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key?.toLowerCase();
      const command = event.ctrlKey || event.metaKey;
      const inspector = command && event.shiftKey && ['i', 'c', 'j'].includes(key);
      if (
        event.key === 'PrintScreen' || event.key === 'PrtScn' || event.key === 'Snapshot'
        || (command && ['p', 's', 'c', 'x'].includes(key))
        || event.key === 'F12' || inspector
      ) {
        event.preventDefault();
        addProctorLog('unauthorized_copy', 'high', 'Security Alert: Restricted browser, clipboard, print, save, screen-capture or developer-tool shortcut blocked.');
        playAlertSound();
      }
    };

    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('copy', blockClipboard);
    document.addEventListener('cut', blockClipboard);
    document.addEventListener('paste', blockClipboard);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('dragstart', handleDragStart);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('copy', blockClipboard);
      document.removeEventListener('cut', blockClipboard);
      document.removeEventListener('paste', blockClipboard);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('dragstart', handleDragStart);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const captureAndAnalyzeProctorFrame = async () => {
    if (!videoRef.current || !canvasRef.current || isAnalyzing) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) return;

    setIsAnalyzing(true);
    try {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const base64Image = canvas.toDataURL('image/jpeg', 0.6);
      const response = await fetch(`${API_BASE}/api/proctor/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Image, testId: test.id, simType }),
      });
      if (!response.ok) throw new Error('Proctor server analysis request failed');
      const result = await response.json();
      if (result.isSuspicious) {
        playAlertSound();
        let type: ProctorEventType = 'looking_away';
        if (result.detections.includes('phone_detected')) type = 'phone_detected';
        else if (result.detections.includes('multiple_people')) type = 'multiple_people';
        else if (result.detections.includes('no_face')) type = 'no_face';
        else if (result.detections.includes('notes_detected')) type = 'notes_detected';
        addProctorLog(type, 'high', `AI Alert: ${result.reason} (Confidence: ${Math.round(result.confidence * 100)}%)`, base64Image);
      }
    } catch (error) {
      console.error('Proctor snapshot routine error:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    if (!cameraRequired || cameraState !== 'active') return;
    const timer = window.setInterval(() => {
      setNextCheckIn((previous) => {
        if (previous <= 1) {
          void captureAndAnalyzeProctorFrame();
          return 12;
        }
        return previous - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cameraRequired, cameraState]);


  const current: Question | undefined = section === 'theory' ? theory[index] : mcqs[index];
  const list = section === 'theory' ? theory : mcqs;
  const answered = section === 'theory'
    ? Object.values(theoryAnswers).filter(v => v.trim()).length
    : Object.keys(mcqAnswers).length;

  async function submitMcq() {
    if (!test.sessionId || busy) return;
    setBusy(true);
    try {
      const score = await onSubmitMcq(mcqAnswers, proctorLogs, tabAwayCount);
      setMcqScore(score);
      setSection('mcq_result');
      setIndex(0);
    } finally { setBusy(false); }
  }

  async function submitTheory() {
    if (!test.sessionId || busy) return;
    setBusy(true);
    try { await onSubmitTheory(theoryAnswers, proctorLogs, tabAwayCount); }
    finally { setBusy(false); }
  }

  if (section === 'mcq_result') {
    return <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
      <div className="max-w-xl w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-6">
        <CheckCircle className="w-14 h-14 text-emerald-400 mx-auto" />
        <div><p className="text-xs uppercase tracking-widest text-slate-400 font-bold">Section A Complete</p>
        <h1 className="text-3xl font-extrabold mt-2">MCQ Score: {mcqScore}%</h1></div>
        <p className="text-sm text-slate-300">Your 25 MCQ responses are locked. Continue to the five theory questions to complete this CIPMN examination.</p>
        <button onClick={()=>{setSection('theory');setIndex(0)}} className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-bold">
          Proceed to Theory
        </button>
      </div>
    </div>;
  }

  return <div className="min-h-screen bg-slate-950 text-slate-100 select-none">
    {cameraRequired && cameraState !== 'active' && <div className="fixed inset-0 z-[200] grid place-items-center bg-slate-950/95 p-4 backdrop-blur-md">
      <section className="w-full max-w-lg rounded-3xl border border-rose-700/60 bg-slate-900 p-7 text-center shadow-2xl">
        <Video className="mx-auto h-12 w-12 text-rose-400" />
        <h2 className="mt-4 text-xl font-black text-white">Camera required — examination paused</h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">{cameraState === 'starting' ? 'Starting and verifying the live webcam feed…' : cameraError}</p>
        {cameraState === 'blocked' && <button type="button" onClick={() => setCameraRetry((value) => value + 1)} className="mx-auto mt-6 flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white hover:bg-emerald-500"><RefreshCw className="h-4 w-4" /> Restore camera and continue</button>}
      </section>
    </div>}
    {showBlurModal && <div className="fixed inset-0 z-[190] grid place-items-center bg-slate-950/90 p-4">
      <section className="w-full max-w-md rounded-2xl border border-amber-700/60 bg-slate-900 p-6 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-amber-400" />
        <h2 className="mt-3 text-lg font-black">Security event recorded</h2>
        <p className="mt-2 text-sm text-slate-300">Leaving or hiding the secured examination window has been recorded. Return to the examination to continue.</p>
        <button type="button" onClick={() => setShowBlurModal(false)} className="mt-5 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-black">Return to examination</button>
      </section>
    </div>}
    <video ref={videoRef} autoPlay muted playsInline className="fixed bottom-4 right-4 z-50 h-24 w-32 rounded-lg border border-slate-700 bg-black object-cover shadow-xl" />
    <canvas ref={canvasRef} width={320} height={240} className="hidden" />
    <header className="border-b border-slate-800 px-6 py-4 flex justify-between items-center">
      <div className="absolute left-1/2 -translate-x-1/2 hidden md:flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400"><span className={`h-2 w-2 rounded-full ${proctorStatus === 'healthy' ? 'bg-emerald-500' : proctorStatus === 'warning' ? 'bg-amber-500' : 'bg-rose-500'}`}></span> Secure Proctor Mode Active · {tabAwayCount} security event{tabAwayCount === 1 ? '' : 's'}</div>
      <div><p className="text-xs text-emerald-400 font-bold uppercase">{section==='mcq'?'Section A — MCQ':'Section B — Theory'}</p>
      <h1 className="font-bold">{test.title}</h1><p className="text-xs text-slate-400">Candidate: {studentName}</p></div>
      <div className="text-right"><p className="font-bold">{answered} / {list.length} answered</p>
      {section==='theory' && mcqScore!==null && <p className="text-xs text-slate-400 flex gap-1 items-center justify-end"><Lock className="w-3 h-3"/> MCQ locked: {mcqScore}%</p>}</div>
    </header>
    <main className="max-w-4xl mx-auto p-6 md:p-10 space-y-6">
      <div className="flex flex-wrap gap-2">{list.map((q,i)=><button key={q.id} onClick={()=>setIndex(i)}
        className={`w-10 h-10 rounded-lg border font-bold ${i===index?'bg-emerald-600 border-emerald-500':'bg-slate-900 border-slate-800'}`}>{i+1}</button>)}</div>
      {current && <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-6">
        <div><p className="text-xs text-slate-400 uppercase font-bold tracking-widest">Question {index+1} of {list.length}</p>
        <h2 className="text-lg font-semibold leading-relaxed mt-2 whitespace-pre-line">{current.text}</h2></div>
        {section==='mcq' ? <div className="space-y-3">{current.options.map((o,i)=><button key={i} onClick={()=>setMcqAnswers(a=>({...a,[current.id]:i}))}
          className={`w-full text-left p-4 rounded-xl border ${mcqAnswers[current.id]===i?'border-emerald-500 bg-emerald-500/10':'border-slate-800 bg-slate-950/40'}`}>
          <span className="font-bold mr-2">{String.fromCharCode(65+i)}.</span>{o}</button>)}</div>
        : <div><textarea value={theoryAnswers[current.id]||''} onChange={e=>setTheoryAnswers(a=>({...a,[current.id]:e.target.value}))}
            rows={14} placeholder="Type your answer and calculations here. No drawing or graphical input is required."
            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-sm leading-relaxed focus:border-emerald-500 outline-none"/>
          <p className="text-xs text-slate-500 mt-2">Text and calculation workings are accepted.</p></div>}
      </section>}
      <div className="flex justify-between gap-4">
        <button disabled={index===0} onClick={()=>setIndex(i=>Math.max(0,i-1))} className="px-4 py-2 rounded-lg bg-slate-800 disabled:opacity-30 flex gap-2"><ChevronLeft/> Previous</button>
        {index<list.length-1 ? <button onClick={()=>setIndex(i=>i+1)} className="px-4 py-2 rounded-lg bg-slate-800 flex gap-2">Next <ChevronRight/></button>
        : section==='mcq' ? <button disabled={busy} onClick={submitMcq} className="px-6 py-3 rounded-lg bg-emerald-600 font-bold disabled:opacity-50">{busy?'Submitting...':'Submit MCQ & View Score'}</button>
        : <button disabled={busy} onClick={submitTheory} className="px-6 py-3 rounded-lg bg-emerald-600 font-bold disabled:opacity-50">{busy?'Submitting...':'Submit Theory'}</button>}
      </div>
    </main>
  </div>;
}

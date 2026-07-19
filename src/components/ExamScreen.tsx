import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldAlert, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle, 
  AlertOctagon, 
  Video, 
  VolumeX, 
  Activity, 
  AlertCircle,
  Eye,
  Minimize,
  Flag,
  ClipboardList,
  AlertTriangle,
  Check,
  FileText,
  Lock
} from 'lucide-react';
import { Test, Question, ProctorLogEvent, ProctorEventType } from '../types';
import CountdownTimer from './CountdownTimer';

// Dynamically determine API Base URL.
// When running in a custom deployed frontend (such as GitHub Pages or local preview targeting remote server),
// we route requests to the deployed live container backend endpoint.
const API_BASE = (
  typeof window !== 'undefined' && 
  !window.location.hostname.includes('localhost') && 
  !window.location.hostname.includes('run.app') &&
  !window.location.hostname.includes('0.0.0.0') &&
  !window.location.hostname.includes('127.0.0.1')
) ? 'https://ais-pre-y7jivk2vjghx37l36lh74p-385275779151.europe-west2.run.app' : '';

interface ExamScreenProps {
  test: Test;
  studentName: string;
  simType: string;
  onSubmitExam: (answers: Record<string, number>, logs: ProctorLogEvent[], tabAwayCount: number) => void;
  onExitExam: () => void;
}

export default function ExamScreen({
  test,
  studentName,
  simType,
  onSubmitExam,
  onExitExam
}: ExamScreenProps) {
  // Exam progress state
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem(`aura_exam_answers_${test.id}`);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [flaggedQuestions, setFlaggedQuestions] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(`aura_exam_flags_${test.id}`);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [timeLeft, setTimeLeft] = useState(() => {
    try {
      const saved = localStorage.getItem(`aura_exam_time_${test.id}`);
      return saved ? parseInt(saved, 10) : test.durationMinutes * 60;
    } catch {
      return test.durationMinutes * 60;
    }
  });
  const [tabAwayCount, setTabAwayCount] = useState(0);
  const [showBlurModal, setShowBlurModal] = useState(false);
  const [showSummaryView, setShowSummaryView] = useState(false);
  const [honorCodeChecked, setHonorCodeChecked] = useState(false);

  // Sync exam states to localStorage on every update
  useEffect(() => {
    localStorage.setItem(`aura_exam_answers_${test.id}`, JSON.stringify(answers));
  }, [answers, test.id]);

  useEffect(() => {
    localStorage.setItem(`aura_exam_flags_${test.id}`, JSON.stringify(flaggedQuestions));
  }, [flaggedQuestions, test.id]);

  useEffect(() => {
    localStorage.setItem(`aura_exam_time_${test.id}`, timeLeft.toString());
  }, [timeLeft, test.id]);

  const toggleFlagQuestion = (questionId: string) => {
    setFlaggedQuestions((prev) => ({
      ...prev,
      [questionId]: !prev[questionId]
    }));
  };

  // Proctor & Webcam states
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [proctorLogs, setProctorLogs] = useState<ProctorLogEvent[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [proctorStatus, setProctorStatus] = useState<'healthy' | 'warning' | 'critical'>('healthy');
  const [nextCheckIn, setNextCheckIn] = useState(12);

  // HTML Audio element fallback
  const beepAudioRef = useRef<HTMLAudioElement | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const proctorIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  // Play a soft sound alert on proctor flags
  const playAlertSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.value = 440; // A4 tone
      gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
      
      oscillator.start();
      // Stop after 200ms
      setTimeout(() => {
        oscillator.stop();
        audioCtx.close();
      }, 200);
    } catch (e) {
      console.log('Audio Context beep play blocked or unsupported by browser sandbox.');
    }
  };

  // 1. Initialize Exam Timers
  useEffect(() => {
    // Countdown clock
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // AI Proctor Check-In counter
    countdownRef.current = setInterval(() => {
      setNextCheckIn((prev) => {
        if (prev <= 1) {
          captureAndAnalyzeProctorFrame();
          return 12; // Cycle back every 12 seconds
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  // 2. Initialize Video Stream
  useEffect(() => {
    let activeStream: MediaStream | null = null;
    async function startWebcam() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 240, facingMode: 'user' },
          audio: false
        });
        activeStream = stream;
        setCameraStream(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error('Failed to get webcam stream during testing:', err);
        addProctorLog('camera_disabled', 'medium', 'System warning: Examination camera feed is disabled or offline. Connection required.');
      }
    }
    startWebcam();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // 3. Setup Browser Navigation Monitoring & Anti-Cheat Restrictions (Prevent tab switching, copying, right-clicks, or print screenshots)
  useEffect(() => {
    const handleWindowBlur = () => {
      setTabAwayCount((prev) => {
        const nextVal = prev + 1;
        addProctorLog(
          'tab_away', 
          'high', 
          `Security Alert: Student blurred or exited the exam viewport (${nextVal} time). Logged onto credentials.`
        );
        setShowBlurModal(true);
        playAlertSound();
        return nextVal;
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        setTabAwayCount((prev) => {
          const nextVal = prev + 1;
          addProctorLog(
            'tab_away', 
            'high', 
            `Security Alert: Student minimized or switched browser tab (${nextVal} time).`
          );
          setShowBlurModal(true);
          playAlertSound();
          return nextVal;
        });
      }
    };

    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      addProctorLog(
        'unauthorized_copy',
        'high',
        'Security Alert: Unauthorized question content copying attempt blocked. Text replication is disabled.'
      );
      playAlertSound();
    };

    const handleCut = (e: ClipboardEvent) => {
      e.preventDefault();
      addProctorLog(
        'unauthorized_copy',
        'high',
        'Security Alert: Text cutting attempt blocked.'
      );
      playAlertSound();
    };

    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      addProctorLog(
        'unauthorized_copy',
        'medium',
        'Security Warning: Text pasting attempt blocked. External reference integration is disabled.'
      );
      playAlertSound();
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      addProctorLog(
        'unauthorized_copy',
        'medium',
        'Security Warning: Right-click context menu is disabled to prevent inspector operations or saving question assets.'
      );
      playAlertSound();
    };

    const handleDragStart = (e: DragEvent) => {
      e.preventDefault();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      
      // PrintScreen / PrtScn trigger
      if (e.key === 'PrintScreen' || e.key === 'PrtScn' || e.key === 'Snapshot') {
        e.preventDefault();
        addProctorLog(
          'unauthorized_copy',
          'high',
          'Security Alert: Screen print-screen or screen-capture keystroke attempt blocked.'
        );
        playAlertSound();
        return;
      }

      // Cmd/Ctrl + P (Print)
      if (isCtrlOrCmd && e.key?.toLowerCase() === 'p') {
        e.preventDefault();
        addProctorLog(
          'unauthorized_copy',
          'high',
          'Security Alert: Print command shortcut (Ctrl/Cmd + P) blocked. Hard-copy creation is disabled.'
        );
        playAlertSound();
        return;
      }

      // Cmd/Ctrl + S (Save Offline)
      if (isCtrlOrCmd && e.key?.toLowerCase() === 's') {
        e.preventDefault();
        addProctorLog(
          'unauthorized_copy',
          'high',
          'Security Alert: Offline save shortcut (Ctrl/Cmd + S) blocked. Local exam downloads are prohibited.'
        );
        playAlertSound();
        return;
      }

      // Cmd/Ctrl + C (Copy)
      if (isCtrlOrCmd && e.key?.toLowerCase() === 'c') {
        e.preventDefault();
        addProctorLog(
          'unauthorized_copy',
          'high',
          'Security Alert: Clipboard copy shortcut (Ctrl/Cmd + C) blocked.'
        );
        playAlertSound();
        return;
      }

      // Cmd/Ctrl + X (Cut)
      if (isCtrlOrCmd && e.key?.toLowerCase() === 'x') {
        e.preventDefault();
        addProctorLog(
          'unauthorized_copy',
          'high',
          'Security Alert: Text cut shortcut (Ctrl/Cmd + X) blocked.'
        );
        playAlertSound();
        return;
      }

      // F12 developer console
      if (e.key === 'F12') {
        e.preventDefault();
        addProctorLog(
          'unauthorized_copy',
          'high',
          'Security Alert: F12 developer tool keyboard shortcut blocked.'
        );
        playAlertSound();
        return;
      }

      // Inspector shortcuts: Ctrl+Shift+I / Cmd+Opt+I or C / J
      if (isCtrlOrCmd && e.shiftKey && (e.key?.toLowerCase() === 'i' || e.key?.toLowerCase() === 'c' || e.key?.toLowerCase() === 'j')) {
        e.preventDefault();
        addProctorLog(
          'unauthorized_copy',
          'high',
          'Security Alert: Developer console inspection tool shortcut blocked.'
        );
        playAlertSound();
        return;
      }

      if (isCtrlOrCmd && e.altKey && (e.key?.toLowerCase() === 'i' || e.key?.toLowerCase() === 'c' || e.key?.toLowerCase() === 'j')) {
        e.preventDefault();
        addProctorLog(
          'unauthorized_copy',
          'high',
          'Security Alert: Developer console inspection tool shortcut blocked.'
        );
        playAlertSound();
        return;
      }

      // View Source shortcut Ctrl/Cmd + U
      if (isCtrlOrCmd && e.key?.toLowerCase() === 'u') {
        e.preventDefault();
        addProctorLog(
          'unauthorized_copy',
          'high',
          'Security Alert: View Source code shortcut (Ctrl/Cmd + U) blocked.'
        );
        playAlertSound();
        return;
      }

      // Academic exam question navigation shortcuts (when summary view is closed)
      if (!showSummaryView) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          setCurrentQuestionIndex((prev) => Math.max(0, prev - 1));
          return;
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          setCurrentQuestionIndex((prev) => Math.min(test.questions.length - 1, prev + 1));
          return;
        }
        if (e.key?.toLowerCase() === 'f') {
          e.preventDefault();
          const qId = test.questions[currentQuestionIndex]?.id;
          if (qId) {
            toggleFlagQuestion(qId);
          }
          return;
        }
        if (['1', '2', '3', '4'].includes(e.key)) {
          e.preventDefault();
          const optionIdx = parseInt(e.key, 10) - 1;
          const qId = test.questions[currentQuestionIndex]?.id;
          if (qId && optionIdx < (test.questions[currentQuestionIndex]?.options.length || 0)) {
            handleOptionSelect(qId, optionIdx);
          }
          return;
        }
      }
    };

    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('cut', handleCut);
    document.addEventListener('paste', handlePaste);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('dragstart', handleDragStart);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('cut', handleCut);
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('dragstart', handleDragStart);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentQuestionIndex, showSummaryView, test.questions, test.id]);

  // Helper: Append logs and calculate overall proctor state
  const addProctorLog = (type: ProctorEventType, severity: 'low' | 'medium' | 'high', message: string, snapshotUrl?: string) => {
    const newLog: ProctorLogEvent = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      timestamp: new Date().toISOString(),
      type,
      severity,
      message,
      snapshotUrl
    };

    setProctorLogs((prev) => {
      const updated = [newLog, ...prev];
      // Evaluate proctor safety level
      const highAlerts = updated.filter(l => l.severity === 'high').length;
      const mediumAlerts = updated.filter(l => l.severity === 'medium').length;

      if (highAlerts >= 3 || updated.length >= 8) {
        setProctorStatus('critical');
      } else if (highAlerts > 0 || mediumAlerts > 1) {
        setProctorStatus('warning');
      } else {
        setProctorStatus('healthy');
      }
      return updated;
    });
  };

  // 4. Capture & Analyze Web Camera Frame (Server-side Gemini proxy)
  const captureAndAnalyzeProctorFrame = async () => {
    if (!videoRef.current || !canvasRef.current || isAnalyzing) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) return;

    setIsAnalyzing(true);
    try {
      // Draw standard size frame
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const base64Image = canvas.toDataURL('image/jpeg', 0.6);

      // Call Express AI Proctor endpoint
      const response = await fetch(`${API_BASE}/api/proctor/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: base64Image,
          testId: test.id,
          simType: simType // pass the mock simulated status
        })
      });

      if (!response.ok) {
        throw new Error('Proctor server analysis request failed');
      }

      const result = await response.json();

      if (result.isSuspicious) {
        playAlertSound();
        // Determine correct category log mapping
        let type: ProctorEventType = 'looking_away';
        if (result.detections.includes('phone_detected')) type = 'phone_detected';
        else if (result.detections.includes('multiple_people')) type = 'multiple_people';
        else if (result.detections.includes('no_face')) type = 'no_face';
        else if (result.detections.includes('notes_detected')) type = 'notes_detected';

        addProctorLog(
          type,
          'high',
          `AI Alert: ${result.reason} (Confidence: ${Math.round(result.confidence * 100)}%)`,
          base64Image // save snapshot base64 to show in timelines
        );
      }
    } catch (err) {
      console.error('Proctor snapshot routine error:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Handle auto-submission when timer expires
  const handleAutoSubmit = () => {
    try {
      localStorage.removeItem(`aura_exam_answers_${test.id}`);
      localStorage.removeItem(`aura_exam_flags_${test.id}`);
      localStorage.removeItem(`aura_exam_time_${test.id}`);
    } catch (e) {
      console.error(e);
    }
    alert('Security Notice: Time limit has expired. Your current assessment state is being packaged and submitted automatically.');
    onSubmitExam(answers, proctorLogs, tabAwayCount);
  };

  // Handle final button submission to open summary view
  const triggerManualSubmit = () => {
    setShowSummaryView(true);
  };

  // Perform final submit to the portal after user confirmation
  const handleFinalSubmit = () => {
    if (!honorCodeChecked) return;
    try {
      localStorage.removeItem(`aura_exam_answers_${test.id}`);
      localStorage.removeItem(`aura_exam_flags_${test.id}`);
      localStorage.removeItem(`aura_exam_time_${test.id}`);
    } catch (e) {
      console.error(e);
    }
    onSubmitExam(answers, proctorLogs, tabAwayCount);
  };

  const handleOptionSelect = (questionId: string, optionIndex: number) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: optionIndex
    }));
  };

  const currentQuestion = test.questions[currentQuestionIndex];

  // Formatting remaining time
  const formatTime = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div id="exam-screen" className="min-h-screen bg-slate-950 text-slate-100 flex flex-col select-none">
      {/* Exam Screen Banner Header */}
      <header className="border-b border-slate-900 bg-slate-950 px-6 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>
            <span className="text-xs uppercase font-bold text-slate-400 tracking-wider">
              Secure Proctor Mode Active
            </span>
          </div>
          <span className="text-slate-700">|</span>
          <div>
            <h1 className="text-sm font-bold text-white max-w-[320px] truncate">{test.title}</h1>
            <p className="text-[10px] text-slate-500 font-medium">Candidate: {studentName}</p>
          </div>
        </div>

        {/* Timers & Actions */}
        <div className="flex items-center gap-6">
          <CountdownTimer timeLeft={timeLeft} durationMinutes={test.durationMinutes} />

          <button
            onClick={triggerManualSubmit}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-lg transition-all shadow-sm flex items-center gap-1.5"
          >
            <CheckCircle className="w-4 h-4" /> Submit Exam
          </button>
        </div>
      </header>

      {/* Main Container Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        
        {/* Left: Quick-Navigation Sidebar */}
        <aside className="lg:col-span-3 xl:col-span-2 border-r border-slate-900 bg-slate-950/20 p-5 space-y-6 max-h-[calc(100vh-73px)] overflow-y-auto hidden lg:block">
          <div className="space-y-1">
            <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-emerald-500" /> Question Map
            </h3>
            <p className="text-[10px] text-slate-500">Jump & status overview</p>
          </div>

          {/* Progress Summary Card */}
          <div className="bg-slate-900/60 border border-slate-900 p-3.5 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-semibold">Progress</span>
              <span className="font-bold text-white font-mono">
                {Object.keys(answers).length} / {test.questions.length}
              </span>
            </div>
            {/* Progress bar */}
            <div className="w-full h-1 bg-slate-950 rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-500 rounded-full transition-all duration-300" 
                style={{ width: `${(Object.keys(answers).length / test.questions.length) * 100}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium pt-1">
              <span>Answered: {Object.keys(answers).length}</span>
              <span>Flagged: {Object.values(flaggedQuestions).filter(Boolean).length}</span>
            </div>
          </div>

          {/* Grid of buttons */}
          <div className="grid grid-cols-4 gap-2">
            {test.questions.map((q, idx) => {
              const isSelected = idx === currentQuestionIndex && !showSummaryView;
              const isAnswered = answers[q.id] !== undefined;
              const isFlagged = flaggedQuestions[q.id] === true;

              return (
                <button
                  key={q.id}
                  onClick={() => {
                    setCurrentQuestionIndex(idx);
                    setShowSummaryView(false);
                  }}
                  className={`relative aspect-square rounded-xl text-xs font-bold transition-all border flex flex-col items-center justify-center ${
                    isSelected
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-lg scale-105'
                      : isAnswered
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                      : 'bg-slate-900/40 text-slate-400 border-slate-900 hover:border-slate-850'
                  }`}
                >
                  <span>{idx + 1}</span>
                  
                  {/* Indicators overlay */}
                  {isFlagged && (
                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-500 rounded-full flex items-center justify-center shadow">
                      <Flag className="w-2 h-2 text-slate-950 fill-current" />
                    </span>
                  )}
                  {isAnswered && !isSelected && (
                    <span className="absolute bottom-1 w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Quick Review Submission button */}
          <button
            onClick={() => setShowSummaryView((prev) => !prev)}
            className={`w-full py-2.5 px-4 text-xs font-bold rounded-xl border transition-all flex items-center justify-center gap-1.5 ${
              showSummaryView
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-md'
                : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300'
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5" />
            {showSummaryView ? 'Back to Questions' : 'Review & Submit'}
          </button>

          {/* Map Legend */}
          <div className="space-y-2 pt-4 border-t border-slate-900/60">
            <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">Map Legend</h4>
            <div className="space-y-2 text-[10px] text-slate-400 font-semibold">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-lg border border-emerald-500 bg-emerald-600 flex items-center justify-center shrink-0 text-[10px] text-white font-bold">1</div>
                <span>Active Question</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 flex items-center justify-center shrink-0 text-[10px] text-emerald-400 font-bold">1</div>
                <span>Answered</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-lg border border-slate-900 bg-slate-900/40 flex items-center justify-center shrink-0 text-[10px] text-slate-400 font-bold">1</div>
                <span>Unanswered</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative w-5 h-5 rounded-lg border border-slate-900 bg-slate-900/40 flex items-center justify-center shrink-0 text-[10px] text-slate-400 font-bold">
                  1
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full flex items-center justify-center">
                    <Flag className="w-2 h-2 text-slate-950 fill-current" />
                  </span>
                </div>
                <span>Flagged for Review</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Center: Dynamic Questions Sheet */}
        <main className="lg:col-span-6 xl:col-span-7 p-6 md:p-8 space-y-8 overflow-y-auto max-h-[calc(100vh-73px)]">
          
          {showSummaryView ? (
            <div className="space-y-6">
              {/* Summary Header */}
              <div className="border-b border-slate-900 pb-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs uppercase font-extrabold tracking-widest text-slate-400">
                    Secure Submission Review
                  </span>
                </div>
                <h2 className="text-xl font-bold text-white leading-tight">
                  Academic Integrity Review & Final Confirmation
                </h2>
                <p className="text-xs text-slate-400">
                  Please review your responses below. Answered questions will be submitted for scoring. Unanswered questions will receive zero credit.
                </p>
              </div>

              {/* Stats Overview */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-slate-900/40 border border-slate-900 p-4 rounded-xl space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Answered Questions</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-extrabold text-emerald-400">
                      {Object.keys(answers).length}
                    </span>
                    <span className="text-xs text-slate-500">/ {test.questions.length}</span>
                  </div>
                </div>

                <div className="bg-slate-900/40 border border-slate-900 p-4 rounded-xl space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Unanswered Questions</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className={`text-2xl font-extrabold ${test.questions.length - Object.keys(answers).length > 0 ? 'text-amber-500' : 'text-slate-400'}`}>
                      {test.questions.length - Object.keys(answers).length}
                    </span>
                    <span className="text-xs text-slate-500">remaining</span>
                  </div>
                </div>

                <div className="bg-slate-900/40 border border-slate-900 p-4 rounded-xl space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Proctor Flags</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className={`text-2xl font-extrabold ${proctorLogs.length > 0 ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}`}>
                      {proctorLogs.length}
                    </span>
                    <span className="text-xs text-slate-500">recorded</span>
                  </div>
                </div>
              </div>

              {/* Side by side answered vs unanswered */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Column 1: Answered */}
                <div className="space-y-3">
                  <h3 className="text-xs font-extrabold uppercase tracking-widest text-emerald-400 flex items-center gap-1.5">
                    <Check className="w-4 h-4" /> Answered List ({Object.keys(answers).length})
                  </h3>
                  
                  <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                    {test.questions.filter(q => answers[q.id] !== undefined).length === 0 ? (
                      <div className="p-4 bg-slate-900/20 border border-dashed border-slate-900 rounded-xl text-center text-xs text-slate-500">
                        No questions have been answered yet.
                      </div>
                    ) : (
                      test.questions
                        .map((q, idx) => {
                          const ansIndex = answers[q.id];
                          if (ansIndex === undefined) return null;
                          return (
                            <div 
                              key={q.id}
                              onClick={() => {
                                setCurrentQuestionIndex(idx);
                                setShowSummaryView(false);
                              }}
                              className="p-3 bg-slate-900/30 border border-slate-900 hover:border-slate-800 rounded-xl transition cursor-pointer text-left space-y-1 group"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                                  Question {idx + 1}
                                </span>
                                <span className="text-[9px] text-emerald-500 group-hover:underline font-bold">Edit</span>
                              </div>
                              <p className="text-xs font-semibold text-slate-200 line-clamp-1">{q.text}</p>
                              <p className="text-xs text-emerald-400/90 font-medium">
                                Chosen: <span className="font-bold">[{String.fromCharCode(65 + ansIndex)}]</span> {q.options[ansIndex]}
                              </p>
                            </div>
                          );
                        })
                        .filter(Boolean)
                    )}
                  </div>
                </div>

                {/* Column 2: Unanswered */}
                <div className="space-y-3">
                  <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-500" /> Unanswered List ({test.questions.length - Object.keys(answers).length})
                  </h3>

                  <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                    {test.questions.filter(q => answers[q.id] === undefined).length === 0 ? (
                      <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl text-center text-xs text-emerald-400 font-bold flex flex-col items-center justify-center gap-2 py-8">
                        <Check className="w-6 h-6 bg-emerald-500/10 p-1 rounded-full text-emerald-400" />
                        All questions complete! Ready to submit.
                      </div>
                    ) : (
                      test.questions.map((q, idx) => {
                        if (answers[q.id] !== undefined) return null;
                        return (
                          <div 
                            key={q.id}
                            onClick={() => {
                              setCurrentQuestionIndex(idx);
                              setShowSummaryView(false);
                            }}
                            className="p-3 bg-amber-500/5 border border-amber-500/10 hover:border-amber-500/30 rounded-xl transition cursor-pointer text-left space-y-1.5 group"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wide flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" /> Question {idx + 1} (Unanswered)
                              </span>
                              <span className="text-[9px] text-amber-500 group-hover:underline font-bold">Answer Now</span>
                            </div>
                            <p className="text-xs font-semibold text-slate-300 line-clamp-1">{q.text}</p>
                          </div>
                        );
                      }).filter(Boolean)
                    )}
                  </div>
                </div>

              </div>

              {/* Honor Code certification */}
              <div className="bg-slate-900/60 border border-slate-900 rounded-xl p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="honor-code-checkbox"
                    checked={honorCodeChecked}
                    onChange={(e) => setHonorCodeChecked(e.target.checked)}
                    className="w-5 h-5 rounded border-slate-800 text-emerald-600 focus:ring-emerald-500 bg-slate-950 mt-0.5 shrink-0 transition-colors cursor-pointer"
                  />
                  <label htmlFor="honor-code-checkbox" className="text-xs text-slate-300 leading-relaxed font-semibold cursor-pointer select-none">
                    I certify that this submission represents my own work and is in complete compliance with institutional academic honesty standards. I acknowledge that my session proctor transcript has been tracked and is ready to be processed by AURA Security Services.
                  </label>
                </div>
              </div>

              {/* Bottom buttons */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-slate-900">
                <button
                  onClick={() => setShowSummaryView(false)}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5"
                >
                  <ChevronLeft className="w-4 h-4" /> Return to Assessment
                </button>

                <button
                  onClick={handleFinalSubmit}
                  disabled={!honorCodeChecked}
                  className={`px-6 py-3 font-bold text-sm rounded-xl transition flex items-center justify-center gap-2 ${
                    honorCodeChecked
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/10 cursor-pointer'
                      : 'bg-slate-900 text-slate-500 border border-slate-800 cursor-not-allowed'
                  }`}
                >
                  <CheckCircle className="w-4 h-4" /> Confirm Final Submission
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Mobile Question Navigator (visible only on mobile) */}
              <div className="lg:hidden space-y-3 pb-4 border-b border-slate-900">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Mobile Map</span>
                  <span className="text-xs font-bold text-slate-400">{Object.keys(answers).length} / {test.questions.length} Answered</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {test.questions.map((q, idx) => {
                    const isSelected = idx === currentQuestionIndex && !showSummaryView;
                    const isAnswered = answers[q.id] !== undefined;
                    const isFlagged = flaggedQuestions[q.id] === true;

                    return (
                      <button
                        key={q.id}
                        onClick={() => {
                          setCurrentQuestionIndex(idx);
                          setShowSummaryView(false);
                        }}
                        className={`relative w-8 h-8 rounded-lg text-xs font-bold transition-all border flex items-center justify-center ${
                          isSelected
                            ? 'bg-emerald-600 text-white border-emerald-500'
                            : isAnswered
                            ? 'bg-slate-900 text-emerald-400 border-emerald-500/20'
                            : 'bg-slate-950 text-slate-400 border-slate-900'
                        }`}
                      >
                        <span>{idx + 1}</span>
                        {isFlagged && (
                          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-amber-500 rounded-full flex items-center justify-center">
                            <Flag className="w-1.5 h-1.5 text-slate-950 fill-current" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Current Question Block */}
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <span className="text-xs uppercase font-semibold text-emerald-500">
                      Question {currentQuestionIndex + 1} of {test.questions.length}
                    </span>
                    <h2 className="text-xl font-semibold text-white leading-relaxed">
                      {currentQuestion.text}
                    </h2>
                  </div>
                  <button
                    onClick={() => toggleFlagQuestion(currentQuestion.id)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 ${
                      flaggedQuestions[currentQuestion.id]
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-750'
                    }`}
                  >
                    <Flag className={`w-3.5 h-3.5 ${flaggedQuestions[currentQuestion.id] ? 'fill-current text-amber-400' : ''}`} />
                    {flaggedQuestions[currentQuestion.id] ? 'Flagged for Review' : 'Flag Question'}
                  </button>
                </div>

                {/* Answer Options Radio Stack */}
                <div className="grid grid-cols-1 gap-4 pt-2">
                  {currentQuestion.options.map((option, oIdx) => {
                    const isSelected = answers[currentQuestion.id] === oIdx;

                    return (
                      <button
                        key={oIdx}
                        onClick={() => handleOptionSelect(currentQuestion.id, oIdx)}
                        className={`p-4 rounded-xl border text-left transition-all flex items-start gap-3.5 group relative overflow-hidden ${
                          isSelected
                            ? 'bg-slate-900 border-emerald-500/80 text-white shadow-md'
                            : 'bg-slate-950 border-slate-900 text-slate-300 hover:bg-slate-900 hover:border-slate-800'
                        }`}
                      >
                        {/* Circle identifier */}
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all font-mono text-[10px] font-bold ${
                          isSelected
                            ? 'border-emerald-500 bg-emerald-500 text-slate-950'
                            : 'border-slate-800 text-slate-400 group-hover:border-slate-600'
                        }`}>
                          {String.fromCharCode(65 + oIdx)}
                        </div>
                        
                        <span className="text-sm font-medium leading-relaxed">{option}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Keyboard Shortcuts Hint Bar */}
                <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-[10px] text-slate-500 font-semibold bg-slate-900/10 border border-slate-900/60 p-2.5 rounded-lg select-none">
                  <span className="text-emerald-500 font-extrabold uppercase tracking-wider flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    Hotkeys Active:
                  </span>
                  <span>[← / →] Prev/Next Question</span>
                  <span>•</span>
                  <span>[1 - 4] Select Answer</span>
                  <span>•</span>
                  <span>[F] Toggle Flag</span>
                </div>
              </div>

              {/* Navigation Controls */}
              <div className="flex items-center justify-between pt-6 border-t border-slate-900">
                <button
                  onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                  disabled={currentQuestionIndex === 0}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-200 border border-slate-800 text-xs font-bold rounded-lg transition flex items-center gap-1.5"
                >
                  <ChevronLeft className="w-4 h-4" /> Previous
                </button>

                <span className="text-xs text-slate-500 font-semibold">
                  Double-check answers before submitting.
                </span>

                {currentQuestionIndex < test.questions.length - 1 ? (
                  <button
                    onClick={() => setCurrentQuestionIndex(prev => Math.min(test.questions.length - 1, prev + 1))}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 text-xs font-bold rounded-lg transition flex items-center gap-1.5"
                  >
                    Next <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={triggerManualSubmit}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition shadow-sm"
                  >
                    Finish Exam
                  </button>
                )}
              </div>
            </>
          )}

        </main>

        {/* Right Side: AI Proctoring Sidebar panel */}
        <aside className="border-l border-slate-900 bg-slate-950/40 p-5 space-y-6 max-h-[calc(100vh-73px)] overflow-y-auto">
          
          {/* Section title */}
          <div className="space-y-1">
            <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <Eye className="w-4 h-4 text-emerald-500" /> Proctor Monitor
            </h3>
            <p className="text-[10px] text-slate-500">Live AI compliance checking</p>
          </div>

          {/* 1. Video stream container */}
          <div className="relative aspect-video bg-slate-950 border border-slate-900 rounded-xl overflow-hidden shadow-inner shrink-0">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]"
            />
            {/* Overlay indicators */}
            <div className="absolute top-2 left-2 bg-slate-950/80 backdrop-blur-sm border border-slate-800 px-1.5 py-0.5 rounded text-[8px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping"></span> Live Webcam
            </div>

            {isAnalyzing && (
              <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[1px] flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-[10px] font-bold text-white uppercase tracking-wider">AI Auditing Frame...</span>
              </div>
            )}
          </div>

          <canvas ref={canvasRef} width="320" height="240" className="hidden" />

          {/* 2. Proctor Status Index lights */}
          <div className="bg-slate-950 border border-slate-900 rounded-xl p-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Status Audit</span>
              <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider ${
                proctorStatus === 'healthy'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : proctorStatus === 'warning'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/20 animate-pulse'
              }`}>
                {proctorStatus === 'healthy' ? 'SECURE' : proctorStatus === 'warning' ? 'WARNINGS' : 'CRITICAL FLAG'}
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium">
                <span>Tab Away Tally</span>
                <span className={tabAwayCount > 0 ? 'text-amber-500 font-bold' : 'text-slate-300'}>{tabAwayCount}</span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium">
                <span>AI Proctor Logs</span>
                <span>{proctorLogs.length} flags</span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium">
                <span>Verification Schedule</span>
                <span className="font-mono text-emerald-400 font-bold">Every {nextCheckIn}s</span>
              </div>
            </div>
          </div>

          {/* 3. Dynamic Realtime log notifications */}
          <div className="space-y-3">
            <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Real-Time Integrity Logs</h4>
            <div className="space-y-2 max-h-[190px] overflow-y-auto pr-1">
              {proctorLogs.length === 0 ? (
                <div className="text-center py-6 text-slate-600 text-[11px] border border-dashed border-slate-900 rounded-lg bg-slate-950/20">
                  No integrity alerts logged. Compliance looks flawless.
                </div>
              ) : (
                proctorLogs.map((log) => (
                  <div 
                    key={log.id}
                    className={`p-2.5 rounded-lg border text-[11px] leading-snug space-y-1 ${
                      log.severity === 'high'
                        ? 'bg-rose-950/20 border-rose-900/40 text-rose-300'
                        : 'bg-amber-950/20 border-amber-900/40 text-amber-300'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[9px] text-slate-500 font-bold">
                      <span className="uppercase">{log.type.replace('_', ' ')}</span>
                      <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <p className="font-medium text-slate-300">{log.message}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Guidelines hint */}
          <div className="p-3.5 bg-slate-900/40 border border-slate-900 rounded-xl flex items-start gap-2 text-[10px] text-slate-500 leading-normal">
            <AlertCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <p>Your camera capture processes fully inside our secure AI microservices. Keep your environment bright, quiet, and do not use electronic devices.</p>
          </div>

        </aside>
      </div>

      {/* 4. Overlay Warning modal on Window Blur */}
      <AnimatePresence>
        {showBlurModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-slate-900 border border-red-500/30 rounded-2xl p-6 md:p-8 max-w-md w-full text-center space-y-6 shadow-2xl"
            >
              <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl flex items-center justify-center mx-auto">
                <ShieldAlert className="w-8 h-8 animate-bounce" />
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-bold text-white">SECURITY VIOLATION REGISTERED</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  The AI Proctor system detected that your browser window lost focus or you attempted to switch screens/tabs. This activity was logged directly onto your student credentials.
                </p>
              </div>

              <div className="p-3 bg-red-500/5 rounded-lg border border-red-500/10 text-xs text-red-400 font-semibold">
                Total Tab-Away Detections: {tabAwayCount}
              </div>

              <button
                onClick={() => setShowBlurModal(false)}
                className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-sm transition-all shadow-md focus:ring-2 focus:ring-red-500/50 outline-none"
              >
                Return to Assessment Securely
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

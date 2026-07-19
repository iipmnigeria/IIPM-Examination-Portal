import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Camera, 
  ShieldCheck, 
  Play, 
  CheckCircle2, 
  AlertTriangle, 
  User, 
  Clock, 
  HelpCircle,
  FileText,
  Activity,
  UserCheck,
  Eye,
  Info,
  GraduationCap,
  Award,
  BookOpen,
  Trophy,
  Printer,
  X,
  FileSpreadsheet,
  Sparkles
} from 'lucide-react';
import { Test, Attempt } from '../types';
// @ts-ignore
import iipmSeal from '../assets/images/iipm_seal_1784411386400.jpg';

interface StudentDashboardProps {
  studentName: string;
  setStudentName: (name: string) => void;
  tests: Test[];
  attempts: Attempt[];
  onStartExam: (testId: string) => void;
  onViewAttemptDetails: (attempt: Attempt) => void;
  simType: string;
  setSimType: (type: string) => void;
  justCompletedAttempt?: Attempt | null;
  onClearJustCompleted?: () => void;
}

export default function StudentDashboard({
  studentName,
  setStudentName,
  tests,
  attempts,
  onStartExam,
  onViewAttemptDetails,
  simType,
  setSimType,
  justCompletedAttempt,
  onClearJustCompleted
}: StudentDashboardProps) {
  const [cameraState, setCameraState] = useState<'untested' | 'checking' | 'active' | 'error'>('untested');
  const [errorMessage, setErrorMessage] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Tab control
  const [activeTab, setActiveTab] = useState<'catalog' | 'gradebook'>('catalog');
  const [selectedScorecard, setSelectedScorecard] = useState<Attempt | null>(null);
  const [selectedCertificate, setSelectedCertificate] = useState<Attempt | null>(null);
  const [logoSrc, setLogoSrc] = useState<string>('https://iipmi.org/wp-content/uploads/2022/08/IIPM-Logo-PNG-1024x1021.png');
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    if (justCompletedAttempt) {
      setActiveTab('gradebook');
    }
  }, [justCompletedAttempt]);

  // Initialize and check camera permissions
  const startCameraCheck = async () => {
    setCameraState('checking');
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 480, height: 360, facingMode: 'user' } 
      });
      
      streamRef.current = stream;
      setCameraState('active');
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      setCameraState('error');
      setErrorMessage(err.message || 'Camera permission denied or camera in use by another application.');
    }
  };

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Sync camera preview element if active
  useEffect(() => {
    if (cameraState === 'active' && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [cameraState]);

  // Aggregate stats computations for Gradebook
  const completedAttempts = attempts.filter(a => a.status !== 'ongoing');
  const averageScore = completedAttempts.length > 0
    ? Math.round(completedAttempts.reduce((sum, a) => sum + (a.score || 0), 0) / completedAttempts.length)
    : 0;
  
  const passingAttempts = completedAttempts.filter(a => (a.score || 0) >= 70);
  const passRate = completedAttempts.length > 0
    ? Math.round((passingAttempts.length / completedAttempts.length) * 100)
    : 0;

  const totalCertificatesCount = completedAttempts.filter(a => (a.score || 0) >= 70 && a.status === 'submitted' && a.suspiciousScore < 50).length;

  const calculateGPA = () => {
    if (completedAttempts.length === 0) return '0.00';
    let totalPoints = 0;
    completedAttempts.forEach(a => {
      const s = a.score || 0;
      if (s >= 90) totalPoints += 4.0;
      else if (s >= 80) totalPoints += 3.0;
      else if (s >= 70) totalPoints += 2.0;
      else totalPoints += 0.0;
    });
    return (totalPoints / completedAttempts.length).toFixed(2);
  };
  const gpa = calculateGPA();

  return (
    <div id="student-dashboard" className="space-y-8 max-w-7xl mx-auto px-4 py-6">
      {/* Welcome & Profile Panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 text-white relative overflow-hidden shadow-xl">
        <div className="absolute right-0 top-0 -mt-6 -mr-6 w-36 h-36 bg-emerald-500/10 rounded-full blur-3xl"></div>
        <div className="absolute left-1/3 bottom-0 w-48 h-48 bg-teal-500/5 rounded-full blur-3xl"></div>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold rounded-full uppercase tracking-wider">
              Student Assessment Center
            </span>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
              AI-Proctored Examination Portal
            </h1>
            <p className="text-slate-400 text-sm max-w-xl">
              Ensure your browser camera is functional, input your legal identity below, and select an available examination to begin. The AI proctor will audit your webcam feed for integrity during the entire session.
            </p>
          </div>

          <div className="w-full md:w-auto min-w-[280px] bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">
              Student Identity Label (Legal Name)
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="Enter your full name..."
                className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 text-white placeholder-slate-500 text-sm rounded-lg focus:outline-none focus:border-emerald-500 transition-all font-medium"
              />
            </div>
            {studentName.trim() === '' && (
              <p className="text-amber-500 text-xs mt-1.5 flex items-center gap-1 font-medium animate-pulse">
                <AlertTriangle className="w-3 h-3" /> Name is required before beginning tests.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Tabs between Catalog & Academic Gradebook */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-px">
        <button
          onClick={() => setActiveTab('catalog')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'catalog'
              ? 'border-emerald-600 text-emerald-600 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BookOpen className="w-4.5 h-4.5" /> Examination Catalog
        </button>

        <button
          onClick={() => setActiveTab('gradebook')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'gradebook'
              ? 'border-emerald-600 text-emerald-600 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <GraduationCap className="w-4.5 h-4.5" /> Academic Gradebook & Credentials
        </button>
      </div>

      {/* 1. Exam Catalog & Diagnostic Panel */}
      {activeTab === 'catalog' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Hardware & Diagnostics Check */}
          <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                <Camera className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Device Diagnostic</h2>
                <p className="text-slate-500 text-xs">Verify webcam input before testing</p>
              </div>
            </div>

            {/* Webcam Box */}
            <div className="relative aspect-video w-full bg-slate-950 rounded-xl border border-slate-200 overflow-hidden flex flex-col items-center justify-center">
              {cameraState === 'active' ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                />
              ) : (
                <div className="p-4 text-center space-y-3 z-10">
                  {cameraState === 'checking' ? (
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-slate-400 text-xs font-medium">Initializing webcam hardware...</p>
                    </div>
                  ) : cameraState === 'error' ? (
                    <div className="space-y-2">
                      <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
                      <p className="text-rose-400 text-xs font-medium leading-relaxed">{errorMessage}</p>
                      <button
                        onClick={startCameraCheck}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-semibold transition"
                      >
                        Retry Permission Request
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <Camera className="w-8 h-8 text-slate-600 mx-auto" />
                      <p className="text-slate-400 text-xs">Webcam feed is currently inactive.</p>
                      <button
                        onClick={startCameraCheck}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-2"
                      >
                        Test Camera Connection
                      </button>
                    </div>
                  )}
                </div>
              )}
              
              {cameraState === 'active' && (
                <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-emerald-500/90 text-white text-[10px] font-bold uppercase tracking-wider rounded flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping"></span> Live Input Active
                </div>
              )}
            </div>

            {/* Proctor Rules Overview */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-3 text-slate-600">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" /> AI Proctor Guidelines
              </h4>
              <ul className="text-xs space-y-2">
                <li className="flex items-start gap-1.5">
                  <span className="text-emerald-500 font-bold">•</span>
                  <span>Maintain eye contact with your monitor. Avoid persistent off-screen gazing.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-emerald-500 font-bold">•</span>
                  <span>No secondary assistants, friends, or books should enter the webcam view.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-emerald-500 font-bold">•</span>
                  <span>Swapping browser tabs or minimizing the examination window triggers automated flags.</span>
                </li>
              </ul>
            </div>

            {/* Demo Simulation Controls */}
            <div className="border border-slate-100 rounded-xl p-4 space-y-3 bg-teal-50/50">
              <h4 className="text-xs font-bold text-teal-900 uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-teal-600" /> AI Proctor Demo Simulator
              </h4>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Enable simulated violations below to test how the real-time proctor detects, alerts, and logs academic infractions during an active exam.
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => setSimType('none')}
                  className={`px-2 py-1 text-[11px] rounded font-semibold border transition-all text-center ${
                    simType === 'none'
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  No Simulation (Clear)
                </button>
                <button
                  onClick={() => setSimType('multiple_people')}
                  className={`px-2 py-1 text-[11px] rounded font-semibold border transition-all text-center ${
                    simType === 'multiple_people'
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Simulate 2nd Person
                </button>
                <button
                  onClick={() => setSimType('phone_detected')}
                  className={`px-2 py-1 text-[11px] rounded font-semibold border transition-all text-center ${
                    simType === 'phone_detected'
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Simulate Cell Phone
                </button>
                <button
                  onClick={() => setSimType('looking_away')}
                  className={`px-2 py-1 text-[11px] rounded font-semibold border transition-all text-center ${
                    simType === 'looking_away'
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Simulate Looking Away
                </button>
              </div>
              {simType !== 'none' && (
                <p className="text-[10px] text-amber-600 font-semibold animate-pulse text-center">
                  ⚠️ Active: Simulating {simType.replace('_', ' ')}
                </p>
              )}
            </div>

          </div>

          {/* Exams Catalog List */}
          <div className="lg:col-span-2 space-y-6 font-sans">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-950 font-sans">Available Examinations</h2>
                <p className="text-slate-500 text-xs">Choose an assessment to start your AI-proctored session</p>
              </div>
              <div className="text-xs text-slate-400 bg-slate-50 px-3 py-1 rounded-full border border-slate-100 font-medium font-sans">
                Active Catalogs: {tests.length}
              </div>
            </div>

            <div className="space-y-4">
              {tests.map((test) => {
                const pastAttempts = attempts.filter(a => a.testId === test.id);
                const isCompleted = pastAttempts.some(a => a.status === 'submitted' || a.status === 'flagged');

                return (
                  <div 
                    key={test.id}
                    id={`exam-card-${test.id}`}
                    className={`bg-white border rounded-xl p-5 shadow-sm transition-all relative ${
                      isCompleted 
                        ? 'border-slate-200 bg-slate-50/50 opacity-90' 
                        : 'border-slate-100 hover:border-emerald-200 hover:shadow-md'
                    }`}
                  >
                    {isCompleted && (
                      <div className="absolute top-4 right-4 bg-emerald-50 border border-emerald-200 text-emerald-700 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Exam Completed
                      </div>
                    )}

                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2">
                        <div className="space-y-1">
                          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                            {test.course}
                          </span>
                          <h3 className="text-base font-bold text-slate-900 leading-snug">
                            {test.title}
                          </h3>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed line-clamp-2 max-w-2xl">
                          {test.description}
                        </p>
                        
                        <div className="flex items-center gap-4 pt-1 text-xs text-slate-500 font-medium">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>{test.durationMinutes} Minutes Limit</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <FileText className="w-3.5 h-3.5 text-slate-400" />
                            <span>{test.questionCount} Questions</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="text-emerald-600 font-semibold">AI Secured</span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 self-center">
                        <button
                          onClick={() => {
                            if (studentName.trim() === '') {
                              alert('Please fill in your Legal Name at the top of the page before starting.');
                              return;
                            }
                            if (cameraState !== 'active') {
                              const confirmProceed = window.confirm(
                                'Warning: Your webcam diagnosis is inactive. While testing will load, real-time AI proctoring will not function properly without camera permissions. Proceed anyway?'
                              );
                              if (!confirmProceed) return;
                            }
                            onStartExam(test.id);
                          }}
                          className={`px-4 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2 whitespace-nowrap ${
                            isCompleted
                              ? 'bg-slate-200 hover:bg-slate-300 text-slate-600'
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm hover:shadow'
                          }`}
                        >
                          <Play className="w-4 h-4 fill-current" />
                          {isCompleted ? 'Re-take Assessment' : 'Launch Secured Session'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Past Student Submissions History */}
            <div className="space-y-4 pt-4">
              <h3 className="text-lg font-bold text-slate-900">Your Proctor Audit History</h3>
              
              {attempts.length === 0 ? (
                <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-8 text-center text-slate-400 text-sm space-y-2">
                  <UserCheck className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="font-semibold text-slate-600">No examination attempts found</p>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">Launch and complete a secure proctored session above. Your detailed compliance timelines and performance indices will appear here.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {attempts.map((attempt) => {
                    const isFlagged = attempt.status === 'flagged' || attempt.suspiciousScore >= 50;

                    return (
                      <div 
                        key={attempt.id}
                        className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm hover:border-slate-200 transition-all flex flex-col justify-between"
                      >
                        <div className="space-y-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">
                                Session ID: {attempt.id.substring(8, 14)}
                              </span>
                              <h4 className="text-sm font-bold text-slate-800 leading-tight">
                                {attempt.testTitle}
                              </h4>
                            </div>
                            
                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase ${
                              isFlagged 
                                ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}>
                              {isFlagged ? 'Flagged Audit' : 'Secure Pass'}
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-center">
                            <div>
                              <p className="text-[10px] text-slate-400 font-semibold uppercase">Exam Score</p>
                              <p className="text-sm font-bold text-slate-800">{attempt.score}%</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-400 font-semibold uppercase">AI Suspicion</p>
                              <p className={`text-sm font-bold ${
                                isFlagged ? 'text-rose-600' : 'text-emerald-600'
                              }`}>{attempt.suspiciousScore}%</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-400 font-semibold uppercase">Alert Tally</p>
                              <p className="text-sm font-bold text-slate-800">{attempt.logs.length}</p>
                            </div>
                          </div>
                        </div>

                        <div className="pt-3 border-t border-slate-50 flex items-center justify-between mt-3 text-xs text-slate-500 font-semibold">
                          <span>{new Date(attempt.startTime).toLocaleDateString()}</span>
                          <button
                            onClick={() => onViewAttemptDetails(attempt)}
                            className="text-emerald-600 hover:text-emerald-700 flex items-center gap-1 hover:underline"
                          >
                            <Eye className="w-3.5 h-3.5" /> View Security Transcript
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* 2. Academic Gradebook Tab Panel */}
      {activeTab === 'gradebook' && (
        <div className="space-y-6">
          {/* Aggregates Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            <div className="bg-white border border-slate-100 rounded-xl p-5 shadow-sm space-y-2 relative overflow-hidden">
              <div className="absolute right-3 top-3 p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                <GraduationCap className="w-5 h-5" />
              </div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Cumulative GPA</p>
              <div className="flex items-baseline gap-2 pt-1">
                <p className="text-3xl font-black text-slate-950 font-mono">{gpa}</p>
                <span className="text-xs text-slate-500 font-semibold">on a 4.0 scale</span>
              </div>
            </div>

            <div className="bg-white border border-slate-100 rounded-xl p-5 shadow-sm space-y-2 relative overflow-hidden">
              <div className="absolute right-3 top-3 p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                <BookOpen className="w-5 h-5" />
              </div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Average Score</p>
              <div className="flex items-baseline gap-2 pt-1">
                <p className="text-3xl font-black text-slate-950 font-mono">{averageScore}%</p>
                <span className="text-xs text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-bold">Passing threshold: 70%</span>
              </div>
            </div>

            <div className="bg-white border border-slate-100 rounded-xl p-5 shadow-sm space-y-2 relative overflow-hidden">
              <div className="absolute right-3 top-3 p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Pass Rate</p>
              <div className="flex items-baseline gap-2 pt-1">
                <p className="text-3xl font-black text-slate-950 font-mono">{passRate}%</p>
                <span className="text-xs text-slate-500 font-medium">of {completedAttempts.length} exams</span>
              </div>
            </div>

            <div className="bg-white border border-slate-100 rounded-xl p-5 shadow-sm space-y-2 relative overflow-hidden">
              <div className="absolute right-3 top-3 p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                <Trophy className="w-5 h-5 animate-bounce" />
              </div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Verifiable Credentials</p>
              <div className="flex items-baseline gap-2 pt-1">
                <p className="text-3xl font-black text-emerald-600 font-mono">{totalCertificatesCount}</p>
                <span className="text-xs text-slate-500 font-semibold">secured certificates</span>
              </div>
            </div>

          </div>

          {/* Table list of grades */}
          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Academic Score Sheet & History</h3>
                <p className="text-slate-500 text-xs">Verifiable credentials and individual performance reports</p>
              </div>
              <span className="text-xs text-slate-400 font-semibold bg-slate-50 border border-slate-100 px-3 py-1 rounded-full">
                Total Submissions: {completedAttempts.length}
              </span>
            </div>

            {completedAttempts.length === 0 ? (
              <div className="p-16 text-center text-slate-400 space-y-2">
                <FileSpreadsheet className="w-10 h-10 text-slate-300 mx-auto" />
                <h4 className="font-bold text-slate-700">No grades registered yet</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Take and complete any proctored examination. Your scores, letter grades, and academic credentials will appear here automatically.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-400 text-[10px] font-bold uppercase tracking-wider border-b border-slate-100">
                      <th className="px-6 py-3.5">Course & Examination Title</th>
                      <th className="px-6 py-3.5">Completed Date</th>
                      <th className="px-6 py-3.5 text-center">Score</th>
                      <th className="px-6 py-3.5 text-center">Letter Grade</th>
                      <th className="px-6 py-3.5 text-center">Security Integrity</th>
                      <th className="px-6 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                    {completedAttempts.map((attempt) => {
                      const score = attempt.score || 0;
                      const isPassing = score >= 70;
                      const isHighRisk = attempt.status === 'flagged' || attempt.suspiciousScore >= 50;
                      
                      // Calculate grade letter
                      let letterGrade = 'F';
                      let gradeColor = 'text-rose-600 bg-rose-50 border-rose-100';
                      if (score >= 90) {
                        letterGrade = 'A';
                        gradeColor = 'text-emerald-700 bg-emerald-50 border-emerald-100';
                      } else if (score >= 80) {
                        letterGrade = 'B';
                        gradeColor = 'text-teal-700 bg-teal-50 border-teal-100';
                      } else if (score >= 70) {
                        letterGrade = 'C';
                        gradeColor = 'text-blue-700 bg-blue-50 border-blue-100';
                      }

                      // Is eligible for certificate? (Needs score >= 70 AND compliance is not high risk)
                      const canClaimCertificate = isPassing && !isHighRisk;

                      return (
                        <tr key={attempt.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4.5">
                            <div>
                              <p className="font-bold text-slate-900 leading-tight">{attempt.testTitle}</p>
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Session: {attempt.id.substring(8, 14).toUpperCase()}</p>
                            </div>
                          </td>
                          <td className="px-6 py-4.5 text-xs text-slate-500 font-semibold">
                            {new Date(attempt.startTime).toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </td>
                          <td className="px-6 py-4.5 text-center font-bold font-mono">
                            <span className={isPassing ? 'text-emerald-600' : 'text-rose-600'}>
                              {score}%
                            </span>
                          </td>
                          <td className="px-6 py-4.5 text-center">
                            <span className={`px-2.5 py-0.5 rounded-md font-black text-xs border ${gradeColor}`}>
                              {letterGrade}
                            </span>
                          </td>
                          <td className="px-6 py-4.5 text-center">
                            <span className={`px-2 py-0.5 text-[9px] font-extrabold uppercase rounded-full border ${
                              isHighRisk
                                ? 'bg-rose-50 text-rose-600 border-rose-200'
                                : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                            }`}>
                              {isHighRisk ? 'Flagged / Suspicious' : 'Secure Verified'}
                            </span>
                          </td>
                          <td className="px-6 py-4.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => setSelectedScorecard(attempt)}
                                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition flex items-center gap-1 border border-slate-200 shadow-sm"
                              >
                                <Eye className="w-3.5 h-3.5 text-slate-500" /> Scorecard
                              </button>

                              {canClaimCertificate ? (
                                <button
                                  onClick={() => setSelectedCertificate(attempt)}
                                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black rounded-lg transition flex items-center gap-1 shadow-sm border border-amber-600/20"
                                >
                                  <Trophy className="w-3.5 h-3.5" /> Certificate
                                </button>
                              ) : (
                                <button
                                  disabled
                                  title={isHighRisk ? "Certificate locked: Security compliance flag was registered during this assessment." : "Certificate locked: Passing grade of 70% required."}
                                  className="px-3 py-1.5 bg-slate-50 text-slate-300 text-xs font-bold rounded-lg border border-slate-100 cursor-not-allowed flex items-center gap-1"
                                >
                                  <Trophy className="w-3.5 h-3.5 text-slate-300" /> Locked
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 1. Scorecard Breakdown Modal */}
      <AnimatePresence>
        {selectedScorecard && (() => {
          const testObj = tests.find(t => t.id === selectedScorecard.testId);
          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.95, y: 15 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 15 }}
                className="bg-slate-950 border border-slate-900 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden text-slate-100"
              >
                {/* Modal Header */}
                <div className="px-6 py-4.5 border-b border-slate-900 bg-slate-950 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
                    <div>
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider">Exam Performance Scorecard</h3>
                      <p className="text-[10px] text-slate-400">Verifiable Academic Audit Report</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedScorecard(null)}
                    className="p-1.5 bg-slate-900 hover:bg-slate-800 rounded-full transition text-slate-400 hover:text-white"
                  >
                    <X className="w-4.5 h-4.5" />
                  </button>
                </div>

                {/* Scorecard Summary block */}
                <div className="px-6 py-4 bg-slate-900/40 border-b border-slate-900 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                  <div>
                    <span className="text-[9px] uppercase font-bold text-slate-500">Candidate</span>
                    <p className="text-xs font-bold text-white mt-0.5 truncate">{selectedScorecard.studentName}</p>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-bold text-slate-500">Academic Grade</span>
                    <p className="text-xs font-bold text-emerald-400 mt-0.5">{selectedScorecard.score}% Pass</p>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-bold text-slate-500">Proctor Compliance</span>
                    <p className={`text-xs font-bold mt-0.5 ${
                      selectedScorecard.status === 'flagged' ? 'text-rose-500' : 'text-emerald-500'
                    }`}>
                      {selectedScorecard.status === 'flagged' ? 'Infracted' : 'Verified Secure'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-bold text-slate-500">Attempt ID</span>
                    <p className="text-xs font-mono font-bold text-slate-300 mt-0.5">{selectedScorecard.id.substring(8, 14).toUpperCase()}</p>
                  </div>
                </div>

                {/* Question items */}
                <div className="p-6 overflow-y-auto space-y-6 flex-1">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Response Verification Sheet</h4>
                  {testObj ? (
                    testObj.questions.map((q, qIdx) => {
                      const selectedIdx = selectedScorecard.answers[q.id];
                      const isCorrect = selectedIdx !== undefined && selectedIdx === q.correctOptionIndex;

                      return (
                        <div key={q.id} className="p-4 rounded-xl border bg-slate-900/10 border-slate-900 space-y-3.5">
                          <div className="flex items-start justify-between gap-4">
                            <span className="text-xs uppercase font-extrabold text-slate-500 shrink-0">
                              Q{qIdx + 1}
                            </span>
                            <p className="text-sm font-bold text-white leading-relaxed flex-1">
                              {q.text}
                            </p>
                            <span className={`px-2 py-0.5 text-[9px] font-black rounded uppercase shrink-0 ${
                              isCorrect 
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' 
                                : 'bg-rose-500/15 text-rose-400 border border-rose-500/20'
                            }`}>
                              {isCorrect ? 'Correct' : 'Incorrect'}
                            </span>
                          </div>

                          {/* Options */}
                          <div className="grid grid-cols-1 gap-2 pt-1 pl-6">
                            {q.options.map((option, oIdx) => {
                              const wasSelected = selectedIdx === oIdx;
                              const isCorrectOption = q.correctOptionIndex === oIdx;

                              return (
                                <div
                                  key={oIdx}
                                  className={`p-2.5 rounded-lg text-xs font-medium border flex items-start gap-2.5 ${
                                    isCorrectOption
                                      ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                                      : wasSelected
                                      ? 'bg-rose-950/20 border-rose-500/30 text-rose-200'
                                      : 'bg-slate-950/40 border-slate-900/60 text-slate-400'
                                  }`}
                                >
                                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 font-mono text-[9px] font-bold ${
                                    isCorrectOption
                                      ? 'border-emerald-500 bg-emerald-500 text-slate-950'
                                      : wasSelected
                                      ? 'border-rose-500 bg-rose-500 text-white'
                                      : 'border-slate-800 text-slate-500'
                                  }`}>
                                    {String.fromCharCode(65 + oIdx)}
                                  </div>
                                  <span className="leading-normal flex-1">{option}</span>
                                  {isCorrectOption && (
                                    <span className="text-[9px] uppercase font-black text-emerald-400 bg-emerald-500/10 px-1 rounded border border-emerald-500/15 ml-auto">Correct Answer</span>
                                  )}
                                  {wasSelected && !isCorrectOption && (
                                    <span className="text-[9px] uppercase font-black text-rose-400 bg-rose-500/10 px-1 rounded border border-rose-500/15 ml-auto">Your Choice</span>
                                  )}
                                  {wasSelected && isCorrectOption && (
                                    <span className="text-[9px] uppercase font-black text-emerald-400 bg-emerald-500/10 px-1 rounded border border-emerald-500/15 ml-auto">Your Correct Choice</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-xs text-slate-500 italic text-slate-400">Original questionnaire assets could not be retrieved from the console catalog.</p>
                  )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-900 bg-slate-950/40 text-center">
                  <button
                    onClick={() => setSelectedScorecard(null)}
                    className="px-5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-white text-xs font-bold rounded-lg transition"
                  >
                    Close Scorecard
                  </button>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* 2. Verifiable Digital Certificate Modal */}
      <AnimatePresence>
        {selectedCertificate && (() => {
          const testObj = tests.find(t => t.id === selectedCertificate.testId);
          const courseCode = testObj ? (
            ['HRMFC', 'CHRMG', 'CHRMP'].includes(testObj.course)
              ? testObj.course
              : testObj.course.split(' ').map((w: string) => w[0] || '').join('').toUpperCase()
          ) : 'MGMT';
          const dateObj = new Date(selectedCertificate.endTime || selectedCertificate.startTime);
          const year = dateObj.getFullYear();
          const serial = selectedCertificate.id.substring(18).toUpperCase() || '73A2B';
          const certId = `IIPM/${courseCode}/${year}/${serial}`;

          const day = dateObj.getDate();
          const getOrdinal = (n: number) => {
            const s = ["th", "st", "nd", "rd"];
            const v = n % 100;
            return s[(v - 20) % 10] || s[v] || s[0];
          };
          const dayStr = day + getOrdinal(day);
          const monthStr = dateObj.toLocaleString('en-US', { month: 'long' });
          const yearStr = dateObj.getFullYear();

          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto animate-fadeIn"
            >
              {/* Inject self-contained print stylesheet dynamically for print layout control */}
              <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                  body * {
                    visibility: hidden !important;
                  }
                  #printable-certificate-container, #printable-certificate-container * {
                    visibility: visible !important;
                  }
                  #printable-certificate-container {
                    position: fixed !important;
                    left: 0 !important;
                    top: 0 !important;
                    width: 297mm !important;
                    height: 210mm !important;
                    margin: 0 !important;
                    padding: 1.5rem !important;
                    background: white !important;
                    color: black !important;
                    box-sizing: border-box !important;
                    display: flex !important;
                    flex-direction: column !important;
                    justify-content: space-between !important;
                    border: none !important;
                    box-shadow: none !important;
                    transform: none !important;
                    page-break-inside: avoid !important;
                  }
                  .no-print {
                    display: none !important;
                  }
                }
              `}} />

              <div className="relative max-w-4xl w-full my-8">
                
                {/* Modal top action bar */}
                <div className="no-print flex items-center justify-between mb-4 text-white px-4">
                  <div className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-amber-400" />
                    <span className="text-xs font-bold tracking-widest uppercase text-slate-300 font-mono">IIPM Verified Academic Credential</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => window.print()}
                      className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl border border-slate-800 transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" /> Print / Save PDF
                    </button>
                    <button
                      onClick={() => setSelectedCertificate(null)}
                      className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-full transition cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Printable Certificate Layout Document */}
                <div 
                  id="printable-certificate-container" 
                  className="bg-white text-slate-900 rounded-2xl p-6 md:p-10 shadow-2xl relative border-2 border-[#0c2340] overflow-hidden flex flex-col justify-between aspect-[1.414/1] max-w-full font-serif"
                >
                  {/* Outer solid border margin line and inner double border lines */}
                  <div className="absolute inset-4 border-[3px] border-double border-[#0c2340] rounded-lg pointer-events-none"></div>

                  {/* Top Right Dot Grid Decoration */}
                  <div className="absolute right-6 top-6 opacity-80 text-[#0c2340] fill-current pointer-events-none">
                    <svg width="48" height="24" viewBox="0 0 48 24">
                      {Array.from({ length: 4 }).map((_, r) => 
                        Array.from({ length: 8 }).map((_, c) => (
                          <circle key={`tr-${r}-${c}`} cx={4 + c * 6} cy={3 + r * 6} r="1.3" />
                        ))
                      )}
                    </svg>
                  </div>

                  {/* Bottom Left Dot Grid Decoration */}
                  <div className="absolute left-6 bottom-6 opacity-80 text-[#0c2340] fill-current pointer-events-none">
                    <svg width="48" height="24" viewBox="0 0 48 24">
                      {Array.from({ length: 4 }).map((_, r) => 
                        Array.from({ length: 8 }).map((_, c) => (
                          <circle key={`bl-${r}-${c}`} cx={4 + c * 6} cy={3 + r * 6} r="1.3" />
                        ))
                      )}
                    </svg>
                  </div>

                  {/* Large Globe Watermark Background */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.03] text-blue-900 pointer-events-none">
                    <svg width="420" height="420" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="0.5" />
                      <ellipse cx="50" cy="50" rx="45" ry="15" fill="none" stroke="currentColor" strokeWidth="0.5" />
                      <ellipse cx="50" cy="50" rx="15" ry="45" fill="none" stroke="currentColor" strokeWidth="0.5" />
                      <line x1="5" y1="50" x2="95" y2="50" stroke="currentColor" strokeWidth="0.5" />
                      <line x1="50" y1="5" x2="50" y2="95" stroke="currentColor" strokeWidth="0.5" />
                    </svg>
                  </div>

                  {/* Certificate Top Brand Info & Logo Header */}
                  <div className="flex items-center gap-4 relative z-10 w-full px-6 pt-4">
                    <div className="flex items-center gap-3.5">
                      {/* Dynamic Logo Loader with High-Fidelity SVG Fallback */}
                      {!logoError ? (
                        <img 
                          src={logoSrc} 
                          alt="IIPM Logo" 
                          className="w-[80px] h-[80px] shrink-0 object-contain drop-shadow-md relative z-10"
                          referrerPolicy="no-referrer"
                          onError={() => {
                            if (logoSrc.includes('IIPM-Logo-PNG-1024x1021.png')) {
                              setLogoSrc('https://iipmi.org/wp-content/uploads/2022/08/IIPM-Logo-PNG-768x766.png');
                            } else if (logoSrc.includes('IIPM-Logo-PNG-768x766.png')) {
                              setLogoSrc('https://iipmi.org/wp-content/uploads/2022/08/IIPM-Logo-PNG-600x598.png');
                            } else if (logoSrc.includes('IIPM-Logo-PNG-600x598.png')) {
                              setLogoSrc('https://iipmi.org/wp-content/uploads/2022/08/IIPM-Logo-PNG-100x100.png');
                            } else if (logoSrc.includes('IIPM-Logo-PNG-100x100.png')) {
                              setLogoSrc('/logo.png');
                            } else if (logoSrc === '/logo.png') {
                              setLogoSrc('/assets/logo.png');
                            } else if (logoSrc === '/assets/logo.png') {
                              setLogoSrc('/iipm-logo.png');
                            } else {
                              setLogoError(true);
                            }
                          }}
                        />
                      ) : (
                        <svg width="80" height="80" viewBox="0 0 100 100" className="shrink-0 drop-shadow-md">
                          <defs>
                            <radialGradient id="globeGrad" cx="50%" cy="50%" r="50%" fx="35%" fy="35%">
                              <stop offset="0%" stopColor="#48c3f9" />
                              <stop offset="70%" stopColor="#0071bc" />
                              <stop offset="100%" stopColor="#0a2a5c" />
                            </radialGradient>
                            <filter id="logoShadow" x="-20%" y="-20%" width="140%" height="140%">
                              <feDropShadow dx="0.8" dy="1.2" stdDeviation="0.6" floodColor="#000000" floodOpacity="0.5" />
                            </filter>
                            <path id="topTextArc" d="M 12,50 A 38,38 0 0,1 88,50" fill="none" />
                            <path id="bottomTextArc" d="M 88,50 A 38,38 0 0,1 12,50" fill="none" />
                          </defs>

                          {/* Outer thick royal indigo-blue ring */}
                          <circle cx="50" cy="50" r="48" fill="#303385" stroke="#ffffff" strokeWidth="0.5" />
                          
                          {/* Inner orange thin divider circle */}
                          <circle cx="50" cy="50" r="39.5" fill="none" stroke="#e07a1b" strokeWidth="1.2" />

                          {/* Curved Top Text */}
                          <text fill="#ffffff" fontSize="4.1" fontWeight="900" fontFamily="'Arial Black', Impact, 'Inter', system-ui, sans-serif" textAnchor="middle" letterSpacing="0.04">
                            <textPath href="#topTextArc" startOffset="50%">
                              INTEGRATED INSTITUTE OF PROFESSIONAL
                            </textPath>
                          </text>

                          {/* Curved Bottom Text */}
                          <text fill="#ffffff" fontSize="6.2" fontWeight="900" fontFamily="'Arial Black', Impact, 'Inter', system-ui, sans-serif" textAnchor="middle" letterSpacing="0.08">
                            <textPath href="#bottomTextArc" startOffset="50%">
                              MANAGEMENT
                            </textPath>
                          </text>

                          {/* White separating dots */}
                          <circle cx="11.5" cy="50" r="2.2" fill="#ffffff" />
                          <circle cx="88.5" cy="50" r="2.2" fill="#ffffff" />

                          {/* Globe background sphere with beautiful gradient */}
                          <circle cx="50" cy="50" r="36" fill="url(#globeGrad)" stroke="#e07a1b" strokeWidth="1.5" />

                          {/* Globe parallels and meridians (grid lines) */}
                          <ellipse cx="50" cy="50" rx="36" ry="12" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.5" />
                          <ellipse cx="50" cy="50" rx="36" ry="24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.5" />
                          <ellipse cx="50" cy="50" rx="12" ry="36" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.5" />
                          <ellipse cx="50" cy="50" rx="24" ry="36" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.5" />
                          <line x1="14" y1="50" x2="86" y2="50" stroke="rgba(255,255,255,0.25)" strokeWidth="0.5" />
                          <line x1="50" y1="14" x2="50" y2="86" stroke="rgba(255,255,255,0.25)" strokeWidth="0.5" />

                          {/* Continents (High Fidelity Vector silhouettes) */}
                          <path d="M 18,34 Q 22,26 28,24 T 34,26 T 38,32 T 42,40 T 36,44 T 40,48 T 43,56 T 38,62 T 43,70 T 41,78 T 37,76 T 36,68 T 34,60 T 30,54 T 26,48 Z" fill="rgba(255,255,255,0.4)" />
                          <path d="M 58,24 Q 64,20 70,22 T 74,28 T 72,38 T 62,44 T 64,54 T 70,62 T 66,72 T 58,74 T 54,66 T 56,56 T 52,44 T 52,32 Z" fill="rgba(255,255,255,0.4)" />

                          {/* Central "IIPM" Text - Orange with bold white outline and subtle drop shadow */}
                          <text 
                            x="50" 
                            y="52" 
                            fill="#e07a1b" 
                            stroke="#ffffff" 
                            strokeWidth="2" 
                            strokeLinejoin="round" 
                            paintOrder="stroke"
                            filter="url(#logoShadow)"
                            fontSize="17.5" 
                            fontWeight="900" 
                            textAnchor="middle" 
                            fontFamily="'Arial Black', Impact, 'Inter', system-ui, sans-serif"
                          >
                            IIPM
                          </text>

                          {/* Banner "HOME OF MANAGEMENT PROFESSIONALS" */}
                          <g filter="url(#logoShadow)">
                            <rect x="18" y="55.5" width="64" height="6.5" rx="1.5" fill="#e07a1b" stroke="#ffffff" strokeWidth="0.7" />
                            <text 
                              x="50" 
                              y="60.2" 
                              fill="#ffffff" 
                              fontSize="3.1" 
                              fontWeight="900" 
                              textAnchor="middle" 
                              letterSpacing="0.01" 
                              fontFamily="'Arial Black', Impact, 'Inter', system-ui, sans-serif"
                            >
                              HOME OF MANAGEMENT PROFESSIONALS
                            </text>
                          </g>
                        </svg>
                      )}
                    </div>
                      
                      {/* Orange Vertical Divider */}
                      <div className="w-[3px] h-14 bg-[#ea580c] self-center"></div>
                      
                      {/* College Name text */}
                      <div className="text-left font-serif self-center">
                        <h1 className="text-lg md:text-xl font-black tracking-wider text-[#0c2340] leading-tight">
                          INTEGRATED INSTITUTE OF
                        </h1>
                        <h1 className="text-lg md:text-xl font-black tracking-wider text-[#0c2340] leading-tight">
                          PROFESSIONAL MANAGEMENT
                        </h1>
                      </div>
                    </div>

                  {/* Certificate Statement Content */}
                  <div className="text-center my-2 space-y-3 relative z-10 px-8">
                    <h2 className="text-2xl md:text-3.5xl font-black text-[#0c2340] tracking-widest leading-none uppercase font-serif">
                      CERTIFICATE OF COMPLETION
                    </h2>
                    
                    <p className="text-sm text-slate-600 italic font-serif mt-1">
                      This certifies that
                    </p>
                    
                    {/* Student Name with Underline Accent */}
                    <div className="py-1">
                      <h3 className="text-2.5xl md:text-3.5xl font-extrabold text-[#0c2340] tracking-wide uppercase font-serif text-center">
                        {studentName || "CANDIDATE SCHOLAR"}
                      </h3>
                      <div className="w-80 h-[2px] bg-gradient-to-r from-transparent via-[#0c2340] to-transparent mx-auto mt-1"></div>
                    </div>

                    <p className="text-xs text-slate-600 max-w-2xl mx-auto leading-relaxed">
                      has successfully completed the Professional Modular Certificate Programme in
                    </p>
                    
                    <h4 className="text-xl md:text-2xl font-extrabold text-[#0c2340] uppercase tracking-wide font-serif py-1">
                      {selectedCertificate.testTitle}
                    </h4>

                    <p className="text-xs text-slate-600 max-w-xl mx-auto leading-relaxed">
                      having fulfilled the required learning activities, assessments, and completion requirements with a passing assessment score of <strong className="text-emerald-700 font-bold">{selectedCertificate.score}%</strong>.
                    </p>
                    
                    <p className="text-xs text-slate-500 font-serif pt-1">
                      Issued on this {dayStr} Day of {monthStr}, {yearStr}.
                    </p>
                  </div>

                  {/* Bottom Row - Signatures and red wax seal */}
                  <div className="flex items-end justify-between px-10 pb-4 relative z-10 mt-2">
                    
                    {/* Left Signee: Council Chairman */}
                    <div className="text-center w-48 text-slate-500 space-y-1">
                      {/* Original Hand-drawn Signature Vector for Dr. Kashim Akor */}
                      <svg width="120" height="42" viewBox="0 0 120 42" className="mx-auto select-none opacity-95">
                        <path 
                          d="M38,36 C36,20 35,8 38,5 C40,3 42,12 41,28 C40,33 39,38 42,39 C44,40 46,28 46,18 C46,12 49,10 50,14 C51,17 49,24 48,30 C47,34 48,36 50,36 C53,36 56,28 58,22 C59,18 61,20 60,25 C59,28 62,30 64,27 C66,24 68,22 70,24 C72,25 76,23 82,23 C88,23 92,24 96,23" 
                          fill="none" 
                          stroke="#1e293b" 
                          strokeWidth="1.8" 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                        />
                      </svg>
                      <div className="w-full h-px bg-slate-300"></div>
                      <p className="text-xs font-bold text-[#0c2340]">Dr. Kashim Akor</p>
                      <p className="text-[8px] font-bold uppercase tracking-wider text-slate-400 font-mono">Council Chairman</p>
                    </div>

                    {/* Red Wax Seal */}
                    <div className="flex flex-col items-center justify-center select-none">
                      <img 
                        src={iipmSeal} 
                        alt="IIPM Academic Seal" 
                        className="w-[72px] h-[72px] object-contain filter drop-shadow-md select-none transform hover:scale-105 transition-all duration-300 mix-blend-multiply"
                        referrerPolicy="no-referrer"
                      />
                    </div>

                    {/* Right Signee: Registrar */}
                    <div className="text-center w-48 text-slate-500 space-y-1">
                      {/* Original Hand-drawn Signature Vector for Barr. Peter N. Nwachukwu */}
                      <svg width="120" height="50" viewBox="0 0 120 50" className="mx-auto select-none opacity-95">
                        {/* Outer horizontal bowl/oval with inner scribbles */}
                        <path 
                          d="M20,24 C18,17 38,15 54,16 C60,17 61,25 46,28 C30,30 18,28 17,23 C16,18 24,19 32,21 M22,23 C25,21 28,21 32,23 C35,25 38,23 41,21 C44,20 48,22 51,24 C54,26 56,22 58,21 C59,20 54,23 48,24 C42,25 35,25 28,24" 
                          fill="none" 
                          stroke="#1e293b" 
                          strokeWidth="1.8" 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                        />
                        {/* Central vertical crossing loop with high top and long bottom */}
                        <path 
                          d="M38,36 C38,20 37,8 41,5 C43,3 44,12 43,28 C42,33 41,38 41,38" 
                          fill="none" 
                          stroke="#1e293b" 
                          strokeWidth="1.8" 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                        />
                        {/* Right-hand side letters and the signature long trailing line */}
                        <path 
                          d="M46,18 C46,12 49,10 50,14 C51,17 49,24 48,30 C47,34 48,36 50,36 C53,36 56,28 58,22 C59,18 61,20 60,25 C62,21 65,16 67,23 C68,26 64,29 64,32 C64,35 68,30 71,28 C73,26 77,22 81,26 C85,30 84,33 82,35 C80,37 77,34 76,32 C75,29 76,24 78,24 C81,24 82,28 80,32 C78,35 73,34 73,37 C73,42 75,47 77,52" 
                          fill="none" 
                          stroke="#1e293b" 
                          strokeWidth="1.8" 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                        />
                      </svg>
                      <div className="w-full h-px bg-slate-300"></div>
                      <p className="text-xs font-bold text-[#0c2340]">Barr. Peter N. Nwachukwu</p>
                      <p className="text-[8px] font-bold uppercase tracking-wider text-slate-400 font-mono">Registrar</p>
                    </div>

                  </div>

                  {/* Tiny Footer info with ID and Barcode */}
                  <div className="flex items-center justify-between px-6 pb-2 pt-2 relative z-10 border-t border-slate-100/60 mt-1">
                    <p className="text-[9px] text-slate-400 font-mono tracking-wider">
                      Certificate ID: <span className="text-slate-600 font-bold">{certId}</span>
                    </p>
                    
                    {/* Authentic Barcode Style Group */}
                    <div className="flex flex-col items-end scale-95 origin-bottom-right">
                      <svg width="100" height="15" className="opacity-80">
                        <rect x="0" width="3" height="15" fill="black" />
                        <rect x="5" width="1" height="15" fill="black" />
                        <rect x="8" width="2" height="15" fill="black" />
                        <rect x="12" width="4" height="15" fill="black" />
                        <rect x="18" width="1" height="15" fill="black" />
                        <rect x="21" width="3" height="15" fill="black" />
                        <rect x="26" width="2" height="15" fill="black" />
                        <rect x="30" width="1" height="15" fill="black" />
                        <rect x="33" width="4" height="15" fill="black" />
                        <rect x="39" width="2" height="15" fill="black" />
                        <rect x="43" width="1" height="15" fill="black" />
                        <rect x="46" width="3" height="15" fill="black" />
                        <rect x="51" width="2" height="15" fill="black" />
                        <rect x="55" width="4" height="15" fill="black" />
                        <rect x="61" width="1" height="15" fill="black" />
                        <rect x="64" width="3" height="15" fill="black" />
                        <rect x="69" width="2" height="15" fill="black" />
                        <rect x="73" width="1" height="15" fill="black" />
                        <rect x="76" width="4" height="15" fill="black" />
                        <rect x="82" width="2" height="15" fill="black" />
                        <rect x="86" width="1" height="15" fill="black" />
                        <rect x="89" width="3" height="15" fill="black" />
                        <rect x="94" width="2" height="15" fill="black" />
                      </svg>
                      <span className="text-[6px] font-mono tracking-widest text-slate-400 mt-0.5">*{certId}*</span>
                    </div>
                  </div>

                </div>
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* 3. Automatic Congratulations and Certificate Option Modal */}
      <AnimatePresence>
        {justCompletedAttempt && (() => {
          const score = justCompletedAttempt.score || 0;
          const isPassing = score >= 70;
          const isHighRisk = justCompletedAttempt.status === 'flagged' || justCompletedAttempt.suspiciousScore >= 50;
          
          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto animate-fadeIn"
            >
              <motion.div
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                className="relative max-w-lg w-full bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 md:p-8 text-center text-slate-100 overflow-hidden"
              >
                {/* Decorative glowing gradient behind */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
                {isPassing && !isHighRisk && (
                  <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none animate-pulse"></div>
                )}

                {/* Main Visual Header Icon */}
                <div className="relative flex justify-center mb-6">
                  {isPassing && !isHighRisk ? (
                    <div className="relative">
                      <div className="w-20 h-20 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-400 border border-amber-500/20 shadow-lg">
                        <Trophy className="w-10 h-10 stroke-[1.5]" />
                      </div>
                      <div className="absolute -top-1.5 -right-1.5 bg-emerald-500 text-slate-950 p-1.5 rounded-full shadow border border-slate-900">
                        <CheckCircle2 className="w-4 h-4 text-white" />
                      </div>
                      {/* Floating Sparkles */}
                      <Sparkles className="absolute -top-3 left-4 w-5 h-5 text-amber-300 animate-pulse" />
                      <Sparkles className="absolute bottom-1 -left-4 w-4 h-4 text-amber-400 opacity-70" />
                    </div>
                  ) : isPassing && isHighRisk ? (
                    <div className="relative">
                      <div className="w-20 h-20 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-400 border border-amber-500/20 shadow-lg">
                        <Trophy className="w-10 h-10 stroke-[1.5] opacity-60" />
                      </div>
                      <div className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white p-1.5 rounded-full shadow border border-slate-900">
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                    </div>
                  ) : (
                    <div className="w-20 h-20 bg-slate-800 rounded-2xl flex items-center justify-center text-slate-400 border border-slate-700 shadow-lg">
                      <FileText className="w-10 h-10 stroke-[1.5]" />
                    </div>
                  )}
                </div>

                {/* Statement & Titles */}
                {isPassing && !isHighRisk ? (
                  <div className="space-y-2">
                    <span className="text-xs font-mono font-bold uppercase tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/15 px-3 py-1 rounded-full inline-block">
                      Professional Certificate Issued
                    </span>
                    <h2 className="text-2xl font-black tracking-tight text-white pt-2">
                      Congratulations, {studentName || 'Candidate Scholar'}!
                    </h2>
                    <p className="text-slate-300 text-xs max-w-sm mx-auto leading-relaxed">
                      You completed the assessment with honors, scoring a passing mark of <span className="font-extrabold text-emerald-400">{score}%</span> under strict AURA high-compliance proctored monitoring.
                    </p>
                  </div>
                ) : isPassing && isHighRisk ? (
                  <div className="space-y-2">
                    <span className="text-xs font-mono font-bold uppercase tracking-widest text-rose-400 bg-rose-500/10 border border-rose-500/15 px-3 py-1 rounded-full inline-block">
                      Compliance Audit Status Pending
                    </span>
                    <h2 className="text-xl font-bold tracking-tight text-white pt-2">
                      Assessment Submitted Successfully
                    </h2>
                    <p className="text-slate-300 text-xs max-w-sm mx-auto leading-relaxed">
                      You finished with a passing score of <span className="font-extrabold text-amber-400">{score}%</span>, but security compliance audits registered integrity flags. Your certification credential is currently pending proctor review.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <span className="text-xs font-mono font-bold uppercase tracking-widest text-rose-400 bg-rose-500/10 border border-rose-500/15 px-3 py-1 rounded-full inline-block">
                      Submission Received
                    </span>
                    <h2 className="text-xl font-bold tracking-tight text-white pt-2">
                      Assessment Completed
                    </h2>
                    <p className="text-slate-300 text-xs max-w-sm mx-auto leading-relaxed">
                      You completed the exam with an academic score of <span className="font-extrabold text-rose-400">{score}%</span>. Note that a passing score of <span className="font-bold text-slate-100">70%</span> is required to qualify for professional modular certification.
                    </p>
                  </div>
                )}

                {/* Dynamic Stats Grid */}
                <div className="grid grid-cols-2 gap-3 my-6 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                  <div className="text-left space-y-1">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Academic Score</span>
                    <div className="flex items-baseline gap-1">
                      <span className={`text-xl font-black font-mono ${isPassing ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {score}%
                      </span>
                      <span className="text-[10px] text-slate-400 font-semibold">{isPassing ? '(Passed)' : '(Under 70%)'}</span>
                    </div>
                  </div>
                  <div className="text-left space-y-1 border-l border-slate-800 pl-4">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Security Audit</span>
                    <div className="flex items-baseline gap-1">
                      <span className={`text-xs font-bold uppercase ${isHighRisk ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {isHighRisk ? 'High Risk' : 'Secure'}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">({justCompletedAttempt.suspiciousScore}% flags)</span>
                    </div>
                  </div>
                </div>

                {/* Options/Action Buttons */}
                <div className="space-y-2.5">
                  {isPassing && !isHighRisk && (
                    <button
                      onClick={() => {
                        setSelectedCertificate(justCompletedAttempt);
                        if (onClearJustCompleted) onClearJustCompleted();
                      }}
                      className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10 cursor-pointer"
                    >
                      <Trophy className="w-4 h-4 text-slate-950" />
                      View & Download Certificate
                    </button>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        setSelectedScorecard(justCompletedAttempt);
                        if (onClearJustCompleted) onClearJustCompleted();
                      }}
                      className="py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View Scorecard
                    </button>
                    <button
                      onClick={() => {
                        if (onClearJustCompleted) onClearJustCompleted();
                      }}
                      className="py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-bold rounded-xl border border-slate-800 transition cursor-pointer"
                    >
                      Return to Workspace
                    </button>
                  </div>
                </div>

              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

    </div>
  );
}

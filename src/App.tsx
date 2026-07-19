import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  GraduationCap, 
  ShieldCheck, 
  ShieldAlert, 
  LayoutDashboard, 
  FileCheck, 
  Info,
  ChevronRight,
  ClipboardList
} from 'lucide-react';
import StudentDashboard from './components/StudentDashboard';
import ExamScreen from './components/ExamScreen';
import AdminPortal from './components/AdminPortal';
import { Test, Attempt, ProctorLogEvent } from './types';

export default function App() {
  // Navigation & Workspace view
  const [view, setView] = useState<'dashboard' | 'exam' | 'admin'>('dashboard');
  
  // App Core Data states
  const [studentName, setStudentName] = useState(() => {
    return localStorage.getItem('aura_student_name') || '';
  });
  const [tests, setTests] = useState<Test[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [selectedTest, setSelectedTest] = useState<Test | null>(null);
  const [simType, setSimType] = useState('none');
  const [isLoading, setIsLoading] = useState(true);
  const [justCompletedAttempt, setJustCompletedAttempt] = useState<Attempt | null>(null);

  // Persistence of legal name
  useEffect(() => {
    localStorage.setItem('aura_student_name', studentName);
  }, [studentName]);

  // Load available exams catalog & past attempts from Express API on startup
  const fetchPortalData = async () => {
    try {
      setIsLoading(true);
      const [testsRes, attemptsRes] = await Promise.all([
        fetch('/api/tests'),
        fetch('/api/attempts')
      ]);

      if (testsRes.ok && attemptsRes.ok) {
        const testsData = await testsRes.json();
        const attemptsData = await attemptsRes.json();
        setTests(testsData);
        setAttempts(attemptsData);
      }
    } catch (error) {
      console.error('Error synchronizing portal catalogs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPortalData();
  }, []);

  // Launch the exam screen
  const handleStartExam = (testId: string) => {
    const test = tests.find(t => t.id === testId);
    if (test) {
      setSelectedTest(test);
      setView('exam');
    }
  };

  // Submit test answers to server-side secure grading
  const handleSubmitExam = async (
    answers: Record<string, number>, 
    logs: ProctorLogEvent[], 
    tabAwayCount: number
  ) => {
    if (!selectedTest) return;

    try {
      const response = await fetch('/api/tests/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName,
          testId: selectedTest.id,
          answers,
          logs,
          tabAwayCount,
          startTime: new Date(Date.now() - selectedTest.durationMinutes * 60 * 1000).toISOString()
        })
      });

      if (response.ok) {
        const newAttempt = await response.json();
        // Update state and attempts
        setAttempts((prev) => [newAttempt, ...prev]);
        setView('dashboard');
        setSelectedTest(null);
        setJustCompletedAttempt(newAttempt);
      }
    } catch (err) {
      console.error('Error submitting exam answers:', err);
      alert('Network failure submitting assessment. Local progress has been cached.');
    }
  };

  // Admin Override Control
  const handleOverrideStatus = async (attemptId: string, newStatus: 'submitted' | 'flagged' | 'terminated') => {
    // Modify in-memory state for local audit preview
    setAttempts((prev) => 
      prev.map(attempt => {
        if (attempt.id === attemptId) {
          // Adjust suspicion scores to match override for visual consistency
          const newSuspicion = newStatus === 'submitted' ? 15 : 75;
          return {
            ...attempt,
            status: newStatus,
            suspiciousScore: newSuspicion
          };
        }
        return attempt;
      })
    );
  };

  // View specific past security transcript directly
  const handleViewAttemptDetails = (attempt: Attempt) => {
    setView('admin');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4 text-slate-100">
        <div className="w-12 h-12 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-bold uppercase tracking-widest text-slate-400">Loading AI Proctor Portals...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased flex flex-col">
      
      {/* Dynamic Header Navbar (Hidden when inside active exam screen to maximize screen lock layout) */}
      {view !== 'exam' && (
        <header className="bg-slate-950 text-white border-b border-slate-900 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 py-3 md:py-4 flex items-center justify-between">
            {/* Logo and name */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center text-slate-950 font-black shadow-inner">
                <GraduationCap className="w-5.5 h-5.5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-sm tracking-tight text-white uppercase">AURA Portal</span>
                  <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[8px] font-bold uppercase tracking-wide rounded">
                    PROCTOR V2
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">Institutional Examination Console</p>
              </div>
            </div>

            {/* Navigation Tabs between Student Portal & Administrator Dashboard */}
            <nav className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-xl">
              <button
                onClick={() => setView('dashboard')}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                  view === 'dashboard'
                    ? 'bg-slate-800 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" /> Candidate Workspace
              </button>
              
              <button
                onClick={() => setView('admin')}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                  view === 'admin'
                    ? 'bg-slate-800 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Proctor Control Hub
              </button>
            </nav>
          </div>
        </header>
      )}

      {/* Primary Workspace View Area */}
      <div className="flex-1">
        <AnimatePresence mode="wait">
          {view === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.18 }}
            >
              <StudentDashboard
                studentName={studentName}
                setStudentName={setStudentName}
                tests={tests}
                attempts={attempts}
                onStartExam={handleStartExam}
                onViewAttemptDetails={handleViewAttemptDetails}
                simType={simType}
                setSimType={setSimType}
                justCompletedAttempt={justCompletedAttempt}
                onClearJustCompleted={() => setJustCompletedAttempt(null)}
              />
            </motion.div>
          )}

          {view === 'exam' && selectedTest && (
            <motion.div
              key="exam"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col h-screen"
            >
              <ExamScreen
                test={selectedTest}
                studentName={studentName}
                simType={simType}
                onSubmitExam={handleSubmitExam}
                onExitExam={() => {
                  setView('dashboard');
                  setSelectedTest(null);
                }}
              />
            </motion.div>
          )}

          {view === 'admin' && (
            <motion.div
              key="admin"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.18 }}
            >
              <AdminPortal
                attempts={attempts}
                onBackToDashboard={() => setView('dashboard')}
                onOverrideStatus={handleOverrideStatus}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer credits */}
      {view !== 'exam' && (
        <footer className="bg-slate-100 border-t border-slate-200 py-6 text-center text-xs text-slate-500 font-medium">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p>© 2026 AURA Security Systems. All rights reserved.</p>
            <div className="flex items-center gap-4 text-slate-400">
              <span className="hover:text-slate-600 transition cursor-pointer">Security Standards</span>
              <span>•</span>
              <span className="hover:text-slate-600 transition cursor-pointer">GDPR Compliance</span>
              <span>•</span>
              <span className="hover:text-slate-600 transition cursor-pointer">API Integration</span>
            </div>
          </div>
        </footer>
      )}

    </div>
  );
}

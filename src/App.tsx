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
import LoginPortal from './components/LoginPortal';
import { Test, Attempt, ProctorLogEvent } from './types';
import { fallbackExams } from './fallbackData';

// Dynamically determine API Base URL.
// When running in a custom deployed frontend (such as GitHub Pages or local preview targeting remote server),
// we route requests to the deployed live container backend endpoint.
const API_BASE = (() => {
  if (typeof window === 'undefined') return '';
  const hostname = window.location.hostname;
  if (
    hostname.includes('localhost') ||
    hostname.includes('run.app') ||
    hostname.includes('0.0.0.0') ||
    hostname.includes('127.0.0.1')
  ) {
    return '';
  }
  // If we are hosted on GitHub Pages, we direct to the production/preview container backend.
  if (hostname.includes('github.io')) {
    return 'https://ais-pre-y7jivk2vjghx37l36lh74p-385275779151.europe-west2.run.app';
  }
  // Otherwise, if we are in an iframe in AI Studio, we direct to the development server container.
  return 'https://ais-dev-y7jivk2vjghx37l36lh74p-385275779151.europe-west2.run.app';
})();

export default function App() {
  // User Authentication & Session States
  const [userRole, setUserRole] = useState<'student' | 'admin' | null>(() => {
    return (localStorage.getItem('aura_logged_role') as 'student' | 'admin') || null;
  });

  const [studentName, setStudentName] = useState(() => {
    return localStorage.getItem('aura_student_name') || '';
  });

  // Navigation & Workspace view
  const [view, setView] = useState<'dashboard' | 'exam' | 'admin'>(() => {
    const savedRole = localStorage.getItem('aura_logged_role');
    return savedRole === 'admin' ? 'admin' : 'dashboard';
  });
  
  // App Core Data states
  const [tests, setTests] = useState<Test[]>(fallbackExams);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [selectedTest, setSelectedTest] = useState<Test | null>(null);
  const [simType, setSimType] = useState('none');
  const [isLoading, setIsLoading] = useState(true);
  const [justCompletedAttempt, setJustCompletedAttempt] = useState<Attempt | null>(null);

  // Persistence of legal name
  useEffect(() => {
    if (studentName) {
      localStorage.setItem('aura_student_name', studentName);
    } else {
      localStorage.removeItem('aura_student_name');
    }
  }, [studentName]);

  // Load available exams catalog & past attempts from Express API based on active role
  const fetchPortalData = async () => {
    if (userRole === null) {
      setIsLoading(false);
      return;
    }
    
    try {
      setIsLoading(true);
      
      // If student, pull ONLY their own attempts for confidentiality. If admin, pull all.
      const attemptsUrl = userRole === 'student'
        ? `${API_BASE}/api/attempts?studentName=${encodeURIComponent(studentName)}`
        : `${API_BASE}/api/attempts`;

      const [testsRes, attemptsRes] = await Promise.all([
        fetch(`${API_BASE}/api/tests`).catch(() => null),
        fetch(attemptsUrl).catch(() => null)
      ]);

      let testsData = fallbackExams;
      let attemptsData: Attempt[] = [];

      if (testsRes && testsRes.ok) {
        testsData = await testsRes.json();
      }
      if (attemptsRes && attemptsRes.ok) {
        attemptsData = await attemptsRes.json();
      }

      setTests(testsData && testsData.length > 0 ? testsData : fallbackExams);

      // Load and merge local storage offline attempts
      const localAttemptsKey = userRole === 'student' ? `aura_offline_attempts_${studentName}` : 'aura_offline_attempts_all';
      const localAttempts = JSON.parse(localStorage.getItem(localAttemptsKey) || '[]');
      
      const mergedAttempts = [...attemptsData, ...localAttempts];
      // Filter out duplicates by id
      const uniqueAttempts = mergedAttempts.filter((item, index) => 
        mergedAttempts.findIndex(a => a.id === item.id) === index
      );
      setAttempts(uniqueAttempts);

    } catch (error) {
      console.error('Error synchronizing portal catalogs:', error);
      // On failure, load offline/fallback data
      if (tests.length === 0) {
        setTests(fallbackExams);
      }
      const localAttemptsKey = userRole === 'student' ? `aura_offline_attempts_${studentName}` : 'aura_offline_attempts_all';
      const localAttempts = JSON.parse(localStorage.getItem(localAttemptsKey) || '[]');
      setAttempts(localAttempts);
    } finally {
      setIsLoading(false);
    }
  };

  // Re-fetch when user logs in or role changes
  useEffect(() => {
    fetchPortalData();
  }, [userRole, studentName]);

  // Handle Authenticated Session Entry
  const handleLoginSuccess = (name: string, role: 'student' | 'admin') => {
    localStorage.setItem('aura_logged_role', role);
    setUserRole(role);
    if (role === 'student') {
      setStudentName(name);
      localStorage.setItem('aura_student_name', name);
      setView('dashboard');
    } else {
      setStudentName('Administrator');
      localStorage.setItem('aura_student_name', 'Administrator');
      setView('admin');
    }
  };

  // Terminate Active Session
  const handleLogout = () => {
    localStorage.removeItem('aura_logged_role');
    localStorage.removeItem('aura_student_name');
    setUserRole(null);
    setStudentName('');
    setAttempts([]);
    setView('dashboard');
  };

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
      const response = await fetch(`${API_BASE}/api/tests/submit`, {
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

      if (response && response.ok) {
        const newAttempt = await response.json();
        // Update state and attempts
        setAttempts((prev) => [newAttempt, ...prev]);
        setView('dashboard');
        setSelectedTest(null);
        setJustCompletedAttempt(newAttempt);
        return;
      }
    } catch (err) {
      console.error('Error submitting exam answers to server, switching to offline fallback grading:', err);
    }

    // Offline Grading Fallback
    let correctCount = 0;
    selectedTest.questions.forEach((q) => {
      if (answers[q.id] === q.correctOptionIndex) {
        correctCount++;
      }
    });
    const score = Math.round((correctCount / selectedTest.questions.length) * 100);
    
    const newAttempt: Attempt = {
      id: 'local_attempt_' + Date.now(),
      studentName,
      testId: selectedTest.id,
      testTitle: selectedTest.title,
      startTime: new Date(Date.now() - selectedTest.durationMinutes * 60 * 1000).toISOString(),
      endTime: new Date().toISOString(),
      answers,
      score,
      logs,
      status: tabAwayCount > 3 || logs.some(l => l.severity === 'high') ? 'flagged' : 'submitted',
      suspiciousScore: Math.min(100, Math.max(0, tabAwayCount * 25 + logs.length * 15))
    };

    // Save to local storage for persistence across reloads/offline sessions
    const localAttemptsKey = `aura_offline_attempts_${studentName}`;
    const localAttempts = JSON.parse(localStorage.getItem(localAttemptsKey) || '[]');
    localStorage.setItem(localAttemptsKey, JSON.stringify([newAttempt, ...localAttempts]));

    // Also update admin local storage attempts list so the administrator can view them offline
    const adminLocalAttemptsKey = 'aura_offline_attempts_all';
    const adminLocalAttempts = JSON.parse(localStorage.getItem(adminLocalAttemptsKey) || '[]');
    localStorage.setItem(adminLocalAttemptsKey, JSON.stringify([newAttempt, ...adminLocalAttempts]));

    setAttempts((prev) => [newAttempt, ...prev]);
    setView('dashboard');
    setSelectedTest(null);
    setJustCompletedAttempt(newAttempt);
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
    if (userRole === 'admin') {
      setView('admin');
    }
  };

  // Unauthenticated Gateway view
  if (userRole === null) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased flex flex-col">
        <header className="bg-slate-950 text-white border-b border-slate-900 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 py-3 md:py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center text-white font-black shadow-inner">
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
          </div>
        </header>

        <main className="flex-1">
          <LoginPortal onLoginSuccess={handleLoginSuccess} />
        </main>

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
      </div>
    );
  }

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

            {/* Navigation Tabs between Student Portal & Administrator Dashboard (Admins can see both, Students are strictly bound to dashboard only) */}
            <div className="flex items-center gap-4">
              {userRole === 'admin' && (
                <nav className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-xl">
                  <button
                    onClick={() => setView('dashboard')}
                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                      view === 'dashboard'
                        ? 'bg-slate-800 text-white shadow font-extrabold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <LayoutDashboard className="w-3.5 h-3.5" /> Candidate Workspace
                  </button>
                  
                  <button
                    onClick={() => setView('admin')}
                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                      view === 'admin'
                        ? 'bg-slate-800 text-white shadow font-extrabold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Proctor Control Hub
                  </button>
                </nav>
              )}

              {/* Session Profile Badge and Secure Logout */}
              <div className="flex items-center gap-3 border-l border-slate-800 pl-4">
                <div className="hidden sm:flex flex-col items-end text-right">
                  <span className="text-xs font-bold text-slate-200">
                    {userRole === 'admin' ? 'Administrator' : studentName}
                  </span>
                  <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider">
                    {userRole === 'admin' ? 'Auditor Active' : 'Candidate Active'}
                  </span>
                </div>
                
                <button
                  onClick={handleLogout}
                  className="px-3 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 hover:text-rose-200 border border-rose-800/30 text-xs font-bold rounded-lg transition"
                >
                  Logout
                </button>
              </div>
            </div>
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

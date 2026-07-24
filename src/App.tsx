import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { BookOpenCheck, GraduationCap, LayoutDashboard, ShieldCheck, UserRound } from 'lucide-react';
import StudentDashboard from './components/StudentDashboard';
import ExamScreen from './components/ExamScreen';
import AdminPortal from './components/AdminPortal';
import AgileCertPhaseOneLandingPage from './components/AgileCertPhaseOneLandingPage';
import CandidateAvatar from './components/CandidateAvatar';
import CandidatePreparationMaterialsPanel from './components/CandidatePreparationMaterialsPanel';
import CandidateProfilePanel from './components/CandidateProfilePanel';
import CandidateProfilePhotoEditor from './components/CandidateProfilePhotoEditor';
import { signOut as signOutPortalUser } from './services/authService';
import {
  getAvailableTests,
  getPortalAttempts,
  startSecureExam,
  submitSecureExam,
} from './services/examService';
import type { Attempt, ProctorLogEvent, Test } from './types';

type PortalView = 'dashboard' | 'materials' | 'profile' | 'exam' | 'admin';

export default function App() {
  const [userRole, setUserRole] = useState<'student' | 'admin' | null>(() => {
    return (localStorage.getItem('aura_logged_role') as 'student' | 'admin') || null;
  });
  const [studentName, setStudentName] = useState(() => {
    return localStorage.getItem('aura_student_name') || '';
  });
  const [view, setView] = useState<PortalView>(() => {
    return localStorage.getItem('aura_logged_role') === 'admin' ? 'admin' : 'dashboard';
  });

  const [tests, setTests] = useState<Test[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [selectedTest, setSelectedTest] = useState<Test | null>(null);
  const [simType, setSimType] = useState('none');
  const [isLoading, setIsLoading] = useState(true);
  const [portalError, setPortalError] = useState('');
  const [justCompletedAttempt, setJustCompletedAttempt] = useState<Attempt | null>(null);

  useEffect(() => {
    if (studentName) localStorage.setItem('aura_student_name', studentName);
    else localStorage.removeItem('aura_student_name');
  }, [studentName]);

  const fetchPortalData = async () => {
    if (!userRole) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setPortalError('');
      const [testCatalogue, attemptHistory] = await Promise.all([
        getAvailableTests(),
        getPortalAttempts(),
      ]);
      setTests(testCatalogue);
      setAttempts(attemptHistory);
    } catch (error: any) {
      console.error('Supabase portal synchronisation failed:', error);
      setPortalError(error?.message || 'Unable to synchronise examination data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchPortalData();
  }, [userRole]);

  const handleLoginSuccess = (name: string, role: 'student' | 'admin') => {
    localStorage.setItem('aura_logged_role', role);
    localStorage.setItem('aura_student_name', name);
    setUserRole(role);
    setStudentName(name);
    setView(role === 'admin' ? 'admin' : 'dashboard');
  };

  const handleLogout = async () => {
    try {
      await signOutPortalUser();
    } catch (error) {
      console.error('Supabase sign-out failed:', error);
    } finally {
      localStorage.removeItem('aura_logged_role');
      localStorage.removeItem('aura_student_name');
      setUserRole(null);
      setStudentName('');
      setTests([]);
      setAttempts([]);
      setSelectedTest(null);
      setView('dashboard');
    }
  };

  const handleStartExam = async (testId: string) => {
    if (userRole !== 'student') {
      setPortalError('Staff accounts may review the catalogue but cannot begin candidate examinations.');
      return;
    }

    try {
      setIsLoading(true);
      setPortalError('');
      const liveTest = await startSecureExam(testId);
      setSelectedTest(liveTest);
      setView('exam');
    } catch (error: any) {
      console.error('Unable to start examination:', error);
      setPortalError(error?.message || 'The examination session could not be started.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitExam = async (
    answers: Record<string, number>,
    logs: ProctorLogEvent[],
    tabAwayCount: number,
  ) => {
    if (!selectedTest?.sessionId) {
      setPortalError('The secure examination session identifier is missing.');
      return;
    }

    try {
      setPortalError('');
      const newAttempt = await submitSecureExam({
        sessionId: selectedTest.sessionId,
        answers,
        logs,
        tabAwayCount,
      });

      localStorage.removeItem(`aura_exam_answers_${selectedTest.id}`);
      localStorage.removeItem(`aura_exam_flags_${selectedTest.id}`);
      localStorage.removeItem(`aura_exam_time_${selectedTest.id}`);

      setAttempts((previous) => [newAttempt, ...previous]);
      setJustCompletedAttempt(newAttempt);
      setSelectedTest(null);
      setView('dashboard');
      void fetchPortalData();
    } catch (error: any) {
      console.error('Secure assessment submission failed:', error);
      setPortalError(
        error?.message || 'The assessment could not be submitted. Your local answer cache remains available.',
      );
    }
  };

  const handleOverrideStatus = (
    attemptId: string,
    newStatus: 'submitted' | 'flagged' | 'terminated',
  ) => {
    setAttempts((previous) =>
      previous.map((attempt) =>
        attempt.id === attemptId
          ? {
              ...attempt,
              status: newStatus,
              suspiciousScore: newStatus === 'submitted' ? 15 : 75,
            }
          : attempt,
      ),
    );
  };

  const handleViewAttemptDetails = (_attempt: Attempt) => {
    if (userRole === 'admin') setView('admin');
  };

  if (!userRole) {
    return <AgileCertPhaseOneLandingPage onLoginSuccess={handleLoginSuccess} />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4 text-slate-100">
        <div className="w-12 h-12 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-bold uppercase tracking-widest text-slate-400">
          Synchronising secure examination records...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased flex flex-col">
      {view !== 'exam' && (
        <header className="bg-slate-950 text-white border-b border-slate-900 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center shadow-inner">
                <GraduationCap className="w-5.5 h-5.5 text-white" />
              </div>
              <div>
                <span className="font-extrabold text-sm tracking-tight uppercase">AgileCert Global</span>
                <p className="text-[10px] text-slate-400">Powered by IIPM · Secure Examination Runtime</p>
              </div>
            </div>

            <div className="flex items-center gap-3 md:gap-4">
              {userRole === 'admin' ? (
                <nav className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-xl">
                  <button
                    onClick={() => setView('dashboard')}
                    className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-1.5 ${
                      view === 'dashboard' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <LayoutDashboard className="w-3.5 h-3.5" /> Catalogue
                  </button>
                  <button
                    onClick={() => setView('admin')}
                    className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-1.5 ${
                      view === 'admin' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Control Hub
                  </button>
                </nav>
              ) : (
                <nav className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-xl">
                  <button
                    onClick={() => setView('dashboard')}
                    className={`px-3 py-2 text-xs font-bold rounded-lg flex items-center gap-1.5 ${
                      view === 'dashboard' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <LayoutDashboard className="w-3.5 h-3.5" />
                    <span className="hidden lg:inline">Examinations</span>
                  </button>
                  <button
                    onClick={() => setView('materials')}
                    className={`px-3 py-2 text-xs font-bold rounded-lg flex items-center gap-1.5 ${
                      view === 'materials' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <BookOpenCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="hidden lg:inline">Materials</span>
                  </button>
                  <button
                    onClick={() => setView('profile')}
                    className={`px-3 py-2 text-xs font-bold rounded-lg flex items-center gap-1.5 ${
                      view === 'profile' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <UserRound className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="hidden lg:inline">Profile</span>
                  </button>
                </nav>
              )}

              {userRole === 'student' ? (
                <button
                  type="button"
                  onClick={() => setView('profile')}
                  className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/70 p-1.5 pr-2 transition hover:border-emerald-500 hover:bg-slate-900"
                  aria-label="Open candidate profile"
                >
                  <CandidateAvatar candidateName={studentName} size="sm" />
                  <span className="hidden sm:flex flex-col items-start">
                    <span className="max-w-40 truncate text-xs font-bold text-slate-200">{studentName}</span>
                    <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider">
                      Candidate Session
                    </span>
                  </span>
                </button>
              ) : (
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-xs font-bold text-slate-200">{studentName}</span>
                  <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider">
                    Staff Session
                  </span>
                </div>
              )}

              <button
                onClick={() => void handleLogout()}
                className="px-3 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/30 text-xs font-bold rounded-lg"
              >
                Logout
              </button>
            </div>
          </div>
        </header>
      )}

      {portalError && view !== 'exam' && (
        <div className="max-w-7xl w-full mx-auto px-4 pt-4">
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            {portalError}
          </div>
        </div>
      )}

      <div className="flex-1">
        <AnimatePresence mode="wait">
          {view === 'dashboard' && (
            <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <StudentDashboard
                studentName={studentName}
                setStudentName={setStudentName}
                tests={tests}
                attempts={attempts}
                onStartExam={(testId) => void handleStartExam(testId)}
                onViewAttemptDetails={handleViewAttemptDetails}
                simType={simType}
                setSimType={setSimType}
                justCompletedAttempt={justCompletedAttempt}
                onClearJustCompleted={() => setJustCompletedAttempt(null)}
              />
            </motion.div>
          )}

          {view === 'materials' && userRole === 'student' && (
            <motion.div key="materials" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <CandidatePreparationMaterialsPanel />
            </motion.div>
          )}

          {view === 'profile' && userRole === 'student' && (
            <motion.div key="profile" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="mx-auto w-full max-w-6xl px-4 pt-8 md:pt-10">
                <CandidateProfilePhotoEditor candidateName={studentName} />
              </div>
              <CandidateProfilePanel
                candidateName={studentName}
                onCandidateNameChange={setStudentName}
                onBack={() => setView('dashboard')}
              />
            </motion.div>
          )}

          {view === 'exam' && selectedTest && (
            <motion.div key="exam" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <ExamScreen
                test={selectedTest}
                studentName={studentName}
                simType={simType}
                onSubmitExam={handleSubmitExam}
                onExitExam={() => {
                  setSelectedTest(null);
                  setView('dashboard');
                }}
              />
            </motion.div>
          )}

          {view === 'admin' && (
            <motion.div key="admin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <AdminPortal
                attempts={attempts}
                onBackToDashboard={() => setView('dashboard')}
                onOverrideStatus={handleOverrideStatus}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {view !== 'exam' && (
        <footer className="bg-slate-100 border-t border-slate-200 py-6 text-center text-xs text-slate-500">
          AgileCert Global — Powered by the Integrated Institute of Professional Management
        </footer>
      )}
    </div>
  );
}

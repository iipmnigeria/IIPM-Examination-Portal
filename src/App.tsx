import React, { useEffect, useState } from 'react';
import { GraduationCap, LayoutDashboard, ShieldCheck } from 'lucide-react';
import { Attempt, ProctorLogEvent, Test } from './types';
import { getAvailableTests, getPortalAttempts, signOutPortalUser, startSecureExam, submitCipmnMcqSection, submitCipmnTheorySection, submitSecureExam } from './services/examService';
import AgileCertPhaseOneLandingPage from './components/AgileCertPhaseOneLandingPage';
import StudentDashboard from './components/StudentDashboard';
import AdminPortal from './components/AdminPortal';
import ExamExperience from './components/ExamExperience';
import CipmnExamExperience from './components/CipmnExamExperience';
import LearningMaterialsHub from './components/LearningMaterialsHub';

const readMaterialsDestination = () => {
  const params = new URLSearchParams(window.location.search);
  return {
    requested: params.get('view') === 'materials',
    examinationId: params.get('examinationId') || undefined,
  };
};

const App: React.FC = () => {
  const [userRole, setUserRole] = useState<'student' | 'admin' | null>(() => {
    const stored = localStorage.getItem('aura_logged_role');
    return stored === 'student' || stored === 'admin' ? stored : null;
  });
  const [studentName, setStudentName] = useState(() => localStorage.getItem('aura_student_name') || '');
  const [view, setView] = useState<'dashboard' | 'admin' | 'exam' | 'materials'>(() => {
    const materialsDestination = readMaterialsDestination();
    return materialsDestination.requested ? 'materials' : 'dashboard';
  });
  const [materialsExaminationId, setMaterialsExaminationId] = useState<string | undefined>(() => readMaterialsDestination().examinationId);
  const [tests, setTests] = useState<Test[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [selectedTest, setSelectedTest] = useState<Test | null>(null);
  const [justCompletedAttempt, setJustCompletedAttempt] = useState<Attempt | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [portalError, setPortalError] = useState('');

  useEffect(() => {
    const openContextualMaterials = (event: Event) => {
      const customEvent = event as CustomEvent<{ examinationId?: string }>;
      setMaterialsExaminationId(customEvent.detail?.examinationId);
      setView('materials');
    };

    window.addEventListener('agilecert-materials-open', openContextualMaterials as EventListener);
    return () => window.removeEventListener('agilecert-materials-open', openContextualMaterials as EventListener);
  }, [userRole]);

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
    const materialsDestination = readMaterialsDestination();
    localStorage.setItem('aura_logged_role', role);
    localStorage.setItem('aura_student_name', name);
    setUserRole(role);
    setStudentName(name);
    setMaterialsExaminationId(materialsDestination.examinationId);
    setView(role === 'admin' ? 'admin' : materialsDestination.requested ? 'materials' : 'dashboard');
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
      const catalogueTest = tests.find((test) => test.id === testId);
      const liveTest = await startSecureExam(testId);

      // D2: preserve only authoritative catalogue routing metadata that older
      // secure-start functions do not echo. Questions/session/security data remain
      // exclusively sourced from the secure-start payload.
      const routedTest: Test = {
        ...liveTest,
        examFormat: liveTest.examFormat ?? catalogueTest?.examFormat,
        mcqCount: liveTest.mcqCount ?? catalogueTest?.mcqCount,
        theoryCount: liveTest.theoryCount ?? catalogueTest?.theoryCount,
      };

      setSelectedTest(routedTest);
      setView('exam');
    } catch (error: any) {
      console.error('Unable to start examination:', error);
      setPortalError(error?.message || 'The examination session could not be started.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitExam = async (answers: Record<string, number>, logs: ProctorLogEvent[], tabAwayCount: number) => {
    if (!selectedTest?.sessionId) {
      setPortalError('The secure examination session identifier is missing.');
      return;
    }
    try {
      setPortalError('');
      const newAttempt = await submitSecureExam({ sessionId: selectedTest.sessionId, answers, logs, tabAwayCount });
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
      setPortalError(error?.message || 'The assessment could not be submitted. Your local answer cache remains available.');
    }
  };

  const handleSubmitCipmnMcq = async (answers: Record<string, number>, logs: ProctorLogEvent[], tabAwayCount: number): Promise<number> => {
    if (!selectedTest?.sessionId) throw new Error('The secure examination session identifier is missing.');
    const result = await submitCipmnMcqSection({ sessionId: selectedTest.sessionId, answers, logs, tabAwayCount });
    setSelectedTest((previous) => previous ? { ...previous, currentSection: 'theory', mcqScore: result.mcqScore } : previous);
    return result.mcqScore;
  };

  const handleSubmitCipmnTheory = async (answers: Record<string, string>, logs: ProctorLogEvent[], tabAwayCount: number) => {
    if (!selectedTest?.sessionId) throw new Error('The secure examination session identifier is missing.');
    const newAttempt = await submitCipmnTheorySection({ sessionId: selectedTest.sessionId, answers, logs, tabAwayCount });
    setAttempts((previous) => [newAttempt, ...previous]);
    setJustCompletedAttempt(newAttempt);
    setSelectedTest(null);
    setView('dashboard');
    void fetchPortalData();
  };

  const handleViewAttemptDetails = (_attempt: Attempt) => {
    if (userRole === 'admin') setView('admin');
  };

  if (!userRole) return <AgileCertPhaseOneLandingPage onLoginSuccess={handleLoginSuccess} />;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4 text-slate-100">
        <div className="w-12 h-12 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-bold uppercase tracking-widest text-slate-400">Synchronising secure examination records...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased flex flex-col">
      {view !== 'exam' && (
        <header className="bg-slate-950 text-white border-b border-slate-900 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center shadow-inner"><GraduationCap className="w-5.5 h-5.5 text-white" /></div>
              <div><span className="font-extrabold text-sm tracking-tight uppercase">AgileCert Global</span><p className="text-[10px] text-slate-400">Powered by IIPM · Secure Examination Runtime</p></div>
            </div>
            <div className="flex items-center gap-3 md:gap-4">
              {userRole === 'admin' ? (
                <nav className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-xl">
                  <button onClick={() => setView('dashboard')} className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-1.5 ${view === 'dashboard' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}><LayoutDashboard className="w-3.5 h-3.5" /> Catalogue</button>
                  <button onClick={() => setView('admin')} className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-1.5 ${view === 'admin' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}><ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Control Hub</button>
                </nav>
              ) : (
                <nav className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-xl">
                  <button onClick={() => setView('dashboard')} className={`px-4 py-2 text-xs font-bold rounded-lg ${view === 'dashboard' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}>Dashboard</button>
                  <button onClick={() => setView('materials')} className={`px-4 py-2 text-xs font-bold rounded-lg ${view === 'materials' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}>Materials</button>
                </nav>
              )}
              <button onClick={handleLogout} className="text-xs font-bold text-slate-400 hover:text-white">Sign out</button>
            </div>
          </div>
        </header>
      )}

      {portalError && view !== 'exam' && <div className="max-w-7xl w-full mx-auto px-4 pt-4"><div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{portalError}</div></div>}

      <main className="flex-1">
        {view === 'dashboard' && <StudentDashboard studentName={studentName} tests={tests} attempts={attempts} onStartExam={handleStartExam} justCompletedAttempt={justCompletedAttempt} onDismissCompletedAttempt={() => setJustCompletedAttempt(null)} />}
        {view === 'admin' && <AdminPortal attempts={attempts} onBackToDashboard={() => setView('dashboard')} onRefresh={fetchPortalData} />}
        {view === 'materials' && <LearningMaterialsHub initialExaminationId={materialsExaminationId} onBack={() => setView('dashboard')} />}
        {view === 'exam' && selectedTest && (
          selectedTest.examFormat === 'cipmn_mixed' ? (
            <CipmnExamExperience test={selectedTest} studentName={studentName} onSubmitMcq={handleSubmitCipmnMcq} onSubmitTheory={handleSubmitCipmnTheory} onExit={() => { setSelectedTest(null); setView('dashboard'); void fetchPortalData(); }} />
          ) : (
            <ExamExperience test={selectedTest} studentName={studentName} onSubmit={handleSubmitExam} onExit={() => { setSelectedTest(null); setView('dashboard'); void fetchPortalData(); }} />
          )
        )}
      </main>
    </div>
  );
};

export default App;

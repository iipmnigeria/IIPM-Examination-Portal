import { type ReactNode, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getCurrentPortalUser, signOut } from '../services/authService';
import { getMyCandidateOnboardingStatus } from '../services/candidateProfileService';
import MandatoryCandidateOnboarding from './MandatoryCandidateOnboarding';

interface CandidateOnboardingBoundaryProps {
  children: ReactNode;
}

export default function CandidateOnboardingBoundary({ children }: CandidateOnboardingBoundaryProps) {
  const [candidateName, setCandidateName] = useState('Candidate');
  const [candidateSession, setCandidateSession] = useState(
    () => localStorage.getItem('aura_logged_role') === 'student',
  );
  const [checking, setChecking] = useState(true);
  const [required, setRequired] = useState(false);

  const refresh = async () => {
    setChecking(true);
    try {
      const current = await getCurrentPortalUser();
      if (!current || current.profile.role !== 'candidate') {
        setCandidateSession(false);
        setRequired(false);
        return;
      }

      setCandidateSession(true);
      setCandidateName(current.profile.full_name || 'Candidate');

      try {
        const status = await getMyCandidateOnboardingStatus();
        setRequired(!status.complete);
      } catch (statusError) {
        console.error('Candidate onboarding status verification failed:', statusError);
        // A candidate may not bypass mandatory onboarding because of a network,
        // migration or policy-check failure. The completion form remains the only
        // available workspace until the server can verify the profile.
        setRequired(true);
      }
    } catch (sessionError) {
      console.error('Candidate session verification failed:', sessionError);
      setCandidateSession(false);
      setRequired(false);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    void refresh();
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      window.setTimeout(() => void refresh(), 0);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (required || (checking && candidateSession)) {
      document.body.dataset.agilecertOnboardingRequired = 'true';
    } else {
      delete document.body.dataset.agilecertOnboardingRequired;
    }
    return () => {
      delete document.body.dataset.agilecertOnboardingRequired;
    };
  }, [checking, candidateSession, required]);

  const updateName = (name: string) => {
    setCandidateName(name);
    localStorage.setItem('aura_student_name', name);
  };

  const logout = async () => {
    try {
      await signOut();
    } finally {
      localStorage.removeItem('aura_logged_role');
      localStorage.removeItem('aura_student_name');
      window.location.reload();
    }
  };

  return (
    <>
      {children}
      {checking && candidateSession && (
        <div className="fixed inset-0 z-[2147483000] flex flex-col items-center justify-center gap-4 bg-slate-950 text-white">
          <Loader2 className="h-10 w-10 animate-spin text-emerald-400" />
          <p className="text-sm font-black uppercase tracking-widest text-slate-300">
            Verifying mandatory candidate profile…
          </p>
        </div>
      )}
      {!checking && required && (
        <div className="fixed inset-0 z-[2147483000] overflow-y-auto bg-slate-100">
          <MandatoryCandidateOnboarding
            candidateName={candidateName}
            onCandidateNameChange={updateName}
            onComplete={refresh}
            onLogout={logout}
          />
        </div>
      )}
    </>
  );
}

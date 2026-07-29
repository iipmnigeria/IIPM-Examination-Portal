import { type ReactNode, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getCurrentPortalUser, signOut } from '../services/authService';
import { getMyCandidateOnboardingStatus } from '../services/candidateProfileService';
import MandatoryCandidateOnboarding from './MandatoryCandidateOnboarding';

interface CandidateOnboardingBoundaryProps {
  children: ReactNode;
}

export default function CandidateOnboardingBoundary({ children }: CandidateOnboardingBoundaryProps) {
  const [candidateName, setCandidateName] = useState('Candidate');
  const [checking, setChecking] = useState(true);
  const [required, setRequired] = useState(false);

  const refresh = async () => {
    try {
      setChecking(true);
      const current = await getCurrentPortalUser();
      if (!current || current.profile.role !== 'candidate') {
        setRequired(false);
        return;
      }
      setCandidateName(current.profile.full_name || 'Candidate');
      const status = await getMyCandidateOnboardingStatus();
      setRequired(!status.complete);
    } catch {
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
    if (required) document.body.dataset.agilecertOnboardingRequired = 'true';
    else delete document.body.dataset.agilecertOnboardingRequired;
    return () => {
      delete document.body.dataset.agilecertOnboardingRequired;
    };
  }, [required]);

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

import React, { useEffect, useState } from 'react';
import { getCurrentPortalUser, signOut as signOutPortalUser } from '../services/authService';
import { supabase } from '../lib/supabase';

interface SupabaseSessionBoundaryProps {
  children: React.ReactNode;
}

function clearLegacySession(): void {
  localStorage.removeItem('aura_logged_role');
  localStorage.removeItem('aura_student_name');
}

async function synchronizePortalSession(): Promise<void> {
  const current = await getCurrentPortalUser();

  if (!current) {
    clearLegacySession();
    return;
  }

  const uiRole = current.profile.role === 'candidate' ? 'student' : 'admin';
  localStorage.setItem('aura_logged_role', uiRole);
  localStorage.setItem('aura_student_name', current.profile.full_name);
}

export default function SupabaseSessionBoundary({ children }: SupabaseSessionBoundaryProps) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    synchronizePortalSession()
      .catch((error) => {
        console.error('Unable to restore Supabase portal session:', error);
        clearLegacySession();
      })
      .finally(() => {
        if (isMounted) setIsReady(true);
      });

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        clearLegacySession();
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        window.setTimeout(() => {
          synchronizePortalSession().catch((error) => {
            console.error('Unable to synchronize Supabase session:', error);
          });
        }, 0);
      }
    });

    const handlePortalLogout = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest('button');
      if (!button || button.textContent?.trim() !== 'Logout') return;

      signOutPortalUser().catch((error) => {
        console.error('Supabase sign-out failed:', error);
      });
    };

    document.addEventListener('click', handlePortalLogout, true);

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
      document.removeEventListener('click', handlePortalLogout, true);
    };
  }, []);

  if (!isReady) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4 text-slate-100">
        <div className="w-12 h-12 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-bold uppercase tracking-widest text-slate-400">
          Restoring secure examination session...
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

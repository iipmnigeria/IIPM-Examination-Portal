import { useEffect, useState } from 'react';
import { Award, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getCurrentPortalUser } from '../services/authService';
import AdminCertificateManagementPanel from './AdminCertificateManagementPanel';

export default function AdminCertificateManagementLauncher() {
  const [isAuthorised, setIsAuthorised] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const refreshAuthorisation = async () => {
      try {
        const current = await getCurrentPortalUser();
        const authorised = Boolean(
          current && ['exam_admin', 'super_admin'].includes(current.profile.role),
        );
        setIsAuthorised(authorised);
        if (!authorised) setIsOpen(false);
      } catch (error) {
        console.error('Unable to resolve certificate-administration access:', error);
        setIsAuthorised(false);
        setIsOpen(false);
      }
    };

    void refreshAuthorisation();
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      window.setTimeout(() => void refreshAuthorisation(), 0);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  if (!isAuthorised) return null;

  if (isOpen) {
    return (
      <div className="fixed inset-0 z-[130] overflow-y-auto bg-slate-50">
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="fixed right-4 top-4 z-[150] rounded-full border border-slate-200 bg-white p-2.5 text-slate-600 shadow-lg transition hover:bg-slate-100"
          aria-label="Close certificate administration"
        >
          <X className="h-5 w-5" />
        </button>
        <AdminCertificateManagementPanel />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setIsOpen(true)}
      className="fixed bottom-20 left-5 z-[82] inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-slate-950 px-4 py-3 text-xs font-extrabold text-white shadow-2xl transition hover:-translate-y-0.5 hover:bg-slate-900"
      aria-label="Open certificate authority administration"
    >
      <Award className="h-4 w-4 text-amber-400" />
      <span className="hidden sm:inline">Certificate Authority</span>
    </button>
  );
}

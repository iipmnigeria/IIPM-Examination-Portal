import { useEffect, useState } from 'react';
import { LibraryBig, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getCurrentPortalUser } from '../services/authService';
import AdminMaterialManagementPanel from './AdminMaterialManagementPanel';

export default function AdminMaterialManagementLauncher() {
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
        console.error('Unable to resolve material-administration access:', error);
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
      <div className="fixed inset-0 z-[120] overflow-y-auto bg-slate-50">
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="fixed right-4 top-4 z-[130] rounded-full border border-slate-200 bg-white p-2.5 text-slate-600 shadow-lg transition hover:bg-slate-100"
          aria-label="Close preparation material management"
        >
          <X className="h-5 w-5" />
        </button>
        <AdminMaterialManagementPanel
          onBackToAudits={() => setIsOpen(false)}
          onExit={() => setIsOpen(false)}
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setIsOpen(true)}
      className="fixed bottom-5 left-5 z-[80] inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-slate-950 px-4 py-3 text-xs font-extrabold text-white shadow-2xl transition hover:-translate-y-0.5 hover:bg-slate-900"
      aria-label="Open preparation material management"
    >
      <LibraryBig className="h-4 w-4 text-emerald-400" />
      <span className="hidden sm:inline">Material Management</span>
    </button>
  );
}

import { useEffect, useState } from 'react';
import { Award, FileCheck2, ShieldCheck, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getCurrentPortalUser } from '../services/authService';
import AdminCertificateManagementPanel from './AdminCertificateManagementPanel';
import AdminCertificateTemplateConsole from './AdminCertificateTemplateConsole';

type CertificateWorkspace = 'issuance' | 'templates';

export default function AdminCertificateManagementLauncher() {
  const [isAuthorised, setIsAuthorised] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeWorkspace, setActiveWorkspace] = useState<CertificateWorkspace>('templates');

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
        <header className="sticky top-0 z-[145] border-b border-slate-800 bg-slate-950 px-4 py-3 text-white shadow-xl md:px-6">
          <div className="mx-auto flex max-w-[1500px] flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">
                Protected certificate administration
              </p>
              <h1 className="mt-1 text-lg font-black">Certificate Management Console</h1>
              <p className="mt-1 text-xs text-slate-400">
                Issuance, lifecycle, institutions, categories, master templates, assets and assignments
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <nav className="flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-900 p-1">
                <button
                  type="button"
                  onClick={() => setActiveWorkspace('issuance')}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-black transition ${
                    activeWorkspace === 'issuance'
                      ? 'bg-white text-slate-950'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <ShieldCheck className="h-4 w-4" /> Issuance & Lifecycle
                </button>
                <button
                  type="button"
                  onClick={() => setActiveWorkspace('templates')}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-black transition ${
                    activeWorkspace === 'templates'
                      ? 'bg-white text-slate-950'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <FileCheck2 className="h-4 w-4" /> Master Templates
                </button>
              </nav>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-full border border-slate-700 bg-slate-900 p-2.5 text-slate-300 transition hover:bg-slate-800 hover:text-white"
                aria-label="Close Certificate Management Console"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </header>

        {activeWorkspace === 'issuance' ? (
          <AdminCertificateManagementPanel />
        ) : (
          <AdminCertificateTemplateConsole />
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setIsOpen(true)}
      className="fixed bottom-20 left-5 z-[82] inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-slate-950 px-4 py-3 text-xs font-extrabold text-white shadow-2xl transition hover:-translate-y-0.5 hover:bg-slate-900"
      aria-label="Open Certificate Management Console"
    >
      <Award className="h-4 w-4 text-amber-400" />
      <span className="hidden sm:inline">Certificate Management</span>
    </button>
  );
}

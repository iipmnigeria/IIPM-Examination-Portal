import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ExternalLink, Wrench } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getCurrentPortalUser } from '../services/authService';

type AdminTool = { label: string; selector: string };

const tools: AdminTool[] = [];

export default function AdminPrimaryToolsMenu() {
  const [authorised, setAuthorised] = useState(false);
  const [menuRoot, setMenuRoot] = useState<HTMLElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const refresh = async () => {
      try {
        const current = await getCurrentPortalUser();
        setAuthorised(current?.profile.role === 'exam_admin' || current?.profile.role === 'super_admin');
      } catch {
        setAuthorised(false);
      }
    };
    void refresh();
    const { data: listener } = supabase.auth.onAuthStateChange(() => window.setTimeout(() => void refresh(), 0));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!authorised) return;
    const attach = () => {
      const nav = document.querySelector<HTMLElement>('header nav');
      if (!nav) return setMenuRoot(null);
      let mount = nav.querySelector<HTMLElement>('[data-agilecert-admin-tools-mount="true"]');
      if (!mount) {
        mount = document.createElement('div');
        mount.dataset.agilecertAdminToolsMount = 'true';
        mount.className = 'relative';
        nav.appendChild(mount);
      }
      setMenuRoot(mount);
    };
    attach();
    const observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [authorised]);

  if (!authorised || !menuRoot) return null;

  return createPortal(
    <div ref={menuRef} className="relative">
      <button type="button" onClick={() => setIsOpen((value) => !value)} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Open administrator tools menu">
        <Wrench className="h-3.5 w-3.5 text-violet-300" />
        <span className="hidden xl:inline">Tools</span>
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
      {isOpen && (
        <div role="menu" className="absolute right-0 top-[calc(100%+0.6rem)] z-[140] w-72 rounded-2xl border border-slate-700 bg-slate-950 p-2 text-white shadow-2xl">
          <p className="px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Administrator tools and services</p>
          {tools.map((tool) => (
            <button key={tool.label} type="button" role="menuitem" className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left hover:bg-slate-800">
              <span className="text-xs font-black">{tool.label}</span>
              <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
            </button>
          ))}
        </div>
      )}
    </div>,
    menuRoot,
  );
}

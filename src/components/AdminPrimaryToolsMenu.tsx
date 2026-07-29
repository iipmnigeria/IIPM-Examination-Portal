import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ExternalLink, Wrench } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getCurrentPortalUser } from '../services/authService';

type AdminTool = { key: string; label: string };

const launcherLabel = (button: HTMLButtonElement) =>
  (button.textContent || button.getAttribute('aria-label') || 'Administrative tool')
    .replace(/\s+/g, ' ')
    .replace(/^Open\s+/i, '')
    .trim();

const isAiChatbot = (button: HTMLButtonElement) => {
  const value = `${button.textContent || ''} ${button.getAttribute('aria-label') || ''}`.toLowerCase();
  return value.includes('ask agilecert ai') || value.includes('certification adviser') || value.includes('chatbot');
};

export default function AdminPrimaryToolsMenu() {
  const [authorised, setAuthorised] = useState(false);
  const [menuRoot, setMenuRoot] = useState<HTMLElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [tools, setTools] = useState<AdminTool[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);
  const launchers = useRef(new Map<string, HTMLButtonElement>());

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

      const next = new Map<string, HTMLButtonElement>();
      document.querySelectorAll<HTMLButtonElement>('button.fixed').forEach((button, index) => {
        if (isAiChatbot(button)) return;
        const label = launcherLabel(button);
        const key = button.getAttribute('aria-label') || `${label}-${index}`;
        if (!button.dataset.agilecertAdminOriginalDisplay) {
          button.dataset.agilecertAdminOriginalDisplay = button.style.display || '__empty__';
        }
        button.style.display = 'none';
        next.set(key, button);
      });
      launchers.current = next;
      const nextTools = Array.from(next.entries())
        .map(([key, button]) => ({ key, label: launcherLabel(button) }))
        .sort((a, b) => a.label.localeCompare(b.label));
      setTools((current) => JSON.stringify(current) === JSON.stringify(nextTools) ? current : nextTools);
    };

    attach();
    const observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [authorised]);

  useEffect(() => {
    if (!isOpen) return;
    const outside = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [isOpen]);

  const openTool = (key: string) => {
    launchers.current.get(key)?.click();
    setIsOpen(false);
  };

  if (!authorised || !menuRoot) return null;

  return createPortal(
    <div ref={menuRef} className="relative">
      <button type="button" onClick={() => setIsOpen((value) => !value)} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Open administrator tools menu">
        <Wrench className="h-3.5 w-3.5 text-violet-300" />
        <span className="hidden xl:inline">Tools</span>
        <ChevronDown className={`h-3.5 w-3.5 transition ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div role="menu" className="absolute right-0 top-[calc(100%+0.6rem)] z-[140] max-h-[min(76vh,38rem)] w-72 overflow-y-auto rounded-2xl border border-slate-700 bg-slate-950 p-2 text-white shadow-2xl">
          <p className="px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Administrator tools and services</p>
          {tools.map((tool) => (
            <button key={tool.key} type="button" role="menuitem" onClick={() => openTool(tool.key)} className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left hover:bg-slate-800">
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

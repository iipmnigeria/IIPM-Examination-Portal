import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ExternalLink, Wrench } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getCurrentPortalUser } from '../services/authService';

type AdminLauncher = {
  element: HTMLButtonElement;
  key: string;
  label: string;
};

const isAiChatbotLauncher = (button: HTMLButtonElement) => {
  const searchable = `${button.getAttribute('aria-label') || ''} ${button.textContent || ''}`.toLowerCase();
  return searchable.includes('ask agilecert ai')
    || searchable.includes('certification adviser')
    || searchable.includes('certification advisor')
    || searchable.includes('open ai adviser')
    || searchable.includes('open ai advisor');
};

const launcherLabel = (button: HTMLButtonElement) => {
  const visibleText = (button.textContent || '').replace(/\s+/g, ' ').trim();
  const ariaLabel = (button.getAttribute('aria-label') || '').replace(/^open\s+/i, '').trim();
  const raw = visibleText || ariaLabel || 'Administrative tool';
  return raw
    .replace(/\s+administration$/i, '')
    .replace(/\s+console$/i, '')
    .replace(/\s+workspace$/i, '')
    .trim();
};

const launcherKey = (button: HTMLButtonElement, index: number) =>
  button.getAttribute('aria-label') || `${launcherLabel(button)}-${index}`;

const restoreLauncher = (button: HTMLButtonElement) => {
  const original = button.dataset.agilecertAdminOriginalDisplay;
  if (original === '__empty__') button.style.removeProperty('display');
  else if (original) button.style.display = original;
  delete button.dataset.agilecertAdminOriginalDisplay;
  delete button.dataset.agilecertAdminToolLauncher;
};

export default function AdminPrimaryToolsMenu() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [menuRoot, setMenuRoot] = useState<HTMLElement | null>(null);
  const [launchers, setLaunchers] = useState<AdminLauncher[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const refreshAuthorisation = async () => {
      try {
        const current = await getCurrentPortalUser();
        const authorised = Boolean(current && ['exam_admin', 'super_admin'].includes(current.profile.role));
        setIsAdmin(authorised);
        if (!authorised) setIsOpen(false);
      } catch {
        setIsAdmin(false);
        setIsOpen(false);
      }
    };

    void refreshAuthorisation();
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      window.setTimeout(() => void refreshAuthorisation(), 0);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      document.querySelectorAll<HTMLButtonElement>('button[data-agilecert-admin-tool-launcher="true"]')
        .forEach(restoreLauncher);
      setMenuRoot(null);
      setLaunchers([]);
      return;
    }

    const refresh = () => {
      const header = document.querySelector<HTMLElement>('header');
      const nav = header?.querySelector<HTMLElement>('nav');
      if (!nav) {
        setMenuRoot(null);
        return;
      }

      let mount = nav.querySelector<HTMLElement>('[data-agilecert-admin-tools-mount="true"]');
      if (!mount) {
        mount = document.createElement('div');
        mount.dataset.agilecertAdminToolsMount = 'true';
        mount.className = 'relative';
        nav.appendChild(mount);
      }
      setMenuRoot(mount);

      const candidates = Array.from(document.querySelectorAll<HTMLButtonElement>('button.fixed'))
        .filter((button) => !isAiChatbotLauncher(button));

      candidates.forEach((button) => {
        if (!button.dataset.agilecertAdminOriginalDisplay) {
          button.dataset.agilecertAdminOriginalDisplay = button.style.display || '__empty__';
        }
        button.dataset.agilecertAdminToolLauncher = 'true';
        button.style.display = 'none';
      });

      setLaunchers(candidates.map((element, index) => ({
        element,
        key: launcherKey(element, index),
        label: launcherLabel(element),
      })));
    };

    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { childList: true, subtree: true });
    const timer = window.setInterval(refresh, 1200);

    return () => {
      observer.disconnect();
      window.clearInterval(timer);
      document.querySelectorAll<HTMLButtonElement>('button[data-agilecert-admin-tool-launcher="true"]')
        .forEach(restoreLauncher);
    };
  }, [isAdmin]);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  const sortedLaunchers = useMemo(() => [...launchers].sort((a, b) => a.label.localeCompare(b.label)), [launchers]);

  const openLauncher = (launcher: AdminLauncher) => {
    launcher.element.click();
    setIsOpen(false);
  };

  if (!isAdmin || !menuRoot) return null;

  return createPortal(
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition ${
          isOpen ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
        }`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="Open administrator tools menu"
      >
        <Wrench className="h-3.5 w-3.5 text-violet-300" />
        <span>Tools</span>
        <ChevronDown className={`h-3.5 w-3.5 transition ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+0.6rem)] z-[180] max-h-[min(76vh,38rem)] w-80 overflow-y-auto rounded-2xl border border-slate-700 bg-slate-950 p-2 text-white shadow-2xl"
        >
          <p className="px-3 pb-2 pt-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
            Administration tools
          </p>

          {sortedLaunchers.map((launcher) => (
            <button
              key={launcher.key}
              type="button"
              role="menuitem"
              onClick={() => openLauncher(launcher)}
              className="mt-1 flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-slate-800"
            >
              <span className="text-xs font-black">{launcher.label}</span>
              <ExternalLink className="h-4 w-4 shrink-0 text-slate-500" />
            </button>
          ))}

          {!sortedLaunchers.length && (
            <p className="rounded-xl px-3 py-4 text-xs leading-5 text-slate-400">
              No additional administrator tools are available for this account.
            </p>
          )}
        </div>
      )}
    </div>,
    menuRoot,
  );
}

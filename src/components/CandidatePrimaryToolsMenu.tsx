import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ShoppingBag, Sparkles, Wrench } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getCurrentPortalUser } from '../services/authService';

const hiddenLauncherSelectors = [
  'button[aria-label="Open AI CV Studio"]',
  'button[aria-label="Open certificate payment and credentials"]',
];

const hideSecondaryLaunchers = () => {
  hiddenLauncherSelectors.forEach((selector) => {
    document.querySelectorAll<HTMLElement>(selector).forEach((element) => {
      if (!element.dataset.agilecertOriginalDisplay) {
        element.dataset.agilecertOriginalDisplay = element.style.display || '__empty__';
      }
      element.style.display = 'none';
    });
  });
};

const restoreSecondaryLaunchers = () => {
  hiddenLauncherSelectors.forEach((selector) => {
    document.querySelectorAll<HTMLElement>(selector).forEach((element) => {
      const original = element.dataset.agilecertOriginalDisplay;
      if (original === '__empty__') element.style.removeProperty('display');
      else if (original) element.style.display = original;
      delete element.dataset.agilecertOriginalDisplay;
    });
  });
};

export default function CandidatePrimaryToolsMenu() {
  const [isCandidate, setIsCandidate] = useState(false);
  const [menuRoot, setMenuRoot] = useState<HTMLElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const refreshAuthorisation = async () => {
      try {
        const current = await getCurrentPortalUser();
        const candidate = current?.profile.role === 'candidate';
        setIsCandidate(candidate);
        if (!candidate) setIsOpen(false);
      } catch {
        setIsCandidate(false);
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
    if (!isCandidate) {
      setMenuRoot(null);
      restoreSecondaryLaunchers();
      return;
    }

    const attach = () => {
      hideSecondaryLaunchers();
      const header = document.querySelector<HTMLElement>('header');
      const nav = header?.querySelector<HTMLElement>('nav');
      if (!nav) {
        setMenuRoot(null);
        return;
      }

      let mount = nav.querySelector<HTMLElement>('[data-agilecert-primary-tools-mount="true"]');
      if (!mount) {
        mount = document.createElement('div');
        mount.dataset.agilecertPrimaryToolsMount = 'true';
        mount.className = 'relative';
        nav.appendChild(mount);
      }
      setMenuRoot(mount);
    };

    attach();
    const observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      restoreSecondaryLaunchers();
    };
  }, [isCandidate]);

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

  const openCredentialStore = () => {
    const launcher = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Open certificate payment and credentials"]',
    );
    launcher?.click();
    setIsOpen(false);
  };

  const openAiCvStudio = () => {
    window.dispatchEvent(new CustomEvent('agilecert-ai-cv-open'));
    setIsOpen(false);
  };

  if (!isCandidate || !menuRoot) return null;

  return createPortal(
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition ${
          isOpen ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
        }`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="Open candidate tools menu"
      >
        <Wrench className="h-3.5 w-3.5 text-violet-300" />
        <span className="hidden xl:inline">Tools</span>
        <ChevronDown className={`h-3.5 w-3.5 transition ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+0.6rem)] z-[120] w-64 overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 p-2 text-white shadow-2xl"
        >
          <p className="px-3 pb-2 pt-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
            Candidate tools
          </p>
          <button
            type="button"
            role="menuitem"
            onClick={openCredentialStore}
            className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-slate-800"
          >
            <span className="rounded-lg bg-emerald-400/10 p-2 text-emerald-300">
              <ShoppingBag className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-xs font-black">Credential Store</span>
              <span className="mt-1 block text-[11px] leading-5 text-slate-400">
                Certificate offers, payments and issued credentials
              </span>
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={openAiCvStudio}
            className="mt-1 flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-slate-800"
          >
            <span className="rounded-lg bg-violet-400/10 p-2 text-violet-300">
              <Sparkles className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-xs font-black">AI CV Studio</span>
              <span className="mt-1 block text-[11px] leading-5 text-slate-400">
                Review private, fact-grounded CV suggestions
              </span>
            </span>
          </button>
        </div>
      )}
    </div>,
    menuRoot,
  );
}

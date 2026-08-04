import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BookOpenCheck,
  CheckCircle2,
  GraduationCap,
  Layers3,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import {
  AGILE_PROGRAMME_CATALOGUE,
  AGILE_PROGRAMME_CATEGORIES,
  AGILE_PROGRAMME_LEVELS,
  type AgileProgrammeCategory,
  type AgileProgrammeLevel,
} from '../data/agileProgrammeCatalogue';

const categoryLabels: Record<AgileProgrammeCategory, string> = {
  'Agile Project Management, Product and Delivery Certifications': 'Project, Product & Delivery',
  'Agile Human Resource Management Certifications': 'Agile HRM',
  'Agile Leadership Certifications': 'Agile Leadership',
};

const levelClasses: Record<AgileProgrammeLevel, string> = {
  Foundation: 'border-blue-200 bg-blue-50 text-blue-700',
  Associate: 'border-amber-200 bg-amber-50 text-amber-700',
  Professional: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  Specialist: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700',
  Executive: 'border-rose-200 bg-rose-50 text-rose-700',
};

const OPEN_CATALOGUE_EVENT = 'agilecert:open-certification-programmes';

export default function AgileProgrammeCatalogue() {
  const [menuRoot, setMenuRoot] = useState<HTMLElement | null>(null);
  const [hasPublicNavigation, setHasPublicNavigation] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<AgileProgrammeCategory>(
    AGILE_PROGRAMME_CATEGORIES[0],
  );
  const [activeLevel, setActiveLevel] = useState<AgileProgrammeLevel | 'All'>('All');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const attach = () => {
      const publicNavigation = document.querySelector<HTMLElement>(
        '[data-agilecert-public-navigation="true"]',
      );
      setHasPublicNavigation(Boolean(publicNavigation));

      const nav = document.querySelector<HTMLElement>(
        'header nav:not([data-agilecert-public-navigation="true"])',
      );
      if (!nav) {
        setMenuRoot(null);
        return;
      }

      let mount = nav.querySelector<HTMLElement>('[data-agilecert-programme-catalogue-mount="true"]');
      if (!mount) {
        mount = document.createElement('div');
        mount.dataset.agilecertProgrammeCatalogueMount = 'true';
        mount.className = 'relative';
        nav.appendChild(mount);
      }
      setMenuRoot(mount);
    };

    attach();
    const observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const openCatalogue = () => setIsOpen(true);
    window.addEventListener(OPEN_CATALOGUE_EVENT, openCatalogue);
    return () => window.removeEventListener(OPEN_CATALOGUE_EVENT, openCatalogue);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  const filteredProgrammes = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return AGILE_PROGRAMME_CATALOGUE.filter((programme) => {
      if (programme.category !== activeCategory) return false;
      if (activeLevel !== 'All' && programme.level !== activeLevel) return false;
      if (!query) return true;
      return [programme.code, programme.title, programme.summary, programme.level]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [activeCategory, activeLevel, searchTerm]);

  const launcher = (
    <button
      type="button"
      onClick={() => setIsOpen(true)}
      className={
        menuRoot
          ? 'flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-slate-400 transition hover:bg-slate-800 hover:text-white'
          : 'fixed bottom-5 right-5 z-[240] flex items-center gap-2 rounded-full bg-slate-950 px-4 py-3 text-sm font-black text-white shadow-2xl ring-1 ring-white/10 transition hover:-translate-y-0.5 hover:bg-slate-800'
      }
      aria-label="Open Certification Programmes"
    >
      <GraduationCap className={menuRoot ? 'h-3.5 w-3.5 text-cyan-300' : 'h-5 w-5 text-cyan-300'} />
      <span>Certification Programmes</span>
    </button>
  );

  const shouldRenderLauncher = Boolean(menuRoot) || !hasPublicNavigation;

  return (
    <>
      {shouldRenderLauncher && (menuRoot ? createPortal(launcher, menuRoot) : launcher)}

      {isOpen &&
        createPortal(
          <div className="fixed inset-0 z-[260] overflow-y-auto bg-slate-950/75 p-3 backdrop-blur-sm sm:p-6">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="agile-programme-catalogue-title"
              className="mx-auto flex min-h-[calc(100vh-1.5rem)] w-full max-w-7xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 shadow-2xl sm:min-h-[calc(100vh-3rem)]"
            >
              <header className="border-b border-slate-200 bg-white px-5 py-5 sm:px-8">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <span className="rounded-2xl bg-cyan-50 p-3 text-cyan-700">
                      <GraduationCap className="h-7 w-7" />
                    </span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 id="agile-programme-catalogue-title" className="text-xl font-black text-slate-950 sm:text-2xl">
                          AgileCert Certification Catalogue
                        </h2>
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-amber-700">
                          Preview
                        </span>
                      </div>
                      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                        Review the proposed Agile Project, Agile HRM and Agile Leadership certification pathways before examination, pricing and enrolment activation.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                    aria-label="Close AgileCert certification catalogue"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="mt-5 grid gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950 md:grid-cols-[auto_1fr]">
                  <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-700" />
                  <p className="leading-6">
                    <strong>Controlled catalogue release:</strong> this screen is read-only. It does not create examinations, publish question banks, set fees, accept payments or issue certificate entitlements.
                  </p>
                </div>
              </header>

              <div className="flex-1 px-5 py-5 sm:px-8">
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_19rem]">
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {AGILE_PROGRAMME_CATEGORIES.map((category) => {
                      const count = AGILE_PROGRAMME_CATALOGUE.filter((programme) => programme.category === category).length;
                      const active = activeCategory === category;
                      return (
                        <button
                          key={category}
                          type="button"
                          onClick={() => {
                            setActiveCategory(category);
                            setActiveLevel('All');
                          }}
                          className={`min-w-max rounded-xl border px-4 py-3 text-left text-xs font-black transition ${
                            active
                              ? 'border-slate-900 bg-slate-900 text-white shadow-lg'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-950'
                          }`}
                        >
                          {categoryLabels[category]}
                          <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] ${active ? 'bg-white/15' : 'bg-slate-100'}`}>
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <label className="relative block">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Search code or programme"
                      className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                    />
                  </label>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="mr-1 flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                    <Layers3 className="h-4 w-4" /> Level
                  </span>
                  {(['All', ...AGILE_PROGRAMME_LEVELS] as const).map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setActiveLevel(level)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                        activeLevel === level
                          ? 'border-cyan-700 bg-cyan-700 text-white'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-cyan-300 hover:text-cyan-800'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>

                <div className="mt-6 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-black text-slate-950">{categoryLabels[activeCategory]}</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {filteredProgrammes.length} programme{filteredProgrammes.length === 1 ? '' : 's'} shown
                    </p>
                  </div>
                  <span className="hidden items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-600 shadow-sm sm:flex">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Academic review pending
                  </span>
                </div>

                {filteredProgrammes.length > 0 ? (
                  <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {filteredProgrammes.map((programme) => (
                      <article key={programme.code} className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <span className="rounded-lg bg-slate-950 px-2.5 py-1 font-mono text-[11px] font-black tracking-wide text-white">
                            {programme.code}
                          </span>
                          <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${levelClasses[programme.level]}`}>
                            {programme.level}
                          </span>
                        </div>
                        <h4 className="mt-4 text-base font-black leading-6 text-slate-950">{programme.title}</h4>
                        <p className="mt-3 flex-1 text-sm leading-6 text-slate-600">{programme.summary}</p>
                        <div className="mt-5 flex items-center gap-2 border-t border-slate-100 pt-4 text-xs font-bold text-slate-500">
                          <BookOpenCheck className="h-4 w-4 text-cyan-600" />
                          Catalogue preview only
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
                    <Search className="mx-auto h-8 w-8 text-slate-300" />
                    <p className="mt-3 font-bold text-slate-700">No programmes match the selected filters.</p>
                  </div>
                )}
              </div>

              <footer className="border-t border-slate-200 bg-white px-5 py-4 sm:px-8">
                <div className="flex flex-col gap-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    Existing portal services remain unchanged.
                  </span>
                  <span>{AGILE_PROGRAMME_CATALOGUE.length} proposed programmes across 3 certification categories.</span>
                </div>
              </footer>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

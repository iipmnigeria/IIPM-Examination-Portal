import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Globe2,
  GraduationCap,
  Layers3,
  MessageCircle,
  ShieldCheck,
  Target,
} from 'lucide-react';
import LoginPortal from './LoginPortal';

interface AgileCertPhaseOneLandingPageProps {
  onLoginSuccess: (name: string, role: 'student' | 'admin') => void;
}

const specialistAreas = [
  {
    title: 'Project Risk & Quality Management',
    description:
      'Demonstrate focused competence in project uncertainty, quality planning, assurance and control.',
    icon: ShieldCheck,
  },
  {
    title: 'Project Planning & Schedule Management',
    description:
      'Validate competence in work breakdown, scheduling logic, dependencies, critical paths and schedule control.',
    icon: BarChart3,
  },
  {
    title: 'Project Communication & Information Management',
    description:
      'Assess practical communication planning, reporting, information flow and stakeholder engagement.',
    icon: MessageCircle,
  },
  {
    title: 'Agile Project Management',
    description:
      'Show applied understanding of adaptive delivery, agile roles, iteration, value and team collaboration.',
    icon: Layers3,
  },
  {
    title: 'Procurement & Contract Management',
    description:
      'Validate specialist knowledge in sourcing, contracting, supplier governance and performance control.',
    icon: ClipboardCheck,
  },
  {
    title: 'Performance and People Management',
    description:
      'Demonstrate practical competence in performance systems, workforce metrics and management decisions.',
    icon: Target,
  },
];

const processSteps = [
  {
    number: '01',
    title: 'Choose a specialist examination',
    description:
      'Select the focused professional competency that supports your career or development goal.',
  },
  {
    number: '02',
    title: 'Register and pay the examination fee',
    description:
      'Create a candidate account and complete the existing secure examination-payment process.',
  },
  {
    number: '03',
    title: 'Prepare and take the examination',
    description:
      'Access the current candidate workspace and complete the timed assessment under integrity controls.',
  },
  {
    number: '04',
    title: 'Receive your result',
    description:
      'The portal grades the examination and records your result in the existing candidate dashboard.',
  },
];

function scrollToCandidateAccess() {
  document.getElementById('candidate-access')?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  });
}

export default function AgileCertPhaseOneLandingPage({
  onLoginSuccess,
}: AgileCertPhaseOneLandingPageProps) {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/95 text-white backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 md:px-6">
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-3 text-left"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 shadow-inner">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-black uppercase tracking-[0.16em] text-emerald-400">
                AgileCert Global
              </p>
              <p className="text-[10px] font-bold text-slate-400">Powered by IIPM</p>
            </div>
          </button>

          <nav className="hidden items-center gap-6 text-xs font-bold text-slate-300 lg:flex">
            <a href="#certifications" className="hover:text-white">
              Certifications
            </a>
            <a href="#how-it-works" className="hover:text-white">
              How It Works
            </a>
            <a href="#positioning" className="hover:text-white">
              About AgileCert
            </a>
          </nav>

          <button
            type="button"
            onClick={scrollToCandidateAccess}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white transition hover:bg-emerald-700"
          >
            Candidate Access <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden bg-slate-950 text-white">
          <div className="absolute inset-0 opacity-40">
            <div className="absolute -left-32 top-10 h-80 w-80 rounded-full bg-emerald-600/30 blur-3xl" />
            <div className="absolute -right-24 bottom-0 h-96 w-96 rounded-full bg-blue-700/20 blur-3xl" />
          </div>

          <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-20 md:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:py-28">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-emerald-300">
                <Globe2 className="h-4 w-4" /> Focused professional examinations worldwide
              </div>

              <h1 className="mt-7 max-w-4xl text-4xl font-black leading-[1.06] tracking-tight md:text-6xl">
                Demonstrate focused professional competence through specialist examinations.
              </h1>

              <p className="mt-6 max-w-3xl text-base leading-8 text-slate-300 md:text-lg">
                AgileCert Global is an examination-led specialist credential platform powered by IIPM. It gives professionals access to focused modular examinations in practical competency areas.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={scrollToCandidateAccess}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3.5 text-sm font-black text-white shadow-xl shadow-emerald-950/40 transition hover:bg-emerald-700"
                >
                  Register or Sign In <ArrowRight className="h-4 w-4" />
                </button>
                <a
                  href="#certifications"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-6 py-3.5 text-sm font-black text-white transition hover:border-slate-500 hover:bg-slate-800"
                >
                  Explore Specialist Areas <BookOpen className="h-4 w-4 text-emerald-400" />
                </a>
              </div>

              <div className="mt-10 grid gap-4 sm:grid-cols-3">
                {[
                  ['Examination-led', 'Training is not compulsory'],
                  ['Globally accessible', 'Available to candidates internationally'],
                  ['Powered by IIPM', 'Independent specialist assessment platform'],
                ].map(([title, caption]) => (
                  <div key={title} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                    <p className="text-sm font-black text-white">{title}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">{caption}</p>
                  </div>
                ))}
              </div>
            </div>

            <aside className="self-center rounded-3xl border border-slate-700 bg-white p-6 text-slate-900 shadow-2xl md:p-8">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
                Phase 1 candidate journey
              </p>
              <h2 className="mt-2 text-2xl font-black">Use the existing secure examination portal</h2>

              <div className="mt-7 space-y-4">
                {[
                  'Create or access your candidate account',
                  'Select an available specialist examination',
                  'Complete the current secure examination payment',
                  'Take the examination and receive your result',
                ].map((item, index) => (
                  <div key={item} className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-sm font-black text-emerald-700">
                      {index + 1}
                    </div>
                    <p className="pt-1 text-sm font-bold leading-6 text-slate-700">{item}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-900">
                <strong>Fee disclosure:</strong> the examination fee covers examination access under the current portal process. Optional certificate products and certificate fees will be introduced and tested in a later implementation phase.
              </div>
            </aside>
          </div>
        </section>

        <section id="certifications" className="scroll-mt-24 bg-white py-20">
          <div className="mx-auto max-w-7xl px-4 md:px-6">
            <div className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-700">
                Specialist examination areas
              </p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
                Build competence one focused area at a time
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-600">
                AgileCert Global is intended for modular, niche and specialised competencies. Full training-led professional certification pathways remain within the IIPM professional ecosystem.
              </p>
            </div>

            <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {specialistAreas.map(({ title, description, icon: Icon }) => (
                <article
                  key={title}
                  className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-emerald-300 hover:shadow-xl"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 transition group-hover:bg-emerald-600 group-hover:text-white">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-5 text-lg font-black text-slate-950">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
                  <button
                    type="button"
                    onClick={scrollToCandidateAccess}
                    className="mt-5 inline-flex items-center gap-1 text-xs font-black uppercase tracking-wider text-emerald-700 hover:underline"
                  >
                    Open candidate access <ArrowRight className="h-4 w-4" />
                  </button>
                </article>
              ))}
            </div>

            <div className="mt-8 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm leading-6 text-blue-900">
              AgileCert Global examinations are independently developed and delivered by AgileCert Global, powered by IIPM. References to external frameworks or certification bodies do not imply affiliation, authorisation, endorsement or equivalence.
            </div>
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-24 bg-slate-50 py-20">
          <div className="mx-auto max-w-7xl px-4 md:px-6">
            <div className="text-center">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-700">
                How it works
              </p>
              <h2 className="mt-3 text-3xl font-black text-slate-950 md:text-4xl">
                A simple specialist examination pathway
              </h2>
            </div>

            <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {processSteps.map((step) => (
                <article key={step.number} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <span className="text-4xl font-black text-emerald-100">{step.number}</span>
                  <h3 className="mt-3 text-base font-black text-slate-950">{step.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{step.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="positioning" className="scroll-mt-24 bg-slate-950 py-20 text-white">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 md:px-6 lg:grid-cols-2">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400">
                Complementary platforms
              </p>
              <h2 className="mt-3 text-3xl font-black md:text-4xl">
                AgileCert for specialist examinations. IIPM for full professional programmes.
              </h2>
              <p className="mt-5 text-sm leading-7 text-slate-300">
                AgileCert Global provides focused modular examination opportunities. IIPM continues to provide complete training-led professional pathways such as PMFC, CPMA and CPMP.
              </p>
              <a
                href="https://iipmi.org"
                target="_blank"
                rel="noreferrer"
                className="mt-7 inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-5 py-3 text-sm font-black text-white hover:border-emerald-500 hover:bg-slate-800"
              >
                Explore IIPM Programmes <ArrowRight className="h-4 w-4 text-emerald-400" />
              </a>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {[
                ['AgileCert Global', 'Focused modular examinations'],
                ['IIPM Ecosystem', 'Complete training-led pathways'],
                ['Independent identity', 'Clear product and payment positioning'],
                ['Future integration', 'Shared verification can be introduced later'],
              ].map(([title, caption]) => (
                <article key={title} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                  <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                  <h3 className="mt-4 font-black">{title}</h3>
                  <p className="mt-2 text-xs leading-5 text-slate-400">{caption}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="candidate-access" className="scroll-mt-20 bg-slate-50 py-10">
          <div className="mx-auto max-w-7xl px-4 md:px-6">
            <div className="grid items-start gap-10 lg:grid-cols-[0.8fr_1.2fr]">
              <div className="pt-10 lg:sticky lg:top-28">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-700">
                  Candidate access
                </p>
                <h2 className="mt-3 text-3xl font-black text-slate-950">
                  Register or continue to your existing examination workspace
                </h2>
                <p className="mt-4 text-sm leading-7 text-slate-600">
                  Phase 1 changes the public identity and entry experience only. The current registration, authentication, examination catalogue, payment and assessment functions remain unchanged.
                </p>

                <div className="mt-6 space-y-3 text-sm font-semibold text-slate-700">
                  {[
                    'Existing Supabase registration and sign-in',
                    'Existing examination catalogue',
                    'Existing examination payment controls',
                    'Existing secured assessment and result records',
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
                <LoginPortal onLoginSuccess={onLoginSuccess} />
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-800 bg-slate-950 py-10 text-slate-400">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 text-xs leading-6 md:flex-row md:items-center md:justify-between md:px-6">
          <div>
            <p className="font-black uppercase tracking-[0.16em] text-emerald-400">AgileCert Global</p>
            <p>Focused professional examinations. Powered by IIPM.</p>
          </div>
          <p>© 2026 Integrated Institute of Professional Management. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

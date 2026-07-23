import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Award,
  BadgeCheck,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileCheck2,
  Globe2,
  GraduationCap,
  Layers3,
  Link2,
  MessageCircle,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  TimerReset,
  Users,
} from 'lucide-react';
import LoginPortal from './LoginPortal';

interface AgileCertPublicLandingPageProps {
  onLoginSuccess: (name: string, role: 'student' | 'admin') => void;
}

const specialistAreas = [
  {
    title: 'Project Risk & Quality Management',
    description: 'Demonstrate focused competence in project uncertainty, quality planning, assurance and control.',
    icon: ShieldCheck,
  },
  {
    title: 'Project Planning & Schedule Management',
    description: 'Validate competence in scope decomposition, scheduling logic, dependencies, CPM and schedule control.',
    icon: BarChart3,
  },
  {
    title: 'Project Communication & Information Management',
    description: 'Assess practical communication planning, reporting, information flow and stakeholder engagement.',
    icon: MessageCircle,
  },
  {
    title: 'Agile Project Management',
    description: 'Show applied understanding of adaptive delivery, agile roles, iteration, value and team collaboration.',
    icon: Layers3,
  },
  {
    title: 'Procurement & Contract Management',
    description: 'Validate specialist knowledge in sourcing, contracting, supplier governance and performance control.',
    icon: ClipboardCheck,
  },
  {
    title: 'HR Analytics & Performance Management',
    description: 'Demonstrate practical competence in workforce data, metrics, performance systems and decision support.',
    icon: Target,
  },
];

const processSteps = [
  {
    number: '01',
    title: 'Choose a specialist examination',
    description: 'Select the focused competency that supports your career or professional development goal.',
  },
  {
    number: '02',
    title: 'Pay and access preparation resources',
    description: 'Verified examination payment unlocks available preparation PDFs and your secured examination access.',
  },
  {
    number: '03',
    title: 'Take the secured examination',
    description: 'Complete the timed assessment under integrity controls and receive an automatically graded result.',
  },
  {
    number: '04',
    title: 'Pass, certify and share',
    description: 'After passing, choose a certificate, receive a badge and share the verifiable credential on LinkedIn.',
  },
];

function scrollToAccess() {
  document.getElementById('candidate-access')?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  });
}

export default function AgileCertPublicLandingPage({
  onLoginSuccess,
}: AgileCertPublicLandingPageProps) {
  const [verificationCode, setVerificationCode] = useState('');
  const [recommendedExamId, setRecommendedExamId] = useState<string | null>(null);

  useEffect(() => {
    const handleRecommendation = (event: Event) => {
      const customEvent = event as CustomEvent<{ examinationId?: string }>;
      const examinationId = customEvent.detail?.examinationId || null;
      setRecommendedExamId(examinationId);
      scrollToAccess();
    };

    window.addEventListener('agilecert-recommended-examination', handleRecommendation);
    return () => {
      window.removeEventListener('agilecert-recommended-examination', handleRecommendation);
    };
  }, []);

  const verifyCredential = () => {
    const code = verificationCode.trim();
    if (!code) return;
    const url = new URL(window.location.href);
    url.searchParams.set('verify', code);
    window.location.assign(url.toString());
  };

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
              <BadgeCheck className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-black uppercase tracking-[0.16em] text-emerald-400">
                AgileCert Global
              </p>
              <p className="text-[10px] font-bold text-slate-400">Powered by IIPM</p>
            </div>
          </button>

          <nav className="hidden items-center gap-6 text-xs font-bold text-slate-300 lg:flex">
            <a href="#specialist-certifications" className="hover:text-white">Certifications</a>
            <a href="#how-it-works" className="hover:text-white">How It Works</a>
            <a href="#credentials" className="hover:text-white">Credentials</a>
            <a href="#verify-credential" className="hover:text-white">Verify</a>
            <a href="#iipm-pathway" className="hover:text-white">IIPM Pathway</a>
          </nav>

          <button
            type="button"
            onClick={scrollToAccess}
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
                <Globe2 className="h-4 w-4" /> Modular professional credentials worldwide
              </div>
              <h1 className="mt-7 max-w-4xl text-4xl font-black leading-[1.06] tracking-tight md:text-6xl">
                Prove focused professional competence—without compulsory classroom training.
              </h1>
              <p className="mt-6 max-w-3xl text-base leading-8 text-slate-300 md:text-lg">
                Take independent specialist examinations, access preparation resources and earn verifiable certificates and digital badges in targeted professional competency areas.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={scrollToAccess}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3.5 text-sm font-black text-white shadow-xl shadow-emerald-950/40 transition hover:bg-emerald-700"
                >
                  Explore and Register <ArrowRight className="h-4 w-4" />
                </button>
                <a
                  href="#verify-credential"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-6 py-3.5 text-sm font-black text-white transition hover:border-slate-500 hover:bg-slate-800"
                >
                  Verify a Credential <ShieldCheck className="h-4 w-4 text-emerald-400" />
                </a>
              </div>

              <div className="mt-10 grid gap-4 sm:grid-cols-3">
                {[
                  ['Examination-led', 'Training is optional'],
                  ['Globally accessible', 'NGN and USD pathways'],
                  ['Verifiable credentials', 'Certificate, badge and QR'],
                ].map(([title, caption]) => (
                  <div key={title} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                    <p className="text-sm font-black text-white">{title}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">{caption}</p>
                  </div>
                ))}
              </div>
            </div>

            <aside className="self-center rounded-3xl border border-slate-700 bg-white p-6 text-slate-900 shadow-2xl md:p-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
                    Your credential journey
                  </p>
                  <h2 className="mt-2 text-2xl font-black">One focused skill at a time</h2>
                </div>
                <Sparkles className="h-9 w-9 text-amber-500" />
              </div>

              <div className="mt-7 space-y-4">
                {[
                  ['Choose', 'Select a specialist modular examination.', BookOpen],
                  ['Prepare', 'Download available PDFs after exam payment.', FileCheck2],
                  ['Demonstrate', 'Pass a secured competency assessment.', ClipboardCheck],
                  ['Credential', 'Purchase a certificate and receive a badge.', Award],
                ].map(([title, description, Icon], index) => (
                  <div key={String(title)} className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-950">
                        {index + 1}. {String(title)}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{String(description)}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-900">
                <strong>Important:</strong> Examination payment covers examination access and available preparation materials. Certificate issuance is optional and attracts a separate fee after passing.
              </div>
            </aside>
          </div>
        </section>

        <section id="specialist-certifications" className="scroll-mt-24 bg-white py-20">
          <div className="mx-auto max-w-7xl px-4 md:px-6">
            <div className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-700">Specialist certifications</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
                Build a portfolio of targeted, stackable competencies
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-600">
                AgileCert Global focuses on niche professional areas rather than replacing IIPM’s complete training-led professional certification pathways.
              </p>
            </div>

            <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {specialistAreas.map(({ title, description, icon: Icon }) => (
                <article key={title} className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-emerald-300 hover:shadow-xl">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 transition group-hover:bg-emerald-600 group-hover:text-white">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-5 text-lg font-black text-slate-950">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
                  <button
                    type="button"
                    onClick={scrollToAccess}
                    className="mt-5 inline-flex items-center gap-1 text-xs font-black uppercase tracking-wider text-emerald-700 hover:underline"
                  >
                    View available examinations <ChevronRight className="h-4 w-4" />
                  </button>
                </article>
              ))}
            </div>

            <div className="mt-8 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm leading-6 text-blue-900">
              AgileCert Global examinations are independently developed and issued by AgileCert Global, powered by IIPM. References to external frameworks or certification organisations are for educational and competency-mapping purposes only and do not imply affiliation, authorisation, endorsement or equivalence.
            </div>
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-24 bg-slate-50 py-20">
          <div className="mx-auto max-w-7xl px-4 md:px-6">
            <div className="text-center">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-700">How it works</p>
              <h2 className="mt-3 text-3xl font-black text-slate-950 md:text-4xl">Designed for fast, independent certification</h2>
            </div>

            <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {processSteps.map((step) => (
                <article key={step.number} className="relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <span className="text-4xl font-black text-emerald-100">{step.number}</span>
                  <h3 className="mt-3 text-base font-black text-slate-950">{step.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{step.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="credentials" className="scroll-mt-24 bg-white py-20">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 md:px-6 lg:grid-cols-2">
            <article className="rounded-3xl border border-slate-200 bg-slate-50 p-7 md:p-9">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-100 text-teal-700">
                <Award className="h-6 w-6" />
              </div>
              <h2 className="mt-5 text-2xl font-black text-slate-950">Certificate of Achievement</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Verifies that the candidate met the pass mark in the selected specialist examination.
              </p>
              <ul className="mt-5 space-y-3 text-sm font-semibold text-slate-700">
                {[
                  'Digital PDF certificate',
                  'Unique credential number',
                  'QR-linked public verification',
                  'Achievement digital badge',
                  'LinkedIn-ready credential details',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> {item}
                  </li>
                ))}
              </ul>
              <p className="mt-6 rounded-xl bg-white p-4 text-xs font-bold leading-6 text-slate-600">
                Nigeria: ₦20,000 within 7 days, then ₦25,000. International: $35 within 7 days, then $50.
              </p>
            </article>

            <article className="rounded-3xl border border-emerald-300 bg-slate-950 p-7 text-white shadow-xl md:p-9">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white">
                <BadgeCheck className="h-6 w-6" />
              </div>
              <h2 className="mt-5 text-2xl font-black">Professional Certificate</h2>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                A higher-assurance professional credential requiring identity verification and examination-integrity clearance.
              </p>
              <ul className="mt-5 space-y-3 text-sm font-semibold text-slate-200">
                {[
                  'Everything in the Achievement credential',
                  'Government-issued identity verification',
                  'AI-proctor integrity clearance',
                  'Formal examination transcript',
                  'Enhanced professional digital badge',
                  'Public professional credential profile',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /> {item}
                  </li>
                ))}
              </ul>
              <p className="mt-6 rounded-xl border border-slate-700 bg-slate-900 p-4 text-xs font-bold leading-6 text-slate-300">
                Nigeria: ₦50,000 within 7 days, then ₦75,000. International: $60 within 7 days, then $75.
              </p>
            </article>
          </div>
        </section>

        <section id="verify-credential" className="scroll-mt-24 bg-emerald-700 py-16 text-white">
          <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 md:px-6 lg:grid-cols-[0.85fr_1.15fr]">
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
                <ShieldCheck className="h-7 w-7" />
              </div>
              <h2 className="mt-5 text-3xl font-black">Verify an AgileCert credential</h2>
              <p className="mt-3 text-sm leading-7 text-emerald-100">
                Confirm the credential holder, title, issue date, status and achievement evidence using the unique verification code.
              </p>
            </div>

            <div className="rounded-2xl bg-white p-4 shadow-xl md:p-5">
              <label className="text-xs font-black uppercase tracking-wider text-slate-500">
                Credential code or verification reference
              </label>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={verificationCode}
                    onChange={(event) => setVerificationCode(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') verifyCredential();
                    }}
                    placeholder="Enter verification reference"
                    className="w-full rounded-xl border border-slate-300 py-3 pl-10 pr-4 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
                <button
                  type="button"
                  onClick={verifyCredential}
                  disabled={!verificationCode.trim()}
                  className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Verify Credential
                </button>
              </div>
            </div>
          </div>
        </section>

        <section id="iipm-pathway" className="scroll-mt-24 bg-slate-950 py-20 text-white">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 md:px-6 lg:grid-cols-2">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400">Two complementary pathways</p>
              <h2 className="mt-3 text-3xl font-black md:text-4xl">AgileCert for specialist competence. IIPM for full professional development.</h2>
              <p className="mt-5 text-sm leading-7 text-slate-300">
                AgileCert Global provides focused modular examinations. The IIPM professional ecosystem provides comprehensive training, assignments, examinations, membership and professional progression through programmes such as PMFC, CPMA and CPMP.
              </p>
              <a
                href="https://iipmi.org"
                target="_blank"
                rel="noreferrer"
                className="mt-7 inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-5 py-3 text-sm font-black text-white hover:border-emerald-500 hover:bg-slate-800"
              >
                Explore IIPM Full Programmes <Link2 className="h-4 w-4 text-emerald-400" />
              </a>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {[
                ['AgileCert Global', 'Focused modular examinations', TimerReset, 'Training optional · faster specialist credential'],
                ['IIPM Ecosystem', 'Complete professional pathways', GraduationCap, 'Structured training · membership · progression'],
                ['Shared verification', 'Trusted credential evidence', ShieldCheck, 'QR verification · status · achievement record'],
                ['Cross-progression', 'Build from specialist to professional', Users, 'Move between complementary learning pathways'],
              ].map(([title, subtitle, Icon, caption]) => (
                <article key={String(title)} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                  <Icon className="h-6 w-6 text-emerald-400" />
                  <h3 className="mt-4 font-black">{String(title)}</h3>
                  <p className="mt-1 text-xs font-bold text-slate-300">{String(subtitle)}</p>
                  <p className="mt-3 text-xs leading-5 text-slate-500">{String(caption)}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="candidate-access" className="scroll-mt-20 bg-slate-50 py-10">
          <div className="mx-auto max-w-7xl px-4 md:px-6">
            <div className="grid items-start gap-10 lg:grid-cols-[0.8fr_1.2fr]">
              <div className="pt-10 lg:sticky lg:top-28">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-700">Candidate access</p>
                <h2 className="mt-3 text-3xl font-black text-slate-950">Create your profile or continue to your examination workspace</h2>
                <p className="mt-4 text-sm leading-7 text-slate-600">
                  Register with your legal name and email, select an available specialist examination and follow the secured payment, preparation and assessment journey.
                </p>

                {recommendedExamId && (
                  <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">
                    <p className="font-black">AI adviser recommendation saved</p>
                    <p className="mt-1 text-xs text-emerald-800">
                      Register or sign in to view the recommended examination in your candidate catalogue.
                    </p>
                  </div>
                )}

                <div className="mt-6 space-y-3 text-sm font-semibold text-slate-700">
                  {[
                    'Secure Supabase account and examination records',
                    'NGN or USD examination pricing',
                    'Preparation materials after verified payment',
                    'Automated results, certificate offers and credentials',
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> {item}
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
            <p>Independent specialist examinations and verifiable professional credentials. Powered by IIPM.</p>
          </div>
          <p>© 2026 Integrated Institute of Professional Management. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

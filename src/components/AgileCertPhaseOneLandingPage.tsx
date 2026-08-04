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
import AgileCertFooter from './AgileCertFooter';
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
    title: 'Register and secure your access',
    description:
      'Create your AgileCert Global account and complete payment or accept an approved sponsored opportunity.',
  },
  {
    number: '03',
    title: 'Prepare and take the examination',
    description:
      'Use your candidate workspace, available materials and the secured assessment environment.',
  },
  {
    number: '04',
    title: 'Receive your result and credential options',
    description:
      'Review your recorded result and, where eligible, proceed to available certificate and credential services.',
  },
];

const candidateCapabilities = [
  'Secure AgileCert Global account registration and sign-in',
  'Current specialist examination catalogue',
  'Protected examination payment and sponsored-access controls',
  'Secured assessment, result and credential records',
];

function scrollToCandidateAccess() {
  document.getElementById('candidate-access')?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  });
}

function openAgileCertCertificationCatalogue() {
  window.dispatchEvent(new Event('agilecert:open-certification-programmes'));
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

          <nav
            data-agilecert-public-navigation="true"
            className="hidden items-center gap-6 text-xs font-bold text-slate-300 lg:flex"
          >
            <a href="#certification-programmes" className="hover:text-white">
              Certification Programmes
            </a>
            <a href="#how-it-works" className="hover:text-white">
              How It Works
            </a>
            <a href="#positioning" className="hover:text-white">
              About AgileCert
            </a>
            <a href="#policy-privacy" className="hover:text-white">
              Policies
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
                AgileCert Global is an examination-led specialist credential platform powered by IIPM. Professionals can access focused modular examinations, secure candidate services and verifiable credential pathways from one connected workspace.
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
                  href="#certification-programmes"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-6 py-3.5 text-sm font-black text-white transition hover:border-slate-500 hover:bg-slate-800"
                >
                  Explore Certification Programmes <BookOpen className="h-4 w-4 text-emerald-400" />
                </a>
              </div>

              <div className="mt-10 grid gap-4 sm:grid-cols-3">
                {[
                  ['Examination-led', 'Training is not compulsory'],
                  ['Globally accessible', 'Available to candidates internationally'],
                  ['Connected services', 'Access, results and credentials in one workspace'],
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
                Candidate journey
              </p>
              <h2 className="mt-2 text-2xl font-black">Use one secure AgileCert Global workspace</h2>

              <div className="mt-7 space-y-4">
                {[
                  'Create or access your candidate account',
                  'Select an available specialist examination',
                  'Complete payment or accept sponsored access',
                  'Take the examination and review your result',
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
                <strong>Fee disclosure:</strong> examination and certificate or credential fees are separate unless a published offer, approved waiver or institutional sponsorship states otherwise.
              </div>
            </aside>
          </div>
        </section>

        <section id="certification-programmes" className="scroll-mt-24 bg-white py-20">
          <div className="mx-auto max-w-7xl px-4 md:px-6">
            <div className="max-w-4xl">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-700">
                Certification programmes
              </p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
                Choose the certification route that matches your professional goal
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-600">
                Explore the existing IIPM specialist certifications currently open to candidates and the separate AgileCert progressive certification pathways undergoing controlled academic review.
              </p>
            </div>

            <section className="mt-12 overflow-hidden rounded-3xl border border-emerald-200 bg-emerald-50/40 shadow-sm">
              <div className="border-b border-emerald-200 bg-white px-6 py-7 md:px-8">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                  <div className="max-w-3xl">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
                      IIPM Specialist Certification Catalogue
                    </p>
                    <h3 className="mt-2 text-2xl font-black text-slate-950 md:text-3xl">
                      Build competence one focused area at a time
                    </h3>
                    <p className="mt-3 text-sm leading-7 text-slate-600">
                      These six established IIPM specialist certification programmes retain their current examinations, candidate access and operational arrangements within AgileCert Global.
                    </p>
                  </div>
                  <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-800">
                    <CheckCircle2 className="h-4 w-4" /> 6 open specialist programmes
                  </span>
                </div>
              </div>

              <div className="grid gap-5 p-6 md:grid-cols-2 md:p-8 lg:grid-cols-3">
                {specialistAreas.map(({ title, description, icon: Icon }) => (
                  <article
                    key={title}
                    className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-emerald-300 hover:shadow-xl"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 transition group-hover:bg-emerald-600 group-hover:text-white">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h4 className="mt-5 text-lg font-black text-slate-950">{title}</h4>
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

              <div className="border-t border-blue-200 bg-blue-50 px-6 py-4 text-sm leading-6 text-blue-900 md:px-8">
                AgileCert Global examinations are independently developed and delivered by AgileCert Global, powered by IIPM. References to external frameworks or certification bodies do not imply affiliation, authorisation, endorsement or equivalence.
              </div>
            </section>

            <section className="mt-8 overflow-hidden rounded-3xl border border-cyan-800 bg-slate-950 text-white shadow-xl">
              <div className="grid gap-8 px-6 py-8 md:px-8 lg:grid-cols-[1fr_auto] lg:items-center">
                <div className="max-w-4xl">
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
                      AgileCert Certification Catalogue
                    </p>
                    <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-amber-200">
                      Catalogue preview
                    </span>
                  </div>
                  <h3 className="mt-3 text-2xl font-black md:text-3xl">
                    Progressive Agile Project, Agile HRM and Agile Leadership pathways
                  </h3>
                  <p className="mt-4 text-sm leading-7 text-slate-300">
                    Review proposed Foundation, Associate, Professional, Specialist and Executive pathways. These programmes remain separate from the six live IIPM specialist certifications and are not yet activated for examinations, pricing or enrolment.
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold text-slate-200">
                    {['Project, Product & Delivery', 'Agile HRM', 'Agile Leadership'].map((category) => (
                      <span key={category} className="rounded-full border border-slate-700 bg-slate-900 px-3 py-2">
                        {category}
                      </span>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={openAgileCertCertificationCatalogue}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-6 py-3.5 text-sm font-black text-slate-950 transition hover:bg-cyan-300"
                >
                  Open AgileCert Catalogue <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </section>
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
                AgileCert Global provides focused modular examination opportunities and connected credential services. IIPM continues to provide complete training-led professional pathways such as PMFC, CPMA and CPMP.
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
                ['Secure candidate identity', 'One account for examination and credential services'],
                ['Verifiable records', 'Results and credentials backed by authoritative records'],
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
                  Your AgileCert Global account connects registration, examination access, protected payments, secured assessments, results and available professional credential services in one candidate experience.
                </p>

                <div className="mt-6 space-y-3 text-sm font-semibold text-slate-700">
                  {candidateCapabilities.map((item) => (
                    <div key={item} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      {item}
                    </div>
                  ))}
                </div>

                <p className="mt-6 text-xs leading-6 text-slate-500">
                  By creating or using an account, you agree to the <a href="#policy-terms" className="font-bold text-emerald-700 hover:underline">Terms of Use</a>, acknowledge the <a href="#policy-privacy" className="font-bold text-emerald-700 hover:underline">Privacy Policy</a> and accept applicable examination policies.
                </p>
              </div>

              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
                <LoginPortal onLoginSuccess={onLoginSuccess} />
              </div>
            </div>
          </div>
        </section>
      </main>

      <AgileCertFooter />
    </div>
  );
}

import { BookOpenCheck, FileText, GraduationCap, History, ShieldCheck } from 'lucide-react';

type CipmnCandidateHubProps = {
  onClose: () => void;
};

const hubItems = [
  {
    title: 'Preparation Materials',
    description: 'Access the CIPMN learning and preparation resources already available to your account.',
    icon: FileText,
  },
  {
    title: 'Module Mock Examinations',
    description: 'Prepare with the existing CIPMN module mock examination catalogue and attempt rules.',
    icon: BookOpenCheck,
  },
  {
    title: 'Professional Examination',
    description: 'Your secure CIPMN examination route remains governed by the existing examination and proctoring controls.',
    icon: ShieldCheck,
  },
  {
    title: 'Results & Credentials',
    description: 'Results, certificates and professional credentials remain in their existing controlled workspaces.',
    icon: GraduationCap,
  },
  {
    title: 'Answer Review',
    description: 'Existing third-attempt remediation and answer-review rules remain unchanged.',
    icon: History,
  },
] as const;

export default function CipmnCandidateHub({ onClose }: CipmnCandidateHubProps) {
  return (
    <div className="fixed inset-0 z-[140] overflow-y-auto bg-slate-950/80 px-4 py-8 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="CIPMN candidate hub">
      <div className="mx-auto max-w-5xl overflow-hidden rounded-3xl border border-slate-700 bg-white shadow-2xl">
        <div className="bg-slate-950 px-6 py-6 text-white sm:px-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">CIPMN Candidate Hub</p>
              <h2 className="mt-2 text-2xl font-black sm:text-3xl">Your CIPMN examination workspace</h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
                A single navigation shell for CIPMN preparation, examinations, results and remediation. This hub does not change examination scoring, attempt rules, payments, entitlements or proctoring behaviour.
              </p>
            </div>
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-black text-slate-300 transition hover:bg-slate-800 hover:text-white" aria-label="Close CIPMN candidate hub">
              Close
            </button>
          </div>
        </div>

        <div className="grid gap-4 p-6 sm:grid-cols-2 sm:p-8 lg:grid-cols-3">
          {hubItems.map(({ title, description, icon: Icon }) => (
            <section key={title} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <span className="inline-flex rounded-xl bg-slate-900 p-2.5 text-emerald-300"><Icon className="h-5 w-5" /></span>
              <h3 className="mt-4 text-sm font-black text-slate-950">{title}</h3>
              <p className="mt-2 text-xs leading-5 text-slate-600">{description}</p>
              <span className="mt-4 inline-block rounded-full bg-slate-200 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-slate-600">Existing workflow preserved</span>
            </section>
          ))}
        </div>

        <div className="border-t border-slate-200 bg-amber-50 px-6 py-4 text-xs leading-5 text-amber-900 sm:px-8">
          Phase 3 establishes the hub shell only. Existing CIPMN services remain the source of truth until each route is explicitly connected and validated in a later phase.
        </div>
      </div>
    </div>
  );
}

import { BookOpenCheck, CheckCircle2, FileText, LockKeyhole } from 'lucide-react';

interface CipmnModuleHubContextProps {
  moduleTitle: string;
  materialsUnlocked: boolean;
  examUnlocked: boolean;
  onAttemptMcq?: () => void;
}

export default function CipmnModuleHubContext({
  moduleTitle,
  materialsUnlocked,
  examUnlocked,
  onAttemptMcq,
}: CipmnModuleHubContextProps) {
  const canAttemptMcq = examUnlocked && typeof onAttemptMcq === 'function';

  return (
    <section
      className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3"
      aria-label={`CIPMN module hub for ${moduleTitle}`}
      data-agilecert-cipmn-module-hub="true"
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Module Hub</p>
          <p className="text-xs font-semibold text-slate-700">{moduleTitle}</p>
        </div>
        <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-500">
          Preparation & Assessment
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
            <BookOpenCheck className="h-3.5 w-3.5" /> Materials
          </div>
          <p className="mt-1 text-[10px] text-slate-500">
            {materialsUnlocked ? 'Available for this module' : 'Available after payment'}
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
            {examUnlocked ? <FileText className="h-3.5 w-3.5" /> : <LockKeyhole className="h-3.5 w-3.5" />} MCQs
          </div>
          <button
            type="button"
            disabled={!canAttemptMcq}
            onClick={canAttemptMcq ? onAttemptMcq : undefined}
            className="mt-2 w-full rounded-md border border-slate-200 bg-slate-900 px-2 py-1.5 text-[10px] font-bold text-white transition enabled:hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            data-agilecert-cipmn-attempt-mcq="true"
          >
            {examUnlocked ? 'Attempt MCQs Now' : 'MCQs Locked'}
          </button>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
            <LockKeyhole className="h-3.5 w-3.5" /> Theory
          </div>
          <p className="mt-1 text-[10px] text-slate-500">Unlock rule added in Phase 5A</p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
            <CheckCircle2 className="h-3.5 w-3.5" /> Results
          </div>
          <p className="mt-1 text-[10px] text-slate-500">Existing attempts remain authoritative</p>
        </div>
      </div>
    </section>
  );
}

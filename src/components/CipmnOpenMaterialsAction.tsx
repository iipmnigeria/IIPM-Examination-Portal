import { BookOpenCheck } from 'lucide-react';

interface CipmnOpenMaterialsActionProps {
  examinationId: string;
  locked?: boolean;
  className?: string;
}

export default function CipmnOpenMaterialsAction({
  examinationId,
  locked = false,
  className = '',
}: CipmnOpenMaterialsActionProps) {
  const openMaterials = () => {
    if (locked) return;

    window.dispatchEvent(
      new CustomEvent('agilecert-materials-open', {
        detail: { examinationId },
      }),
    );
  };

  return (
    <button
      type="button"
      onClick={openMaterials}
      disabled={locked}
      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold transition ${
        locked
          ? 'cursor-not-allowed border-amber-200 bg-amber-50 text-amber-700 opacity-80'
          : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100'
      } ${className}`}
      aria-label={locked ? 'Pay to access materials for this CIPMN module' : 'Open materials for this CIPMN module'}
    >
      <BookOpenCheck className="h-4 w-4" />
      {locked ? 'Pay to Access Materials' : 'Open Materials'}
    </button>
  );
}

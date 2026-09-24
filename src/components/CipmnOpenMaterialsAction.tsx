import { BookOpenCheck } from 'lucide-react';

interface CipmnOpenMaterialsActionProps {
  examinationId: string;
  className?: string;
}

export default function CipmnOpenMaterialsAction({
  examinationId,
  className = '',
}: CipmnOpenMaterialsActionProps) {
  const openMaterials = () => {
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
      className={`inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100 ${className}`}
      aria-label="Open materials for this CIPMN module"
    >
      <BookOpenCheck className="h-4 w-4" />
      Open Materials
    </button>
  );
}

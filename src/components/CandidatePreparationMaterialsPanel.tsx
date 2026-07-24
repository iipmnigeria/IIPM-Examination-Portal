import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpenCheck,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileText,
  FolderLock,
  Loader2,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  getMyPreparationMaterials,
  type CandidatePreparationMaterial,
  type PreparationMaterialAccessStatus,
} from '../services/preparationMaterialService';

const statusPresentation: Record<
  PreparationMaterialAccessStatus,
  { label: string; className: string; Icon: typeof LockKeyhole }
> = {
  locked: {
    label: 'Locked',
    className: 'border-amber-200 bg-amber-50 text-amber-800',
    Icon: LockKeyhole,
  },
  scheduled: {
    label: 'Scheduled',
    className: 'border-sky-200 bg-sky-50 text-sky-800',
    Icon: CalendarClock,
  },
  available: {
    label: 'Available',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    Icon: CheckCircle2,
  },
  expired: {
    label: 'Expired',
    className: 'border-slate-300 bg-slate-100 text-slate-700',
    Icon: Clock3,
  },
  revoked: {
    label: 'Revoked',
    className: 'border-rose-200 bg-rose-50 text-rose-800',
    Icon: XCircle,
  },
};

const materialTypeLabels: Record<string, string> = {
  study_guide: 'Study guide',
  workbook: 'Workbook',
  mock_exam: 'Mock examination',
  checklist: 'Checklist',
  video: 'Video resource',
  reference: 'Reference material',
  other: 'Preparation resource',
};

function formatFileSize(sizeBytes: number): string {
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) return 'Size pending';
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

interface MaterialGroup {
  examinationId: string;
  examinationTitle: string;
  programmeCode: string;
  materials: CandidatePreparationMaterial[];
}

export default function CandidatePreparationMaterialsPanel() {
  const [materials, setMaterials] = useState<CandidatePreparationMaterial[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadMaterials = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');
      setMaterials(await getMyPreparationMaterials());
    } catch (loadError: any) {
      setError(loadError?.message || 'Your preparation materials could not be loaded.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMaterials();

    const commerceRefresh = () => void loadMaterials();
    window.addEventListener('iipm-commerce-refresh', commerceRefresh);

    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      window.setTimeout(() => void loadMaterials(), 0);
    });

    return () => {
      window.removeEventListener('iipm-commerce-refresh', commerceRefresh);
      authListener.subscription.unsubscribe();
    };
  }, [loadMaterials]);

  const groups = useMemo<MaterialGroup[]>(() => {
    const grouped = new Map<string, MaterialGroup>();

    materials.forEach((material) => {
      const existing = grouped.get(material.examinationId);
      if (existing) {
        existing.materials.push(material);
        return;
      }

      grouped.set(material.examinationId, {
        examinationId: material.examinationId,
        examinationTitle: material.examinationTitle,
        programmeCode: material.programmeCode,
        materials: [material],
      });
    });

    return Array.from(grouped.values()).map((group) => ({
      ...group,
      materials: [...group.materials].sort((left, right) => left.position - right.position),
    }));
  }, [materials]);

  const availableCount = materials.filter((material) => material.accessStatus === 'available').length;
  const lockedCount = materials.filter((material) => material.accessStatus === 'locked').length;

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 md:py-10">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <header className="bg-slate-950 px-5 py-6 text-white md:px-8">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-600">
                <BookOpenCheck className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400">
                  Phase 2.3 Candidate Library
                </p>
                <h1 className="mt-1 text-2xl font-black md:text-3xl">Preparation Materials</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                  Review material availability for your AgileCert examinations. Access is derived from verified payment or an approved administrator assignment.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void loadMaterials()}
              disabled={isLoading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-black text-white transition hover:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh library
            </button>
          </div>
        </header>

        <div className="space-y-6 p-5 md:p-8">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-wider text-slate-500">Published resources</p>
              <p className="mt-2 text-2xl font-black text-slate-950">{materials.length}</p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-black uppercase tracking-wider text-emerald-700">Available</p>
              <p className="mt-2 text-2xl font-black text-emerald-900">{availableCount}</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-black uppercase tracking-wider text-amber-700">Locked</p>
              <p className="mt-2 text-2xl font-black text-amber-900">{lockedCount}</p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm leading-6 text-sky-950">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-sky-700" aria-hidden="true" />
            <p>
              Phase 2.3 records entitlement and version metadata only. Secure file links and audited downloads will activate in Phase 2.4; storage paths are not exposed in this library.
            </p>
          </div>

          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-slate-500">
              <Loader2 className="h-9 w-9 animate-spin text-emerald-600" />
              <p className="text-sm font-bold">Checking verified preparation-material entitlements...</p>
            </div>
          ) : groups.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 text-center">
              <FolderLock className="h-12 w-12 text-slate-400" aria-hidden="true" />
              <h2 className="mt-4 text-lg font-black text-slate-900">No published materials yet</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
                Published preparation materials mapped to your examination catalogue will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="space-y-7">
              {groups.map((group) => (
                <section key={group.examinationId} className="overflow-hidden rounded-3xl border border-slate-200">
                  <header className="flex flex-col justify-between gap-2 border-b border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
                        {group.programmeCode}
                      </p>
                      <h2 className="mt-1 font-black text-slate-950">{group.examinationTitle}</h2>
                    </div>
                    <p className="text-xs font-bold text-slate-500">
                      {group.materials.length} resource{group.materials.length === 1 ? '' : 's'}
                    </p>
                  </header>

                  <div className="grid gap-4 p-4 lg:grid-cols-2">
                    {group.materials.map((material) => {
                      const presentation = statusPresentation[material.accessStatus];
                      const StatusIcon = presentation.Icon;
                      const scheduledTime = formatDate(material.availableFrom);
                      const expiryTime = formatDate(material.expiresAt);

                      return (
                        <article
                          key={`${material.examinationId}-${material.materialId}`}
                          className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3">
                              <div className="rounded-xl bg-slate-100 p-2.5 text-slate-700">
                                <FileText className="h-5 w-5" aria-hidden="true" />
                              </div>
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className="font-black text-slate-950">{material.title}</h3>
                                  {material.isRequired && (
                                    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-rose-700">
                                      Required
                                    </span>
                                  )}
                                </div>
                                <p className="mt-1 text-xs font-bold text-slate-500">
                                  {materialTypeLabels[material.materialType] || materialTypeLabels.other}
                                </p>
                              </div>
                            </div>

                            <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${presentation.className}`}>
                              <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />
                              {presentation.label}
                            </span>
                          </div>

                          {material.description && (
                            <p className="mt-4 text-sm leading-6 text-slate-600">{material.description}</p>
                          )}

                          <dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-xs">
                            <div>
                              <dt className="font-black uppercase tracking-wider text-slate-400">Version</dt>
                              <dd className="mt-1 font-bold text-slate-700">{material.versionLabel}</dd>
                            </div>
                            <div>
                              <dt className="font-black uppercase tracking-wider text-slate-400">File size</dt>
                              <dd className="mt-1 font-bold text-slate-700">{formatFileSize(material.sizeBytes)}</dd>
                            </div>
                          </dl>

                          {material.unlockReason && (
                            <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
                              {material.unlockReason}
                            </p>
                          )}

                          {material.accessStatus === 'scheduled' && scheduledTime && (
                            <p className="mt-3 text-xs font-bold text-sky-700">Available from {scheduledTime}</p>
                          )}
                          {material.accessStatus === 'available' && expiryTime && (
                            <p className="mt-3 text-xs font-bold text-amber-700">Access expires {expiryTime}</p>
                          )}

                          <div className="mt-auto pt-5">
                            <button
                              type="button"
                              disabled
                              className={`w-full rounded-xl px-4 py-3 text-sm font-black ${
                                material.accessStatus === 'available'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-100 text-slate-500'
                              } cursor-not-allowed`}
                            >
                              {material.accessStatus === 'available'
                                ? 'Secure delivery activates in Phase 2.4'
                                : 'Material access unavailable'}
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

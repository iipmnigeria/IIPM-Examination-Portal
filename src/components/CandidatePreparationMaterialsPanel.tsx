import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpenCheck,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  Filter,
  FolderLock,
  Loader2,
  LockKeyhole,
  PlayCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  Tag,
  Video,
  X,
  XCircle,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  authorizePreparationVideoPlayback,
  downloadPreparationMaterial,
  getMyPreparationMaterials,
  type CandidatePreparationMaterial,
  type PreparationMaterialAccessStatus,
  type VideoPlaybackReceipt,
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
  video: 'Video lesson',
  reference: 'Reference material',
  other: 'Preparation resource',
};

type LibraryFilter = 'all' | 'available' | 'locked' | 'video' | 'document';

const libraryFilters: Array<{ value: LibraryFilter; label: string }> = [
  { value: 'all', label: 'All resources' },
  { value: 'available', label: 'Available' },
  { value: 'locked', label: 'Locked' },
  { value: 'video', label: 'Videos' },
  { value: 'document', label: 'Documents' },
];

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

interface ActiveVideo {
  material: CandidatePreparationMaterial;
  playback: VideoPlaybackReceipt;
}

interface CandidatePreparationMaterialsPanelProps {
  focusedExaminationId?: string | null;
  onClearFocus?: () => void;
}

function isEmbeddedVideo(material: CandidatePreparationMaterial): boolean {
  return material.deliveryMode === 'embedded_video' || material.materialType === 'video';
}

function matchesLibraryFilter(material: CandidatePreparationMaterial, filter: LibraryFilter): boolean {
  if (filter === 'available') return material.accessStatus === 'available';
  if (filter === 'locked') return material.accessStatus === 'locked';
  if (filter === 'video') return isEmbeddedVideo(material);
  if (filter === 'document') return !isEmbeddedVideo(material);
  return true;
}

function getMaterialSearchText(material: CandidatePreparationMaterial): string {
  return [
    material.programmeCode,
    material.examinationTitle,
    material.title,
    material.description,
    material.fileName,
    material.materialType,
    materialTypeLabels[material.materialType],
    material.accessStatus,
    statusPresentation[material.accessStatus].label,
    material.isRequired ? 'required' : '',
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export default function CandidatePreparationMaterialsPanel({
  focusedExaminationId = null,
  onClearFocus,
}: CandidatePreparationMaterialsPanelProps) {
  const [materials, setMaterials] = useState<CandidatePreparationMaterial[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionNotice, setActionNotice] = useState('');
  const [downloadingKey, setDownloadingKey] = useState('');
  const [playingKey, setPlayingKey] = useState('');
  const [activeVideo, setActiveVideo] = useState<ActiveVideo | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [libraryFilter, setLibraryFilter] = useState<LibraryFilter>('all');

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

  useEffect(() => {
    if (!activeVideo) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActiveVideo(null);
    };
    window.addEventListener('keydown', closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [activeVideo]);

  const groups = useMemo<MaterialGroup[]>(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const grouped = new Map<string, MaterialGroup>();

    materials
      .filter((material) => !focusedExaminationId || material.examinationId === focusedExaminationId)
      .filter((material) => matchesLibraryFilter(material, libraryFilter))
      .filter((material) => !normalizedQuery || getMaterialSearchText(material).includes(normalizedQuery))
      .forEach((material) => {
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

    return Array.from(grouped.values())
      .map((group) => ({
        ...group,
        materials: [...group.materials].sort((left, right) => left.position - right.position),
      }))
      .sort((left, right) => left.examinationTitle.localeCompare(right.examinationTitle));
  }, [focusedExaminationId, libraryFilter, materials, searchQuery]);

  useEffect(() => {
    if (!focusedExaminationId || isLoading || groups.length === 0) return;
    window.setTimeout(() => {
      document.getElementById(`materials-examination-${focusedExaminationId}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 80);
  }, [focusedExaminationId, groups.length, isLoading]);

  const handleDownload = async (material: CandidatePreparationMaterial) => {
    const key = `${material.examinationId}-${material.materialId}`;
    try {
      setDownloadingKey(key);
      setActionError('');
      setActionNotice('');
      const receipt = await downloadPreparationMaterial(material);
      setActionNotice(`${receipt.fileName} was delivered through the secure audited channel.`);
    } catch (downloadFailure: any) {
      setActionError(downloadFailure?.message || 'The secure material download could not be completed.');
    } finally {
      setDownloadingKey('');
    }
  };

  const handleVideoPlayback = async (material: CandidatePreparationMaterial) => {
    const key = `${material.examinationId}-${material.materialId}`;
    try {
      setPlayingKey(key);
      setActionError('');
      setActionNotice('');
      const playback = await authorizePreparationVideoPlayback(material);
      setActiveVideo({ material, playback });
      setActionNotice(`${material.title} was authorised for in-platform playback.`);
    } catch (playbackFailure: any) {
      setActionError(playbackFailure?.message || 'The video lesson could not be opened.');
    } finally {
      setPlayingKey('');
    }
  };

  const clearSearchAndFilters = () => {
    setSearchQuery('');
    setLibraryFilter('all');
  };

  const availableCount = materials.filter((material) => material.accessStatus === 'available').length;
  const lockedCount = materials.filter((material) => material.accessStatus === 'locked').length;
  const visibleResourceCount = groups.reduce((total, group) => total + group.materials.length, 0);
  const focusedExaminationTitle = focusedExaminationId
    ? materials.find((material) => material.examinationId === focusedExaminationId)?.examinationTitle || ''
    : '';
  const hasActiveLibraryFilter = searchQuery.trim().length > 0 || libraryFilter !== 'all';

  return (
    <>
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
                    Secure Candidate Library
                  </p>
                  <h1 className="mt-1 text-2xl font-black md:text-3xl">Preparation Materials</h1>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                    Find every PDF, reference and payment-gated video under the examination to which it belongs.
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

            {focusedExaminationId && (
              <section className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Opened from your payment email</p>
                  <p className="mt-1 text-sm font-bold text-emerald-950">
                    Showing materials for {focusedExaminationTitle || 'the purchased examination'}.
                  </p>
                </div>
                {onClearFocus && (
                  <button
                    type="button"
                    onClick={onClearFocus}
                    className="shrink-0 rounded-xl border border-emerald-300 bg-white px-4 py-2.5 text-sm font-black text-emerald-800 transition hover:border-emerald-500 hover:bg-emerald-100"
                  >
                    View all materials
                  </button>
                )}
              </section>
            )}

            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 md:p-5" aria-label="Search and filter materials">
              <div className="flex flex-col gap-4">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search by examination code, title, topic or material type..."
                    className="w-full rounded-2xl border border-slate-300 bg-white py-3.5 pl-12 pr-12 text-sm font-semibold text-slate-900 outline-none transition placeholder:font-medium placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                    aria-label="Search preparation materials"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                      aria-label="Clear material search"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500">
                    <Filter className="h-4 w-4" aria-hidden="true" />
                    Quick filters
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {libraryFilters.map((filter) => {
                      const selected = libraryFilter === filter.value;
                      return (
                        <button
                          key={filter.value}
                          type="button"
                          onClick={() => setLibraryFilter(filter.value)}
                          className={`rounded-full border px-3 py-2 text-xs font-black transition ${
                            selected
                              ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                              : 'border-slate-300 bg-white text-slate-600 hover:border-emerald-400 hover:text-emerald-700'
                          }`}
                          aria-pressed={selected}
                        >
                          {filter.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-col gap-2 border-t border-slate-200 pt-3 text-xs font-bold text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    Showing {visibleResourceCount} resource{visibleResourceCount === 1 ? '' : 's'} across {groups.length} examination{groups.length === 1 ? '' : 's'}.
                  </span>
                  {hasActiveLibraryFilter && (
                    <button
                      type="button"
                      onClick={clearSearchAndFilters}
                      className="self-start text-emerald-700 transition hover:text-emerald-900 sm:self-auto"
                    >
                      Clear search and filters
                    </button>
                  )}
                </div>
              </div>
            </section>

            <div className="flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm leading-6 text-sky-950">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-sky-700" aria-hidden="true" />
              <p>
                Every download and video playback request is re-authorised against your current examination assignment, verified payment or waiver, publication state and access window.
              </p>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900">
              <strong>Copyright notice:</strong> Materials are licensed to the authorised candidate for personal examination preparation only. Redistribution, resale, public posting, recording and unauthorised sharing are prohibited.
            </div>

            {error && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                {error}
              </div>
            )}
            {actionError && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                {actionError}
              </div>
            )}
            {actionNotice && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                {actionNotice}
              </div>
            )}

            {isLoading ? (
              <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-slate-500">
                <Loader2 className="h-9 w-9 animate-spin text-emerald-600" />
                <p className="text-sm font-bold">Checking verified preparation-material entitlements...</p>
              </div>
            ) : materials.length === 0 ? (
              <div className="flex min-h-64 flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 text-center">
                <FolderLock className="h-12 w-12 text-slate-400" aria-hidden="true" />
                <h2 className="mt-4 text-lg font-black text-slate-900">No published materials yet</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
                  Published preparation materials mapped to your examination catalogue will appear here automatically.
                </p>
              </div>
            ) : groups.length === 0 ? (
              <div className="flex min-h-64 flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 text-center">
                <Search className="h-12 w-12 text-slate-400" aria-hidden="true" />
                <h2 className="mt-4 text-lg font-black text-slate-900">No matching materials</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
                  Try another examination code, topic or filter to locate the resource you need.
                </p>
                <button
                  type="button"
                  onClick={clearSearchAndFilters}
                  className="mt-4 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-emerald-700"
                >
                  Show all materials
                </button>
              </div>
            ) : (
              <div className="space-y-7">
                {groups.map((group) => {
                  const groupAvailableCount = group.materials.filter((material) => material.accessStatus === 'available').length;
                  const groupVideoCount = group.materials.filter(isEmbeddedVideo).length;

                  return (
                    <section
                      id={`materials-examination-${group.examinationId}`}
                      key={group.examinationId}
                      className={`scroll-mt-28 overflow-hidden rounded-3xl border bg-white shadow-sm ${
                        focusedExaminationId === group.examinationId
                          ? 'border-emerald-400 ring-4 ring-emerald-100'
                          : 'border-slate-200'
                      }`}
                    >
                      <header className="flex flex-col justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-5 sm:flex-row sm:items-center">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.15em] text-emerald-700">
                              <Tag className="h-3 w-3" aria-hidden="true" />
                              {group.programmeCode}
                            </span>
                            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-600">
                              Examination materials
                            </span>
                          </div>
                          <h2 className="mt-2 text-base font-black text-slate-950 md:text-lg">{group.examinationTitle}</h2>
                        </div>
                        <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-wider">
                          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-600">
                            {group.materials.length} resource{group.materials.length === 1 ? '' : 's'}
                          </span>
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-700">
                            {groupAvailableCount} available
                          </span>
                          {groupVideoCount > 0 && (
                            <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-violet-700">
                              {groupVideoCount} video{groupVideoCount === 1 ? '' : 's'}
                            </span>
                          )}
                        </div>
                      </header>

                      <div className="grid gap-4 p-4 lg:grid-cols-2">
                        {group.materials.map((material) => {
                          const presentation = statusPresentation[material.accessStatus];
                          const StatusIcon = presentation.Icon;
                          const scheduledTime = formatDate(material.availableFrom);
                          const expiryTime = formatDate(material.expiresAt);
                          const actionKey = `${material.examinationId}-${material.materialId}`;
                          const videoMaterial = isEmbeddedVideo(material);
                          const isDownloading = downloadingKey === actionKey;
                          const isPlaying = playingKey === actionKey;
                          const MaterialIcon = videoMaterial ? Video : FileText;
                          const materialTypeLabel = materialTypeLabels[material.materialType] || materialTypeLabels.other;

                          return (
                            <article
                              key={actionKey}
                              className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md"
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex min-w-0 items-start gap-3">
                                  <div className={`rounded-xl p-2.5 ${videoMaterial ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-700'}`}>
                                    <MaterialIcon className="h-5 w-5" aria-hidden="true" />
                                  </div>
                                  <div className="min-w-0">
                                    <h3 className="font-black leading-6 text-slate-950">{material.title}</h3>
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-600">
                                        {materialTypeLabel}
                                      </span>
                                      <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500">
                                        {group.programmeCode}
                                      </span>
                                      {material.isRequired && (
                                        <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-rose-700">
                                          Required
                                        </span>
                                      )}
                                    </div>
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
                                  <dt className="font-black uppercase tracking-wider text-slate-400">
                                    {videoMaterial ? 'Delivery' : 'Version'}
                                  </dt>
                                  <dd className="mt-1 font-bold text-slate-700">
                                    {videoMaterial ? 'In-platform video' : material.versionLabel}
                                  </dd>
                                </div>
                                <div>
                                  <dt className="font-black uppercase tracking-wider text-slate-400">
                                    {videoMaterial ? 'Source size' : 'File size'}
                                  </dt>
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
                                {videoMaterial ? (
                                  <button
                                    type="button"
                                    onClick={() => void handleVideoPlayback(material)}
                                    disabled={material.accessStatus !== 'available' || Boolean(playingKey)}
                                    className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition ${
                                      material.accessStatus === 'available'
                                        ? 'bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-300'
                                        : 'cursor-not-allowed bg-slate-100 text-slate-500'
                                    }`}
                                  >
                                    {isPlaying ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <PlayCircle className="h-4 w-4" />
                                    )}
                                    {material.accessStatus === 'available'
                                      ? isPlaying ? 'Authorising video...' : 'Watch video lesson'
                                      : 'Video access unavailable'}
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => void handleDownload(material)}
                                    disabled={material.accessStatus !== 'available' || Boolean(downloadingKey)}
                                    className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition ${
                                      material.accessStatus === 'available'
                                        ? 'bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-300'
                                        : 'cursor-not-allowed bg-slate-100 text-slate-500'
                                    }`}
                                  >
                                    {isDownloading ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Download className="h-4 w-4" />
                                    )}
                                    {material.accessStatus === 'available'
                                      ? isDownloading ? 'Authorising secure download...' : 'Download securely'
                                      : 'Material access unavailable'}
                                  </button>
                                )}
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </main>

      {activeVideo && (
        <div
          className="fixed inset-0 z-[100] overflow-y-auto bg-slate-950/95 px-3 py-4 backdrop-blur-sm md:px-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="agilecert-video-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setActiveVideo(null);
          }}
        >
          <div className="flex min-h-full items-center justify-center">
            <section
              className="flex w-full flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl"
              style={{ maxWidth: 'min(72rem, calc(177.78dvh - 23rem))' }}
            >
              <header className="flex items-start justify-between gap-4 border-b border-slate-800 px-4 py-3 text-white md:px-6 md:py-4">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="rounded-xl bg-emerald-600 p-2.5">
                    <Video className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-400">
                        Authorised video lesson
                      </p>
                      <span className="rounded-full border border-emerald-700 bg-emerald-950 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-300">
                        In-platform viewing
                      </span>
                    </div>
                    <h2 id="agilecert-video-title" className="mt-1 line-clamp-2 text-base font-black md:text-lg">
                      {activeVideo.playback.title}
                    </h2>
                    <p className="mt-1 line-clamp-1 text-xs text-slate-400">{activeVideo.material.examinationTitle}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveVideo(null)}
                  className="shrink-0 rounded-xl border border-slate-700 bg-slate-900 p-2 text-slate-300 transition hover:border-rose-400 hover:text-white"
                  aria-label="Close video player"
                >
                  <X className="h-5 w-5" />
                </button>
              </header>

              <div className="flex items-center justify-center bg-black p-1 sm:p-2">
                <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
                  <iframe
                    src={activeVideo.playback.embedUrl}
                    title={activeVideo.playback.title}
                    className="absolute inset-0 h-full w-full border-0"
                    allow="autoplay; encrypted-media; fullscreen"
                    allowFullScreen
                    sandbox="allow-scripts allow-same-origin allow-presentation"
                    referrerPolicy="strict-origin-when-cross-origin"
                  />
                </div>
              </div>

              <footer className="flex flex-col gap-1 border-t border-slate-800 bg-slate-950 px-4 py-3 text-[11px] leading-5 text-slate-400 md:flex-row md:items-center md:justify-between md:px-6">
                <span>Playback is centred and authorised against your current module access.</span>
                <span>External navigation is blocked. Licensed for personal study only.</span>
              </footer>
            </section>
          </div>
        </div>
      )}
    </>
  );
}

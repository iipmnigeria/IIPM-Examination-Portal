import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpenCheck,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  FolderLock,
  Loader2,
  LockKeyhole,
  PlayCircle,
  RefreshCw,
  ShieldCheck,
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

function isEmbeddedVideo(material: CandidatePreparationMaterial): boolean {
  return material.deliveryMode === 'embedded_video' || material.materialType === 'video';
}

export default function CandidatePreparationMaterialsPanel() {
  const [materials, setMaterials] = useState<CandidatePreparationMaterial[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionNotice, setActionNotice] = useState('');
  const [downloadingKey, setDownloadingKey] = useState('');
  const [playingKey, setPlayingKey] = useState('');
  const [activeVideo, setActiveVideo] = useState<ActiveVideo | null>(null);

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
      setActionNotice(`${material.title} was authorised for playback.`);
    } catch (playbackFailure: any) {
      setActionError(playbackFailure?.message || 'The video lesson could not be opened.');
    } finally {
      setPlayingKey('');
    }
  };

  const availableCount = materials.filter((material) => material.accessStatus === 'available').length;
  const lockedCount = materials.filter((material) => material.accessStatus === 'locked').length;

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
                    Download authorised study resources and watch payment-gated video lessons from the examinations assigned to you.
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
                        const actionKey = `${material.examinationId}-${material.materialId}`;
                        const videoMaterial = isEmbeddedVideo(material);
                        const isDownloading = downloadingKey === actionKey;
                        const isPlaying = playingKey === actionKey;
                        const MaterialIcon = videoMaterial ? Video : FileText;

                        return (
                          <article
                            key={actionKey}
                            className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-start gap-3">
                                <div className="rounded-xl bg-slate-100 p-2.5 text-slate-700">
                                  <MaterialIcon className="h-5 w-5" aria-hidden="true" />
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
                                <dt className="font-black uppercase tracking-wider text-slate-400">
                                  {videoMaterial ? 'Delivery' : 'Version'}
                                </dt>
                                <dd className="mt-1 font-bold text-slate-700">
                                  {videoMaterial ? 'Embedded video' : material.versionLabel}
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
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      {activeVideo && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 p-3 backdrop-blur-sm md:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="agilecert-video-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setActiveVideo(null);
          }}
        >
          <section className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl">
            <header className="flex items-start justify-between gap-4 border-b border-slate-800 px-4 py-4 text-white md:px-6">
              <div className="flex min-w-0 items-start gap-3">
                <div className="rounded-xl bg-emerald-600 p-2.5">
                  <Video className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-400">
                    Authorised video lesson
                  </p>
                  <h2 id="agilecert-video-title" className="mt-1 truncate text-base font-black md:text-lg">
                    {activeVideo.playback.title}
                  </h2>
                  <p className="mt-1 text-xs text-slate-400">{activeVideo.material.examinationTitle}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveVideo(null)}
                className="rounded-xl border border-slate-700 bg-slate-900 p-2 text-slate-300 transition hover:border-rose-400 hover:text-white"
                aria-label="Close video player"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="aspect-video w-full bg-black">
              <iframe
                src={activeVideo.playback.embedUrl}
                title={activeVideo.playback.title}
                className="h-full w-full border-0"
                allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>

            <footer className="flex flex-col gap-2 border-t border-slate-800 bg-slate-950 px-4 py-3 text-xs leading-5 text-slate-400 md:flex-row md:items-center md:justify-between md:px-6">
              <span>Playback was authorised against your current module access.</span>
              <span>Licensed for personal study only. Do not record or redistribute.</span>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}

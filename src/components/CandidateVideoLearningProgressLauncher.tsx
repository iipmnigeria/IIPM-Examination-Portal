import { useEffect, useMemo, useState } from 'react';
import {
  BookOpenCheck,
  CheckCircle2,
  Circle,
  Clock3,
  Eye,
  History,
  Loader2,
  PlayCircle,
  RefreshCw,
  RotateCcw,
  Video,
  X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getCurrentPortalUser } from '../services/authService';
import {
  getMyVideoLearningProgress,
  setMyVideoLessonCompletion,
  type CandidateVideoLearningProgress,
} from '../services/videoLearningAnalyticsService';

function formatDate(value?: string | null): string {
  if (!value) return 'Not opened yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not opened yet';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function openMaterials(examinationId: string) {
  const url = new URL(window.location.href);
  url.searchParams.set('view', 'materials');
  url.searchParams.set('examinationId', examinationId);
  window.location.assign(url.toString());
}

export default function CandidateVideoLearningProgressLauncher() {
  const [isCandidate, setIsCandidate] = useState(false);
  const [open, setOpen] = useState(false);
  const [records, setRecords] = useState<CandidateVideoLearningProgress[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyKey, setBusyKey] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refreshAuthorisation = async () => {
    try {
      const current = await getCurrentPortalUser();
      const candidate = current?.profile.role === 'candidate';
      setIsCandidate(candidate);
      if (!candidate) setOpen(false);
    } catch {
      setIsCandidate(false);
      setOpen(false);
    }
  };

  const loadProgress = async () => {
    try {
      setLoading(true);
      setError('');
      setRecords(await getMyVideoLearningProgress());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load video learning progress.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshAuthorisation();
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      window.setTimeout(() => void refreshAuthorisation(), 0);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (open && isCandidate) void loadProgress();
  }, [open, isCandidate]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  const summary = useMemo(() => {
    const started = records.filter((record) => record.openCount > 0).length;
    const completed = records.filter((record) => record.completed).length;
    const totalOpens = records.reduce((total, record) => total + Number(record.openCount || 0), 0);
    return { started, completed, totalOpens };
  }, [records]);

  const setCompletion = async (record: CandidateVideoLearningProgress, completed: boolean) => {
    const key = `${record.examinationId}:${record.materialId}`;
    try {
      setBusyKey(key);
      setError('');
      setNotice('');
      await setMyVideoLessonCompletion({
        examinationId: record.examinationId,
        materialId: record.materialId,
        completed,
      });
      setNotice(completed
        ? `${record.materialTitle} has been marked complete.`
        : `${record.materialTitle} has been returned to in-progress status.`);
      await loadProgress();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to update lesson completion.');
    } finally {
      setBusyKey('');
    }
  };

  if (!isCandidate) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-28 right-4 z-[67] inline-flex items-center gap-2 rounded-full bg-teal-700 px-4 py-3 text-sm font-black text-white shadow-xl transition hover:bg-teal-800"
        aria-label="Open video learning progress"
      >
        <History className="h-5 w-5" /> Learning Progress
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[185] overflow-y-auto bg-slate-950/80 p-3 backdrop-blur-sm md:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="video-learning-progress-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section className="mx-auto min-h-full max-w-6xl overflow-hidden rounded-3xl bg-slate-50 shadow-2xl">
            <header className="flex items-start justify-between gap-4 bg-slate-950 px-5 py-5 text-white md:px-7">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-teal-600 p-2.5">
                  <Video className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-300">Candidate learning history</p>
                  <h2 id="video-learning-progress-title" className="mt-1 text-xl font-black md:text-2xl">
                    Video Progress & Completion
                  </h2>
                  <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-300">
                    Review authorised lesson openings, continue to the relevant module and record completed lessons.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl border border-slate-700 p-2 text-slate-300 transition hover:bg-slate-800 hover:text-white"
                aria-label="Close video learning progress"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="space-y-5 p-5 md:p-7">
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Available lessons</p>
                  <p className="mt-2 text-2xl font-black text-slate-950">{records.length}</p>
                </div>
                <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
                  <p className="text-[10px] font-black uppercase tracking-wider text-sky-700">Started</p>
                  <p className="mt-2 text-2xl font-black text-sky-950">{summary.started}</p>
                </div>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Completed</p>
                  <p className="mt-2 text-2xl font-black text-emerald-950">{summary.completed}</p>
                </div>
                <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
                  <p className="text-[10px] font-black uppercase tracking-wider text-violet-700">Authorised opens</p>
                  <p className="mt-2 text-2xl font-black text-violet-950">{summary.totalOpens}</p>
                </div>
              </div>

              <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950 md:flex-row md:items-start md:justify-between">
                <div className="flex items-start gap-3">
                  <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                  <p>
                    Google Drive preview records verified lesson openings and manual completion, but it does not expose exact playback time or automatic seek position. Exact resume will activate when the portal moves to a controllable video player.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void loadProgress()}
                  disabled={loading}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-black text-amber-900 transition hover:bg-amber-100 disabled:opacity-60"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
                </button>
              </div>

              {error && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                  {error}
                </div>
              )}
              {notice && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
                  {notice}
                </div>
              )}

              {loading ? (
                <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-slate-500">
                  <Loader2 className="h-9 w-9 animate-spin text-teal-600" />
                  <p className="text-sm font-bold">Loading authorised video learning history...</p>
                </div>
              ) : records.length === 0 ? (
                <div className="flex min-h-64 flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white px-6 text-center">
                  <BookOpenCheck className="h-12 w-12 text-slate-400" />
                  <h3 className="mt-4 text-lg font-black text-slate-900">No available video lessons</h3>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
                    Video lessons will appear here after a verified payment, waiver or administrator assignment creates active material access.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  {records.map((record) => {
                    const key = `${record.examinationId}:${record.materialId}`;
                    const busy = busyKey === key;
                    return (
                      <article key={key} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex flex-wrap gap-2">
                              <span className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-teal-700">
                                {record.programmeCode}
                              </span>
                              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${
                                record.completed
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                  : record.openCount > 0
                                    ? 'border-sky-200 bg-sky-50 text-sky-700'
                                    : 'border-slate-200 bg-slate-50 text-slate-600'
                              }`}>
                                {record.completed ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                                {record.completed ? 'Completed' : record.openCount > 0 ? 'In progress' : 'Not started'}
                              </span>
                            </div>
                            <h3 className="mt-3 font-black leading-6 text-slate-950">{record.materialTitle}</h3>
                            <p className="mt-1 text-xs leading-5 text-slate-500">{record.examinationTitle}</p>
                          </div>
                          <div className="rounded-xl bg-violet-100 p-2.5 text-violet-700">
                            <PlayCircle className="h-5 w-5" />
                          </div>
                        </div>

                        <dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-xs">
                          <div>
                            <dt className="font-black uppercase tracking-wider text-slate-400">Open count</dt>
                            <dd className="mt-1 flex items-center gap-1.5 font-bold text-slate-700"><Eye className="h-3.5 w-3.5" />{record.openCount}</dd>
                          </div>
                          <div>
                            <dt className="font-black uppercase tracking-wider text-slate-400">Last opened</dt>
                            <dd className="mt-1 font-bold leading-5 text-slate-700">{formatDate(record.lastOpenedAt)}</dd>
                          </div>
                        </dl>

                        <div className="mt-auto grid gap-2 pt-5 sm:grid-cols-2">
                          <button
                            type="button"
                            onClick={() => openMaterials(record.examinationId)}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-3 text-sm font-black text-white transition hover:bg-teal-800"
                          >
                            <PlayCircle className="h-4 w-4" />
                            {record.openCount > 0 ? 'Continue lesson' : 'Open lesson'}
                          </button>
                          <button
                            type="button"
                            onClick={() => void setCompletion(record, !record.completed)}
                            disabled={busy}
                            className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-black transition disabled:opacity-60 ${
                              record.completed
                                ? 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                                : 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                            }`}
                          >
                            {busy
                              ? <Loader2 className="h-4 w-4 animate-spin" />
                              : record.completed
                                ? <RotateCcw className="h-4 w-4" />
                                : <CheckCircle2 className="h-4 w-4" />}
                            {record.completed ? 'Mark in progress' : 'Mark complete'}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  CheckCircle2,
  Clock3,
  Eye,
  Loader2,
  RefreshCw,
  Search,
  Users,
  Video,
  X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getCurrentPortalUser } from '../services/authService';
import {
  getAdminVideoLearningAnalytics,
  type AdminVideoLearningAnalyticsRecord,
  type AdminVideoLearningAnalyticsResponse,
} from '../services/videoLearningAnalyticsService';

const emptyAnalytics: AdminVideoLearningAnalyticsResponse = {
  summary: {
    lessonRecords: 0,
    engagedCandidates: 0,
    authorisedOpens: 0,
    completedLessons: 0,
    activeLast30Days: 0,
    completionRate: 0,
    exactResumeSupportedForGoogleDrive: false,
  },
  total: 0,
  records: [],
};

function formatDate(value?: string | null): string {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Never';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export default function AdminVideoLearningAnalyticsLauncher() {
  const [authorised, setAuthorised] = useState(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [programmeCode, setProgrammeCode] = useState('');
  const [analytics, setAnalytics] = useState<AdminVideoLearningAnalyticsResponse>(emptyAnalytics);

  const refreshAuthorisation = async () => {
    try {
      const current = await getCurrentPortalUser();
      const allowed = Boolean(current && ['exam_admin', 'super_admin'].includes(current.profile.role));
      setAuthorised(allowed);
      if (!allowed) setOpen(false);
    } catch {
      setAuthorised(false);
      setOpen(false);
    }
  };

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setError('');
      setAnalytics(await getAdminVideoLearningAnalytics({
        programmeCode,
        search,
        limit: 1000,
      }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load video learning analytics.');
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
    if (open && authorised) void loadAnalytics();
  }, [open, authorised]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  const programmeOptions = useMemo(() => Array.from(new Set(
    analytics.records.map((record) => record.programmeCode).filter(Boolean),
  )).sort(), [analytics.records]);

  if (!authorised) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-16 right-4 z-[68] inline-flex items-center gap-2 rounded-full bg-cyan-700 px-4 py-3 text-sm font-black text-white shadow-xl transition hover:bg-cyan-800"
        aria-label="Open video learning analytics administration"
      >
        <BarChart3 className="h-5 w-5" /> Learning Analytics
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[195] overflow-y-auto bg-slate-950/80 p-3 backdrop-blur-sm md:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="video-learning-analytics-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section className="mx-auto min-h-full max-w-7xl overflow-hidden rounded-3xl bg-slate-50 shadow-2xl">
            <header className="flex items-start justify-between gap-4 bg-slate-950 px-5 py-5 text-white md:px-7">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-cyan-600 p-2.5">
                  <BarChart3 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">Administrator reporting</p>
                  <h2 id="video-learning-analytics-title" className="mt-1 text-xl font-black md:text-2xl">
                    Video Progress & Learning Analytics
                  </h2>
                  <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-300">
                    Review authorised lesson openings, candidate activity, completion and programme-level engagement.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl border border-slate-700 p-2 text-slate-300 transition hover:bg-slate-800 hover:text-white"
                aria-label="Close video learning analytics"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="space-y-5 p-5 md:p-7">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                {[
                  ['Learning records', analytics.summary.lessonRecords, Video],
                  ['Candidates', analytics.summary.engagedCandidates, Users],
                  ['Authorised opens', analytics.summary.authorisedOpens, Eye],
                  ['Completed', analytics.summary.completedLessons, CheckCircle2],
                  ['Active in 30 days', analytics.summary.activeLast30Days, Clock3],
                  ['Completion rate', `${analytics.summary.completionRate}%`, BarChart3],
                ].map(([label, value, Icon]) => (
                  <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{String(label)}</p>
                      <Icon className="h-4 w-4 text-cyan-700" />
                    </div>
                    <p className="mt-2 text-2xl font-black text-slate-950">{String(value)}</p>
                  </div>
                ))}
              </div>

              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
                <div className="grid gap-3 lg:grid-cols-[1fr_15rem_auto]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') void loadAnalytics();
                      }}
                      placeholder="Search candidate, email, code or lesson"
                      className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                    />
                  </div>
                  <select
                    value={programmeCode}
                    onChange={(event) => setProgrammeCode(event.target.value)}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-cyan-500"
                  >
                    <option value="">All programmes</option>
                    {programmeOptions.map((code) => <option key={code} value={code}>{code}</option>)}
                  </select>
                  <button
                    type="button"
                    onClick={() => void loadAnalytics()}
                    disabled={loading}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-700 px-4 py-2.5 text-xs font-black text-white transition hover:bg-cyan-800 disabled:opacity-60"
                  >
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh report
                  </button>
                </div>
              </section>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
                Current Google Drive playback analytics are authoritative for access authorisations, opening history and candidate-declared completion. Exact current-time, watched percentage and seek-based resume remain unavailable until a controllable player is introduced.
              </div>

              {error && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                  {error}
                </div>
              )}

              {loading ? (
                <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-slate-500">
                  <Loader2 className="h-9 w-9 animate-spin text-cyan-600" />
                  <p className="text-sm font-bold">Preparing learning analytics...</p>
                </div>
              ) : analytics.records.length === 0 ? (
                <div className="flex min-h-64 flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white px-6 text-center">
                  <BarChart3 className="h-12 w-12 text-slate-400" />
                  <h3 className="mt-4 text-lg font-black text-slate-900">No video activity found</h3>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
                    Authorised video openings will appear automatically after candidates launch available lessons.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                    <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Candidate</th>
                        <th className="px-4 py-3">Programme / Lesson</th>
                        <th className="px-4 py-3">Opens</th>
                        <th className="px-4 py-3">Last activity</th>
                        <th className="px-4 py-3">Completion</th>
                        <th className="px-4 py-3">Provider</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {analytics.records.map((record: AdminVideoLearningAnalyticsRecord) => (
                        <tr key={`${record.candidateId}:${record.examinationId}:${record.materialId}`} className="align-top">
                          <td className="px-4 py-4">
                            <p className="font-black text-slate-950">{record.candidateName}</p>
                            <p className="mt-1 text-xs text-slate-500">{record.email || record.candidateCode || 'No contact reference'}</p>
                          </td>
                          <td className="px-4 py-4">
                            <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-cyan-700">
                              {record.programmeCode}
                            </span>
                            <p className="mt-2 max-w-md font-bold leading-5 text-slate-800">{record.materialTitle}</p>
                            <p className="mt-1 max-w-md text-xs leading-5 text-slate-500">{record.examinationTitle}</p>
                          </td>
                          <td className="px-4 py-4 font-black text-slate-800">{record.openCount}</td>
                          <td className="px-4 py-4 text-xs font-semibold leading-5 text-slate-600">{formatDate(record.lastOpenedAt)}</td>
                          <td className="px-4 py-4">
                            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${
                              record.completed
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                : 'border-slate-200 bg-slate-50 text-slate-600'
                            }`}>
                              {record.completed ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
                              {record.completed ? 'Completed' : 'In progress'}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-xs font-bold uppercase text-slate-500">{record.provider.replace('_', ' ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

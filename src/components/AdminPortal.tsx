import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Camera,
  CheckCircle2,
  Clock,
  FileSearch,
  FileWarning,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import type { Attempt } from '../types';
import {
  createProctorEvidenceSignedUrl,
  getAttemptIntegrityEvidence,
  reviewAttemptIntegrity,
  type AttemptIntegrityEvidence,
  type AttemptIntegrityEvent,
  type IntegrityDecision,
} from '../services/proctoringAuditService';

interface AdminPortalProps {
  attempts: Attempt[];
  onBackToDashboard: () => void;
  onRefresh: () => void | Promise<void>;
}

const statusClass = (status: string) => {
  if (['submitted', 'reviewed', 'clear'].includes(status)) return 'bg-emerald-100 text-emerald-800';
  if (['terminated', 'invalidate_attempt'].includes(status)) return 'bg-rose-100 text-rose-800';
  if (['flagged', 'flag_attempt'].includes(status)) return 'bg-amber-100 text-amber-800';
  return 'bg-slate-100 text-slate-700';
};

const evidenceLabel = (status?: string) => {
  if (status === 'visual_evidence') return 'Visual evidence retained';
  if (status === 'event_evidence') return 'Event evidence retained';
  if (status === 'partial_visual_evidence') return 'Incomplete visual evidence';
  return 'No supporting evidence';
};

const displayEventType = (value: string) => value.replaceAll('_', ' ');
const visualEvent = (eventType: string) => ['no_face', 'multiple_people', 'phone_detected', 'looking_away', 'notes_detected'].includes(eventType);

export default function AdminPortal({ attempts, onBackToDashboard, onRefresh }: AdminPortalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'review' | 'supported' | 'clear'>('all');
  const [selectedAttemptId, setSelectedAttemptId] = useState('');
  const [evidence, setEvidence] = useState<AttemptIntegrityEvidence | null>(null);
  const [loadingEvidence, setLoadingEvidence] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  const selectedAttempt = attempts.find((attempt) => attempt.id === selectedAttemptId) || null;

  const classifiedAttempts = useMemo(() => attempts.map((attempt) => {
    const eventCount = attempt.logs?.length || 0;
    const noEvidence = attempt.evidenceStatus === 'no_evidence' || eventCount === 0;
    const unsupportedScore = noEvidence && attempt.suspiciousScore > 0;
    const supportedRisk = !noEvidence && attempt.suspiciousScore >= 25;
    const needsReview = unsupportedScore || attempt.status === 'flagged' || supportedRisk;
    return { attempt, eventCount, noEvidence, unsupportedScore, supportedRisk, needsReview };
  }), [attempts]);

  const filteredAttempts = classifiedAttempts.filter(({ attempt, noEvidence, supportedRisk, needsReview }) => {
    const query = searchTerm.trim().toLowerCase();
    const matchesSearch = !query
      || attempt.studentName.toLowerCase().includes(query)
      || attempt.testTitle.toLowerCase().includes(query);
    const matchesFilter = filter === 'all'
      || (filter === 'review' && needsReview)
      || (filter === 'supported' && supportedRisk)
      || (filter === 'clear' && noEvidence && attempt.suspiciousScore === 0);
    return matchesSearch && matchesFilter;
  });

  const supportedRiskCount = classifiedAttempts.filter((item) => item.supportedRisk).length;
  const unsupportedCount = classifiedAttempts.filter((item) => item.unsupportedScore).length;
  const averageScore = attempts.length
    ? Math.round(attempts.reduce((sum, attempt) => sum + (attempt.score || 0), 0) / attempts.length)
    : 0;

  const loadEvidence = async (attemptId: string) => {
    setLoadingEvidence(true);
    setError('');
    try {
      setEvidence(await getAttemptIntegrityEvidence(attemptId));
    } catch (loadError) {
      setEvidence(null);
      setError(loadError instanceof Error
        ? loadError.message
        : 'The evidence record could not be loaded.');
    } finally {
      setLoadingEvidence(false);
    }
  };

  useEffect(() => {
    if (!selectedAttemptId) {
      setEvidence(null);
      return;
    }
    void loadEvidence(selectedAttemptId);
  }, [selectedAttemptId]);

  const runDecision = async (decision: IntegrityDecision, promptLabel: string) => {
    if (!selectedAttemptId) return;
    const reason = window.prompt(promptLabel)?.trim() || '';
    if (!reason) return;

    setBusy(true);
    setError('');
    setMessage('');
    try {
      await reviewAttemptIntegrity({ attemptId: selectedAttemptId, decision, reason });
      setMessage(`Integrity decision recorded: ${decision.replaceAll('_', ' ')}.`);
      await Promise.resolve(onRefresh());
      await loadEvidence(selectedAttemptId);
    } catch (decisionError) {
      setError(decisionError instanceof Error ? decisionError.message : 'The integrity decision failed.');
    } finally {
      setBusy(false);
    }
  };

  const openSnapshot = async (path: string) => {
    setError('');
    try {
      setExpandedImage(await createProctorEvidenceSignedUrl(path));
    } catch (snapshotError) {
      setError(snapshotError instanceof Error ? snapshotError.message : 'The private snapshot could not be opened.');
    }
  };

  const summary = evidence?.summary;
  const events: AttemptIntegrityEvent[] = evidence?.events || selectedAttempt?.logs.map((log) => ({
    id: log.id,
    eventType: log.type,
    severity: log.severity,
    confidence: log.confidence ?? null,
    message: log.message,
    snapshotPath: log.snapshotPath || null,
    source: log.source || 'legacy_submission',
    riskWeight: log.riskWeight || 0,
    metadata: {},
    occurredAt: log.timestamp,
  })) || [];

  return (
    <div id="admin-portal" className="mx-auto max-w-7xl space-y-7 px-4 py-6">
      <section className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 p-6 text-white shadow-xl md:p-8">
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-emerald-400">
              <ShieldCheck className="h-5 w-5" /> Evidence-backed administration
            </div>
            <h1 className="mt-2 text-2xl font-black">Examination Integrity Audit</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              Risk scores are calculated from persisted browser events and retained visual evidence. A percentage alone cannot support an adverse decision.
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => void onRefresh()} className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs font-black hover:bg-slate-800">
              <RefreshCw className="h-4 w-4" /> Refresh records
            </button>
            <button type="button" onClick={onBackToDashboard} className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs font-black hover:bg-slate-800">
              Exit audit
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Total attempts', attempts.length, Users, 'text-slate-700'],
          ['Supported risk', supportedRiskCount, ShieldAlert, 'text-rose-600'],
          ['Unsupported legacy scores', unsupportedCount, FileWarning, 'text-amber-600'],
          ['Average academic score', `${averageScore}%`, CheckCircle2, 'text-emerald-600'],
        ].map(([label, value, Icon, colour]) => (
          <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <Icon className={`h-5 w-5 ${colour}`} />
            <p className="mt-3 text-3xl font-black text-slate-950">{String(value)}</p>
            <p className="mt-1 text-xs font-bold text-slate-500">{String(label)}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-7 lg:grid-cols-3">
        <aside className="space-y-4 lg:col-span-1">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search candidate or examination"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-emerald-500"
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {([
                ['all', 'All'],
                ['review', 'Needs review'],
                ['supported', 'Supported risk'],
                ['clear', 'No evidence'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className={`rounded-full border px-3 py-1.5 text-[11px] font-black ${filter === value ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 text-slate-600'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="max-h-[680px] space-y-3 overflow-y-auto pr-1">
            {filteredAttempts.map(({ attempt, eventCount, noEvidence, unsupportedScore, supportedRisk }) => {
              const selected = attempt.id === selectedAttemptId;
              return (
                <button
                  key={attempt.id}
                  type="button"
                  onClick={() => setSelectedAttemptId(attempt.id)}
                  className={`w-full rounded-2xl border p-4 text-left shadow-sm transition ${selected ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white hover:border-slate-400'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className={`text-sm font-black ${selected ? 'text-white' : 'text-slate-950'}`}>{attempt.studentName}</p>
                      <p className={`mt-1 text-xs ${selected ? 'text-slate-300' : 'text-slate-500'}`}>{attempt.testTitle}</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${unsupportedScore ? 'bg-amber-100 text-amber-800' : supportedRisk ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>
                      {unsupportedScore ? 'Unsubstantiated' : supportedRisk ? 'Review risk' : 'No supported risk'}
                    </span>
                  </div>
                  <div className={`mt-3 grid grid-cols-3 gap-2 rounded-xl p-3 text-center text-xs ${selected ? 'bg-slate-900' : 'bg-slate-50'}`}>
                    <div><p className="text-[9px] font-bold uppercase opacity-60">Score</p><p className="font-black">{attempt.score}%</p></div>
                    <div><p className="text-[9px] font-bold uppercase opacity-60">Risk</p><p className="font-black">{attempt.suspiciousScore}%</p></div>
                    <div><p className="text-[9px] font-bold uppercase opacity-60">Events</p><p className="font-black">{eventCount}</p></div>
                  </div>
                  <p className={`mt-3 flex items-center gap-1 text-[10px] font-bold ${selected ? 'text-slate-400' : 'text-slate-500'}`}>
                    {noEvidence ? <FileWarning className="h-3 w-3" /> : <FileSearch className="h-3 w-3" />}
                    {evidenceLabel(attempt.evidenceStatus)}
                  </p>
                </button>
              );
            })}
            {!filteredAttempts.length && (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-xs text-slate-500">
                No matching examination attempts.
              </div>
            )}
          </div>
        </aside>

        <main className="lg:col-span-2">
          {!selectedAttempt ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-16 text-center text-slate-500">
              <ShieldAlert className="mx-auto h-10 w-10 text-slate-300" />
              <h2 className="mt-3 font-black text-slate-800">Select an examination attempt</h2>
              <p className="mt-2 text-xs">The full event report, score calculation, snapshots and review history will appear here.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</div>}
              {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{message}</div>}

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
                <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-start">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Attempt {selectedAttempt.id.slice(0, 8)}</p>
                    <h2 className="mt-1 text-xl font-black text-slate-950">{selectedAttempt.studentName}</h2>
                    <p className="mt-1 text-xs font-bold text-slate-500">{selectedAttempt.testTitle}</p>
                  </div>
                  <span className={`w-fit rounded-full px-3 py-1.5 text-xs font-black ${statusClass(evidence?.attempt.status || selectedAttempt.status)}`}>
                    {(evidence?.attempt.status || selectedAttempt.status).replaceAll('_', ' ')}
                  </span>
                </div>

                {loadingEvidence ? (
                  <div className="flex items-center justify-center gap-3 py-16 text-sm font-bold text-slate-500">
                    <Loader2 className="h-5 w-5 animate-spin" /> Loading server evidence…
                  </div>
                ) : (
                  <>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                      {[
                        ['Exam score', `${evidence?.attempt.academicScore ?? selectedAttempt.score}%`],
                        ['Integrity risk', `${summary?.evidenceRiskScore ?? selectedAttempt.suspiciousScore}%`],
                        ['Recorded events', summary?.eventCount ?? events.length],
                        ['Visual alerts', summary?.visualEventCount ?? events.filter((event) => visualEvent(event.eventType)).length],
                        ['Snapshots', summary?.snapshotCount ?? events.filter((event) => Boolean(event.snapshotPath)).length],
                      ].map(([label, value]) => (
                        <div key={String(label)} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
                          <p className="text-[9px] font-black uppercase text-slate-400">{String(label)}</p>
                          <p className="mt-1 text-lg font-black text-slate-950">{String(value)}</p>
                        </div>
                      ))}
                    </div>

                    {(summary?.legacyScoreMismatch || (!events.length && selectedAttempt.suspiciousScore > 0)) && (
                      <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                        <p className="font-black">Unsubstantiated legacy score detected</p>
                        <p className="mt-1 text-xs leading-5">The displayed legacy percentage does not match persisted evidence. It must not be used for an adverse decision. Record “insufficient evidence” to complete the correction and audit trail.</p>
                      </div>
                    )}

                    <div className="mt-4 flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <span className="mr-1 self-center text-[10px] font-black uppercase text-slate-400">Evidence decision</span>
                      <button disabled={busy} onClick={() => void runDecision('insufficient_evidence', 'Explain why the available record is insufficient evidence:')} className="rounded-lg bg-slate-700 px-3 py-2 text-xs font-black text-white disabled:opacity-40">Insufficient evidence</button>
                      <button disabled={busy} onClick={() => void runDecision('clear', 'State the evidence-based reason for clearing this attempt:')} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-black text-white disabled:opacity-40">Clear after review</button>
                      <button disabled={busy || !summary || summary.eventCount === 0} onClick={() => void runDecision('flag_attempt', 'State the specific persisted evidence supporting this flag:')} className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-black text-white disabled:opacity-40">Flag with evidence</button>
                      <button disabled={busy || !summary || summary.evidenceRiskScore < 60} onClick={() => void runDecision('invalidate_attempt', 'State the evidence supporting invalidation of this attempt:')} className="rounded-lg bg-rose-700 px-3 py-2 text-xs font-black text-white disabled:opacity-40">Invalidate attempt</button>
                    </div>
                  </>
                )}
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-black text-slate-950">Proctoring event report</h3>
                    <p className="mt-1 text-xs text-slate-500">Chronological, server-persisted events with their individual risk contribution.</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black text-slate-600">{events.length} total</span>
                </div>

                {!events.length ? (
                  <div className="mt-5 rounded-xl border border-dashed border-amber-300 bg-amber-50 p-7 text-center text-amber-900">
                    <FileWarning className="mx-auto h-7 w-7" />
                    <p className="mt-2 font-black">No supporting event exists</p>
                    <p className="mt-1 text-xs">The system cannot infer misconduct from a standalone percentage.</p>
                  </div>
                ) : (
                  <div className="mt-5 space-y-4 border-l-2 border-slate-100 pl-5">
                    {events.map((event) => (
                      <article key={event.id} className="relative rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <span className={`absolute -left-[27px] top-5 h-3.5 w-3.5 rounded-full border-2 border-white ${event.severity === 'high' ? 'bg-rose-500' : event.severity === 'medium' ? 'bg-amber-500' : 'bg-slate-400'}`} />
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-black uppercase text-slate-900">{displayEventType(event.eventType)}</p>
                            <p className="mt-1 flex flex-wrap gap-2 text-[10px] font-bold text-slate-500">
                              <span>{event.source.replaceAll('_', ' ')}</span>
                              <span>•</span>
                              <span>{event.severity} severity</span>
                              <span>•</span>
                              <span>+{event.riskWeight} risk</span>
                              {event.confidence !== null && <><span>•</span><span>{Math.round(event.confidence * 100)}% confidence</span></>}
                            </p>
                          </div>
                          <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400"><Clock className="h-3 w-3" />{new Date(event.occurredAt).toLocaleString()}</span>
                        </div>
                        <p className="mt-3 text-xs leading-5 text-slate-700">{event.message}</p>
                        {event.snapshotPath ? (
                          <button type="button" onClick={() => void openSnapshot(event.snapshotPath as string)} className="mt-3 flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-[11px] font-black text-slate-700 hover:bg-slate-100">
                            <Camera className="h-4 w-4" /> View private snapshot
                          </button>
                        ) : visualEvent(event.eventType) ? (
                          <p className="mt-3 rounded-lg bg-amber-100 p-2 text-[10px] font-bold text-amber-900">No snapshot retained. This visual event contributes zero to the evidence score.</p>
                        ) : null}
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
                <h3 className="font-black text-slate-950">Administrator review history</h3>
                {!evidence?.reviews.length ? (
                  <p className="mt-4 rounded-xl bg-slate-50 p-4 text-xs text-slate-500">No evidence decision has been recorded for this attempt.</p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {evidence.reviews.map((review) => (
                      <div key={review.id} className="rounded-xl border border-slate-200 p-4 text-xs">
                        <div className="flex flex-wrap justify-between gap-2">
                          <p className="font-black text-slate-900">{review.reviewerName} · {review.decision.replaceAll('_', ' ')}</p>
                          <p className="text-slate-400">{new Date(review.createdAt).toLocaleString()}</p>
                        </div>
                        <p className="mt-2 leading-5 text-slate-600">{review.reason}</p>
                        <p className="mt-2 font-bold text-slate-500">Evidence score {review.evidenceScore}% · {review.eventCount} events · {review.snapshotCount} snapshots</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </main>
      </div>

      <AnimatePresence>
        {expandedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setExpandedImage(null)}
            className="fixed inset-0 z-[100] flex cursor-pointer items-center justify-center bg-slate-950/95 p-4 backdrop-blur"
          >
            <div className="relative w-full max-w-3xl rounded-2xl border border-slate-700 bg-slate-900 p-3">
              <button type="button" onClick={() => setExpandedImage(null)} className="absolute right-5 top-5 z-10 rounded-full bg-slate-950/80 p-2 text-white"><X className="h-5 w-5" /></button>
              <img src={expandedImage} alt="Private examination integrity evidence" className="max-h-[80vh] w-full rounded-xl object-contain" />
              <p className="p-3 text-center text-xs font-bold text-slate-400">Private evidence link expires automatically.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

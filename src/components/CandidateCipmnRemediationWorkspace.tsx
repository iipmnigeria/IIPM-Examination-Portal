import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BookOpenCheck,
  CheckCircle2,
  Clock3,
  Loader2,
  LockKeyhole,
  MailCheck,
  RefreshCw,
  ShieldCheck,
  X,
  XCircle,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getCurrentPortalUser } from '../services/authService';
import {
  getMyCipmnAttemptReview,
  getMyCipmnRemediationAttempts,
  type CipmnAttemptReview,
  type CipmnRemediationAttempt,
} from '../services/cipmnRemediationService';

const answerLetter = (position: number | null): string =>
  position && position > 0 ? String.fromCharCode(64 + position) : '—';

const emailStatusLabel = (status: CipmnRemediationAttempt['reviewEmailStatus']): string => {
  if (!status) return 'Not queued';
  if (status === 'sent') return 'Email sent';
  if (status === 'processing') return 'Email processing';
  if (status === 'queued') return 'Email queued';
  if (status === 'suppressed') return 'Email suppressed';
  if (status === 'cancelled') return 'Email withheld';
  return 'Email retry pending';
};

export default function CandidateCipmnRemediationWorkspace() {
  const [isCandidate, setIsCandidate] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [attempts, setAttempts] = useState<CipmnRemediationAttempt[]>([]);
  const [review, setReview] = useState<CipmnAttemptReview | null>(null);
  const [loading, setLoading] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [error, setError] = useState('');

  const availableCount = useMemo(
    () => attempts.filter((attempt) => attempt.reviewAvailable).length,
    [attempts],
  );

  const refreshAuthorisation = async () => {
    try {
      const current = await getCurrentPortalUser();
      const candidate = current?.profile.role === 'candidate';
      setIsCandidate(candidate);
      if (!candidate) {
        setIsOpen(false);
        setReview(null);
        setAttempts([]);
      }
    } catch {
      setIsCandidate(false);
      setIsOpen(false);
      setReview(null);
      setAttempts([]);
    }
  };

  const loadAttempts = async () => {
    try {
      setLoading(true);
      setError('');
      setAttempts(await getMyCipmnRemediationAttempts());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load CIPMN attempt history.');
    } finally {
      setLoading(false);
    }
  };

  const openWorkspace = () => {
    if (!isCandidate) return;
    setReview(null);
    setIsOpen(true);
    void loadAttempts();
  };

  const openReview = async (attempt: CipmnRemediationAttempt) => {
    if (!attempt.reviewAvailable) return;
    try {
      setReviewLoading(true);
      setError('');
      setReview(await getMyCipmnAttemptReview(attempt.attemptId));
      await loadAttempts();
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : 'Unable to open the remediation review.');
    } finally {
      setReviewLoading(false);
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
    const open = () => openWorkspace();
    window.addEventListener('agilecert-cipmn-remediation-open', open);
    return () => window.removeEventListener('agilecert-cipmn-remediation-open', open);
  }, [isCandidate]);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (review) setReview(null);
        else setIsOpen(false);
      }
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [isOpen, review]);

  if (!isCandidate || !isOpen) return null;

  return (
    <div className="fixed inset-0 z-[125] overflow-y-auto bg-slate-950/75 p-3 backdrop-blur-sm md:p-6">
      <section className="mx-auto min-h-[calc(100vh-1.5rem)] w-full max-w-6xl overflow-hidden rounded-3xl bg-white shadow-2xl md:min-h-0">
        <header className="flex items-start justify-between gap-4 bg-slate-950 px-5 py-5 text-white md:px-8">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-600">
              <BookOpenCheck className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">CIPMN learning remediation</p>
              <h2 className="text-xl font-black md:text-2xl">
                {review ? 'Protected third-attempt answer review' : 'CIPMN attempt and review centre'}
              </h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-300">
                Correct answers and explanations are released only after the third completed attempt and only after examination-integrity clearance.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setReview(null);
              setIsOpen(false);
            }}
            className="rounded-xl border border-slate-700 p-2 text-slate-300 hover:bg-slate-800 hover:text-white"
            aria-label="Close CIPMN remediation workspace"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="space-y-5 p-5 md:p-8">
          {error && (
            <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
            </div>
          )}

          {review ? (
            <>
              <button
                type="button"
                onClick={() => setReview(null)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50"
              >
                <ArrowLeft className="h-4 w-4" /> Back to attempts
              </button>

              <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:grid-cols-2 lg:grid-cols-5">
                <div className="sm:col-span-2 lg:col-span-2">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Examination</p>
                  <p className="mt-1 text-sm font-black text-slate-900">{review.examinationTitle}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Attempt</p>
                  <p className="mt-1 text-sm font-black text-slate-900">3 of 3</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Score</p>
                  <p className={`mt-1 text-sm font-black ${review.score >= review.passMark ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {review.score}%
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">To review</p>
                  <p className="mt-1 text-sm font-black text-slate-900">{review.incorrectCount} of {review.questionCount}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-blue-950">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
                <p className="text-sm leading-6">
                  This page shows only the questions answered incorrectly or left unanswered in your third attempt. The answer data is delivered by a protected server function and is not included in the public examination catalogue.
                </p>
              </div>

              {review.items.length === 0 ? (
                <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-8 text-center">
                  <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
                  <h3 className="mt-3 text-lg font-black text-emerald-950">No failed answers to review</h3>
                  <p className="mt-2 text-sm text-emerald-800">Every recorded response in your third attempt matched the protected answer key.</p>
                </div>
              ) : (
                <div className="space-y-5">
                  {review.items.map((item) => (
                    <article key={item.questionId} className="overflow-hidden rounded-2xl border border-slate-200">
                      <div className="flex items-start gap-3 border-b border-slate-200 bg-slate-50 p-4 md:p-5">
                        <span className="rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-black text-white">Q{item.questionNumber}</span>
                        <p className="text-sm font-bold leading-6 text-slate-900 md:text-base">{item.questionText}</p>
                      </div>
                      <div className="grid gap-4 p-4 md:grid-cols-2 md:p-5">
                        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                          <div className="flex items-center gap-2 text-rose-800">
                            <XCircle className="h-4 w-4" />
                            <p className="text-xs font-black uppercase tracking-wider">Your answer</p>
                          </div>
                          <p className="mt-2 text-sm font-semibold leading-6 text-rose-950">
                            <span className="mr-2 font-black">{answerLetter(item.selectedOptionPosition)}.</span>
                            {item.selectedOptionText || 'No answer was submitted.'}
                          </p>
                        </div>
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                          <div className="flex items-center gap-2 text-emerald-800">
                            <CheckCircle2 className="h-4 w-4" />
                            <p className="text-xs font-black uppercase tracking-wider">Correct answer</p>
                          </div>
                          <p className="mt-2 text-sm font-semibold leading-6 text-emerald-950">
                            <span className="mr-2 font-black">{answerLetter(item.correctOptionPosition)}.</span>
                            {item.correctOptionText}
                          </p>
                        </div>
                      </div>
                      <div className="border-t border-amber-200 bg-amber-50 px-4 py-4 md:px-5">
                        <p className="text-xs font-black uppercase tracking-wider text-amber-800">Why this is the correct professional response</p>
                        <p className="mt-2 text-sm leading-6 text-amber-950">{item.explanation}</p>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-lg font-black text-slate-900">Your CIPMN module attempts</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    {availableCount > 0
                      ? `${availableCount} protected remediation review${availableCount === 1 ? ' is' : 's are'} available.`
                      : 'Complete three attempts in a module to unlock its protected answer review.'}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void loadAttempts()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
                </button>
              </div>

              {loading ? (
                <div className="flex min-h-56 items-center justify-center gap-3 text-sm font-bold text-slate-500">
                  <Loader2 className="h-5 w-5 animate-spin text-emerald-600" /> Loading CIPMN attempts...
                </div>
              ) : attempts.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-300 p-10 text-center">
                  <BookOpenCheck className="mx-auto h-10 w-10 text-slate-300" />
                  <h3 className="mt-3 font-black text-slate-800">No CIPMN attempt history</h3>
                  <p className="mt-2 text-sm text-slate-500">Your CIPMN module attempts will appear here after submission.</p>
                </div>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  {attempts.map((attempt) => {
                    const cleanStatus = attempt.status === 'submitted' || attempt.status === 'reviewed';
                    const isThird = attempt.attemptNumber === 3;
                    return (
                      <article key={attempt.attemptId} className="rounded-2xl border border-slate-200 p-5 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Attempt {attempt.attemptNumber} of {attempt.maxAttempts}</p>
                            <h4 className="mt-1 text-sm font-black leading-6 text-slate-900">{attempt.examinationTitle}</h4>
                          </div>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-black ${attempt.score >= attempt.passMark ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                            {attempt.score}%
                          </span>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1">
                            <Clock3 className="h-3.5 w-3.5" /> {new Date(attempt.submittedAt).toLocaleDateString()}
                          </span>
                          {isThird && attempt.reviewAvailable && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-800">
                              <MailCheck className="h-3.5 w-3.5" /> {emailStatusLabel(attempt.reviewEmailStatus)}
                            </span>
                          )}
                        </div>

                        <div className="mt-4 border-t border-slate-100 pt-4">
                          {attempt.reviewAvailable ? (
                            <button
                              type="button"
                              disabled={reviewLoading}
                              onClick={() => void openReview(attempt)}
                              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-black text-white hover:bg-emerald-800 disabled:opacity-60"
                            >
                              {reviewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpenCheck className="h-4 w-4" />}
                              View failed answers and explanations
                            </button>
                          ) : !isThird ? (
                            <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-600">
                              <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />
                              <p className="text-xs leading-5">Correct answers remain locked until the third completed attempt for this module.</p>
                            </div>
                          ) : !cleanStatus ? (
                            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900">
                              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                              <p className="text-xs leading-5">The review is withheld pending examination-integrity clearance.</p>
                            </div>
                          ) : (
                            <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-600">
                              <Loader2 className="mt-0.5 h-4 w-4 shrink-0" />
                              <p className="text-xs leading-5">The protected review is being prepared. Refresh shortly.</p>
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}

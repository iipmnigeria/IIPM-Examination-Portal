import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  IdCard,
  Loader2,
  RefreshCw,
  ShieldCheck,
  X,
  XCircle,
} from 'lucide-react';
import {
  getAgileCertIdentityReviewFiles,
  listAgileCertIdentityReviewQueue,
  reviewAgileCertIdentityRequest,
  type AgileCertIdentityReviewQueueItem,
} from '../services/adminIdentityVerificationService';

type QueueStatus = 'submitted' | 'processing' | 'rejected' | 'verified';

export default function AgileCertAdminIdentityReview() {
  const [isStaff, setIsStaff] = useState(
    () => localStorage.getItem('aura_logged_role') === 'admin',
  );
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<QueueStatus>('submitted');
  const [items, setItems] = useState<AgileCertIdentityReviewQueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const checkRole = () => {
      const staff = localStorage.getItem('aura_logged_role') === 'admin';
      setIsStaff(staff);
      if (!staff) setIsOpen(false);
    };
    checkRole();
    const interval = window.setInterval(checkRole, 1_000);
    window.addEventListener('storage', checkRole);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('storage', checkRole);
    };
  }, []);

  const loadQueue = async (nextStatus = status) => {
    try {
      setIsLoading(true);
      setError('');
      const queue = await listAgileCertIdentityReviewQueue(nextStatus, 100);
      setItems(queue);
    } catch (loadError: any) {
      setError(loadError?.message || 'The identity-review queue could not be loaded.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !isStaff) return;
    void loadQueue();
  }, [isOpen, isStaff, status]);

  const openFiles = async (item: AgileCertIdentityReviewQueueItem) => {
    try {
      setActiveRequestId(item.id);
      setError('');
      const files = await getAgileCertIdentityReviewFiles(item.id);
      window.open(files.documentUrl, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => {
        window.open(files.selfieUrl, '_blank', 'noopener,noreferrer');
      }, 250);
      setMessage('Secure document and selfie links opened. They expire in 10 minutes.');
    } catch (fileError: any) {
      setError(fileError?.message || 'Identity-review files could not be opened.');
    } finally {
      setActiveRequestId(null);
    }
  };

  const approve = async (item: AgileCertIdentityReviewQueueItem) => {
    try {
      setActiveRequestId(item.id);
      setError('');
      setMessage('');
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 3);
      await reviewAgileCertIdentityRequest({
        requestId: item.id,
        decision: 'verified',
        expiresAt: expiresAt.toISOString(),
        documentAuthenticityScore: item.document_authenticity_score ?? 100,
        identityMatchScore: item.identity_match_score ?? 100,
      });
      setMessage(`${item.legal_name || item.candidate_email} has been identity-verified.`);
      await loadQueue();
    } catch (reviewError: any) {
      setError(reviewError?.message || 'The identity request could not be approved.');
    } finally {
      setActiveRequestId(null);
    }
  };

  const reject = async (item: AgileCertIdentityReviewQueueItem) => {
    const reason = rejectionReasons[item.id]?.trim();
    if (!reason) {
      setError('Enter a clear rejection reason before rejecting this request.');
      return;
    }

    try {
      setActiveRequestId(item.id);
      setError('');
      setMessage('');
      await reviewAgileCertIdentityRequest({
        requestId: item.id,
        decision: 'rejected',
        rejectionReason: reason,
      });
      setMessage(`${item.legal_name || item.candidate_email} was notified to resubmit identity documents.`);
      setRejectionReasons((current) => ({ ...current, [item.id]: '' }));
      await loadQueue();
    } catch (reviewError: any) {
      setError(reviewError?.message || 'The identity request could not be rejected.');
    } finally {
      setActiveRequestId(null);
    }
  };

  if (!isStaff) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-5 left-5 z-[92] inline-flex items-center gap-2 rounded-full border border-blue-300/20 bg-blue-700 px-4 py-3 text-xs font-black text-white shadow-2xl hover:bg-blue-800 md:text-sm"
      >
        <IdCard className="h-4 w-4" /> Identity Review
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[165] flex items-center justify-center overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm">
          <section className="my-6 flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <header className="flex items-center justify-between bg-slate-950 px-6 py-5 text-white">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-300">AgileCert Staff Control</p>
                <h2 className="mt-1 text-xl font-black">Identity Exception Review</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-full border border-slate-700 p-2 text-slate-300 hover:bg-slate-800 hover:text-white"
                aria-label="Close identity review"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4">
              <div className="flex flex-wrap gap-2">
                {(['submitted', 'processing', 'rejected', 'verified'] as QueueStatus[]).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setStatus(option)}
                    className={`rounded-full px-3 py-1.5 text-xs font-black capitalize ${
                      status === option
                        ? 'bg-slate-950 text-white'
                        : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => void loadQueue()}
                disabled={isLoading}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {isLoading ? (
                <div className="flex min-h-72 flex-col items-center justify-center gap-3 text-slate-500">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-700" />
                  <p className="text-sm font-bold">Loading identity-review cases...</p>
                </div>
              ) : items.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
                  <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
                  <p className="mt-3 font-black text-slate-800">No {status} identity cases</p>
                  <p className="mt-1 text-sm text-slate-500">The exception queue is currently clear.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {items.map((item) => (
                    <article key={item.id} className="rounded-2xl border border-slate-200 p-5 shadow-sm">
                      <div className="grid gap-5 lg:grid-cols-[1fr_0.85fr]">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-black uppercase text-blue-700">
                              {item.status}
                            </span>
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase text-slate-500">
                              {item.document_type.replaceAll('_', ' ')}
                            </span>
                          </div>
                          <h3 className="mt-3 text-lg font-black text-slate-950">
                            {item.legal_name || 'Candidate name unavailable'}
                          </h3>
                          <p className="mt-1 text-sm text-slate-500">{item.candidate_email}</p>
                          <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
                            <div className="rounded-xl bg-slate-50 p-3">
                              <dt className="font-black uppercase tracking-wider text-slate-400">Request</dt>
                              <dd className="mt-1 font-mono font-bold text-slate-700">{item.request_reference}</dd>
                            </div>
                            <div className="rounded-xl bg-slate-50 p-3">
                              <dt className="font-black uppercase tracking-wider text-slate-400">Issuing country</dt>
                              <dd className="mt-1 font-black text-slate-700">{item.issuing_country_code}</dd>
                            </div>
                            <div className="rounded-xl bg-slate-50 p-3">
                              <dt className="font-black uppercase tracking-wider text-slate-400">Document suffix</dt>
                              <dd className="mt-1 font-mono font-bold text-slate-700">•••• {item.document_number_last4 || 'not provided'}</dd>
                            </div>
                            <div className="rounded-xl bg-slate-50 p-3">
                              <dt className="font-black uppercase tracking-wider text-slate-400">Submitted</dt>
                              <dd className="mt-1 font-bold text-slate-700">
                                {new Date(item.submitted_at || item.created_at).toLocaleString()}
                              </dd>
                            </div>
                          </dl>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <button
                            type="button"
                            onClick={() => void openFiles(item)}
                            disabled={activeRequestId === item.id}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white hover:bg-slate-800 disabled:opacity-60"
                          >
                            {activeRequestId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                            Open Secure Files
                          </button>

                          {['submitted', 'processing'].includes(item.status) && (
                            <>
                              <div className="mt-3 grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  onClick={() => void approve(item)}
                                  disabled={activeRequestId === item.id}
                                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-black text-white hover:bg-emerald-700 disabled:opacity-60"
                                >
                                  <ShieldCheck className="h-4 w-4" /> Approve
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void reject(item)}
                                  disabled={activeRequestId === item.id}
                                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-3 py-2.5 text-xs font-black text-white hover:bg-rose-700 disabled:opacity-60"
                                >
                                  <XCircle className="h-4 w-4" /> Reject
                                </button>
                              </div>
                              <textarea
                                value={rejectionReasons[item.id] || ''}
                                onChange={(event) =>
                                  setRejectionReasons((current) => ({
                                    ...current,
                                    [item.id]: event.target.value.slice(0, 1000),
                                  }))
                                }
                                placeholder="Reason required only when rejecting..."
                                className="mt-3 min-h-20 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                              />
                            </>
                          )}

                          {item.rejection_reason && (
                            <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs leading-5 text-rose-700">
                              <p className="flex items-center gap-1.5 font-black"><AlertTriangle className="h-4 w-4" /> Rejection reason</p>
                              <p className="mt-1">{item.rejection_reason}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}

              {error && (
                <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>
              )}
              {message && (
                <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{message}</div>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

import { useEffect, useState } from 'react';
import {
  BadgeCheck,
  ExternalLink,
  FileSearch,
  Loader2,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  X,
  XCircle,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getCurrentPortalUser } from '../services/authService';
import {
  createIdentityEvidenceSignedUrl,
  getIdentityAssuranceAdminConsole,
  reviewIdentityAssurance,
  type AdminIdentityAssuranceConsole,
  type IdentityAssuranceStatus,
  type IdentityAssuranceSubmission,
} from '../services/identityAssuranceService';

const emptyConsole: AdminIdentityAssuranceConsole = {
  submissions: [],
  audits: [],
  counts: {
    submitted: 0,
    underReview: 0,
    changesRequested: 0,
    approved: 0,
    rejected: 0,
  },
};

const formatDate = (value?: string | null) => {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const statusLabel = (status: string) => status.replaceAll('_', ' ');

export default function AdminIdentityAssuranceLauncher() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [workspace, setWorkspace] = useState<AdminIdentityAssuranceConsole>(emptyConsole);
  const [filter, setFilter] = useState<IdentityAssuranceStatus | ''>('');
  const [selected, setSelected] = useState<IdentityAssuranceSubmission | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [busy, setBusy] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const refreshAuthorisation = async () => {
    try {
      const current = await getCurrentPortalUser();
      const admin = current?.profile.is_active === true
        && ['exam_admin', 'super_admin'].includes(current.profile.role);
      setIsAdmin(admin);
      if (!admin) setIsOpen(false);
    } catch {
      setIsAdmin(false);
      setIsOpen(false);
    }
  };

  const refresh = async () => {
    if (!isAdmin) return;
    try {
      setIsLoading(true);
      setError('');
      const next = await getIdentityAssuranceAdminConsole(filter, 200);
      setWorkspace(next);
      if (selected) {
        setSelected(next.submissions.find((item) => item.id === selected.id) || null);
      }
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Unable to load identity-assurance administration.');
    } finally {
      setIsLoading(false);
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
    if (isOpen && isAdmin) void refresh();
  }, [isOpen, isAdmin, filter]);

  const openEvidence = async (submission: IdentityAssuranceSubmission) => {
    try {
      setBusy(`evidence:${submission.id}`);
      setError('');
      if (!submission.evidenceObjectPath) throw new Error('The private evidence path is unavailable.');
      const signedUrl = await createIdentityEvidenceSignedUrl(submission.evidenceObjectPath);
      window.open(signedUrl, '_blank', 'noopener,noreferrer');
    } catch (evidenceError) {
      setError(evidenceError instanceof Error ? evidenceError.message : 'Unable to open private evidence.');
    } finally {
      setBusy('');
    }
  };

  const decide = async (
    decision: 'under_review' | 'changes_requested' | 'approved' | 'rejected',
  ) => {
    if (!selected) return;
    try {
      setBusy(decision);
      setError('');
      setMessage('');
      await reviewIdentityAssurance({
        verificationId: selected.id,
        decision,
        reviewNote,
      });
      setMessage(`Identity assurance marked ${statusLabel(decision)}.`);
      setReviewNote('');
      await refresh();
      window.dispatchEvent(new Event('agilecert-identity-assurance-refresh'));
      window.dispatchEvent(new Event('agilecert-certificate-commerce-refresh'));
    } catch (decisionError) {
      setError(decisionError instanceof Error ? decisionError.message : 'Unable to save the review decision.');
    } finally {
      setBusy('');
    }
  };

  if (!isAdmin) return null;

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-36 right-5 z-[83] inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-slate-950 px-4 py-3 text-xs font-extrabold text-white shadow-2xl transition hover:-translate-y-0.5 hover:bg-slate-900"
        aria-label="Open identity review administration"
      >
        <ShieldCheck className="h-4 w-4 text-blue-300" />
        <span className="hidden sm:inline">Identity Review</span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[147] overflow-y-auto bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-slate-950 text-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4">
          <div>
            <h1 className="text-lg font-black">Identity Assurance Administration</h1>
            <p className="mt-1 text-xs text-slate-400">Manual IIPM review of private non-government professional evidence</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void refresh()} className="rounded-lg border border-slate-700 p-2 text-slate-300" aria-label="Refresh identity review console">
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button type="button" onClick={() => setIsOpen(false)} className="rounded-lg border border-slate-700 p-2 text-slate-300" aria-label="Close identity review console">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8">
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ['Submitted', workspace.counts.submitted],
            ['Under review', workspace.counts.underReview],
            ['Changes requested', workspace.counts.changesRequested],
            ['Approved', workspace.counts.approved],
            ['Rejected', workspace.counts.rejected],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-black uppercase tracking-wide text-slate-400">{String(label)}</p>
              <p className="mt-2 text-3xl font-black">{Number(value)}</p>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          <p className="font-black">Reviewer privacy obligation</p>
          <p className="mt-1 leading-6">Evidence links are private and expire after five minutes. Do not download, redistribute or retain evidence outside authorised IIPM review processes.</p>
        </section>

        {error && <div className="rounded-xl border border-rose-200 bg-white p-4 text-sm font-bold text-rose-700">{error}</div>}
        {message && <div className="rounded-xl border border-emerald-200 bg-white p-4 text-sm font-bold text-emerald-700">{message}</div>}

        <section className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div><h2 className="text-xl font-black">Review queue</h2><p className="mt-1 text-sm text-slate-500">Select a submission to inspect and decide.</p></div>
              <select value={filter} onChange={(event) => setFilter(event.target.value as IdentityAssuranceStatus | '')} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold">
                <option value="">All statuses</option>
                <option value="submitted">Submitted</option>
                <option value="under_review">Under review</option>
                <option value="changes_requested">Changes requested</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="withdrawn">Withdrawn</option>
                <option value="expired">Expired</option>
              </select>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-100 text-xs uppercase tracking-wider text-slate-500">
                  <tr><th className="p-4">Candidate</th><th className="p-4">Evidence</th><th className="p-4">Status</th><th className="p-4">Submitted</th><th className="p-4">Action</th></tr>
                </thead>
                <tbody>
                  {workspace.submissions.map((submission) => (
                    <tr key={submission.id} className={`border-t border-slate-100 ${selected?.id === submission.id ? 'bg-blue-50' : ''}`}>
                      <td className="p-4"><p className="font-black">{submission.candidateName || submission.legalNameSnapshot}</p><p className="mt-1 text-xs text-slate-500">{submission.candidateEmail}</p></td>
                      <td className="p-4"><p className="font-bold">{submission.evidenceFilename}</p><p className="mt-1 text-xs text-slate-500">{submission.affiliationName}</p></td>
                      <td className="p-4"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase">{statusLabel(submission.status)}</span></td>
                      <td className="p-4">{formatDate(submission.submittedAt)}</td>
                      <td className="p-4"><button type="button" onClick={() => { setSelected(submission); setReviewNote(submission.reviewNote || ''); }} className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-black text-white">Review</button></td>
                    </tr>
                  ))}
                  {!workspace.submissions.length && <tr><td colSpan={5} className="p-8 text-center text-slate-500">No identity-assurance submissions match this filter.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            {!selected ? (
              <div className="grid min-h-72 place-items-center text-center text-sm text-slate-500"><div><UserCheck className="mx-auto h-10 w-10 text-slate-300" /><p className="mt-3">Select a submission from the queue.</p></div></div>
            ) : (
              <div className="space-y-5">
                <div><h2 className="text-lg font-black">{selected.candidateName || selected.legalNameSnapshot}</h2><p className="mt-1 text-sm text-slate-500">{selected.candidateEmail}</p></div>
                <dl className="space-y-3 text-sm">
                  <div><dt className="text-xs font-black uppercase text-slate-400">Verified-name snapshot</dt><dd className="mt-1 font-bold">{selected.legalNameSnapshot}</dd></div>
                  <div><dt className="text-xs font-black uppercase text-slate-400">Phone and country</dt><dd className="mt-1 font-bold">{selected.phoneSnapshot} · {selected.countryCodeSnapshot}</dd></div>
                  <div><dt className="text-xs font-black uppercase text-slate-400">Affiliation</dt><dd className="mt-1 font-bold">{selected.affiliationName}</dd><dd className="text-xs text-slate-500">{selected.affiliationReference || 'No reference provided'}</dd></div>
                  <div><dt className="text-xs font-black uppercase text-slate-400">Evidence category</dt><dd className="mt-1 font-bold">{statusLabel(selected.evidenceCategory)}</dd></div>
                  {selected.candidateNotes && <div><dt className="text-xs font-black uppercase text-slate-400">Candidate notes</dt><dd className="mt-1 leading-6">{selected.candidateNotes}</dd></div>}
                </dl>

                <button type="button" disabled={busy === `evidence:${selected.id}`} onClick={() => void openEvidence(selected)} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-black text-blue-800 disabled:opacity-50">
                  {busy === `evidence:${selected.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />} Open private evidence
                </button>

                {['submitted', 'under_review'].includes(selected.status) && (
                  <div className="space-y-3 border-t border-slate-100 pt-5">
                    <label className="text-sm font-bold">Mandatory review note<textarea value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} rows={4} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 font-normal" placeholder="Record the evidence checked and reason for the decision" /></label>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <button type="button" disabled={Boolean(busy)} onClick={() => void decide('under_review')} className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 px-3 py-2 text-xs font-black text-blue-700 disabled:opacity-50"><FileSearch className="h-4 w-4" /> Start review</button>
                      <button type="button" disabled={Boolean(busy)} onClick={() => void decide('changes_requested')} className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-200 px-3 py-2 text-xs font-black text-amber-700 disabled:opacity-50"><RefreshCw className="h-4 w-4" /> Request changes</button>
                      <button type="button" disabled={Boolean(busy)} onClick={() => void decide('approved')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-3 py-2 text-xs font-black text-white disabled:opacity-50"><BadgeCheck className="h-4 w-4" /> Approve</button>
                      <button type="button" disabled={Boolean(busy)} onClick={() => void decide('rejected')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-700 px-3 py-2 text-xs font-black text-white disabled:opacity-50"><XCircle className="h-4 w-4" /> Reject</button>
                    </div>
                    {busy && <p className="flex items-center gap-2 text-xs font-bold text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Saving review decision…</p>}
                  </div>
                )}

                {!['submitted', 'under_review'].includes(selected.status) && selected.reviewNote && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm"><p className="text-xs font-black uppercase text-slate-400">Recorded review note</p><p className="mt-2 leading-6">{selected.reviewNote}</p><p className="mt-2 text-xs text-slate-500">Reviewed {formatDate(selected.reviewedAt)}</p></div>
                )}
              </div>
            )}
          </aside>
        </section>
      </main>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import {
  Award,
  BadgeCheck,
  Clock3,
  Download,
  FileCheck2,
  Loader2,
  LockKeyhole,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react';
import { downloadCertificatePdf } from '../services/certificatePdfService';
import { supabase } from '../lib/supabase';
import { getCurrentPortalUser } from '../services/authService';
import {
  getMyCertificateWorkspace,
  requestMyCertificate,
  type CandidateCertificateItem,
  type CandidateCertificateWorkspace as CertificateWorkspace,
} from '../services/certificateService';

const reasonLabels: Record<string, string> = {
  candidate_inactive: 'The candidate account is inactive.',
  policy_inactive: 'Certificate issuance is not active for this examination.',
  attempt_incomplete: 'The examination attempt has not reached a final result.',
  score_below_pass_mark: 'The examination score is below the required pass mark.',
  integrity_rejected: 'The examination session was terminated and requires administrator review.',
  integrity_flagged: 'The proctor-integrity score requires administrator review.',
  eligible: 'The result meets the current certificate policy.',
};

const emptyWorkspace: CertificateWorkspace = {
  items: [],
  counts: { eligible: 0, requested: 0, issued: 0, blocked: 0 },
};

const formatDate = (value?: string | null): string => {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

const eligibilityBadge = (item: CandidateCertificateItem) => {
  if (item.certificate?.status === 'active') {
    return { label: 'Issued & active', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' };
  }
  if (item.certificate?.status === 'suspended') {
    return { label: 'Suspended', className: 'border-amber-200 bg-amber-50 text-amber-700' };
  }
  if (item.certificate?.status === 'revoked') {
    return { label: 'Revoked', className: 'border-rose-200 bg-rose-50 text-rose-700' };
  }
  if (item.approvalStatus === 'changes_requested') {
    return { label: 'Changes requested', className: 'border-amber-200 bg-amber-50 text-amber-700' };
  }
  if (item.approvalStatus === 'rejected') {
    return { label: 'Request rejected', className: 'border-rose-200 bg-rose-50 text-rose-700' };
  }
  if (item.approvalStatus === 'pending') {
    return { label: 'Approval pending', className: 'border-blue-200 bg-blue-50 text-blue-700' };
  }
  if (item.eligibilityStatus === 'requested') {
    return { label: 'Issuance requested', className: 'border-blue-200 bg-blue-50 text-blue-700' };
  }
  if (item.eligibilityStatus === 'eligible') {
    return { label: 'Eligible', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' };
  }
  return { label: 'Not eligible', className: 'border-slate-200 bg-slate-100 text-slate-600' };
};

export default function CandidateCertificateWorkspace() {
  const [isCandidate, setIsCandidate] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [workspace, setWorkspace] = useState<CertificateWorkspace>(emptyWorkspace);
  const [isLoading, setIsLoading] = useState(false);
  const [requestingAttemptId, setRequestingAttemptId] = useState('');
  const [downloadingCertificateId, setDownloadingCertificateId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const refreshAuthorisation = async () => {
    try {
      const current = await getCurrentPortalUser();
      const candidate = current?.profile.role === 'candidate';
      setIsCandidate(candidate);
      if (!candidate) {
        setIsOpen(false);
        setWorkspace(emptyWorkspace);
      }
    } catch (authError) {
      console.error('Unable to resolve certificate workspace access:', authError);
      setIsCandidate(false);
      setIsOpen(false);
    }
  };

  const refreshWorkspace = async () => {
    if (!isCandidate) return;
    try {
      setIsLoading(true);
      setError('');
      const next = await getMyCertificateWorkspace();
      setWorkspace(next);
    } catch (refreshError) {
      console.error('Unable to load candidate certificate workspace:', refreshError);
      setError(refreshError instanceof Error ? refreshError.message : 'Unable to load certificate records.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refreshAuthorisation();
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      window.setTimeout(() => void refreshAuthorisation(), 0);
    });
    const openHandler = () => {
      setIsOpen(true);
      setMessage('');
      setError('');
    };
    window.addEventListener('agilecert-certificates-open', openHandler);
    return () => {
      listener.subscription.unsubscribe();
      window.removeEventListener('agilecert-certificates-open', openHandler);
    };
  }, []);

  useEffect(() => {
    if (isOpen && isCandidate) void refreshWorkspace();
  }, [isOpen, isCandidate]);

  const issuedCertificates = useMemo(
    () => workspace.items.filter((item) => Boolean(item.certificate)),
    [workspace.items],
  );

  const handleRequest = async (item: CandidateCertificateItem) => {
    try {
      setRequestingAttemptId(item.attemptId);
      setError('');
      setMessage('');
      const result = await requestMyCertificate(item.attemptId);
      setMessage(result.message);
      await refreshWorkspace();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to request certificate issuance.');
    } finally {
      setRequestingAttemptId('');
    }
  };

  const handleDownload = async (certificateId: string) => {
    try {
      setDownloadingCertificateId(certificateId);
      setError('');
      setMessage('');
      await downloadCertificatePdf(certificateId);
      setMessage('The QR-coded certificate PDF was generated from the current server record.');
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'Unable to download the certificate PDF.');
    } finally {
      setDownloadingCertificateId('');
    }
  };

  if (!isCandidate) return null;

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-5 right-5 z-[82] inline-flex items-center gap-2 rounded-full border border-amber-300/40 bg-slate-950 px-4 py-3 text-xs font-extrabold text-white shadow-2xl transition hover:-translate-y-0.5 hover:bg-slate-900"
        aria-label="Open certificates workspace"
      >
        <Award className="h-4 w-4 text-amber-400" />
        <span className="hidden sm:inline">Certificates</span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[140] overflow-y-auto bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-slate-950 text-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-amber-500/15 p-2.5 text-amber-400">
              <Award className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-base font-extrabold">Certificate Authority Workspace</h1>
              <p className="text-xs text-slate-400">Server-evaluated eligibility, controlled issuance and public verification</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void refreshWorkspace()}
              disabled={isLoading}
              className="rounded-lg border border-slate-700 bg-slate-900 p-2 text-slate-300 transition hover:bg-slate-800 disabled:opacity-50"
              aria-label="Refresh certificate workspace"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-lg border border-slate-700 bg-slate-900 p-2 text-slate-300 transition hover:bg-slate-800"
              aria-label="Close certificate workspace"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8">
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Eligible', workspace.counts.eligible, BadgeCheck, 'text-emerald-600'],
            ['Requested', workspace.counts.requested, Clock3, 'text-blue-600'],
            ['Issued', workspace.counts.issued, Award, 'text-amber-600'],
            ['Blocked', workspace.counts.blocked, LockKeyhole, 'text-slate-500'],
          ].map(([label, value, Icon, colour]) => (
            <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-extrabold uppercase tracking-wider text-slate-400">{String(label)}</p>
                <Icon className={`h-5 w-5 ${String(colour)}`} />
              </div>
              <p className="mt-3 text-3xl font-black text-slate-950">{Number(value)}</p>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-900">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
            <div>
              <h2 className="font-extrabold">Controlled issuance</h2>
              <p className="mt-1 leading-relaxed text-blue-800">
                Passing a test creates eligibility, not a certificate. Submit an issuance request after your result is cleared.
                An authorised IIPM administrator issues the immutable certificate record. Certificate pricing and payment are not changed in this phase.
              </p>
            </div>
          </div>
        </section>

        {message && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            {message}
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="grid min-h-72 place-items-center rounded-2xl border border-slate-200 bg-white">
            <div className="flex flex-col items-center gap-3 text-slate-500">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
              <p className="text-sm font-bold">Evaluating authoritative examination results...</p>
            </div>
          </div>
        ) : workspace.items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <FileCheck2 className="mx-auto h-10 w-10 text-slate-300" />
            <h2 className="mt-4 font-extrabold text-slate-800">No completed examination results</h2>
            <p className="mt-2 text-sm text-slate-500">Complete an examination to create a server-evaluated certificate eligibility record.</p>
          </div>
        ) : (
          <section className="grid gap-5 lg:grid-cols-2">
            {workspace.items.map((item) => {
              const badge = eligibilityBadge(item);
              const certificate = item.certificate;
              const canRequest = (item.eligibilityStatus === 'eligible' || item.approvalStatus === 'changes_requested') && !certificate;
              return (
                <article key={item.eligibilityId} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                        {item.programmeCode || 'IIPM Certificate'}
                      </p>
                      <h2 className="mt-1 text-lg font-extrabold leading-snug text-slate-950">{item.examinationTitle}</h2>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase ${badge.className}`}>
                      {badge.label}
                    </span>
                  </div>

                  <div className="mt-5 grid grid-cols-3 gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4 text-center">
                    <div>
                      <p className="text-[9px] font-bold uppercase text-slate-400">Score</p>
                      <p className="mt-1 font-black text-emerald-600">{item.score}%</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold uppercase text-slate-400">Pass mark</p>
                      <p className="mt-1 font-black text-slate-800">{item.passMark}%</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold uppercase text-slate-400">Integrity</p>
                      <p className={`mt-1 font-black ${item.integrityStatus === 'cleared' ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {item.integrityStatus}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 text-xs text-slate-500">
                    Completed: <span className="font-semibold text-slate-700">{formatDate(item.completedAt)}</span>
                  </div>

                  {certificate ? (
                    <div className={`mt-5 rounded-xl border p-4 ${certificate.status === 'active' ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
                      <div className="flex items-start gap-3">
                        {certificate.status === 'active' ? (
                          <BadgeCheck className="h-5 w-5 shrink-0 text-emerald-600" />
                        ) : (
                          <ShieldAlert className="h-5 w-5 shrink-0 text-amber-600" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-extrabold text-slate-900">{certificate.certificateTitle}</p>
                          <p className="mt-1 break-all font-mono text-[11px] text-slate-600">{certificate.certificateNumber}</p>
                          <p className="mt-1 break-all font-mono text-[11px] text-slate-600">Verification: {certificate.verificationCode}</p>
                          <p className="mt-2 text-xs text-slate-600">Issued {formatDate(certificate.issueDate)} · Status: {certificate.status}</p>
                          {certificate.revocationReason && certificate.status !== 'active' && (
                            <p className="mt-2 text-xs font-semibold text-amber-800">{certificate.revocationReason}</p>
                          )}
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => window.dispatchEvent(new CustomEvent('agilecert-verify-code', { detail: certificate.verificationCode }))}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                        >
                          <ShieldCheck className="h-3.5 w-3.5" /> Verify
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDownload(certificate.id)}
                          disabled={certificate.status !== 'active' || downloadingCertificateId === certificate.id}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                          {downloadingCertificateId === certificate.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Download QR-coded PDF
                        </button>
                      </div>
                    </div>
                  ) : canRequest ? (
                    <div className="mt-5 space-y-3">
                      {item.approvalStatus === 'changes_requested' && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                          <p className="font-extrabold">Administrator changes requested</p>
                          <p className="mt-1">{item.approvalReason || 'Update the required candidate information before resubmitting.'}</p>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleRequest(item)}
                        disabled={requestingAttemptId === item.attemptId}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-extrabold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                      >
                        {requestingAttemptId === item.attemptId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        {item.approvalStatus === 'changes_requested' ? 'Resubmit certificate request' : 'Request certificate issuance'}
                      </button>
                    </div>
                  ) : item.approvalStatus === 'rejected' ? (
                    <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                      <p className="font-extrabold">Certificate request rejected</p>
                      <p className="mt-1 text-xs">{item.approvalReason || 'Contact IIPM support for further review.'}</p>
                    </div>
                  ) : item.eligibilityStatus === 'requested' ? (
                    <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                      <p className="font-extrabold">Issuance request submitted</p>
                      <p className="mt-1 text-xs">Administrator review is pending. Requested {formatDate(item.requestedAt)}.</p>
                    </div>
                  ) : (
                    <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                      <div className="flex items-start gap-2">
                        <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                        <p>{reasonLabels[item.reasonCode] || item.reasonCode.replace(/_/g, ' ')}</p>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </section>
        )}

        {issuedCertificates.length > 0 && (
          <p className="pb-4 text-center text-xs text-slate-400">
            Only certificates with an active server record can be downloaded or verified as valid.
          </p>
        )}
      </main>
    </div>
  );
}

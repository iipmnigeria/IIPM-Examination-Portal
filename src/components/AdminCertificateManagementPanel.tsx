import { useEffect, useMemo, useState } from 'react';
import {
  Award,
  BadgeCheck,
  CircleAlert,
  FileClock,
  Loader2,
  RefreshCw,
  Save,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
} from 'lucide-react';
import {
  getCertificateAdminConsole,
  issueCertificate,
  reconcileCertificateEligibilities,
  setCertificateStatus,
  updateCertificatePolicy,
  type AdminCertificateConsole,
  type CertificatePolicyRecord,
  type IssuedCertificateStatus,
} from '../services/certificateService';

const emptyConsole: AdminCertificateConsole = {
  eligibilities: [],
  certificates: [],
  policies: [],
  counts: {
    eligible: 0,
    requested: 0,
    issued: 0,
    blocked: 0,
    activeCertificates: 0,
    restrictedCertificates: 0,
  },
};

const formatDate = (value?: string | null): string => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const statusClass = (status: string): string => {
  if (['active', 'eligible', 'issued', 'cleared'].includes(status)) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }
  if (['requested', 'suspended', 'flagged', 'pending'].includes(status)) {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }
  return 'border-rose-200 bg-rose-50 text-rose-700';
};

interface PolicyDraft {
  examinationId: string;
  examinationTitle: string;
  certificateTitle: string;
  passMarkOverride: string;
  maxSuspiciousScore: string;
  active: boolean;
}

const toPolicyDraft = (policy: CertificatePolicyRecord): PolicyDraft => ({
  examinationId: policy.examinationId,
  examinationTitle: policy.examinationTitle,
  certificateTitle: policy.certificateTitle,
  passMarkOverride: policy.passMarkOverride === null ? '' : String(policy.passMarkOverride),
  maxSuspiciousScore: String(policy.maxSuspiciousScore),
  active: policy.active,
});

export default function AdminCertificateManagementPanel() {
  const [consoleData, setConsoleData] = useState<AdminCertificateConsole>(emptyConsole);
  const [isLoading, setIsLoading] = useState(true);
  const [busyKey, setBusyKey] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [policyDraft, setPolicyDraft] = useState<PolicyDraft | null>(null);

  const refresh = async () => {
    try {
      setIsLoading(true);
      setError('');
      const next = await getCertificateAdminConsole(150);
      setConsoleData(next);
      if (!policyDraft && next.policies[0]) setPolicyDraft(toPolicyDraft(next.policies[0]));
    } catch (refreshError) {
      console.error('Unable to load certificate administration:', refreshError);
      setError(refreshError instanceof Error ? refreshError.message : 'Unable to load certificate administration.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const requestedFirst = useMemo(
    () => [...consoleData.eligibilities].sort((left, right) => {
      const rank = (value: string) => (value === 'requested' ? 0 : value === 'eligible' ? 1 : value === 'issued' ? 2 : 3);
      const statusDelta = rank(left.eligibilityStatus) - rank(right.eligibilityStatus);
      if (statusDelta !== 0) return statusDelta;
      return new Date(right.evaluatedAt).getTime() - new Date(left.evaluatedAt).getTime();
    }),
    [consoleData.eligibilities],
  );

  const runReconciliation = async () => {
    try {
      setBusyKey('reconcile');
      setError('');
      setMessage('');
      const result = await reconcileCertificateEligibilities();
      setMessage(`${result.evaluatedAttempts} completed attempts were re-evaluated.`);
      await refresh();
    } catch (reconcileError) {
      setError(reconcileError instanceof Error ? reconcileError.message : 'Certificate reconciliation failed.');
    } finally {
      setBusyKey('');
    }
  };

  const handleIssue = async (eligibilityId: string) => {
    try {
      setBusyKey(`issue:${eligibilityId}`);
      setError('');
      setMessage('');
      const certificate = await issueCertificate(eligibilityId);
      setMessage(`Issued ${certificate.certificateNumber} for ${certificate.holderName}.`);
      await refresh();
    } catch (issueError) {
      setError(issueError instanceof Error ? issueError.message : 'Certificate issuance failed.');
    } finally {
      setBusyKey('');
    }
  };

  const handleStatus = async (
    certificateId: string,
    certificateNumber: string,
    status: IssuedCertificateStatus,
  ) => {
    let reason = '';
    if (status !== 'active') {
      reason = window.prompt(`Reason for marking ${certificateNumber} as ${status}:`)?.trim() || '';
      if (!reason) return;
    }

    try {
      setBusyKey(`status:${certificateId}`);
      setError('');
      setMessage('');
      await setCertificateStatus({ certificateId, status, reason });
      setMessage(`${certificateNumber} is now ${status}.`);
      await refresh();
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : 'Certificate status update failed.');
    } finally {
      setBusyKey('');
    }
  };

  const savePolicy = async () => {
    if (!policyDraft) return;
    const maxSuspiciousScore = Number(policyDraft.maxSuspiciousScore);
    const passMarkOverride = policyDraft.passMarkOverride.trim()
      ? Number(policyDraft.passMarkOverride)
      : null;

    if (!Number.isFinite(maxSuspiciousScore) || maxSuspiciousScore < 0 || maxSuspiciousScore > 100) {
      setError('Maximum suspicious score must be between 0 and 100.');
      return;
    }
    if (passMarkOverride !== null && (!Number.isFinite(passMarkOverride) || passMarkOverride < 0 || passMarkOverride > 100)) {
      setError('Pass-mark override must be blank or between 0 and 100.');
      return;
    }

    try {
      setBusyKey('policy');
      setError('');
      setMessage('');
      await updateCertificatePolicy({
        examinationId: policyDraft.examinationId,
        certificateTitle: policyDraft.certificateTitle,
        passMarkOverride,
        maxSuspiciousScore,
        active: policyDraft.active,
      });
      setMessage(`Updated certificate policy for ${policyDraft.examinationTitle}.`);
      await reconcileCertificateEligibilities(policyDraft.examinationId);
      await refresh();
    } catch (policyError) {
      setError(policyError instanceof Error ? policyError.message : 'Certificate policy update failed.');
    } finally {
      setBusyKey('');
    }
  };

  return (
    <main className="mx-auto max-w-7xl space-y-7 px-4 py-8 text-slate-900">
      <section className="flex flex-col gap-4 rounded-3xl bg-slate-950 p-6 text-white shadow-xl md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-amber-500/15 p-3 text-amber-400">
            <Award className="h-7 w-7" />
          </div>
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-amber-400">Phase 3 control plane</p>
            <h1 className="mt-1 text-2xl font-black">Certificate Authority Administration</h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
              Review server-evaluated eligibility, issue immutable certificate records, manage lifecycle status and configure examination-level certificate policy.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void runReconciliation()}
            disabled={busyKey === 'reconcile'}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs font-extrabold text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            {busyKey === 'reconcile' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Reconcile results
          </button>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-extrabold text-white transition hover:bg-emerald-700 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        {[
          ['Eligible', consoleData.counts.eligible, BadgeCheck, 'text-emerald-600'],
          ['Requested', consoleData.counts.requested, FileClock, 'text-blue-600'],
          ['Issued', consoleData.counts.issued, Award, 'text-amber-600'],
          ['Blocked', consoleData.counts.blocked, ShieldAlert, 'text-rose-600'],
          ['Active', consoleData.counts.activeCertificates, ShieldCheck, 'text-emerald-600'],
          ['Restricted', consoleData.counts.restrictedCertificates, ShieldX, 'text-amber-600'],
        ].map(([label, value, Icon, colour]) => (
          <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">{String(label)}</p>
              <Icon className={`h-4 w-4 ${String(colour)}`} />
            </div>
            <p className="mt-3 text-2xl font-black text-slate-950">{Number(value)}</p>
          </div>
        ))}
      </section>

      {message && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{message}</div>
      )}
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {isLoading ? (
        <div className="grid min-h-80 place-items-center rounded-2xl border border-slate-200 bg-white">
          <div className="flex flex-col items-center gap-3 text-slate-500">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            <p className="text-sm font-bold">Loading certificate authority records...</p>
          </div>
        </div>
      ) : (
        <>
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="font-extrabold text-slate-950">Eligibility and issuance queue</h2>
              <p className="mt-1 text-xs text-slate-500">Candidates cannot issue certificates directly. Eligible and requested records require an authorised administrator.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] text-left text-sm">
                <thead className="bg-slate-50 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-5 py-3">Candidate</th>
                    <th className="px-5 py-3">Examination</th>
                    <th className="px-5 py-3 text-center">Score</th>
                    <th className="px-5 py-3 text-center">Integrity</th>
                    <th className="px-5 py-3 text-center">Eligibility</th>
                    <th className="px-5 py-3">Evaluated</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {requestedFirst.map((record) => {
                    const canIssue = ['eligible', 'requested'].includes(record.eligibilityStatus) && record.integrityStatus === 'cleared';
                    return (
                      <tr key={record.id} className="align-top hover:bg-slate-50/60">
                        <td className="px-5 py-4">
                          <p className="font-bold text-slate-900">{record.candidateName}</p>
                          <p className="mt-1 text-xs text-slate-500">{record.candidateEmail}</p>
                        </td>
                        <td className="px-5 py-4">
                          <p className="font-bold text-slate-800">{record.examinationTitle}</p>
                          <p className="mt-1 text-[10px] font-bold uppercase text-slate-400">{record.programmeCode || 'IIPM'}</p>
                        </td>
                        <td className="px-5 py-4 text-center font-mono font-black">
                          <span className={record.score >= record.passMark ? 'text-emerald-600' : 'text-rose-600'}>{record.score}%</span>
                          <p className="mt-1 text-[10px] font-normal text-slate-400">Pass {record.passMark}%</p>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span className={`rounded-full border px-2 py-1 text-[10px] font-extrabold uppercase ${statusClass(record.integrityStatus)}`}>
                            {record.integrityStatus}
                          </span>
                          <p className="mt-2 text-[10px] text-slate-400">Suspicion {record.suspiciousScore}%</p>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span className={`rounded-full border px-2 py-1 text-[10px] font-extrabold uppercase ${statusClass(record.eligibilityStatus)}`}>
                            {record.eligibilityStatus}
                          </span>
                          <p className="mt-2 text-[10px] text-slate-400">{record.reasonCode.replace(/_/g, ' ')}</p>
                        </td>
                        <td className="px-5 py-4 text-xs text-slate-500">{formatDate(record.evaluatedAt)}</td>
                        <td className="px-5 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => void handleIssue(record.id)}
                            disabled={!canIssue || busyKey === `issue:${record.id}`}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-extrabold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                          >
                            {busyKey === `issue:${record.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Award className="h-3.5 w-3.5" />}
                            {record.eligibilityStatus === 'issued' ? 'Issued' : 'Issue certificate'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {requestedFirst.length === 0 && (
                    <tr><td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-400">No completed examination attempts were found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="font-extrabold text-slate-950">Issued certificate register</h2>
              <p className="mt-1 text-xs text-slate-500">Lifecycle changes take effect immediately in the public verification response.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] text-left text-sm">
                <thead className="bg-slate-50 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-5 py-3">Certificate</th>
                    <th className="px-5 py-3">Holder</th>
                    <th className="px-5 py-3">Examination</th>
                    <th className="px-5 py-3 text-center">Status</th>
                    <th className="px-5 py-3">Issued</th>
                    <th className="px-5 py-3 text-right">Lifecycle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {consoleData.certificates.map((certificate) => (
                    <tr key={certificate.id} className="align-top hover:bg-slate-50/60">
                      <td className="px-5 py-4">
                        <p className="font-mono text-xs font-extrabold text-slate-900">{certificate.certificateNumber}</p>
                        <p className="mt-1 font-mono text-[10px] text-slate-400">{certificate.verificationCode}</p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-bold text-slate-900">{certificate.holderName}</p>
                        <p className="mt-1 text-xs text-slate-500">{certificate.candidateEmail}</p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-bold text-slate-800">{certificate.examinationTitle}</p>
                        <p className="mt-1 text-[10px] font-bold uppercase text-slate-400">{certificate.programmeCode || 'IIPM'} · {certificate.score}%</p>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className={`rounded-full border px-2 py-1 text-[10px] font-extrabold uppercase ${statusClass(certificate.status)}`}>
                          {certificate.status}
                        </span>
                        {certificate.revocationReason && (
                          <p className="mx-auto mt-2 max-w-52 text-[10px] leading-relaxed text-slate-400">{certificate.revocationReason}</p>
                        )}
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-500">{formatDate(certificate.issuedAt)}</td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => void handleStatus(certificate.id, certificate.certificateNumber, 'active')}
                            disabled={certificate.status === 'active' || busyKey === `status:${certificate.id}`}
                            className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[10px] font-extrabold text-emerald-700 disabled:opacity-40"
                          >Active</button>
                          <button
                            type="button"
                            onClick={() => void handleStatus(certificate.id, certificate.certificateNumber, 'suspended')}
                            disabled={certificate.status === 'suspended' || busyKey === `status:${certificate.id}`}
                            className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[10px] font-extrabold text-amber-700 disabled:opacity-40"
                          >Suspend</button>
                          <button
                            type="button"
                            onClick={() => void handleStatus(certificate.id, certificate.certificateNumber, 'revoked')}
                            disabled={certificate.status === 'revoked' || busyKey === `status:${certificate.id}`}
                            className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[10px] font-extrabold text-rose-700 disabled:opacity-40"
                          >Revoke</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {consoleData.certificates.length === 0 && (
                    <tr><td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-400">No certificates have been issued.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
            <div>
              <h2 className="font-extrabold text-slate-950">Certificate policy</h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                The examination pass mark remains authoritative unless an explicit override is set. Suspicious scores above the configured maximum are blocked.
              </p>
              <div className="mt-4 max-h-72 space-y-2 overflow-y-auto pr-1">
                {consoleData.policies.map((policy) => (
                  <button
                    type="button"
                    key={policy.examinationId}
                    onClick={() => setPolicyDraft(toPolicyDraft(policy))}
                    className={`w-full rounded-xl border p-3 text-left transition ${policyDraft?.examinationId === policy.examinationId ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-slate-50 hover:border-slate-300'}`}
                  >
                    <p className="text-sm font-bold text-slate-800">{policy.examinationTitle}</p>
                    <p className="mt-1 text-[10px] text-slate-500">Pass {policy.passMarkOverride ?? policy.examPassMark}% · Integrity maximum {policy.maxSuspiciousScore}% · {policy.active ? 'Active' : 'Inactive'}</p>
                  </button>
                ))}
              </div>
            </div>

            {policyDraft ? (
              <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Editing policy</p>
                  <p className="mt-1 font-bold text-slate-900">{policyDraft.examinationTitle}</p>
                </div>
                <label className="block text-xs font-bold text-slate-600">
                  Certificate title
                  <input
                    value={policyDraft.certificateTitle}
                    onChange={(event) => setPolicyDraft({ ...policyDraft, certificateTitle: event.target.value })}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-xs font-bold text-slate-600">
                    Pass-mark override
                    <input
                      value={policyDraft.passMarkOverride}
                      onChange={(event) => setPolicyDraft({ ...policyDraft, passMarkOverride: event.target.value })}
                      placeholder="Use exam mark"
                      inputMode="decimal"
                      className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
                    />
                  </label>
                  <label className="block text-xs font-bold text-slate-600">
                    Maximum suspicion
                    <input
                      value={policyDraft.maxSuspiciousScore}
                      onChange={(event) => setPolicyDraft({ ...policyDraft, maxSuspiciousScore: event.target.value })}
                      inputMode="decimal"
                      className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
                    />
                  </label>
                </div>
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={policyDraft.active}
                    onChange={(event) => setPolicyDraft({ ...policyDraft, active: event.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                  />
                  Certificate issuance active for this examination
                </label>
                <button
                  type="button"
                  onClick={() => void savePolicy()}
                  disabled={busyKey === 'policy'}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-extrabold text-white transition hover:bg-slate-900 disabled:opacity-60"
                >
                  {busyKey === 'policy' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save and re-evaluate
                </button>
              </div>
            ) : (
              <div className="grid place-items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-sm text-slate-400">Select an examination policy.</div>
            )}
          </section>
        </>
      )}
    </main>
  );
}

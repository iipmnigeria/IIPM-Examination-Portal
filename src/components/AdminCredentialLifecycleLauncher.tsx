import { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  BookOpenCheck,
  CalendarClock,
  Check,
  ClipboardCheck,
  History,
  Loader2,
  RefreshCw,
  RotateCcw,
  Save,
  Settings2,
  ShieldCheck,
  UsersRound,
  X,
  XCircle,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getCurrentPortalUser } from '../services/authService';
import {
  decideCredentialRenewal,
  getCredentialAdminConsole,
  reviewCpdRecord,
  updateCredentialPolicy,
  type AdminCredentialConsole,
  type AdminCredentialPolicy,
} from '../services/credentialWalletService';

const emptyConsole: AdminCredentialConsole = {
  policies: [],
  cpdQueue: [],
  renewals: [],
  credentials: [],
  auditEvents: [],
  counts: {
    credentials: 0,
    activeCredentials: 0,
    expiredCredentials: 0,
    submittedCpd: 0,
    pendingRenewals: 0,
    activeShareLinks: 0,
  },
};

interface PolicyDraft {
  validityMonths: string;
  renewalWindowDays: string;
  cpdHoursRequired: string;
  shareLinkDefaultDays: string;
  active: boolean;
}

const formatDate = (value?: string | null): string => {
  if (!value) return 'Not recorded';
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

const decisionReason = (decision: 'approved' | 'changes_requested' | 'rejected'): string | null => {
  if (decision === 'approved') return null;
  return window.prompt(
    decision === 'changes_requested'
      ? 'Explain the changes required.'
      : 'State the reason for rejection.',
    '',
  );
};

export default function AdminCredentialLifecycleLauncher() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [consoleData, setConsoleData] = useState<AdminCredentialConsole>(emptyConsole);
  const [policyDrafts, setPolicyDrafts] = useState<Record<string, PolicyDraft>>({});
  const [tab, setTab] = useState<'policies' | 'cpd' | 'renewals' | 'credentials' | 'audit'>('policies');
  const [isLoading, setIsLoading] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const refreshAuthorisation = async () => {
    try {
      const current = await getCurrentPortalUser();
      const allowed = ['exam_admin', 'super_admin'].includes(current?.profile.role || '');
      setIsAdmin(allowed);
      if (!allowed) setIsOpen(false);
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
      const next = await getCredentialAdminConsole(250);
      setConsoleData(next);
      setPolicyDrafts(Object.fromEntries(next.policies.map((policy) => [policy.id, {
        validityMonths: policy.validityMonths === null ? '' : String(policy.validityMonths),
        renewalWindowDays: String(policy.renewalWindowDays),
        cpdHoursRequired: String(policy.cpdHoursRequired),
        shareLinkDefaultDays: String(policy.shareLinkDefaultDays),
        active: policy.active,
      }])));
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Unable to load credential administration.');
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
  }, [isOpen, isAdmin]);

  const runAction = async (key: string, action: () => Promise<void>, success: string) => {
    try {
      setBusy(key);
      setError('');
      setMessage('');
      await action();
      setMessage(success);
      await refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'The credential administration action failed.');
    } finally {
      setBusy('');
    }
  };

  const savePolicy = (policy: AdminCredentialPolicy) => {
    const draft = policyDrafts[policy.id];
    if (!draft) return;
    const validityMonths = draft.validityMonths.trim() === '' ? null : Number(draft.validityMonths);
    void runAction(`policy-${policy.id}`, async () => {
      await updateCredentialPolicy({
        programmeId: policy.programmeId,
        productCode: policy.productCode,
        validityMonths,
        renewalWindowDays: Number(draft.renewalWindowDays),
        cpdHoursRequired: Number(draft.cpdHoursRequired),
        shareLinkDefaultDays: Number(draft.shareLinkDefaultDays),
        active: draft.active,
      });
    }, `${policy.programmeCode} ${policy.productCode} credential policy updated.`);
  };

  const decideCpd = (recordId: string, decision: 'approved' | 'changes_requested' | 'rejected') => {
    const reason = decisionReason(decision);
    if (decision !== 'approved' && (!reason || reason.trim().length < 5)) return;
    void runAction(`cpd-${recordId}`, async () => {
      await reviewCpdRecord({ recordId, decision, reason });
    }, `CPD record ${decision.replaceAll('_', ' ')}.`);
  };

  const decideRenewal = (renewalId: string, decision: 'approved' | 'changes_requested' | 'rejected') => {
    const reason = decisionReason(decision);
    if (decision !== 'approved' && (!reason || reason.trim().length < 5)) return;
    void runAction(`renewal-${renewalId}`, async () => {
      await decideCredentialRenewal({ renewalId, decision, reason });
    }, `Credential renewal ${decision.replaceAll('_', ' ')}.`);
  };

  const submittedCpd = useMemo(
    () => consoleData.cpdQueue.filter((record) => record.status === 'submitted'),
    [consoleData.cpdQueue],
  );
  const openRenewals = useMemo(
    () => consoleData.renewals.filter((renewal) => ['pending', 'changes_requested'].includes(renewal.status)),
    [consoleData.renewals],
  );

  if (!isAdmin) return null;

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-44 right-5 z-[87] inline-flex items-center gap-2 rounded-full border border-violet-300/30 bg-slate-950 px-4 py-3 text-xs font-extrabold text-white shadow-2xl transition hover:-translate-y-0.5 hover:bg-slate-900"
        aria-label="Open credential lifecycle administration"
      >
        <Settings2 className="h-4 w-4 text-violet-300" />
        <span className="hidden sm:inline">Credential Lifecycle</span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[158] overflow-y-auto bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950 text-white shadow-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-violet-400/15 p-2.5 text-violet-300"><Settings2 className="h-6 w-6" /></div>
            <div>
              <h1 className="text-lg font-black">Credential Lifecycle Administration</h1>
              <p className="mt-1 text-xs text-slate-400">Validity policies, CPD review, renewals, records and audit controls</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void refresh()} className="rounded-lg border border-slate-700 p-2 text-slate-300" aria-label="Refresh credential administration"><RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /></button>
            <button type="button" onClick={() => setIsOpen(false)} className="rounded-lg border border-slate-700 p-2 text-slate-300" aria-label="Close credential administration"><X className="h-4 w-4" /></button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-7">
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {[
            ['Credentials', consoleData.counts.credentials, BadgeCheck],
            ['Active', consoleData.counts.activeCredentials, ShieldCheck],
            ['Expired', consoleData.counts.expiredCredentials, CalendarClock],
            ['CPD review', consoleData.counts.submittedCpd, BookOpenCheck],
            ['Renewals', consoleData.counts.pendingRenewals, RotateCcw],
            ['Active links', consoleData.counts.activeShareLinks, UsersRound],
          ].map(([label, value, Icon]) => (
            <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{String(label)}</p><Icon className="h-4 w-4 text-violet-600" /></div>
              <p className="mt-2 text-2xl font-black">{String(value)}</p>
            </div>
          ))}
        </section>

        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div>}
        {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">{message}</div>}

        <nav className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
          {([
            ['policies', 'Policies', Settings2],
            ['cpd', `CPD Review (${submittedCpd.length})`, ClipboardCheck],
            ['renewals', `Renewals (${openRenewals.length})`, RotateCcw],
            ['credentials', 'Credential Register', BadgeCheck],
            ['audit', 'Audit Trail', History],
          ] as const).map(([value, label, Icon]) => (
            <button key={value} type="button" onClick={() => setTab(value)} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition ${tab === value ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-100'}`}><Icon className="h-4 w-4" />{label}</button>
          ))}
        </nav>

        {tab === 'policies' && (
          <section className="space-y-4">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
              <p className="font-black">Expiry is deliberate, never automatic.</p>
              <p className="mt-1 leading-6">Leave validity months blank for a non-expiring credential. Setting a validity period activates expiry for applicable credentials that do not already have an expiry date.</p>
            </div>
            <div className="grid gap-5 xl:grid-cols-2">
              {consoleData.policies.map((policy) => {
                const draft = policyDrafts[policy.id];
                if (!draft) return null;
                return (
                  <article key={policy.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-wider text-violet-700">{policy.programmeCode}</p><h2 className="mt-1 font-black">{policy.programmeTitle}</h2><p className="mt-1 text-sm capitalize text-slate-500">{policy.productCode} credential</p></div><label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={draft.active} onChange={(event) => setPolicyDrafts((current) => ({ ...current, [policy.id]: { ...draft, active: event.target.checked } }))} />Active</label></div>
                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                      <label className="text-xs font-bold text-slate-600">Validity months<input type="number" min="1" max="120" placeholder="No expiry" value={draft.validityMonths} onChange={(event) => setPolicyDrafts((current) => ({ ...current, [policy.id]: { ...draft, validityMonths: event.target.value } }))} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" /></label>
                      <label className="text-xs font-bold text-slate-600">Renewal window days<input type="number" min="1" max="730" value={draft.renewalWindowDays} onChange={(event) => setPolicyDrafts((current) => ({ ...current, [policy.id]: { ...draft, renewalWindowDays: event.target.value } }))} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" /></label>
                      <label className="text-xs font-bold text-slate-600">Required CPD hours<input type="number" min="0" max="10000" step="0.5" value={draft.cpdHoursRequired} onChange={(event) => setPolicyDrafts((current) => ({ ...current, [policy.id]: { ...draft, cpdHoursRequired: event.target.value } }))} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" /></label>
                      <label className="text-xs font-bold text-slate-600">Default share-link days<input type="number" min="1" max="365" value={draft.shareLinkDefaultDays} onChange={(event) => setPolicyDrafts((current) => ({ ...current, [policy.id]: { ...draft, shareLinkDefaultDays: event.target.value } }))} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" /></label>
                    </div>
                    <button type="button" onClick={() => savePolicy(policy)} disabled={busy === `policy-${policy.id}`} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50">{busy === `policy-${policy.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save policy</button>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {tab === 'cpd' && (
          <section className="space-y-4">
            {consoleData.cpdQueue.map((record) => (
              <article key={record.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="font-black">{record.title}</h2><p className="mt-1 text-sm text-slate-500">{record.candidateName} · {record.candidateEmail}</p><p className="mt-1 text-sm text-slate-500">{record.provider} · {record.activityType.replaceAll('_', ' ')} · {record.hours} hours · {record.completedOn}</p></div><span className="w-fit rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-black capitalize text-blue-700">{record.status.replaceAll('_', ' ')}</span></div>
                {record.evidenceReference && <p className="mt-3 break-all rounded-lg bg-slate-50 p-3 text-xs">Evidence reference: {record.evidenceReference}</p>}
                {record.reviewReason && <p className="mt-3 text-xs text-amber-700">Previous review: {record.reviewReason}</p>}
                {record.status === 'submitted' && <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => decideCpd(record.id, 'approved')} disabled={busy === `cpd-${record.id}`} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><Check className="h-4 w-4" />Approve</button><button type="button" onClick={() => decideCpd(record.id, 'changes_requested')} disabled={busy === `cpd-${record.id}`} className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 disabled:opacity-50"><ClipboardCheck className="h-4 w-4" />Request changes</button><button type="button" onClick={() => decideCpd(record.id, 'rejected')} disabled={busy === `cpd-${record.id}`} className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 disabled:opacity-50"><XCircle className="h-4 w-4" />Reject</button></div>}
              </article>
            ))}
            {!consoleData.cpdQueue.length && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">No CPD record is available.</div>}
          </section>
        )}

        {tab === 'renewals' && (
          <section className="space-y-4">
            {consoleData.renewals.map((renewal) => (
              <article key={renewal.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="font-black">{renewal.credentialCode}</h2><p className="mt-1 text-sm text-slate-500">{renewal.candidateName} · {renewal.candidateEmail}</p><p className="mt-1 text-sm text-slate-500">Current expiry {formatDate(renewal.currentExpiresAt)} → proposed {formatDate(renewal.proposedExpiresAt)}</p><p className="mt-1 text-xs text-slate-500">Approved CPD {renewal.approvedCpdHours}h / {renewal.requiredCpdHours}h required</p></div><span className="w-fit rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-black capitalize text-violet-700">{renewal.status.replaceAll('_', ' ')}</span></div>
                {renewal.reviewReason && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">Review note: {renewal.reviewReason}</p>}
                {['pending', 'changes_requested'].includes(renewal.status) && <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => decideRenewal(renewal.id, 'approved')} disabled={busy === `renewal-${renewal.id}`} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><Check className="h-4 w-4" />Approve renewal</button><button type="button" onClick={() => decideRenewal(renewal.id, 'changes_requested')} disabled={busy === `renewal-${renewal.id}`} className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 disabled:opacity-50"><ClipboardCheck className="h-4 w-4" />Request changes</button><button type="button" onClick={() => decideRenewal(renewal.id, 'rejected')} disabled={busy === `renewal-${renewal.id}`} className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 disabled:opacity-50"><XCircle className="h-4 w-4" />Reject</button></div>}
              </article>
            ))}
            {!consoleData.renewals.length && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">No credential renewal request is available.</div>}
          </section>
        )}

        {tab === 'credentials' && (
          <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full text-left text-sm"><thead className="bg-slate-100 text-xs uppercase tracking-wider text-slate-500"><tr><th className="p-4">Candidate</th><th className="p-4">Credential</th><th className="p-4">Programme</th><th className="p-4">Status</th><th className="p-4">Issued</th><th className="p-4">Expires</th><th className="p-4">Renewals</th></tr></thead><tbody>{consoleData.credentials.map((credential) => <tr key={credential.credentialCode} className="border-t border-slate-100"><td className="p-4"><p className="font-bold">{credential.candidateName}</p><p className="text-xs text-slate-400">{credential.candidateEmail}</p></td><td className="p-4"><p className="font-mono text-xs font-bold">{credential.credentialCode}</p><p className="mt-1 text-xs text-slate-500">{credential.productTitle}</p></td><td className="p-4">{credential.programmeCode || 'IIPM'}</td><td className="p-4 font-bold capitalize">{credential.effectiveStatus}</td><td className="p-4">{formatDate(credential.issuedAt)}</td><td className="p-4">{credential.expiresAt ? formatDate(credential.expiresAt) : 'No expiry'}</td><td className="p-4">{credential.renewalCount}</td></tr>)}{!consoleData.credentials.length && <tr><td colSpan={7} className="p-8 text-center text-slate-500">No credential has been issued.</td></tr>}</tbody></table>
          </section>
        )}

        {tab === 'audit' && (
          <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full text-left text-sm"><thead className="bg-slate-100 text-xs uppercase tracking-wider text-slate-500"><tr><th className="p-4">Time</th><th className="p-4">Event</th><th className="p-4">Candidate</th><th className="p-4">Credential</th><th className="p-4">Metadata</th></tr></thead><tbody>{consoleData.auditEvents.map((event) => <tr key={event.id} className="border-t border-slate-100 align-top"><td className="p-4 whitespace-nowrap">{formatDate(event.createdAt)}</td><td className="p-4 font-bold">{event.eventType.replaceAll('_', ' ')}</td><td className="p-4 font-mono text-xs">{event.candidateId || 'System'}</td><td className="p-4 font-mono text-xs">{event.credentialId || 'Not linked'}</td><td className="max-w-md p-4"><pre className="whitespace-pre-wrap break-all text-[10px] text-slate-500">{JSON.stringify(event.metadata, null, 2)}</pre></td></tr>)}{!consoleData.auditEvents.length && <tr><td colSpan={5} className="p-8 text-center text-slate-500">No credential lifecycle audit event is available.</td></tr>}</tbody></table>
          </section>
        )}
      </main>
    </div>
  );
}

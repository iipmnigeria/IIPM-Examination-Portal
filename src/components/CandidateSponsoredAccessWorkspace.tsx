import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FileCheck2,
  Gift,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  TicketCheck,
  WalletCards,
  X,
  XCircle,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getCurrentPortalUser } from '../services/authService';
import {
  getMyFinanceWorkspace,
  requestCandidateRefund,
  respondToSponsorshipNomination,
  type CandidateFinanceWorkspace,
  type FinanceRecord,
} from '../services/financeSponsorshipService';

interface RefundablePurchase {
  id: string;
  sourceType: 'exam_order' | 'certificate_order';
  reference: string;
  title: string;
  currency: string;
  amountMinor: number;
}

const emptyWorkspace: CandidateFinanceWorkspace = {
  generatedAt: '',
  nominations: [],
  grants: [],
  refundRequests: [],
  counts: { pendingNominations: 0, activeGrants: 0, openRefundRequests: 0 },
};

const formatDate = (value?: string | null) => {
  if (!value) return 'Not specified';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
};

const formatMoney = (amountMinor: number | string | null | undefined, currency = 'NGN') => {
  const amount = Number(amountMinor || 0) / 100;
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  }
};

const statusClass: Record<string, string> = {
  nominated: 'border-amber-200 bg-amber-50 text-amber-700',
  accepted: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  active: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  consumed: 'border-blue-200 bg-blue-50 text-blue-700',
  declined: 'border-slate-200 bg-slate-50 text-slate-600',
  released: 'border-slate-200 bg-slate-50 text-slate-600',
  expired: 'border-rose-200 bg-rose-50 text-rose-700',
  requested: 'border-amber-200 bg-amber-50 text-amber-700',
  under_review: 'border-blue-200 bg-blue-50 text-blue-700',
  approved: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  processing: 'border-cyan-200 bg-cyan-50 text-cyan-700',
  paid: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  rejected: 'border-rose-200 bg-rose-50 text-rose-700',
  failed: 'border-rose-200 bg-rose-50 text-rose-700',
};

export default function CandidateSponsoredAccessWorkspace() {
  const [isCandidate, setIsCandidate] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [workspace, setWorkspace] = useState<CandidateFinanceWorkspace>(emptyWorkspace);
  const [purchases, setPurchases] = useState<RefundablePurchase[]>([]);
  const [tab, setTab] = useState<'sponsorship' | 'refunds'>('sponsorship');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [refundForm, setRefundForm] = useState({ purchaseKey: '', amount: '', reason: '' });

  const refreshAuthorisation = async () => {
    try {
      const current = await getCurrentPortalUser();
      const candidate = current?.profile.role === 'candidate';
      setIsCandidate(candidate);
      if (!candidate) setIsOpen(false);
    } catch {
      setIsCandidate(false);
      setIsOpen(false);
    }
  };

  const loadRefundablePurchases = async (): Promise<RefundablePurchase[]> => {
    const [examResult, certificateResult] = await Promise.all([
      supabase
        .from('exam_orders')
        .select('id, reference, currency, payable_amount_minor, status, examination:examinations(title)')
        .eq('status', 'paid')
        .order('created_at', { ascending: false }),
      supabase
        .from('agilecert_certificate_orders')
        .select('id, reference, currency, payable_amount_minor, status, product:agilecert_certificate_products(title)')
        .eq('status', 'paid')
        .order('created_at', { ascending: false }),
    ]);

    if (examResult.error) throw new Error(`Unable to load refundable examination payments: ${examResult.error.message}`);
    if (certificateResult.error) throw new Error(`Unable to load refundable certificate payments: ${certificateResult.error.message}`);

    const examinations = (examResult.data || []).map((order: any) => ({
      id: order.id,
      sourceType: 'exam_order' as const,
      reference: order.reference,
      title: order.examination?.title || 'Examination payment',
      currency: order.currency,
      amountMinor: Number(order.payable_amount_minor || 0),
    }));
    const certificates = (certificateResult.data || []).map((order: any) => ({
      id: order.id,
      sourceType: 'certificate_order' as const,
      reference: order.reference,
      title: order.product?.title || 'Certificate payment',
      currency: order.currency,
      amountMinor: Number(order.payable_amount_minor || 0),
    }));
    return [...examinations, ...certificates];
  };

  const refresh = async () => {
    if (!isCandidate) return;
    try {
      setLoading(true);
      setError('');
      const [nextWorkspace, nextPurchases] = await Promise.all([
        getMyFinanceWorkspace(),
        loadRefundablePurchases(),
      ]);
      setWorkspace(nextWorkspace);
      setPurchases(nextPurchases);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Unable to load sponsorship and refund records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshAuthorisation();
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      window.setTimeout(() => void refreshAuthorisation(), 0);
    });
    const refreshHandler = () => void refresh();
    window.addEventListener('agilecert-finance-workspace-refresh', refreshHandler);
    return () => {
      listener.subscription.unsubscribe();
      window.removeEventListener('agilecert-finance-workspace-refresh', refreshHandler);
    };
  }, []);

  useEffect(() => {
    if (isOpen && isCandidate) void refresh();
  }, [isOpen, isCandidate]);

  const selectedPurchase = useMemo(() => {
    const [sourceType, id] = refundForm.purchaseKey.split('|');
    return purchases.find((purchase) => purchase.sourceType === sourceType && purchase.id === id) || null;
  }, [purchases, refundForm.purchaseKey]);

  const runAction = async (key: string, action: () => Promise<unknown>, success: string) => {
    try {
      setBusy(key);
      setError('');
      setMessage('');
      await action();
      setMessage(success);
      await refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'The finance action could not be completed.');
    } finally {
      setBusy('');
    }
  };

  const respond = (nomination: FinanceRecord, response: 'accepted' | 'declined') => {
    const note = window.prompt(
      response === 'accepted' ? 'Optional acceptance note' : 'Optional reason for declining',
      response === 'accepted' ? 'I accept this sponsored opportunity.' : '',
    );
    if (note === null) return;
    void runAction(
      `${response}-${nomination.id}`,
      () => respondToSponsorshipNomination({ nominationId: nomination.id, response, note }),
      response === 'accepted'
        ? 'The sponsorship was accepted and the authorised access was granted.'
        : 'The sponsorship was declined and the seat was released.',
    );
  };

  const submitRefund = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedPurchase) {
      setError('Select a paid examination or certificate order.');
      return;
    }
    const majorAmount = Number(refundForm.amount);
    const amountMinor = Math.round(majorAmount * 100);
    if (!Number.isFinite(majorAmount) || amountMinor <= 0) {
      setError('Enter a valid refund amount.');
      return;
    }
    void runAction(
      'request-refund',
      async () => {
        await requestCandidateRefund({
          sourceType: selectedPurchase.sourceType,
          sourceId: selectedPurchase.id,
          amountMinor,
          reason: refundForm.reason,
        });
        setRefundForm({ purchaseKey: '', amount: '', reason: '' });
      },
      'The refund request was submitted for finance review.',
    );
  };

  if (!isCandidate) return null;

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-36 left-5 z-[84] inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-slate-950 px-4 py-3 text-xs font-extrabold text-white shadow-2xl transition hover:-translate-y-0.5 hover:bg-slate-900"
        aria-label="Open sponsored access and refunds workspace"
      >
        <Gift className="h-4 w-4 text-emerald-300" />
        <span className="hidden sm:inline">Sponsored Access</span>
        {workspace.counts.pendingNominations > 0 && (
          <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] text-slate-950">{workspace.counts.pendingNominations}</span>
        )}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[155] overflow-y-auto bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950 text-white shadow-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-emerald-400/15 p-2.5 text-emerald-300"><Gift className="h-6 w-6" /></div>
            <div>
              <h1 className="text-lg font-black">Sponsored Access & Refunds</h1>
              <p className="mt-1 text-xs text-slate-400">Institution-funded opportunities, access grants and payment refund requests</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void refresh()} className="rounded-lg border border-slate-700 p-2 text-slate-300" aria-label="Refresh finance workspace">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button type="button" onClick={() => setIsOpen(false)} className="rounded-lg border border-slate-700 p-2 text-slate-300" aria-label="Close finance workspace"><X className="h-4 w-4" /></button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-7">
        <section className="grid gap-4 sm:grid-cols-3">
          {[
            ['Pending nominations', workspace.counts.pendingNominations, TicketCheck],
            ['Active grants', workspace.counts.activeGrants, ShieldCheck],
            ['Open refunds', workspace.counts.openRefundRequests, RotateCcw],
          ].map(([label, value, Icon]) => (
            <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between"><p className="text-xs font-black uppercase tracking-wider text-slate-400">{String(label)}</p><Icon className="h-5 w-5 text-emerald-700" /></div>
              <p className="mt-3 text-3xl font-black text-slate-950">{String(value)}</p>
            </div>
          ))}
        </section>

        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div>}
        {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">{message}</div>}

        <nav className="flex gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
          <button type="button" onClick={() => setTab('sponsorship')} className={`rounded-xl px-4 py-2.5 text-xs font-black ${tab === 'sponsorship' ? 'bg-slate-950 text-white' : 'text-slate-600'}`}><span className="inline-flex items-center gap-2"><Building2 className="h-4 w-4" />Sponsorship</span></button>
          <button type="button" onClick={() => setTab('refunds')} className={`rounded-xl px-4 py-2.5 text-xs font-black ${tab === 'refunds' ? 'bg-slate-950 text-white' : 'text-slate-600'}`}><span className="inline-flex items-center gap-2"><CircleDollarSign className="h-4 w-4" />Refunds</span></button>
        </nav>

        {tab === 'sponsorship' && (
          <div className="space-y-6">
            <section>
              <div className="mb-3 flex items-center gap-2"><TicketCheck className="h-5 w-5 text-emerald-700" /><h2 className="text-lg font-black">Sponsorship nominations</h2></div>
              <div className="grid gap-4 lg:grid-cols-2">
                {workspace.nominations.map((nomination) => (
                  <article key={nomination.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-black uppercase tracking-wider text-emerald-700">{nomination.sponsorName}</p>
                        <h3 className="mt-1 text-lg font-black">{nomination.examinationTitle || nomination.certificateProductTitle || 'Professional sponsorship'}</h3>
                        <p className="mt-1 text-sm text-slate-500">{nomination.productType === 'certificate' ? 'Sponsored credential' : 'Sponsored examination access'}</p>
                      </div>
                      <span className={`rounded-full border px-3 py-1 text-xs font-black capitalize ${statusClass[nomination.status] || 'border-slate-200 bg-slate-50 text-slate-600'}`}>{String(nomination.status).replaceAll('_', ' ')}</span>
                    </div>
                    <dl className="mt-4 grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
                      <div><dt className="text-[10px] font-black uppercase text-slate-400">Programme</dt><dd className="mt-1 font-bold">{nomination.programmeCode || 'IIPM'}</dd></div>
                      <div><dt className="text-[10px] font-black uppercase text-slate-400">Reference</dt><dd className="mt-1 break-all font-mono text-xs font-bold">{nomination.nominationReference}</dd></div>
                      <div><dt className="text-[10px] font-black uppercase text-slate-400">Valid from</dt><dd className="mt-1 font-bold">{formatDate(nomination.validFrom)}</dd></div>
                      <div><dt className="text-[10px] font-black uppercase text-slate-400">Expires</dt><dd className="mt-1 font-bold">{formatDate(nomination.expiresAt || nomination.validUntil)}</dd></div>
                    </dl>
                    {nomination.status === 'nominated' && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button type="button" disabled={Boolean(busy)} onClick={() => respond(nomination, 'accepted')} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-black text-white disabled:opacity-50">
                          {busy === `accepted-${nomination.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}Accept
                        </button>
                        <button type="button" disabled={Boolean(busy)} onClick={() => respond(nomination, 'declined')} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-xs font-black text-slate-700 disabled:opacity-50">
                          {busy === `declined-${nomination.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}Decline
                        </button>
                      </div>
                    )}
                  </article>
                ))}
                {!workspace.nominations.length && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500 lg:col-span-2">No institutional sponsorship nomination has been issued to this account.</div>}
              </div>
            </section>

            <section>
              <div className="mb-3 flex items-center gap-2"><WalletCards className="h-5 w-5 text-blue-700" /><h2 className="text-lg font-black">Access grants</h2></div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {workspace.grants.map((grant) => (
                  <article key={grant.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3"><p className="font-black">{grant.sponsorName}</p><span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${statusClass[grant.status] || statusClass.active}`}>{grant.status}</span></div>
                    <p className="mt-3 text-sm text-slate-600">{grant.grantType === 'certificate_credential' ? 'Professional credential issued' : 'Examination assignment granted'}</p>
                    <p className="mt-3 text-xs text-slate-400">Granted {formatDate(grant.grantedAt)}</p>
                  </article>
                ))}
                {!workspace.grants.length && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500 md:col-span-2 xl:col-span-3">Accepted sponsorship grants will appear here.</div>}
              </div>
            </section>
          </div>
        )}

        {tab === 'refunds' && (
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <form onSubmit={submitRefund} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2"><CircleDollarSign className="h-5 w-5 text-emerald-700" /><h2 className="text-lg font-black">Request a refund</h2></div>
              <p className="mt-2 text-sm text-slate-500">Select a paid order. Finance administrators review every request before any provider refund is processed.</p>
              <label className="mt-5 block text-xs font-black uppercase tracking-wider text-slate-500">Paid order
                <select value={refundForm.purchaseKey} onChange={(event) => setRefundForm((current) => ({ ...current, purchaseKey: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm" required>
                  <option value="">Select a payment</option>
                  {purchases.map((purchase) => <option key={`${purchase.sourceType}|${purchase.id}`} value={`${purchase.sourceType}|${purchase.id}`}>{purchase.title} · {purchase.reference} · {formatMoney(purchase.amountMinor, purchase.currency)}</option>)}
                </select>
              </label>
              <label className="mt-4 block text-xs font-black uppercase tracking-wider text-slate-500">Refund amount ({selectedPurchase?.currency || 'currency'})
                <input type="number" min="0.01" step="0.01" value={refundForm.amount} onChange={(event) => setRefundForm((current) => ({ ...current, amount: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm" required />
              </label>
              <label className="mt-4 block text-xs font-black uppercase tracking-wider text-slate-500">Reason
                <textarea minLength={15} value={refundForm.reason} onChange={(event) => setRefundForm((current) => ({ ...current, reason: event.target.value }))} className="mt-2 min-h-28 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm" required />
              </label>
              <button type="submit" disabled={Boolean(busy) || !purchases.length} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white disabled:opacity-50">
                {busy === 'request-refund' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck2 className="h-4 w-4" />}Submit refund request
              </button>
              {!purchases.length && <p className="mt-3 text-xs font-bold text-amber-700">No paid examination or certificate order is currently refundable.</p>}
            </form>

            <section className="space-y-4">
              <div className="flex items-center gap-2"><Clock3 className="h-5 w-5 text-blue-700" /><h2 className="text-lg font-black">Refund history</h2></div>
              {workspace.refundRequests.map((refund) => (
                <article key={refund.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4"><div><p className="font-mono text-xs font-black text-slate-500">{refund.refundNumber}</p><p className="mt-1 text-lg font-black">{formatMoney(refund.requestedAmountMinor, refund.currency)}</p></div><span className={`rounded-full border px-3 py-1 text-xs font-black capitalize ${statusClass[refund.status] || 'border-slate-200 bg-slate-50 text-slate-600'}`}>{String(refund.status).replaceAll('_', ' ')}</span></div>
                  <p className="mt-3 text-sm text-slate-600">{refund.reason}</p>
                  {refund.decisionReason && <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-600"><strong>Finance decision:</strong> {refund.decisionReason}</p>}
                  <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-400"><span>Requested {formatDate(refund.requestedAt)}</span>{refund.approvedAmountMinor && <span>Approved {formatMoney(refund.approvedAmountMinor, refund.currency)}</span>}</div>
                </article>
              ))}
              {!workspace.refundRequests.length && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">No refund request has been submitted.</div>}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

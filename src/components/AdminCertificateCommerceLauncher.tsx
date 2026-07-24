import { useEffect, useMemo, useState } from 'react';
import {
  BadgeDollarSign,
  CircleAlert,
  CreditCard,
  FileBadge,
  Loader2,
  RefreshCw,
  Save,
  ShieldCheck,
  TicketCheck,
  X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getCurrentPortalUser } from '../services/authService';
import { getCertificateAdminConsole, type AdminCertificateEligibility } from '../services/certificateService';
import {
  formatCertificateMoney,
  getCertificateCommerceAdminConsole,
  updateCertificateProductPrice,
  waiveCertificateOrder,
  type AdminCertificateCommerceConsole,
  type AdminCertificatePrice,
  type CertificateCommerceCurrency,
} from '../services/certificateCommerceService';

const emptyConsole: AdminCertificateCommerceConsole = {
  prices: [],
  orders: [],
  credentials: [],
  audits: [],
  counts: { pendingOrders: 0, paidOrders: 0, waivedOrders: 0, credentials: 0 },
};

const formatDate = (value?: string | null): string => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
};

const priceKey = (price: Pick<AdminCertificatePrice, 'productCode' | 'currency'>) =>
  `${price.productCode}:${price.currency}`;

export default function AdminCertificateCommerceLauncher() {
  const [isAuthorised, setIsAuthorised] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [consoleData, setConsoleData] = useState<AdminCertificateCommerceConsole>(emptyConsole);
  const [eligibilities, setEligibilities] = useState<AdminCertificateEligibility[]>([]);
  const [priceDrafts, setPriceDrafts] = useState<Record<string, { early: string; standard: string; active: boolean }>>({});
  const [waiverEligibilityId, setWaiverEligibilityId] = useState('');
  const [waiverReason, setWaiverReason] = useState('');
  const [waiverCurrency, setWaiverCurrency] = useState<CertificateCommerceCurrency>('NGN');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const refreshAuthorisation = async () => {
    try {
      const current = await getCurrentPortalUser();
      const authorised = Boolean(current && ['exam_admin', 'super_admin'].includes(current.profile.role));
      setIsAuthorised(authorised);
      if (!authorised) setIsOpen(false);
    } catch {
      setIsAuthorised(false);
      setIsOpen(false);
    }
  };

  const refresh = async () => {
    try {
      setBusy('refresh');
      setError('');
      const [commerce, certificateAdmin] = await Promise.all([
        getCertificateCommerceAdminConsole(150),
        getCertificateAdminConsole(200),
      ]);
      setConsoleData(commerce);
      setEligibilities(
        certificateAdmin.eligibilities.filter((item) =>
          ['eligible', 'requested'].includes(item.eligibilityStatus) && item.integrityStatus === 'cleared',
        ),
      );
      setPriceDrafts(
        Object.fromEntries(
          commerce.prices.map((price) => [
            priceKey(price),
            {
              early: String(price.earlyAmountMinor / 100),
              standard: String(price.standardAmountMinor / 100),
              active: price.active,
            },
          ]),
        ),
      );
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Unable to load certificate commerce administration.');
    } finally {
      setBusy('');
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
    if (isOpen && isAuthorised) void refresh();
  }, [isOpen, isAuthorised]);

  const selectedEligibility = useMemo(
    () => eligibilities.find((item) => item.id === waiverEligibilityId) || null,
    [eligibilities, waiverEligibilityId],
  );

  const savePrice = async (price: AdminCertificatePrice) => {
    const draft = priceDrafts[priceKey(price)];
    if (!draft) return;
    const earlyAmountMinor = Math.round(Number(draft.early) * 100);
    const standardAmountMinor = Math.round(Number(draft.standard) * 100);
    if (!Number.isSafeInteger(earlyAmountMinor) || !Number.isSafeInteger(standardAmountMinor) || earlyAmountMinor <= 0 || standardAmountMinor < earlyAmountMinor) {
      setError('Enter valid prices. The standard price must be equal to or higher than the early price.');
      return;
    }

    try {
      setBusy(`price:${priceKey(price)}`);
      setError('');
      setMessage('');
      await updateCertificateProductPrice({
        productCode: price.productCode,
        currency: price.currency,
        earlyAmountMinor,
        standardAmountMinor,
        active: draft.active,
      });
      setMessage(`${price.productTitle} ${price.currency} pricing updated.`);
      await refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to update certificate price.');
    } finally {
      setBusy('');
    }
  };

  const submitWaiver = async () => {
    if (!selectedEligibility) {
      setError('Select an eligible certificate result.');
      return;
    }
    if (waiverReason.trim().length < 5) {
      setError('Enter a clear administrator waiver reason.');
      return;
    }

    try {
      setBusy('waiver');
      setError('');
      setMessage('');
      const result = await waiveCertificateOrder({
        eligibilityId: selectedEligibility.id,
        productCode: 'achievement',
        currency: waiverCurrency,
        reason: waiverReason,
      });
      setMessage(`Waiver authorised. Credential ${result.credentialCode || result.certificateNumber || ''} issued.`);
      setWaiverEligibilityId('');
      setWaiverReason('');
      await refresh();
    } catch (waiverError) {
      setError(waiverError instanceof Error ? waiverError.message : 'Unable to authorise certificate waiver.');
    } finally {
      setBusy('');
    }
  };

  if (!isAuthorised) return null;

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-36 left-5 z-[84] inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-slate-950 px-4 py-3 text-xs font-extrabold text-white shadow-2xl transition hover:-translate-y-0.5 hover:bg-slate-900"
        aria-label="Open certificate commerce administration"
      >
        <BadgeDollarSign className="h-4 w-4 text-emerald-400" />
        <span className="hidden sm:inline">Certificate Commerce</span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[155] overflow-y-auto bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-slate-950 text-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4">
          <div>
            <h1 className="text-lg font-black">Certificate Commerce Administration</h1>
            <p className="mt-1 text-xs text-slate-400">Pricing, paid orders, credential issuance, waivers and audit history</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void refresh()} className="rounded-lg border border-slate-700 p-2 text-slate-300" aria-label="Refresh certificate commerce administration"><RefreshCw className={`h-4 w-4 ${busy === 'refresh' ? 'animate-spin' : ''}`} /></button>
            <button type="button" onClick={() => setIsOpen(false)} className="rounded-lg border border-slate-700 p-2 text-slate-300" aria-label="Close certificate commerce administration"><X className="h-4 w-4" /></button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-8 px-4 py-8">
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Pending', consoleData.counts.pendingOrders, CreditCard],
            ['Paid', consoleData.counts.paidOrders, ShieldCheck],
            ['Waived', consoleData.counts.waivedOrders, TicketCheck],
            ['Credentials', consoleData.counts.credentials, FileBadge],
          ].map(([label, value, Icon]) => (
            <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><p className="text-xs font-black uppercase tracking-wider text-slate-400">{String(label)}</p><Icon className="h-5 w-5 text-emerald-600" /></div><p className="mt-3 text-3xl font-black">{Number(value)}</p></div>
          ))}
        </section>

        {error && <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700"><CircleAlert className="mt-0.5 h-5 w-5 shrink-0" />{error}</div>}
        {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">{message}</div>}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-black">Certificate prices</h2>
          <p className="mt-1 text-sm text-slate-500">Amounts are stored and validated on the server in minor currency units.</p>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {consoleData.prices.map((price) => {
              const key = priceKey(price);
              const draft = priceDrafts[key] || { early: '', standard: '', active: price.active };
              return (
                <article key={key} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3"><div><h3 className="font-black">{price.productTitle}</h3><p className="mt-1 text-xs font-bold text-slate-500">{price.currency}{price.requiresIdentityVerification ? ' · Identity verification required' : ''}</p></div><label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={draft.active} onChange={(event) => setPriceDrafts((current) => ({ ...current, [key]: { ...draft, active: event.target.checked } }))} />Active</label></div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold text-slate-500">Early price<input type="number" min="0" step="0.01" value={draft.early} onChange={(event) => setPriceDrafts((current) => ({ ...current, [key]: { ...draft, early: event.target.value } }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900" /></label><label className="text-xs font-bold text-slate-500">Standard price<input type="number" min="0" step="0.01" value={draft.standard} onChange={(event) => setPriceDrafts((current) => ({ ...current, [key]: { ...draft, standard: event.target.value } }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900" /></label></div>
                  <div className="mt-4 flex items-center justify-between gap-3"><p className="text-xs text-slate-500">Current: {formatCertificateMoney(price.earlyAmountMinor, price.currency)} / {formatCertificateMoney(price.standardAmountMinor, price.currency)}</p><button type="button" onClick={() => void savePrice(price)} disabled={busy === `price:${key}`} className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{busy === `price:${key}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save</button></div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="text-xl font-black text-amber-950">Authorised Certificate of Achievement waiver</h2>
          <p className="mt-1 text-sm leading-6 text-amber-900">Use only for documented scholarships, complimentary issuance, resolved payment exceptions or approved institutional arrangements. The reason is permanently audited. Professional Certificate waivers remain blocked until identity verification is implemented.</p>
          <div className="mt-5 grid gap-4 lg:grid-cols-[2fr_1fr]">
            <select value={waiverEligibilityId} onChange={(event) => setWaiverEligibilityId(event.target.value)} className="rounded-xl border border-amber-300 bg-white px-4 py-3 text-sm"><option value="">Select an eligible candidate result</option>{eligibilities.map((item) => <option key={item.id} value={item.id}>{item.candidateName} · {item.examinationTitle} · {item.score}%</option>)}</select>
            <select value={waiverCurrency} onChange={(event) => setWaiverCurrency(event.target.value as CertificateCommerceCurrency)} className="rounded-xl border border-amber-300 bg-white px-4 py-3 text-sm"><option value="NGN">NGN market</option><option value="USD">USD market</option></select>
          </div>
          <textarea value={waiverReason} onChange={(event) => setWaiverReason(event.target.value)} rows={3} placeholder="Document the approved waiver reason" className="mt-4 w-full rounded-xl border border-amber-300 bg-white px-4 py-3 text-sm" />
          <button type="button" onClick={() => void submitWaiver()} disabled={busy === 'waiver'} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-amber-700 px-4 py-3 text-sm font-black text-white disabled:opacity-50">{busy === 'waiver' ? <Loader2 className="h-4 w-4 animate-spin" /> : <TicketCheck className="h-4 w-4" />}Authorise waiver and issue</button>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-black">Recent certificate orders</h2>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm"><table className="min-w-full text-left text-sm"><thead className="bg-slate-100 text-xs uppercase tracking-wider text-slate-500"><tr><th className="p-4">Reference</th><th className="p-4">Candidate</th><th className="p-4">Product</th><th className="p-4">Amount</th><th className="p-4">Status</th><th className="p-4">Created</th></tr></thead><tbody>{consoleData.orders.map((order) => <tr key={order.orderId} className="border-t border-slate-100"><td className="p-4 font-mono text-xs">{order.reference}</td><td className="p-4"><p className="font-bold">{order.candidateName}</p><p className="text-xs text-slate-500">{order.candidateEmail}</p></td><td className="p-4">{order.productTitle}</td><td className="p-4">{formatCertificateMoney(order.payableAmountMinor, order.currency)}</td><td className="p-4 font-bold capitalize">{order.status}</td><td className="p-4">{formatDate(order.createdAt)}</td></tr>)}{!consoleData.orders.length && <tr><td colSpan={6} className="p-8 text-center text-slate-500">No certificate orders yet.</td></tr>}</tbody></table></div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-black">Paid and waived credentials</h2>
          <div className="grid gap-4 lg:grid-cols-2">{consoleData.credentials.map((credential) => <article key={credential.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><h3 className="font-black">{credential.candidateName}</h3><p className="mt-1 text-sm text-slate-500">{credential.examinationTitle}</p></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black capitalize text-emerald-700">{credential.status}</span></div><dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2"><div><dt className="uppercase text-slate-400">Credential</dt><dd className="mt-1 break-all font-mono font-bold">{credential.credentialCode}</dd></div><div><dt className="uppercase text-slate-400">Certificate</dt><dd className="mt-1 break-all font-mono font-bold">{credential.certificateNumber}</dd></div></dl></article>)}{!consoleData.credentials.length && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500 lg:col-span-2">No paid or waived credential records yet.</div>}</div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-black">Commerce audit trail</h2>
          <div className="mt-4 space-y-3">{consoleData.audits.slice(0, 40).map((audit) => <div key={audit.id} className="flex flex-col gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold">{audit.action.replaceAll('_', ' ')}</p><p className="mt-1 font-mono text-[11px] text-slate-500">Order: {audit.orderId || 'not linked'}</p></div><time className="text-xs text-slate-500">{formatDate(audit.createdAt)}</time></div>)}{!consoleData.audits.length && <p className="text-sm text-slate-500">No commerce audit events yet.</p>}</div>
        </section>
      </main>
    </div>
  );
}

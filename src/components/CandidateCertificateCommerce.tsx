import { useEffect, useMemo, useState } from 'react';
import {
  Award,
  BadgeCheck,
  Clock3,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  X,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { supabase } from '../lib/supabase';
import { getCurrentPortalUser } from '../services/authService';
import {
  formatCertificateMoney,
  getMyCertificateCommerce,
  initializeCertificatePayment,
  type CandidateCertificateCommerce as CommerceWorkspace,
  type CertificateCommerceCredential,
  type CertificateCommerceOffer,
} from '../services/certificateCommerceService';

const emptyWorkspace: CommerceWorkspace = {
  marketCurrency: 'USD',
  offers: [],
  orders: [],
  credentials: [],
  counts: { offers: 0, pendingOrders: 0, paidOrders: 0, credentials: 0 },
};

const formatDate = (value?: string | null): string => {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const remainingText = (expiresAt: string, now: number): string => {
  const remaining = Math.max(0, new Date(expiresAt).getTime() - now);
  if (!remaining) return 'Standard price applies';
  const days = Math.floor(remaining / 86_400_000);
  const hours = Math.floor((remaining % 86_400_000) / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  return `${days}d ${hours}h ${minutes}m remaining`;
};

const downloadBadge = (credential: CertificateCommerceCredential) => {
  const certificate = credential.certificate;
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#071d35"/>
      <stop offset="1" stop-color="#0f766e"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="1200" rx="160" fill="url(#bg)"/>
  <circle cx="600" cy="500" r="330" fill="none" stroke="#fbbf24" stroke-width="28"/>
  <circle cx="600" cy="500" r="270" fill="#ffffff" opacity="0.08"/>
  <text x="600" y="280" text-anchor="middle" fill="#fbbf24" font-size="70" font-family="Arial" font-weight="700">AGILECERT GLOBAL</text>
  <text x="600" y="445" text-anchor="middle" fill="#ffffff" font-size="115" font-family="Georgia" font-weight="700">IIPM</text>
  <text x="600" y="555" text-anchor="middle" fill="#ffffff" font-size="54" font-family="Arial" font-weight="700">${credential.productTitle.toUpperCase()}</text>
  <text x="600" y="650" text-anchor="middle" fill="#dbeafe" font-size="42" font-family="Arial">${certificate.programmeCode || 'PROFESSIONAL CREDENTIAL'}</text>
  <text x="600" y="910" text-anchor="middle" fill="#ffffff" font-size="46" font-family="Arial" font-weight="700">${certificate.holderName.toUpperCase()}</text>
  <text x="600" y="990" text-anchor="middle" fill="#cbd5e1" font-size="32" font-family="Courier New">${credential.badgeCode}</text>
  <text x="600" y="1070" text-anchor="middle" fill="#fbbf24" font-size="28" font-family="Arial">Publicly verifiable · Powered by IIPM</text>
</svg>`;
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${credential.badgeCode}.svg`;
  link.click();
  URL.revokeObjectURL(url);
};

const downloadTranscript = (credential: CertificateCommerceCredential) => {
  if (!credential.transcriptCode) return;
  const certificate = credential.certificate;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  doc.setFillColor(248, 250, 252);
  doc.rect(0, 0, 210, 297, 'F');
  doc.setDrawColor(15, 42, 74);
  doc.setLineWidth(1.2);
  doc.rect(10, 10, 190, 277);
  doc.setTextColor(15, 42, 74);
  doc.setFont('times', 'bold');
  doc.setFontSize(19);
  doc.text('INTEGRATED INSTITUTE OF PROFESSIONAL MANAGEMENT', 105, 28, { align: 'center' });
  doc.setFontSize(25);
  doc.text('EXAMINATION TRANSCRIPT', 105, 48, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  const rows = [
    ['Candidate', certificate.holderName],
    ['Examination', certificate.examinationTitle],
    ['Programme', certificate.programmeCode || 'AgileCert Global'],
    ['Score', `${certificate.score}%`],
    ['Pass mark', `${certificate.passMark}%`],
    ['Result', certificate.score >= certificate.passMark ? 'PASS' : 'NOT PASSED'],
    ['Certificate number', certificate.certificateNumber],
    ['Credential code', credential.credentialCode],
    ['Transcript code', credential.transcriptCode],
    ['Issue date', formatDate(certificate.issueDate)],
    ['Verification URL', credential.verificationUrl],
  ];
  let y = 72;
  rows.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, 24, y);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(value, 118);
    doc.text(lines, 70, y);
    y += Math.max(11, lines.length * 6 + 4);
  });
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('This transcript is generated from the immutable paid credential record.', 105, 276, { align: 'center' });
  doc.save(`${credential.transcriptCode}.pdf`);
};

const OfferCard = ({
  offer,
  now,
  busy,
  onCheckout,
}: {
  offer: CertificateCommerceOffer;
  now: number;
  busy: string;
  onCheckout: (offer: CertificateCommerceOffer) => void;
}) => {
  const saving = offer.standardAmountMinor - offer.payableAmountMinor;
  const professional = offer.productCode === 'professional';
  return (
    <article className={`flex h-full flex-col rounded-2xl border p-5 shadow-sm ${professional ? 'border-blue-200 bg-blue-50/40' : 'border-emerald-200 bg-white'}`}>
      <div className="flex items-start justify-between gap-4">
        <div className={`rounded-xl p-2.5 ${professional ? 'bg-blue-600 text-white' : 'bg-emerald-600 text-white'}`}>
          {professional ? <ShieldCheck className="h-5 w-5" /> : <Award className="h-5 w-5" />}
        </div>
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500">
          {offer.pricingWindow} price
        </span>
      </div>
      <h3 className="mt-4 text-lg font-black text-slate-950">{offer.productTitle}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{offer.productDescription}</p>
      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-3xl font-black text-slate-950">
          {formatCertificateMoney(offer.payableAmountMinor, offer.currency)}
        </p>
        {saving > 0 && (
          <p className="mt-1 text-xs font-bold text-emerald-700">
            Save {formatCertificateMoney(saving, offer.currency)} during the seven-day window
          </p>
        )}
        <p className="mt-2 text-xs text-slate-500">{remainingText(offer.earlyPriceExpiresAt, now)}</p>
      </div>
      <ul className="mt-4 flex-1 space-y-2">
        {offer.benefits.map((benefit) => (
          <li key={benefit} className="flex items-start gap-2 text-sm text-slate-700">
            <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <span>{benefit}</span>
          </li>
        ))}
      </ul>
      {!offer.checkoutAvailable && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs leading-5 text-blue-800">
          <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />
          Professional Certificate checkout opens after the identity-verification phase. No payment is collected yet.
        </div>
      )}
      <button
        type="button"
        disabled={!offer.checkoutAvailable || busy === `${offer.eligibilityId}:${offer.productCode}`}
        onClick={() => onCheckout(offer)}
        className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy === `${offer.eligibilityId}:${offer.productCode}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
        {offer.checkoutAvailable ? 'Proceed to secure checkout' : 'Coming after identity verification'}
      </button>
    </article>
  );
};

export default function CandidateCertificateCommerce() {
  const [isCandidate, setIsCandidate] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [workspace, setWorkspace] = useState<CommerceWorkspace>(emptyWorkspace);
  const [isLoading, setIsLoading] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [now, setNow] = useState(Date.now());

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

  const refresh = async () => {
    if (!isCandidate) return;
    try {
      setIsLoading(true);
      setError('');
      setWorkspace(await getMyCertificateCommerce());
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Unable to load certificate commerce.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refreshAuthorisation();
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    const refreshHandler = () => void refresh();
    window.addEventListener('agilecert-certificate-commerce-refresh', refreshHandler);
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      window.setTimeout(() => void refreshAuthorisation(), 0);
    });
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('agilecert-certificate-commerce-refresh', refreshHandler);
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (isOpen && isCandidate) void refresh();
  }, [isOpen, isCandidate]);

  const groupedOffers = useMemo(() => {
    const groups = new Map<string, CertificateCommerceOffer[]>();
    workspace.offers.forEach((offer) => {
      const key = offer.eligibilityId;
      groups.set(key, [...(groups.get(key) || []), offer]);
    });
    return Array.from(groups.values());
  }, [workspace.offers]);

  const checkout = async (offer: CertificateCommerceOffer) => {
    const key = `${offer.eligibilityId}:${offer.productCode}`;
    try {
      setBusy(key);
      setError('');
      setMessage('');
      const result = await initializeCertificatePayment({
        eligibilityId: offer.eligibilityId,
        productCode: offer.productCode,
        currency: offer.currency,
      });
      if (result.paymentRequired === false) {
        setMessage(result.alreadyPaid ? 'This certificate order is already paid.' : 'This certificate has already been issued.');
        await refresh();
      }
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : 'Unable to start certificate checkout.');
    } finally {
      setBusy('');
    }
  };

  if (!isCandidate) return null;

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-5 left-5 z-[83] inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-slate-950 px-4 py-3 text-xs font-extrabold text-white shadow-2xl transition hover:-translate-y-0.5 hover:bg-slate-900"
        aria-label="Open certificate payment and credentials"
      >
        <ShoppingBag className="h-4 w-4 text-emerald-400" />
        <span className="hidden sm:inline">Credential Store</span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[145] overflow-y-auto bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-slate-950 text-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4">
          <div>
            <h1 className="text-lg font-black">Certificate Payment & Credential Centre</h1>
            <p className="mt-1 text-xs text-slate-400">Separate certificate checkout, paid credentials, badges and transcripts</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void refresh()} className="rounded-lg border border-slate-700 p-2 text-slate-300" aria-label="Refresh credential store">
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button type="button" onClick={() => setIsOpen(false)} className="rounded-lg border border-slate-700 p-2 text-slate-300" aria-label="Close credential store">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-8 px-4 py-8">
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Available offers', workspace.counts.offers, ShoppingBag],
            ['Pending payments', workspace.counts.pendingOrders, Clock3],
            ['Paid orders', workspace.counts.paidOrders, CreditCard],
            ['Credentials', workspace.counts.credentials, BadgeCheck],
          ].map(([label, value, Icon]) => (
            <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-black uppercase tracking-wider text-slate-400">{String(label)}</p>
                <Icon className="h-5 w-5 text-emerald-600" />
              </div>
              <p className="mt-3 text-3xl font-black">{Number(value)}</p>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
          <p className="font-black">Examination and certificate fees are separate.</p>
          <p className="mt-1 leading-6">Passing creates eligibility. A certificate, paid credential and digital badge are issued only after verified certificate payment or an authorised administrator waiver.</p>
        </section>

        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div>}
        {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">{message}</div>}

        <section className="space-y-5">
          <div>
            <h2 className="text-xl font-black">Certificate offers</h2>
            <p className="mt-1 text-sm text-slate-500">Prices are calculated on the server for your {workspace.marketCurrency} market.</p>
          </div>
          {!groupedOffers.length ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">No unpaid eligible certificate offer is currently available.</div>
          ) : groupedOffers.map((offers) => (
            <div key={offers[0].eligibilityId} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-5 flex flex-col gap-3 border-b border-slate-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-black text-slate-950">{offers[0].examinationTitle}</h3>
                  <p className="mt-1 text-sm text-slate-500">Score {offers[0].score}% · Pass mark {offers[0].passMark}% · Passed {formatDate(offers[0].passedAt)}</p>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">Integrity cleared</span>
              </div>
              <div className="grid gap-5 lg:grid-cols-2">
                {offers.map((offer) => (
                  <div key={offer.productCode}>
                    <OfferCard offer={offer} now={now} busy={busy} onCheckout={(selected) => void checkout(selected)} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-black">Order history</h2>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase tracking-wider text-slate-500"><tr><th className="p-4">Reference</th><th className="p-4">Product</th><th className="p-4">Amount</th><th className="p-4">Status</th><th className="p-4">Created</th></tr></thead>
              <tbody>
                {workspace.orders.map((order) => <tr key={order.orderId} className="border-t border-slate-100"><td className="p-4 font-mono text-xs">{order.reference}</td><td className="p-4 font-bold">{order.productTitle || order.productCode}</td><td className="p-4">{formatCertificateMoney(order.payableAmountMinor, order.currency)}</td><td className="p-4 font-bold capitalize">{order.status}</td><td className="p-4">{formatDate(order.createdAt)}</td></tr>)}
                {!workspace.orders.length && <tr><td colSpan={5} className="p-8 text-center text-slate-500">No certificate orders yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-black">Paid credentials</h2>
          <div className="grid gap-5 lg:grid-cols-2">
            {workspace.credentials.map((credential) => (
              <article key={credential.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4"><div><h3 className="font-black">{credential.productTitle}</h3><p className="mt-1 text-sm text-slate-500">{credential.certificate.examinationTitle}</p></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black capitalize text-emerald-700">{credential.status}</span></div>
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-xs uppercase text-slate-400">Credential</dt><dd className="mt-1 break-all font-mono font-bold">{credential.credentialCode}</dd></div><div><dt className="text-xs uppercase text-slate-400">Badge</dt><dd className="mt-1 break-all font-mono font-bold">{credential.badgeCode}</dd></div></dl>
                <div className="mt-5 flex flex-wrap gap-2">
                  <a href={credential.verificationUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white"><ExternalLink className="h-4 w-4" />Verify</a>
                  <button type="button" onClick={() => navigator.clipboard.writeText(credential.verificationUrl)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold"><Copy className="h-4 w-4" />Copy link</button>
                  <button type="button" onClick={() => downloadBadge(credential)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold"><Download className="h-4 w-4" />Badge</button>
                  {credential.transcriptCode && <button type="button" onClick={() => downloadTranscript(credential)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold"><FileText className="h-4 w-4" />Transcript</button>}
                </div>
              </article>
            ))}
            {!workspace.credentials.length && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500 lg:col-span-2">Paid credentials will appear here after payment verification or an authorised waiver.</div>}
          </div>
        </section>
      </main>
    </div>
  );
}

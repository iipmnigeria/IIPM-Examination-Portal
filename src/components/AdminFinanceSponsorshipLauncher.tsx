import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  BadgeDollarSign,
  Banknote,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  Download,
  FileInput,
  FileText,
  Gift,
  Landmark,
  LayoutDashboard,
  Loader2,
  Plus,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  Save,
  Settings2,
  ShieldCheck,
  TicketCheck,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getCurrentPortalUser } from '../services/authService';
import { downloadFinanceDocument } from '../services/financeDocumentService';
import {
  authorizeSponsoredInvoiceAccess,
  convertQuoteToInvoice,
  createCreditNote,
  createInstitutionQuote,
  createReconciliationBatch,
  createSponsorshipPool,
  decideInstitutionQuote,
  decideRefundRequest,
  getAdminFinanceConsole,
  issueInstitutionQuote,
  markRefundProcessed,
  nominateSponsoredCandidate,
  recordInstitutionPayment,
  requestInstitutionRefund,
  resolveReconciliationLine,
  reviewInstitutionPayment,
  saveFinanceSettings,
  saveInstitutionContact,
  saveInstitutionalCustomer,
  saveTaxProfile,
  type AdminFinanceConsole,
  type FinanceRecord,
} from '../services/financeSponsorshipService';

const emptyConsole: AdminFinanceConsole = {
  generatedAt: '', actorId: '', settings: {}, taxProfiles: [], summary: {}, customers: [],
  quotes: [], invoices: [], payments: [], receipts: [], seatPools: [], nominations: [],
  refunds: [], creditNotes: [], reconciliationBatches: [], auditEvents: [],
};

const formatMoney = (amountMinor: number | string | null | undefined, currency = 'NGN') => {
  const amount = Number(amountMinor || 0) / 100;
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  }
};

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
};

const statusClass: Record<string, string> = {
  active: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  paid: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  issued: 'border-blue-200 bg-blue-50 text-blue-700',
  confirmed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  accepted: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  submitted: 'border-amber-200 bg-amber-50 text-amber-700',
  requested: 'border-amber-200 bg-amber-50 text-amber-700',
  under_review: 'border-blue-200 bg-blue-50 text-blue-700',
  processing: 'border-cyan-200 bg-cyan-50 text-cyan-700',
  part_paid: 'border-amber-200 bg-amber-50 text-amber-700',
  overdue: 'border-rose-200 bg-rose-50 text-rose-700',
  draft: 'border-slate-200 bg-slate-50 text-slate-600',
  exhausted: 'border-purple-200 bg-purple-50 text-purple-700',
  suspended: 'border-orange-200 bg-orange-50 text-orange-700',
  rejected: 'border-rose-200 bg-rose-50 text-rose-700',
  failed: 'border-rose-200 bg-rose-50 text-rose-700',
  matched: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  unmatched: 'border-rose-200 bg-rose-50 text-rose-700',
  duplicate: 'border-orange-200 bg-orange-50 text-orange-700',
  short_payment: 'border-amber-200 bg-amber-50 text-amber-700',
  overpayment: 'border-cyan-200 bg-cyan-50 text-cyan-700',
};

const inputClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100';
const labelClass = 'block text-[10px] font-black uppercase tracking-wider text-slate-500';

export default function AdminFinanceSponsorshipLauncher() {
  const [authorised, setAuthorised] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState<'overview' | 'customers' | 'quotes' | 'invoices' | 'payments' | 'sponsorship' | 'refunds' | 'reconciliation' | 'settings'>('overview');
  const [consoleData, setConsoleData] = useState<AdminFinanceConsole>(emptyConsole);
  const [examinations, setExaminations] = useState<FinanceRecord[]>([]);
  const [programmes, setProgrammes] = useState<FinanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [quoteItems, setQuoteItems] = useState<FinanceRecord[]>([]);
  const [customerForm, setCustomerForm] = useState({
    legalName: '', tradingName: '', billingEmail: '', billingPhone: '', countryCode: 'NG',
    defaultCurrency: 'NGN', creditLimit: '0', paymentTermsDays: '14', discountPercent: '0',
    registrationNumber: '', taxIdentifier: '', address: '', notes: '',
  });
  const [quoteForm, setQuoteForm] = useState({
    customerId: '', currency: 'NGN', purchaseOrderReference: '', validUntil: '', notes: '', terms: '',
    productType: 'examination', examinationId: '', programmeId: '', certificateProductCode: 'achievement',
    description: '', quantity: '1', unitAmount: '', discountPercent: '0', taxRatePercent: '0',
  });
  const [paymentForm, setPaymentForm] = useState({
    customerId: '', provider: 'bank_transfer', externalReference: '', providerTransactionId: '',
    currency: 'NGN', amount: '', paymentDate: new Date().toISOString().slice(0, 10),
    payerName: '', payerEmail: '', evidenceObjectPath: '',
  });
  const [reconciliationForm, setReconciliationForm] = useState({
    provider: 'bank_transfer', currency: 'NGN', statementFrom: '', statementTo: '',
    sourceFileName: '', linesJson: '[\n  {"externalReference":"","transactionDate":"","direction":"credit","currency":"NGN","amountMinor":0}\n]',
  });

  const refreshAuthorisation = async () => {
    try {
      const current = await getCurrentPortalUser();
      const allowed = current?.profile.role === 'exam_admin' || current?.profile.role === 'super_admin';
      setAuthorised(allowed);
      if (!allowed) setIsOpen(false);
    } catch {
      setAuthorised(false);
      setIsOpen(false);
    }
  };

  const refresh = async () => {
    if (!authorised) return;
    try {
      setLoading(true);
      setError('');
      const [snapshot, examResult, programmeResult] = await Promise.all([
        getAdminFinanceConsole(250),
        supabase.from('examinations').select('id, title, programme_id, status').neq('status', 'archived').order('title'),
        supabase.from('programmes').select('id, code, name, is_active').order('code'),
      ]);
      if (examResult.error) throw new Error(examResult.error.message);
      if (programmeResult.error) throw new Error(programmeResult.error.message);
      setConsoleData(snapshot);
      setExaminations((examResult.data || []) as FinanceRecord[]);
      setProgrammes((programmeResult.data || []) as FinanceRecord[]);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Unable to load the finance administration console.');
    } finally {
      setLoading(false);
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
    if (isOpen && authorised) void refresh();
  }, [isOpen, authorised]);

  const runAction = async (key: string, action: () => Promise<unknown>, success: string) => {
    try {
      setBusy(key);
      setError('');
      setMessage('');
      await action();
      setMessage(success);
      window.dispatchEvent(new Event('agilecert-finance-workspace-refresh'));
      await refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'The finance action could not be completed.');
    } finally {
      setBusy('');
    }
  };

  const addQuoteLine = () => {
    const quantity = Number(quoteForm.quantity);
    const unitAmountMinor = Math.round(Number(quoteForm.unitAmount) * 100);
    if (!quoteForm.description.trim() || !Number.isInteger(quantity) || quantity < 1 || !Number.isFinite(unitAmountMinor) || unitAmountMinor < 0) {
      setError('Enter a description, valid quantity and unit amount before adding the line.');
      return;
    }
    if (quoteForm.productType === 'examination' && !quoteForm.examinationId) {
      setError('Select an examination for this quotation line.');
      return;
    }
    setQuoteItems((items) => [...items, {
      productType: quoteForm.productType,
      examinationId: quoteForm.productType === 'examination' ? quoteForm.examinationId : null,
      programmeId: quoteForm.programmeId || null,
      certificateProductCode: quoteForm.productType === 'certificate' ? quoteForm.certificateProductCode : null,
      description: quoteForm.description.trim(), quantity, unitAmountMinor,
      discountPercent: Number(quoteForm.discountPercent || 0), taxRatePercent: Number(quoteForm.taxRatePercent || 0),
    }]);
    setQuoteForm((form) => ({ ...form, description: '', quantity: '1', unitAmount: '' }));
    setError('');
  };

  const submitCustomer = (event: FormEvent) => {
    event.preventDefault();
    void runAction('save-customer', async () => {
      const result = await saveInstitutionalCustomer({
        legalName: customerForm.legalName, tradingName: customerForm.tradingName,
        registrationNumber: customerForm.registrationNumber, taxIdentifier: customerForm.taxIdentifier,
        billingEmail: customerForm.billingEmail, billingPhone: customerForm.billingPhone,
        billingAddress: customerForm.address ? { line1: customerForm.address } : {},
        countryCode: customerForm.countryCode, defaultCurrency: customerForm.defaultCurrency,
        creditLimitMinor: Math.round(Number(customerForm.creditLimit || 0) * 100),
        paymentTermsDays: Number(customerForm.paymentTermsDays || 14),
        institutionalDiscountPercent: Number(customerForm.discountPercent || 0),
        taxProfileId: consoleData.settings.default_tax_profile_id || consoleData.settings.defaultTaxProfileId || null,
        status: 'active', notes: customerForm.notes,
      });
      setCustomerForm({ legalName: '', tradingName: '', billingEmail: '', billingPhone: '', countryCode: 'NG', defaultCurrency: 'NGN', creditLimit: '0', paymentTermsDays: '14', discountPercent: '0', registrationNumber: '', taxIdentifier: '', address: '', notes: '' });
      if (!result.id) throw new Error('The customer identifier was not returned.');
    }, 'Institutional customer saved.');
  };

  const submitQuote = (event: FormEvent) => {
    event.preventDefault();
    if (!quoteItems.length) {
      setError('Add at least one quotation line.');
      return;
    }
    void runAction('create-quote', async () => {
      await createInstitutionQuote({ ...quoteForm, items: quoteItems });
      setQuoteItems([]);
      setQuoteForm((form) => ({ ...form, purchaseOrderReference: '', validUntil: '', notes: '', terms: '', description: '', unitAmount: '' }));
    }, 'Institutional quotation created as a draft.');
  };

  const submitPayment = (event: FormEvent) => {
    event.preventDefault();
    void runAction('record-payment', async () => {
      await recordInstitutionPayment({ ...paymentForm, amountMinor: Math.round(Number(paymentForm.amount) * 100) });
      setPaymentForm((form) => ({ ...form, externalReference: '', providerTransactionId: '', amount: '', payerName: '', payerEmail: '', evidenceObjectPath: '' }));
    }, 'Institutional payment recorded for review.');
  };

  const submitReconciliation = (event: FormEvent) => {
    event.preventDefault();
    void runAction('reconcile', async () => {
      const lines = JSON.parse(reconciliationForm.linesJson);
      if (!Array.isArray(lines)) throw new Error('Reconciliation lines must be a JSON array.');
      await createReconciliationBatch({ ...reconciliationForm, lines });
    }, 'The reconciliation batch was processed.');
  };

  const createContact = (customer: FinanceRecord) => {
    const fullName = window.prompt('Contact full name');
    if (!fullName) return;
    const email = window.prompt('Contact email');
    if (!email) return;
    const role = window.prompt('Contact role: billing, sponsor, administrator, approver or other', 'billing') || 'billing';
    void runAction(`contact-${customer.id}`, () => saveInstitutionContact({ customerId: customer.id, fullName, email, contactRole: role, isPrimary: !(customer.contacts || []).length, isActive: true }), 'Institutional contact saved.');
  };

  const handleQuoteAction = (quote: FinanceRecord, action: 'issue' | 'accept' | 'reject' | 'invoice') => {
    if (action === 'issue') void runAction(`issue-${quote.id}`, () => issueInstitutionQuote(quote.id), 'Quotation issued.');
    if (action === 'accept') void runAction(`accept-${quote.id}`, () => decideInstitutionQuote(quote.id, 'accepted', 'Accepted by the authorised institutional finance administrator.'), 'Quotation accepted.');
    if (action === 'reject') {
      const note = window.prompt('Reason for rejecting the quotation');
      if (note) void runAction(`reject-${quote.id}`, () => decideInstitutionQuote(quote.id, 'rejected', note), 'Quotation rejected.');
    }
    if (action === 'invoice') void runAction(`invoice-${quote.id}`, () => convertQuoteToInvoice({ quoteId: quote.id }), 'Quotation converted to an invoice.');
  };

  const confirmPayment = (payment: FinanceRecord) => {
    const invoiceId = window.prompt('Invoice ID to allocate this payment to', consoleData.invoices.find((invoice) => invoice.customerId === payment.customerId && invoice.currency === payment.currency && Number(invoice.balanceAmountMinor) > 0)?.id || '');
    if (!invoiceId) return;
    const defaultAmount = Math.min(Number(payment.amountMinor || 0), Number(consoleData.invoices.find((invoice) => invoice.id === invoiceId)?.balanceAmountMinor || payment.amountMinor || 0));
    const amount = Number(window.prompt(`Allocation amount in ${payment.currency}`, String(defaultAmount / 100)) || '0');
    const note = window.prompt('Payment review note', 'Payment evidence and reference verified.') || '';
    void runAction(`confirm-payment-${payment.id}`, () => reviewInstitutionPayment({ paymentId: payment.id, decision: 'confirmed', reviewNote: note, allocations: [{ invoiceId, amountMinor: Math.round(amount * 100) }] }), 'Payment confirmed, allocated and receipted.');
  };

  const addPool = (invoice: FinanceRecord, item: FinanceRecord) => {
    const validUntil = window.prompt('Seat pool expiry (ISO date/time, optional)', '');
    void runAction(`pool-${item.id}`, () => createSponsorshipPool({ invoiceItemId: item.id, validUntil: validUntil || null, notes: `Created from invoice ${invoice.invoiceNumber}` }), 'Sponsorship seat pool created.');
  };

  const authorizeInvoice = (invoice: FinanceRecord) => {
    const reason = window.prompt('Super Administrator credit-authorisation reason (minimum 15 characters)');
    if (reason) void runAction(`authorize-${invoice.id}`, () => authorizeSponsoredInvoiceAccess(invoice.id, reason), 'Sponsored access authorised within the customer credit limit.');
  };

  const addCredit = (invoice: FinanceRecord) => {
    const amount = Number(window.prompt(`Credit-note amount in ${invoice.currency}`, '0') || '0');
    const reason = window.prompt('Credit-note reason');
    if (amount > 0 && reason) void runAction(`credit-${invoice.id}`, () => createCreditNote({ invoiceId: invoice.id, amountMinor: Math.round(amount * 100), reason, issueNow: true }), 'Credit note issued and invoice balance recalculated.');
  };

  const nominate = (pool: FinanceRecord) => {
    const email = window.prompt('Candidate account email');
    if (!email) return;
    const eligibilityId = pool.productType === 'certificate' ? window.prompt('Candidate certificate eligibility ID') : null;
    if (pool.productType === 'certificate' && !eligibilityId) return;
    void runAction(`nominate-${pool.id}`, () => nominateSponsoredCandidate({ seatPoolId: pool.id, candidateEmail: email, eligibilityId: eligibilityId || null }), 'Candidate sponsorship nomination created.');
  };

  const handleRefund = (refund: FinanceRecord, action: 'approve' | 'reject' | 'paid' | 'failed') => {
    if (action === 'approve') {
      const amount = Number(window.prompt(`Approved amount in ${refund.currency}`, String(Number(refund.requestedAmountMinor || 0) / 100)) || '0');
      const reason = window.prompt('Approval reason');
      if (reason) void runAction(`refund-approve-${refund.id}`, () => decideRefundRequest({ refundId: refund.id, decision: 'approved', approvedAmountMinor: Math.round(amount * 100), decisionReason: reason }), 'Refund request approved.');
    } else if (action === 'reject') {
      const reason = window.prompt('Rejection reason');
      if (reason) void runAction(`refund-reject-${refund.id}`, () => decideRefundRequest({ refundId: refund.id, decision: 'rejected', decisionReason: reason }), 'Refund request rejected.');
    } else {
      const reference = action === 'paid' ? window.prompt('External refund reference') : '';
      if (action === 'paid' && !reference) return;
      const note = window.prompt('Processing note') || '';
      void runAction(`refund-${action}-${refund.id}`, () => markRefundProcessed({ refundId: refund.id, status: action, externalRefundReference: reference, note }), `Refund marked ${action}.`);
    }
  };

  const institutionRefund = (payment: FinanceRecord) => {
    const amount = Number(window.prompt(`Refund amount in ${payment.currency}`, '0') || '0');
    const reason = window.prompt('Institutional refund reason');
    const creditNoteId = window.prompt('Related issued credit-note ID (optional)', '') || null;
    if (amount > 0 && reason) void runAction(`institution-refund-${payment.id}`, () => requestInstitutionRefund({ paymentId: payment.id, amountMinor: Math.round(amount * 100), reason, creditNoteId }), 'Institutional refund request created.');
  };

  const download = (type: string, id: string) => void runAction(`download-${type}-${id}`, () => downloadFinanceDocument(type, id), 'Finance document downloaded.');

  const settingsForm = useMemo(() => ({
    defaultCurrency: consoleData.settings.default_currency || consoleData.settings.defaultCurrency || 'NGN',
    quoteValidityDays: Number(consoleData.settings.quote_validity_days || consoleData.settings.quoteValidityDays || 14),
    invoicePaymentTermsDays: Number(consoleData.settings.invoice_payment_terms_days || consoleData.settings.invoicePaymentTermsDays || 14),
    maximumInstitutionalDiscountPercent: Number(consoleData.settings.maximum_institutional_discount_percent || consoleData.settings.maximumInstitutionalDiscountPercent || 25),
    refundSuperAdminThresholdMinor: Number(consoleData.settings.refund_super_admin_threshold_minor || consoleData.settings.refundSuperAdminThresholdMinor || 5000000),
    defaultTaxProfileId: consoleData.settings.default_tax_profile_id || consoleData.settings.defaultTaxProfileId || null,
    allowPartialPayments: consoleData.settings.allow_partial_payments ?? consoleData.settings.allowPartialPayments ?? true,
    allowOverpayments: consoleData.settings.allow_overpayments ?? consoleData.settings.allowOverpayments ?? false,
  }), [consoleData.settings]);

  if (!authorised) return null;
  if (!isOpen) {
    return (
      <button type="button" onClick={() => setIsOpen(true)} className="fixed bottom-24 right-5 z-[86] inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-slate-950 px-4 py-3 text-xs font-extrabold text-white shadow-2xl transition hover:-translate-y-0.5 hover:bg-slate-900" aria-label="Open finance and sponsorship administration">
        <Landmark className="h-4 w-4 text-cyan-300" /><span className="hidden sm:inline">Finance & Sponsorship</span>
      </button>
    );
  }

  const tabs = [
    ['overview', 'Overview', LayoutDashboard], ['customers', 'Customers', Building2], ['quotes', 'Quotes', FileText],
    ['invoices', 'Invoices', ReceiptText], ['payments', 'Payments', Banknote], ['sponsorship', 'Sponsorship', Gift],
    ['refunds', 'Refunds', RotateCcw], ['reconciliation', 'Reconciliation', ClipboardCheck], ['settings', 'Settings', Settings2],
  ] as const;

  return (
    <div className="fixed inset-0 z-[160] overflow-y-auto bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950 text-white shadow-xl">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3"><div className="rounded-xl bg-cyan-400/15 p-2.5 text-cyan-300"><Landmark className="h-6 w-6" /></div><div><h1 className="text-lg font-black">Finance, Commerce & Institutional Sponsorship</h1><p className="mt-1 text-xs text-slate-400">Invoices, payments, seats, refunds, reconciliation and auditable finance operations</p></div></div>
          <div className="flex items-center gap-2"><button type="button" onClick={() => void refresh()} className="rounded-lg border border-slate-700 p-2 text-slate-300"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button><button type="button" onClick={() => setIsOpen(false)} className="rounded-lg border border-slate-700 p-2 text-slate-300"><X className="h-4 w-4" /></button></div>
        </div>
        <nav className="mx-auto flex max-w-[1500px] gap-1 overflow-x-auto px-4 pb-3">
          {tabs.map(([value, label, Icon]) => <button key={value} type="button" onClick={() => setTab(value)} className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-black ${tab === value ? 'bg-cyan-500 text-slate-950' : 'text-slate-300 hover:bg-slate-800'}`}><Icon className="h-4 w-4" />{label}</button>)}
        </nav>
      </header>

      <main className="mx-auto max-w-[1500px] space-y-6 px-4 py-7">
        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div>}
        {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">{message}</div>}

        {tab === 'overview' && (
          <div className="space-y-6">
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
              {[
                ['Customers', consoleData.summary.activeCustomers || 0, Building2], ['Open quotes', consoleData.summary.openQuotes || 0, FileText],
                ['Open invoices', consoleData.summary.openInvoices || 0, ReceiptText], ['Overdue', consoleData.summary.overdueInvoices || 0, CircleDollarSign],
                ['Payment reviews', consoleData.summary.pendingPayments || 0, Banknote], ['Refunds', consoleData.summary.pendingRefunds || 0, RotateCcw],
                ['Recon exceptions', consoleData.summary.reconciliationExceptions || 0, ClipboardCheck],
              ].map(([label, value, Icon]) => <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><p className="text-[10px] font-black uppercase text-slate-400">{String(label)}</p><Icon className="h-4 w-4 text-cyan-700" /></div><p className="mt-2 text-2xl font-black">{String(value)}</p></div>)}
            </section>
            <section className="grid gap-5 lg:grid-cols-3">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2"><h2 className="font-black">Invoice balances by currency</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{(consoleData.summary.invoiceBalancesByCurrency || []).map((row: FinanceRecord) => <div key={row.currency} className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-black text-slate-400">{row.currency}</p><p className="mt-2 text-xl font-black">{formatMoney(row.balanceAmountMinor, row.currency)} outstanding</p><p className="mt-1 text-xs text-slate-500">Paid {formatMoney(row.paidAmountMinor, row.currency)} · Credits {formatMoney(row.creditedAmountMinor, row.currency)}</p></div>)}</div></div>
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="font-black">Sponsorship utilisation</h2><div className="mt-4 space-y-3">{(consoleData.summary.sponsorshipUtilisation || []).map((row: FinanceRecord) => <div key={row.productType} className="rounded-xl bg-slate-50 p-3"><div className="flex justify-between text-xs font-black uppercase"><span>{row.productType}</span><span>{row.consumedSeats}/{row.purchasedSeats}</span></div><div className="mt-2 h-2 rounded-full bg-slate-200"><div className="h-2 rounded-full bg-emerald-600" style={{ width: `${Math.min(100, Number(row.purchasedSeats) ? Number(row.consumedSeats) / Number(row.purchasedSeats) * 100 : 0)}%` }} /></div></div>)}</div></div>
            </section>
          </div>
        )}

        {tab === 'customers' && (
          <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
            <form onSubmit={submitCustomer} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="flex items-center gap-2 text-lg font-black"><Plus className="h-5 w-5 text-cyan-700" />Add institutional customer</h2><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className={labelClass}>Legal name<input className={`${inputClass} mt-2`} value={customerForm.legalName} onChange={(e) => setCustomerForm({ ...customerForm, legalName: e.target.value })} required /></label><label className={labelClass}>Trading name<input className={`${inputClass} mt-2`} value={customerForm.tradingName} onChange={(e) => setCustomerForm({ ...customerForm, tradingName: e.target.value })} /></label><label className={labelClass}>Billing email<input type="email" className={`${inputClass} mt-2`} value={customerForm.billingEmail} onChange={(e) => setCustomerForm({ ...customerForm, billingEmail: e.target.value })} required /></label><label className={labelClass}>Billing phone<input className={`${inputClass} mt-2`} value={customerForm.billingPhone} onChange={(e) => setCustomerForm({ ...customerForm, billingPhone: e.target.value })} /></label><label className={labelClass}>Registration number<input className={`${inputClass} mt-2`} value={customerForm.registrationNumber} onChange={(e) => setCustomerForm({ ...customerForm, registrationNumber: e.target.value })} /></label><label className={labelClass}>Tax identifier<input className={`${inputClass} mt-2`} value={customerForm.taxIdentifier} onChange={(e) => setCustomerForm({ ...customerForm, taxIdentifier: e.target.value })} /></label><label className={labelClass}>Currency<input className={`${inputClass} mt-2`} value={customerForm.defaultCurrency} onChange={(e) => setCustomerForm({ ...customerForm, defaultCurrency: e.target.value.toUpperCase() })} maxLength={3} required /></label><label className={labelClass}>Credit limit<input type="number" min="0" step="0.01" className={`${inputClass} mt-2`} value={customerForm.creditLimit} onChange={(e) => setCustomerForm({ ...customerForm, creditLimit: e.target.value })} /></label><label className={labelClass}>Payment terms days<input type="number" min="0" max="365" className={`${inputClass} mt-2`} value={customerForm.paymentTermsDays} onChange={(e) => setCustomerForm({ ...customerForm, paymentTermsDays: e.target.value })} /></label><label className={labelClass}>Discount percent<input type="number" min="0" max="100" step="0.01" className={`${inputClass} mt-2`} value={customerForm.discountPercent} onChange={(e) => setCustomerForm({ ...customerForm, discountPercent: e.target.value })} /></label></div><label className={`${labelClass} mt-4`}>Billing address<input className={`${inputClass} mt-2`} value={customerForm.address} onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })} /></label><label className={`${labelClass} mt-4`}>Notes<textarea className={`${inputClass} mt-2 min-h-20`} value={customerForm.notes} onChange={(e) => setCustomerForm({ ...customerForm, notes: e.target.value })} /></label><button disabled={Boolean(busy)} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white disabled:opacity-50">{busy === 'save-customer' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save customer</button></form>
            <section className="space-y-4"><h2 className="text-lg font-black">Institutional customers</h2>{consoleData.customers.map((customer) => <article key={customer.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black text-cyan-700">{customer.customerCode}</p><h3 className="mt-1 text-lg font-black">{customer.legalName}</h3><p className="mt-1 text-sm text-slate-500">{customer.billingEmail}</p></div><span className={`rounded-full border px-3 py-1 text-xs font-black capitalize ${statusClass[customer.status] || statusClass.draft}`}>{customer.status}</span></div><div className="mt-4 grid gap-2 text-xs text-slate-600 sm:grid-cols-3"><span>Currency <strong>{customer.defaultCurrency}</strong></span><span>Credit <strong>{formatMoney(customer.creditLimitMinor, customer.defaultCurrency)}</strong></span><span>Terms <strong>{customer.paymentTermsDays} days</strong></span></div><div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => createContact(customer)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-black"><Users className="mr-1 inline h-3.5 w-3.5" />Add contact</button></div></article>)}</section>
          </div>
        )}

        {tab === 'quotes' && (
          <div className="space-y-6">
            <form onSubmit={submitQuote} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><h2 className="text-lg font-black">Create institutional quotation</h2><span className="text-xs font-bold text-slate-400">{quoteItems.length} line(s)</span></div><div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><label className={labelClass}>Customer<select className={`${inputClass} mt-2`} value={quoteForm.customerId} onChange={(e) => setQuoteForm({ ...quoteForm, customerId: e.target.value })} required><option value="">Select customer</option>{consoleData.customers.filter((c) => c.status === 'active').map((c) => <option key={c.id} value={c.id}>{c.legalName}</option>)}</select></label><label className={labelClass}>Currency<input className={`${inputClass} mt-2`} maxLength={3} value={quoteForm.currency} onChange={(e) => setQuoteForm({ ...quoteForm, currency: e.target.value.toUpperCase() })} /></label><label className={labelClass}>Purchase order<input className={`${inputClass} mt-2`} value={quoteForm.purchaseOrderReference} onChange={(e) => setQuoteForm({ ...quoteForm, purchaseOrderReference: e.target.value })} /></label><label className={labelClass}>Valid until<input type="date" className={`${inputClass} mt-2`} value={quoteForm.validUntil} onChange={(e) => setQuoteForm({ ...quoteForm, validUntil: e.target.value })} /></label></div><div className="mt-5 rounded-2xl bg-slate-50 p-4"><p className="text-xs font-black uppercase text-slate-500">Add quotation line</p><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label className={labelClass}>Product<select className={`${inputClass} mt-2`} value={quoteForm.productType} onChange={(e) => setQuoteForm({ ...quoteForm, productType: e.target.value })}><option value="examination">Examination</option><option value="certificate">Certificate</option><option value="service">Service</option></select></label>{quoteForm.productType === 'examination' && <label className={labelClass}>Examination<select className={`${inputClass} mt-2`} value={quoteForm.examinationId} onChange={(e) => setQuoteForm({ ...quoteForm, examinationId: e.target.value, programmeId: examinations.find((exam) => exam.id === e.target.value)?.programme_id || '' })}><option value="">Select examination</option>{examinations.filter((e) => e.status === 'published').map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}</select></label>}{quoteForm.productType === 'certificate' && <><label className={labelClass}>Programme<select className={`${inputClass} mt-2`} value={quoteForm.programmeId} onChange={(e) => setQuoteForm({ ...quoteForm, programmeId: e.target.value })}><option value="">Select programme</option>{programmes.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}</select></label><label className={labelClass}>Certificate<select className={`${inputClass} mt-2`} value={quoteForm.certificateProductCode} onChange={(e) => setQuoteForm({ ...quoteForm, certificateProductCode: e.target.value })}><option value="achievement">Certificate of Achievement</option><option value="professional">Professional Certificate</option></select></label></>}<label className={labelClass}>Description<input className={`${inputClass} mt-2`} value={quoteForm.description} onChange={(e) => setQuoteForm({ ...quoteForm, description: e.target.value })} /></label><label className={labelClass}>Quantity<input type="number" min="1" className={`${inputClass} mt-2`} value={quoteForm.quantity} onChange={(e) => setQuoteForm({ ...quoteForm, quantity: e.target.value })} /></label><label className={labelClass}>Unit amount<input type="number" min="0" step="0.01" className={`${inputClass} mt-2`} value={quoteForm.unitAmount} onChange={(e) => setQuoteForm({ ...quoteForm, unitAmount: e.target.value })} /></label><label className={labelClass}>Discount %<input type="number" min="0" max="100" step="0.01" className={`${inputClass} mt-2`} value={quoteForm.discountPercent} onChange={(e) => setQuoteForm({ ...quoteForm, discountPercent: e.target.value })} /></label><label className={labelClass}>Tax %<input type="number" min="0" max="100" step="0.01" className={`${inputClass} mt-2`} value={quoteForm.taxRatePercent} onChange={(e) => setQuoteForm({ ...quoteForm, taxRatePercent: e.target.value })} /></label></div><button type="button" onClick={addQuoteLine} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-black"><Plus className="h-4 w-4" />Add line</button><div className="mt-3 space-y-2">{quoteItems.map((item, index) => <div key={`${item.description}-${index}`} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 text-sm"><span><strong>{item.description}</strong> · {item.quantity} × {formatMoney(item.unitAmountMinor, quoteForm.currency)}</span><button type="button" onClick={() => setQuoteItems((items) => items.filter((_, itemIndex) => itemIndex !== index))} className="text-rose-600"><X className="h-4 w-4" /></button></div>)}</div></div><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className={labelClass}>Notes<textarea className={`${inputClass} mt-2 min-h-20`} value={quoteForm.notes} onChange={(e) => setQuoteForm({ ...quoteForm, notes: e.target.value })} /></label><label className={labelClass}>Terms<textarea className={`${inputClass} mt-2 min-h-20`} value={quoteForm.terms} onChange={(e) => setQuoteForm({ ...quoteForm, terms: e.target.value })} /></label></div><button disabled={Boolean(busy)} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:opacity-50">{busy === 'create-quote' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileInput className="h-4 w-4" />}Create quotation</button></form>
            <section className="grid gap-4 lg:grid-cols-2">{consoleData.quotes.map((quote) => <article key={quote.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><div><p className="font-mono text-xs font-black text-cyan-700">{quote.quoteNumber}</p><h3 className="mt-1 text-lg font-black">{quote.customerName}</h3><p className="mt-1 text-sm text-slate-500">{formatMoney(quote.totalAmountMinor, quote.currency)} · valid to {formatDate(quote.validUntil)}</p></div><span className={`rounded-full border px-3 py-1 text-xs font-black capitalize ${statusClass[quote.status] || statusClass.draft}`}>{quote.status}</span></div><div className="mt-4 flex flex-wrap gap-2">{quote.status === 'draft' && <button onClick={() => handleQuoteAction(quote, 'issue')} className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-black text-white">Issue</button>}{quote.status === 'issued' && <><button onClick={() => handleQuoteAction(quote, 'accept')} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-black text-white">Accept</button><button onClick={() => handleQuoteAction(quote, 'reject')} className="rounded-lg border border-rose-300 px-3 py-2 text-xs font-black text-rose-700">Reject</button></>}{quote.status === 'accepted' && <button onClick={() => handleQuoteAction(quote, 'invoice')} className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-black text-white">Convert to invoice</button>}<button onClick={() => download('quote', quote.id)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-black"><Download className="mr-1 inline h-3.5 w-3.5" />PDF</button></div></article>)}</section>
          </div>
        )}

        {tab === 'invoices' && <section className="grid gap-4 lg:grid-cols-2">{consoleData.invoices.map((invoice) => <article key={invoice.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><div><p className="font-mono text-xs font-black text-cyan-700">{invoice.invoiceNumber}</p><h3 className="mt-1 text-lg font-black">{invoice.customerName}</h3><p className="mt-1 text-sm text-slate-500">{formatMoney(invoice.totalAmountMinor, invoice.currency)} · balance {formatMoney(invoice.balanceAmountMinor, invoice.currency)}</p></div><span className={`rounded-full border px-3 py-1 text-xs font-black capitalize ${statusClass[invoice.status] || statusClass.draft}`}>{String(invoice.status).replaceAll('_', ' ')}</span></div><p className="mt-3 text-xs text-slate-500">Due {formatDate(invoice.dueDate)} {invoice.accessAuthorizedAt ? `· sponsored access authorised ${formatDate(invoice.accessAuthorizedAt)}` : ''}</p><div className="mt-4 flex flex-wrap gap-2"><button onClick={() => download('invoice', invoice.id)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-black"><Download className="mr-1 inline h-3.5 w-3.5" />PDF</button>{invoice.status !== 'paid' && !invoice.accessAuthorizedAt && <button onClick={() => authorizeInvoice(invoice)} className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-black text-white"><ShieldCheck className="mr-1 inline h-3.5 w-3.5" />Authorise credit access</button>}<button onClick={() => addCredit(invoice)} className="rounded-lg border border-cyan-300 px-3 py-2 text-xs font-black text-cyan-800">Credit note</button></div><div className="mt-4 space-y-2">{(invoice.items || []).filter((item: FinanceRecord) => ['examination', 'certificate'].includes(item.productType)).map((item: FinanceRecord) => <div key={item.id} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-sm"><span>{item.description} · {item.quantity} seat(s)</span>{!consoleData.seatPools.some((pool) => pool.invoiceItemId === item.id) && <button onClick={() => addPool(invoice, item)} className="rounded-lg bg-slate-950 px-3 py-1.5 text-xs font-black text-white">Create pool</button>}</div>)}</div></article>)}</section>}

        {tab === 'payments' && <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]"><form onSubmit={submitPayment} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-black">Record institutional payment</h2><div className="mt-5 space-y-4"><label className={labelClass}>Customer<select className={`${inputClass} mt-2`} value={paymentForm.customerId} onChange={(e) => setPaymentForm({ ...paymentForm, customerId: e.target.value })} required><option value="">Select customer</option>{consoleData.customers.map((c) => <option key={c.id} value={c.id}>{c.legalName}</option>)}</select></label><div className="grid gap-4 sm:grid-cols-2"><label className={labelClass}>Provider<select className={`${inputClass} mt-2`} value={paymentForm.provider} onChange={(e) => setPaymentForm({ ...paymentForm, provider: e.target.value })}><option value="bank_transfer">Bank transfer</option><option value="paystack">Paystack</option><option value="card">Card</option><option value="cash">Cash</option><option value="other">Other</option></select></label><label className={labelClass}>Currency<input className={`${inputClass} mt-2`} maxLength={3} value={paymentForm.currency} onChange={(e) => setPaymentForm({ ...paymentForm, currency: e.target.value.toUpperCase() })} /></label><label className={labelClass}>Amount<input type="number" min="0.01" step="0.01" className={`${inputClass} mt-2`} value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} required /></label><label className={labelClass}>Payment date<input type="date" className={`${inputClass} mt-2`} value={paymentForm.paymentDate} onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })} /></label></div><label className={labelClass}>External reference<input className={`${inputClass} mt-2`} value={paymentForm.externalReference} onChange={(e) => setPaymentForm({ ...paymentForm, externalReference: e.target.value })} required /></label><label className={labelClass}>Evidence object path<input className={`${inputClass} mt-2`} value={paymentForm.evidenceObjectPath} onChange={(e) => setPaymentForm({ ...paymentForm, evidenceObjectPath: e.target.value })} placeholder="agilecert-finance-evidence/..." /></label></div><button disabled={Boolean(busy)} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white">{busy === 'record-payment' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4" />}Record payment</button></form><section className="space-y-4">{consoleData.payments.map((payment) => <article key={payment.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><div><p className="font-mono text-xs font-black text-cyan-700">{payment.paymentReference}</p><h3 className="mt-1 text-lg font-black">{payment.customerName}</h3><p className="mt-1 text-sm text-slate-500">{formatMoney(payment.amountMinor, payment.currency)} · {payment.provider}</p></div><span className={`rounded-full border px-3 py-1 text-xs font-black capitalize ${statusClass[payment.status] || statusClass.draft}`}>{String(payment.status).replaceAll('_', ' ')}</span></div><div className="mt-4 flex flex-wrap gap-2">{['submitted', 'under_review'].includes(payment.status) && <><button onClick={() => confirmPayment(payment)} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-black text-white">Confirm & allocate</button><button onClick={() => { const note = window.prompt('Rejection reason'); if (note) void runAction(`reject-payment-${payment.id}`, () => reviewInstitutionPayment({ paymentId: payment.id, decision: 'rejected', reviewNote: note }), 'Payment rejected.'); }} className="rounded-lg border border-rose-300 px-3 py-2 text-xs font-black text-rose-700">Reject</button></>}{payment.status === 'confirmed' && <button onClick={() => institutionRefund(payment)} className="rounded-lg border border-amber-300 px-3 py-2 text-xs font-black text-amber-800">Request refund</button>}</div></article>)}<h3 className="pt-3 font-black">Receipts</h3>{consoleData.receipts.map((receipt) => <div key={receipt.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4"><div><p className="font-mono text-xs font-black">{receipt.receiptNumber}</p><p className="text-sm text-slate-500">{formatMoney(receipt.amountMinor, receipt.currency)} · {formatDate(receipt.issuedAt)}</p></div><button onClick={() => download('receipt', receipt.id)} className="rounded-lg border border-slate-300 p-2"><Download className="h-4 w-4" /></button></div>)}</section></div>}

        {tab === 'sponsorship' && <div className="grid gap-4 lg:grid-cols-2">{consoleData.seatPools.map((pool) => <article key={pool.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><div><p className="font-mono text-xs font-black text-emerald-700">{pool.poolCode}</p><h3 className="mt-1 text-lg font-black">{pool.customerName}</h3><p className="mt-1 text-sm text-slate-500 capitalize">{pool.productType} sponsorship</p></div><span className={`rounded-full border px-3 py-1 text-xs font-black capitalize ${statusClass[pool.status] || statusClass.draft}`}>{pool.status}</span></div><div className="mt-4 grid grid-cols-4 gap-2 text-center"><div className="rounded-xl bg-slate-50 p-2"><p className="text-xl font-black">{pool.purchasedSeats}</p><p className="text-[9px] uppercase text-slate-400">Purchased</p></div><div className="rounded-xl bg-slate-50 p-2"><p className="text-xl font-black">{pool.allocatedSeats}</p><p className="text-[9px] uppercase text-slate-400">Allocated</p></div><div className="rounded-xl bg-slate-50 p-2"><p className="text-xl font-black">{pool.consumedSeats}</p><p className="text-[9px] uppercase text-slate-400">Consumed</p></div><div className="rounded-xl bg-slate-50 p-2"><p className="text-xl font-black">{pool.availableSeats}</p><p className="text-[9px] uppercase text-slate-400">Available</p></div></div><button disabled={pool.availableSeats < 1 || !['active', 'draft'].includes(pool.status)} onClick={() => nominate(pool)} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-black text-white disabled:opacity-40"><TicketCheck className="h-4 w-4" />Nominate candidate</button></article>)}</div>}

        {tab === 'refunds' && <div className="space-y-4">{consoleData.refunds.map((refund) => <article key={refund.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><div><p className="font-mono text-xs font-black text-cyan-700">{refund.refundNumber}</p><h3 className="mt-1 text-lg font-black">{formatMoney(refund.requestedAmountMinor, refund.currency)}</h3><p className="mt-1 text-sm text-slate-500">{refund.sourceType} · requested {formatDate(refund.requestedAt)}</p></div><span className={`rounded-full border px-3 py-1 text-xs font-black capitalize ${statusClass[refund.status] || statusClass.draft}`}>{String(refund.status).replaceAll('_', ' ')}</span></div><p className="mt-3 text-sm text-slate-600">{refund.reason}</p><div className="mt-4 flex flex-wrap gap-2">{['requested', 'under_review'].includes(refund.status) && <><button onClick={() => handleRefund(refund, 'approve')} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-black text-white">Approve</button><button onClick={() => handleRefund(refund, 'reject')} className="rounded-lg border border-rose-300 px-3 py-2 text-xs font-black text-rose-700">Reject</button></>}{['approved', 'processing'].includes(refund.status) && <><button onClick={() => handleRefund(refund, 'paid')} className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-black text-white">Mark paid</button><button onClick={() => handleRefund(refund, 'failed')} className="rounded-lg border border-rose-300 px-3 py-2 text-xs font-black text-rose-700">Mark failed</button></>}</div></article>)}<h3 className="pt-4 text-lg font-black">Credit notes</h3><div className="grid gap-3 md:grid-cols-2">{consoleData.creditNotes.map((note) => <div key={note.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4"><div><p className="font-mono text-xs font-black">{note.creditNoteNumber}</p><p className="mt-1 text-sm">{formatMoney(note.amountMinor, note.currency)} · {note.status}</p></div><button onClick={() => download('credit_note', note.id)} className="rounded-lg border border-slate-300 p-2"><Download className="h-4 w-4" /></button></div>)}</div></div>}

        {tab === 'reconciliation' && <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]"><form onSubmit={submitReconciliation} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-black">Process reconciliation batch</h2><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className={labelClass}>Provider<input className={`${inputClass} mt-2`} value={reconciliationForm.provider} onChange={(e) => setReconciliationForm({ ...reconciliationForm, provider: e.target.value })} required /></label><label className={labelClass}>Currency<input className={`${inputClass} mt-2`} value={reconciliationForm.currency} onChange={(e) => setReconciliationForm({ ...reconciliationForm, currency: e.target.value.toUpperCase() })} /></label><label className={labelClass}>From<input type="date" className={`${inputClass} mt-2`} value={reconciliationForm.statementFrom} onChange={(e) => setReconciliationForm({ ...reconciliationForm, statementFrom: e.target.value })} /></label><label className={labelClass}>To<input type="date" className={`${inputClass} mt-2`} value={reconciliationForm.statementTo} onChange={(e) => setReconciliationForm({ ...reconciliationForm, statementTo: e.target.value })} /></label></div><label className={`${labelClass} mt-4`}>Source filename<input className={`${inputClass} mt-2`} value={reconciliationForm.sourceFileName} onChange={(e) => setReconciliationForm({ ...reconciliationForm, sourceFileName: e.target.value })} /></label><label className={`${labelClass} mt-4`}>Statement lines JSON<textarea className={`${inputClass} mt-2 min-h-64 font-mono text-xs`} value={reconciliationForm.linesJson} onChange={(e) => setReconciliationForm({ ...reconciliationForm, linesJson: e.target.value })} required /></label><button disabled={Boolean(busy)} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white">{busy === 'reconcile' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}Process reconciliation</button></form><section className="space-y-4">{consoleData.reconciliationBatches.map((batch) => <article key={batch.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><div><p className="font-mono text-xs font-black text-cyan-700">{batch.batchReference}</p><h3 className="mt-1 text-lg font-black capitalize">{batch.provider}</h3><p className="mt-1 text-sm text-slate-500">{batch.matchedLines} matched · {batch.exceptionLines} exception(s)</p></div><span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass[batch.status] || statusClass.draft}`}>{batch.status}</span></div><div className="mt-4 space-y-2">{(batch.lines || []).map((line: FinanceRecord) => <div key={line.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 text-xs"><div><p className="font-mono font-black">{line.externalReference}</p><p className="mt-1 text-slate-500">{formatMoney(line.amountMinor, line.currency)} {line.varianceAmountMinor ? `· variance ${formatMoney(line.varianceAmountMinor, line.currency)}` : ''}</p></div><div className="flex items-center gap-2"><span className={`rounded-full border px-2.5 py-1 font-black ${statusClass[line.status] || statusClass.draft}`}>{String(line.status).replaceAll('_', ' ')}</span>{['unmatched', 'duplicate', 'short_payment', 'overpayment'].includes(line.status) && <button onClick={() => { const note = window.prompt('Resolution note'); if (note) void runAction(`resolve-${line.id}`, () => resolveReconciliationLine({ lineId: line.id, status: 'resolved', resolutionNote: note }), 'Reconciliation exception resolved.'); }} className="rounded-lg border border-slate-300 px-2 py-1 font-black">Resolve</button>}</div></div>)}</div></article>)}</section></div>}

        {tab === 'settings' && <div className="grid gap-6 lg:grid-cols-2"><section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-black">Finance policy</h2><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs font-black uppercase text-slate-400">Default currency</dt><dd className="mt-1 font-black">{settingsForm.defaultCurrency}</dd></div><div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs font-black uppercase text-slate-400">Quote validity</dt><dd className="mt-1 font-black">{settingsForm.quoteValidityDays} days</dd></div><div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs font-black uppercase text-slate-400">Invoice terms</dt><dd className="mt-1 font-black">{settingsForm.invoicePaymentTermsDays} days</dd></div><div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs font-black uppercase text-slate-400">Max discount</dt><dd className="mt-1 font-black">{settingsForm.maximumInstitutionalDiscountPercent}%</dd></div><div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs font-black uppercase text-slate-400">Refund approval threshold</dt><dd className="mt-1 font-black">{formatMoney(settingsForm.refundSuperAdminThresholdMinor, settingsForm.defaultCurrency)}</dd></div><div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs font-black uppercase text-slate-400">Partial payments</dt><dd className="mt-1 font-black">{settingsForm.allowPartialPayments ? 'Allowed' : 'Not allowed'}</dd></div></dl><button onClick={() => { const currency = window.prompt('Default currency', settingsForm.defaultCurrency); const validity = Number(window.prompt('Quote validity days', String(settingsForm.quoteValidityDays))); const terms = Number(window.prompt('Invoice payment terms days', String(settingsForm.invoicePaymentTermsDays))); const maxDiscount = Number(window.prompt('Maximum institutional discount percent', String(settingsForm.maximumInstitutionalDiscountPercent))); const refundThreshold = Number(window.prompt(`Refund Super Admin threshold in ${currency || settingsForm.defaultCurrency}`, String(settingsForm.refundSuperAdminThresholdMinor / 100))); if (currency) void runAction('save-settings', () => saveFinanceSettings({ ...settingsForm, defaultCurrency: currency.toUpperCase(), quoteValidityDays: validity, invoicePaymentTermsDays: terms, maximumInstitutionalDiscountPercent: maxDiscount, refundSuperAdminThresholdMinor: Math.round(refundThreshold * 100) }), 'Finance policy updated.'); }} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-black text-white"><Settings2 className="h-4 w-4" />Edit policy</button></section><section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><h2 className="text-lg font-black">Tax profiles</h2><button onClick={() => { const code = window.prompt('Tax profile code'); const name = window.prompt('Tax profile name'); const rate = Number(window.prompt('Tax rate percent', '0')); if (code && name) void runAction('save-tax', () => saveTaxProfile({ code, name, ratePercent: rate, isActive: true, isDefault: false }), 'Tax profile saved.'); }} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-black"><Plus className="mr-1 inline h-3.5 w-3.5" />Add</button></div><div className="mt-4 space-y-3">{consoleData.taxProfiles.map((profile) => <div key={profile.id} className="flex items-center justify-between rounded-xl bg-slate-50 p-4"><div><p className="font-black">{profile.name}</p><p className="text-xs text-slate-500">{profile.code} · {profile.ratePercent}%</p></div>{profile.isDefault && <span className="rounded-full bg-cyan-100 px-2.5 py-1 text-[10px] font-black text-cyan-800">DEFAULT</span>}</div>)}</div></section></div>}
      </main>
    </div>
  );
}

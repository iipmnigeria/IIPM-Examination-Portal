import { type FormEvent, useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import {
  BadgePercent,
  Banknote,
  BarChart3,
  Download,
  Gift,
  Loader2,
  RefreshCw,
  Save,
  Search,
  Settings,
  Undo2,
  WalletCards,
} from 'lucide-react';
import type { AdminCoupon } from '../services/adminCommerceService';
import type { FinanceConsoleSnapshot } from '../services/financeConsoleService';
import {
  getFinanceReceipt,
  processAbandonedOrders,
  queueRecoveryAction,
  recordFinanceExport,
  recoverPaidAccess,
  saveAdvancedCoupon,
  saveAdvancedExamPricing,
  saveExamAccessGrant,
  saveGeneralFinanceSettings,
  setAdvancedCouponActive,
  verifyFinancePayment,
  type FinanceAccessMode,
  type FinanceCompletionSnapshot,
  type FinanceExamPricingPolicy,
  type FinanceGeneralSettings,
  type FinanceUnifiedTransaction,
} from '../services/financeConsoleCompletionService';

export type FinanceCompletionView =
  | 'overview'
  | 'pricing'
  | 'coupons'
  | 'settings'
  | 'transactions'
  | 'dashboard';

type Props = {
  view: FinanceCompletionView;
  core: FinanceConsoleSnapshot;
  completion: FinanceCompletionSnapshot;
  onRefresh: () => Promise<void>;
  onMessage: (message: string) => void;
  onError: (message: string) => void;
};

const currencyDigits = (currency: string): number => {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency })
      .resolvedOptions().maximumFractionDigits;
  } catch {
    return 2;
  }
};

const formatMoney = (amountMinor: number, currency: string): string => {
  const divisor = 10 ** currencyDigits(currency);
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: currencyDigits(currency),
    }).format(Number(amountMinor || 0) / divisor);
  } catch {
    return `${currency} ${(Number(amountMinor || 0) / divisor).toLocaleString()}`;
  }
};

const majorToMinor = (value: string, currency: string): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 10 ** currencyDigits(currency)) : 0;
};

const minorToMajor = (value: number | null | undefined, currency: string): string => {
  if (value === null || value === undefined) return '';
  return String(Number(value) / 10 ** currencyDigits(currency));
};

const toDateTimeLocal = (value?: string | null): string => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
};

const downloadText = (filename: string, content: string, type = 'text/csv;charset=utf-8') => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

const escapeCsv = (value: unknown): string => {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replaceAll('"', '""')}"`;
};

const accessModeLabel = (mode: FinanceAccessMode): string => {
  if (mode === 'invitation_only') return 'Invitation only';
  return mode.charAt(0).toUpperCase() + mode.slice(1);
};

const statusTone = (status: string): string => {
  if (['paid', 'success', 'fulfilled', 'waived', 'succeeded'].includes(status)) {
    return 'bg-emerald-100 text-emerald-800';
  }
  if (['failed', 'cancelled', 'expired', 'refunded'].includes(status)) {
    return 'bg-rose-100 text-rose-800';
  }
  return 'bg-amber-100 text-amber-800';
};

const blankPricing = {
  examinationId: '',
  currency: 'NGN',
  standardAmount: '25000',
  promotionalAmount: '',
  promotionName: '',
  promotionStartsAt: '',
  promotionEndsAt: '',
  accessMode: 'paid' as FinanceAccessMode,
  attemptsIncluded: '1',
  retakeAmount: '',
  bulkCartEligible: true,
  isActive: true,
  changeReason: 'Approved advanced examination pricing configuration',
};

const blankGrant = {
  grantId: '',
  candidateId: '',
  examinationId: '',
  accessMode: 'scholarship' as 'scholarship' | 'invitation_only',
  grantCode: '',
  validFrom: '',
  validTo: '',
  status: 'active' as 'active' | 'used' | 'revoked' | 'expired',
  reason: 'Approved scholarship or invitation access',
};

const blankCoupon = {
  couponId: '',
  code: '',
  name: '',
  description: '',
  discountType: 'percentage' as 'percentage' | 'fixed',
  discountValue: '10',
  currency: '',
  programmeIds: [] as string[],
  examinationIds: [] as string[],
  minimumAmount: '0',
  minimumModuleCount: '1',
  allowMultiModuleCart: true,
  maximumDiscount: '',
  startsAt: '',
  expiresAt: '',
  maximumRedemptions: '',
  perCandidateLimit: '1',
  isActive: true,
  changeReason: 'Approved coupon configuration update',
};

export default function FinanceConsoleCompletionPanel({
  view,
  core,
  completion,
  onRefresh,
  onMessage,
  onError,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [pricing, setPricing] = useState({
    ...blankPricing,
    examinationId: core.examinations[0]?.id || '',
  });
  const [grant, setGrant] = useState({
    ...blankGrant,
    candidateId: completion.candidates[0]?.id || '',
    examinationId: core.examinations[0]?.id || '',
  });
  const [coupon, setCoupon] = useState(blankCoupon);
  const [settings, setSettings] = useState<FinanceGeneralSettings>(completion.settings);
  const [settingsReason, setSettingsReason] = useState('Approved general finance settings update');
  const [transactionSearch, setTransactionSearch] = useState('');
  const [transactionStatus, setTransactionStatus] = useState('all');

  const run = async (action: () => Promise<void>) => {
    try {
      setBusy(true);
      onError('');
      await action();
    } catch (error) {
      onError(error instanceof Error ? error.message : 'The Finance Console action failed.');
    } finally {
      setBusy(false);
    }
  };

  const editPricing = (policy: FinanceExamPricingPolicy) => {
    setPricing({
      examinationId: policy.examinationId,
      currency: policy.currency,
      standardAmount: minorToMajor(policy.standardAmountMinor, policy.currency),
      promotionalAmount: minorToMajor(policy.promotionalAmountMinor, policy.currency),
      promotionName: policy.promotionName || '',
      promotionStartsAt: toDateTimeLocal(policy.promotionStartsAt),
      promotionEndsAt: toDateTimeLocal(policy.promotionEndsAt),
      accessMode: policy.accessMode,
      attemptsIncluded: String(policy.attemptsIncluded),
      retakeAmount: minorToMajor(policy.retakeAmountMinor, policy.currency),
      bulkCartEligible: policy.bulkCartEligible,
      isActive: policy.isActive,
      changeReason: `Approved update to ${policy.currency} pricing for ${policy.examinationTitle}`,
    });
    onMessage(`${policy.examinationTitle} pricing loaded for editing.`);
  };

  const submitPricing = async (event: FormEvent) => {
    event.preventDefault();
    await run(async () => {
      const standard = majorToMinor(pricing.standardAmount, pricing.currency);
      const promotion = pricing.promotionalAmount
        ? majorToMinor(pricing.promotionalAmount, pricing.currency)
        : null;
      const retake = pricing.retakeAmount
        ? majorToMinor(pricing.retakeAmount, pricing.currency)
        : null;
      if (!pricing.examinationId || standard <= 0) throw new Error('Select an examination and enter a valid standard fee.');
      if (pricing.promotionalAmount && (!pricing.promotionStartsAt || !pricing.promotionEndsAt)) {
        throw new Error('Promotional pricing requires both a start and expiry date.');
      }
      await saveAdvancedExamPricing({
        examinationId: pricing.examinationId,
        currency: pricing.currency,
        standardAmountMinor: standard,
        promotionalAmountMinor: promotion,
        promotionName: pricing.promotionName,
        promotionStartsAt: pricing.promotionStartsAt ? new Date(pricing.promotionStartsAt).toISOString() : null,
        promotionEndsAt: pricing.promotionEndsAt ? new Date(pricing.promotionEndsAt).toISOString() : null,
        accessMode: pricing.accessMode,
        attemptsIncluded: Math.max(1, Number(pricing.attemptsIncluded) || 1),
        retakeAmountMinor: retake,
        bulkCartEligible: pricing.bulkCartEligible,
        isActive: pricing.isActive,
        changeReason: pricing.changeReason,
      });
      onMessage('Advanced examination pricing saved and audited.');
      await onRefresh();
    });
  };

  const submitGrant = async (event: FormEvent) => {
    event.preventDefault();
    await run(async () => {
      if (!grant.candidateId || !grant.examinationId) throw new Error('Select a candidate and examination.');
      await saveExamAccessGrant({
        grantId: grant.grantId || null,
        candidateId: grant.candidateId,
        examinationId: grant.examinationId,
        accessMode: grant.accessMode,
        grantCode: grant.grantCode || null,
        validFrom: grant.validFrom ? new Date(grant.validFrom).toISOString() : null,
        validTo: grant.validTo ? new Date(grant.validTo).toISOString() : null,
        status: grant.status,
        reason: grant.reason,
      });
      onMessage('Candidate access grant saved and audited.');
      setGrant({
        ...blankGrant,
        candidateId: completion.candidates[0]?.id || '',
        examinationId: core.examinations[0]?.id || '',
      });
      await onRefresh();
    });
  };

  const editCoupon = (item: AdminCoupon) => {
    const targets = completion.couponTargets.filter((target) => target.couponId === item.id && target.isActive);
    const policy = completion.couponPolicies.find((entry) => entry.couponId === item.id);
    setCoupon({
      couponId: item.id,
      code: item.code,
      name: item.name || '',
      description: item.description || '',
      discountType: item.discountType,
      discountValue: item.discountType === 'percentage'
        ? String(item.discountValue)
        : minorToMajor(item.discountValue, item.currency || 'NGN'),
      currency: item.currency || '',
      programmeIds: targets.filter((target) => target.targetType === 'programme').map((target) => target.programmeId || '').filter(Boolean),
      examinationIds: targets.filter((target) => target.targetType === 'examination').map((target) => target.examinationId || '').filter(Boolean),
      minimumAmount: minorToMajor(item.minimumAmountMinor, item.currency || 'NGN'),
      minimumModuleCount: String(policy?.minimumModuleCount || 1),
      allowMultiModuleCart: policy?.allowMultiModuleCart ?? true,
      maximumDiscount: minorToMajor(item.maximumDiscountMinor, item.currency || 'NGN'),
      startsAt: toDateTimeLocal(item.startsAt),
      expiresAt: toDateTimeLocal(item.expiresAt),
      maximumRedemptions: item.maximumRedemptions ? String(item.maximumRedemptions) : '',
      perCandidateLimit: String(item.perCandidateLimit || 1),
      isActive: item.isActive,
      changeReason: `Approved update to coupon ${item.code}`,
    });
    onMessage(`Coupon ${item.code} loaded for editing.`);
  };

  const submitCoupon = async (event: FormEvent) => {
    event.preventDefault();
    await run(async () => {
      const value = Number(coupon.discountValue);
      if (!coupon.code.trim() || !Number.isFinite(value) || value <= 0) throw new Error('Enter a coupon code and discount value.');
      if (coupon.discountType === 'fixed' && !coupon.currency) throw new Error('Fixed discounts require a currency.');
      const moneyCurrency = coupon.currency || completion.settings.defaultCurrency || 'NGN';
      await saveAdvancedCoupon({
        couponId: coupon.couponId || null,
        code: coupon.code,
        name: coupon.name,
        description: coupon.description,
        discountType: coupon.discountType,
        discountValue: coupon.discountType === 'percentage' ? value : majorToMinor(coupon.discountValue, moneyCurrency),
        currency: coupon.currency || null,
        programmeIds: coupon.programmeIds,
        examinationIds: coupon.examinationIds,
        minimumAmountMinor: majorToMinor(coupon.minimumAmount || '0', moneyCurrency),
        minimumModuleCount: Math.max(1, Number(coupon.minimumModuleCount) || 1),
        allowMultiModuleCart: coupon.allowMultiModuleCart,
        maximumDiscountMinor: coupon.maximumDiscount ? majorToMinor(coupon.maximumDiscount, moneyCurrency) : null,
        startsAt: coupon.startsAt ? new Date(coupon.startsAt).toISOString() : null,
        expiresAt: coupon.expiresAt ? new Date(coupon.expiresAt).toISOString() : null,
        maximumRedemptions: coupon.maximumRedemptions ? Number(coupon.maximumRedemptions) : null,
        perCandidateLimit: Math.max(1, Number(coupon.perCandidateLimit) || 1),
        isActive: coupon.isActive,
        changeReason: coupon.changeReason,
      });
      onMessage('Advanced coupon configuration saved and audited.');
      setCoupon(blankCoupon);
      await onRefresh();
    });
  };

  const toggleCoupon = async (item: AdminCoupon) => {
    const reason = window.prompt(
      `Reason for ${item.isActive ? 'deactivating' : 'activating'} ${item.code}:`,
      item.isActive ? 'Approved coupon deactivation' : 'Approved coupon activation',
    )?.trim();
    if (!reason) return;
    await run(async () => {
      await setAdvancedCouponActive({ couponId: item.id, isActive: !item.isActive, changeReason: reason });
      onMessage(`${item.code} ${item.isActive ? 'deactivated' : 'activated'} and audited.`);
      await onRefresh();
    });
  };

  const submitSettings = async (event: FormEvent) => {
    event.preventDefault();
    await run(async () => {
      if (!settings.defaultCurrency || settings.supportedCurrencies.length === 0) {
        throw new Error('Configure a default currency and at least one supported currency.');
      }
      await saveGeneralFinanceSettings(settings, settingsReason);
      onMessage('General finance settings saved and audited.');
      await onRefresh();
    });
  };

  const filteredTransactions = useMemo(() => {
    const query = transactionSearch.trim().toLowerCase();
    return completion.transactions.filter((transaction) => {
      const matchesStatus = transactionStatus === 'all'
        || transaction.orderStatus === transactionStatus
        || transaction.paymentStatus === transactionStatus
        || transaction.provisioningStatus === transactionStatus;
      const matchesQuery = !query || [
        transaction.reference,
        transaction.candidateName,
        transaction.candidateEmail,
        transaction.programmeCode,
        transaction.examinationTitle,
        transaction.couponCode || '',
      ].some((value) => value.toLowerCase().includes(query));
      return matchesStatus && matchesQuery;
    });
  }, [completion.transactions, transactionSearch, transactionStatus]);

  const verifyTransaction = async (transaction: FinanceUnifiedTransaction) => {
    if (!window.confirm(`Verify ${transaction.reference} directly with Paystack and process the authoritative fulfilment result?`)) return;
    await run(async () => {
      await queueRecoveryAction({
        orderType: transaction.orderType,
        orderId: transaction.orderId,
        action: 'manual_verification',
        reason: 'Administrator initiated controlled Paystack verification',
      });
      const result = await verifyFinancePayment(transaction.reference);
      onMessage(`Verification completed: ${String(result.status || 'processed')}.`);
      await onRefresh();
    });
  };

  const recoverTransaction = async (transaction: FinanceUnifiedTransaction) => {
    const reason = window.prompt(
      `Reason for retrying access fulfilment for ${transaction.reference}:`,
      'Verified payment exists but access requires idempotent recovery',
    )?.trim();
    if (!reason) return;
    if (!window.confirm('Retry authoritative access fulfilment? Existing successful access will not be duplicated.')) return;
    await run(async () => {
      await queueRecoveryAction({
        orderType: transaction.orderType,
        orderId: transaction.orderId,
        action: 'access_recovery',
        reason,
      });
      const result = await recoverPaidAccess({
        orderType: transaction.orderType,
        orderId: transaction.orderId,
        reason,
      });
      onMessage(`Access recovery completed: ${String(result.status || 'processed')}.`);
      await onRefresh();
    });
  };

  const receipt = async (transaction: FinanceUnifiedTransaction) => {
    await run(async () => {
      const payload = await getFinanceReceipt(transaction.orderType, transaction.orderId);
      const pdf = new jsPDF();
      pdf.setFontSize(18);
      pdf.text('IIPM Examination Payment Receipt', 20, 24);
      pdf.setFontSize(10);
      const rows = [
        ['Receipt Number', payload.receiptNumber],
        ['Reference', payload.reference],
        ['Candidate', payload.candidateName],
        ['Email', payload.candidateEmail],
        ['Programme', payload.programmeName || payload.programmeCode || 'Consolidated order'],
        ['Examination', payload.examinationTitle || `${payload.itemCount || 0} examination items`],
        ['Gross Amount', formatMoney(payload.grossAmountMinor, payload.currency)],
        ['Discount', formatMoney(payload.discountAmountMinor, payload.currency)],
        ['Amount Paid', formatMoney(payload.amountPaidMinor, payload.currency)],
        ['Status', payload.status],
        ['Paid At', payload.paidAt ? new Date(payload.paidAt).toLocaleString() : 'Waived / not applicable'],
        ['Issued At', new Date(payload.issuedAt).toLocaleString()],
      ];
      let y = 38;
      rows.forEach(([label, value]) => {
        pdf.setFont('helvetica', 'bold');
        pdf.text(`${label}:`, 20, y);
        pdf.setFont('helvetica', 'normal');
        pdf.text(String(value), 65, y);
        y += 8;
      });
      pdf.setFontSize(8);
      pdf.text('This receipt is generated from the immutable server-owned order record.', 20, y + 8);
      pdf.save(`${payload.receiptNumber}.pdf`);
      onMessage(`Receipt ${payload.receiptNumber} downloaded.`);
    });
  };

  const exportTransactions = async () => {
    await run(async () => {
      const headings = [
        'Order Type', 'Reference', 'Candidate', 'Email', 'Programme', 'Examination',
        'Items', 'Currency', 'Gross', 'Discount', 'Payable', 'Paid', 'Coupon',
        'Order Status', 'Payment Status', 'Provisioning Status', 'Paid At', 'Fulfilled At', 'Created At',
      ];
      const lines = filteredTransactions.map((item) => [
        item.orderType, item.reference, item.candidateName, item.candidateEmail,
        item.programmeCode, item.examinationTitle, item.itemCount, item.currency,
        item.grossAmountMinor, item.discountAmountMinor, item.payableAmountMinor,
        item.amountPaidMinor, item.couponCode || '', item.orderStatus,
        item.paymentStatus || '', item.provisioningStatus, item.paidAt || '',
        item.fulfilledAt || '', item.createdAt,
      ].map(escapeCsv).join(','));
      downloadText(`finance-transactions-${new Date().toISOString().slice(0, 10)}.csv`, [headings.map(escapeCsv).join(','), ...lines].join('\n'));
      await recordFinanceExport('transactions_csv', filteredTransactions.length, {
        search: transactionSearch,
        status: transactionStatus,
      });
      onMessage(`${filteredTransactions.length} transactions exported and recorded.`);
    });
  };

  const exportTransactionsExcel = async () => {
    await run(async () => {
      const headings = ['Reference','Candidate','Email','Programme','Examination','Items','Currency','Gross','Discount','Payable','Paid','Coupon','Order Status','Payment Status','Provisioning'];
      const body = filteredTransactions.map((item) => `<tr>${[
        item.reference,item.candidateName,item.candidateEmail,item.programmeCode,item.examinationTitle,item.itemCount,item.currency,
        item.grossAmountMinor,item.discountAmountMinor,item.payableAmountMinor,item.amountPaidMinor,item.couponCode || '',
        item.orderStatus,item.paymentStatus || '',item.provisioningStatus,
      ].map((value) => `<td>${String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')}</td>`).join('')}</tr>`).join('');
      const workbook = `<html><head><meta charset="utf-8"></head><body><table><thead><tr>${headings.map((heading) => `<th>${heading}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></body></html>`;
      downloadText(`finance-transactions-${new Date().toISOString().slice(0,10)}.xls`, workbook, 'application/vnd.ms-excel');
      await recordFinanceExport('transactions_excel', filteredTransactions.length, { search: transactionSearch, status: transactionStatus });
      onMessage(`${filteredTransactions.length} transactions exported for Excel and recorded.`);
    });
  };

  const exportDashboard = async () => {
    await run(async () => {
      const rows = completion.dashboard.revenueByCurrency.map((item) => [
        item.currency,
        item.grossAmountMinor,
        item.discountAmountMinor,
        item.paidAmountMinor,
        item.transactions,
      ]);
      downloadText(
        `finance-dashboard-${new Date().toISOString().slice(0, 10)}.csv`,
        [
          ['Currency', 'Gross Minor', 'Discount Minor', 'Paid Minor', 'Transactions'].map(escapeCsv).join(','),
          ...rows.map((row) => row.map(escapeCsv).join(',')),
        ].join('\n'),
      );
      await recordFinanceExport('dashboard_csv', rows.length, { from: completion.from, to: completion.to });
      onMessage('Dashboard report exported and recorded.');
    });
  };

  if (view === 'overview') {
    const revenue = completion.dashboard.revenueByCurrency;
    return (
      <div className="space-y-5">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ['Individual orders', completion.dashboard.individualOrders, WalletCards],
            ['Consolidated orders', completion.dashboard.bulkOrders, Banknote],
            ['Failed transactions', completion.dashboard.failedTransactions, Undo2],
            ['Paid but unfulfilled', completion.dashboard.unfulfilledOrders, RefreshCw],
          ].map(([label, value, Icon]) => (
            <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <Icon className="h-5 w-5 text-amber-600" />
              <p className="mt-3 text-3xl font-black text-slate-950">{Number(value)}</p>
              <p className="mt-1 text-xs font-bold text-slate-500">{String(label)}</p>
            </div>
          ))}
        </section>
        <section className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-black text-slate-950">Revenue by currency</h2>
            <div className="mt-4 space-y-3">
              {revenue.length ? revenue.map((item) => (
                <div key={item.currency} className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                  <div>
                    <p className="font-black">{item.currency}</p>
                    <p className="text-xs text-slate-500">{item.transactions} transactions · {formatMoney(item.discountAmountMinor, item.currency)} discounts</p>
                  </div>
                  <p className="font-black text-emerald-700">{formatMoney(item.paidAmountMinor, item.currency)}</p>
                </div>
              )) : <p className="text-sm text-slate-500">No revenue in the selected reporting period.</p>}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-black text-slate-950">Control posture</h2>
            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl bg-slate-50 p-3"><p className="text-slate-500">Paystack</p><p className="mt-1 font-black">{completion.settings.paystackEnabled ? `${completion.settings.paystackEnvironment} enabled` : 'Disabled'}</p></div>
              <div className="rounded-xl bg-slate-50 p-3"><p className="text-slate-500">Currencies</p><p className="mt-1 font-black">{completion.settings.supportedCurrencies?.join(', ') || 'Not configured'}</p></div>
              <div className="rounded-xl bg-slate-50 p-3"><p className="text-slate-500">Payment expiry</p><p className="mt-1 font-black">{completion.settings.paymentExpiryMinutes} minutes</p></div>
              <div className="rounded-xl bg-slate-50 p-3"><p className="text-slate-500">Tax</p><p className="mt-1 font-black">{completion.settings.taxEnabled ? completion.settings.taxLabel : 'Disabled'}</p></div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (view === 'pricing') {
    return (
      <div className="space-y-6">
        <div className="grid gap-6 xl:grid-cols-3">
          <form onSubmit={submitPricing} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div><h2 className="font-black text-slate-950">Advanced examination pricing</h2><p className="mt-1 text-xs leading-5 text-slate-500">Standard, promotional, retake and controlled-access rules remain server authoritative.</p></div>
            <label className="block text-xs font-bold text-slate-600">Examination
              <select value={pricing.examinationId} onChange={(event) => setPricing({ ...pricing, examinationId: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
                {core.examinations.map((exam) => <option key={exam.id} value={exam.id}>{exam.course} — {exam.title}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-3 gap-3">
              <label className="text-xs font-bold text-slate-600">Currency<input value={pricing.currency} maxLength={3} onChange={(event) => setPricing({ ...pricing, currency: event.target.value.toUpperCase() })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 uppercase" /></label>
              <label className="col-span-2 text-xs font-bold text-slate-600">Standard fee<input type="number" min="0.01" step="0.01" value={pricing.standardAmount} onChange={(event) => setPricing({ ...pricing, standardAmount: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5" /></label>
            </div>
            <label className="block text-xs font-bold text-slate-600">Access mode
              <select value={pricing.accessMode} onChange={(event) => setPricing({ ...pricing, accessMode: event.target.value as FinanceAccessMode, bulkCartEligible: event.target.value === 'paid' && pricing.bulkCartEligible })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
                <option value="paid">Paid</option><option value="free">Free</option><option value="scholarship">Scholarship</option><option value="invitation_only">Invitation only</option>
              </select>
            </label>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-black text-slate-700">Temporary promotion</p>
              <input value={pricing.promotionName} onChange={(event) => setPricing({ ...pricing, promotionName: event.target.value })} placeholder="Promotion name" className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              <input type="number" min="0.01" step="0.01" value={pricing.promotionalAmount} onChange={(event) => setPricing({ ...pricing, promotionalAmount: event.target.value })} placeholder="Promotional fee" className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              <div className="mt-2 grid grid-cols-2 gap-2"><input type="datetime-local" value={pricing.promotionStartsAt} onChange={(event) => setPricing({ ...pricing, promotionStartsAt: event.target.value })} className="rounded-lg border border-slate-200 px-2 py-2 text-xs" /><input type="datetime-local" value={pricing.promotionEndsAt} onChange={(event) => setPricing({ ...pricing, promotionEndsAt: event.target.value })} className="rounded-lg border border-slate-200 px-2 py-2 text-xs" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3"><label className="text-xs font-bold text-slate-600">Attempts included<input type="number" min="1" value={pricing.attemptsIncluded} onChange={(event) => setPricing({ ...pricing, attemptsIncluded: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5" /></label><label className="text-xs font-bold text-slate-600">Retake fee<input type="number" min="0.01" step="0.01" value={pricing.retakeAmount} onChange={(event) => setPricing({ ...pricing, retakeAmount: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5" /></label></div>
            <div className="flex flex-wrap gap-4 text-xs font-bold text-slate-600"><label className="flex items-center gap-2"><input type="checkbox" checked={pricing.bulkCartEligible} disabled={pricing.accessMode !== 'paid'} onChange={(event) => setPricing({ ...pricing, bulkCartEligible: event.target.checked })} /> Bulk-cart eligible</label><label className="flex items-center gap-2"><input type="checkbox" checked={pricing.isActive} onChange={(event) => setPricing({ ...pricing, isActive: event.target.checked })} /> Active</label></div>
            <label className="block text-xs font-bold text-slate-600">Change reason<textarea rows={2} value={pricing.changeReason} onChange={(event) => setPricing({ ...pricing, changeReason: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /></label>
            <button disabled={busy || !completion.access.canManageExamPrices} className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save pricing policy</button>
          </form>
          <section className="space-y-3 xl:col-span-2">
            {completion.pricingPolicies.map((policy) => (
              <button type="button" key={policy.id} onClick={() => editPricing(policy)} className="w-full rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm hover:border-amber-300">
                <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{policy.programmeCode} · {policy.currency}</p><h3 className="mt-1 font-black text-slate-950">{policy.examinationTitle}</h3><p className="mt-1 text-xs text-slate-500">{accessModeLabel(policy.accessMode)} · {policy.attemptsIncluded} attempt(s) · {policy.bulkCartEligible ? 'Cart eligible' : 'Individual checkout'}</p></div><div className="text-right"><p className="text-lg font-black">{formatMoney(policy.standardAmountMinor, policy.currency)}</p>{policy.promotionalAmountMinor ? <p className="text-xs font-bold text-emerald-700">Promo {formatMoney(policy.promotionalAmountMinor, policy.currency)}</p> : null}</div></div>
                {policy.retakeAmountMinor ? <p className="mt-3 text-xs font-bold text-violet-700">Retake fee: {formatMoney(policy.retakeAmountMinor, policy.currency)}</p> : null}
                {policy.promotionStartsAt && policy.promotionEndsAt ? <p className="mt-2 text-xs text-slate-500">{policy.promotionName || 'Promotion'}: {new Date(policy.promotionStartsAt).toLocaleString()} – {new Date(policy.promotionEndsAt).toLocaleString()}</p> : null}
              </button>
            ))}
          </section>
        </div>
        <div className="grid gap-6 xl:grid-cols-3">
          <form onSubmit={submitGrant} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div><h2 className="font-black">Scholarship and invitation access</h2><p className="mt-1 text-xs text-slate-500">A grant is required before a candidate can use a controlled-access examination.</p></div>
            <select value={grant.candidateId} onChange={(event) => setGrant({ ...grant, candidateId: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"><option value="">Select candidate</option>{completion.candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.fullName || candidate.email} — {candidate.email}</option>)}</select>
            <select value={grant.examinationId} onChange={(event) => setGrant({ ...grant, examinationId: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm">{core.examinations.map((exam) => <option key={exam.id} value={exam.id}>{exam.course} — {exam.title}</option>)}</select>
            <select value={grant.accessMode} onChange={(event) => setGrant({ ...grant, accessMode: event.target.value as 'scholarship' | 'invitation_only' })} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"><option value="scholarship">Scholarship</option><option value="invitation_only">Invitation only</option></select>
            <input value={grant.grantCode} onChange={(event) => setGrant({ ...grant, grantCode: event.target.value.toUpperCase() })} placeholder="Optional grant or invitation code" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
            <div className="grid grid-cols-2 gap-2"><input type="datetime-local" value={grant.validFrom} onChange={(event) => setGrant({ ...grant, validFrom: event.target.value })} className="rounded-xl border border-slate-200 px-2 py-2 text-xs" /><input type="datetime-local" value={grant.validTo} onChange={(event) => setGrant({ ...grant, validTo: event.target.value })} className="rounded-xl border border-slate-200 px-2 py-2 text-xs" /></div>
            <textarea rows={2} value={grant.reason} onChange={(event) => setGrant({ ...grant, reason: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
            <button disabled={busy || !completion.access.canApproveAdjustments} className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white disabled:opacity-50"><Gift className="h-4 w-4" /> Save access grant</button>
          </form>
          <section className="space-y-3 xl:col-span-2">
            {completion.accessGrants.length ? completion.accessGrants.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="font-black">{item.candidateName || item.candidateEmail}</p><p className="text-xs text-slate-500">{item.examinationTitle} · {accessModeLabel(item.accessMode)}</p></div><span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${statusTone(item.status)}`}>{item.status}</span></div><p className="mt-2 text-xs text-slate-600">{item.reason}</p></div>
            )) : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">No scholarship or invitation grants recorded.</div>}
          </section>
        </div>
      </div>
    );
  }

  if (view === 'coupons') {
    return (
      <div className="grid gap-6 xl:grid-cols-3">
        <form onSubmit={submitCoupon} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div><h2 className="font-black">Advanced coupon administration</h2><p className="mt-1 text-xs text-slate-500">Multiple targets, cart thresholds, currency controls and audited reasons.</p></div>
          <input value={coupon.code} onChange={(event) => setCoupon({ ...coupon, code: event.target.value.toUpperCase() })} placeholder="Coupon code" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm uppercase" />
          <input value={coupon.name} onChange={(event) => setCoupon({ ...coupon, name: event.target.value })} placeholder="Name" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
          <textarea rows={2} value={coupon.description} onChange={(event) => setCoupon({ ...coupon, description: event.target.value })} placeholder="Description" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
          <div className="grid grid-cols-2 gap-2"><select value={coupon.discountType} onChange={(event) => setCoupon({ ...coupon, discountType: event.target.value as 'percentage' | 'fixed' })} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"><option value="percentage">Percentage</option><option value="fixed">Fixed amount</option></select><input type="number" min="0.01" step="0.01" value={coupon.discountValue} onChange={(event) => setCoupon({ ...coupon, discountValue: event.target.value })} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /></div>
          <input value={coupon.currency} onChange={(event) => setCoupon({ ...coupon, currency: event.target.value.toUpperCase() })} maxLength={3} placeholder="Currency; optional for percentage" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm uppercase" />
          <details className="rounded-xl border border-slate-200 p-3"><summary className="cursor-pointer text-xs font-black text-slate-700">Selected programmes ({coupon.programmeIds.length})</summary><div className="mt-3 max-h-40 space-y-2 overflow-y-auto">{core.programmes.map((programme) => <label key={programme.id} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={coupon.programmeIds.includes(programme.id)} onChange={(event) => setCoupon({ ...coupon, programmeIds: event.target.checked ? [...coupon.programmeIds, programme.id] : coupon.programmeIds.filter((id) => id !== programme.id) })} /> {programme.code} — {programme.name}</label>)}</div></details>
          <details className="rounded-xl border border-slate-200 p-3"><summary className="cursor-pointer text-xs font-black text-slate-700">Selected examinations ({coupon.examinationIds.length})</summary><div className="mt-3 max-h-48 space-y-2 overflow-y-auto">{core.examinations.map((exam) => <label key={exam.id} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={coupon.examinationIds.includes(exam.id)} onChange={(event) => setCoupon({ ...coupon, examinationIds: event.target.checked ? [...coupon.examinationIds, exam.id] : coupon.examinationIds.filter((id) => id !== exam.id) })} /> {exam.course} — {exam.title}</label>)}</div></details>
          <div className="grid grid-cols-2 gap-2"><input type="number" min="0" step="0.01" value={coupon.minimumAmount} onChange={(event) => setCoupon({ ...coupon, minimumAmount: event.target.value })} placeholder="Minimum cart value" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /><input type="number" min="1" value={coupon.minimumModuleCount} onChange={(event) => setCoupon({ ...coupon, minimumModuleCount: event.target.value })} placeholder="Minimum modules" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /></div>
          <input type="number" min="0" step="0.01" value={coupon.maximumDiscount} onChange={(event) => setCoupon({ ...coupon, maximumDiscount: event.target.value })} placeholder="Maximum discount cap" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
          <div className="grid grid-cols-2 gap-2"><input type="number" min="1" value={coupon.maximumRedemptions} onChange={(event) => setCoupon({ ...coupon, maximumRedemptions: event.target.value })} placeholder="Total usage limit" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /><input type="number" min="1" value={coupon.perCandidateLimit} onChange={(event) => setCoupon({ ...coupon, perCandidateLimit: event.target.value })} placeholder="Per candidate" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /></div>
          <div className="grid grid-cols-2 gap-2"><input type="datetime-local" value={coupon.startsAt} onChange={(event) => setCoupon({ ...coupon, startsAt: event.target.value })} className="rounded-xl border border-slate-200 px-2 py-2 text-xs" /><input type="datetime-local" value={coupon.expiresAt} onChange={(event) => setCoupon({ ...coupon, expiresAt: event.target.value })} className="rounded-xl border border-slate-200 px-2 py-2 text-xs" /></div>
          <div className="flex flex-wrap gap-4 text-xs font-bold"><label className="flex items-center gap-2"><input type="checkbox" checked={coupon.allowMultiModuleCart} onChange={(event) => setCoupon({ ...coupon, allowMultiModuleCart: event.target.checked })} /> Allow consolidated cart</label><label className="flex items-center gap-2"><input type="checkbox" checked={coupon.isActive} onChange={(event) => setCoupon({ ...coupon, isActive: event.target.checked })} /> Active</label></div>
          <textarea rows={2} value={coupon.changeReason} onChange={(event) => setCoupon({ ...coupon, changeReason: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
          <button disabled={busy || !completion.access.canManageCoupons} className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white disabled:opacity-50"><BadgePercent className="h-4 w-4" /> Save coupon</button>
        </form>
        <section className="space-y-4 xl:col-span-2">
          {core.coupons.map((item) => {
            const performance = completion.dashboard.couponPerformance.find((entry) => entry.couponCode === item.code.toUpperCase());
            const targets = completion.couponTargets.filter((target) => target.couponId === item.id);
            return <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-lg font-black">{item.code}</p><p className="text-xs text-slate-500">{item.name || item.description || 'Discount code'}</p></div><span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${item.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>{item.isActive ? 'Active' : 'Inactive'}</span></div><div className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4"><div className="rounded-xl bg-slate-50 p-3"><p className="text-slate-500">Discount</p><p className="mt-1 font-black">{item.discountType === 'percentage' ? `${item.discountValue}%` : formatMoney(item.discountValue, item.currency || 'NGN')}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-slate-500">Used</p><p className="mt-1 font-black">{performance?.redemptions ?? item.redeemedCount}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-slate-500">Remaining</p><p className="mt-1 font-black">{performance?.remainingRedemptions ?? 'Unlimited'}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-slate-500">Targets</p><p className="mt-1 font-black">{targets.length || 'All'}</p></div></div><div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => editCoupon(item)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-black">Edit</button><button type="button" onClick={() => void toggleCoupon(item)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-black">{item.isActive ? 'Deactivate' : 'Activate'}</button><details className="rounded-lg border border-slate-200 px-3 py-2 text-xs"><summary className="cursor-pointer font-black">Candidates who used it</summary><div className="mt-3 max-h-40 space-y-2 overflow-y-auto">{completion.couponUsage.filter((usage) => usage.couponId === item.id).map((usage) => <div key={usage.id}><p className="font-bold">{usage.candidateName || usage.candidateEmail}</p><p className="text-slate-500">{usage.orderReference} · {formatMoney(usage.discountAmountMinor, usage.currency)}</p></div>)}</div></details></div></div>;
          })}
        </section>
      </div>
    );
  }

  if (view === 'settings') {
    return (
      <form onSubmit={submitSettings} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2"><Settings className="h-5 w-5 text-violet-600" /><div><h2 className="font-black">General finance settings</h2><p className="text-xs text-slate-500">Only non-secret gateway status is visible. Paystack keys remain server-side.</p></div></div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label className="text-xs font-bold">Default currency<input value={settings.defaultCurrency || ''} maxLength={3} onChange={(event) => setSettings({ ...settings, defaultCurrency: event.target.value.toUpperCase() })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 uppercase" /></label>
          <label className="text-xs font-bold">Supported currencies<input value={(settings.supportedCurrencies || []).join(', ')} onChange={(event) => setSettings({ ...settings, supportedCurrencies: event.target.value.split(',').map((value) => value.trim().toUpperCase()).filter(Boolean) })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5" /></label>
          <label className="text-xs font-bold">Gateway environment<select value={settings.paystackEnvironment || 'production'} onChange={(event) => setSettings({ ...settings, paystackEnvironment: event.target.value as 'test' | 'production' })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"><option value="test">Test</option><option value="production">Production</option></select></label>
          <label className="text-xs font-bold">Receipt prefix<input value={settings.receiptPrefix || ''} onChange={(event) => setSettings({ ...settings, receiptPrefix: event.target.value.toUpperCase() })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5" /></label>
          <label className="text-xs font-bold">Payment reference prefix<input value={settings.paymentReferencePrefix || ''} onChange={(event) => setSettings({ ...settings, paymentReferencePrefix: event.target.value.toUpperCase() })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5" /></label>
          <label className="text-xs font-bold">Payment expiry minutes<input type="number" min="5" value={settings.paymentExpiryMinutes || 30} onChange={(event) => setSettings({ ...settings, paymentExpiryMinutes: Number(event.target.value) })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5" /></label>
          <label className="text-xs font-bold">Abandoned-order hours<input type="number" min="1" value={settings.abandonedOrderHours || 24} onChange={(event) => setSettings({ ...settings, abandonedOrderHours: Number(event.target.value) })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5" /></label>
          <label className="text-xs font-bold">Minimum transaction (minor)<input type="number" min="0" value={settings.minimumTransactionMinor || 0} onChange={(event) => setSettings({ ...settings, minimumTransactionMinor: Number(event.target.value) })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5" /></label>
          <label className="text-xs font-bold">Maximum transaction (minor)<input type="number" min="0" value={settings.maximumTransactionMinor || ''} onChange={(event) => setSettings({ ...settings, maximumTransactionMinor: event.target.value ? Number(event.target.value) : null })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5" /></label>
          <label className="text-xs font-bold">Tax label<input value={settings.taxLabel || 'VAT'} onChange={(event) => setSettings({ ...settings, taxLabel: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5" /></label>
          <label className="text-xs font-bold">Tax profile<select value={settings.defaultTaxProfileId || ''} onChange={(event) => setSettings({ ...settings, defaultTaxProfileId: event.target.value || null })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"><option value="">No tax profile</option>{completion.taxProfiles.map((tax) => <option key={tax.id} value={tax.id}>{tax.name} ({tax.ratePercent}%)</option>)}</select></label>
          <label className="text-xs font-bold">Gateway status note<input value={settings.paystackStatusNote || ''} onChange={(event) => setSettings({ ...settings, paystackStatusNote: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5" /></label>
        </div>
        <label className="block text-xs font-bold">Bank-transfer instructions<textarea rows={4} value={settings.bankTransferInstructions || ''} onChange={(event) => setSettings({ ...settings, bankTransferInstructions: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5" /></label>
        <div className="grid gap-3 text-xs font-bold sm:grid-cols-2 lg:grid-cols-4"><label className="flex items-center gap-2"><input type="checkbox" checked={settings.paystackEnabled || false} onChange={(event) => setSettings({ ...settings, paystackEnabled: event.target.checked })} /> Paystack enabled</label><label className="flex items-center gap-2"><input type="checkbox" checked={settings.taxEnabled || false} onChange={(event) => setSettings({ ...settings, taxEnabled: event.target.checked })} /> Tax enabled</label><label className="flex items-center gap-2"><input type="checkbox" checked={settings.refundsEnabled || false} onChange={(event) => setSettings({ ...settings, refundsEnabled: event.target.checked })} /> Refund controls</label><label className="flex items-center gap-2"><input type="checkbox" checked={settings.reversalsEnabled || false} onChange={(event) => setSettings({ ...settings, reversalsEnabled: event.target.checked })} /> Reversal controls</label><label className="flex items-center gap-2"><input type="checkbox" checked={settings.manualPaymentApprovalEnabled || false} onChange={(event) => setSettings({ ...settings, manualPaymentApprovalEnabled: event.target.checked })} /> Manual approval</label><label className="flex items-center gap-2"><input type="checkbox" checked={settings.allowPartialPayments || false} onChange={(event) => setSettings({ ...settings, allowPartialPayments: event.target.checked })} /> Partial payments</label><label className="flex items-center gap-2"><input type="checkbox" checked={settings.allowOverpayments || false} onChange={(event) => setSettings({ ...settings, allowOverpayments: event.target.checked })} /> Overpayments</label></div>
        <label className="block text-xs font-bold">Change reason<textarea rows={2} value={settingsReason} onChange={(event) => setSettingsReason(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5" /></label>
        <div className="flex flex-wrap gap-3"><button disabled={busy || !completion.access.canManageSettings} className="flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:opacity-50"><Save className="h-4 w-4" /> Save settings</button><button type="button" disabled={busy || !completion.access.canManageOrders} onClick={() => void run(async () => { await processAbandonedOrders(); onMessage('Abandoned-order rules processed.'); await onRefresh(); })} className="flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-3 text-sm font-black"><RefreshCw className="h-4 w-4" /> Process abandoned orders</button></div>
      </form>
    );
  }

  if (view === 'transactions') {
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={transactionSearch} onChange={(event) => setTransactionSearch(event.target.value)} placeholder="Search reference, candidate, programme, examination or coupon" className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm" /></div>
          <select value={transactionStatus} onChange={(event) => setTransactionStatus(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"><option value="all">All statuses</option><option value="pending">Pending</option><option value="paid">Paid</option><option value="success">Successful payment</option><option value="failed">Failed</option><option value="cancelled">Cancelled</option><option value="expired">Expired</option><option value="paid_unfulfilled">Paid but unfulfilled</option><option value="fulfilled">Fulfilled</option></select>
          <button type="button" disabled={!completion.access.canExportTransactions} onClick={() => void exportTransactions()} className="flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50"><Download className="h-4 w-4" /> CSV</button><button type="button" disabled={!completion.access.canExportTransactions} onClick={() => void exportTransactionsExcel()} className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-black disabled:opacity-50"><Download className="h-4 w-4" /> Excel</button>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm"><table className="min-w-[1250px] text-left text-xs"><thead className="bg-slate-950 text-white"><tr><th className="px-4 py-3">Reference</th><th className="px-4 py-3">Candidate</th><th className="px-4 py-3">Order</th><th className="px-4 py-3">Amounts</th><th className="px-4 py-3">Statuses</th><th className="px-4 py-3">Provisioning</th><th className="px-4 py-3">Actions</th></tr></thead><tbody>{filteredTransactions.map((item) => <tr key={`${item.orderType}-${item.orderId}`} className="border-t border-slate-100 align-top"><td className="px-4 py-3"><p className="font-black">{item.reference}</p><p className="text-slate-500">{item.orderType === 'bulk' ? `${item.itemCount} items` : 'Single examination'}</p></td><td className="px-4 py-3"><p className="font-bold">{item.candidateName}</p><p className="text-slate-500">{item.candidateEmail}</p></td><td className="max-w-xs px-4 py-3"><p className="font-bold">{item.programmeCode}</p><p className="text-slate-500">{item.examinationTitle}</p>{item.couponCode ? <p className="mt-1 font-bold text-violet-700">Coupon: {item.couponCode}</p> : null}{item.items && item.items.length > 1 ? <details className="mt-2"><summary className="cursor-pointer font-black text-blue-700">View {item.items.length} items</summary><div className="mt-2 space-y-1">{item.items.map((child, index) => <p key={String(child.itemId || child.examinationId || index)} className="text-[11px] text-slate-600">{String(child.examinationTitle || 'Examination')} · {String(child.status || '')}</p>)}</div></details> : null}</td><td className="px-4 py-3"><p>Gross: {formatMoney(item.grossAmountMinor, item.currency)}</p><p>Discount: {formatMoney(item.discountAmountMinor, item.currency)}</p><p className="font-black">Paid: {formatMoney(item.amountPaidMinor, item.currency)}</p></td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${statusTone(item.orderStatus)}`}>{item.orderStatus}</span><p className="mt-2 text-slate-500">Payment: {item.paymentStatus || '—'}</p></td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${statusTone(item.provisioningStatus)}`}>{item.provisioningStatus.replaceAll('_', ' ')}</span><p className="mt-2 text-slate-500">{item.fulfilledAt ? new Date(item.fulfilledAt).toLocaleString() : 'Not fulfilled'}</p></td><td className="px-4 py-3"><div className="flex max-w-48 flex-wrap gap-2">{completion.access.canReconcileTransactions && ['pending', 'failed', 'initiated'].includes(item.paymentStatus || item.orderStatus) ? <button type="button" onClick={() => void verifyTransaction(item)} className="rounded-lg border border-blue-200 bg-blue-50 px-2 py-1.5 font-black text-blue-700">Verify</button> : null}{completion.access.canRecoverAccess && item.provisioningStatus === 'paid_unfulfilled' ? <button type="button" onClick={() => void recoverTransaction(item)} className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 font-black text-amber-800">Recover</button> : null}{completion.access.canManageReceipts && ['paid', 'waived', 'fulfilled', 'partially_fulfilled'].includes(item.orderStatus) ? <button type="button" onClick={() => void receipt(item)} className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5 font-black text-emerald-700">Receipt</button> : null}</div></td></tr>)}</tbody></table></div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 text-xl font-black"><BarChart3 className="h-5 w-5 text-violet-600" /> Revenue dashboard</h2><p className="mt-1 text-xs text-slate-500">{completion.from ? new Date(completion.from).toLocaleDateString() : 'Start'} – {completion.to ? new Date(completion.to).toLocaleDateString() : 'Today'}</p></div><button type="button" disabled={!completion.access.canExportTransactions} onClick={() => void exportDashboard()} className="flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50"><Download className="h-4 w-4" /> Export dashboard</button></div>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{completion.dashboard.revenueByCurrency.map((item) => <div key={item.currency} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-black text-slate-500">{item.currency} NET REVENUE</p><p className="mt-2 text-2xl font-black text-emerald-700">{formatMoney(item.paidAmountMinor, item.currency)}</p><p className="mt-1 text-xs text-slate-500">Gross {formatMoney(item.grossAmountMinor, item.currency)} · Discounts {formatMoney(item.discountAmountMinor, item.currency)}</p></div>)}</section>
      <section className="grid gap-5 xl:grid-cols-2"><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-black">Revenue by programme</h3><div className="mt-4 space-y-2">{completion.dashboard.revenueByProgramme.map((item) => <div key={`${item.programmeCode}-${item.currency}`} className="flex items-center justify-between rounded-xl bg-slate-50 p-3"><div><p className="font-black">{item.programmeCode}</p><p className="text-xs text-slate-500">{item.orders} orders · {item.currency}</p></div><p className="font-black">{formatMoney(item.paidAmountMinor, item.currency)}</p></div>)}</div></div><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-black">Coupon performance</h3><div className="mt-4 space-y-2">{completion.dashboard.couponPerformance.map((item) => <div key={item.couponCode} className="flex items-center justify-between rounded-xl bg-slate-50 p-3"><div><p className="font-black">{item.couponCode}</p><p className="text-xs text-slate-500">{item.redemptions} uses · {item.remainingRedemptions ?? 'Unlimited'} remaining</p></div><p className="font-black text-violet-700">{item.discountAmountMinor.toLocaleString()} minor units</p></div>)}</div></div></section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-black">Top examinations</h3><div className="mt-4 overflow-x-auto"><table className="min-w-full text-left text-xs"><thead><tr className="border-b border-slate-200"><th className="px-3 py-2">Examination</th><th className="px-3 py-2">Programme</th><th className="px-3 py-2">Currency</th><th className="px-3 py-2">Orders</th><th className="px-3 py-2">Revenue</th><th className="px-3 py-2">Discounts</th></tr></thead><tbody>{completion.dashboard.revenueByExamination.map((item) => <tr key={`${item.examinationId}-${item.currency}`} className="border-b border-slate-100"><td className="px-3 py-2 font-bold">{item.examinationTitle}</td><td className="px-3 py-2">{item.programmeCode}</td><td className="px-3 py-2">{item.currency}</td><td className="px-3 py-2">{item.orders}</td><td className="px-3 py-2 font-black">{formatMoney(item.paidAmountMinor, item.currency)}</td><td className="px-3 py-2">{formatMoney(item.discountAmountMinor, item.currency)}</td></tr>)}</tbody></table></div></section>
    </div>
  );
}

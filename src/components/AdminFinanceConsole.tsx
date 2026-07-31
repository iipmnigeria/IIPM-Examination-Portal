import { type FormEvent, useEffect, useMemo, useState } from 'react';
import {
  BadgePercent,
  Banknote,
  BarChart3,
  CheckCircle2,
  CircleDollarSign,
  CreditCard,
  FileBadge2,
  History,
  KeyRound,
  Loader2,
  LockKeyhole,
  Pencil,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingCart,
  ToggleLeft,
  ToggleRight,
  X,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type {
  AdminCommerceExamination,
  AdminCoupon,
  AdminExamOrder,
  AdminExamPrice,
} from '../services/adminCommerceService';
import {
  cancelFinanceExamOrder,
  getFinanceConsoleSnapshot,
  getMyFinanceConsoleAccess,
  saveFinanceCoupon,
  saveFinanceExamPrice,
  setFinanceCouponActive,
  setFinanceExamPriceActive,
  setFinanceRolePermission,
  type FinanceConsoleAccess,
  type FinanceConsoleSnapshot,
  type FinancePermissionGrant,
} from '../services/financeConsoleService';
import FinanceCertificationFeesPanel from './FinanceCertificationFeesPanel';

type ConsoleTab = 'overview' | 'pricing' | 'certification' | 'coupons' | 'orders' | 'payments' | 'permissions';

type TabDefinition = {
  id: ConsoleTab;
  label: string;
  icon: LucideIcon;
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

const blankPriceForm = {
  examinationId: '',
  currency: 'NGN',
  amountMajor: '25000',
  countryCodes: 'NG',
  isDefault: true,
  isActive: true,
  effectiveFrom: '',
  effectiveTo: '',
  changeReason: 'Approved examination fee configuration',
};

const blankCouponForm = {
  couponId: '',
  code: '',
  name: '',
  description: '',
  discountType: 'percentage' as 'percentage' | 'fixed',
  discountValue: '10',
  currency: '',
  scope: 'all' as 'all' | 'programme' | 'examination',
  targetId: '',
  startsAt: '',
  expiresAt: '',
  maximumRedemptions: '',
  perCandidateLimit: '1',
  isActive: true,
};

const statusTone = (status: string) => {
  if (['paid', 'success', 'waived'].includes(status)) return 'bg-emerald-100 text-emerald-800';
  if (['failed', 'cancelled', 'expired', 'refunded'].includes(status)) return 'bg-rose-100 text-rose-800';
  return 'bg-amber-100 text-amber-800';
};

export default function AdminFinanceConsole() {
  const [access, setAccess] = useState<FinanceConsoleAccess | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ConsoleTab>('overview');
  const [snapshot, setSnapshot] = useState<FinanceConsoleSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [priceForm, setPriceForm] = useState(blankPriceForm);
  const [couponForm, setCouponForm] = useState(blankCouponForm);
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatus, setOrderStatus] = useState('all');
  const [permissionReason, setPermissionReason] = useState('Approved finance responsibility update');

  const refreshAuthorisation = async () => {
    try {
      const next = await getMyFinanceConsoleAccess();
      setAccess(next);
      if (!next.canViewConsole) setIsOpen(false);
    } catch (authError) {
      console.error('Unable to initialise Finance Console access:', authError);
      setAccess(null);
      setIsOpen(false);
    }
  };

  useEffect(() => {
    void refreshAuthorisation();
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setAccess(null);
        setIsOpen(false);
      } else {
        window.setTimeout(() => void refreshAuthorisation(), 0);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const loadSnapshot = async () => {
    try {
      setIsLoading(true);
      setError('');
      const next = await getFinanceConsoleSnapshot(250);
      setSnapshot(next);
      setAccess(next.access);
      setPriceForm((current) => ({
        ...current,
        examinationId: current.examinationId || next.examinations[0]?.id || '',
        currency: current.currency || next.financeSettings.defaultCurrency || 'NGN',
      }));
    } catch (snapshotError) {
      setError(snapshotError instanceof Error ? snapshotError.message : 'Unable to load Finance Console data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) void loadSnapshot();
  }, [isOpen]);

  const availableTabs = useMemo<TabDefinition[]>(() => {
    if (!access) return [];
    const tabs: TabDefinition[] = [
      { id: 'overview', label: 'Overview', icon: BarChart3 },
      { id: 'pricing', label: 'Examination Fees', icon: CircleDollarSign },
      { id: 'certification', label: 'Certification Fees', icon: FileBadge2 },
    ];
    if (access.canManageCoupons) tabs.push({ id: 'coupons', label: 'Discount Codes', icon: BadgePercent });
    tabs.push({ id: 'orders', label: 'Orders', icon: ShoppingCart });
    tabs.push({ id: 'payments', label: 'Payments', icon: CreditCard });
    if (access.canManagePermissions) tabs.push({ id: 'permissions', label: 'Permissions', icon: KeyRound });
    return tabs;
  }, [access]);

  useEffect(() => {
    if (!availableTabs.some((tab) => tab.id === activeTab)) setActiveTab('overview');
  }, [availableTabs, activeTab]);

  const savePrice = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setMessage('');

    const amountMinor = majorToMinor(priceForm.amountMajor, priceForm.currency);
    if (!priceForm.examinationId || amountMinor <= 0) {
      setError('Select an examination and enter a fee greater than zero.');
      return;
    }
    if (priceForm.changeReason.trim().length < 5) {
      setError('Enter a reason of at least five characters for the fee change.');
      return;
    }

    try {
      setIsLoading(true);
      await saveFinanceExamPrice({
        examinationId: priceForm.examinationId,
        currency: priceForm.currency,
        amountMinor,
        countryCodes: priceForm.countryCodes
          .split(',')
          .map((code) => code.trim().toUpperCase())
          .filter(Boolean),
        isDefault: priceForm.isDefault,
        isActive: priceForm.isActive,
        effectiveFrom: priceForm.effectiveFrom
          ? new Date(priceForm.effectiveFrom).toISOString()
          : new Date().toISOString(),
        effectiveTo: priceForm.effectiveTo
          ? new Date(priceForm.effectiveTo).toISOString()
          : null,
        changeReason: priceForm.changeReason,
      });
      setMessage('Examination fee saved and recorded in the finance audit trail.');
      await loadSnapshot();
    } catch (priceError) {
      setError(priceError instanceof Error ? priceError.message : 'The examination fee could not be saved.');
    } finally {
      setIsLoading(false);
    }
  };

  const editPrice = (examinationId: string, price: AdminExamPrice) => {
    setPriceForm({
      examinationId,
      currency: price.currency,
      amountMajor: minorToMajor(price.amountMinor, price.currency),
      countryCodes: (price.countryCodes || []).join(', '),
      isDefault: price.isDefault,
      isActive: price.isActive,
      effectiveFrom: toDateTimeLocal(price.effectiveFrom),
      effectiveTo: toDateTimeLocal(price.effectiveTo),
      changeReason: `Approved update to ${price.currency} examination fee`,
    });
    setActiveTab('pricing');
    setMessage(`${price.currency} fee loaded for editing.`);
  };

  const togglePrice = async (price: AdminExamPrice) => {
    const reason = window.prompt(
      `Reason for ${price.isActive ? 'deactivating' : 'activating'} this ${price.currency} fee:`,
      price.isActive ? 'Approved temporary fee deactivation' : 'Approved fee activation',
    )?.trim();
    if (!reason) return;

    try {
      setIsLoading(true);
      await setFinanceExamPriceActive({
        priceId: price.id,
        isActive: !price.isActive,
        changeReason: reason,
      });
      setMessage(`${price.currency} fee ${price.isActive ? 'deactivated' : 'activated'}.`);
      await loadSnapshot();
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : 'Unable to change fee status.');
    } finally {
      setIsLoading(false);
    }
  };

  const saveCoupon = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setMessage('');

    const parsedValue = Number(couponForm.discountValue);
    if (!couponForm.code.trim() || !Number.isFinite(parsedValue) || parsedValue <= 0) {
      setError('Enter a discount code and a discount greater than zero.');
      return;
    }
    if (couponForm.discountType === 'fixed' && !couponForm.currency) {
      setError('Fixed discounts require a currency.');
      return;
    }
    if (couponForm.scope !== 'all' && !couponForm.targetId) {
      setError('Select the programme or examination to which the discount applies.');
      return;
    }

    try {
      setIsLoading(true);
      await saveFinanceCoupon({
        couponId: couponForm.couponId || null,
        code: couponForm.code,
        name: couponForm.name,
        description: couponForm.description,
        discountType: couponForm.discountType,
        discountValue: couponForm.discountType === 'percentage'
          ? parsedValue
          : majorToMinor(couponForm.discountValue, couponForm.currency),
        currency: couponForm.currency || null,
        scope: couponForm.scope,
        programmeId: couponForm.scope === 'programme' ? couponForm.targetId : null,
        examinationId: couponForm.scope === 'examination' ? couponForm.targetId : null,
        minimumAmountMinor: 0,
        maximumDiscountMinor: null,
        startsAt: couponForm.startsAt ? new Date(couponForm.startsAt).toISOString() : null,
        expiresAt: couponForm.expiresAt ? new Date(couponForm.expiresAt).toISOString() : null,
        maximumRedemptions: couponForm.maximumRedemptions
          ? Number(couponForm.maximumRedemptions)
          : null,
        perCandidateLimit: Number(couponForm.perCandidateLimit) || 1,
        isActive: couponForm.isActive,
      });
      setCouponForm(blankCouponForm);
      setMessage('Discount code saved.');
      await loadSnapshot();
    } catch (couponError) {
      setError(couponError instanceof Error ? couponError.message : 'The discount code could not be saved.');
    } finally {
      setIsLoading(false);
    }
  };

  const editCoupon = (coupon: AdminCoupon) => {
    const currency = coupon.currency || '';
    setCouponForm({
      couponId: coupon.id,
      code: coupon.code,
      name: coupon.name || '',
      description: coupon.description || '',
      discountType: coupon.discountType,
      discountValue: coupon.discountType === 'percentage'
        ? String(coupon.discountValue)
        : minorToMajor(coupon.discountValue, currency || 'NGN'),
      currency,
      scope: coupon.scope,
      targetId: coupon.scope === 'programme'
        ? coupon.programmeId || ''
        : coupon.scope === 'examination'
          ? coupon.examinationId || ''
          : '',
      startsAt: toDateTimeLocal(coupon.startsAt),
      expiresAt: toDateTimeLocal(coupon.expiresAt),
      maximumRedemptions: coupon.maximumRedemptions ? String(coupon.maximumRedemptions) : '',
      perCandidateLimit: String(coupon.perCandidateLimit || 1),
      isActive: coupon.isActive,
    });
    setMessage(`Editing discount code ${coupon.code}.`);
  };

  const toggleCoupon = async (coupon: AdminCoupon) => {
    try {
      setIsLoading(true);
      await setFinanceCouponActive(coupon.id, !coupon.isActive);
      setMessage(`${coupon.code} ${coupon.isActive ? 'deactivated' : 'activated'}.`);
      await loadSnapshot();
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : 'Unable to change discount-code status.');
    } finally {
      setIsLoading(false);
    }
  };

  const cancelOrder = async (order: AdminExamOrder) => {
    const reason = window.prompt(
      `Reason for cancelling ${order.reference}:`,
      'Candidate requested cancellation',
    )?.trim();
    if (!reason) return;
    if (!window.confirm(`Cancel pending order ${order.reference}?`)) return;

    try {
      setIsLoading(true);
      await cancelFinanceExamOrder(order, reason);
      setMessage(`Order ${order.reference} cancelled.`);
      await loadSnapshot();
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : 'Unable to cancel the order.');
    } finally {
      setIsLoading(false);
    }
  };

  const changePermission = async (grant: FinancePermissionGrant) => {
    if (permissionReason.trim().length < 5) {
      setError('Enter a reason of at least five characters before changing finance permissions.');
      return;
    }
    if (!window.confirm(
      `${grant.isGranted ? 'Revoke' : 'Grant'} “${grant.name}” for Examination Administrators?`,
    )) return;

    try {
      setIsLoading(true);
      setError('');
      await setFinanceRolePermission({
        role: 'exam_admin',
        permissionKey: grant.permissionKey,
        isGranted: !grant.isGranted,
        reason: permissionReason,
      });
      setMessage(`${grant.name} ${grant.isGranted ? 'revoked' : 'granted'} for Examination Administrators.`);
      await loadSnapshot();
    } catch (permissionError) {
      setError(permissionError instanceof Error ? permissionError.message : 'Unable to change the permission.');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredOrders = useMemo(() => {
    if (!snapshot) return [];
    const query = orderSearch.trim().toLowerCase();
    return snapshot.orders.filter((order) => {
      const matchesStatus = orderStatus === 'all' || order.status === orderStatus;
      const matchesSearch = !query
        || order.reference.toLowerCase().includes(query)
        || order.candidateName.toLowerCase().includes(query)
        || order.candidateEmail.toLowerCase().includes(query)
        || order.course.toLowerCase().includes(query);
      return matchesStatus && matchesSearch;
    });
  }, [snapshot, orderSearch, orderStatus]);

  if (!access?.canViewConsole) return null;

  const summaryCards = snapshot ? [
    ['Published examinations', snapshot.summary.publishedExaminations, BarChart3],
    ['Active examination fees', snapshot.summary.activePrices, CircleDollarSign],
    ['Active certification fees', snapshot.certificationSummary.activePrices, FileBadge2],
    ['Active discount codes', snapshot.summary.activeCoupons, BadgePercent],
    ['Pending orders', snapshot.summary.pendingOrders, ShoppingCart],
    ['Paid orders', snapshot.summary.paidOrders, CheckCircle2],
    ['Failed or closed', snapshot.summary.failedOrders, XCircle],
  ] as const : [];

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-5 left-5 z-50 flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-extrabold text-white shadow-2xl hover:bg-slate-800"
        aria-label="Open Finance Console"
      >
        <Banknote className="h-4 w-4 text-amber-400" /> Finance Console
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[90] overflow-y-auto bg-slate-950/80 p-3 backdrop-blur-sm md:p-6">
          <div className="mx-auto min-h-[calc(100vh-1.5rem)] max-w-7xl overflow-hidden rounded-2xl bg-slate-50 shadow-2xl md:min-h-[calc(100vh-3rem)]">
            <header className="sticky top-0 z-20 flex items-center justify-between gap-4 bg-slate-950 px-5 py-4 text-white">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-amber-400">
                  Protected Administrator Workspace
                </p>
                <h1 className="text-xl font-extrabold">Finance Console</h1>
                <p className="mt-1 text-xs text-slate-400">Examination fees, certification fees, finance permissions and commerce controls</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void loadSnapshot()}
                  disabled={isLoading}
                  className="rounded-xl bg-slate-800 p-2 hover:bg-slate-700 disabled:opacity-50"
                  aria-label="Refresh Finance Console"
                >
                  <RefreshCw className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-xl bg-slate-800 p-2 hover:bg-slate-700"
                  aria-label="Close Finance Console"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </header>

            <div className="border-b border-slate-200 bg-white px-4 py-3">
              <div className="flex flex-wrap gap-2">
                {availableTabs.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveTab(id)}
                    className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-extrabold ${
                      activeTab === id
                        ? 'bg-slate-950 text-white'
                        : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="h-4 w-4" /> {label}
                  </button>
                ))}
              </div>
            </div>

            <main className="space-y-5 p-4 md:p-6">
              {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                  {error}
                </div>
              )}
              {message && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                  {message}
                </div>
              )}
              {isLoading && !snapshot && (
                <div className="flex min-h-80 items-center justify-center gap-3 text-sm font-bold text-slate-500">
                  <Loader2 className="h-5 w-5 animate-spin" /> Loading Finance Console…
                </div>
              )}

              {snapshot && activeTab === 'overview' && (
                <div className="space-y-6">
                  <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {summaryCards.map(([label, value, Icon]) => (
                      <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <Icon className="h-5 w-5 text-amber-600" />
                        <p className="mt-3 text-3xl font-black text-slate-950">{value}</p>
                        <p className="mt-1 text-xs font-bold text-slate-500">{label}</p>
                      </div>
                    ))}
                  </section>

                  <section className="grid gap-5 lg:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center gap-2">
                        <LockKeyhole className="h-5 w-5 text-slate-700" />
                        <h2 className="font-black text-slate-950">Finance foundation</h2>
                      </div>
                      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">Default currency</dt><dd className="mt-1 font-black">{snapshot.financeSettings.defaultCurrency || 'NGN'}</dd></div>
                        <div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">Receipt prefix</dt><dd className="mt-1 font-black">{snapshot.financeSettings.receiptPrefix || 'AGR'}</dd></div>
                        <div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">Role</dt><dd className="mt-1 font-black capitalize">{snapshot.access.role.replaceAll('_', ' ')}</dd></div>
                        <div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">Permissions</dt><dd className="mt-1 font-black">{snapshot.access.permissions.length}</dd></div>
                      </dl>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5 text-emerald-600" />
                        <h2 className="font-black text-slate-950">Paid revenue by currency</h2>
                      </div>
                      <div className="mt-4 space-y-3">
                        {snapshot.summary.paidByCurrency.length ? snapshot.summary.paidByCurrency.map((item) => (
                          <div key={item.currency} className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                            <div><p className="font-black">{item.currency}</p><p className="text-xs text-slate-500">{item.transactions} transactions</p></div>
                            <p className="font-black text-emerald-700">{formatMoney(item.amountMinor, item.currency)}</p>
                          </div>
                        )) : <p className="text-sm text-slate-500">No paid examination revenue has been recorded.</p>}
                      </div>
                    </div>
                  </section>

                  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-2">
                      <History className="h-5 w-5 text-violet-600" />
                      <h2 className="font-black text-slate-950">Recent finance audit events</h2>
                    </div>
                    <div className="mt-4 space-y-3">
                      {snapshot.financeAudit.length ? snapshot.financeAudit.slice(0, 20).map((event) => (
                        <div key={event.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-black text-slate-800">{event.action.replaceAll('_', ' ')}</p>
                            <p className="text-[11px] text-slate-500">{new Date(event.createdAt).toLocaleString()}</p>
                          </div>
                          <p className="mt-1 text-xs text-slate-500">{event.actorName || 'System'} · {event.entityType}</p>
                          {typeof event.metadata?.reason === 'string' && <p className="mt-2 text-xs text-slate-700">{event.metadata.reason}</p>}
                        </div>
                      )) : <p className="text-sm text-slate-500">No Finance Console changes have been recorded yet.</p>}
                    </div>
                  </section>
                </div>
              )}

              {snapshot && activeTab === 'pricing' && (
                <div className="grid gap-6 lg:grid-cols-3">
                  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-1">
                    <h2 className="font-black text-slate-950">Configure examination fee</h2>
                    <p className="mt-1 text-xs leading-5 text-slate-500">Fees are stored in the smallest currency unit and used by both single-module and cart checkout.</p>
                    {!snapshot.access.canManageExamPrices ? (
                      <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                        Your account has view-only access to examination fees.
                      </div>
                    ) : (
                      <form onSubmit={savePrice} className="mt-5 space-y-4">
                        <label className="block text-xs font-bold text-slate-600">Examination
                          <select value={priceForm.examinationId} onChange={(event) => setPriceForm({ ...priceForm, examinationId: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
                            {snapshot.examinations.map((exam) => <option key={exam.id} value={exam.id}>{exam.course} — {exam.title}</option>)}
                          </select>
                        </label>
                        <div className="grid grid-cols-3 gap-3">
                          <label className="col-span-1 text-xs font-bold text-slate-600">Currency
                            <input value={priceForm.currency} maxLength={3} onChange={(event) => setPriceForm({ ...priceForm, currency: event.target.value.toUpperCase() })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm uppercase" />
                          </label>
                          <label className="col-span-2 text-xs font-bold text-slate-600">Amount
                            <input type="number" min="0.01" step="0.01" value={priceForm.amountMajor} onChange={(event) => setPriceForm({ ...priceForm, amountMajor: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
                          </label>
                        </div>
                        <label className="block text-xs font-bold text-slate-600">Country routing codes
                          <input value={priceForm.countryCodes} onChange={(event) => setPriceForm({ ...priceForm, countryCodes: event.target.value })} placeholder="NG, GH, KE" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <label className="text-xs font-bold text-slate-600">Effective from
                            <input type="datetime-local" value={priceForm.effectiveFrom} onChange={(event) => setPriceForm({ ...priceForm, effectiveFrom: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
                          </label>
                          <label className="text-xs font-bold text-slate-600">Effective to
                            <input type="datetime-local" value={priceForm.effectiveTo} onChange={(event) => setPriceForm({ ...priceForm, effectiveTo: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
                          </label>
                        </div>
                        <label className="block text-xs font-bold text-slate-600">Change reason
                          <textarea value={priceForm.changeReason} onChange={(event) => setPriceForm({ ...priceForm, changeReason: event.target.value })} rows={3} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
                        </label>
                        <div className="flex flex-wrap gap-4 text-xs font-bold text-slate-600">
                          <label className="flex items-center gap-2"><input type="checkbox" checked={priceForm.isDefault} onChange={(event) => setPriceForm({ ...priceForm, isDefault: event.target.checked })} /> Default fee</label>
                          <label className="flex items-center gap-2"><input type="checkbox" checked={priceForm.isActive} onChange={(event) => setPriceForm({ ...priceForm, isActive: event.target.checked })} /> Active</label>
                        </div>
                        <button type="submit" disabled={isLoading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-sm font-black text-slate-950 hover:bg-amber-600 disabled:opacity-50">
                          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CircleDollarSign className="h-4 w-4" />} Save examination fee
                        </button>
                      </form>
                    )}
                  </section>

                  <section className="space-y-4 lg:col-span-2">
                    {snapshot.examinations.map((exam: AdminCommerceExamination) => (
                      <div key={exam.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{exam.course}</p><h3 className="mt-1 font-black text-slate-950">{exam.title}</h3></div>
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${exam.requiresPayment ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>{exam.requiresPayment ? 'Payment required' : 'No payment gate'}</span>
                        </div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          {exam.prices.length ? exam.prices.map((price) => (
                            <div key={price.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div><p className="text-lg font-black text-slate-950">{formatMoney(price.amountMinor, price.currency)}</p><p className="text-xs text-slate-500">{price.currency} · {(price.countryCodes || []).join(', ') || 'No country routing'}</p></div>
                                <span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${price.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>{price.isActive ? 'Active' : 'Inactive'}</span>
                              </div>
                              <div className="mt-3 text-[11px] text-slate-500"><p>Effective: {price.effectiveFrom ? new Date(price.effectiveFrom).toLocaleString() : 'Immediately'}</p><p>Ends: {price.effectiveTo ? new Date(price.effectiveTo).toLocaleString() : 'No expiry'}</p></div>
                              {snapshot.access.canManageExamPrices && (
                                <div className="mt-4 flex gap-2">
                                  <button type="button" onClick={() => editPrice(exam.id, price)} className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700"><Pencil className="h-3.5 w-3.5" /> Edit</button>
                                  <button type="button" onClick={() => void togglePrice(price)} className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700">{price.isActive ? <ToggleRight className="h-4 w-4 text-emerald-600" /> : <ToggleLeft className="h-4 w-4" />} {price.isActive ? 'Deactivate' : 'Activate'}</button>
                                </div>
                              )}
                            </div>
                          )) : <div className="rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-500 sm:col-span-2">No fee has been configured for this examination.</div>}
                        </div>
                      </div>
                    ))}
                  </section>
                </div>
              )}

              {snapshot && activeTab === 'certification' && (
                <FinanceCertificationFeesPanel
                  snapshot={snapshot}
                  onRefresh={loadSnapshot}
                  onMessage={setMessage}
                  onError={setError}
                />
              )}

              {snapshot && activeTab === 'coupons' && snapshot.access.canManageCoupons && (
                <div className="grid gap-6 lg:grid-cols-3">
                  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="font-black text-slate-950">Discount-code setup</h2>
                    <form onSubmit={saveCoupon} className="mt-5 space-y-3">
                      <input value={couponForm.code} onChange={(event) => setCouponForm({ ...couponForm, code: event.target.value.toUpperCase() })} placeholder="Code" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm uppercase" />
                      <input value={couponForm.name} onChange={(event) => setCouponForm({ ...couponForm, name: event.target.value })} placeholder="Name" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
                      <textarea value={couponForm.description} onChange={(event) => setCouponForm({ ...couponForm, description: event.target.value })} placeholder="Description" rows={2} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
                      <div className="grid grid-cols-2 gap-3"><select value={couponForm.discountType} onChange={(event) => setCouponForm({ ...couponForm, discountType: event.target.value as 'percentage' | 'fixed' })} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"><option value="percentage">Percentage</option><option value="fixed">Fixed amount</option></select><input type="number" min="0.01" step="0.01" value={couponForm.discountValue} onChange={(event) => setCouponForm({ ...couponForm, discountValue: event.target.value })} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /></div>
                      <input value={couponForm.currency} onChange={(event) => setCouponForm({ ...couponForm, currency: event.target.value.toUpperCase() })} placeholder="Currency, optional for percentage" maxLength={3} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm uppercase" />
                      <select value={couponForm.scope} onChange={(event) => setCouponForm({ ...couponForm, scope: event.target.value as 'all' | 'programme' | 'examination', targetId: '' })} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"><option value="all">All examinations</option><option value="programme">Programme</option><option value="examination">Examination</option></select>
                      {couponForm.scope === 'programme' && <select value={couponForm.targetId} onChange={(event) => setCouponForm({ ...couponForm, targetId: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"><option value="">Select programme</option>{snapshot.programmes.map((programme) => <option key={programme.id} value={programme.id}>{programme.code} — {programme.name}</option>)}</select>}
                      {couponForm.scope === 'examination' && <select value={couponForm.targetId} onChange={(event) => setCouponForm({ ...couponForm, targetId: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"><option value="">Select examination</option>{snapshot.examinations.map((exam) => <option key={exam.id} value={exam.id}>{exam.course} — {exam.title}</option>)}</select>}
                      <div className="grid grid-cols-2 gap-3"><input type="datetime-local" value={couponForm.startsAt} onChange={(event) => setCouponForm({ ...couponForm, startsAt: event.target.value })} className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs" /><input type="datetime-local" value={couponForm.expiresAt} onChange={(event) => setCouponForm({ ...couponForm, expiresAt: event.target.value })} className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs" /></div>
                      <div className="grid grid-cols-2 gap-3"><input type="number" min="1" value={couponForm.maximumRedemptions} onChange={(event) => setCouponForm({ ...couponForm, maximumRedemptions: event.target.value })} placeholder="Total limit" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /><input type="number" min="1" value={couponForm.perCandidateLimit} onChange={(event) => setCouponForm({ ...couponForm, perCandidateLimit: event.target.value })} placeholder="Per candidate" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /></div>
                      <label className="flex items-center gap-2 text-xs font-bold text-slate-600"><input type="checkbox" checked={couponForm.isActive} onChange={(event) => setCouponForm({ ...couponForm, isActive: event.target.checked })} /> Active</label>
                      <button type="submit" disabled={isLoading} className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white disabled:opacity-50">Save discount code</button>
                    </form>
                  </section>
                  <section className="space-y-3 lg:col-span-2">
                    {snapshot.coupons.length ? snapshot.coupons.map((coupon) => (
                      <div key={coupon.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-lg font-black text-slate-950">{coupon.code}</p><p className="text-xs text-slate-500">{coupon.name || coupon.description || 'Discount code'}</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${coupon.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>{coupon.isActive ? 'Active' : 'Inactive'}</span></div>
                        <div className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4"><div className="rounded-xl bg-slate-50 p-3"><p className="text-slate-500">Discount</p><p className="mt-1 font-black">{coupon.discountType === 'percentage' ? `${coupon.discountValue}%` : formatMoney(coupon.discountValue, coupon.currency || 'NGN')}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-slate-500">Scope</p><p className="mt-1 font-black capitalize">{coupon.scope}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-slate-500">Redeemed</p><p className="mt-1 font-black">{coupon.redeemedCount}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-slate-500">Per candidate</p><p className="mt-1 font-black">{coupon.perCandidateLimit}</p></div></div>
                        <div className="mt-4 flex gap-2"><button type="button" onClick={() => editCoupon(coupon)} className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-black"><Pencil className="h-3.5 w-3.5" /> Edit</button><button type="button" onClick={() => void toggleCoupon(coupon)} className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-black">{coupon.isActive ? <ToggleRight className="h-4 w-4 text-emerald-600" /> : <ToggleLeft className="h-4 w-4" />} {coupon.isActive ? 'Deactivate' : 'Activate'}</button></div>
                      </div>
                    )) : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">No discount codes configured.</div>}
                  </section>
                </div>
              )}

              {snapshot && activeTab === 'orders' && (
                <div className="space-y-4">
                  <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row">
                    <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={orderSearch} onChange={(event) => setOrderSearch(event.target.value)} placeholder="Search reference, candidate or course" className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm" /></div>
                    <select value={orderStatus} onChange={(event) => setOrderStatus(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"><option value="all">All statuses</option><option value="pending">Pending</option><option value="paid">Paid</option><option value="waived">Waived</option><option value="failed">Failed</option><option value="cancelled">Cancelled</option><option value="expired">Expired</option></select>
                  </div>
                  <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm"><table className="min-w-full text-left text-xs"><thead className="bg-slate-950 text-white"><tr><th className="px-4 py-3">Reference</th><th className="px-4 py-3">Candidate</th><th className="px-4 py-3">Examination</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Action</th></tr></thead><tbody>{filteredOrders.map((order) => <tr key={order.id} className="border-t border-slate-100"><td className="px-4 py-3 font-black">{order.reference}</td><td className="px-4 py-3"><p className="font-bold">{order.candidateName}</p><p className="text-slate-500">{order.candidateEmail}</p></td><td className="px-4 py-3"><p className="font-bold">{order.course}</p><p className="max-w-xs truncate text-slate-500">{order.examinationTitle}</p></td><td className="px-4 py-3 font-black">{formatMoney(order.payableAmountMinor, order.currency)}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${statusTone(order.status)}`}>{order.status}</span></td><td className="px-4 py-3">{order.status === 'pending' && snapshot.access.canManageOrders ? <button type="button" onClick={() => void cancelOrder(order)} className="rounded-lg border border-rose-200 px-2 py-1 font-black text-rose-700">Cancel</button> : '—'}</td></tr>)}</tbody></table></div>
                </div>
              )}

              {snapshot && activeTab === 'payments' && (
                <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm"><table className="min-w-full text-left text-xs"><thead className="bg-slate-950 text-white"><tr><th className="px-4 py-3">Reference</th><th className="px-4 py-3">Candidate</th><th className="px-4 py-3">Examination</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Provider</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Paid</th></tr></thead><tbody>{snapshot.payments.map((payment) => <tr key={payment.id} className="border-t border-slate-100"><td className="px-4 py-3 font-black">{payment.reference}</td><td className="px-4 py-3"><p className="font-bold">{payment.candidateName}</p><p className="text-slate-500">{payment.candidateEmail}</p></td><td className="px-4 py-3"><p className="font-bold">{payment.course}</p><p className="max-w-xs truncate text-slate-500">{payment.examinationTitle}</p></td><td className="px-4 py-3 font-black">{formatMoney(payment.amountMinor, payment.currency)}</td><td className="px-4 py-3 capitalize">{payment.provider}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${statusTone(payment.status)}`}>{payment.status}</span></td><td className="px-4 py-3 text-slate-500">{payment.paidAt ? new Date(payment.paidAt).toLocaleString() : '—'}</td></tr>)}</tbody></table></div>
              )}

              {snapshot && activeTab === 'permissions' && snapshot.access.canManagePermissions && (
                <section className="space-y-5">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-violet-600" /><h2 className="font-black text-slate-950">Examination Administrator finance permissions</h2></div>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Super Administrators retain all finance authority. The controls below grant or revoke specific Finance Console responsibilities for every active Examination Administrator account.</p>
                    <label className="mt-4 block text-xs font-bold text-slate-600">Reason for permission changes
                      <input value={permissionReason} onChange={(event) => setPermissionReason(event.target.value)} className="mt-1 w-full max-w-2xl rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
                    </label>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    {snapshot.permissionMatrix.map((grant) => (
                      <div key={grant.permissionKey} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex items-start justify-between gap-4"><div><p className="font-black text-slate-950">{grant.name}</p><p className="mt-2 text-xs leading-5 text-slate-500">{grant.description}</p></div><span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${grant.riskLevel === 'restricted' ? 'bg-rose-100 text-rose-800' : grant.riskLevel === 'sensitive' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>{grant.riskLevel}</span></div>
                        <button type="button" onClick={() => void changePermission(grant)} disabled={isLoading} className={`mt-5 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black ${grant.isGranted ? 'border border-rose-200 bg-rose-50 text-rose-700' : 'bg-emerald-600 text-white'}`}>{grant.isGranted ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />} {grant.isGranted ? 'Revoke permission' : 'Grant permission'}</button>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </main>
          </div>
        </div>
      )}
    </>
  );
}

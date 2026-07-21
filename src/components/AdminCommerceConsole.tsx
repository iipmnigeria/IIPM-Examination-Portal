import { type FormEvent, useEffect, useMemo, useState } from 'react';
import {
  BadgePercent,
  Banknote,
  BarChart3,
  CheckCircle2,
  CircleDollarSign,
  CreditCard,
  Loader2,
  PackageCheck,
  Pencil,
  ReceiptText,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingCart,
  Tags,
  ToggleLeft,
  ToggleRight,
  X,
  XCircle,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getCurrentPortalUser } from '../services/authService';
import {
  cancelExamOrder,
  getAdminCommerceSnapshot,
  setCouponActive,
  setExamPriceActive,
  upsertCoupon,
  upsertExamPrice,
  type AdminCommerceSnapshot,
  type AdminCoupon,
  type AdminExamOrder,
  type AdminExamPrice,
} from '../services/adminCommerceService';

type ConsoleTab = 'overview' | 'pricing' | 'coupons' | 'orders' | 'payments' | 'redemptions';

const currencyDigits = (currency: string): number => {
  try {
    return new Intl.NumberFormat('en', {
      style: 'currency',
      currency,
    }).resolvedOptions().maximumFractionDigits;
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
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * 10 ** currencyDigits(currency));
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

const emptyPriceForm = {
  examinationId: '',
  currency: 'NGN',
  amountMajor: '25000',
  countryCodes: 'NG',
  isDefault: true,
  isActive: true,
  effectiveFrom: '',
  effectiveTo: '',
};

const emptyCouponForm = {
  couponId: '',
  code: '',
  name: '',
  description: '',
  discountType: 'percentage' as 'percentage' | 'fixed',
  discountValue: '10',
  currency: '',
  scope: 'all' as 'all' | 'programme' | 'examination',
  targetId: '',
  minimumAmountMajor: '',
  maximumDiscountMajor: '',
  startsAt: '',
  expiresAt: '',
  maximumRedemptions: '',
  perCandidateLimit: '1',
  isActive: true,
};

export default function AdminCommerceConsole() {
  const [isAuthorised, setIsAuthorised] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ConsoleTab>('overview');
  const [snapshot, setSnapshot] = useState<AdminCommerceSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [priceForm, setPriceForm] = useState(emptyPriceForm);
  const [couponForm, setCouponForm] = useState(emptyCouponForm);
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatus, setOrderStatus] = useState('all');

  const refreshAuthorisation = async () => {
    try {
      const current = await getCurrentPortalUser();
      setIsAuthorised(Boolean(current && ['exam_admin', 'super_admin'].includes(current.profile.role)));
    } catch (authError) {
      console.error('Unable to initialise commerce administration:', authError);
      setIsAuthorised(false);
      setIsOpen(false);
    }
  };

  useEffect(() => {
    void refreshAuthorisation();

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setIsAuthorised(false);
        setIsOpen(false);
        return;
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        window.setTimeout(() => void refreshAuthorisation(), 0);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const loadSnapshot = async () => {
    try {
      setIsLoading(true);
      setError('');
      const nextSnapshot = await getAdminCommerceSnapshot(200);
      setSnapshot(nextSnapshot);
      setPriceForm((current) => ({
        ...current,
        examinationId: current.examinationId || nextSnapshot.examinations[0]?.id || '',
      }));
    } catch (snapshotError: any) {
      setError(snapshotError?.message || 'Unable to load the commerce administration data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) void loadSnapshot();
  }, [isOpen]);

  const selectedCouponCurrency = couponForm.currency || 'NGN';

  const handleSavePrice = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setMessage('');

    const amountMinor = majorToMinor(priceForm.amountMajor, priceForm.currency);
    if (!priceForm.examinationId || amountMinor <= 0) {
      setError('Select an examination and enter a price greater than zero.');
      return;
    }

    try {
      setIsLoading(true);
      await upsertExamPrice({
        examinationId: priceForm.examinationId,
        currency: priceForm.currency,
        amountMinor,
        countryCodes: priceForm.countryCodes
          .split(',')
          .map((value) => value.trim().toUpperCase())
          .filter(Boolean),
        isDefault: priceForm.isDefault,
        isActive: priceForm.isActive,
        effectiveFrom: priceForm.effectiveFrom
          ? new Date(priceForm.effectiveFrom).toISOString()
          : null,
        effectiveTo: priceForm.effectiveTo ? new Date(priceForm.effectiveTo).toISOString() : null,
      });
      setMessage('Examination price saved successfully.');
      await loadSnapshot();
    } catch (priceError: any) {
      setError(priceError?.message || 'The examination price could not be saved.');
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
    });
    setActiveTab('pricing');
    setMessage('Price loaded for editing. Saving will update the existing currency record.');
    window.setTimeout(() => document.getElementById('commerce-price-form')?.scrollIntoView({ behavior: 'smooth' }), 0);
  };

  const handleTogglePrice = async (price: AdminExamPrice) => {
    try {
      setIsLoading(true);
      setError('');
      await setExamPriceActive(price.id, !price.isActive);
      setMessage(`${price.currency} price ${price.isActive ? 'disabled' : 'enabled'}.`);
      await loadSnapshot();
    } catch (toggleError: any) {
      setError(toggleError?.message || 'The price status could not be changed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveCoupon = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setMessage('');

    const discountNumeric = Number(couponForm.discountValue);
    if (!couponForm.code.trim() || !Number.isFinite(discountNumeric) || discountNumeric <= 0) {
      setError('Enter a coupon code and a discount greater than zero.');
      return;
    }
    if (couponForm.discountType === 'fixed' && !couponForm.currency) {
      setError('Fixed-value coupons require a currency.');
      return;
    }
    if (couponForm.scope !== 'all' && !couponForm.targetId) {
      setError(`Select the ${couponForm.scope} to which this coupon applies.`);
      return;
    }

    const currency = couponForm.currency || null;
    const discountValue =
      couponForm.discountType === 'percentage'
        ? discountNumeric
        : majorToMinor(couponForm.discountValue, selectedCouponCurrency);

    try {
      setIsLoading(true);
      await upsertCoupon({
        couponId: couponForm.couponId || null,
        code: couponForm.code,
        name: couponForm.name,
        description: couponForm.description,
        discountType: couponForm.discountType,
        discountValue,
        currency,
        scope: couponForm.scope,
        programmeId: couponForm.scope === 'programme' ? couponForm.targetId : null,
        examinationId: couponForm.scope === 'examination' ? couponForm.targetId : null,
        minimumAmountMinor:
          currency && couponForm.minimumAmountMajor
            ? majorToMinor(couponForm.minimumAmountMajor, currency)
            : 0,
        maximumDiscountMinor:
          currency && couponForm.maximumDiscountMajor
            ? majorToMinor(couponForm.maximumDiscountMajor, currency)
            : null,
        startsAt: couponForm.startsAt ? new Date(couponForm.startsAt).toISOString() : null,
        expiresAt: couponForm.expiresAt ? new Date(couponForm.expiresAt).toISOString() : null,
        maximumRedemptions: couponForm.maximumRedemptions
          ? Number(couponForm.maximumRedemptions)
          : null,
        perCandidateLimit: Number(couponForm.perCandidateLimit) || 1,
        isActive: couponForm.isActive,
      });

      setCouponForm(emptyCouponForm);
      setMessage('Coupon saved successfully.');
      await loadSnapshot();
    } catch (couponError: any) {
      setError(couponError?.message || 'The coupon could not be saved.');
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
      discountValue:
        coupon.discountType === 'percentage'
          ? String(coupon.discountValue)
          : minorToMajor(coupon.discountValue, currency || 'NGN'),
      currency,
      scope: coupon.scope,
      targetId:
        coupon.scope === 'programme'
          ? coupon.programmeId || ''
          : coupon.scope === 'examination'
            ? coupon.examinationId || ''
            : '',
      minimumAmountMajor: currency
        ? minorToMajor(coupon.minimumAmountMinor, currency)
        : '',
      maximumDiscountMajor: currency
        ? minorToMajor(coupon.maximumDiscountMinor, currency)
        : '',
      startsAt: toDateTimeLocal(coupon.startsAt),
      expiresAt: toDateTimeLocal(coupon.expiresAt),
      maximumRedemptions: coupon.maximumRedemptions ? String(coupon.maximumRedemptions) : '',
      perCandidateLimit: String(coupon.perCandidateLimit || 1),
      isActive: coupon.isActive,
    });
    setActiveTab('coupons');
    setMessage(`Editing coupon ${coupon.code}.`);
    window.setTimeout(() => document.getElementById('commerce-coupon-form')?.scrollIntoView({ behavior: 'smooth' }), 0);
  };

  const handleToggleCoupon = async (coupon: AdminCoupon) => {
    try {
      setIsLoading(true);
      setError('');
      await setCouponActive(coupon.id, !coupon.isActive);
      setMessage(`${coupon.code} ${coupon.isActive ? 'disabled' : 'enabled'}.`);
      await loadSnapshot();
    } catch (toggleError: any) {
      setError(toggleError?.message || 'The coupon status could not be changed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelOrder = async (order: AdminExamOrder) => {
    const reason = window.prompt(
      `Why should order ${order.reference} be cancelled?`,
      'Candidate requested cancellation',
    );
    if (reason === null) return;

    const confirmed = window.confirm(
      `Cancel pending order ${order.reference}? This releases any reserved coupon and cannot mark a payment as successful.`,
    );
    if (!confirmed) return;

    try {
      setIsLoading(true);
      setError('');
      await cancelExamOrder(order.id, reason);
      setMessage(`Order ${order.reference} has been cancelled.`);
      await loadSnapshot();
    } catch (cancelError: any) {
      setError(cancelError?.message || 'The order could not be cancelled.');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredOrders = useMemo(() => {
    if (!snapshot) return [];
    const search = orderSearch.trim().toLowerCase();
    return snapshot.orders.filter((order) => {
      const matchesStatus = orderStatus === 'all' || order.status === orderStatus;
      const matchesSearch =
        !search ||
        order.reference.toLowerCase().includes(search) ||
        order.candidateName.toLowerCase().includes(search) ||
        order.candidateEmail.toLowerCase().includes(search) ||
        order.course.toLowerCase().includes(search);
      return matchesStatus && matchesSearch;
    });
  }, [snapshot, orderSearch, orderStatus]);

  if (!isAuthorised) return null;

  const tabs: Array<{ id: ConsoleTab; label: string; icon: typeof BarChart3 }> = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'pricing', label: 'Pricing', icon: CircleDollarSign },
    { id: 'coupons', label: 'Coupons', icon: BadgePercent },
    { id: 'orders', label: 'Orders', icon: ShoppingCart },
    { id: 'payments', label: 'Payments', icon: CreditCard },
    { id: 'redemptions', label: 'Redemptions', icon: Tags },
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-5 left-5 z-50 flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-extrabold text-white shadow-2xl transition hover:bg-slate-800"
      >
        <Banknote className="h-4 w-4 text-amber-400" /> Commerce Console
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[90] overflow-y-auto bg-slate-950/80 p-3 backdrop-blur-sm md:p-6">
          <div className="mx-auto min-h-[calc(100vh-1.5rem)] max-w-7xl overflow-hidden rounded-2xl border border-slate-700 bg-slate-50 shadow-2xl md:min-h-[calc(100vh-3rem)]">
            <header className="sticky top-0 z-20 flex flex-col gap-4 bg-slate-950 px-5 py-4 text-white md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-amber-500 p-2.5 text-slate-950">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-amber-400">
                    Protected Administrator Workspace
                  </p>
                  <h1 className="text-xl font-extrabold">Examination Commerce Console</h1>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void loadSnapshot()}
                  disabled={isLoading}
                  className="flex items-center gap-2 rounded-xl bg-slate-800 px-3 py-2 text-xs font-bold transition hover:bg-slate-700 disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
                  aria-label="Close commerce console"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </header>

            <nav className="sticky top-[76px] z-10 flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-4 py-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-extrabold transition ${
                      activeTab === tab.id
                        ? 'bg-slate-950 text-white'
                        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="h-4 w-4" /> {tab.label}
                  </button>
                );
              })}
            </nav>

            <main className="space-y-5 p-4 md:p-6">
              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
                </div>
              )}
              {message && (
                <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> {message}
                </div>
              )}

              {isLoading && !snapshot ? (
                <div className="grid min-h-[420px] place-items-center">
                  <div className="flex flex-col items-center gap-3 text-slate-500">
                    <Loader2 className="h-9 w-9 animate-spin text-emerald-600" />
                    <p className="text-sm font-bold">Loading commerce records…</p>
                  </div>
                </div>
              ) : !snapshot ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
                  Commerce records are unavailable. Run migration 012 and refresh this panel.
                </div>
              ) : (
                <>
                  {activeTab === 'overview' && (
                    <section className="space-y-6">
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {[
                          ['Published Exams', snapshot.summary.publishedExaminations, PackageCheck],
                          ['Active Prices', snapshot.summary.activePrices, CircleDollarSign],
                          ['Active Coupons', snapshot.summary.activeCoupons, BadgePercent],
                          ['Pending Orders', snapshot.summary.pendingOrders, ShoppingCart],
                          ['Paid Orders', snapshot.summary.paidOrders, CheckCircle2],
                          ['Waived Orders', snapshot.summary.waivedOrders, Tags],
                          ['Failed/Closed', snapshot.summary.failedOrders, XCircle],
                          ['Payment Records', snapshot.payments.length, ReceiptText],
                        ].map(([label, value, Icon]) => (
                          <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">{String(label)}</p>
                              <Icon className="h-5 w-5 text-emerald-600" />
                            </div>
                            <p className="mt-3 text-3xl font-black text-slate-950">{Number(value)}</p>
                          </div>
                        ))}
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <h2 className="text-base font-extrabold text-slate-950">Verified Revenue by Currency</h2>
                        <p className="mt-1 text-xs text-slate-500">Only database orders marked paid are included.</p>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          {snapshot.summary.paidByCurrency.length === 0 ? (
                            <p className="text-sm text-slate-400">No verified paid transactions yet.</p>
                          ) : (
                            snapshot.summary.paidByCurrency.map((item) => (
                              <div key={item.currency} className="rounded-xl bg-slate-950 p-4 text-white">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{item.currency}</p>
                                <p className="mt-1 text-xl font-black">{formatMoney(item.amountMinor, item.currency)}</p>
                                <p className="mt-1 text-xs text-emerald-400">{item.transactions} transaction(s)</p>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </section>
                  )}

                  {activeTab === 'pricing' && (
                    <section className="grid gap-6 lg:grid-cols-[380px_1fr]">
                      <form id="commerce-price-form" onSubmit={handleSavePrice} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div>
                          <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-600">Price Configuration</p>
                          <h2 className="text-lg font-extrabold text-slate-950">Add or Update Currency Price</h2>
                        </div>
                        <label className="block text-xs font-bold text-slate-600">
                          Examination
                          <select value={priceForm.examinationId} onChange={(event) => setPriceForm((current) => ({ ...current, examinationId: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm">
                            {snapshot.examinations.map((exam) => (
                              <option key={exam.id} value={exam.id}>{exam.course} — {exam.title}</option>
                            ))}
                          </select>
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <label className="text-xs font-bold text-slate-600">
                            Currency
                            <input value={priceForm.currency} maxLength={3} onChange={(event) => setPriceForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 uppercase" />
                          </label>
                          <label className="text-xs font-bold text-slate-600">
                            Amount
                            <input type="number" min="0" step="0.01" value={priceForm.amountMajor} onChange={(event) => setPriceForm((current) => ({ ...current, amountMajor: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5" />
                          </label>
                        </div>
                        <label className="block text-xs font-bold text-slate-600">
                          Routed country codes
                          <input value={priceForm.countryCodes} onChange={(event) => setPriceForm((current) => ({ ...current, countryCodes: event.target.value.toUpperCase() }))} placeholder="NG, GH, KE" className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm uppercase" />
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <label className="text-xs font-bold text-slate-600">
                            Effective from
                            <input type="datetime-local" value={priceForm.effectiveFrom} onChange={(event) => setPriceForm((current) => ({ ...current, effectiveFrom: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-xs" />
                          </label>
                          <label className="text-xs font-bold text-slate-600">
                            Effective to
                            <input type="datetime-local" value={priceForm.effectiveTo} onChange={(event) => setPriceForm((current) => ({ ...current, effectiveTo: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-xs" />
                          </label>
                        </div>
                        <div className="flex flex-wrap gap-4 rounded-xl bg-slate-50 p-3 text-xs font-bold text-slate-700">
                          <label className="flex items-center gap-2"><input type="checkbox" checked={priceForm.isDefault} onChange={(event) => setPriceForm((current) => ({ ...current, isDefault: event.target.checked }))} /> Default currency</label>
                          <label className="flex items-center gap-2"><input type="checkbox" checked={priceForm.isActive} onChange={(event) => setPriceForm((current) => ({ ...current, isActive: event.target.checked }))} /> Active</label>
                        </div>
                        <button disabled={isLoading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-extrabold text-white hover:bg-emerald-700 disabled:opacity-50">
                          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CircleDollarSign className="h-4 w-4" />} Save Price
                        </button>
                      </form>

                      <div className="space-y-4">
                        {snapshot.examinations.map((exam) => (
                          <article key={exam.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                            <div>
                              <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-600">{exam.course}</p>
                              <h3 className="font-extrabold text-slate-950">{exam.title}</h3>
                            </div>
                            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                              {exam.prices.length === 0 ? (
                                <p className="text-sm text-amber-600">No price configured.</p>
                              ) : (
                                exam.prices.map((price) => (
                                  <div key={price.id} className={`rounded-xl border p-4 ${price.isActive ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200 bg-slate-50 opacity-70'}`}>
                                    <div className="flex items-start justify-between gap-2">
                                      <div>
                                        <p className="text-xs font-black text-slate-500">{price.currency}{price.isDefault ? ' • DEFAULT' : ''}</p>
                                        <p className="mt-1 text-lg font-black text-slate-950">{formatMoney(price.amountMinor, price.currency)}</p>
                                      </div>
                                      <button type="button" onClick={() => void handleTogglePrice(price)} className="text-slate-500 hover:text-slate-950" aria-label="Toggle price">
                                        {price.isActive ? <ToggleRight className="h-6 w-6 text-emerald-600" /> : <ToggleLeft className="h-6 w-6" />}
                                      </button>
                                    </div>
                                    <p className="mt-2 text-[11px] text-slate-500">Routes: {price.countryCodes?.join(', ') || 'Manual selection'}</p>
                                    <button type="button" onClick={() => editPrice(exam.id, price)} className="mt-3 flex items-center gap-1 text-xs font-extrabold text-emerald-700 hover:underline"><Pencil className="h-3.5 w-3.5" /> Edit</button>
                                  </div>
                                ))
                              )}
                            </div>
                          </article>
                        ))}
                      </div>
                    </section>
                  )}

                  {activeTab === 'coupons' && (
                    <section className="grid gap-6 xl:grid-cols-[420px_1fr]">
                      <form id="commerce-coupon-form" onSubmit={handleSaveCoupon} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-600">Discount Control</p>
                            <h2 className="text-lg font-extrabold text-slate-950">{couponForm.couponId ? 'Edit Coupon' : 'Create Coupon'}</h2>
                          </div>
                          {couponForm.couponId && <button type="button" onClick={() => setCouponForm(emptyCouponForm)} className="text-xs font-bold text-slate-500 hover:text-slate-950">New coupon</button>}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <label className="text-xs font-bold text-slate-600">Code<input value={couponForm.code} onChange={(event) => setCouponForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 uppercase" /></label>
                          <label className="text-xs font-bold text-slate-600">Name<input value={couponForm.name} onChange={(event) => setCouponForm((current) => ({ ...current, name: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
                        </div>
                        <label className="block text-xs font-bold text-slate-600">Description<textarea value={couponForm.description} onChange={(event) => setCouponForm((current) => ({ ...current, description: event.target.value }))} rows={2} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
                        <div className="grid grid-cols-3 gap-3">
                          <label className="text-xs font-bold text-slate-600">Type<select value={couponForm.discountType} onChange={(event) => setCouponForm((current) => ({ ...current, discountType: event.target.value as 'percentage' | 'fixed' }))} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5"><option value="percentage">Percentage</option><option value="fixed">Fixed</option></select></label>
                          <label className="text-xs font-bold text-slate-600">Value<input type="number" min="0" step="0.01" value={couponForm.discountValue} onChange={(event) => setCouponForm((current) => ({ ...current, discountValue: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
                          <label className="text-xs font-bold text-slate-600">Currency<select value={couponForm.currency} onChange={(event) => setCouponForm((current) => ({ ...current, currency: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5"><option value="">Any</option>{Array.from(new Set(snapshot.examinations.flatMap((exam) => exam.prices.map((price) => price.currency)))).map((currency) => <option key={currency} value={currency}>{currency}</option>)}</select></label>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <label className="text-xs font-bold text-slate-600">Scope<select value={couponForm.scope} onChange={(event) => setCouponForm((current) => ({ ...current, scope: event.target.value as 'all' | 'programme' | 'examination', targetId: '' }))} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5"><option value="all">All examinations</option><option value="programme">Programme</option><option value="examination">Examination</option></select></label>
                          {couponForm.scope !== 'all' && (
                            <label className="text-xs font-bold text-slate-600">Target<select value={couponForm.targetId} onChange={(event) => setCouponForm((current) => ({ ...current, targetId: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5"><option value="">Select…</option>{couponForm.scope === 'programme' ? snapshot.programmes.map((programme) => <option key={programme.id} value={programme.id}>{programme.code}</option>) : snapshot.examinations.map((exam) => <option key={exam.id} value={exam.id}>{exam.course}</option>)}</select></label>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <label className="text-xs font-bold text-slate-600">Minimum purchase<input type="number" min="0" step="0.01" value={couponForm.minimumAmountMajor} onChange={(event) => setCouponForm((current) => ({ ...current, minimumAmountMajor: event.target.value }))} disabled={!couponForm.currency} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 disabled:bg-slate-100" /></label>
                          <label className="text-xs font-bold text-slate-600">Maximum discount<input type="number" min="0" step="0.01" value={couponForm.maximumDiscountMajor} onChange={(event) => setCouponForm((current) => ({ ...current, maximumDiscountMajor: event.target.value }))} disabled={!couponForm.currency} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 disabled:bg-slate-100" /></label>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <label className="text-xs font-bold text-slate-600">Starts<input type="datetime-local" value={couponForm.startsAt} onChange={(event) => setCouponForm((current) => ({ ...current, startsAt: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-xs" /></label>
                          <label className="text-xs font-bold text-slate-600">Expires<input type="datetime-local" value={couponForm.expiresAt} onChange={(event) => setCouponForm((current) => ({ ...current, expiresAt: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-xs" /></label>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <label className="text-xs font-bold text-slate-600">Total use limit<input type="number" min="1" value={couponForm.maximumRedemptions} onChange={(event) => setCouponForm((current) => ({ ...current, maximumRedemptions: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
                          <label className="text-xs font-bold text-slate-600">Per candidate<input type="number" min="1" value={couponForm.perCandidateLimit} onChange={(event) => setCouponForm((current) => ({ ...current, perCandidateLimit: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
                        </div>
                        <label className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-xs font-bold text-slate-700"><input type="checkbox" checked={couponForm.isActive} onChange={(event) => setCouponForm((current) => ({ ...current, isActive: event.target.checked }))} /> Coupon is active</label>
                        <button disabled={isLoading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-extrabold text-white hover:bg-emerald-700 disabled:opacity-50">{isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgePercent className="h-4 w-4" />} Save Coupon</button>
                      </form>

                      <div className="space-y-3">
                        {snapshot.coupons.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">No coupons configured.</div> : snapshot.coupons.map((coupon) => (
                          <article key={coupon.id} className={`rounded-2xl border bg-white p-5 shadow-sm ${coupon.isActive ? 'border-emerald-200' : 'border-slate-200 opacity-70'}`}>
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <div className="flex flex-wrap items-center gap-2"><span className="rounded-lg bg-slate-950 px-2.5 py-1 font-mono text-xs font-black text-white">{coupon.code}</span><span className="text-xs font-bold uppercase text-slate-400">{coupon.scope}</span></div>
                                <h3 className="mt-2 font-extrabold text-slate-950">{coupon.name || 'Untitled Coupon'}</h3>
                                <p className="mt-1 text-xs text-slate-500">{coupon.description || 'No description provided.'}</p>
                              </div>
                              <div className="flex items-center gap-2"><button type="button" onClick={() => editCoupon(coupon)} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"><Pencil className="h-4 w-4" /></button><button type="button" onClick={() => void handleToggleCoupon(coupon)} className="rounded-lg border border-slate-200 p-2">{coupon.isActive ? <ToggleRight className="h-5 w-5 text-emerald-600" /> : <ToggleLeft className="h-5 w-5 text-slate-500" />}</button></div>
                            </div>
                            <div className="mt-4 grid gap-3 sm:grid-cols-4">
                              <div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase text-slate-400">Discount</p><p className="mt-1 font-black text-slate-950">{coupon.discountType === 'percentage' ? `${coupon.discountValue}%` : formatMoney(coupon.discountValue, coupon.currency || 'NGN')}</p></div>
                              <div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase text-slate-400">Currency</p><p className="mt-1 font-black text-slate-950">{coupon.currency || 'ANY'}</p></div>
                              <div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase text-slate-400">Redeemed</p><p className="mt-1 font-black text-emerald-700">{coupon.redeemedCount}</p></div>
                              <div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase text-slate-400">Reserved</p><p className="mt-1 font-black text-amber-700">{coupon.reservedCount}</p></div>
                            </div>
                          </article>
                        ))}
                      </div>
                    </section>
                  )}

                  {activeTab === 'orders' && (
                    <section className="space-y-4">
                      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
                        <div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input value={orderSearch} onChange={(event) => setOrderSearch(event.target.value)} placeholder="Search reference, candidate or course" className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 text-sm" /></div>
                        <select value={orderStatus} onChange={(event) => setOrderStatus(event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-bold"><option value="all">All statuses</option>{['pending', 'paid', 'waived', 'failed', 'cancelled', 'expired', 'refunded'].map((status) => <option key={status} value={status}>{status.toUpperCase()}</option>)}</select>
                      </div>
                      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <table className="min-w-full text-left text-xs"><thead className="bg-slate-950 text-white"><tr><th className="px-4 py-3">Reference</th><th className="px-4 py-3">Candidate</th><th className="px-4 py-3">Examination</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Created</th><th className="px-4 py-3">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredOrders.map((order) => <tr key={order.id} className="align-top"><td className="px-4 py-3 font-mono font-bold text-slate-800">{order.reference}</td><td className="px-4 py-3"><p className="font-bold text-slate-900">{order.candidateName}</p><p className="text-slate-400">{order.candidateEmail}</p></td><td className="px-4 py-3"><p className="font-bold text-slate-900">{order.course}</p><p className="max-w-xs text-slate-400">{order.examinationTitle}</p></td><td className="px-4 py-3 font-black text-slate-900">{formatMoney(order.payableAmountMinor, order.currency)}{order.discountAmountMinor > 0 && <p className="font-normal text-emerald-600">Discount {formatMoney(order.discountAmountMinor, order.currency)}</p>}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${order.status === 'paid' || order.status === 'waived' ? 'bg-emerald-50 text-emerald-700' : order.status === 'pending' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{order.status}</span></td><td className="px-4 py-3 text-slate-500">{new Date(order.createdAt).toLocaleString()}</td><td className="px-4 py-3">{order.status === 'pending' ? <button type="button" onClick={() => void handleCancelOrder(order)} className="rounded-lg border border-rose-200 px-2 py-1 font-bold text-rose-600 hover:bg-rose-50">Cancel</button> : <span className="text-slate-300">—</span>}</td></tr>)}</tbody></table>
                        {filteredOrders.length === 0 && <div className="p-8 text-center text-sm text-slate-400">No matching orders.</div>}
                      </div>
                    </section>
                  )}

                  {activeTab === 'payments' && (
                    <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <table className="min-w-full text-left text-xs"><thead className="bg-slate-950 text-white"><tr><th className="px-4 py-3">Reference</th><th className="px-4 py-3">Candidate</th><th className="px-4 py-3">Examination</th><th className="px-4 py-3">Provider ID</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Paid/Created</th></tr></thead><tbody className="divide-y divide-slate-100">{snapshot.payments.map((payment) => <tr key={payment.id}><td className="px-4 py-3 font-mono font-bold">{payment.reference}</td><td className="px-4 py-3"><p className="font-bold">{payment.candidateName}</p><p className="text-slate-400">{payment.candidateEmail}</p></td><td className="px-4 py-3"><p className="font-bold">{payment.course}</p><p className="text-slate-400">{payment.examinationTitle}</p></td><td className="px-4 py-3 font-mono text-slate-500">{payment.providerTransactionId || 'Pending'}</td><td className="px-4 py-3 font-black">{formatMoney(payment.amountMinor, payment.currency)}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${payment.status === 'success' ? 'bg-emerald-50 text-emerald-700' : payment.status === 'initiated' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{payment.status}</span></td><td className="px-4 py-3 text-slate-500">{new Date(payment.paidAt || payment.createdAt).toLocaleString()}</td></tr>)}</tbody></table>
                      {snapshot.payments.length === 0 && <div className="p-8 text-center text-sm text-slate-400">No payment records.</div>}
                    </section>
                  )}

                  {activeTab === 'redemptions' && (
                    <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <table className="min-w-full text-left text-xs"><thead className="bg-slate-950 text-white"><tr><th className="px-4 py-3">Coupon</th><th className="px-4 py-3">Candidate</th><th className="px-4 py-3">Examination</th><th className="px-4 py-3">Order</th><th className="px-4 py-3">Discount</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Date</th></tr></thead><tbody className="divide-y divide-slate-100">{snapshot.redemptions.map((redemption) => <tr key={redemption.id}><td className="px-4 py-3"><span className="rounded bg-slate-950 px-2 py-1 font-mono font-black text-white">{redemption.couponCode}</span></td><td className="px-4 py-3"><p className="font-bold">{redemption.candidateName}</p><p className="text-slate-400">{redemption.candidateEmail}</p></td><td className="px-4 py-3"><p className="font-bold">{redemption.course}</p><p className="text-slate-400">{redemption.examinationTitle}</p></td><td className="px-4 py-3 font-mono text-slate-500">{redemption.orderReference}</td><td className="px-4 py-3 font-black text-emerald-700">{formatMoney(redemption.discountAmountMinor, redemption.currency)}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${redemption.status === 'redeemed' ? 'bg-emerald-50 text-emerald-700' : redemption.status === 'reserved' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{redemption.status}</span></td><td className="px-4 py-3 text-slate-500">{new Date(redemption.redeemedAt || redemption.releasedAt || redemption.createdAt).toLocaleString()}</td></tr>)}</tbody></table>
                      {snapshot.redemptions.length === 0 && <div className="p-8 text-center text-sm text-slate-400">No coupon redemptions.</div>}
                    </section>
                  )}
                </>
              )}
            </main>
          </div>
        </div>
      )}
    </>
  );
}

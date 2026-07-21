import { type FormEvent, useEffect, useMemo, useState } from 'react';
import {
  BadgePercent,
  Banknote,
  BarChart3,
  CheckCircle2,
  CircleDollarSign,
  CreditCard,
  Loader2,
  Pencil,
  RefreshCw,
  Search,
  ShoppingCart,
  Tags,
  ToggleLeft,
  ToggleRight,
  X,
  XCircle,
  type LucideIcon,
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

type ConsoleTab = 'overview' | 'pricing' | 'coupons' | 'orders' | 'payments';

type SummaryCard = {
  label: string;
  value: number;
  icon: LucideIcon;
};

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

export default function AdminCommerceConsole() {
  const [isAuthorised, setIsAuthorised] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ConsoleTab>('overview');
  const [snapshot, setSnapshot] = useState<AdminCommerceSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [priceForm, setPriceForm] = useState(blankPriceForm);
  const [couponForm, setCouponForm] = useState(blankCouponForm);
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
      const next = await getAdminCommerceSnapshot(200);
      setSnapshot(next);
      setPriceForm((current) => ({
        ...current,
        examinationId: current.examinationId || next.examinations[0]?.id || '',
      }));
    } catch (snapshotError: unknown) {
      const text = snapshotError instanceof Error ? snapshotError.message : 'Unable to load commerce data.';
      setError(text);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) void loadSnapshot();
  }, [isOpen]);

  const savePrice = async (event: FormEvent<HTMLFormElement>) => {
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
          .map((code) => code.trim().toUpperCase())
          .filter(Boolean),
        isDefault: priceForm.isDefault,
        isActive: priceForm.isActive,
      });
      setMessage('Examination price saved.');
      await loadSnapshot();
    } catch (priceError: unknown) {
      setError(priceError instanceof Error ? priceError.message : 'The price could not be saved.');
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
    });
    setMessage(`${price.currency} price loaded for editing.`);
  };

  const togglePrice = async (price: AdminExamPrice) => {
    try {
      setIsLoading(true);
      await setExamPriceActive(price.id, !price.isActive);
      setMessage(`${price.currency} price ${price.isActive ? 'disabled' : 'enabled'}.`);
      await loadSnapshot();
    } catch (toggleError: unknown) {
      setError(toggleError instanceof Error ? toggleError.message : 'Unable to change price status.');
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
      setError('Enter a coupon code and a discount greater than zero.');
      return;
    }
    if (couponForm.discountType === 'fixed' && !couponForm.currency) {
      setError('Fixed-value coupons require a currency.');
      return;
    }
    if (couponForm.scope !== 'all' && !couponForm.targetId) {
      setError('Select the programme or examination to which the coupon applies.');
      return;
    }

    const discountValue =
      couponForm.discountType === 'percentage'
        ? parsedValue
        : majorToMinor(couponForm.discountValue, couponForm.currency);

    try {
      setIsLoading(true);
      await upsertCoupon({
        couponId: couponForm.couponId || null,
        code: couponForm.code,
        name: couponForm.name,
        description: couponForm.description,
        discountType: couponForm.discountType,
        discountValue,
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
      setMessage('Coupon saved.');
      await loadSnapshot();
    } catch (couponError: unknown) {
      setError(couponError instanceof Error ? couponError.message : 'The coupon could not be saved.');
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
      startsAt: toDateTimeLocal(coupon.startsAt),
      expiresAt: toDateTimeLocal(coupon.expiresAt),
      maximumRedemptions: coupon.maximumRedemptions ? String(coupon.maximumRedemptions) : '',
      perCandidateLimit: String(coupon.perCandidateLimit || 1),
      isActive: coupon.isActive,
    });
    setMessage(`Editing coupon ${coupon.code}.`);
  };

  const toggleCoupon = async (coupon: AdminCoupon) => {
    try {
      setIsLoading(true);
      await setCouponActive(coupon.id, !coupon.isActive);
      setMessage(`${coupon.code} ${coupon.isActive ? 'disabled' : 'enabled'}.`);
      await loadSnapshot();
    } catch (toggleError: unknown) {
      setError(toggleError instanceof Error ? toggleError.message : 'Unable to change coupon status.');
    } finally {
      setIsLoading(false);
    }
  };

  const cancelOrder = async (order: AdminExamOrder) => {
    const reason = window.prompt(
      `Reason for cancelling ${order.reference}:`,
      'Candidate requested cancellation',
    );
    if (reason === null) return;
    if (!window.confirm(`Cancel pending order ${order.reference}?`)) return;

    try {
      setIsLoading(true);
      await cancelExamOrder(order.id, reason);
      setMessage(`Order ${order.reference} cancelled.`);
      await loadSnapshot();
    } catch (cancelError: unknown) {
      setError(cancelError instanceof Error ? cancelError.message : 'Unable to cancel the order.');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredOrders = useMemo(() => {
    if (!snapshot) return [];
    const search = orderSearch.trim().toLowerCase();
    return snapshot.orders.filter((order) => {
      const statusMatch = orderStatus === 'all' || order.status === orderStatus;
      const searchMatch =
        !search ||
        order.reference.toLowerCase().includes(search) ||
        order.candidateName.toLowerCase().includes(search) ||
        order.candidateEmail.toLowerCase().includes(search) ||
        order.course.toLowerCase().includes(search);
      return statusMatch && searchMatch;
    });
  }, [snapshot, orderSearch, orderStatus]);

  if (!isAuthorised) return null;

  const tabs: Array<{ id: ConsoleTab; label: string; icon: LucideIcon }> = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'pricing', label: 'Pricing', icon: CircleDollarSign },
    { id: 'coupons', label: 'Coupons', icon: BadgePercent },
    { id: 'orders', label: 'Orders', icon: ShoppingCart },
    { id: 'payments', label: 'Payments', icon: CreditCard },
  ];

  const summaryCards: SummaryCard[] = snapshot
    ? [
        { label: 'Published Exams', value: snapshot.summary.publishedExaminations, icon: BarChart3 },
        { label: 'Active Prices', value: snapshot.summary.activePrices, icon: CircleDollarSign },
        { label: 'Active Coupons', value: snapshot.summary.activeCoupons, icon: BadgePercent },
        { label: 'Pending Orders', value: snapshot.summary.pendingOrders, icon: ShoppingCart },
        { label: 'Paid Orders', value: snapshot.summary.paidOrders, icon: CheckCircle2 },
        { label: 'Waived Orders', value: snapshot.summary.waivedOrders, icon: Tags },
        { label: 'Failed/Closed', value: snapshot.summary.failedOrders, icon: XCircle },
        { label: 'Payments', value: snapshot.payments.length, icon: CreditCard },
      ]
    : [];

  const configuredCurrencies = snapshot
    ? Array.from(
        new Set(snapshot.examinations.flatMap((exam) => exam.prices.map((price) => price.currency))),
      )
    : ['NGN'];

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-5 left-5 z-50 flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-extrabold text-white shadow-2xl hover:bg-slate-800"
      >
        <Banknote className="h-4 w-4 text-amber-400" /> Commerce Console
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[90] overflow-y-auto bg-slate-950/80 p-3 backdrop-blur-sm md:p-6">
          <div className="mx-auto min-h-[calc(100vh-1.5rem)] max-w-7xl overflow-hidden rounded-2xl bg-slate-50 shadow-2xl md:min-h-[calc(100vh-3rem)]">
            <header className="sticky top-0 z-20 flex items-center justify-between bg-slate-950 px-5 py-4 text-white">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-amber-400">
                  Protected Administrator Workspace
                </p>
                <h1 className="text-xl font-extrabold">Examination Commerce Console</h1>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void loadSnapshot()}
                  disabled={isLoading}
                  className="rounded-xl bg-slate-800 p-2 hover:bg-slate-700 disabled:opacity-50"
                  aria-label="Refresh commerce data"
                >
                  <RefreshCw className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
                  aria-label="Close commerce console"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </header>

            <nav className="sticky top-[72px] z-10 flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-4 py-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-extrabold ${
                      activeTab === tab.id
                        ? 'bg-slate-950 text-white'
                        : 'text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="h-4 w-4" /> {tab.label}
                  </button>
                );
              })}
            </nav>

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

              {isLoading && !snapshot ? (
                <div className="grid min-h-[420px] place-items-center text-slate-500">
                  <Loader2 className="h-9 w-9 animate-spin text-emerald-600" />
                </div>
              ) : !snapshot ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
                  Run migration 012, then refresh this console.
                </div>
              ) : (
                <>
                  {activeTab === 'overview' && (
                    <section className="space-y-6">
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {summaryCards.map((card) => {
                          const Icon = card.icon;
                          return (
                            <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-extrabold uppercase text-slate-500">{card.label}</p>
                                <Icon className="h-5 w-5 text-emerald-600" />
                              </div>
                              <p className="mt-3 text-3xl font-black text-slate-950">{card.value}</p>
                            </div>
                          );
                        })}
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <h2 className="font-extrabold text-slate-950">Verified Revenue by Currency</h2>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          {snapshot.summary.paidByCurrency.length === 0 ? (
                            <p className="text-sm text-slate-400">No verified paid transactions yet.</p>
                          ) : (
                            snapshot.summary.paidByCurrency.map((item) => (
                              <div key={item.currency} className="rounded-xl bg-slate-950 p-4 text-white">
                                <p className="text-xs font-bold text-slate-400">{item.currency}</p>
                                <p className="mt-1 text-xl font-black">{formatMoney(item.amountMinor, item.currency)}</p>
                                <p className="text-xs text-emerald-400">{item.transactions} transaction(s)</p>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </section>
                  )}

                  {activeTab === 'pricing' && (
                    <section className="grid gap-6 lg:grid-cols-[360px_1fr]">
                      <form onSubmit={savePrice} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <h2 className="text-lg font-extrabold text-slate-950">Add or Update Price</h2>
                        <label className="block text-xs font-bold text-slate-600">
                          Examination
                          <select
                            value={priceForm.examinationId}
                            onChange={(event) => setPriceForm((current) => ({ ...current, examinationId: event.target.value }))}
                            className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                          >
                            {snapshot.examinations.map((exam) => (
                              <option key={exam.id} value={exam.id}>{exam.course} — {exam.title}</option>
                            ))}
                          </select>
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <label className="text-xs font-bold text-slate-600">
                            Currency
                            <input
                              value={priceForm.currency}
                              maxLength={3}
                              onChange={(event) => setPriceForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))}
                              className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 uppercase"
                            />
                          </label>
                          <label className="text-xs font-bold text-slate-600">
                            Amount
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={priceForm.amountMajor}
                              onChange={(event) => setPriceForm((current) => ({ ...current, amountMajor: event.target.value }))}
                              className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5"
                            />
                          </label>
                        </div>
                        <label className="block text-xs font-bold text-slate-600">
                          Country routing codes
                          <input
                            value={priceForm.countryCodes}
                            onChange={(event) => setPriceForm((current) => ({ ...current, countryCodes: event.target.value.toUpperCase() }))}
                            placeholder="NG, GH, KE"
                            className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 uppercase"
                          />
                        </label>
                        <div className="flex gap-4 rounded-xl bg-slate-50 p-3 text-xs font-bold">
                          <label className="flex items-center gap-2">
                            <input type="checkbox" checked={priceForm.isDefault} onChange={(event) => setPriceForm((current) => ({ ...current, isDefault: event.target.checked }))} /> Default
                          </label>
                          <label className="flex items-center gap-2">
                            <input type="checkbox" checked={priceForm.isActive} onChange={(event) => setPriceForm((current) => ({ ...current, isActive: event.target.checked }))} /> Active
                          </label>
                        </div>
                        <button disabled={isLoading} className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-extrabold text-white disabled:opacity-50">
                          Save Price
                        </button>
                      </form>

                      <div className="space-y-4">
                        {snapshot.examinations.map((exam) => (
                          <article key={exam.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                            <p className="text-xs font-extrabold text-emerald-600">{exam.course}</p>
                            <h3 className="font-extrabold text-slate-950">{exam.title}</h3>
                            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                              {exam.prices.length === 0 ? (
                                <p className="text-sm text-amber-600">No price configured.</p>
                              ) : (
                                exam.prices.map((price) => (
                                  <div key={price.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                    <div className="flex justify-between gap-2">
                                      <div>
                                        <p className="text-xs font-black text-slate-500">{price.currency}{price.isDefault ? ' • DEFAULT' : ''}</p>
                                        <p className="text-lg font-black text-slate-950">{formatMoney(price.amountMinor, price.currency)}</p>
                                      </div>
                                      <button type="button" onClick={() => void togglePrice(price)}>
                                        {price.isActive ? <ToggleRight className="h-6 w-6 text-emerald-600" /> : <ToggleLeft className="h-6 w-6 text-slate-400" />}
                                      </button>
                                    </div>
                                    <p className="mt-2 text-xs text-slate-500">Routes: {price.countryCodes?.join(', ') || 'Manual'}</p>
                                    <button type="button" onClick={() => editPrice(exam.id, price)} className="mt-3 flex items-center gap-1 text-xs font-bold text-emerald-700">
                                      <Pencil className="h-3.5 w-3.5" /> Edit
                                    </button>
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
                    <section className="grid gap-6 xl:grid-cols-[390px_1fr]">
                      <form onSubmit={saveCoupon} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex items-center justify-between">
                          <h2 className="text-lg font-extrabold text-slate-950">{couponForm.couponId ? 'Edit Coupon' : 'Create Coupon'}</h2>
                          {couponForm.couponId && (
                            <button type="button" onClick={() => setCouponForm(blankCouponForm)} className="text-xs font-bold text-slate-500">New</button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <label className="text-xs font-bold text-slate-600">Code<input value={couponForm.code} onChange={(event) => setCouponForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 uppercase" /></label>
                          <label className="text-xs font-bold text-slate-600">Name<input value={couponForm.name} onChange={(event) => setCouponForm((current) => ({ ...current, name: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
                        </div>
                        <label className="block text-xs font-bold text-slate-600">Description<textarea value={couponForm.description} onChange={(event) => setCouponForm((current) => ({ ...current, description: event.target.value }))} rows={2} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
                        <div className="grid grid-cols-3 gap-3">
                          <label className="text-xs font-bold text-slate-600">Type<select value={couponForm.discountType} onChange={(event) => setCouponForm((current) => ({ ...current, discountType: event.target.value as 'percentage' | 'fixed' }))} className="mt-1.5 w-full rounded-xl border border-slate-300 px-2 py-2.5"><option value="percentage">%</option><option value="fixed">Fixed</option></select></label>
                          <label className="text-xs font-bold text-slate-600">Value<input type="number" min="0" step="0.01" value={couponForm.discountValue} onChange={(event) => setCouponForm((current) => ({ ...current, discountValue: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
                          <label className="text-xs font-bold text-slate-600">Currency<select value={couponForm.currency} onChange={(event) => setCouponForm((current) => ({ ...current, currency: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-300 px-2 py-2.5"><option value="">Any</option>{configuredCurrencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}</select></label>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <label className="text-xs font-bold text-slate-600">Scope<select value={couponForm.scope} onChange={(event) => setCouponForm((current) => ({ ...current, scope: event.target.value as 'all' | 'programme' | 'examination', targetId: '' }))} className="mt-1.5 w-full rounded-xl border border-slate-300 px-2 py-2.5"><option value="all">All</option><option value="programme">Programme</option><option value="examination">Examination</option></select></label>
                          {couponForm.scope !== 'all' && (
                            <label className="text-xs font-bold text-slate-600">Target<select value={couponForm.targetId} onChange={(event) => setCouponForm((current) => ({ ...current, targetId: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-300 px-2 py-2.5"><option value="">Select…</option>{couponForm.scope === 'programme' ? snapshot.programmes.map((programme) => <option key={programme.id} value={programme.id}>{programme.code}</option>) : snapshot.examinations.map((exam) => <option key={exam.id} value={exam.id}>{exam.course}</option>)}</select></label>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <label className="text-xs font-bold text-slate-600">Starts<input type="datetime-local" value={couponForm.startsAt} onChange={(event) => setCouponForm((current) => ({ ...current, startsAt: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-300 px-2 py-2.5 text-xs" /></label>
                          <label className="text-xs font-bold text-slate-600">Expires<input type="datetime-local" value={couponForm.expiresAt} onChange={(event) => setCouponForm((current) => ({ ...current, expiresAt: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-300 px-2 py-2.5 text-xs" /></label>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <label className="text-xs font-bold text-slate-600">Total limit<input type="number" min="1" value={couponForm.maximumRedemptions} onChange={(event) => setCouponForm((current) => ({ ...current, maximumRedemptions: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
                          <label className="text-xs font-bold text-slate-600">Per candidate<input type="number" min="1" value={couponForm.perCandidateLimit} onChange={(event) => setCouponForm((current) => ({ ...current, perCandidateLimit: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
                        </div>
                        <label className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-xs font-bold"><input type="checkbox" checked={couponForm.isActive} onChange={(event) => setCouponForm((current) => ({ ...current, isActive: event.target.checked }))} /> Active</label>
                        <button disabled={isLoading} className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-extrabold text-white disabled:opacity-50">Save Coupon</button>
                      </form>

                      <div className="space-y-3">
                        {snapshot.coupons.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">No coupons configured.</div>
                        ) : (
                          snapshot.coupons.map((coupon) => (
                            <article key={coupon.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <span className="rounded bg-slate-950 px-2 py-1 font-mono text-xs font-black text-white">{coupon.code}</span>
                                  <h3 className="mt-2 font-extrabold text-slate-950">{coupon.name || 'Untitled Coupon'}</h3>
                                  <p className="text-xs text-slate-500">{coupon.scope} • {coupon.currency || 'Any currency'}</p>
                                </div>
                                <div className="flex gap-2">
                                  <button type="button" onClick={() => editCoupon(coupon)} className="rounded-lg border p-2"><Pencil className="h-4 w-4" /></button>
                                  <button type="button" onClick={() => void toggleCoupon(coupon)} className="rounded-lg border p-2">{coupon.isActive ? <ToggleRight className="h-5 w-5 text-emerald-600" /> : <ToggleLeft className="h-5 w-5 text-slate-400" />}</button>
                                </div>
                              </div>
                              <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                                <div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-bold text-slate-400">DISCOUNT</p><p className="font-black">{coupon.discountType === 'percentage' ? `${coupon.discountValue}%` : formatMoney(coupon.discountValue, coupon.currency || 'NGN')}</p></div>
                                <div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-bold text-slate-400">REDEEMED</p><p className="font-black text-emerald-700">{coupon.redeemedCount}</p></div>
                                <div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-bold text-slate-400">RESERVED</p><p className="font-black text-amber-700">{coupon.reservedCount}</p></div>
                              </div>
                            </article>
                          ))
                        )}
                      </div>
                    </section>
                  )}

                  {activeTab === 'orders' && (
                    <section className="space-y-4">
                      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row">
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                          <input value={orderSearch} onChange={(event) => setOrderSearch(event.target.value)} placeholder="Search reference, candidate or course" className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 text-sm" />
                        </div>
                        <select value={orderStatus} onChange={(event) => setOrderStatus(event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-bold">
                          <option value="all">All statuses</option>
                          {['pending', 'paid', 'waived', 'failed', 'cancelled', 'expired', 'refunded'].map((status) => <option key={status} value={status}>{status.toUpperCase()}</option>)}
                        </select>
                      </div>
                      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                        <table className="min-w-full text-left text-xs">
                          <thead className="bg-slate-950 text-white"><tr><th className="px-4 py-3">Reference</th><th className="px-4 py-3">Candidate</th><th className="px-4 py-3">Exam</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Action</th></tr></thead>
                          <tbody className="divide-y divide-slate-100">
                            {filteredOrders.map((order) => (
                              <tr key={order.id}>
                                <td className="px-4 py-3 font-mono font-bold">{order.reference}</td>
                                <td className="px-4 py-3"><p className="font-bold">{order.candidateName}</p><p className="text-slate-400">{order.candidateEmail}</p></td>
                                <td className="px-4 py-3"><p className="font-bold">{order.course}</p><p className="text-slate-400">{order.examinationTitle}</p></td>
                                <td className="px-4 py-3 font-black">{formatMoney(order.payableAmountMinor, order.currency)}</td>
                                <td className="px-4 py-3 font-bold uppercase">{order.status}</td>
                                <td className="px-4 py-3">{order.status === 'pending' ? <button type="button" onClick={() => void cancelOrder(order)} className="rounded-lg border border-rose-200 px-2 py-1 font-bold text-rose-600">Cancel</button> : '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {filteredOrders.length === 0 && <div className="p-8 text-center text-sm text-slate-400">No matching orders.</div>}
                      </div>
                    </section>
                  )}

                  {activeTab === 'payments' && (
                    <section className="space-y-6">
                      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                        <div className="border-b p-4"><h2 className="font-extrabold text-slate-950">Payment Records</h2></div>
                        <table className="min-w-full text-left text-xs"><thead className="bg-slate-950 text-white"><tr><th className="px-4 py-3">Reference</th><th className="px-4 py-3">Candidate</th><th className="px-4 py-3">Exam</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Provider ID</th></tr></thead><tbody className="divide-y divide-slate-100">{snapshot.payments.map((payment) => <tr key={payment.id}><td className="px-4 py-3 font-mono font-bold">{payment.reference}</td><td className="px-4 py-3"><p className="font-bold">{payment.candidateName}</p><p className="text-slate-400">{payment.candidateEmail}</p></td><td className="px-4 py-3">{payment.course}</td><td className="px-4 py-3 font-black">{formatMoney(payment.amountMinor, payment.currency)}</td><td className="px-4 py-3 font-bold uppercase">{payment.status}</td><td className="px-4 py-3 font-mono text-slate-500">{payment.providerTransactionId || 'Pending'}</td></tr>)}</tbody></table>
                        {snapshot.payments.length === 0 && <div className="p-8 text-center text-sm text-slate-400">No payment records.</div>}
                      </div>

                      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                        <div className="border-b p-4"><h2 className="font-extrabold text-slate-950">Coupon Redemptions</h2></div>
                        <table className="min-w-full text-left text-xs"><thead className="bg-slate-950 text-white"><tr><th className="px-4 py-3">Coupon</th><th className="px-4 py-3">Candidate</th><th className="px-4 py-3">Exam</th><th className="px-4 py-3">Discount</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Order</th></tr></thead><tbody className="divide-y divide-slate-100">{snapshot.redemptions.map((redemption) => <tr key={redemption.id}><td className="px-4 py-3 font-mono font-black">{redemption.couponCode}</td><td className="px-4 py-3"><p className="font-bold">{redemption.candidateName}</p><p className="text-slate-400">{redemption.candidateEmail}</p></td><td className="px-4 py-3">{redemption.course}</td><td className="px-4 py-3 font-black text-emerald-700">{formatMoney(redemption.discountAmountMinor, redemption.currency)}</td><td className="px-4 py-3 font-bold uppercase">{redemption.status}</td><td className="px-4 py-3 font-mono text-slate-500">{redemption.orderReference}</td></tr>)}</tbody></table>
                        {snapshot.redemptions.length === 0 && <div className="p-8 text-center text-sm text-slate-400">No coupon redemptions.</div>}
                      </div>
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

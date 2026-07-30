import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  History,
  Loader2,
  LockKeyhole,
  RefreshCw,
  ShoppingCart,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getCurrentPortalUser } from '../services/authService';
import {
  getMyExamBulkOrders,
  getMyExamCart,
  initializeExamCartPayment,
  quoteMyExamCart,
  setMyExamCartItem,
  type ExamBulkOrder,
  type ExamCart,
  type ExamCartQuote,
} from '../services/cartCommerceService';
import { getAvailableTests } from '../services/examService';
import type { Test } from '../types';

type CataloguePrice = {
  id: string;
  currency: string;
  amountMinor: number;
  isDefault?: boolean;
};

type CartCatalogueTest = Test & {
  canLaunch?: boolean;
  accessStatus?: string;
  requiresPayment?: boolean;
  prices?: CataloguePrice[];
  defaultPrice?: CataloguePrice | null;
};

const formatMinor = (amountMinor: number, currency: string): string => {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amountMinor / 100);
  } catch {
    return `${currency} ${(amountMinor / 100).toLocaleString()}`;
  }
};

const moduleCode = (title: string): string => title.match(/CIPMN-MOD-\d{3}/i)?.[0] || 'CIPMN';

export default function CandidateCipmnModuleCart() {
  const [isCandidate, setIsCandidate] = useState(false);
  const [menuRoot, setMenuRoot] = useState<HTMLElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [catalogue, setCatalogue] = useState<CartCatalogueTest[]>([]);
  const [cart, setCart] = useState<ExamCart | null>(null);
  const [quote, setQuote] = useState<ExamCartQuote | null>(null);
  const [orders, setOrders] = useState<ExamBulkOrder[]>([]);
  const [currency, setCurrency] = useState('NGN');
  const [couponCode, setCouponCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  const cipmnModules = useMemo(
    () => catalogue.filter((test) => test.course === 'CIPMN-MOCK').sort((a, b) => a.title.localeCompare(b.title)),
    [catalogue],
  );
  const selectedIds = useMemo(
    () => new Set((cart?.items || []).map((item) => item.examinationId)),
    [cart],
  );
  const selectedModules = useMemo(
    () => cipmnModules.filter((test) => selectedIds.has(test.id)),
    [cipmnModules, selectedIds],
  );
  const currencies = useMemo(() => {
    const source = selectedModules.length > 0 ? selectedModules : cipmnModules;
    const values = new Set<string>();
    source.forEach((test) => {
      (test.prices || []).forEach((price) => values.add(price.currency));
      if (test.defaultPrice?.currency) values.add(test.defaultPrice.currency);
    });
    if (values.size === 0) values.add('NGN');
    return Array.from(values).sort((a, b) => (a === 'NGN' ? -1 : b === 'NGN' ? 1 : a.localeCompare(b)));
  }, [cipmnModules, selectedModules]);

  const refreshAuthorisation = async () => {
    try {
      const current = await getCurrentPortalUser();
      const candidate = current?.profile.role === 'candidate';
      setIsCandidate(candidate);
      if (!candidate) {
        setIsOpen(false);
        setCart(null);
        setCatalogue([]);
      }
    } catch {
      setIsCandidate(false);
      setIsOpen(false);
      setCart(null);
      setCatalogue([]);
    }
  };

  const loadWorkspace = async () => {
    try {
      setLoading(true);
      setError('');
      const [tests, currentCart, history] = await Promise.all([
        getAvailableTests() as Promise<CartCatalogueTest[]>,
        getMyExamCart(),
        getMyExamBulkOrders(),
      ]);
      setCatalogue(tests);
      setCart(currentCart);
      setCurrency(currentCart.currency || 'NGN');
      setCouponCode(currentCart.couponCode || '');
      setOrders(history);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load the CIPMN module cart.');
    } finally {
      setLoading(false);
    }
  };

  const openCart = () => {
    if (!isCandidate) return;
    setIsOpen(true);
    setMessage('');
    setError('');
    void loadWorkspace();
  };

  const toggleModule = async (test: CartCatalogueTest, selected: boolean) => {
    try {
      setUpdatingId(test.id);
      setError('');
      setMessage('');
      setQuote(null);
      const updated = await setMyExamCartItem({ examinationId: test.id, selected });
      setCart(updated);
      if (!selected) setMessage(`${moduleCode(test.title)} removed from the cart.`);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to update the examination cart.');
    } finally {
      setUpdatingId(null);
    }
  };

  const updateQuote = async () => {
    try {
      setQuoting(true);
      setError('');
      setMessage('');
      const result = await quoteMyExamCart({ currency, couponCode });
      setQuote(result);
      const refreshedCart = await getMyExamCart();
      setCart(refreshedCart);
      if (result.status === 'existing_order') {
        setMessage('Your existing secure bulk payment order is still active and has been restored.');
      }
    } catch (quoteError) {
      setQuote(null);
      setError(quoteError instanceof Error ? quoteError.message : 'Unable to calculate the consolidated price.');
    } finally {
      setQuoting(false);
    }
  };

  const checkout = async () => {
    try {
      setCheckingOut(true);
      setError('');
      setMessage('');
      const order = await initializeExamCartPayment({ currency, couponCode });

      if (order.paymentRequired && order.authorizationUrl && order.reference) {
        sessionStorage.setItem('iipm_pending_payment_reference', order.reference);
        sessionStorage.setItem('iipm_pending_payment_kind', 'exam_bulk');
        window.location.assign(order.authorizationUrl);
        return;
      }

      if (order.status === 'fulfilled') {
        setMessage('All selected modules have been unlocked successfully.');
        setQuote(null);
        await loadWorkspace();
        window.dispatchEvent(new Event('iipm-commerce-refresh'));
        return;
      }

      throw new Error('The consolidated checkout did not return a secure payment route.');
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : 'Unable to create the consolidated payment order.');
    } finally {
      setCheckingOut(false);
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
    if (!isCandidate) {
      setMenuRoot(null);
      return;
    }

    const attach = () => {
      const nav = document.querySelector<HTMLElement>('header nav');
      if (!nav) {
        setMenuRoot(null);
        return;
      }
      let mount = nav.querySelector<HTMLElement>('[data-agilecert-cipmn-cart-mount="true"]');
      if (!mount) {
        mount = document.createElement('div');
        mount.dataset.agilecertCipmnCartMount = 'true';
        mount.className = 'relative';
        nav.appendChild(mount);
      }
      setMenuRoot(mount);
    };

    attach();
    const observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [isCandidate]);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !checkingOut) setIsOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [checkingOut, isOpen]);

  useEffect(() => {
    if (!currencies.includes(currency)) {
      setCurrency(currencies[0] || 'NGN');
      setQuote(null);
    }
  }, [currencies, currency]);

  if (!isCandidate) return null;

  const launcher = menuRoot
    ? createPortal(
        <button
          type="button"
          onClick={openCart}
          className="relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-slate-400 transition hover:bg-slate-800 hover:text-white"
          aria-label="Open CIPMN multi-module cart"
        >
          <ShoppingCart className="h-3.5 w-3.5 text-emerald-300" />
          <span className="hidden xl:inline">Cart</span>
          {(cart?.itemCount || 0) > 0 && (
            <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-emerald-500 px-1 text-center text-[9px] font-black leading-4 text-white">
              {cart?.itemCount}
            </span>
          )}
        </button>,
        menuRoot,
      )
    : null;

  return (
    <>
      {launcher}
      {isOpen && (
        <div className="fixed inset-0 z-[130] overflow-y-auto bg-slate-950/80 p-3 backdrop-blur-sm md:p-6">
          <section ref={panelRef} className="mx-auto w-full max-w-7xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <header className="flex items-start justify-between gap-4 bg-slate-950 px-5 py-5 text-white md:px-8">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-600">
                  <ShoppingCart className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">CIPMN bulk checkout</p>
                  <h2 className="text-xl font-black md:text-2xl">Select and pay for multiple modules</h2>
                  <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-300">
                    Build one secure cart, apply an eligible coupon and complete one Paystack transaction for all selected modules.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={checkingOut}
                className="rounded-xl border border-slate-700 p-2 text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-50"
                aria-label="Close CIPMN module cart"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="space-y-5 p-5 md:p-8">
              {error && (
                <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
                </div>
              )}
              {message && (
                <div className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> {message}
                </div>
              )}

              {loading ? (
                <div className="flex min-h-64 items-center justify-center text-slate-500">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading the secure module cart…
                </div>
              ) : (
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(330px,0.85fr)]">
                  <div className="space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <h3 className="text-lg font-black text-slate-900">Available CIPMN modules</h3>
                        <p className="mt-1 text-sm text-slate-600">
                          Already unlocked modules are excluded automatically. The existing single-module checkout remains available in the catalogue.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void loadWorkspace()}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50"
                      >
                        <RefreshCw className="h-4 w-4" /> Refresh
                      </button>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      {cipmnModules.map((test) => {
                        const selected = selectedIds.has(test.id);
                        const locked = test.canLaunch || test.accessStatus === 'unlocked';
                        const price = (test.prices || []).find((item) => item.currency === currency) || test.defaultPrice;
                        return (
                          <article
                            key={test.id}
                            className={`rounded-2xl border p-4 transition ${
                              locked
                                ? 'border-slate-200 bg-slate-50 opacity-70'
                                : selected
                                  ? 'border-emerald-400 bg-emerald-50 shadow-sm'
                                  : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <span className="rounded-lg bg-slate-900 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-white">
                                  {moduleCode(test.title)}
                                </span>
                                <h4 className="mt-3 text-sm font-black leading-6 text-slate-900">{test.title}</h4>
                              </div>
                              {locked ? (
                                <span className="rounded-full bg-emerald-100 p-2 text-emerald-700" title="Already unlocked">
                                  <Check className="h-4 w-4" />
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => void toggleModule(test, !selected)}
                                  disabled={updatingId === test.id}
                                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition disabled:opacity-50 ${
                                    selected
                                      ? 'border-emerald-600 bg-emerald-600 text-white'
                                      : 'border-slate-300 bg-white text-slate-600 hover:border-emerald-500 hover:text-emerald-700'
                                  }`}
                                  aria-label={selected ? `Remove ${test.title} from cart` : `Add ${test.title} to cart`}
                                >
                                  {updatingId === test.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : selected ? (
                                    <Check className="h-4 w-4" />
                                  ) : (
                                    <ShoppingCart className="h-4 w-4" />
                                  )}
                                </button>
                              )}
                            </div>
                            <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-3 text-xs">
                              <span className="text-slate-500">{test.questionCount} questions · {test.durationMinutes} mins</span>
                              <span className="font-black text-slate-900">
                                {locked ? 'Unlocked' : price ? formatMinor(price.amountMinor, price.currency) : 'Price unavailable'}
                              </span>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </div>

                  <aside className="space-y-4">
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-black uppercase tracking-wider text-slate-500">Your cart</p>
                          <h3 className="mt-1 text-xl font-black text-slate-950">
                            {cart?.itemCount || 0} module{cart?.itemCount === 1 ? '' : 's'}
                          </h3>
                        </div>
                        <div className="rounded-2xl bg-slate-950 p-3 text-emerald-300">
                          <ShoppingCart className="h-5 w-5" />
                        </div>
                      </div>

                      <div className="mt-4 max-h-56 space-y-2 overflow-y-auto pr-1">
                        {selectedModules.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-center text-sm text-slate-500">
                            Select two or more modules for the greatest checkout convenience.
                          </div>
                        ) : (
                          selectedModules.map((test) => (
                            <div key={test.id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3">
                              <div>
                                <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">{moduleCode(test.title)}</p>
                                <p className="mt-1 text-xs font-bold leading-5 text-slate-800">{test.title}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => void toggleModule(test, false)}
                                disabled={updatingId === test.id}
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
                                aria-label={`Remove ${test.title}`}
                              >
                                {updatingId === test.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                              </button>
                            </div>
                          ))
                        )}
                      </div>

                      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                        <label className="text-xs font-black text-slate-700">
                          Currency
                          <div className="relative mt-1">
                            <select
                              value={currency}
                              onChange={(event) => {
                                setCurrency(event.target.value);
                                setQuote(null);
                              }}
                              className="w-full appearance-none rounded-xl border border-slate-300 bg-white px-3 py-2.5 pr-9 text-sm font-bold text-slate-900 outline-none focus:border-emerald-500"
                            >
                              {currencies.map((value) => <option key={value} value={value}>{value}</option>)}
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-slate-400" />
                          </div>
                        </label>
                        <label className="text-xs font-black text-slate-700">
                          Coupon
                          <div className="relative mt-1">
                            <Tag className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                            <input
                              value={couponCode}
                              onChange={(event) => {
                                setCouponCode(event.target.value.toUpperCase());
                                setQuote(null);
                              }}
                              placeholder="Optional code"
                              className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm font-bold uppercase text-slate-900 outline-none focus:border-emerald-500"
                            />
                          </div>
                        </label>
                      </div>

                      <button
                        type="button"
                        onClick={() => void updateQuote()}
                        disabled={!cart?.itemCount || quoting || checkingOut}
                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-800 transition hover:border-emerald-500 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {quoting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                        Calculate Secure Total
                      </button>
                    </div>

                    {quote && (
                      <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between gap-4 text-slate-700">
                            <span>Module total</span>
                            <strong>{formatMinor(quote.listAmountMinor, quote.currency)}</strong>
                          </div>
                          <div className="flex justify-between gap-4 text-emerald-800">
                            <span>Discount</span>
                            <strong>−{formatMinor(quote.discountAmountMinor, quote.currency)}</strong>
                          </div>
                          <div className="border-t border-emerald-200 pt-3">
                            <div className="flex items-end justify-between gap-4">
                              <span className="font-black text-slate-900">Amount payable</span>
                              <strong className="text-2xl font-black text-emerald-800">
                                {formatMinor(quote.payableAmountMinor, quote.currency)}
                              </strong>
                            </div>
                            {quote.couponCode && (
                              <p className="mt-2 text-xs font-bold text-emerald-700">Coupon applied: {quote.couponCode}</p>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => void checkout()}
                          disabled={checkingOut || quote.quotedItemCount === 0}
                          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3.5 text-sm font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {checkingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : quote.payableAmountMinor > 0 ? <CreditCard className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                          {quote.payableAmountMinor > 0 ? 'Create One Secure Payment Order' : 'Unlock Selected Modules'}
                        </button>

                        <div className="mt-4 flex items-start gap-2 text-xs leading-5 text-emerald-900">
                          <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />
                          One Paystack reference covers the complete cart. Each module still receives its own authoritative access and audit record.
                        </div>
                      </div>
                    )}

                    {orders.length > 0 && (
                      <div className="rounded-3xl border border-slate-200 bg-white p-5">
                        <div className="flex items-center gap-2">
                          <History className="h-4 w-4 text-slate-500" />
                          <h3 className="text-sm font-black text-slate-900">Recent bulk orders</h3>
                        </div>
                        <div className="mt-3 space-y-2">
                          {orders.slice(0, 4).map((order) => (
                            <div key={order.bulkOrderId} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                              <div className="flex items-center justify-between gap-3">
                                <span className="font-mono text-[10px] font-bold text-slate-500">{order.reference}</span>
                                <span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${
                                  order.status === 'fulfilled'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : order.status === 'partially_fulfilled'
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-slate-200 text-slate-700'
                                }`}>
                                  {order.status.replaceAll('_', ' ')}
                                </span>
                              </div>
                              <p className="mt-2 text-xs font-bold text-slate-800">
                                {order.itemCount} modules · {formatMinor(order.payableAmountMinor, order.currency)}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </aside>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

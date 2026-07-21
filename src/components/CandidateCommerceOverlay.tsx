import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, CreditCard, Loader2, LockKeyhole, Tag, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getCurrentPortalUser } from '../services/authService';
import { getAvailableTests } from '../services/examService';
import {
  createExamOrder,
  quoteExamPurchase,
  type ExamOrder,
  type ExamPrice,
  type PurchaseQuote,
} from '../services/commerceService';
import type { Test } from '../types';

type CommerceTest = Test & {
  requiresPayment?: boolean;
  canLaunch?: boolean;
  accessStatus?: 'locked' | 'unlocked' | 'completed' | 'expired' | 'staff_view';
  defaultPrice?: ExamPrice | null;
  prices?: ExamPrice[];
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
    }).format(amountMinor / divisor);
  } catch {
    return `${currency} ${(amountMinor / divisor).toLocaleString()}`;
  }
};

const inferCountryCode = (): string => {
  if (typeof navigator === 'undefined') return '';
  const locale = navigator.language || '';
  const region = locale.split('-')[1];
  return region ? region.toUpperCase() : '';
};

const chooseInitialCurrency = (test: CommerceTest): string => {
  const prices = test.prices || [];
  const countryCode = inferCountryCode();
  const routed = prices.find((price) =>
    (price.countryCodes || []).map((code) => code.toUpperCase()).includes(countryCode),
  );

  return routed?.currency || test.defaultPrice?.currency || prices[0]?.currency || 'NGN';
};

export default function CandidateCommerceOverlay() {
  const [isCandidate, setIsCandidate] = useState(false);
  const [tests, setTests] = useState<CommerceTest[]>([]);
  const [selectedTest, setSelectedTest] = useState<CommerceTest | null>(null);
  const [currency, setCurrency] = useState('NGN');
  const [couponCode, setCouponCode] = useState('');
  const [quote, setQuote] = useState<PurchaseQuote | null>(null);
  const [order, setOrder] = useState<ExamOrder | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const refreshCatalogue = async () => {
    try {
      const current = await getCurrentPortalUser();
      const candidate = current?.profile.role === 'candidate';
      setIsCandidate(candidate);

      if (!candidate) {
        setTests([]);
        return;
      }

      const catalogue = (await getAvailableTests()) as CommerceTest[];
      setTests(catalogue);
    } catch (refreshError) {
      console.error('Unable to refresh examination commerce catalogue:', refreshError);
      setIsCandidate(false);
      setTests([]);
    }
  };

  useEffect(() => {
    void refreshCatalogue();

    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      window.setTimeout(() => void refreshCatalogue(), 0);
    });

    const refreshHandler = () => void refreshCatalogue();
    window.addEventListener('iipm-commerce-refresh', refreshHandler);

    return () => {
      authListener.subscription.unsubscribe();
      window.removeEventListener('iipm-commerce-refresh', refreshHandler);
    };
  }, []);

  useEffect(() => {
    if (!isCandidate || tests.length === 0) return;

    const attached = new Map<HTMLElement, EventListener>();
    let scheduled = false;

    const applyCommerceState = () => {
      scheduled = false;

      tests.forEach((test) => {
        const card = document.getElementById(`exam-card-${test.id}`);
        if (!card) return;

        const button = card.querySelector('button') as HTMLButtonElement | null;
        if (!button) return;

        const buttonParent = button.parentElement;
        if (!buttonParent) return;

        let statusPanel = buttonParent.querySelector(
          `[data-iipm-commerce-status="${test.id}"]`,
        ) as HTMLDivElement | null;

        if (!statusPanel) {
          statusPanel = document.createElement('div');
          statusPanel.dataset.iipmCommerceStatus = test.id;
          statusPanel.className =
            'mb-2 rounded-lg border px-3 py-2 text-center text-[11px] font-extrabold leading-tight';
          buttonParent.insertBefore(statusPanel, button);
        }

        const price = test.defaultPrice || test.prices?.[0] || null;
        const priceLabel = price ? formatMoney(price.amountMinor, price.currency) : 'Price unavailable';
        const unlocked = Boolean(test.canLaunch);

        const desiredPanelText = unlocked
          ? '✓ Examination Unlocked'
          : `🔒 Payment Required • ${priceLabel}`;

        if (statusPanel.textContent !== desiredPanelText) {
          statusPanel.textContent = desiredPanelText;
        }

        const desiredPanelClass = unlocked
          ? 'mb-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-center text-[11px] font-extrabold leading-tight text-emerald-700'
          : 'mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-center text-[11px] font-extrabold leading-tight text-amber-800';

        if (statusPanel.className !== desiredPanelClass) {
          statusPanel.className = desiredPanelClass;
        }

        if (!button.dataset.iipmOriginalLabel) {
          button.dataset.iipmOriginalLabel = button.textContent?.trim() || 'Launch Secured Session';
          button.dataset.iipmOriginalClass = button.className;
        }

        const existingHandler = attached.get(button);
        if (existingHandler) {
          button.removeEventListener('click', existingHandler, true);
          attached.delete(button);
        }

        if (unlocked) {
          if (button.textContent?.trim() === 'Pay and Unlock' || button.textContent?.trim() === 'Pay for Re-take') {
            button.textContent = button.dataset.iipmOriginalLabel || 'Launch Secured Session';
          }
          if (button.dataset.iipmOriginalClass) {
            button.className = button.dataset.iipmOriginalClass;
          }
          return;
        }

        const isCompleted = Boolean(card.textContent?.includes('Exam Completed'));
        const desiredButtonText = isCompleted ? 'Pay for Re-take' : 'Pay and Unlock';
        if (button.textContent?.trim() !== desiredButtonText) {
          button.textContent = desiredButtonText;
        }
        button.className =
          'px-4 py-2 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 whitespace-nowrap bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-sm hover:shadow';

        const lockedHandler: EventListener = (event) => {
          event.preventDefault();
          event.stopPropagation();
          if ('stopImmediatePropagation' in event) event.stopImmediatePropagation();
          setSelectedTest(test);
          setCurrency(chooseInitialCurrency(test));
          setCouponCode('');
          setQuote(null);
          setOrder(null);
          setError('');
          setMessage('');
        };

        button.addEventListener('click', lockedHandler, true);
        attached.set(button, lockedHandler);
      });
    };

    const scheduleApply = () => {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(applyCommerceState);
    };

    scheduleApply();
    const observer = new MutationObserver(scheduleApply);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      attached.forEach((handler, element) => {
        element.removeEventListener('click', handler, true);
      });
    };
  }, [isCandidate, tests]);

  useEffect(() => {
    if (!selectedTest) return;
    setCurrency(chooseInitialCurrency(selectedTest));
    setQuote(null);
    setOrder(null);
    setError('');
    setMessage('');
  }, [selectedTest?.id]);

  const availablePrices = selectedTest?.prices || [];
  const currentPrice = useMemo(
    () =>
      availablePrices.find((price) => price.currency === currency) ||
      selectedTest?.defaultPrice ||
      availablePrices[0] ||
      null,
    [availablePrices, currency, selectedTest?.defaultPrice],
  );

  const closeModal = () => {
    if (isBusy) return;
    setSelectedTest(null);
  };

  const handleQuote = async () => {
    if (!selectedTest) return;

    try {
      setIsBusy(true);
      setError('');
      setMessage('');
      setOrder(null);

      const nextQuote = await quoteExamPurchase({
        examinationId: selectedTest.id,
        currency,
        couponCode,
      });
      setQuote(nextQuote);
      setMessage(
        nextQuote.payableAmountMinor === 0
          ? 'Scholarship coupon accepted. Continue to unlock the examination.'
          : couponCode.trim()
            ? 'Coupon applied successfully.'
            : 'Price confirmed.',
      );
    } catch (quoteError: any) {
      setQuote(null);
      setError(quoteError?.message || 'The price or coupon could not be validated.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleCreateOrder = async () => {
    if (!selectedTest) return;

    try {
      setIsBusy(true);
      setError('');
      setMessage('');

      const nextOrder = await createExamOrder({
        examinationId: selectedTest.id,
        currency,
        couponCode,
      });
      setOrder(nextOrder);

      if (nextOrder.canLaunch || ['waived', 'already_unlocked'].includes(nextOrder.status)) {
        setMessage('Examination unlocked successfully. You may now launch the secured session.');
        await refreshCatalogue();
        window.dispatchEvent(new Event('iipm-commerce-refresh'));
        return;
      }

      setMessage(
        `Payment order ${nextOrder.reference || ''} has been created. Secure Paystack checkout will be connected in Phase 3.`,
      );
    } catch (orderError: any) {
      setError(orderError?.message || 'The examination order could not be created.');
    } finally {
      setIsBusy(false);
    }
  };

  if (!isCandidate || !selectedTest) return null;

  const displayQuote = quote || (currentPrice
    ? {
        examinationId: selectedTest.id,
        priceId: currentPrice.id,
        currency: currentPrice.currency,
        listAmountMinor: currentPrice.amountMinor,
        couponId: null,
        couponCode: null,
        discountAmountMinor: 0,
        payableAmountMinor: currentPrice.amountMinor,
      }
    : null);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 bg-slate-950 px-6 py-5 text-white">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-amber-500 p-2.5 text-slate-950">
              <LockKeyhole className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-amber-400">
                Examination Access
              </p>
              <h2 className="mt-1 text-lg font-extrabold leading-tight">{selectedTest.title}</h2>
              <p className="mt-1 text-xs text-slate-400">{selectedTest.course}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeModal}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
            aria-label="Close purchase panel"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-extrabold uppercase tracking-wide text-slate-600">
                Payment currency
              </label>
              <select
                value={currency}
                onChange={(event) => {
                  setCurrency(event.target.value);
                  setQuote(null);
                  setOrder(null);
                  setMessage('');
                  setError('');
                }}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-semibold outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              >
                {availablePrices.length > 0 ? (
                  availablePrices.map((price) => (
                    <option key={price.id} value={price.currency}>
                      {price.currency} — {formatMoney(price.amountMinor, price.currency)}
                    </option>
                  ))
                ) : (
                  <option value="NGN">NGN</option>
                )}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-extrabold uppercase tracking-wide text-slate-600">
                Discount coupon
              </label>
              <div className="relative">
                <Tag className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={couponCode}
                  onChange={(event) => {
                    setCouponCode(event.target.value.toUpperCase());
                    setQuote(null);
                    setOrder(null);
                    setMessage('');
                    setError('');
                  }}
                  placeholder="Enter coupon code"
                  className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 text-sm font-semibold uppercase outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void handleQuote()}
            disabled={isBusy || !currentPrice}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Tag className="h-4 w-4" />}
            Validate Price and Coupon
          </button>

          {displayQuote && (
            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
              <div className="flex items-center justify-between text-slate-600">
                <span>Examination fee</span>
                <strong>{formatMoney(displayQuote.listAmountMinor, displayQuote.currency)}</strong>
              </div>
              <div className="flex items-center justify-between text-emerald-700">
                <span>Discount</span>
                <strong>-{formatMoney(displayQuote.discountAmountMinor, displayQuote.currency)}</strong>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200 pt-2 text-base text-slate-950">
                <span className="font-extrabold">Amount payable</span>
                <strong>{formatMoney(displayQuote.payableAmountMinor, displayQuote.currency)}</strong>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
              {error}
            </div>
          )}

          {message && (
            <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{message}</span>
            </div>
          )}

          {order?.reference && (
            <div className="rounded-xl border border-slate-200 px-4 py-3 text-xs text-slate-600">
              Order reference: <strong className="font-mono text-slate-900">{order.reference}</strong>
            </div>
          )}

          <button
            type="button"
            onClick={() => void handleCreateOrder()}
            disabled={isBusy || !currentPrice}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-extrabold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
            {displayQuote?.payableAmountMinor === 0
              ? 'Apply Scholarship and Unlock'
              : 'Create Secure Payment Order'}
          </button>

          <p className="text-center text-[11px] leading-relaxed text-slate-400">
            Examination questions remain protected until payment is verified or a valid 100% scholarship coupon is approved.
          </p>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import {
  Award,
  CheckCircle2,
  Clock3,
  Loader2,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { AGILECERT_BRAND } from '../config/agileCert';
import {
  formatAgileCertMoney,
  getAgileCertEarlyPriceTimeRemaining,
  getMyAgileCertCertificateOffers,
  type AgileCertCertificateOffer,
} from '../services/agileCertService';
import { initializeAgileCertCertificatePayment } from '../services/certificateCommerceService';

interface EligibilityOfferGroup {
  eligibilityId: string;
  examinationTitle: string;
  score: number;
  passMark: number;
  passedAt: string;
  earlyPriceExpiresAt: string;
  offers: AgileCertCertificateOffer[];
}

function groupOffers(offers: AgileCertCertificateOffer[]): EligibilityOfferGroup[] {
  const grouped = new Map<string, EligibilityOfferGroup>();

  offers.forEach((offer) => {
    const current = grouped.get(offer.eligibility_id);
    if (current) {
      current.offers.push(offer);
      return;
    }

    grouped.set(offer.eligibility_id, {
      eligibilityId: offer.eligibility_id,
      examinationTitle: offer.examination_title,
      score: offer.score,
      passMark: offer.pass_mark,
      passedAt: offer.passed_at,
      earlyPriceExpiresAt: offer.early_price_expires_at,
      offers: [offer],
    });
  });

  return Array.from(grouped.values()).sort(
    (left, right) => new Date(right.passedAt).getTime() - new Date(left.passedAt).getTime(),
  );
}

function dismissedKey(eligibilityId: string): string {
  return `agilecert_certificate_offer_dismissed_${eligibilityId}`;
}

export default function AgileCertCertificationOfferOverlay() {
  const [offers, setOffers] = useState<AgileCertCertificateOffer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [now, setNow] = useState(Date.now());

  const refreshOffers = async () => {
    if (localStorage.getItem('aura_logged_role') !== 'student') {
      setOffers([]);
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      const nextOffers = await getMyAgileCertCertificateOffers();
      setOffers(nextOffers);
    } catch (refreshError: any) {
      console.error('Unable to refresh AgileCert certificate offers:', refreshError);
      setError(refreshError?.message || 'Certificate options could not be loaded.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refreshOffers();

    const interval = window.setInterval(() => void refreshOffers(), 15_000);
    const handleRefresh = () => void refreshOffers();

    window.addEventListener('agilecert-offers-refresh', handleRefresh);
    window.addEventListener('iipm-commerce-refresh', handleRefresh);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('agilecert-offers-refresh', handleRefresh);
      window.removeEventListener('iipm-commerce-refresh', handleRefresh);
    };
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, []);

  const activeGroup = useMemo(() => {
    const groups = groupOffers(offers);
    return groups.find((group) => sessionStorage.getItem(dismissedKey(group.eligibilityId)) !== '1') || null;
  }, [offers, now]);

  const timeRemaining = useMemo(
    () =>
      activeGroup
        ? getAgileCertEarlyPriceTimeRemaining(activeGroup.earlyPriceExpiresAt)
        : null,
    [activeGroup, now],
  );

  const handleDismiss = () => {
    if (!activeGroup || isCheckingOut) return;
    sessionStorage.setItem(dismissedKey(activeGroup.eligibilityId), '1');
    setOffers((current) => [...current]);
  };

  const handleCheckout = async (offer: AgileCertCertificateOffer) => {
    try {
      setIsCheckingOut(true);
      setError('');
      setMessage('');

      const order = await initializeAgileCertCertificatePayment({
        eligibilityId: offer.eligibility_id,
        productCode: offer.product_code,
        currency: offer.currency,
      });

      if (order.paymentRequired === false) {
        setMessage(
          order.status === 'already_issued'
            ? 'This credential has already been issued and is available in your profile.'
            : 'Your certificate order has already been completed.',
        );
        await refreshOffers();
        window.dispatchEvent(new Event('agilecert-credentials-refresh'));
      }
    } catch (checkoutError: any) {
      setError(checkoutError?.message || 'The secure certificate checkout could not be started.');
    } finally {
      setIsCheckingOut(false);
    }
  };

  if (!activeGroup) return null;

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm">
      <section className="relative my-6 w-full max-w-5xl overflow-hidden rounded-3xl border border-emerald-400/20 bg-white shadow-2xl">
        <button
          type="button"
          onClick={handleDismiss}
          disabled={isCheckingOut}
          className="absolute right-4 top-4 z-10 rounded-full border border-slate-200 bg-white/90 p-2 text-slate-500 shadow-sm transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Decide later"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 px-6 py-8 text-white md:px-10">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="max-w-3xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-emerald-300">
                <Sparkles className="h-3.5 w-3.5" /> Congratulations — you passed
              </div>
              <h2 className="text-2xl font-black tracking-tight md:text-3xl">
                You are eligible for an {AGILECERT_BRAND.name} credential
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                {activeGroup.examinationTitle}
              </p>
            </div>

            <div className="grid min-w-[230px] grid-cols-2 gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Your score</p>
                <p className="mt-1 text-3xl font-black text-emerald-300">{activeGroup.score}%</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pass mark</p>
                <p className="mt-1 text-3xl font-black text-white">{activeGroup.passMark}%</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6 p-6 md:p-10">
          {timeRemaining && !timeRemaining.expired ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-950 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <Clock3 className="h-5 w-5 text-amber-600" />
                <div>
                  <p className="text-sm font-black">Your early certification price is active</p>
                  <p className="text-xs text-amber-800">The deadline is calculated from your verified passing time.</p>
                </div>
              </div>
              <div className="rounded-xl bg-white px-4 py-2 text-center font-mono text-sm font-black shadow-sm">
                {timeRemaining.days}d {timeRemaining.hours}h {timeRemaining.minutes}m
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm font-semibold text-slate-700">
              The seven-day early-price period has ended. Standard certificate pricing now applies.
            </div>
          )}

          <div className="grid gap-5 lg:grid-cols-2">
            {activeGroup.offers.map((offer) => {
              const isProfessional = offer.product_code === 'professional';
              const saving = offer.standard_amount_minor - offer.payable_amount_minor;

              return (
                <article
                  key={offer.product_code}
                  className={`flex h-full flex-col rounded-2xl border p-5 shadow-sm ${
                    isProfessional
                      ? 'border-emerald-300 bg-emerald-50/50'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className={`rounded-xl p-2.5 ${isProfessional ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
                      {isProfessional ? <ShieldCheck className="h-5 w-5" /> : <Award className="h-5 w-5" />}
                    </div>
                    {isProfessional && (
                      <span className="rounded-full bg-emerald-600 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white">
                        Higher assurance
                      </span>
                    )}
                  </div>

                  <h3 className="mt-4 text-xl font-black text-slate-950">{offer.product_title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{offer.product_description}</p>

                  <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-end justify-between gap-4">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {offer.is_early_price ? 'Seven-day price' : 'Standard price'}
                        </p>
                        <p className="mt-1 text-3xl font-black text-slate-950">
                          {formatAgileCertMoney(offer.payable_amount_minor, offer.currency)}
                        </p>
                      </div>
                      {saving > 0 && (
                        <div className="text-right">
                          <p className="text-xs font-semibold text-slate-400 line-through">
                            {formatAgileCertMoney(offer.standard_amount_minor, offer.currency)}
                          </p>
                          <p className="text-xs font-black text-emerald-700">
                            Save {formatAgileCertMoney(saving, offer.currency)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <ul className="mt-5 flex-1 space-y-2.5">
                    {offer.benefits.map((benefit) => (
                      <li key={benefit} className="flex items-start gap-2 text-sm text-slate-700">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                        <span>{benefit}</span>
                      </li>
                    ))}
                  </ul>

                  {offer.requires_identity_verification && (
                    <p className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold leading-5 text-blue-800">
                      Government-issued identity verification is required before this credential can be purchased and issued.
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={() => void handleCheckout(offer)}
                    disabled={isCheckingOut || isLoading}
                    className={`mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      isProfessional
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                        : 'bg-slate-950 text-white hover:bg-slate-800'
                    }`}
                  >
                    {isCheckingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Select {offer.product_title}
                  </button>
                </article>
              );
            })}
          </div>

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

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
            <p className="text-xs font-bold leading-5 text-slate-700">
              The certificate fee is separate from the examination fee. Passing establishes eligibility; a certificate and digital badge are issued only after verified certificate payment or an authorised waiver.
            </p>
            <p className="mt-2 text-[11px] leading-5 text-slate-500">{AGILECERT_BRAND.independenceDisclosure}</p>
          </div>

          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleDismiss}
              disabled={isCheckingOut}
              className="text-sm font-bold text-slate-500 underline decoration-slate-300 underline-offset-4 hover:text-slate-900 disabled:opacity-50"
            >
              Decide later — keep this offer in my profile
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

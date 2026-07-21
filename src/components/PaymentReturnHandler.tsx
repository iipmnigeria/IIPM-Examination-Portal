import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, RefreshCw, ShieldAlert, X } from 'lucide-react';
import { verifyExamPayment } from '../services/commerceService';

type VerificationState = 'idle' | 'verifying' | 'success' | 'error';

function paymentReferenceFromBrowser(): string {
  const parameters = new URLSearchParams(window.location.search);
  return (
    parameters.get('reference') ||
    parameters.get('trxref') ||
    sessionStorage.getItem('iipm_pending_payment_reference') ||
    ''
  ).trim();
}

function isPaymentReturn(): boolean {
  const parameters = new URLSearchParams(window.location.search);
  return (
    parameters.get('payment') === 'callback' ||
    parameters.has('reference') ||
    parameters.has('trxref')
  );
}

function clearPaymentParameters(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete('payment');
  url.searchParams.delete('reference');
  url.searchParams.delete('trxref');
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
  sessionStorage.removeItem('iipm_pending_payment_reference');
}

export default function PaymentReturnHandler() {
  const shouldVerify = useMemo(() => isPaymentReturn(), []);
  const [state, setState] = useState<VerificationState>(shouldVerify ? 'verifying' : 'idle');
  const [message, setMessage] = useState('Confirming your Paystack transaction…');
  const [reference] = useState(() => paymentReferenceFromBrowser());

  const verify = async () => {
    if (!reference) {
      setState('error');
      setMessage('The Paystack return reference is missing. Contact IIPM support with your payment receipt.');
      return;
    }

    try {
      setState('verifying');
      setMessage('Confirming your Paystack transaction and unlocking the examination…');
      const result = await verifyExamPayment(reference);

      if (!result.canLaunch) {
        throw new Error('Payment was verified but examination access was not granted.');
      }

      setState('success');
      setMessage('Payment verified. Your examination is now unlocked.');
      sessionStorage.removeItem('iipm_pending_payment_reference');
      window.dispatchEvent(new Event('iipm-commerce-refresh'));
    } catch (error: any) {
      setState('error');
      setMessage(error?.message || 'The payment could not be verified. Please retry.');
    }
  };

  useEffect(() => {
    if (!shouldVerify) return;
    void verify();
  }, [shouldVerify, reference]);

  if (state === 'idle') return null;

  const close = () => {
    clearPaymentParameters();
    setState('idle');
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
      <section className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-center justify-between bg-slate-950 px-5 py-4 text-white">
          <div className="flex items-center gap-3">
            <div
              className={`rounded-xl p-2.5 ${
                state === 'success'
                  ? 'bg-emerald-500 text-white'
                  : state === 'error'
                    ? 'bg-rose-500 text-white'
                    : 'bg-amber-400 text-slate-950'
              }`}
            >
              {state === 'success' ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : state === 'error' ? (
                <ShieldAlert className="h-5 w-5" />
              ) : (
                <Loader2 className="h-5 w-5 animate-spin" />
              )}
            </div>
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-emerald-400">
                Secure Payment Verification
              </p>
              <h2 className="text-lg font-extrabold">IIPM Examination Access</h2>
            </div>
          </div>
          {state !== 'verifying' && (
            <button
              type="button"
              onClick={close}
              className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
              aria-label="Close payment verification"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </header>

        <div className="space-y-4 p-6">
          <p className="text-sm font-semibold leading-relaxed text-slate-700">{message}</p>

          {reference && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
              Transaction reference:{' '}
              <strong className="break-all font-mono text-slate-900">{reference}</strong>
            </div>
          )}

          {state === 'verifying' && (
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full w-2/3 animate-pulse rounded-full bg-emerald-500" />
            </div>
          )}

          {state === 'error' && (
            <button
              type="button"
              onClick={() => void verify()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-extrabold text-white transition hover:bg-slate-800"
            >
              <RefreshCw className="h-4 w-4" /> Retry Verification
            </button>
          )}

          {state === 'success' && (
            <button
              type="button"
              onClick={close}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-extrabold text-white transition hover:bg-emerald-700"
            >
              <CheckCircle2 className="h-4 w-4" /> Continue to Examination Catalogue
            </button>
          )}

          <p className="text-center text-[11px] leading-relaxed text-slate-400">
            Access is granted only after the server confirms the exact amount, currency and Paystack transaction status.
          </p>
        </div>
      </section>
    </div>
  );
}

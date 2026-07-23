import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { verifyAgileCertCertificatePayment } from '../services/certificateCommerceService';

export default function AgileCertCertificatePaymentReturnHandler() {
  const [state, setState] = useState<'idle' | 'verifying' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [credentialCode, setCredentialCode] = useState('');

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('certificate_payment') !== 'callback') return;

    const reference =
      url.searchParams.get('reference') ||
      url.searchParams.get('trxref') ||
      sessionStorage.getItem('agilecert_pending_certificate_reference') ||
      '';

    const cleanUrl = () => {
      url.searchParams.delete('certificate_payment');
      url.searchParams.delete('reference');
      url.searchParams.delete('trxref');
      window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
      sessionStorage.removeItem('agilecert_pending_certificate_reference');
    };

    if (!reference.trim()) {
      setState('error');
      setMessage('The certificate payment reference is missing.');
      cleanUrl();
      return;
    }

    const verify = async () => {
      try {
        setState('verifying');
        setMessage('Verifying your AgileCert certificate payment...');

        const result = await verifyAgileCertCertificatePayment(reference);
        setCredentialCode(result.credentialCode || '');
        setState('success');
        setMessage(
          result.alreadyFulfilled
            ? 'Your certificate payment was already verified. Your credential remains available in your profile.'
            : 'Payment verified. Your credential and digital badge have been authorised for generation.',
        );
        window.dispatchEvent(new Event('agilecert-offers-refresh'));
        window.dispatchEvent(new Event('agilecert-credentials-refresh'));
      } catch (error: any) {
        setState('error');
        setMessage(error?.message || 'The certificate payment could not be verified.');
      } finally {
        cleanUrl();
      }
    };

    void verify();
  }, []);

  if (state === 'idle') return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-[150] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 rounded-full p-2 ${
            state === 'success'
              ? 'bg-emerald-100 text-emerald-700'
              : state === 'error'
                ? 'bg-rose-100 text-rose-700'
                : 'bg-blue-100 text-blue-700'
          }`}
        >
          {state === 'success' ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : state === 'error' ? (
            <XCircle className="h-5 w-5" />
          ) : (
            <Loader2 className="h-5 w-5 animate-spin" />
          )}
        </div>
        <div>
          <p className="text-sm font-black text-slate-950">
            {state === 'success'
              ? 'Certificate payment confirmed'
              : state === 'error'
                ? 'Certificate payment needs attention'
                : 'Secure verification in progress'}
          </p>
          <p className="mt-1 text-sm leading-6 text-slate-600">{message}</p>
          {credentialCode && (
            <p className="mt-2 rounded-lg bg-slate-100 px-3 py-2 font-mono text-xs font-bold text-slate-700">
              Credential: {credentialCode}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

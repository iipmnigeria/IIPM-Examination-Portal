import { FormEvent, useEffect, useState } from 'react';
import {
  BadgeCheck,
  CircleAlert,
  Loader2,
  SearchCheck,
  ShieldCheck,
  ShieldX,
  X,
} from 'lucide-react';
import {
  verifyCertificate,
  type CertificateVerificationResult,
} from '../services/certificateService';

const readVerificationCode = (): string => {
  if (typeof window === 'undefined') return '';
  return new URL(window.location.href).searchParams.get('verify')?.trim() || '';
};

const formatDate = (value?: string): string => {
  if (!value) return 'Not stated';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
};

const setVerificationQuery = (code: string) => {
  const url = new URL(window.location.href);
  if (code) url.searchParams.set('verify', code);
  else url.searchParams.delete('verify');
  window.history.replaceState({}, '', url.toString());
};

export default function PublicCertificateVerification() {
  const [isOpen, setIsOpen] = useState(() => Boolean(readVerificationCode()));
  const [code, setCode] = useState(readVerificationCode);
  const [result, setResult] = useState<CertificateVerificationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const runVerification = async (value: string) => {
    const normalized = value.trim();
    if (normalized.length < 6) {
      setError('Enter the certificate number or verification code printed on the issued certificate.');
      setResult(null);
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      const verification = await verifyCertificate(normalized);
      setResult(verification);
      setVerificationQuery(normalized);
    } catch (verificationError) {
      console.error('Public certificate verification failed:', verificationError);
      setResult(null);
      setError(
        verificationError instanceof Error
          ? verificationError.message
          : 'Certificate verification is temporarily unavailable.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const initialCode = readVerificationCode();
    if (initialCode) void runVerification(initialCode);

    const verifyHandler = (event: Event) => {
      const customEvent = event as CustomEvent<string>;
      const nextCode = String(customEvent.detail || '').trim();
      setCode(nextCode);
      setIsOpen(true);
      setResult(null);
      setError('');
      if (nextCode) void runVerification(nextCode);
    };
    window.addEventListener('agilecert-verify-code', verifyHandler);
    return () => window.removeEventListener('agilecert-verify-code', verifyHandler);
  }, []);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void runVerification(code);
  };

  const close = () => {
    setIsOpen(false);
    setResult(null);
    setError('');
    setVerificationQuery('');
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 right-5 z-[81] inline-flex items-center gap-2 rounded-full border border-blue-300/30 bg-white px-4 py-3 text-xs font-extrabold text-slate-800 shadow-xl transition hover:-translate-y-0.5 hover:border-blue-400 hover:bg-blue-50"
        aria-label="Verify an IIPM certificate"
      >
        <SearchCheck className="h-4 w-4 text-blue-600" />
        <span className="hidden sm:inline">Verify Certificate</span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[160] grid place-items-center overflow-y-auto bg-slate-950/85 p-4 backdrop-blur-sm">
      <section className="w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 bg-slate-950 px-6 py-5 text-white">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-blue-500/15 p-2.5 text-blue-400">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold">IIPM Certificate Verification</h1>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                Verify an AgileCert Global certificate against the server-issued authority record.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            className="rounded-full border border-slate-700 bg-slate-900 p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
            aria-label="Close certificate verification"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-5 p-6">
          <form onSubmit={handleSubmit} className="space-y-3">
            <label htmlFor="certificate-verification-code" className="block text-xs font-extrabold uppercase tracking-wider text-slate-500">
              Certificate number or verification code
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="certificate-verification-code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="IIPM/PMFC/2026/000001 or verification code"
                autoComplete="off"
                className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3 font-mono text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
              <button
                type="submit"
                disabled={isLoading}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-extrabold text-white transition hover:bg-blue-700 disabled:opacity-60"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SearchCheck className="h-4 w-4" />}
                Verify
              </button>
            </div>
          </form>

          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {result && !result.found && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
              <ShieldX className="mx-auto h-10 w-10 text-rose-500" />
              <h2 className="mt-3 text-lg font-extrabold text-rose-800">Certificate not verified</h2>
              <p className="mt-2 text-sm text-rose-700">{result.message}</p>
            </div>
          )}

          {result?.found && (
            <div className={`overflow-hidden rounded-2xl border ${result.valid ? 'border-emerald-200' : 'border-amber-200'}`}>
              <div className={`flex items-start gap-3 px-5 py-4 ${result.valid ? 'bg-emerald-50' : 'bg-amber-50'}`}>
                {result.valid ? (
                  <BadgeCheck className="h-7 w-7 shrink-0 text-emerald-600" />
                ) : (
                  <ShieldX className="h-7 w-7 shrink-0 text-amber-600" />
                )}
                <div>
                  <h2 className={`font-extrabold ${result.valid ? 'text-emerald-800' : 'text-amber-800'}`}>
                    {result.valid ? 'Active server-issued certificate' : `Certificate status: ${result.status || 'restricted'}`}
                  </h2>
                  <p className={`mt-1 text-sm ${result.valid ? 'text-emerald-700' : 'text-amber-700'}`}>{result.message}</p>
                </div>
              </div>

              <dl className="grid gap-px bg-slate-200 sm:grid-cols-2">
                {[
                  ['Certificate holder', result.holderName],
                  ['Certificate title', result.certificateTitle],
                  ['Examination', result.examinationTitle],
                  ['Programme', result.programmeCode || 'IIPM'],
                  ['Assessment score', result.score === undefined ? null : `${result.score}%`],
                  ['Required pass mark', result.passMark === undefined ? null : `${result.passMark}%`],
                  ['Issue date', formatDate(result.issueDate)],
                  ['Issuer', result.issuer],
                  ['Certificate number', result.certificateNumber],
                  ['Verification code', result.verificationCode],
                ].map(([label, value]) => (
                  <div key={String(label)} className="bg-white p-4">
                    <dt className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">{label}</dt>
                    <dd className="mt-1 break-words text-sm font-bold text-slate-800">{value || 'Not stated'}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          <p className="text-center text-[11px] leading-relaxed text-slate-400">
            This verification service does not expose the candidate’s account ID, email address, examination answers or proctor logs.
          </p>
        </div>
      </section>
    </div>
  );
}

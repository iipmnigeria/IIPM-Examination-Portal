import { useEffect, useState } from 'react';
import {
  Award,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  Loader2,
  SearchX,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  verifyAgileCertCredential,
  type AgileCertCredentialVerification,
} from '../services/agileCertService';

function verificationCodeFromUrl(): string {
  return new URLSearchParams(window.location.search).get('verify')?.trim() || '';
}

export default function AgileCertCredentialVerificationPage() {
  const [code, setCode] = useState(() => verificationCodeFromUrl());
  const [result, setResult] = useState<AgileCertCredentialVerification | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(code));
  const [error, setError] = useState('');

  useEffect(() => {
    const handleNavigation = () => setCode(verificationCodeFromUrl());
    window.addEventListener('popstate', handleNavigation);
    return () => window.removeEventListener('popstate', handleNavigation);
  }, []);

  useEffect(() => {
    if (!code) {
      setResult(null);
      setIsLoading(false);
      return;
    }

    let active = true;
    setIsLoading(true);
    setError('');

    verifyAgileCertCredential(code)
      .then((nextResult) => {
        if (active) setResult(nextResult);
      })
      .catch((verificationError: any) => {
        if (active) {
          setError(verificationError?.message || 'The credential could not be verified.');
          setResult(null);
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [code]);

  const closeVerification = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('verify');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    setCode('');
  };

  if (!code) return null;

  const isValid = Boolean(result?.valid);
  const badge = result?.badge || null;

  return (
    <div className="fixed inset-0 z-[210] overflow-y-auto bg-slate-950 p-4 text-slate-100 md:p-8">
      <div className="mx-auto w-full max-w-5xl">
        <header className="flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-emerald-600 p-3 shadow-lg shadow-emerald-950/40">
              <BadgeCheck className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-400">AgileCert Global</p>
              <h1 className="text-xl font-black">Credential Verification</h1>
              <p className="text-xs text-slate-400">Powered by IIPM</p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeVerification}
            className="rounded-full border border-slate-700 p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
            aria-label="Close credential verification"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {isLoading ? (
          <div className="mt-16 flex min-h-96 flex-col items-center justify-center gap-4 rounded-3xl border border-slate-800 bg-slate-900/70">
            <Loader2 className="h-10 w-10 animate-spin text-emerald-500" />
            <p className="font-bold text-slate-300">Checking the secure credential registry...</p>
          </div>
        ) : error ? (
          <div className="mt-12 rounded-3xl border border-rose-900/60 bg-rose-950/30 p-10 text-center">
            <SearchX className="mx-auto h-12 w-12 text-rose-400" />
            <h2 className="mt-4 text-2xl font-black">Verification unavailable</h2>
            <p className="mt-2 text-sm text-rose-200">{error}</p>
          </div>
        ) : !isValid ? (
          <div className="mt-12 rounded-3xl border border-amber-700/40 bg-amber-950/20 p-10 text-center">
            <SearchX className="mx-auto h-12 w-12 text-amber-400" />
            <h2 className="mt-4 text-2xl font-black">Credential not valid</h2>
            <p className="mt-2 text-sm text-slate-300">
              No active AgileCert credential matches this code, or the credential is {result?.status || 'unavailable'}.
            </p>
            <p className="mt-4 font-mono text-xs text-slate-500">Reference: {code}</p>
          </div>
        ) : (
          <main className="mt-6 overflow-hidden rounded-3xl border border-emerald-400/20 bg-white text-slate-900 shadow-2xl">
            <section className="bg-gradient-to-br from-emerald-700 via-emerald-800 to-slate-950 px-6 py-9 text-white md:px-10">
              <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/20 bg-emerald-300/10 px-3 py-1 text-xs font-black uppercase tracking-wider text-emerald-200">
                    <CheckCircle2 className="h-4 w-4" /> Valid active credential
                  </div>
                  <h2 className="mt-4 max-w-3xl text-2xl font-black leading-tight md:text-4xl">
                    {result?.credentialTitle}
                  </h2>
                  <p className="mt-3 text-sm text-emerald-100">{result?.examinationTitle}</p>
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/10 p-5 text-center backdrop-blur">
                  <ShieldCheck className="mx-auto h-9 w-9 text-emerald-300" />
                  <p className="mt-2 text-xs font-black uppercase tracking-wider text-emerald-100">Registry status</p>
                  <p className="mt-1 text-xl font-black capitalize">{result?.status}</p>
                </div>
              </div>
            </section>

            <section className="grid gap-6 p-6 md:grid-cols-3 md:p-10">
              <div className="md:col-span-2">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Credential holder</p>
                <h3 className="mt-2 text-3xl font-black text-slate-950">{result?.holderName}</h3>

                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Credential ID</p>
                    <p className="mt-2 break-all font-mono text-sm font-bold text-slate-800">{result?.credentialCode}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Issue date</p>
                    <p className="mt-2 flex items-center gap-2 text-sm font-black text-slate-800">
                      <CalendarDays className="h-4 w-4 text-emerald-600" />
                      {result?.issueDate ? new Date(result.issueDate).toLocaleDateString() : 'Not available'}
                    </p>
                  </div>
                  {result?.score !== null && result?.score !== undefined && (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Verified score</p>
                      <p className="mt-2 text-2xl font-black text-emerald-700">{result.score}%</p>
                    </div>
                  )}
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Assessment pathway</p>
                    <p className="mt-2 text-sm font-bold leading-6 text-slate-700">{result?.pathway}</p>
                  </div>
                </div>
              </div>

              <aside className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                <Award className="h-8 w-8 text-emerald-700" />
                <p className="mt-4 text-[10px] font-black uppercase tracking-wider text-emerald-700">Issued by</p>
                <p className="mt-1 text-lg font-black text-slate-950">{result?.issuer}</p>
                <p className="mt-1 text-sm font-semibold text-slate-600">Powered by {result?.poweredBy}</p>

                {badge && (
                  <div className="mt-6 rounded-xl border border-emerald-200 bg-white p-4">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Digital badge</p>
                    <p className="mt-2 font-mono text-xs font-bold text-slate-700">{badge.badgeCode}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">{badge.badgeClass}</p>
                    {badge.shareUrl && (
                      <a
                        href={badge.shareUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex items-center gap-1 text-xs font-black text-emerald-700 hover:underline"
                      >
                        View badge <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                )}
              </aside>
            </section>

            <footer className="border-t border-slate-200 bg-slate-50 px-6 py-5 text-xs leading-5 text-slate-500 md:px-10">
              This record confirms an independently issued AgileCert Global specialist competency credential. References to external standards or organisations do not imply affiliation, endorsement or authorisation.
            </footer>
          </main>
        )}
      </div>
    </div>
  );
}

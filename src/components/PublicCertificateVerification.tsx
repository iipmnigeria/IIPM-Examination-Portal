import { FormEvent, useEffect, useState } from 'react';
import {
  Award,
  BadgeCheck,
  CircleAlert,
  FileText,
  Loader2,
  SearchCheck,
  Share2,
  ShieldCheck,
  ShieldX,
  X,
} from 'lucide-react';
import {
  verifyProfessionalRecord,
  type ProfessionalRecordVerification,
  type PublicCredentialRecord,
} from '../services/credentialWalletService';

const readVerificationCode = (): string => {
  if (typeof window === 'undefined') return '';
  return new URL(window.location.href).searchParams.get('verify')?.trim() || '';
};

const formatDate = (value?: string | null): string => {
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

const recordLabel = (recordType?: string): string => {
  switch (recordType) {
    case 'credential': return 'Professional credential';
    case 'credential_share': return 'Candidate-shared credential';
    case 'transcript': return 'Candidate transcript';
    case 'transcript_share': return 'Candidate-shared transcript';
    case 'certificate': return 'Server-issued certificate';
    default: return 'Professional record';
  }
};

const CredentialCard = ({ credential }: { credential: PublicCredentialRecord }) => (
  <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-xs font-black uppercase tracking-wider text-blue-700">{credential.productTitle}</p>
        <h3 className="mt-1 text-lg font-black text-slate-950">{credential.certificateTitle}</h3>
        <p className="mt-1 text-sm text-slate-500">{credential.examinationTitle}</p>
      </div>
      <span className={`rounded-full border px-3 py-1 text-xs font-black capitalize ${credential.valid ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
        {credential.effectiveStatus}
      </span>
    </div>
    <dl className="mt-4 grid gap-px overflow-hidden rounded-xl bg-slate-200 sm:grid-cols-2">
      {[
        ['Holder', credential.holderName],
        ['Programme', credential.programmeCode || 'IIPM'],
        ['Credential ID', credential.credentialCode],
        ['Badge ID', credential.badgeCode],
        ['Certificate number', credential.certificateNumber],
        ['Assessment', `${credential.score}% / ${credential.passMark}% required`],
        ['Issue date', formatDate(credential.issueDate)],
        ['Expiry date', credential.expiresAt ? formatDate(credential.expiresAt) : 'Does not expire'],
        ['Issuer', credential.issuer],
        ['Verification URL', credential.verificationUrl],
      ].map(([label, value]) => (
        <div key={label} className="bg-white p-3">
          <dt className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</dt>
          <dd className="mt-1 break-all text-sm font-bold text-slate-800">{value}</dd>
        </div>
      ))}
    </dl>
  </article>
);

export default function PublicCertificateVerification() {
  const [isOpen, setIsOpen] = useState(() => Boolean(readVerificationCode()));
  const [code, setCode] = useState(readVerificationCode);
  const [result, setResult] = useState<ProfessionalRecordVerification | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const runVerification = async (value: string) => {
    const normalized = value.trim();
    if (normalized.length < 6) {
      setError('Enter a certificate number, credential ID, badge ID, transcript code or share code.');
      setResult(null);
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      const verification = await verifyProfessionalRecord(normalized);
      setResult(verification);
      setVerificationQuery(normalized);
    } catch (verificationError) {
      console.error('Public professional record verification failed:', verificationError);
      setResult(null);
      setError(
        verificationError instanceof Error
          ? verificationError.message
          : 'Professional record verification is temporarily unavailable.',
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
        aria-label="Verify an IIPM professional record"
      >
        <SearchCheck className="h-4 w-4 text-blue-600" />
        <span className="hidden sm:inline">Verify Credential</span>
      </button>
    );
  }

  const hasCredentials = Boolean(result?.credentials?.length);

  return (
    <div className="fixed inset-0 z-[160] overflow-y-auto bg-slate-950/85 p-4 backdrop-blur-sm">
      <section className="mx-auto my-4 w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 bg-slate-950 px-6 py-5 text-white">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-blue-500/15 p-2.5 text-blue-400"><ShieldCheck className="h-6 w-6" /></div>
            <div>
              <h1 className="text-lg font-extrabold">IIPM Professional Record Verification</h1>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">Verify AgileCert certificates, credentials, badges, transcripts and candidate-controlled share links.</p>
            </div>
          </div>
          <button type="button" onClick={close} className="rounded-full border border-slate-700 bg-slate-900 p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white" aria-label="Close professional record verification"><X className="h-4 w-4" /></button>
        </header>

        <div className="space-y-5 p-6">
          <form onSubmit={handleSubmit} className="space-y-3">
            <label htmlFor="professional-verification-code" className="block text-xs font-extrabold uppercase tracking-wider text-slate-500">Certificate, credential, badge, transcript or share code</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input id="professional-verification-code" value={code} onChange={(event) => setCode(event.target.value)} placeholder="IIPM/PMFC/2026/000001, AGC/…, BADGE-…, ATR-… or SHARE-…" autoComplete="off" className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3 font-mono text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
              <button type="submit" disabled={isLoading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-extrabold text-white transition hover:bg-blue-700 disabled:opacity-60">{isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SearchCheck className="h-4 w-4" />}Verify</button>
            </div>
          </form>

          {error && <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"><CircleAlert className="mt-0.5 h-5 w-5 shrink-0" /><p>{error}</p></div>}

          {result && !result.found && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
              <ShieldX className="mx-auto h-10 w-10 text-rose-500" />
              <h2 className="mt-3 text-lg font-extrabold text-rose-800">Professional record not verified</h2>
              <p className="mt-2 text-sm text-rose-700">{result.message}</p>
            </div>
          )}

          {result?.found && (
            <div className="space-y-5">
              <div className={`overflow-hidden rounded-2xl border ${result.valid ? 'border-emerald-200' : 'border-amber-200'}`}>
                <div className={`flex items-start gap-3 px-5 py-4 ${result.valid ? 'bg-emerald-50' : 'bg-amber-50'}`}>
                  {result.valid ? <BadgeCheck className="h-7 w-7 shrink-0 text-emerald-600" /> : <ShieldX className="h-7 w-7 shrink-0 text-amber-600" />}
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{recordLabel(result.recordType)}</p>
                    <h2 className={`mt-1 font-extrabold ${result.valid ? 'text-emerald-800' : 'text-amber-800'}`}>{result.valid ? 'Active and verified' : `Record status: ${result.status || 'restricted'}`}</h2>
                    <p className={`mt-1 text-sm ${result.valid ? 'text-emerald-700' : 'text-amber-700'}`}>{result.message}</p>
                    {result.holderName && <p className="mt-2 text-sm font-black text-slate-800">Holder: {result.holderName}</p>}
                    {result.expiresAt && <p className="mt-1 text-xs text-slate-500">Share link expires {formatDate(result.expiresAt)}</p>}
                  </div>
                </div>
              </div>

              {hasCredentials && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2"><Award className="h-5 w-5 text-blue-600" /><h2 className="font-black">Verified credentials</h2></div>
                  {result.credentials?.map((credential) => <CredentialCard key={credential.credentialCode} credential={credential} />)}
                </div>
              )}

              {!hasCredentials && result.recordType === 'certificate' && (
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <div className="flex items-center gap-2 bg-slate-50 px-5 py-3"><FileText className="h-5 w-5 text-blue-600" /><h2 className="font-black">Certificate authority record</h2></div>
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
                      <div key={String(label)} className="bg-white p-4"><dt className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">{label}</dt><dd className="mt-1 break-words text-sm font-bold text-slate-800">{value || 'Not stated'}</dd></div>
                    ))}
                  </dl>
                </div>
              )}

              {['credential_share', 'transcript_share'].includes(result.recordType) && (
                <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900"><Share2 className="mt-0.5 h-5 w-5 shrink-0" /><p>This record was shared by the candidate and remains valid only until the displayed expiry date or earlier revocation.</p></div>
              )}
            </div>
          )}

          <p className="text-center text-[11px] leading-relaxed text-slate-400">This service does not expose candidate email addresses, private account IDs, payment details, examination answers, proctor logs, identity evidence or private CPD evidence.</p>
        </div>
      </section>
    </div>
  );
}

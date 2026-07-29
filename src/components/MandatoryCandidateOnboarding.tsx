import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  FileCheck2,
  Loader2,
  LockKeyhole,
  LogOut,
  ShieldCheck,
  UserRoundCheck,
} from 'lucide-react';
import {
  completeMyCandidateOnboarding,
  getAuthenticatedCandidateEmail,
  getMyCandidateProfile,
  type CandidatePreferredCurrency,
} from '../services/candidateProfileService';

interface MandatoryCandidateOnboardingProps {
  candidateName: string;
  onCandidateNameChange: (name: string) => void;
  onComplete: () => void | Promise<void>;
  onLogout: () => void | Promise<void>;
}

const inputClass =
  'mt-2 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100';
const labelClass = 'text-xs font-black uppercase tracking-wider text-slate-500';

export default function MandatoryCandidateOnboarding({
  candidateName,
  onCandidateNameChange,
  onComplete,
  onLogout,
}: MandatoryCandidateOnboardingProps) {
  const [legalName, setLegalName] = useState(candidateName);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('NG');
  const [preferredCurrency, setPreferredCurrency] = useState<CandidatePreferredCurrency>('NGN');
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Lagos',
  );
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptExaminationPolicy, setAcceptExaminationPolicy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        const [profile, accountEmail] = await Promise.all([
          getMyCandidateProfile(),
          getAuthenticatedCandidateEmail(),
        ]);
        if (!active) return;
        setEmail(accountEmail);
        setLegalName(profile?.legal_name || candidateName);
        setPhone(profile?.phone || '');
        setCountryCode(profile?.country_code || 'NG');
        setPreferredCurrency(profile?.preferred_currency || 'NGN');
        setTimezone(profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Lagos');
        setAcceptPrivacy(Boolean(profile?.privacy_accepted_at));
        setAcceptTerms(Boolean(profile?.terms_accepted_at));
        setAcceptExaminationPolicy(Boolean(profile?.examination_policy_accepted_at));
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load onboarding.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [candidateName]);

  const submit = async () => {
    try {
      setSaving(true);
      setError('');
      setMessage('');
      const status = await completeMyCandidateOnboarding({
        legalName,
        phone,
        countryCode,
        preferredCurrency,
        timezone,
        acceptPrivacy,
        acceptTerms,
        acceptExaminationPolicy,
      });
      if (!status.complete) {
        throw new Error(`Complete the remaining required items: ${status.missingFields.join(', ')}.`);
      }
      const nextName = legalName.trim();
      onCandidateNameChange(nextName);
      setMessage('Profile completed. Your candidate workspace is now being opened.');
      await Promise.resolve(onComplete());
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to complete onboarding.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-400" />
        <p className="text-sm font-black uppercase tracking-widest text-slate-300">Preparing your secure profile…</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 md:py-12">
      <div className="mx-auto max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <header className="bg-slate-950 px-5 py-7 text-white md:px-9">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-start">
            <div className="flex gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-600">
                <UserRoundCheck className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-400">Required first-login step</p>
                <h1 className="mt-1 text-2xl font-black md:text-3xl">Complete your candidate profile</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                  Accurate identity and contact information is required before examination purchase, sponsored access or examination launch.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void onLogout()}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs font-black text-slate-200 hover:bg-slate-800"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </header>

        <div className="space-y-7 p-5 md:p-9">
          <div className="grid gap-3 md:grid-cols-3">
            {[
              [ShieldCheck, 'Identity accuracy', 'Used on examination and credential records'],
              [LockKeyhole, 'Private and protected', 'Profile access remains role-controlled'],
              [FileCheck2, 'Policy acceptance', 'Required before secured candidate services'],
            ].map(([Icon, title, description]) => (
              <div key={String(title)} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <Icon className="h-5 w-5 text-emerald-700" />
                <p className="mt-3 text-sm font-black text-slate-900">{String(title)}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">{String(description)}</p>
              </div>
            ))}
          </div>

          {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}
          {message && <div className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800"><CheckCircle2 className="mt-0.5 h-4 w-4" />{message}</div>}

          <section className="grid gap-5 md:grid-cols-2">
            <label className={labelClass}>
              Full legal name
              <input className={inputClass} value={legalName} onChange={(event) => setLegalName(event.target.value)} autoComplete="name" />
            </label>
            <label className={labelClass}>
              Account email
              <input className={`${inputClass} bg-slate-100`} value={email} readOnly />
            </label>
            <label className={labelClass}>
              Telephone number
              <input className={inputClass} value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+234…" autoComplete="tel" />
            </label>
            <label className={labelClass}>
              Country code
              <input className={inputClass} value={countryCode} onChange={(event) => setCountryCode(event.target.value.toUpperCase())} maxLength={2} placeholder="NG" />
            </label>
            <label className={labelClass}>
              Preferred currency
              <select className={inputClass} value={preferredCurrency} onChange={(event) => setPreferredCurrency(event.target.value as CandidatePreferredCurrency)}>
                <option value="NGN">NGN — Nigerian Naira</option>
                <option value="USD">USD — US Dollar</option>
              </select>
            </label>
            <label className={labelClass}>
              Time zone
              <input className={inputClass} value={timezone} onChange={(event) => setTimezone(event.target.value)} placeholder="Africa/Lagos" />
            </label>
          </section>

          <section className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <h2 className="text-sm font-black text-slate-900">Required acknowledgements</h2>
            {[
              [acceptPrivacy, setAcceptPrivacy, 'I have read and accept the Privacy Policy.'],
              [acceptTerms, setAcceptTerms, 'I accept the Terms of Use and candidate account conditions.'],
              [acceptExaminationPolicy, setAcceptExaminationPolicy, 'I accept the Examination & Assessment Policy and Candidate Code of Conduct.'],
            ].map(([checked, setter, label]) => (
              <label key={String(label)} className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm font-semibold leading-6 text-slate-700">
                <input type="checkbox" className="mt-1 h-4 w-4 accent-emerald-600" checked={Boolean(checked)} onChange={(event) => (setter as (value: boolean) => void)(event.target.checked)} />
                <span>{String(label)}</span>
              </label>
            ))}
          </section>

          <button
            type="button"
            onClick={() => void submit()}
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3.5 text-sm font-black text-white shadow-lg hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Complete profile and open workspace
          </button>
        </div>
      </div>
    </main>
  );
}

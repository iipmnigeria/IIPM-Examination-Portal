import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  Loader2,
  Mail,
  Save,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { requestPasswordReset } from '../services/authService';
import {
  getAuthenticatedCandidateEmail,
  getMyCandidateProfile,
  saveMyCandidateProfile,
  type CandidatePreferredCurrency,
  type CandidateProfile,
} from '../services/candidateProfileService';

interface CandidateProfilePanelProps {
  candidateName: string;
  onCandidateNameChange: (name: string) => void;
  onBack: () => void;
}

interface CandidateProfileForm {
  legalName: string;
  phone: string;
  countryCode: string;
  preferredCurrency: CandidatePreferredCurrency | '';
  preferredLanguage: string;
  timezone: string;
  professionalHeadline: string;
  employer: string;
  industry: string;
  educationSummary: string;
  skills: string;
  certificationInterests: string;
  publicProfileEnabled: boolean;
  marketingConsent: boolean;
  certificateEmailUpdates: boolean;
  courseRecommendationEmails: boolean;
}

function defaultForm(candidateName: string): CandidateProfileForm {
  return {
    legalName: candidateName,
    phone: '',
    countryCode: '',
    preferredCurrency: '',
    preferredLanguage: 'en',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Lagos',
    professionalHeadline: '',
    employer: '',
    industry: '',
    educationSummary: '',
    skills: '',
    certificationInterests: '',
    publicProfileEnabled: false,
    marketingConsent: false,
    certificateEmailUpdates: true,
    courseRecommendationEmails: true,
  };
}

function formFromProfile(
  profile: CandidateProfile | null,
  candidateName: string,
): CandidateProfileForm {
  if (!profile) return defaultForm(candidateName);

  return {
    legalName: profile.legal_name || candidateName,
    phone: profile.phone || '',
    countryCode: profile.country_code || '',
    preferredCurrency: profile.preferred_currency || '',
    preferredLanguage: profile.preferred_language || 'en',
    timezone: profile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Lagos',
    professionalHeadline: profile.professional_headline || '',
    employer: profile.employer || '',
    industry: profile.industry || '',
    educationSummary: profile.education_summary || '',
    skills: profile.skills.join(', '),
    certificationInterests: profile.certification_interests.join(', '),
    publicProfileEnabled: profile.public_profile_enabled,
    marketingConsent: profile.marketing_consent,
    certificateEmailUpdates: profile.certificate_email_updates,
    courseRecommendationEmails: profile.course_recommendation_emails,
  };
}

function commaList(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

const inputClassName =
  'mt-2 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100';

const labelClassName = 'text-xs font-black uppercase tracking-wider text-slate-500';

export default function CandidateProfilePanel({
  candidateName,
  onCandidateNameChange,
  onBack,
}: CandidateProfilePanelProps) {
  const [form, setForm] = useState<CandidateProfileForm>(() => defaultForm(candidateName));
  const [accountEmail, setAccountEmail] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setIsLoading(true);
        setError('');
        const [profile, email] = await Promise.all([
          getMyCandidateProfile(),
          getAuthenticatedCandidateEmail(),
        ]);
        if (!active) return;
        setForm(formFromProfile(profile, candidateName));
        setAccountEmail(email);
      } catch (loadError: any) {
        if (!active) return;
        setError(
          loadError?.message ||
            'Your candidate profile could not be loaded. Confirm that the Phase 2 profile migration has been applied.',
        );
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [candidateName]);

  const completion = useMemo(() => {
    const values = [
      form.legalName,
      form.phone,
      form.countryCode,
      form.timezone,
      form.professionalHeadline,
      form.employer,
      form.industry,
      form.skills,
      form.certificationInterests,
    ];
    const completed = values.filter((value) => value.trim().length > 0).length;
    return Math.round((completed / values.length) * 100);
  }, [form]);

  const updateForm = <K extends keyof CandidateProfileForm>(
    key: K,
    value: CandidateProfileForm[K],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError('');
      setMessage('');

      const saved = await saveMyCandidateProfile({
        legalName: form.legalName,
        phone: form.phone,
        countryCode: form.countryCode,
        preferredCurrency: form.preferredCurrency,
        preferredLanguage: form.preferredLanguage,
        timezone: form.timezone,
        professionalHeadline: form.professionalHeadline,
        employer: form.employer,
        industry: form.industry,
        educationSummary: form.educationSummary,
        skills: commaList(form.skills),
        certificationInterests: commaList(form.certificationInterests),
        publicProfileEnabled: form.publicProfileEnabled,
        marketingConsent: form.marketingConsent,
        certificateEmailUpdates: form.certificateEmailUpdates,
        courseRecommendationEmails: form.courseRecommendationEmails,
      });

      const nextName = saved.legal_name || form.legalName.trim();
      setForm(formFromProfile(saved, nextName));
      onCandidateNameChange(nextName);
      setMessage('Your candidate profile and communication settings have been saved.');
    } catch (saveError: any) {
      setError(saveError?.message || 'Your candidate profile could not be saved.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!accountEmail) {
      setError('The authenticated account email is unavailable. Sign out and sign in again.');
      return;
    }

    try {
      setIsSendingReset(true);
      setError('');
      setMessage('');
      await requestPasswordReset(accountEmail);
      setMessage(`A password-reset link has been sent to ${accountEmail}.`);
    } catch (resetError: any) {
      setError(resetError?.message || 'The password-reset email could not be sent.');
    } finally {
      setIsSendingReset(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-slate-500">
        <Loader2 className="h-9 w-9 animate-spin text-emerald-600" />
        <p className="text-sm font-bold">Loading your secure candidate profile...</p>
      </div>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 md:py-10">
      <button
        type="button"
        onClick={onBack}
        className="mb-5 inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to examinations
      </button>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <header className="bg-slate-950 px-5 py-6 text-white md:px-8">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-600">
                <UserRound className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400">
                  Phase 2 Candidate Workspace
                </p>
                <h1 className="mt-1 text-2xl font-black md:text-3xl">Profile & Settings</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                  Keep your examination identity, professional information and communication preferences current.
                </p>
              </div>
            </div>

            <div className="min-w-56 rounded-2xl border border-slate-700 bg-slate-900 p-4">
              <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider">
                <span className="text-slate-400">Profile completion</span>
                <span className="text-emerald-400">{completion}%</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-700">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${completion}%` }}
                />
              </div>
            </div>
          </div>
        </header>

        <div className="space-y-7 p-5 md:p-8">
          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
              {error}
            </div>
          )}
          {message && (
            <div className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              {message}
            </div>
          )}

          <section>
            <div className="mb-4 flex items-center gap-3">
              <UserRound className="h-5 w-5 text-emerald-600" />
              <div>
                <h2 className="font-black text-slate-900">Personal and location details</h2>
                <p className="text-sm text-slate-500">Used to personalise your candidate workspace and examination records.</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className={labelClassName}>
                Full legal name
                <input
                  className={inputClassName}
                  value={form.legalName}
                  onChange={(event) => updateForm('legalName', event.target.value)}
                  autoComplete="name"
                />
              </label>
              <label className={labelClassName}>
                Account email
                <input className={`${inputClassName} bg-slate-100`} value={accountEmail} readOnly />
              </label>
              <label className={labelClassName}>
                Telephone
                <input
                  className={inputClassName}
                  value={form.phone}
                  onChange={(event) => updateForm('phone', event.target.value)}
                  autoComplete="tel"
                  placeholder="+234..."
                />
              </label>
              <label className={labelClassName}>
                Country code
                <input
                  className={inputClassName}
                  value={form.countryCode}
                  onChange={(event) => updateForm('countryCode', event.target.value.toUpperCase())}
                  maxLength={2}
                  placeholder="NG"
                />
              </label>
              <label className={labelClassName}>
                Preferred currency
                <select
                  className={inputClassName}
                  value={form.preferredCurrency}
                  onChange={(event) =>
                    updateForm('preferredCurrency', event.target.value as CandidatePreferredCurrency | '')
                  }
                >
                  <option value="">Select preference</option>
                  <option value="NGN">NGN — Nigerian Naira</option>
                  <option value="USD">USD — US Dollar</option>
                </select>
                <span className="mt-1 block text-[11px] normal-case tracking-normal text-slate-400">
                  This preference does not override server-controlled examination or certificate prices.
                </span>
              </label>
              <label className={labelClassName}>
                Preferred language
                <select
                  className={inputClassName}
                  value={form.preferredLanguage}
                  onChange={(event) => updateForm('preferredLanguage', event.target.value)}
                >
                  <option value="en">English</option>
                </select>
              </label>
              <label className={`${labelClassName} md:col-span-2`}>
                Time zone
                <input
                  className={inputClassName}
                  value={form.timezone}
                  onChange={(event) => updateForm('timezone', event.target.value)}
                  placeholder="Africa/Lagos"
                />
              </label>
            </div>
          </section>

          <section className="border-t border-slate-200 pt-7">
            <h2 className="font-black text-slate-900">Professional profile</h2>
            <p className="mt-1 text-sm text-slate-500">
              These details will support future certification recommendations and an optional public credential profile.
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className={`${labelClassName} md:col-span-2`}>
                Professional headline
                <input
                  className={inputClassName}
                  value={form.professionalHeadline}
                  onChange={(event) => updateForm('professionalHeadline', event.target.value)}
                  placeholder="Project Manager | HR Practitioner | Consultant"
                />
              </label>
              <label className={labelClassName}>
                Employer or organisation
                <input
                  className={inputClassName}
                  value={form.employer}
                  onChange={(event) => updateForm('employer', event.target.value)}
                />
              </label>
              <label className={labelClassName}>
                Industry
                <input
                  className={inputClassName}
                  value={form.industry}
                  onChange={(event) => updateForm('industry', event.target.value)}
                />
              </label>
              <label className={`${labelClassName} md:col-span-2`}>
                Education summary
                <textarea
                  className={`${inputClassName} min-h-24 resize-y`}
                  value={form.educationSummary}
                  onChange={(event) => updateForm('educationSummary', event.target.value)}
                />
              </label>
              <label className={labelClassName}>
                Skills
                <textarea
                  className={`${inputClassName} min-h-24 resize-y`}
                  value={form.skills}
                  onChange={(event) => updateForm('skills', event.target.value)}
                  placeholder="Project planning, risk management, HR analytics"
                />
                <span className="mt-1 block text-[11px] normal-case tracking-normal text-slate-400">
                  Separate entries with commas.
                </span>
              </label>
              <label className={labelClassName}>
                Certification interests
                <textarea
                  className={`${inputClassName} min-h-24 resize-y`}
                  value={form.certificationInterests}
                  onChange={(event) => updateForm('certificationInterests', event.target.value)}
                  placeholder="Project management, procurement, leadership"
                />
                <span className="mt-1 block text-[11px] normal-case tracking-normal text-slate-400">
                  Separate entries with commas.
                </span>
              </label>
            </div>
          </section>

          <section className="border-t border-slate-200 pt-7">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-emerald-600" />
              <div>
                <h2 className="font-black text-slate-900">Privacy and communications</h2>
                <p className="text-sm text-slate-500">Control optional visibility and messages.</p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {([
                ['publicProfileEnabled', 'Enable future public credential profile', 'Your profile remains private until credential-profile functions are delivered.'],
                ['marketingConsent', 'Receive relevant AgileCert and IIPM updates', 'Optional programme and professional-development information.'],
                ['certificateEmailUpdates', 'Receive certificate-related email updates', 'Reserved for the later certificate and communication phases.'],
                ['courseRecommendationEmails', 'Receive course and certification recommendations', 'Recommendations will only activate in a later approved phase.'],
              ] as const).map(([key, title, description]) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 p-4 transition hover:border-emerald-300 hover:bg-emerald-50/30"
                >
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 accent-emerald-600"
                    checked={form[key]}
                    onChange={(event) => updateForm(key, event.target.checked)}
                  />
                  <span>
                    <span className="block text-sm font-black text-slate-800">{title}</span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span>
                  </span>
                </label>
              ))}
            </div>
          </section>

          <section className="border-t border-slate-200 pt-7">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-white p-2.5 shadow-sm">
                    <ShieldCheck className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <h2 className="font-black text-slate-900">Account security</h2>
                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      Password changes continue through the existing secure Supabase email-reset process.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void handlePasswordReset()}
                  disabled={isSendingReset}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:border-emerald-400 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSendingReset ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                  Send password-reset link
                </button>
              </div>
            </div>
          </section>

          <div className="flex flex-col-reverse justify-between gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:items-center">
            <p className="text-xs leading-5 text-slate-500">
              Private profile-photo management is active. Preparation materials will be added in the next approved Phase 2 increment.
            </p>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={isSaving}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save profile
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

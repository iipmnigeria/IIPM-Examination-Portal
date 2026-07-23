import { useEffect, useMemo, useState } from 'react';
import {
  Award,
  BookOpen,
  Check,
  Copy,
  Download,
  ExternalLink,
  FileBadge,
  IdCard,
  Loader2,
  Settings,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react';
import {
  getMyAgileCertCredentials,
  getMyAgileCertProfile,
  getMyAgileCertStudyMaterials,
  saveMyAgileCertProfile,
  type AgileCertCandidateProfile,
  type AgileCertCredential,
  type AgileCertStudyMaterial,
} from '../services/agileCertService';
import { downloadAgileCertStudyMaterial } from '../services/studyMaterialService';

type WorkspaceTab = 'profile' | 'materials' | 'credentials';

type ProfileForm = {
  legalName: string;
  phone: string;
  countryCode: string;
  timezone: string;
  professionalHeadline: string;
  employer: string;
  industry: string;
  educationSummary: string;
  skills: string;
  certificationInterests: string;
  publicProfileEnabled: boolean;
  showScorePublicly: boolean;
  marketingConsent: boolean;
  certificateEmailUpdates: boolean;
  courseRecommendationEmails: boolean;
};

const defaultForm = (): ProfileForm => ({
  legalName: localStorage.getItem('aura_student_name') || '',
  phone: '',
  countryCode: '',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  professionalHeadline: '',
  employer: '',
  industry: '',
  educationSummary: '',
  skills: '',
  certificationInterests: '',
  publicProfileEnabled: false,
  showScorePublicly: false,
  marketingConsent: false,
  certificateEmailUpdates: true,
  courseRecommendationEmails: true,
});

function formFromProfile(profile: AgileCertCandidateProfile | null): ProfileForm {
  if (!profile) return defaultForm();

  return {
    legalName: profile.legal_name || '',
    phone: profile.phone || '',
    countryCode: profile.country_code || '',
    timezone: profile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    professionalHeadline: profile.professional_headline || '',
    employer: profile.employer || '',
    industry: profile.industry || '',
    educationSummary: profile.education_summary || '',
    skills: profile.skills.join(', '),
    certificationInterests: profile.certification_interests.join(', '),
    publicProfileEnabled: profile.public_profile_enabled,
    showScorePublicly: profile.show_score_publicly,
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

function verificationUrl(credential: AgileCertCredential): string {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('verify', credential.verification_slug);
  return url.toString();
}

function linkedinUrl(credential: AgileCertCredential): string {
  const issueDate = new Date(`${credential.issue_date}T00:00:00`);
  const url = new URL('https://www.linkedin.com/profile/add');
  url.searchParams.set('startTask', 'CERTIFICATION_NAME');
  url.searchParams.set('name', credential.linkedin_credential_name || credential.credential_title);
  url.searchParams.set('organizationName', credential.linkedin_organization_name);
  url.searchParams.set('issueYear', String(issueDate.getFullYear()));
  url.searchParams.set('issueMonth', String(issueDate.getMonth() + 1));
  url.searchParams.set('certId', credential.credential_code);
  url.searchParams.set('certUrl', verificationUrl(credential));
  return url.toString();
}

export default function AgileCertCandidateWorkspace() {
  const [isCandidate, setIsCandidate] = useState(
    () => localStorage.getItem('aura_logged_role') === 'student',
  );
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('profile');
  const [profile, setProfile] = useState<AgileCertCandidateProfile | null>(null);
  const [form, setForm] = useState<ProfileForm>(() => defaultForm());
  const [materials, setMaterials] = useState<AgileCertStudyMaterial[]>([]);
  const [credentials, setCredentials] = useState<AgileCertCredential[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [copiedCredentialId, setCopiedCredentialId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const checkRole = () => {
      const candidate = localStorage.getItem('aura_logged_role') === 'student';
      setIsCandidate(candidate);
      if (!candidate) setIsOpen(false);
    };

    checkRole();
    const interval = window.setInterval(checkRole, 1_000);
    window.addEventListener('storage', checkRole);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('storage', checkRole);
    };
  }, []);

  const loadWorkspace = async () => {
    try {
      setIsLoading(true);
      setError('');
      const [nextProfile, nextMaterials, nextCredentials] = await Promise.all([
        getMyAgileCertProfile(),
        getMyAgileCertStudyMaterials(),
        getMyAgileCertCredentials(),
      ]);
      setProfile(nextProfile);
      setForm(formFromProfile(nextProfile));
      setMaterials(nextMaterials);
      setCredentials(nextCredentials);
    } catch (loadError: any) {
      setError(loadError?.message || 'Your AgileCert workspace could not be loaded.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !isCandidate) return;
    void loadWorkspace();
  }, [isOpen, isCandidate]);

  useEffect(() => {
    const refresh = () => {
      if (isOpen && isCandidate) void loadWorkspace();
    };
    window.addEventListener('agilecert-credentials-refresh', refresh);
    window.addEventListener('agilecert-materials-refresh', refresh);
    return () => {
      window.removeEventListener('agilecert-credentials-refresh', refresh);
      window.removeEventListener('agilecert-materials-refresh', refresh);
    };
  }, [isOpen, isCandidate]);

  const pricingLabel = useMemo(() => {
    if (profile?.pricing_currency) return profile.pricing_currency;
    if (form.countryCode.trim().toUpperCase() === 'NG') return 'NGN';
    return form.countryCode.trim() ? 'USD' : 'Set country';
  }, [form.countryCode, profile?.pricing_currency]);

  const updateForm = <K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSaveProfile = async () => {
    const countryCode = form.countryCode.trim().toUpperCase();
    if (countryCode && !/^[A-Z]{2}$/.test(countryCode)) {
      setError('Country code must use two letters, for example NG, GH, GB, US or CA.');
      return;
    }
    if (!form.legalName.trim()) {
      setError('Your legal name is required for examinations and credentials.');
      return;
    }

    try {
      setIsSaving(true);
      setError('');
      setMessage('');
      const saved = await saveMyAgileCertProfile({
        legalName: form.legalName,
        phone: form.phone,
        countryCode,
        timezone: form.timezone,
        preferredLanguage: 'en',
        professionalHeadline: form.professionalHeadline,
        employer: form.employer,
        industry: form.industry,
        educationSummary: form.educationSummary,
        skills: commaList(form.skills),
        certificationInterests: commaList(form.certificationInterests),
        publicProfileEnabled: form.publicProfileEnabled,
        showScorePublicly: form.showScorePublicly,
        marketingConsent: form.marketingConsent,
        certificateEmailUpdates: form.certificateEmailUpdates,
        courseRecommendationEmails: form.courseRecommendationEmails,
      });
      setProfile(saved);
      setForm(formFromProfile(saved));
      localStorage.setItem('aura_student_name', saved.legal_name || form.legalName.trim());
      setMessage('Profile and communication settings saved successfully.');
      window.dispatchEvent(new Event('agilecert-offers-refresh'));
    } catch (saveError: any) {
      setError(saveError?.message || 'Your profile could not be saved.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownload = async (material: AgileCertStudyMaterial) => {
    try {
      setDownloadingId(material.material_id);
      setError('');
      await downloadAgileCertStudyMaterial(material.material_id);
    } catch (downloadError: any) {
      setError(downloadError?.message || 'The preparation material could not be downloaded.');
    } finally {
      setDownloadingId(null);
    }
  };

  const copyVerificationLink = async (credential: AgileCertCredential) => {
    await navigator.clipboard.writeText(verificationUrl(credential));
    setCopiedCredentialId(credential.id);
    window.setTimeout(() => setCopiedCredentialId(null), 2_000);
  };

  if (!isCandidate) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-5 right-5 z-[90] inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-2xl transition hover:bg-slate-800"
      >
        <UserRound className="h-4 w-4 text-emerald-400" />
        My AgileCert
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[125] flex items-center justify-center overflow-y-auto bg-slate-950/75 p-4 backdrop-blur-sm">
          <section className="my-6 flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <header className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-5 py-4 text-white md:px-7">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-400">
                  AgileCert Global
                </p>
                <h2 className="mt-1 text-xl font-black">Candidate Profile & Credential Workspace</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-full border border-slate-700 p-2 text-slate-300 transition hover:bg-slate-800 hover:text-white"
                aria-label="Close workspace"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <nav className="grid grid-cols-3 border-b border-slate-200 bg-slate-50">
              {([
                ['profile', 'Profile & Settings', Settings],
                ['materials', 'Preparation Materials', BookOpen],
                ['credentials', 'Credentials & Badges', Award],
              ] as const).map(([tab, label, Icon]) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab);
                    setError('');
                    setMessage('');
                  }}
                  className={`flex items-center justify-center gap-2 border-b-2 px-2 py-4 text-xs font-black transition md:text-sm ${
                    activeTab === tab
                      ? 'border-emerald-600 bg-white text-emerald-700'
                      : 'border-transparent text-slate-500 hover:bg-white hover:text-slate-900'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{label}</span>
                  <span className="sm:hidden">{tab === 'profile' ? 'Profile' : tab === 'materials' ? 'Materials' : 'Credentials'}</span>
                </button>
              ))}
            </nav>

            <div className="flex-1 overflow-y-auto p-5 md:p-7">
              {isLoading ? (
                <div className="flex min-h-72 flex-col items-center justify-center gap-3 text-slate-500">
                  <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                  <p className="text-sm font-bold">Loading your secure workspace...</p>
                </div>
              ) : (
                <>
                  {activeTab === 'profile' && (
                    <div className="space-y-6">
                      <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 md:grid-cols-3">
                        <div className="flex items-center gap-3">
                          <IdCard className="h-6 w-6 text-emerald-600" />
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Identity</p>
                            <p className="text-sm font-black capitalize text-slate-900">
                              {profile?.identity_verification_status || 'unverified'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <ShieldCheck className="h-6 w-6 text-emerald-600" />
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Pricing currency</p>
                            <p className="text-sm font-black text-slate-900">{pricingLabel}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <FileBadge className="h-6 w-6 text-emerald-600" />
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Issued credentials</p>
                            <p className="text-sm font-black text-slate-900">{credentials.length}</p>
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="space-y-1.5 text-sm font-bold text-slate-700">
                          Legal name
                          <input
                            value={form.legalName}
                            onChange={(event) => updateForm('legalName', event.target.value)}
                            className="w-full rounded-xl border border-slate-300 px-4 py-3 font-medium outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                            placeholder="Full legal name"
                          />
                        </label>
                        <label className="space-y-1.5 text-sm font-bold text-slate-700">
                          Phone number
                          <input
                            value={form.phone}
                            onChange={(event) => updateForm('phone', event.target.value)}
                            className="w-full rounded-xl border border-slate-300 px-4 py-3 font-medium outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                            placeholder="Include country code"
                          />
                        </label>
                        <label className="space-y-1.5 text-sm font-bold text-slate-700">
                          Country code
                          <input
                            value={form.countryCode}
                            onChange={(event) => updateForm('countryCode', event.target.value.toUpperCase().slice(0, 2))}
                            className="w-full rounded-xl border border-slate-300 px-4 py-3 font-medium uppercase outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                            placeholder="NG"
                            maxLength={2}
                          />
                          <span className="block text-[11px] font-medium text-slate-400">Use the two-letter country code.</span>
                        </label>
                        <label className="space-y-1.5 text-sm font-bold text-slate-700">
                          Time zone
                          <input
                            value={form.timezone}
                            onChange={(event) => updateForm('timezone', event.target.value)}
                            className="w-full rounded-xl border border-slate-300 px-4 py-3 font-medium outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                            placeholder="Africa/Lagos"
                          />
                        </label>
                        <label className="space-y-1.5 text-sm font-bold text-slate-700 md:col-span-2">
                          Professional headline
                          <input
                            value={form.professionalHeadline}
                            onChange={(event) => updateForm('professionalHeadline', event.target.value)}
                            className="w-full rounded-xl border border-slate-300 px-4 py-3 font-medium outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                            placeholder="Project professional, HR analyst, cybersecurity practitioner..."
                          />
                        </label>
                        <label className="space-y-1.5 text-sm font-bold text-slate-700">
                          Employer
                          <input
                            value={form.employer}
                            onChange={(event) => updateForm('employer', event.target.value)}
                            className="w-full rounded-xl border border-slate-300 px-4 py-3 font-medium outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                          />
                        </label>
                        <label className="space-y-1.5 text-sm font-bold text-slate-700">
                          Industry
                          <input
                            value={form.industry}
                            onChange={(event) => updateForm('industry', event.target.value)}
                            className="w-full rounded-xl border border-slate-300 px-4 py-3 font-medium outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                          />
                        </label>
                        <label className="space-y-1.5 text-sm font-bold text-slate-700 md:col-span-2">
                          Education summary
                          <textarea
                            value={form.educationSummary}
                            onChange={(event) => updateForm('educationSummary', event.target.value)}
                            className="min-h-24 w-full rounded-xl border border-slate-300 px-4 py-3 font-medium outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                          />
                        </label>
                        <label className="space-y-1.5 text-sm font-bold text-slate-700">
                          Skills
                          <input
                            value={form.skills}
                            onChange={(event) => updateForm('skills', event.target.value)}
                            className="w-full rounded-xl border border-slate-300 px-4 py-3 font-medium outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                            placeholder="Risk management, scheduling, analytics"
                          />
                          <span className="block text-[11px] font-medium text-slate-400">Separate items with commas.</span>
                        </label>
                        <label className="space-y-1.5 text-sm font-bold text-slate-700">
                          Certification interests
                          <input
                            value={form.certificationInterests}
                            onChange={(event) => updateForm('certificationInterests', event.target.value)}
                            className="w-full rounded-xl border border-slate-300 px-4 py-3 font-medium outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                            placeholder="Agile, project quality, HR analytics"
                          />
                          <span className="block text-[11px] font-medium text-slate-400">Used for relevant recommendations.</span>
                        </label>
                      </div>

                      <div className="grid gap-3 rounded-2xl border border-slate-200 p-5 md:grid-cols-2">
                        {([
                          ['publicProfileEnabled', 'Enable public professional credential profile'],
                          ['showScorePublicly', 'Show examination scores on public verification'],
                          ['certificateEmailUpdates', 'Receive certificate eligibility and deadline emails'],
                          ['courseRecommendationEmails', 'Receive relevant modular certification recommendations'],
                          ['marketingConsent', 'Receive broader AgileCert and IIPM programme updates'],
                        ] as const).map(([key, label]) => (
                          <label key={key} className="flex items-start gap-3 rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-700">
                            <input
                              type="checkbox"
                              checked={form[key]}
                              onChange={(event) => updateForm(key, event.target.checked)}
                              className="mt-0.5 h-4 w-4 accent-emerald-600"
                            />
                            <span>{label}</span>
                          </label>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => void handleSaveProfile()}
                        disabled={isSaving}
                        className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        Save Profile & Settings
                      </button>
                    </div>
                  )}

                  {activeTab === 'materials' && (
                    <div className="space-y-5">
                      <div>
                        <h3 className="text-xl font-black text-slate-950">Preparation Materials</h3>
                        <p className="mt-1 text-sm text-slate-500">
                          PDFs unlock automatically after verified examination payment. Download links expire after five minutes.
                        </p>
                      </div>

                      {materials.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
                          <BookOpen className="mx-auto h-10 w-10 text-slate-300" />
                          <p className="mt-3 font-black text-slate-700">No preparation materials unlocked yet</p>
                          <p className="mt-1 text-sm text-slate-500">
                            Purchase an examination to unlock its available PDF resources.
                          </p>
                        </div>
                      ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                          {materials.map((material) => (
                            <article key={material.material_id} className="rounded-2xl border border-slate-200 p-5 shadow-sm">
                              <div className="flex items-start justify-between gap-4">
                                <div className="rounded-xl bg-emerald-50 p-3 text-emerald-700">
                                  <BookOpen className="h-5 w-5" />
                                </div>
                                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase text-slate-500">
                                  PDF v{material.version}
                                </span>
                              </div>
                              <h4 className="mt-4 text-base font-black text-slate-950">{material.title}</h4>
                              <p className="mt-2 text-sm leading-6 text-slate-500">
                                {material.description || 'Official examination preparation material.'}
                              </p>
                              {material.watermark_required && (
                                <p className="mt-3 text-xs font-semibold text-amber-700">
                                  Candidate-identification and copyright controls apply to this file.
                                </p>
                              )}
                              <button
                                type="button"
                                onClick={() => void handleDownload(material)}
                                disabled={downloadingId === material.material_id}
                                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:opacity-60"
                              >
                                {downloadingId === material.material_id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Download className="h-4 w-4" />
                                )}
                                Download Secure PDF
                              </button>
                            </article>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'credentials' && (
                    <div className="space-y-5">
                      <div>
                        <h3 className="text-xl font-black text-slate-950">Credentials & Digital Badges</h3>
                        <p className="mt-1 text-sm text-slate-500">
                          Share verified achievements while keeping AgileCert Global clearly identified as the issuer powered by IIPM.
                        </p>
                      </div>

                      {credentials.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
                          <Award className="mx-auto h-10 w-10 text-slate-300" />
                          <p className="mt-3 font-black text-slate-700">No issued credentials yet</p>
                          <p className="mt-1 text-sm text-slate-500">
                            Pass an examination and complete certificate payment to receive a certificate and badge.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {credentials.map((credential) => (
                            <article key={credential.id} className="rounded-2xl border border-slate-200 p-5 shadow-sm">
                              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase text-emerald-700">
                                      {credential.status}
                                    </span>
                                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase text-slate-500">
                                      {credential.product_code === 'professional' ? 'Professional' : 'Achievement'}
                                    </span>
                                  </div>
                                  <h4 className="mt-3 text-lg font-black text-slate-950">{credential.credential_title}</h4>
                                  <p className="mt-1 text-sm text-slate-500">{credential.examination_title}</p>
                                  <p className="mt-3 font-mono text-xs font-bold text-slate-600">
                                    Credential ID: {credential.credential_code}
                                  </p>
                                  <p className="mt-1 text-xs text-slate-400">Issued {new Date(credential.issue_date).toLocaleDateString()}</p>
                                </div>

                                <div className="grid min-w-44 grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-center">
                                  <div>
                                    <p className="text-[9px] font-black uppercase text-slate-400">Score</p>
                                    <p className="text-lg font-black text-emerald-700">{credential.score}%</p>
                                  </div>
                                  <div>
                                    <p className="text-[9px] font-black uppercase text-slate-400">Badge</p>
                                    <p className="text-sm font-black text-slate-800">Issued</p>
                                  </div>
                                </div>
                              </div>

                              <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                                <a
                                  href={verificationUrl(credential)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-950 px-3 py-2 text-xs font-black text-white hover:bg-slate-800"
                                >
                                  <ShieldCheck className="h-3.5 w-3.5" /> Verify
                                </a>
                                <button
                                  type="button"
                                  onClick={() => void copyVerificationLink(credential)}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"
                                >
                                  {copiedCredentialId === credential.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                  {copiedCredentialId === credential.id ? 'Copied' : 'Copy Link'}
                                </button>
                                <a
                                  href={linkedinUrl(credential)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#0A66C2] px-3 py-2 text-xs font-black text-white hover:opacity-90"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" /> Add to LinkedIn
                                </a>
                              </div>
                            </article>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {error && (
                <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                  {error}
                </div>
              )}
              {message && (
                <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                  {message}
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

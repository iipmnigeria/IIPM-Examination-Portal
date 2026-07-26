import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  Award,
  Briefcase,
  CheckCircle2,
  Download,
  FileText,
  GraduationCap,
  Languages,
  Link2,
  Loader2,
  Plus,
  Save,
  Sparkles,
  Trash2,
  UserRound,
} from 'lucide-react';
import {
  getMyCandidateCvDocument,
  saveMyCandidateCvDocument,
  type CandidateCvAffiliation,
  type CandidateCvAward,
  type CandidateCvCertification,
  type CandidateCvDocument,
  type CandidateCvEducation,
  type CandidateCvExperience,
  type CandidateCvProject,
  type CandidateCvStatus,
  type CandidateCvTemplateKey,
} from '../services/aiCvProfileBuilderService';
import {
  getAuthenticatedCandidateEmail,
  getMyCandidateProfile,
  type CandidateProfile,
} from '../services/candidateProfileService';
import { renderCandidateCvPdf } from '../services/cvPdfService';

interface AiCvProfileBuilderProps {
  candidateName: string;
  onBack: () => void;
}

interface CvEditorForm {
  documentTitle: string;
  targetRole: string;
  professionalSummary: string;
  contactEmail: string;
  contactPhone: string;
  contactLocation: string;
  linkedinUrl: string;
  portfolioUrl: string;
  skillsText: string;
  languagesText: string;
  experience: CandidateCvExperience[];
  education: CandidateCvEducation[];
  certifications: CandidateCvCertification[];
  projects: CandidateCvProject[];
  awards: CandidateCvAward[];
  affiliations: CandidateCvAffiliation[];
  referencesText: string;
  templateKey: CandidateCvTemplateKey;
  status: CandidateCvStatus;
  aiProcessingConsent: boolean;
  createdAt: string;
  updatedAt: string;
}

const inputClassName =
  'mt-2 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100';
const labelClassName = 'text-xs font-black uppercase tracking-wider text-slate-500';
const cardClassName = 'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm';

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function uniqueCommaList(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function lineList(value: string): string[] {
  return value
    .split('\n')
    .map((item) => item.replace(/^[-•]\s*/, '').trim())
    .filter(Boolean);
}

function joinLines(value: string[] | undefined): string {
  return Array.isArray(value) ? value.join('\n') : '';
}

function emptyExperience(): CandidateCvExperience {
  return {
    id: newId(),
    role: '',
    organisation: '',
    location: '',
    startDate: '',
    endDate: '',
    current: false,
    highlights: [],
  };
}

function emptyEducation(): CandidateCvEducation {
  return {
    id: newId(),
    qualification: '',
    institution: '',
    location: '',
    startDate: '',
    endDate: '',
    details: '',
  };
}

function emptyCertification(): CandidateCvCertification {
  return {
    id: newId(),
    name: '',
    issuer: '',
    issueDate: '',
    credentialId: '',
    credentialUrl: '',
  };
}

function emptyProject(): CandidateCvProject {
  return {
    id: newId(),
    title: '',
    role: '',
    year: '',
    description: '',
    outcomes: [],
  };
}

function emptyAward(): CandidateCvAward {
  return {
    id: newId(),
    title: '',
    issuer: '',
    year: '',
    description: '',
  };
}

function emptyAffiliation(): CandidateCvAffiliation {
  return {
    id: newId(),
    organisation: '',
    membership: '',
    since: '',
  };
}

function defaultForm(candidateName: string): CvEditorForm {
  return {
    documentTitle: `${candidateName || 'Candidate'} Professional CV`,
    targetRole: '',
    professionalSummary: '',
    contactEmail: '',
    contactPhone: '',
    contactLocation: '',
    linkedinUrl: '',
    portfolioUrl: '',
    skillsText: '',
    languagesText: '',
    experience: [],
    education: [],
    certifications: [],
    projects: [],
    awards: [],
    affiliations: [],
    referencesText: '',
    templateKey: 'professional',
    status: 'draft',
    aiProcessingConsent: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function formFromSources(
  document: CandidateCvDocument | null,
  profile: CandidateProfile | null,
  email: string,
  candidateName: string,
): CvEditorForm {
  if (!document) {
    const base = defaultForm(candidateName);
    return {
      ...base,
      targetRole: profile?.professional_headline || '',
      contactEmail: email,
      contactPhone: profile?.phone || '',
      contactLocation: profile?.country_code || '',
      skillsText: profile?.skills.join(', ') || '',
      professionalSummary: profile?.education_summary || '',
    };
  }

  return {
    documentTitle: document.document_title,
    targetRole: document.target_role || profile?.professional_headline || '',
    professionalSummary: document.professional_summary || '',
    contactEmail: document.contact_email || email,
    contactPhone: document.contact_phone || profile?.phone || '',
    contactLocation: document.contact_location || profile?.country_code || '',
    linkedinUrl: document.linkedin_url || '',
    portfolioUrl: document.portfolio_url || '',
    skillsText: document.skills.join(', '),
    languagesText: document.languages.join(', '),
    experience: document.experience,
    education: document.education,
    certifications: document.certifications,
    projects: document.projects,
    awards: document.awards,
    affiliations: document.affiliations,
    referencesText: document.references_text || '',
    templateKey: document.template_key,
    status: document.status,
    aiProcessingConsent: document.ai_processing_consent,
    createdAt: document.created_at,
    updatedAt: document.updated_at,
  };
}

function documentFromForm(form: CvEditorForm): CandidateCvDocument {
  return {
    id: 'preview',
    candidate_id: 'preview',
    document_title: form.documentTitle,
    target_role: form.targetRole || null,
    professional_summary: form.professionalSummary || null,
    contact_email: form.contactEmail || null,
    contact_phone: form.contactPhone || null,
    contact_location: form.contactLocation || null,
    linkedin_url: form.linkedinUrl || null,
    portfolio_url: form.portfolioUrl || null,
    skills: uniqueCommaList(form.skillsText),
    languages: uniqueCommaList(form.languagesText),
    experience: form.experience,
    education: form.education,
    certifications: form.certifications,
    projects: form.projects,
    awards: form.awards,
    affiliations: form.affiliations,
    references_text: form.referencesText || null,
    template_key: form.templateKey,
    status: form.status,
    ai_processing_consent: form.aiProcessingConsent,
    ai_last_enhanced_at: null,
    created_at: form.createdAt,
    updated_at: form.updatedAt,
  };
}

function formatRange(startDate: string, endDate: string, current = false): string {
  return [startDate.trim(), current ? 'Present' : endDate.trim()].filter(Boolean).join(' – ');
}

export default function AiCvProfileBuilder({ candidateName, onBack }: AiCvProfileBuilderProps) {
  const [form, setForm] = useState<CvEditorForm>(() => defaultForm(candidateName));
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setIsLoading(true);
        setError('');
        const [document, profile, email] = await Promise.all([
          getMyCandidateCvDocument(),
          getMyCandidateProfile(),
          getAuthenticatedCandidateEmail(),
        ]);
        if (!active) return;
        setForm(formFromSources(document, profile, email, candidateName));
      } catch (loadError: any) {
        if (!active) return;
        setError(
          loadError?.message ||
            'Your CV workspace could not be loaded. Confirm that the Phase 7 CV migration has been applied.',
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
    const required = [
      form.targetRole,
      form.professionalSummary,
      form.contactEmail,
      form.contactPhone,
      form.skillsText,
    ];
    const baseCount = required.filter((value) => value.trim().length > 0).length;
    const sectionCount = [
      form.experience.length > 0,
      form.education.length > 0,
      form.certifications.length > 0,
      form.projects.length > 0,
    ].filter(Boolean).length;
    return Math.round(((baseCount + sectionCount) / 9) * 100);
  }, [form]);

  const updateForm = <K extends keyof CvEditorForm>(key: K, value: CvEditorForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError('');
      setMessage('');
      const saved = await saveMyCandidateCvDocument({
        documentTitle: form.documentTitle,
        targetRole: form.targetRole,
        professionalSummary: form.professionalSummary,
        contactEmail: form.contactEmail,
        contactPhone: form.contactPhone,
        contactLocation: form.contactLocation,
        linkedinUrl: form.linkedinUrl,
        portfolioUrl: form.portfolioUrl,
        skills: uniqueCommaList(form.skillsText),
        languages: uniqueCommaList(form.languagesText),
        experience: form.experience,
        education: form.education,
        certifications: form.certifications,
        projects: form.projects,
        awards: form.awards,
        affiliations: form.affiliations,
        referencesText: form.referencesText,
        templateKey: form.templateKey,
        status: form.status,
        aiProcessingConsent: form.aiProcessingConsent,
      });
      setForm((current) => ({
        ...current,
        createdAt: saved.created_at,
        updatedAt: saved.updated_at,
      }));
      setMessage('Your private CV draft has been saved securely.');
    } catch (saveError: any) {
      setError(saveError?.message || 'Your CV draft could not be saved.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownload = () => {
    setError('');
    try {
      renderCandidateCvPdf({ candidateName, document: documentFromForm(form) });
    } catch (downloadError: any) {
      setError(downloadError?.message || 'The CV PDF could not be generated.');
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-slate-500">
        <Loader2 className="h-9 w-9 animate-spin text-emerald-600" />
        <p className="text-sm font-bold">Loading your private CV workspace...</p>
      </div>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 md:py-10">
      <button
        type="button"
        onClick={onBack}
        className="mb-5 inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
      >
        <ArrowLeft className="h-4 w-4" /> Back to examinations
      </button>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <header className="bg-slate-950 px-5 py-6 text-white md:px-8">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-600">
                <FileText className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400">
                  Phase 7 Candidate Workspace
                </p>
                <h1 className="mt-1 text-2xl font-black md:text-3xl">AI CV & Professional Profile Builder</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                  Build a structured professional CV, preview it live and download an A4 PDF. Your draft is private and visible only to your authenticated candidate account.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row lg:items-center">
              <div className="min-w-48 rounded-2xl border border-slate-700 bg-slate-900 p-4">
                <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider">
                  <span className="text-slate-400">CV completion</span>
                  <span className="text-emerald-400">{completion}%</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-700">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${completion}%` }} />
                </div>
              </div>
              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 text-sm font-black text-white transition hover:border-emerald-400"
              >
                <Download className="h-4 w-4" /> Download PDF
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={isSaving}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save draft
              </button>
            </div>
          </div>
        </header>

        <div className="space-y-5 p-5 md:p-8">
          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
              {error}
            </div>
          )}
          {message && (
            <div className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> {message}
            </div>
          )}

          <div className="flex items-start gap-3 rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm leading-6 text-violet-900">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-black">AI enhancement is the next controlled increment.</p>
              <p className="text-xs leading-5 text-violet-800">
                This foundation release saves, previews and exports your CV without sending its contents to an AI provider. AI rewriting and role-tailoring will activate only after provider quota and privacy controls are approved.
              </p>
            </div>
          </div>

          <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_390px]">
            <div className="space-y-7">
              <section className={cardClassName}>
                <div className="mb-4 flex items-center gap-3">
                  <UserRound className="h-5 w-5 text-emerald-600" />
                  <div>
                    <h2 className="font-black text-slate-900">Professional identity and contact</h2>
                    <p className="text-sm text-slate-500">Set the role and contact details displayed on the CV.</p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className={labelClassName}>
                    CV document title
                    <input className={inputClassName} value={form.documentTitle} onChange={(event) => updateForm('documentTitle', event.target.value)} />
                  </label>
                  <label className={labelClassName}>
                    Target role or professional headline
                    <input className={inputClassName} value={form.targetRole} onChange={(event) => updateForm('targetRole', event.target.value)} placeholder="Senior Project Manager | HR Consultant" />
                  </label>
                  <label className={labelClassName}>
                    Contact email
                    <input className={inputClassName} value={form.contactEmail} onChange={(event) => updateForm('contactEmail', event.target.value)} type="email" />
                  </label>
                  <label className={labelClassName}>
                    Contact telephone
                    <input className={inputClassName} value={form.contactPhone} onChange={(event) => updateForm('contactPhone', event.target.value)} />
                  </label>
                  <label className={labelClassName}>
                    Location
                    <input className={inputClassName} value={form.contactLocation} onChange={(event) => updateForm('contactLocation', event.target.value)} placeholder="Abuja, Nigeria" />
                  </label>
                  <label className={labelClassName}>
                    CV status
                    <select className={inputClassName} value={form.status} onChange={(event) => updateForm('status', event.target.value as CandidateCvStatus)}>
                      <option value="draft">Draft</option>
                      <option value="ready">Ready for use</option>
                    </select>
                  </label>
                  <label className={labelClassName}>
                    LinkedIn URL
                    <input className={inputClassName} value={form.linkedinUrl} onChange={(event) => updateForm('linkedinUrl', event.target.value)} placeholder="https://www.linkedin.com/in/..." />
                  </label>
                  <label className={labelClassName}>
                    Portfolio URL
                    <input className={inputClassName} value={form.portfolioUrl} onChange={(event) => updateForm('portfolioUrl', event.target.value)} placeholder="https://..." />
                  </label>
                  <label className={`${labelClassName} md:col-span-2`}>
                    Professional summary
                    <textarea className={`${inputClassName} min-h-32 resize-y`} value={form.professionalSummary} onChange={(event) => updateForm('professionalSummary', event.target.value)} placeholder="Summarise your experience, specialist strengths and professional value." />
                  </label>
                  <label className={labelClassName}>
                    Core skills
                    <textarea className={`${inputClassName} min-h-24 resize-y`} value={form.skillsText} onChange={(event) => updateForm('skillsText', event.target.value)} placeholder="Project planning, stakeholder management, HR analytics" />
                    <span className="mt-1 block text-[11px] normal-case tracking-normal text-slate-400">Separate skills with commas.</span>
                  </label>
                  <label className={labelClassName}>
                    Languages
                    <textarea className={`${inputClassName} min-h-24 resize-y`} value={form.languagesText} onChange={(event) => updateForm('languagesText', event.target.value)} placeholder="English, French" />
                    <span className="mt-1 block text-[11px] normal-case tracking-normal text-slate-400">Separate languages with commas.</span>
                  </label>
                </div>
              </section>

              <section className={cardClassName}>
                <SectionHeader icon={<Briefcase className="h-5 w-5" />} title="Professional experience" description="Add roles in reverse chronological order." onAdd={() => updateForm('experience', [...form.experience, emptyExperience()])} />
                <div className="space-y-4">
                  {form.experience.length === 0 && <EmptySection text="No professional experience entries added yet." />}
                  {form.experience.map((item, index) => (
                    <article key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <ItemToolbar label={`Experience ${index + 1}`} onDelete={() => updateForm('experience', form.experience.filter((entry) => entry.id !== item.id))} />
                      <div className="grid gap-4 md:grid-cols-2">
                        <label className={labelClassName}>Role<input className={inputClassName} value={item.role} onChange={(event) => updateForm('experience', form.experience.map((entry) => entry.id === item.id ? { ...entry, role: event.target.value } : entry))} /></label>
                        <label className={labelClassName}>Organisation<input className={inputClassName} value={item.organisation} onChange={(event) => updateForm('experience', form.experience.map((entry) => entry.id === item.id ? { ...entry, organisation: event.target.value } : entry))} /></label>
                        <label className={labelClassName}>Location<input className={inputClassName} value={item.location} onChange={(event) => updateForm('experience', form.experience.map((entry) => entry.id === item.id ? { ...entry, location: event.target.value } : entry))} /></label>
                        <div className="grid grid-cols-2 gap-3">
                          <label className={labelClassName}>Start<input className={inputClassName} value={item.startDate} onChange={(event) => updateForm('experience', form.experience.map((entry) => entry.id === item.id ? { ...entry, startDate: event.target.value } : entry))} placeholder="Jan 2022" /></label>
                          <label className={labelClassName}>End<input className={inputClassName} value={item.endDate} disabled={item.current} onChange={(event) => updateForm('experience', form.experience.map((entry) => entry.id === item.id ? { ...entry, endDate: event.target.value } : entry))} placeholder="Dec 2025" /></label>
                        </div>
                        <label className="flex items-center gap-2 text-sm font-bold text-slate-700 md:col-span-2">
                          <input type="checkbox" checked={item.current} onChange={(event) => updateForm('experience', form.experience.map((entry) => entry.id === item.id ? { ...entry, current: event.target.checked, endDate: event.target.checked ? '' : entry.endDate } : entry))} className="h-4 w-4 accent-emerald-600" /> Current role
                        </label>
                        <label className={`${labelClassName} md:col-span-2`}>Achievements and responsibilities<textarea className={`${inputClassName} min-h-28 resize-y`} value={joinLines(item.highlights)} onChange={(event) => updateForm('experience', form.experience.map((entry) => entry.id === item.id ? { ...entry, highlights: lineList(event.target.value) } : entry))} placeholder="Enter one achievement per line." /></label>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className={cardClassName}>
                <SectionHeader icon={<GraduationCap className="h-5 w-5" />} title="Education" description="Add degrees, diplomas and significant professional education." onAdd={() => updateForm('education', [...form.education, emptyEducation()])} />
                <div className="space-y-4">
                  {form.education.length === 0 && <EmptySection text="No education entries added yet." />}
                  {form.education.map((item, index) => (
                    <article key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <ItemToolbar label={`Education ${index + 1}`} onDelete={() => updateForm('education', form.education.filter((entry) => entry.id !== item.id))} />
                      <div className="grid gap-4 md:grid-cols-2">
                        <label className={labelClassName}>Qualification<input className={inputClassName} value={item.qualification} onChange={(event) => updateForm('education', form.education.map((entry) => entry.id === item.id ? { ...entry, qualification: event.target.value } : entry))} /></label>
                        <label className={labelClassName}>Institution<input className={inputClassName} value={item.institution} onChange={(event) => updateForm('education', form.education.map((entry) => entry.id === item.id ? { ...entry, institution: event.target.value } : entry))} /></label>
                        <label className={labelClassName}>Location<input className={inputClassName} value={item.location} onChange={(event) => updateForm('education', form.education.map((entry) => entry.id === item.id ? { ...entry, location: event.target.value } : entry))} /></label>
                        <div className="grid grid-cols-2 gap-3">
                          <label className={labelClassName}>Start<input className={inputClassName} value={item.startDate} onChange={(event) => updateForm('education', form.education.map((entry) => entry.id === item.id ? { ...entry, startDate: event.target.value } : entry))} /></label>
                          <label className={labelClassName}>End<input className={inputClassName} value={item.endDate} onChange={(event) => updateForm('education', form.education.map((entry) => entry.id === item.id ? { ...entry, endDate: event.target.value } : entry))} /></label>
                        </div>
                        <label className={`${labelClassName} md:col-span-2`}>Details<textarea className={`${inputClassName} min-h-20 resize-y`} value={item.details} onChange={(event) => updateForm('education', form.education.map((entry) => entry.id === item.id ? { ...entry, details: event.target.value } : entry))} /></label>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className={cardClassName}>
                <SectionHeader icon={<Award className="h-5 w-5" />} title="Certifications" description="Add professional certifications and licences." onAdd={() => updateForm('certifications', [...form.certifications, emptyCertification()])} />
                <div className="space-y-4">
                  {form.certifications.length === 0 && <EmptySection text="No certification entries added yet." />}
                  {form.certifications.map((item, index) => (
                    <article key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <ItemToolbar label={`Certification ${index + 1}`} onDelete={() => updateForm('certifications', form.certifications.filter((entry) => entry.id !== item.id))} />
                      <div className="grid gap-4 md:grid-cols-2">
                        <label className={labelClassName}>Certification name<input className={inputClassName} value={item.name} onChange={(event) => updateForm('certifications', form.certifications.map((entry) => entry.id === item.id ? { ...entry, name: event.target.value } : entry))} /></label>
                        <label className={labelClassName}>Issuer<input className={inputClassName} value={item.issuer} onChange={(event) => updateForm('certifications', form.certifications.map((entry) => entry.id === item.id ? { ...entry, issuer: event.target.value } : entry))} /></label>
                        <label className={labelClassName}>Issue date<input className={inputClassName} value={item.issueDate} onChange={(event) => updateForm('certifications', form.certifications.map((entry) => entry.id === item.id ? { ...entry, issueDate: event.target.value } : entry))} /></label>
                        <label className={labelClassName}>Credential ID<input className={inputClassName} value={item.credentialId} onChange={(event) => updateForm('certifications', form.certifications.map((entry) => entry.id === item.id ? { ...entry, credentialId: event.target.value } : entry))} /></label>
                        <label className={`${labelClassName} md:col-span-2`}>Credential URL<input className={inputClassName} value={item.credentialUrl} onChange={(event) => updateForm('certifications', form.certifications.map((entry) => entry.id === item.id ? { ...entry, credentialUrl: event.target.value } : entry))} /></label>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className={cardClassName}>
                <SectionHeader icon={<FileText className="h-5 w-5" />} title="Selected projects" description="Showcase relevant assignments, programmes and measurable outcomes." onAdd={() => updateForm('projects', [...form.projects, emptyProject()])} />
                <div className="space-y-4">
                  {form.projects.length === 0 && <EmptySection text="No project entries added yet." />}
                  {form.projects.map((item, index) => (
                    <article key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <ItemToolbar label={`Project ${index + 1}`} onDelete={() => updateForm('projects', form.projects.filter((entry) => entry.id !== item.id))} />
                      <div className="grid gap-4 md:grid-cols-2">
                        <label className={labelClassName}>Project title<input className={inputClassName} value={item.title} onChange={(event) => updateForm('projects', form.projects.map((entry) => entry.id === item.id ? { ...entry, title: event.target.value } : entry))} /></label>
                        <label className={labelClassName}>Your role<input className={inputClassName} value={item.role} onChange={(event) => updateForm('projects', form.projects.map((entry) => entry.id === item.id ? { ...entry, role: event.target.value } : entry))} /></label>
                        <label className={labelClassName}>Year or period<input className={inputClassName} value={item.year} onChange={(event) => updateForm('projects', form.projects.map((entry) => entry.id === item.id ? { ...entry, year: event.target.value } : entry))} /></label>
                        <label className={`${labelClassName} md:col-span-2`}>Description<textarea className={`${inputClassName} min-h-20 resize-y`} value={item.description} onChange={(event) => updateForm('projects', form.projects.map((entry) => entry.id === item.id ? { ...entry, description: event.target.value } : entry))} /></label>
                        <label className={`${labelClassName} md:col-span-2`}>Outcomes<textarea className={`${inputClassName} min-h-24 resize-y`} value={joinLines(item.outcomes)} onChange={(event) => updateForm('projects', form.projects.map((entry) => entry.id === item.id ? { ...entry, outcomes: lineList(event.target.value) } : entry))} placeholder="Enter one outcome per line." /></label>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className={cardClassName}>
                <SectionHeader icon={<Award className="h-5 w-5" />} title="Awards and recognition" description="Add relevant awards, honours and professional recognition." onAdd={() => updateForm('awards', [...form.awards, emptyAward()])} />
                <div className="space-y-4">
                  {form.awards.length === 0 && <EmptySection text="No awards added yet." />}
                  {form.awards.map((item, index) => (
                    <article key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <ItemToolbar label={`Award ${index + 1}`} onDelete={() => updateForm('awards', form.awards.filter((entry) => entry.id !== item.id))} />
                      <div className="grid gap-4 md:grid-cols-2">
                        <label className={labelClassName}>Title<input className={inputClassName} value={item.title} onChange={(event) => updateForm('awards', form.awards.map((entry) => entry.id === item.id ? { ...entry, title: event.target.value } : entry))} /></label>
                        <label className={labelClassName}>Issuer<input className={inputClassName} value={item.issuer} onChange={(event) => updateForm('awards', form.awards.map((entry) => entry.id === item.id ? { ...entry, issuer: event.target.value } : entry))} /></label>
                        <label className={labelClassName}>Year<input className={inputClassName} value={item.year} onChange={(event) => updateForm('awards', form.awards.map((entry) => entry.id === item.id ? { ...entry, year: event.target.value } : entry))} /></label>
                        <label className={`${labelClassName} md:col-span-2`}>Description<textarea className={`${inputClassName} min-h-20 resize-y`} value={item.description} onChange={(event) => updateForm('awards', form.awards.map((entry) => entry.id === item.id ? { ...entry, description: event.target.value } : entry))} /></label>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className={cardClassName}>
                <SectionHeader icon={<Link2 className="h-5 w-5" />} title="Professional affiliations" description="Add memberships and professional bodies." onAdd={() => updateForm('affiliations', [...form.affiliations, emptyAffiliation()])} />
                <div className="space-y-4">
                  {form.affiliations.length === 0 && <EmptySection text="No professional affiliations added yet." />}
                  {form.affiliations.map((item, index) => (
                    <article key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <ItemToolbar label={`Affiliation ${index + 1}`} onDelete={() => updateForm('affiliations', form.affiliations.filter((entry) => entry.id !== item.id))} />
                      <div className="grid gap-4 md:grid-cols-3">
                        <label className={labelClassName}>Organisation<input className={inputClassName} value={item.organisation} onChange={(event) => updateForm('affiliations', form.affiliations.map((entry) => entry.id === item.id ? { ...entry, organisation: event.target.value } : entry))} /></label>
                        <label className={labelClassName}>Membership or grade<input className={inputClassName} value={item.membership} onChange={(event) => updateForm('affiliations', form.affiliations.map((entry) => entry.id === item.id ? { ...entry, membership: event.target.value } : entry))} /></label>
                        <label className={labelClassName}>Since<input className={inputClassName} value={item.since} onChange={(event) => updateForm('affiliations', form.affiliations.map((entry) => entry.id === item.id ? { ...entry, since: event.target.value } : entry))} /></label>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className={cardClassName}>
                <div className="mb-4 flex items-center gap-3">
                  <Languages className="h-5 w-5 text-emerald-600" />
                  <div>
                    <h2 className="font-black text-slate-900">References and future AI consent</h2>
                    <p className="text-sm text-slate-500">References are optional. AI consent does not activate AI processing in this release.</p>
                  </div>
                </div>
                <label className={labelClassName}>
                  References
                  <textarea className={`${inputClassName} min-h-24 resize-y`} value={form.referencesText} onChange={(event) => updateForm('referencesText', event.target.value)} placeholder="Available on request, or list approved referees." />
                </label>
                <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border border-violet-200 bg-violet-50 p-4">
                  <input type="checkbox" checked={form.aiProcessingConsent} onChange={(event) => updateForm('aiProcessingConsent', event.target.checked)} className="mt-1 h-4 w-4 accent-violet-600" />
                  <span>
                    <span className="block text-sm font-black text-violet-900">Record consent for future AI CV assistance</span>
                    <span className="mt-1 block text-xs leading-5 text-violet-800">This records your preference only. No CV content is sent to an AI provider in Phase 7.1.</span>
                  </span>
                </label>
              </section>
            </div>

            <CvPreview candidateName={candidateName} form={form} />
          </div>
        </div>
      </section>
    </main>
  );
}

function SectionHeader({
  icon,
  title,
  description,
  onAdd,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  onAdd: () => void;
}) {
  return (
    <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <div className="flex items-center gap-3 text-emerald-600">
        {icon}
        <div>
          <h2 className="font-black text-slate-900">{title}</h2>
          <p className="text-sm text-slate-500">{description}</p>
        </div>
      </div>
      <button type="button" onClick={onAdd} className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-800 hover:bg-emerald-100">
        <Plus className="h-4 w-4" /> Add entry
      </button>
    </div>
  );
}

function ItemToolbar({ label, onDelete }: { label: string; onDelete: () => void }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <span className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</span>
      <button type="button" onClick={onDelete} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50">
        <Trash2 className="h-3.5 w-3.5" /> Remove
      </button>
    </div>
  );
}

function EmptySection({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm font-semibold text-slate-400">{text}</div>;
}

function CvPreview({ candidateName, form }: { candidateName: string; form: CvEditorForm }) {
  const skills = uniqueCommaList(form.skillsText);
  const languages = uniqueCommaList(form.languagesText);

  return (
    <aside className="self-start xl:sticky xl:top-24">
      <div className="overflow-hidden rounded-3xl border border-slate-300 bg-white shadow-xl">
        <div className="bg-slate-950 px-6 py-7 text-white">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">Live A4 preview</p>
          <h2 className="mt-2 text-2xl font-black leading-tight">{candidateName || 'Professional Candidate'}</h2>
          <p className="mt-2 text-sm font-semibold text-emerald-300">{form.targetRole || form.documentTitle}</p>
          <div className="mt-4 space-y-1 text-[10px] text-slate-300">
            {[form.contactEmail, form.contactPhone, form.contactLocation].filter(Boolean).map((item) => <p key={item}>{item}</p>)}
          </div>
        </div>
        <div className="max-h-[calc(100vh-220px)] space-y-5 overflow-y-auto p-6 text-slate-700">
          {form.professionalSummary && <PreviewSection title="Professional Summary"><p className="text-xs leading-5">{form.professionalSummary}</p></PreviewSection>}
          {skills.length > 0 && <PreviewSection title="Core Skills"><p className="text-xs leading-5">{skills.join(' • ')}</p></PreviewSection>}
          {form.experience.length > 0 && (
            <PreviewSection title="Experience">
              <div className="space-y-4">
                {form.experience.slice(0, 5).map((item) => (
                  <div key={item.id}>
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-xs font-black text-slate-900">{item.role || 'Role'}</p>
                      <p className="shrink-0 text-[9px] text-slate-400">{formatRange(item.startDate, item.endDate, item.current)}</p>
                    </div>
                    <p className="text-[10px] font-semibold text-slate-500">{[item.organisation, item.location].filter(Boolean).join(' · ')}</p>
                    {item.highlights.length > 0 && <ul className="mt-1 list-disc space-y-1 pl-4 text-[10px] leading-4">{item.highlights.slice(0, 4).map((highlight) => <li key={highlight}>{highlight}</li>)}</ul>}
                  </div>
                ))}
              </div>
            </PreviewSection>
          )}
          {form.education.length > 0 && (
            <PreviewSection title="Education">
              <div className="space-y-3">{form.education.slice(0, 5).map((item) => <div key={item.id}><p className="text-xs font-black text-slate-900">{item.qualification || 'Qualification'}</p><p className="text-[10px] text-slate-500">{[item.institution, formatRange(item.startDate, item.endDate)].filter(Boolean).join(' · ')}</p></div>)}</div>
            </PreviewSection>
          )}
          {form.certifications.length > 0 && (
            <PreviewSection title="Certifications">
              <div className="space-y-2">{form.certifications.slice(0, 6).map((item) => <div key={item.id}><p className="text-xs font-black text-slate-900">{item.name || 'Certification'}</p><p className="text-[10px] text-slate-500">{[item.issuer, item.issueDate].filter(Boolean).join(' · ')}</p></div>)}</div>
            </PreviewSection>
          )}
          {form.projects.length > 0 && (
            <PreviewSection title="Selected Projects">
              <div className="space-y-3">{form.projects.slice(0, 4).map((item) => <div key={item.id}><p className="text-xs font-black text-slate-900">{item.title || 'Project'}</p><p className="text-[10px] text-slate-500">{[item.role, item.year].filter(Boolean).join(' · ')}</p>{item.description && <p className="mt-1 text-[10px] leading-4">{item.description}</p>}</div>)}</div>
            </PreviewSection>
          )}
          {languages.length > 0 && <PreviewSection title="Languages"><p className="text-xs leading-5">{languages.join(' • ')}</p></PreviewSection>}
          <div className="border-t border-slate-200 pt-4 text-[9px] leading-4 text-slate-400">Private candidate draft · {form.status === 'ready' ? 'Ready for use' : 'Draft'} · Template: {form.templateKey}</div>
        </div>
      </div>
    </aside>
  );
}

function PreviewSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 border-b border-slate-200 pb-1 text-[10px] font-black uppercase tracking-wider text-emerald-700">{title}</h3>
      {children}
    </section>
  );
}

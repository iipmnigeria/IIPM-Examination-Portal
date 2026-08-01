import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  Award,
  BadgeCheck,
  Building2,
  CheckCircle2,
  Eye,
  FileCheck2,
  FileImage,
  History,
  KeyRound,
  Layers3,
  Link2,
  Loader2,
  RefreshCw,
  Rocket,
  Save,
  Send,
  ShieldCheck,
  UploadCloud,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import {
  assignCertificateTemplate,
  createCertificateFileSignedUrl,
  createCertificateTemplate,
  getCertificateManagementSnapshot,
  reviewCertificateTemplateQuality,
  saveCertificateCategory,
  saveCertificateInstitution,
  setCertificateAssetStatus,
  setCertificateAssignmentActive,
  setCertificatePermission,
  transitionCertificateTemplateVersion,
  uploadCertificateAsset,
  uploadCertificateMaster,
  type CertificateAssetType,
  type CertificateAssignmentScope,
  type CertificateCategory,
  type CertificateInstitution,
  type CertificateManagementSnapshot,
  type CertificatePermissionKey,
  type CertificateTemplateVersion,
} from '../services/certificateTemplateAdminService';

type ConsoleTab =
  | 'overview'
  | 'institutions'
  | 'categories'
  | 'templates'
  | 'assets'
  | 'assignments'
  | 'permissions'
  | 'audit';

type InstitutionDraft = {
  id: string;
  code: string;
  name: string;
  shortName: string;
  legalName: string;
  registrationDetails: string;
  countryCode: string;
  website: string;
  contactEmail: string;
  isActive: boolean;
};

type CategoryDraft = {
  id: string;
  code: string;
  name: string;
  description: string;
  requiresIdentityVerification: boolean;
  requiresScore: boolean;
  sortOrder: number;
  isActive: boolean;
};

type TemplateDraft = {
  institutionId: string;
  categoryId: string;
  code: string;
  name: string;
  description: string;
  orientation: 'portrait' | 'landscape';
  pageSize: 'A4' | 'Letter' | 'Legal' | 'Custom';
  notes: string;
};

type AssetDraft = {
  institutionId: string;
  assetType: CertificateAssetType;
  name: string;
};

type AssignmentDraft = {
  versionId: string;
  scopeType: CertificateAssignmentScope;
  programmeId: string;
  examinationId: string;
  priority: number;
  effectiveFrom: string;
  effectiveTo: string;
};

type SummaryCard = {
  label: string;
  value: number;
  icon: LucideIcon;
  iconClass: string;
};

const emptySnapshot: CertificateManagementSnapshot = {
  access: {
    actorId: '',
    role: '',
    permissions: [],
    canViewConsole: false,
    canManageInstitutions: false,
    canManageCategories: false,
    canManageTemplates: false,
    canReviewTemplates: false,
    canApproveTemplates: false,
    canPublishTemplates: false,
    canManageAssets: false,
    canApproveAssets: false,
    canManageAssignments: false,
    canManagePermissions: false,
  },
  summary: {
    institutions: 0,
    categories: 0,
    templates: 0,
    publishedTemplates: 0,
    versionsAwaitingReview: 0,
    approvedAssets: 0,
    activeAssignments: 0,
  },
  institutions: [],
  categories: [],
  templates: [],
  versions: [],
  assets: [],
  assignments: [],
  programmes: [],
  examinations: [],
  permissionMatrix: [],
  audit: [],
};

const newInstitution = (): InstitutionDraft => ({
  id: '',
  code: '',
  name: '',
  shortName: '',
  legalName: '',
  registrationDetails: '',
  countryCode: 'NG',
  website: '',
  contactEmail: '',
  isActive: true,
});

const newCategory = (): CategoryDraft => ({
  id: '',
  code: '',
  name: '',
  description: '',
  requiresIdentityVerification: false,
  requiresScore: false,
  sortOrder: 100,
  isActive: true,
});

const newTemplate = (): TemplateDraft => ({
  institutionId: '',
  categoryId: '',
  code: '',
  name: '',
  description: '',
  orientation: 'landscape',
  pageSize: 'A4',
  notes: '',
});

const newAsset = (): AssetDraft => ({
  institutionId: '',
  assetType: 'logo',
  name: '',
});

const newAssignment = (): AssignmentDraft => ({
  versionId: '',
  scopeType: 'global',
  programmeId: '',
  examinationId: '',
  priority: 100,
  effectiveFrom: '',
  effectiveTo: '',
});

const formatDate = (value?: string | null): string => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
};

const formatSize = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(2)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

const statusClass = (status: string): string => {
  if (['active', 'approved', 'passed', 'published'].includes(status)) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }
  if (['draft', 'in_review', 'pending', 'changes_requested'].includes(status)) {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }
  if (['failed', 'rejected', 'retired', 'superseded'].includes(status)) {
    return 'border-rose-200 bg-rose-50 text-rose-700';
  }
  return 'border-slate-200 bg-slate-50 text-slate-700';
};

const StatusBadge = ({ value }: { value: string }) => (
  <span className={`rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-wide ${statusClass(value)}`}>
    {value.replaceAll('_', ' ')}
  </span>
);

const fieldClass = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100';
const primaryButton = 'inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-xs font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-45';
const secondaryButton = 'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-black text-slate-600 transition hover:bg-slate-50 disabled:opacity-45';

export default function AdminCertificateTemplateConsole() {
  const [snapshot, setSnapshot] = useState<CertificateManagementSnapshot>(emptySnapshot);
  const [tab, setTab] = useState<ConsoleTab>('overview');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [institution, setInstitution] = useState<InstitutionDraft>(newInstitution());
  const [category, setCategory] = useState<CategoryDraft>(newCategory());
  const [template, setTemplate] = useState<TemplateDraft>(newTemplate());
  const [masterTemplateId, setMasterTemplateId] = useState('');
  const [masterFile, setMasterFile] = useState<File | null>(null);
  const [masterNotes, setMasterNotes] = useState('');
  const [asset, setAsset] = useState<AssetDraft>(newAsset());
  const [assetFile, setAssetFile] = useState<File | null>(null);
  const [assignment, setAssignment] = useState<AssignmentDraft>(newAssignment());
  const [permissionReason, setPermissionReason] = useState('Approved certificate administration responsibility update');

  const refresh = async () => {
    try {
      setLoading(true);
      setError('');
      const next = await getCertificateManagementSnapshot(500);
      setSnapshot(next);
      const defaultInstitution = next.institutions.find((item) => item.isActive)?.id || '';
      const defaultCategory = next.categories.find((item) => item.isActive)?.id || '';
      setTemplate((current) => ({
        ...current,
        institutionId: current.institutionId || defaultInstitution,
        categoryId: current.categoryId || defaultCategory,
      }));
      setAsset((current) => ({
        ...current,
        institutionId: current.institutionId || defaultInstitution,
      }));
      setMasterTemplateId((current) => current || next.templates[0]?.id || '');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load Certificate Management Console.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const execute = async (key: string, action: () => Promise<void>, success: string) => {
    try {
      setBusy(key);
      setError('');
      setMessage('');
      await action();
      setMessage(success);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Certificate administration action failed.');
    } finally {
      setBusy('');
    }
  };

  const tabs = useMemo(() => {
    const items: Array<{ id: ConsoleTab; label: string; icon: LucideIcon }> = [
      { id: 'overview', label: 'Overview', icon: Award },
      { id: 'institutions', label: 'Institutions', icon: Building2 },
      { id: 'categories', label: 'Categories', icon: Layers3 },
      { id: 'templates', label: 'Master Templates', icon: FileCheck2 },
      { id: 'assets', label: 'Asset Library', icon: FileImage },
      { id: 'assignments', label: 'Assignments', icon: Link2 },
      { id: 'audit', label: 'Audit', icon: History },
    ];
    if (snapshot.access.canManagePermissions) {
      items.splice(items.length - 1, 0, { id: 'permissions', label: 'Permissions', icon: KeyRound });
    }
    return items;
  }, [snapshot.access.canManagePermissions]);

  const publishedVersions = useMemo(
    () => snapshot.versions.filter((version) => version.status === 'published'),
    [snapshot.versions],
  );

  const summaryCards: SummaryCard[] = [
    { label: 'Institutions', value: snapshot.summary.institutions, icon: Building2, iconClass: 'text-blue-600' },
    { label: 'Categories', value: snapshot.summary.categories, icon: Layers3, iconClass: 'text-violet-600' },
    { label: 'Templates', value: snapshot.summary.templates, icon: FileCheck2, iconClass: 'text-slate-700' },
    { label: 'Published', value: snapshot.summary.publishedTemplates, icon: Rocket, iconClass: 'text-emerald-600' },
    { label: 'Awaiting review', value: snapshot.summary.versionsAwaitingReview, icon: ShieldCheck, iconClass: 'text-amber-600' },
    { label: 'Approved assets', value: snapshot.summary.approvedAssets, icon: BadgeCheck, iconClass: 'text-teal-600' },
    { label: 'Assignments', value: snapshot.summary.activeAssignments, icon: Link2, iconClass: 'text-indigo-600' },
  ];

  const editInstitution = (record: CertificateInstitution) => {
    setInstitution({
      id: record.id,
      code: record.code,
      name: record.name,
      shortName: record.shortName || '',
      legalName: record.legalName || '',
      registrationDetails: record.registrationDetails || '',
      countryCode: record.countryCode,
      website: record.website || '',
      contactEmail: record.contactEmail || '',
      isActive: record.isActive,
    });
  };

  const editCategory = (record: CertificateCategory) => {
    setCategory({
      id: record.id,
      code: record.code,
      name: record.name,
      description: record.description,
      requiresIdentityVerification: record.requiresIdentityVerification,
      requiresScore: record.requiresScore,
      sortOrder: record.sortOrder,
      isActive: record.isActive,
    });
  };

  const openPrivateFile = async (bucket: string, path: string) => {
    try {
      setBusy(`open:${path}`);
      const url = await createCertificateFileSignedUrl(bucket, path);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to open the private certificate file.');
    } finally {
      setBusy('');
    }
  };

  const qualityReview = async (version: CertificateTemplateVersion, result: 'passed' | 'failed' | 'waived') => {
    const notes = window.prompt(
      result === 'passed'
        ? 'Record the print-review evidence:'
        : result === 'failed'
          ? 'Describe the quality defects:'
          : 'Document the restricted waiver reason:',
    )?.trim();
    if (!notes) return;
    await execute(
      `quality:${version.id}`,
      () => reviewCertificateTemplateQuality({
        versionId: version.id,
        qualityStatus: result,
        notes,
        report: {
          reviewedAt: new Date().toISOString(),
          visualComparisonCompleted: true,
          singlePageReviewed: true,
          longContentReviewed: true,
          identityAssetClarityReviewed: true,
          qrScanReviewed: true,
          physicalPrintReviewRecorded: result !== 'failed',
          notes,
        },
      }),
      `Template quality review recorded as ${result}.`,
    );
  };

  const transition = async (
    version: CertificateTemplateVersion,
    action: 'submit_review' | 'request_changes' | 'reject' | 'approve' | 'publish' | 'retire',
  ) => {
    if (['publish', 'retire', 'reject'].includes(action) && !window.confirm(`${action.replaceAll('_', ' ')} ${version.templateName} v${version.versionNumber}?`)) {
      return;
    }
    const notes = window.prompt('Optional workflow note:')?.trim() || '';
    await execute(
      `version:${version.id}`,
      () => transitionCertificateTemplateVersion({ versionId: version.id, action, notes }),
      `Template version ${action.replaceAll('_', ' ')} completed.`,
    );
  };

  if (loading && !snapshot.access.actorId) {
    return (
      <div className="grid min-h-[65vh] place-items-center">
        <div className="flex items-center gap-3 text-sm font-bold text-slate-500">
          <Loader2 className="h-7 w-7 animate-spin text-emerald-600" /> Loading Certificate Management Console…
        </div>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-[1480px] space-y-6 px-4 py-6 text-slate-900 md:px-6">
      <section className="overflow-hidden rounded-3xl bg-slate-950 text-white shadow-xl">
        <div className="flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">Multi-institution certificate control plane</p>
            <h1 className="mt-2 text-2xl font-black">Master Template Administration</h1>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">
              Govern issuing institutions, extensible certificate categories, immutable source masters, institutional assets, approval workflow and programme assignments.
            </p>
          </div>
          <button type="button" onClick={() => void refresh()} disabled={loading} className={primaryButton}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
        <nav className="flex flex-wrap gap-2 border-t border-slate-800 px-4 py-3 md:px-6">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black ${tab === id ? 'bg-white text-slate-950' : 'text-slate-400 hover:bg-slate-900 hover:text-white'}`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </nav>
      </section>

      {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{message}</div>}
      {error && <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}

      {tab === 'overview' && (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            {summaryCards.map(({ label, value, icon: Icon, iconClass }) => (
              <article key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <Icon className={`h-5 w-5 ${iconClass}`} />
                <p className="mt-3 text-2xl font-black">{value}</p>
                <p className="mt-1 text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</p>
              </article>
            ))}
          </section>
          <section className="grid gap-5 lg:grid-cols-2">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-black">Phase 1A authority</h2>
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                {[
                  'Institution and certificate-category administration',
                  'Private, immutable PDF/SVG/PNG/JPEG master versions',
                  'Institutional logo, seal, watermark and signature library',
                  'Independent quality review, approval and publication controls',
                  'Global, programme and examination master assignments',
                  'Dedicated permissions and immutable audit history',
                ].map((item) => <p key={item} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{item}</p>)}
              </div>
            </article>
            <article className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
              <h2 className="font-black text-amber-950">Production renderer remains unchanged</h2>
              <p className="mt-3 text-sm leading-6 text-amber-900/80">
                This phase does not modify eligibility, payment, examination results, issued certificate records, verification codes or current PDF renderers. Published masters prepare a controlled Phase 1B server-side renderer integration.
              </p>
            </article>
          </section>
        </>
      )}

      {tab === 'institutions' && (
        <section className="grid gap-6 xl:grid-cols-[400px_1fr]">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 font-black"><Building2 className="h-5 w-5 text-blue-600" />{institution.id ? 'Update institution' : 'Add issuing institution'}</h2>
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-bold">Code<input className={fieldClass} value={institution.code} onChange={(event) => setInstitution({ ...institution, code: event.target.value.toUpperCase() })} /></label>
                <label className="text-xs font-bold">Country<input className={fieldClass} value={institution.countryCode} onChange={(event) => setInstitution({ ...institution, countryCode: event.target.value.toUpperCase().slice(0, 2) })} /></label>
              </div>
              <label className="text-xs font-bold">Official name<input className={fieldClass} value={institution.name} onChange={(event) => setInstitution({ ...institution, name: event.target.value })} /></label>
              <label className="text-xs font-bold">Short name<input className={fieldClass} value={institution.shortName} onChange={(event) => setInstitution({ ...institution, shortName: event.target.value })} /></label>
              <label className="text-xs font-bold">Legal name<input className={fieldClass} value={institution.legalName} onChange={(event) => setInstitution({ ...institution, legalName: event.target.value })} /></label>
              <label className="text-xs font-bold">Registration details<textarea className={`${fieldClass} min-h-20`} value={institution.registrationDetails} onChange={(event) => setInstitution({ ...institution, registrationDetails: event.target.value })} /></label>
              <label className="text-xs font-bold">Website<input className={fieldClass} value={institution.website} onChange={(event) => setInstitution({ ...institution, website: event.target.value })} /></label>
              <label className="text-xs font-bold">Contact email<input className={fieldClass} value={institution.contactEmail} onChange={(event) => setInstitution({ ...institution, contactEmail: event.target.value })} /></label>
              <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={institution.isActive} onChange={(event) => setInstitution({ ...institution, isActive: event.target.checked })} />Active</label>
              <div className="flex gap-2">
                <button type="button" className={`${primaryButton} flex-1`} disabled={!snapshot.access.canManageInstitutions || busy === 'institution'} onClick={() => void execute('institution', async () => { await saveCertificateInstitution({ ...institution, id: institution.id || null }); setInstitution(newInstitution()); }, institution.id ? 'Institution updated.' : 'Institution created.')}><Save className="h-4 w-4" />Save</button>
                {institution.id && <button type="button" className={secondaryButton} onClick={() => setInstitution(newInstitution())}>Cancel</button>}
              </div>
            </div>
          </article>
          <div className="grid content-start gap-4 md:grid-cols-2">
            {snapshot.institutions.map((record) => (
              <article key={record.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex justify-between gap-3"><div><p className="text-[10px] font-black uppercase text-blue-600">{record.code}</p><h3 className="mt-1 font-black">{record.name}</h3></div><StatusBadge value={record.isActive ? 'active' : 'retired'} /></div>
                <p className="mt-3 text-xs text-slate-500">{record.legalName || record.name}</p>
                <p className="mt-3 text-[10px] text-slate-400">{record.countryCode} · Updated {formatDate(record.updatedAt)}</p>
                {snapshot.access.canManageInstitutions && <button type="button" className={`${secondaryButton} mt-4`} onClick={() => editInstitution(record)}>Edit</button>}
              </article>
            ))}
          </div>
        </section>
      )}

      {tab === 'categories' && (
        <section className="grid gap-6 xl:grid-cols-[400px_1fr]">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 font-black"><Layers3 className="h-5 w-5 text-violet-600" />{category.id ? 'Update category' : 'Add certificate category'}</h2>
            <p className="mt-2 text-xs leading-5 text-slate-500">Completion, achievement and professional are defaults; future categories remain configurable.</p>
            <div className="mt-4 space-y-3">
              <label className="text-xs font-bold">Code<input className={fieldClass} value={category.code} onChange={(event) => setCategory({ ...category, code: event.target.value.toLowerCase().replace(/\s+/g, '-') })} /></label>
              <label className="text-xs font-bold">Name<input className={fieldClass} value={category.name} onChange={(event) => setCategory({ ...category, name: event.target.value })} /></label>
              <label className="text-xs font-bold">Description<textarea className={`${fieldClass} min-h-24`} value={category.description} onChange={(event) => setCategory({ ...category, description: event.target.value })} /></label>
              <label className="text-xs font-bold">Sort order<input type="number" className={fieldClass} value={category.sortOrder} onChange={(event) => setCategory({ ...category, sortOrder: Number(event.target.value) })} /></label>
              <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={category.requiresIdentityVerification} onChange={(event) => setCategory({ ...category, requiresIdentityVerification: event.target.checked })} />Identity verification required</label>
              <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={category.requiresScore} onChange={(event) => setCategory({ ...category, requiresScore: event.target.checked })} />Assessment score required</label>
              <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={category.isActive} onChange={(event) => setCategory({ ...category, isActive: event.target.checked })} />Active</label>
              <div className="flex gap-2">
                <button type="button" className={`${primaryButton} flex-1`} disabled={!snapshot.access.canManageCategories || busy === 'category'} onClick={() => void execute('category', async () => { await saveCertificateCategory({ ...category, id: category.id || null }); setCategory(newCategory()); }, category.id ? 'Category updated.' : 'Category created.')}><Save className="h-4 w-4" />Save</button>
                {category.id && <button type="button" className={secondaryButton} onClick={() => setCategory(newCategory())}>Cancel</button>}
              </div>
            </div>
          </article>
          <div className="grid content-start gap-4 md:grid-cols-2 xl:grid-cols-3">
            {snapshot.categories.map((record) => (
              <article key={record.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex justify-between gap-3"><div><p className="text-[10px] font-black uppercase text-violet-600">{record.code}</p><h3 className="mt-1 font-black">{record.name}</h3></div><StatusBadge value={record.isActive ? 'active' : 'retired'} /></div>
                <p className="mt-3 text-xs leading-5 text-slate-500">{record.description}</p>
                <p className="mt-3 text-[10px] font-bold text-slate-400">Identity: {record.requiresIdentityVerification ? 'required' : 'optional'} · Score: {record.requiresScore ? 'required' : 'optional'}</p>
                {snapshot.access.canManageCategories && <button type="button" className={`${secondaryButton} mt-4`} onClick={() => editCategory(record)}>Edit</button>}
              </article>
            ))}
          </div>
        </section>
      )}

      {tab === 'templates' && (
        <div className="space-y-6">
          <section className="grid gap-5 xl:grid-cols-2">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-black">Create template definition</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-bold">Institution<select className={fieldClass} value={template.institutionId} onChange={(event) => setTemplate({ ...template, institutionId: event.target.value })}><option value="">Select</option>{snapshot.institutions.filter((item) => item.isActive).map((item) => <option key={item.id} value={item.id}>{item.code} — {item.name}</option>)}</select></label>
                <label className="text-xs font-bold">Category<select className={fieldClass} value={template.categoryId} onChange={(event) => setTemplate({ ...template, categoryId: event.target.value })}><option value="">Select</option>{snapshot.categories.filter((item) => item.isActive).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                <label className="text-xs font-bold">Code<input className={fieldClass} value={template.code} onChange={(event) => setTemplate({ ...template, code: event.target.value.toUpperCase().replace(/\s+/g, '-') })} /></label>
                <label className="text-xs font-bold">Name<input className={fieldClass} value={template.name} onChange={(event) => setTemplate({ ...template, name: event.target.value })} /></label>
                <label className="text-xs font-bold">Orientation<select className={fieldClass} value={template.orientation} onChange={(event) => setTemplate({ ...template, orientation: event.target.value as TemplateDraft['orientation'] })}><option value="landscape">Landscape</option><option value="portrait">Portrait</option></select></label>
                <label className="text-xs font-bold">Page size<select className={fieldClass} value={template.pageSize} onChange={(event) => setTemplate({ ...template, pageSize: event.target.value as TemplateDraft['pageSize'] })}><option value="A4">A4</option><option value="Letter">Letter</option><option value="Legal">Legal</option><option value="Custom">Custom</option></select></label>
                <label className="text-xs font-bold sm:col-span-2">Description<textarea className={`${fieldClass} min-h-20`} value={template.description} onChange={(event) => setTemplate({ ...template, description: event.target.value })} /></label>
                <label className="text-xs font-bold sm:col-span-2">Notes<input className={fieldClass} value={template.notes} onChange={(event) => setTemplate({ ...template, notes: event.target.value })} /></label>
              </div>
              <button type="button" className={`${primaryButton} mt-4 w-full`} disabled={!snapshot.access.canManageTemplates || busy === 'template'} onClick={() => void execute('template', async () => { const created = await createCertificateTemplate(template); setMasterTemplateId(created.id); setTemplate({ ...newTemplate(), institutionId: template.institutionId, categoryId: template.categoryId }); }, 'Template definition created.')}><Save className="h-4 w-4" />Create template</button>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="flex items-center gap-2 font-black"><UploadCloud className="h-5 w-5 text-blue-600" />Upload immutable master version</h2>
              <p className="mt-2 text-xs leading-5 text-slate-500">Prefer print-ready PDF or SVG. PNG/JPEG must be genuinely high resolution.</p>
              <div className="mt-4 space-y-3">
                <label className="text-xs font-bold">Template<select className={fieldClass} value={masterTemplateId} onChange={(event) => setMasterTemplateId(event.target.value)}><option value="">Select</option>{snapshot.templates.map((item) => <option key={item.id} value={item.id}>{item.institutionCode} · {item.categoryName} · {item.name}</option>)}</select></label>
                <label className="block rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-xs font-bold">PDF, SVG, PNG or JPEG<input className="mt-3 block w-full text-xs" type="file" accept="application/pdf,image/svg+xml,image/png,image/jpeg" onChange={(event) => setMasterFile(event.target.files?.[0] || null)} />{masterFile && <span className="mt-2 block text-blue-700">{masterFile.name} · {formatSize(masterFile.size)}</span>}</label>
                <label className="text-xs font-bold">Version notes<textarea className={`${fieldClass} min-h-20`} value={masterNotes} onChange={(event) => setMasterNotes(event.target.value)} /></label>
              </div>
              <button type="button" className={`${primaryButton} mt-4 w-full`} disabled={!snapshot.access.canManageTemplates || !masterFile || !masterTemplateId || busy === 'master'} onClick={() => void execute('master', async () => { if (!masterFile) return; await uploadCertificateMaster({ templateId: masterTemplateId, file: masterFile, notes: masterNotes }); setMasterFile(null); setMasterNotes(''); }, 'Master version uploaded as draft.')}><UploadCloud className="h-4 w-4" />Upload master</button>
            </article>
          </section>

          <section className="space-y-3">
            {snapshot.versions.map((version) => (
              <article key={version.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><h3 className="font-black">{version.templateName} v{version.versionNumber}</h3><StatusBadge value={version.status} /><StatusBadge value={version.qualityStatus} /></div>
                    <p className="mt-1 text-xs text-slate-500">{version.institutionCode} · {version.categoryName} · {version.originalFilename}</p>
                    <p className="mt-2 text-[10px] text-slate-400">{version.sourceFormat.toUpperCase()} · {formatSize(version.fileSizeBytes)} · Uploaded {formatDate(version.createdAt)}</p>
                  </div>
                  <div className="flex max-w-2xl flex-wrap gap-2">
                    <button type="button" className={secondaryButton} onClick={() => void openPrivateFile(version.storageBucket, version.storagePath)}><Eye className="h-3.5 w-3.5" />Open source</button>
                    {['draft', 'changes_requested', 'rejected'].includes(version.status) && snapshot.access.canManageTemplates && <button type="button" className={`${secondaryButton} bg-slate-950 text-white`} onClick={() => void transition(version, 'submit_review')}><Send className="h-3.5 w-3.5" />Submit</button>}
                    {version.status === 'in_review' && snapshot.access.canReviewTemplates && <><button type="button" className={`${secondaryButton} border-emerald-200 text-emerald-700`} onClick={() => void qualityReview(version, 'passed')}><CheckCircle2 className="h-3.5 w-3.5" />Pass quality</button><button type="button" className={`${secondaryButton} border-rose-200 text-rose-700`} onClick={() => void qualityReview(version, 'failed')}><XCircle className="h-3.5 w-3.5" />Fail quality</button><button type="button" className={secondaryButton} onClick={() => void transition(version, 'request_changes')}>Request changes</button></>}
                    {version.status === 'in_review' && snapshot.access.canApproveTemplates && <><button type="button" className={`${secondaryButton} bg-violet-600 text-white`} disabled={!['passed', 'waived'].includes(version.qualityStatus)} onClick={() => void transition(version, 'approve')}>Approve</button>{version.qualityStatus === 'pending' && <button type="button" className={secondaryButton} onClick={() => void qualityReview(version, 'waived')}>Waive quality gate</button>}</>}
                    {version.status === 'approved' && snapshot.access.canPublishTemplates && <button type="button" className={`${secondaryButton} bg-emerald-600 text-white`} onClick={() => void transition(version, 'publish')}><Rocket className="h-3.5 w-3.5" />Publish</button>}
                    {['approved', 'published'].includes(version.status) && snapshot.access.canPublishTemplates && <button type="button" className={`${secondaryButton} border-rose-200 text-rose-700`} onClick={() => void transition(version, 'retire')}><Archive className="h-3.5 w-3.5" />Retire</button>}
                  </div>
                </div>
                {version.notes && <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">{version.notes}</p>}
              </article>
            ))}
            {!snapshot.versions.length && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">No master versions uploaded.</div>}
          </section>
        </div>
      )}

      {tab === 'assets' && (
        <section className="grid gap-6 xl:grid-cols-[400px_1fr]">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 font-black"><FileImage className="h-5 w-5 text-teal-600" />Upload institutional asset</h2>
            <p className="mt-2 text-xs leading-5 text-slate-500">Each upload creates a new immutable version; existing files are never overwritten.</p>
            <div className="mt-4 space-y-3">
              <label className="text-xs font-bold">Institution<select className={fieldClass} value={asset.institutionId} onChange={(event) => setAsset({ ...asset, institutionId: event.target.value })}><option value="">Select</option>{snapshot.institutions.filter((item) => item.isActive).map((item) => <option key={item.id} value={item.id}>{item.code} — {item.name}</option>)}</select></label>
              <label className="text-xs font-bold">Type<select className={fieldClass} value={asset.assetType} onChange={(event) => setAsset({ ...asset, assetType: event.target.value as CertificateAssetType })}>{(['logo', 'seal', 'signature', 'watermark', 'background', 'emblem', 'other'] as CertificateAssetType[]).map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
              <label className="text-xs font-bold">Name<input className={fieldClass} value={asset.name} onChange={(event) => setAsset({ ...asset, name: event.target.value })} /></label>
              <label className="block rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-xs font-bold">SVG, PNG or JPEG<input className="mt-3 block w-full text-xs" type="file" accept="image/svg+xml,image/png,image/jpeg" onChange={(event) => setAssetFile(event.target.files?.[0] || null)} />{assetFile && <span className="mt-2 block text-teal-700">{assetFile.name} · {formatSize(assetFile.size)}</span>}</label>
            </div>
            <button type="button" className={`${primaryButton} mt-4 w-full`} disabled={!snapshot.access.canManageAssets || !assetFile || busy === 'asset'} onClick={() => void execute('asset', async () => { const institutionRecord = snapshot.institutions.find((item) => item.id === asset.institutionId); if (!institutionRecord || !assetFile) throw new Error('Select an institution and asset file.'); await uploadCertificateAsset({ institutionId: institutionRecord.id, institutionCode: institutionRecord.code, assetType: asset.assetType, name: asset.name, file: assetFile }); setAsset({ ...newAsset(), institutionId: asset.institutionId }); setAssetFile(null); }, 'Asset version uploaded.')}><UploadCloud className="h-4 w-4" />Upload asset</button>
          </article>
          <div className="grid content-start gap-4 md:grid-cols-2 xl:grid-cols-3">
            {snapshot.assets.map((record) => (
              <article key={record.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex justify-between gap-3"><div><p className="text-[10px] font-black uppercase text-teal-600">{record.institutionCode} · {record.assetType}</p><h3 className="mt-1 font-black">{record.name}</h3></div><StatusBadge value={record.status} /></div>
                <p className="mt-3 truncate text-xs font-bold text-slate-600">{record.originalFilename}</p>
                <p className="mt-1 text-[10px] text-slate-400">v{record.versionNumber} · {formatSize(record.fileSizeBytes)}{record.pixelWidth && record.pixelHeight ? ` · ${record.pixelWidth}×${record.pixelHeight}` : ''}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" className={secondaryButton} onClick={() => void openPrivateFile(record.storageBucket, record.storagePath)}><Eye className="h-3.5 w-3.5" />Open</button>
                  {record.status === 'draft' && snapshot.access.canApproveAssets && <><button type="button" className={`${secondaryButton} border-emerald-200 text-emerald-700`} onClick={() => void execute(`asset:${record.id}`, () => setCertificateAssetStatus({ assetId: record.id, status: 'approved', notes: window.prompt('Approval note:') || '' }), 'Asset approved.')}>Approve</button><button type="button" className={`${secondaryButton} border-rose-200 text-rose-700`} onClick={() => void execute(`asset:${record.id}`, () => setCertificateAssetStatus({ assetId: record.id, status: 'rejected', notes: window.prompt('Rejection reason:') || '' }), 'Asset rejected.')}>Reject</button></>}
                  {record.status === 'approved' && snapshot.access.canApproveAssets && <button type="button" className={`${secondaryButton} border-rose-200 text-rose-700`} onClick={() => void execute(`asset:${record.id}`, () => setCertificateAssetStatus({ assetId: record.id, status: 'retired', notes: window.prompt('Retirement reason:') || '' }), 'Asset retired.')}>Retire</button>}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {tab === 'assignments' && (
        <section className="grid gap-6 xl:grid-cols-[420px_1fr]">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 font-black"><Link2 className="h-5 w-5 text-indigo-600" />Assign published master</h2>
            <p className="mt-2 text-xs leading-5 text-slate-500">Resolution order: examination, programme, then global category default.</p>
            <div className="mt-4 space-y-3">
              <label className="text-xs font-bold">Published version<select className={fieldClass} value={assignment.versionId} onChange={(event) => setAssignment({ ...assignment, versionId: event.target.value })}><option value="">Select</option>{publishedVersions.map((version) => <option key={version.id} value={version.id}>{version.institutionCode} · {version.categoryName} · {version.templateName} v{version.versionNumber}</option>)}</select></label>
              <label className="text-xs font-bold">Scope<select className={fieldClass} value={assignment.scopeType} onChange={(event) => setAssignment({ ...assignment, scopeType: event.target.value as CertificateAssignmentScope, programmeId: '', examinationId: '' })}><option value="global">Global category default</option><option value="programme">Programme</option><option value="examination">Examination</option></select></label>
              {assignment.scopeType === 'programme' && <label className="text-xs font-bold">Programme<select className={fieldClass} value={assignment.programmeId} onChange={(event) => setAssignment({ ...assignment, programmeId: event.target.value })}><option value="">Select</option>{snapshot.programmes.map((item) => <option key={item.id} value={item.id}>{item.code} — {item.name}</option>)}</select></label>}
              {assignment.scopeType === 'examination' && <label className="text-xs font-bold">Examination<select className={fieldClass} value={assignment.examinationId} onChange={(event) => setAssignment({ ...assignment, examinationId: event.target.value })}><option value="">Select</option>{snapshot.examinations.map((item) => <option key={item.id} value={item.id}>{item.programmeCode || 'IIPM'} — {item.title}</option>)}</select></label>}
              <label className="text-xs font-bold">Priority<input type="number" min={1} max={1000} className={fieldClass} value={assignment.priority} onChange={(event) => setAssignment({ ...assignment, priority: Number(event.target.value) })} /></label>
              <div className="grid grid-cols-2 gap-3"><label className="text-xs font-bold">Effective from<input type="datetime-local" className={fieldClass} value={assignment.effectiveFrom} onChange={(event) => setAssignment({ ...assignment, effectiveFrom: event.target.value })} /></label><label className="text-xs font-bold">Effective to<input type="datetime-local" className={fieldClass} value={assignment.effectiveTo} onChange={(event) => setAssignment({ ...assignment, effectiveTo: event.target.value })} /></label></div>
            </div>
            <button type="button" className={`${primaryButton} mt-4 w-full`} disabled={!snapshot.access.canManageAssignments || busy === 'assignment'} onClick={() => void execute('assignment', async () => { const version = publishedVersions.find((item) => item.id === assignment.versionId); if (!version) throw new Error('Select a published version.'); await assignCertificateTemplate({ templateId: version.templateId, templateVersionId: version.id, scopeType: assignment.scopeType, programmeId: assignment.programmeId || null, examinationId: assignment.examinationId || null, priority: assignment.priority, effectiveFrom: assignment.effectiveFrom || null, effectiveTo: assignment.effectiveTo || null }); setAssignment(newAssignment()); }, 'Published master assigned.')}><Link2 className="h-4 w-4" />Create assignment</button>
          </article>
          <div className="space-y-3">
            {snapshot.assignments.map((record) => (
              <article key={record.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col justify-between gap-3 sm:flex-row"><div><p className="text-[10px] font-black uppercase text-indigo-600">{record.categoryName} · {record.scopeType}</p><h3 className="mt-1 font-black">{record.institutionCode} · {record.templateName} v{record.versionNumber}</h3><p className="mt-2 text-xs text-slate-500">{record.scopeType === 'global' ? 'Global category default' : record.scopeType === 'programme' ? `${record.programmeCode} — ${record.programmeName}` : record.examinationTitle}</p></div><StatusBadge value={record.isActive ? 'active' : 'retired'} /></div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-[10px] text-slate-400"><span>Priority {record.priority} · {formatDate(record.effectiveFrom)} → {formatDate(record.effectiveTo)}</span>{record.isActive && snapshot.access.canManageAssignments && <button type="button" className={`${secondaryButton} border-rose-200 text-rose-700`} onClick={() => { const reason = window.prompt('Deactivation reason:')?.trim(); if (reason) void execute(`assignment:${record.id}`, () => setCertificateAssignmentActive({ assignmentId: record.id, isActive: false, reason }), 'Assignment deactivated.'); }}>Deactivate</button>}</div>
              </article>
            ))}
          </div>
        </section>
      )}

      {tab === 'permissions' && snapshot.access.canManagePermissions && (
        <div className="space-y-5">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 font-black"><KeyRound className="h-5 w-5 text-violet-600" />Examination Administrator permissions</h2>
            <p className="mt-2 text-sm text-slate-500">Super Administrators retain all authority. Permission-management authority cannot be delegated.</p>
            <label className="mt-4 block max-w-3xl text-xs font-bold">Change reason<input className={fieldClass} value={permissionReason} onChange={(event) => setPermissionReason(event.target.value)} /></label>
          </article>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {snapshot.permissionMatrix.map((record) => (
              <article key={record.permissionKey} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex justify-between gap-3"><div><h3 className="font-black">{record.name}</h3><p className="mt-2 text-xs leading-5 text-slate-500">{record.description}</p></div><span className="h-fit rounded-full bg-slate-100 px-2 py-1 text-[9px] font-black uppercase text-slate-600">{record.riskLevel}</span></div>
                <button type="button" className={`${primaryButton} mt-4 w-full ${record.isGranted ? '!border !border-rose-200 !bg-rose-50 !text-rose-700' : ''}`} disabled={record.permissionKey === 'certificate.permissions.manage' || permissionReason.trim().length < 5 || busy === `permission:${record.permissionKey}`} onClick={() => void execute(`permission:${record.permissionKey}`, () => setCertificatePermission({ permissionKey: record.permissionKey as CertificatePermissionKey, isGranted: !record.isGranted, reason: permissionReason }), `${record.name} ${record.isGranted ? 'revoked' : 'granted'}.`)}>{record.isGranted ? 'Revoke' : 'Grant'}</button>
              </article>
            ))}
          </section>
        </div>
      )}

      {tab === 'audit' && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5"><h2 className="flex items-center gap-2 font-black"><History className="h-5 w-5 text-slate-600" />Immutable administration audit</h2></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400"><tr><th className="px-4 py-3">Time</th><th className="px-4 py-3">Actor</th><th className="px-4 py-3">Entity</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">Metadata</th></tr></thead><tbody className="divide-y divide-slate-100">{snapshot.audit.map((event) => <tr key={event.id}><td className="px-4 py-3 text-xs text-slate-500">{formatDate(event.createdAt)}</td><td className="px-4 py-3 font-bold">{event.actorName || event.actorId || 'System'}</td><td className="px-4 py-3 text-xs">{event.entityType}<p className="font-mono text-[9px] text-slate-400">{event.entityId}</p></td><td className="px-4 py-3"><StatusBadge value={event.action} /></td><td className="max-w-md px-4 py-3 font-mono text-[10px] text-slate-500">{JSON.stringify(event.metadata)}</td></tr>)}{!snapshot.audit.length && <tr><td colSpan={5} className="p-10 text-center text-slate-500">No audit events recorded.</td></tr>}</tbody></table></div>
        </section>
      )}
    </main>
  );
}

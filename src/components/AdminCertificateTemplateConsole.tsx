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
  FolderOpen,
  History,
  KeyRound,
  Layers3,
  Link2,
  Loader2,
  Plus,
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

type ConsoleTab = 'overview' | 'institutions' | 'categories' | 'templates' | 'assets' | 'assignments' | 'permissions' | 'audit';

type TabDefinition = {
  id: ConsoleTab;
  label: string;
  icon: LucideIcon;
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

const dateLabel = (value?: string | null) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const sizeLabel = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

const statusClass = (status: string) => {
  if (['published', 'approved', 'passed', 'active'].includes(status)) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }
  if (['in_review', 'pending', 'changes_requested', 'draft'].includes(status)) {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }
  if (['rejected', 'failed', 'retired', 'superseded'].includes(status)) {
    return 'border-rose-200 bg-rose-50 text-rose-700';
  }
  return 'border-slate-200 bg-slate-50 text-slate-700';
};

const badge = (status: string) => (
  <span className={`inline-flex rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-wide ${statusClass(status)}`}>
    {status.replaceAll('_', ' ')}
  </span>
);

const initialInstitution = {
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
};

const initialCategory = {
  id: '',
  code: '',
  name: '',
  description: '',
  requiresIdentityVerification: false,
  requiresScore: false,
  sortOrder: 100,
  isActive: true,
};

const initialTemplate = {
  institutionId: '',
  categoryId: '',
  code: '',
  name: '',
  description: '',
  orientation: 'landscape' as const,
  pageSize: 'A4' as const,
  notes: '',
};

const initialAsset = {
  institutionId: '',
  assetType: 'logo' as CertificateAssetType,
  name: '',
};

const initialAssignment = {
  versionId: '',
  scopeType: 'global' as CertificateAssignmentScope,
  programmeId: '',
  examinationId: '',
  priority: 100,
  effectiveFrom: '',
  effectiveTo: '',
};

export default function AdminCertificateTemplateConsole() {
  const [snapshot, setSnapshot] = useState<CertificateManagementSnapshot>(emptySnapshot);
  const [activeTab, setActiveTab] = useState<ConsoleTab>('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [busyKey, setBusyKey] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [institutionDraft, setInstitutionDraft] = useState(initialInstitution);
  const [categoryDraft, setCategoryDraft] = useState(initialCategory);
  const [templateDraft, setTemplateDraft] = useState(initialTemplate);
  const [masterTemplateId, setMasterTemplateId] = useState('');
  const [masterNotes, setMasterNotes] = useState('');
  const [masterFile, setMasterFile] = useState<File | null>(null);
  const [assetDraft, setAssetDraft] = useState(initialAsset);
  const [assetFile, setAssetFile] = useState<File | null>(null);
  const [assignmentDraft, setAssignmentDraft] = useState(initialAssignment);
  const [permissionReason, setPermissionReason] = useState('Approved certificate administration responsibility update');

  const refresh = async () => {
    try {
      setIsLoading(true);
      setError('');
      const next = await getCertificateManagementSnapshot(500);
      setSnapshot(next);
      setTemplateDraft((current) => ({
        ...current,
        institutionId: current.institutionId || next.institutions.find((item) => item.isActive)?.id || '',
        categoryId: current.categoryId || next.categories.find((item) => item.isActive)?.id || '',
      }));
      setMasterTemplateId((current) => current || next.templates[0]?.id || '');
      setAssetDraft((current) => ({
        ...current,
        institutionId: current.institutionId || next.institutions.find((item) => item.isActive)?.id || '',
      }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load Certificate Management Console.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const runAction = async (key: string, action: () => Promise<void>, successMessage: string) => {
    try {
      setBusyKey(key);
      setError('');
      setMessage('');
      await action();
      setMessage(successMessage);
      await refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'The certificate administration action failed.');
    } finally {
      setBusyKey('');
    }
  };

  const tabs = useMemo<TabDefinition[]>(() => {
    const definitions: TabDefinition[] = [
      { id: 'overview', label: 'Overview', icon: Award },
      { id: 'institutions', label: 'Institutions', icon: Building2 },
      { id: 'categories', label: 'Categories', icon: Layers3 },
      { id: 'templates', label: 'Master Templates', icon: FileCheck2 },
      { id: 'assets', label: 'Asset Library', icon: FileImage },
      { id: 'assignments', label: 'Assignments', icon: Link2 },
      { id: 'audit', label: 'Audit History', icon: History },
    ];
    if (snapshot.access.canManagePermissions) {
      definitions.splice(definitions.length - 1, 0, { id: 'permissions', label: 'Permissions', icon: KeyRound });
    }
    return definitions;
  }, [snapshot.access.canManagePermissions]);

  const publishedVersions = useMemo(
    () => snapshot.versions.filter((version) => version.status === 'published'),
    [snapshot.versions],
  );

  const selectedAssignmentVersion = publishedVersions.find((version) => version.id === assignmentDraft.versionId) || null;
  const selectedAssetInstitution = snapshot.institutions.find((institution) => institution.id === assetDraft.institutionId) || null;

  const saveInstitution = async () => {
    await runAction(
      'institution',
      async () => {
        await saveCertificateInstitution({
          id: institutionDraft.id || null,
          code: institutionDraft.code,
          name: institutionDraft.name,
          shortName: institutionDraft.shortName,
          legalName: institutionDraft.legalName,
          registrationDetails: institutionDraft.registrationDetails,
          countryCode: institutionDraft.countryCode,
          website: institutionDraft.website,
          contactEmail: institutionDraft.contactEmail,
          isActive: institutionDraft.isActive,
        });
        setInstitutionDraft(initialInstitution);
      },
      institutionDraft.id ? 'Issuing institution updated.' : 'Issuing institution created.',
    );
  };

  const editInstitution = (institution: CertificateInstitution) => {
    setInstitutionDraft({
      id: institution.id,
      code: institution.code,
      name: institution.name,
      shortName: institution.shortName || '',
      legalName: institution.legalName || '',
      registrationDetails: institution.registrationDetails || '',
      countryCode: institution.countryCode || 'NG',
      website: institution.website || '',
      contactEmail: institution.contactEmail || '',
      isActive: institution.isActive,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const saveCategory = async () => {
    await runAction(
      'category',
      async () => {
        await saveCertificateCategory({
          id: categoryDraft.id || null,
          code: categoryDraft.code,
          name: categoryDraft.name,
          description: categoryDraft.description,
          requiresIdentityVerification: categoryDraft.requiresIdentityVerification,
          requiresScore: categoryDraft.requiresScore,
          sortOrder: categoryDraft.sortOrder,
          isActive: categoryDraft.isActive,
        });
        setCategoryDraft(initialCategory);
      },
      categoryDraft.id ? 'Certificate category updated.' : 'Certificate category created.',
    );
  };

  const editCategory = (category: CertificateCategory) => {
    setCategoryDraft({
      id: category.id,
      code: category.code,
      name: category.name,
      description: category.description,
      requiresIdentityVerification: category.requiresIdentityVerification,
      requiresScore: category.requiresScore,
      sortOrder: category.sortOrder,
      isActive: category.isActive,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const saveTemplate = async () => {
    await runAction(
      'template',
      async () => {
        const created = await createCertificateTemplate(templateDraft);
        setMasterTemplateId(created.id);
        setTemplateDraft((current) => ({
          ...initialTemplate,
          institutionId: current.institutionId,
          categoryId: current.categoryId,
        }));
      },
      'Certificate template definition created. Upload its first immutable master version next.',
    );
  };

  const uploadMaster = async () => {
    if (!masterTemplateId || !masterFile) {
      setError('Select a template and master file before uploading.');
      return;
    }
    await runAction(
      'master-upload',
      async () => {
        await uploadCertificateMaster({ templateId: masterTemplateId, file: masterFile, notes: masterNotes });
        setMasterFile(null);
        setMasterNotes('');
      },
      'Immutable certificate master version uploaded and registered as draft.',
    );
  };

  const uploadAsset = async () => {
    if (!selectedAssetInstitution || !assetFile || assetDraft.name.trim().length < 2) {
      setError('Select an institution, enter an asset name and choose a file.');
      return;
    }
    await runAction(
      'asset-upload',
      async () => {
        await uploadCertificateAsset({
          institutionId: selectedAssetInstitution.id,
          institutionCode: selectedAssetInstitution.code,
          assetType: assetDraft.assetType,
          name: assetDraft.name,
          file: assetFile,
        });
        setAssetFile(null);
        setAssetDraft((current) => ({ ...initialAsset, institutionId: current.institutionId }));
      },
      'Institutional certificate asset uploaded as a new draft version.',
    );
  };

  const openPrivateFile = async (bucket: string, path: string) => {
    try {
      setBusyKey(`preview:${path}`);
      setError('');
      const signedUrl = await createCertificateFileSignedUrl(bucket, path);
      window.open(signedUrl, '_blank', 'noopener,noreferrer');
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : 'Unable to open the private certificate file.');
    } finally {
      setBusyKey('');
    }
  };

  const qualityReview = async (version: CertificateTemplateVersion, passed: boolean, waived = false) => {
    const promptLabel = waived
      ? 'Enter the documented reason for waiving a quality gate:'
      : passed
        ? 'Record the print-review evidence or approval note:'
        : 'Describe the quality defects that must be corrected:';
    const notes = window.prompt(promptLabel)?.trim() || '';
    if (!notes) return;
    await runAction(
      `quality:${version.id}`,
      () => reviewCertificateTemplateQuality({
        versionId: version.id,
        qualityStatus: waived ? 'waived' : passed ? 'passed' : 'failed',
        notes,
        report: {
          reviewedAt: new Date().toISOString(),
          visualComparisonCompleted: true,
          singlePageReviewed: true,
          longNameTestReviewed: true,
          logoAndSignatureClarityReviewed: true,
          qrScanReviewed: true,
          physicalPrintReviewRecorded: passed || waived,
          notes,
        },
      }),
      waived ? 'Quality gate waiver recorded.' : passed ? 'Print-quality review passed.' : 'Print-quality review failed and defects were recorded.',
    );
  };

  const transitionVersion = async (
    version: CertificateTemplateVersion,
    action: 'submit_review' | 'request_changes' | 'reject' | 'approve' | 'publish' | 'retire',
  ) => {
    const notes = window.prompt(`Optional note for “${action.replaceAll('_', ' ')}”:`)?.trim() || '';
    if (['publish', 'retire', 'reject'].includes(action)) {
      const confirmed = window.confirm(`${action.replaceAll('_', ' ')} ${version.templateName} version ${version.versionNumber}?`);
      if (!confirmed) return;
    }
    await runAction(
      `transition:${version.id}`,
      () => transitionCertificateTemplateVersion({ versionId: version.id, action, notes }),
      `Template version ${action.replaceAll('_', ' ')} completed.`,
    );
  };

  const assignTemplate = async () => {
    if (!selectedAssignmentVersion) {
      setError('Select a published template version.');
      return;
    }
    if (assignmentDraft.scopeType === 'programme' && !assignmentDraft.programmeId) {
      setError('Select a programme for this assignment.');
      return;
    }
    if (assignmentDraft.scopeType === 'examination' && !assignmentDraft.examinationId) {
      setError('Select an examination for this assignment.');
      return;
    }
    await runAction(
      'assignment',
      async () => {
        await assignCertificateTemplate({
          templateId: selectedAssignmentVersion.templateId,
          templateVersionId: selectedAssignmentVersion.id,
          scopeType: assignmentDraft.scopeType,
          programmeId: assignmentDraft.programmeId || null,
          examinationId: assignmentDraft.examinationId || null,
          priority: assignmentDraft.priority,
          effectiveFrom: assignmentDraft.effectiveFrom || null,
          effectiveTo: assignmentDraft.effectiveTo || null,
        });
        setAssignmentDraft(initialAssignment);
      },
      'Published certificate master assigned to the selected scope.',
    );
  };

  const summaryCards: Array<[string, number, LucideIcon, string]> = [
    ['Issuing institutions', snapshot.summary.institutions, Building2, 'text-blue-600'],
    ['Certificate categories', snapshot.summary.categories, Layers3, 'text-violet-600'],
    ['Master templates', snapshot.summary.templates, FileCheck2, 'text-slate-700'],
    ['Published masters', snapshot.summary.publishedTemplates, Rocket, 'text-emerald-600'],
    ['Awaiting review', snapshot.summary.versionsAwaitingReview, ShieldCheck, 'text-amber-600'],
    ['Approved assets', snapshot.summary.approvedAssets, BadgeCheck, 'text-teal-600'],
    ['Active assignments', snapshot.summary.activeAssignments, Link2, 'text-indigo-600'],
  ];

  if (isLoading && !snapshot.access.actorId) {
    return (
      <div className="grid min-h-[70vh] place-items-center">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <Loader2 className="h-9 w-9 animate-spin text-emerald-600" />
          <p className="text-sm font-bold">Loading Certificate Management Console…</p>
        </div>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-[1500px] space-y-6 px-4 pb-12 pt-6 text-slate-900 md:px-6">
      <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 text-white shadow-xl">
        <div className="grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-center md:p-8">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">
              <ShieldCheck className="h-4 w-4" /> Multi-institution certificate control plane
            </div>
            <h1 className="mt-2 text-2xl font-black md:text-3xl">Master Template Administration</h1>
            <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300">
              Govern every certificate category and issuing institution from approved source files. Master files and assets are immutable, versioned and private; publication and assignment remain separate controlled decisions.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-xs font-black text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh console
          </button>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-slate-800 px-4 py-3 md:px-6">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black transition ${
                activeTab === id ? 'bg-white text-slate-950' : 'text-slate-400 hover:bg-slate-900 hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>
      </section>

      {message && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
          {message}
        </div>
      )}
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {activeTab === 'overview' && (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            {summaryCards.map(([label, value, Icon, colour]) => (
              <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <Icon className={`h-5 w-5 ${colour}`} />
                <p className="mt-3 text-2xl font-black text-slate-950">{value}</p>
                <p className="mt-1 text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</p>
              </div>
            ))}
          </section>

          <section className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-black text-slate-950">Phase 1A control boundary</h2>
              <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                {[
                  'Institution and certificate-category administration',
                  'Private PDF, SVG, PNG and JPEG master-file storage',
                  'Immutable template and institutional-asset versions',
                  'Draft, review, approval, publication and retirement workflow',
                  'Global, programme and examination assignments',
                  'Role permissions and immutable administration audit',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-600" /> {item}
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
              <h2 className="font-black text-amber-950">Renderer activation remains gated</h2>
              <p className="mt-3 text-sm leading-6 text-amber-900/80">
                Phase 1A does not replace issued-certificate records or change eligibility, payment, examination, verification codes or current PDF rendering. A published master becomes eligible for later server-side renderer integration only after its quality review and assignment are approved.
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-black text-slate-950">Recent template versions</h2>
                <p className="mt-1 text-xs text-slate-500">Latest uploaded masters across all institutions and categories.</p>
              </div>
              <button type="button" onClick={() => setActiveTab('templates')} className="text-xs font-black text-emerald-700">Open templates</button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {snapshot.versions.slice(0, 6).map((version) => (
                <div key={version.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-slate-900">{version.templateName}</p>
                      <p className="mt-1 text-xs text-slate-500">{version.institutionCode} · {version.categoryName} · v{version.versionNumber}</p>
                    </div>
                    {badge(version.status)}
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[10px] font-bold text-slate-400">
                    <span>{version.sourceFormat.toUpperCase()} · {sizeLabel(version.fileSizeBytes)}</span>
                    <span>Quality: {version.qualityStatus}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {activeTab === 'institutions' && (
        <section className="grid gap-6 xl:grid-cols-[420px_1fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-600" />
              <h2 className="font-black text-slate-950">{institutionDraft.id ? 'Update institution' : 'Add issuing institution'}</h2>
            </div>
            {!snapshot.access.canManageInstitutions && (
              <p className="mt-3 rounded-xl bg-slate-100 p-3 text-xs font-bold text-slate-600">Your role can view institutions but cannot change them.</p>
            )}
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-bold text-slate-600">Code<input value={institutionDraft.code} onChange={(event) => setInstitutionDraft({ ...institutionDraft, code: event.target.value.toUpperCase() })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5" placeholder="IIPM" /></label>
                <label className="text-xs font-bold text-slate-600">Country<input value={institutionDraft.countryCode} onChange={(event) => setInstitutionDraft({ ...institutionDraft, countryCode: event.target.value.toUpperCase().slice(0, 2) })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5" /></label>
              </div>
              <label className="text-xs font-bold text-slate-600">Official name<input value={institutionDraft.name} onChange={(event) => setInstitutionDraft({ ...institutionDraft, name: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5" /></label>
              <label className="text-xs font-bold text-slate-600">Short name<input value={institutionDraft.shortName} onChange={(event) => setInstitutionDraft({ ...institutionDraft, shortName: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5" /></label>
              <label className="text-xs font-bold text-slate-600">Legal name<input value={institutionDraft.legalName} onChange={(event) => setInstitutionDraft({ ...institutionDraft, legalName: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5" /></label>
              <label className="text-xs font-bold text-slate-600">Registration details<textarea value={institutionDraft.registrationDetails} onChange={(event) => setInstitutionDraft({ ...institutionDraft, registrationDetails: event.target.value })} className="mt-1 min-h-20 w-full rounded-xl border border-slate-200 px-3 py-2.5" /></label>
              <label className="text-xs font-bold text-slate-600">Website<input value={institutionDraft.website} onChange={(event) => setInstitutionDraft({ ...institutionDraft, website: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5" /></label>
              <label className="text-xs font-bold text-slate-600">Contact email<input value={institutionDraft.contactEmail} onChange={(event) => setInstitutionDraft({ ...institutionDraft, contactEmail: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5" /></label>
              <label className="flex items-center gap-2 text-xs font-bold text-slate-600"><input type="checkbox" checked={institutionDraft.isActive} onChange={(event) => setInstitutionDraft({ ...institutionDraft, isActive: event.target.checked })} /> Active institution</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => void saveInstitution()} disabled={!snapshot.access.canManageInstitutions || busyKey === 'institution'} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-xs font-black text-white disabled:opacity-50">{busyKey === 'institution' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save institution</button>
                {institutionDraft.id && <button type="button" onClick={() => setInstitutionDraft(initialInstitution)} className="rounded-xl border border-slate-200 px-4 py-3 text-xs font-black text-slate-600">Cancel</button>}
              </div>
            </div>
          </div>
          <div className="grid content-start gap-4 md:grid-cols-2">
            {snapshot.institutions.map((institution) => (
              <div key={institution.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div><p className="text-[10px] font-black uppercase tracking-wider text-blue-600">{institution.code}</p><h3 className="mt-1 font-black text-slate-950">{institution.name}</h3></div>
                  {badge(institution.isActive ? 'active' : 'retired')}
                </div>
                <p className="mt-3 text-xs leading-5 text-slate-500">{institution.legalName || institution.name}</p>
                <div className="mt-4 text-[10px] font-bold text-slate-400">{institution.countryCode} · Updated {dateLabel(institution.updatedAt)}</div>
                {snapshot.access.canManageInstitutions && <button type="button" onClick={() => editInstitution(institution)} className="mt-4 rounded-lg border border-slate-200 px-3 py-2 text-xs font-black text-slate-600">Edit institution</button>}
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === 'categories' && (
        <section className="grid gap-6 xl:grid-cols-[420px_1fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2"><Layers3 className="h-5 w-5 text-violet-600" /><h2 className="font-black text-slate-950">{categoryDraft.id ? 'Update category' : 'Add certificate category'}</h2></div>
            <p className="mt-2 text-xs leading-5 text-slate-500">Completion, achievement and professional are seeded defaults. Additional categories can be added without changing application code.</p>
            <div className="mt-4 space-y-3">
              <label className="text-xs font-bold text-slate-600">Code<input value={categoryDraft.code} onChange={(event) => setCategoryDraft({ ...categoryDraft, code: event.target.value.toLowerCase().replace(/\s+/g, '-') })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5" /></label>
              <label className="text-xs font-bold text-slate-600">Name<input value={categoryDraft.name} onChange={(event) => setCategoryDraft({ ...categoryDraft, name: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5" /></label>
              <label className="text-xs font-bold text-slate-600">Description<textarea value={categoryDraft.description} onChange={(event) => setCategoryDraft({ ...categoryDraft, description: event.target.value })} className="mt-1 min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2.5" /></label>
              <label className="text-xs font-bold text-slate-600">Sort order<input type="number" value={categoryDraft.sortOrder} onChange={(event) => setCategoryDraft({ ...categoryDraft, sortOrder: Number(event.target.value) })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5" /></label>
              <label className="flex items-center gap-2 text-xs font-bold text-slate-600"><input type="checkbox" checked={categoryDraft.requiresIdentityVerification} onChange={(event) => setCategoryDraft({ ...categoryDraft, requiresIdentityVerification: event.target.checked })} /> Requires identity verification</label>
              <label className="flex items-center gap-2 text-xs font-bold text-slate-600"><input type="checkbox" checked={categoryDraft.requiresScore} onChange={(event) => setCategoryDraft({ ...categoryDraft, requiresScore: event.target.checked })} /> Requires assessment score</label>
              <label className="flex items-center gap-2 text-xs font-bold text-slate-600"><input type="checkbox" checked={categoryDraft.isActive} onChange={(event) => setCategoryDraft({ ...categoryDraft, isActive: event.target.checked })} /> Active category</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => void saveCategory()} disabled={!snapshot.access.canManageCategories || busyKey === 'category'} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-xs font-black text-white disabled:opacity-50">{busyKey === 'category' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save category</button>
                {categoryDraft.id && <button type="button" onClick={() => setCategoryDraft(initialCategory)} className="rounded-xl border border-slate-200 px-4 py-3 text-xs font-black text-slate-600">Cancel</button>}
              </div>
            </div>
          </div>
          <div className="grid content-start gap-4 md:grid-cols-2 xl:grid-cols-3">
            {snapshot.categories.map((category) => (
              <div key={category.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-wider text-violet-600">{category.code}</p><h3 className="mt-1 font-black text-slate-950">{category.name}</h3></div>{badge(category.isActive ? 'active' : 'retired')}</div>
                <p className="mt-3 text-xs leading-5 text-slate-500">{category.description}</p>
                <div className="mt-4 flex flex-wrap gap-2 text-[9px] font-black uppercase text-slate-500"><span className="rounded-full bg-slate-100 px-2 py-1">Identity {category.requiresIdentityVerification ? 'required' : 'optional'}</span><span className="rounded-full bg-slate-100 px-2 py-1">Score {category.requiresScore ? 'required' : 'optional'}</span></div>
                {snapshot.access.canManageCategories && <button type="button" onClick={() => editCategory(category)} className="mt-4 rounded-lg border border-slate-200 px-3 py-2 text-xs font-black text-slate-600">Edit category</button>}
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === 'templates' && (
        <div className="space-y-6">
          <section className="grid gap-5 xl:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2"><Plus className="h-5 w-5 text-emerald-600" /><h2 className="font-black text-slate-950">Create template definition</h2></div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-bold text-slate-600">Issuing institution<select value={templateDraft.institutionId} onChange={(event) => setTemplateDraft({ ...templateDraft, institutionId: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"><option value="">Select institution</option>{snapshot.institutions.filter((item) => item.isActive).map((item) => <option key={item.id} value={item.id}>{item.code} — {item.name}</option>)}</select></label>
                <label className="text-xs font-bold text-slate-600">Certificate category<select value={templateDraft.categoryId} onChange={(event) => setTemplateDraft({ ...templateDraft, categoryId: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"><option value="">Select category</option>{snapshot.categories.filter((item) => item.isActive).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                <label className="text-xs font-bold text-slate-600">Template code<input value={templateDraft.code} onChange={(event) => setTemplateDraft({ ...templateDraft, code: event.target.value.toUpperCase().replace(/\s+/g, '-') })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5" placeholder="IIPM-COMPLETION-A4" /></label>
                <label className="text-xs font-bold text-slate-600">Template name<input value={templateDraft.name} onChange={(event) => setTemplateDraft({ ...templateDraft, name: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5" /></label>
                <label className="text-xs font-bold text-slate-600">Orientation<select value={templateDraft.orientation} onChange={(event) => setTemplateDraft({ ...templateDraft, orientation: event.target.value as 'portrait' | 'landscape' })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"><option value="landscape">Landscape</option><option value="portrait">Portrait</option></select></label>
                <label className="text-xs font-bold text-slate-600">Page size<select value={templateDraft.pageSize} onChange={(event) => setTemplateDraft({ ...templateDraft, pageSize: event.target.value as 'A4' | 'Letter' | 'Legal' | 'Custom' })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"><option>A4</option><option>Letter</option><option>Legal</option><option>Custom</option></select></label>
                <label className="text-xs font-bold text-slate-600 sm:col-span-2">Description<textarea value={templateDraft.description} onChange={(event) => setTemplateDraft({ ...templateDraft, description: event.target.value })} className="mt-1 min-h-20 w-full rounded-xl border border-slate-200 px-3 py-2.5" /></label>
                <label className="text-xs font-bold text-slate-600 sm:col-span-2">Administration notes<input value={templateDraft.notes} onChange={(event) => setTemplateDraft({ ...templateDraft, notes: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5" /></label>
              </div>
              <button type="button" onClick={() => void saveTemplate()} disabled={!snapshot.access.canManageTemplates || busyKey === 'template'} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-xs font-black text-white disabled:opacity-50">{busyKey === 'template' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Create template</button>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2"><UploadCloud className="h-5 w-5 text-blue-600" /><h2 className="font-black text-slate-950">Upload immutable master version</h2></div>
              <p className="mt-2 text-xs leading-5 text-slate-500">Preferred formats are print-ready PDF or SVG. PNG and JPEG are accepted only when the source is genuinely high-resolution.</p>
              <div className="mt-4 space-y-3">
                <label className="text-xs font-bold text-slate-600">Template<select value={masterTemplateId} onChange={(event) => setMasterTemplateId(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"><option value="">Select template</option>{snapshot.templates.map((template) => <option key={template.id} value={template.id}>{template.institutionCode} · {template.categoryName} · {template.name}</option>)}</select></label>
                <label className="block rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-xs font-bold text-slate-600"><span className="flex items-center gap-2"><FolderOpen className="h-4 w-4" /> Select PDF, SVG, PNG or JPEG</span><input type="file" accept="application/pdf,image/svg+xml,image/png,image/jpeg" onChange={(event) => setMasterFile(event.target.files?.[0] || null)} className="mt-3 block w-full text-xs" />{masterFile && <span className="mt-2 block text-emerald-700">{masterFile.name} · {sizeLabel(masterFile.size)}</span>}</label>
                <label className="text-xs font-bold text-slate-600">Version notes<textarea value={masterNotes} onChange={(event) => setMasterNotes(event.target.value)} className="mt-1 min-h-20 w-full rounded-xl border border-slate-200 px-3 py-2.5" placeholder="Source, approval reference, changes from previous version…" /></label>
              </div>
              <button type="button" onClick={() => void uploadMaster()} disabled={!snapshot.access.canManageTemplates || busyKey === 'master-upload'} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-xs font-black text-white disabled:opacity-50">{busyKey === 'master-upload' ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />} Upload master version</button>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4"><h2 className="font-black text-slate-950">Master-template versions and approval workflow</h2><p className="mt-1 text-xs text-slate-500">A technical build is not visual approval. Quality review, approval and publication are separate auditable stages.</p></div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1250px] text-left text-sm">
                <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wide text-slate-400"><tr><th className="px-4 py-3">Template</th><th className="px-4 py-3">File</th><th className="px-4 py-3">Workflow</th><th className="px-4 py-3">Quality</th><th className="px-4 py-3">Dates</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {snapshot.versions.map((version) => (
                    <tr key={version.id} className="align-top hover:bg-slate-50/60">
                      <td className="px-4 py-4"><p className="font-black text-slate-900">{version.templateName}</p><p className="mt-1 text-xs text-slate-500">{version.institutionCode} · {version.categoryName} · v{version.versionNumber}</p></td>
                      <td className="px-4 py-4"><p className="max-w-64 truncate text-xs font-bold text-slate-700" title={version.originalFilename}>{version.originalFilename}</p><p className="mt-1 text-[10px] text-slate-400">{version.sourceFormat.toUpperCase()} · {sizeLabel(version.fileSizeBytes)}{version.pixelWidth && version.pixelHeight ? ` · ${version.pixelWidth}×${version.pixelHeight}` : ''}</p><button type="button" onClick={() => void openPrivateFile(version.storageBucket, version.storagePath)} className="mt-2 inline-flex items-center gap-1 text-xs font-black text-blue-700"><Eye className="h-3.5 w-3.5" /> Open private master</button></td>
                      <td className="px-4 py-4">{badge(version.status)}</td>
                      <td className="px-4 py-4">{badge(version.qualityStatus)}{version.notes && <p className="mt-2 max-w-64 text-[10px] leading-4 text-slate-500">{version.notes}</p>}</td>
                      <td className="px-4 py-4 text-[10px] leading-5 text-slate-500"><p>Uploaded {dateLabel(version.createdAt)}</p><p>Reviewed {dateLabel(version.reviewedAt)}</p><p>Published {dateLabel(version.publishedAt)}</p></td>
                      <td className="px-4 py-4"><div className="flex max-w-[340px] flex-wrap justify-end gap-2">
                        {['draft', 'changes_requested', 'rejected'].includes(version.status) && snapshot.access.canManageTemplates && <button type="button" onClick={() => void transitionVersion(version, 'submit_review')} className="inline-flex items-center gap-1 rounded-lg bg-slate-950 px-3 py-2 text-[10px] font-black text-white"><Send className="h-3.5 w-3.5" /> Submit review</button>}
                        {version.status === 'in_review' && snapshot.access.canReviewTemplates && <><button type="button" onClick={() => void qualityReview(version, true)} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-[10px] font-black text-white"><CheckCircle2 className="h-3.5 w-3.5" /> Pass quality</button><button type="button" onClick={() => void qualityReview(version, false)} className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-3 py-2 text-[10px] font-black text-rose-700"><XCircle className="h-3.5 w-3.5" /> Fail quality</button><button type="button" onClick={() => void transitionVersion(version, 'request_changes')} className="rounded-lg border border-amber-200 px-3 py-2 text-[10px] font-black text-amber-700">Request changes</button></>}
                        {version.status === 'in_review' && snapshot.access.canApproveTemplates && <><button type="button" onClick={() => void transitionVersion(version, 'approve')} disabled={!['passed', 'waived'].includes(version.qualityStatus)} className="rounded-lg bg-violet-600 px-3 py-2 text-[10px] font-black text-white disabled:opacity-40">Approve</button>{version.qualityStatus === 'pending' && <button type="button" onClick={() => void qualityReview(version, true, true)} className="rounded-lg border border-violet-200 px-3 py-2 text-[10px] font-black text-violet-700">Waive gate</button>}</>}
                        {version.status === 'approved' && snapshot.access.canPublishTemplates && <button type="button" onClick={() => void transitionVersion(version, 'publish')} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-[10px] font-black text-white"><Rocket className="h-3.5 w-3.5" /> Publish</button>}
                        {['approved', 'published'].includes(version.status) && snapshot.access.canPublishTemplates && <button type="button" onClick={() => void transitionVersion(version, 'retire')} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-2 text-[10px] font-black text-rose-700"><Archive className="h-3.5 w-3.5" /> Retire</button>}
                      </div></td>
                    </tr>
                  ))}
                  {!snapshot.versions.length && <tr><td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-500">No master versions have been uploaded.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {activeTab === 'assets' && (
        <div className="space-y-6">
          <section className="grid gap-5 xl:grid-cols-[440px_1fr]">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2"><FileImage className="h-5 w-5 text-teal-600" /><h2 className="font-black text-slate-950">Upload institutional asset</h2></div>
              <p className="mt-2 text-xs leading-5 text-slate-500">Keep original logos, seals, watermarks and signatures in one controlled library. New files create new versions; existing objects are never overwritten.</p>
              <div className="mt-4 space-y-3">
                <label className="text-xs font-bold text-slate-600">Institution<select value={assetDraft.institutionId} onChange={(event) => setAssetDraft({ ...assetDraft, institutionId: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"><option value="">Select institution</option>{snapshot.institutions.filter((item) => item.isActive).map((item) => <option key={item.id} value={item.id}>{item.code} — {item.name}</option>)}</select></label>
                <label className="text-xs font-bold text-slate-600">Asset type<select value={assetDraft.assetType} onChange={(event) => setAssetDraft({ ...assetDraft, assetType: event.target.value as CertificateAssetType })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5">{(['logo', 'seal', 'signature', 'watermark', 'background', 'emblem', 'other'] as CertificateAssetType[]).map((type) => <option key={type} value={type}>{type.replaceAll('_', ' ')}</option>)}</select></label>
                <label className="text-xs font-bold text-slate-600">Asset name<input value={assetDraft.name} onChange={(event) => setAssetDraft({ ...assetDraft, name: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5" placeholder="Official primary logo" /></label>
                <label className="block rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-xs font-bold text-slate-600"><span>SVG, transparent PNG or high-resolution JPEG</span><input type="file" accept="image/svg+xml,image/png,image/jpeg" onChange={(event) => setAssetFile(event.target.files?.[0] || null)} className="mt-3 block w-full text-xs" />{assetFile && <span className="mt-2 block text-teal-700">{assetFile.name} · {sizeLabel(assetFile.size)}</span>}</label>
              </div>
              <button type="button" onClick={() => void uploadAsset()} disabled={!snapshot.access.canManageAssets || busyKey === 'asset-upload'} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-3 text-xs font-black text-white disabled:opacity-50">{busyKey === 'asset-upload' ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />} Upload asset version</button>
            </div>
            <div className="grid content-start gap-4 md:grid-cols-2 xl:grid-cols-3">
              {snapshot.assets.map((asset) => (
                <div key={asset.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-wide text-teal-600">{asset.institutionCode} · {asset.assetType}</p><h3 className="mt-1 font-black text-slate-950">{asset.name}</h3></div>{badge(asset.status)}</div>
                  <p className="mt-3 truncate text-xs font-bold text-slate-600" title={asset.originalFilename}>{asset.originalFilename}</p>
                  <p className="mt-1 text-[10px] text-slate-400">v{asset.versionNumber} · {sizeLabel(asset.fileSizeBytes)}{asset.pixelWidth && asset.pixelHeight ? ` · ${asset.pixelWidth}×${asset.pixelHeight}` : ''}</p>
                  <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => void openPrivateFile(asset.storageBucket, asset.storagePath)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-black text-slate-600"><Eye className="h-3.5 w-3.5" /> Open</button>{asset.status === 'draft' && snapshot.access.canApproveAssets && <><button type="button" onClick={() => void runAction(`asset:${asset.id}`, () => setCertificateAssetStatus({ assetId: asset.id, status: 'approved', notes: window.prompt('Asset approval note:') || '' }), 'Certificate asset approved.')} className="rounded-lg bg-emerald-600 px-3 py-2 text-[10px] font-black text-white">Approve</button><button type="button" onClick={() => void runAction(`asset:${asset.id}`, () => setCertificateAssetStatus({ assetId: asset.id, status: 'rejected', notes: window.prompt('Asset rejection reason:') || '' }), 'Certificate asset rejected.')} className="rounded-lg bg-rose-50 px-3 py-2 text-[10px] font-black text-rose-700">Reject</button></>}{asset.status === 'approved' && snapshot.access.canApproveAssets && <button type="button" onClick={() => void runAction(`asset:${asset.id}`, () => setCertificateAssetStatus({ assetId: asset.id, status: 'retired', notes: window.prompt('Asset retirement reason:') || '' }), 'Certificate asset retired.')} className="rounded-lg border border-rose-200 px-3 py-2 text-[10px] font-black text-rose-700">Retire</button>}</div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {activeTab === 'assignments' && (
        <div className="space-y-6">
          <section className="grid gap-5 xl:grid-cols-[460px_1fr]">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2"><Link2 className="h-5 w-5 text-indigo-600" /><h2 className="font-black text-slate-950">Assign published master</h2></div>
              <p className="mt-2 text-xs leading-5 text-slate-500">Examination assignments override programme assignments; programme assignments override global category defaults.</p>
              <div className="mt-4 space-y-3">
                <label className="text-xs font-bold text-slate-600">Published version<select value={assignmentDraft.versionId} onChange={(event) => setAssignmentDraft({ ...assignmentDraft, versionId: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"><option value="">Select published version</option>{publishedVersions.map((version) => <option key={version.id} value={version.id}>{version.institutionCode} · {version.categoryName} · {version.templateName} v{version.versionNumber}</option>)}</select></label>
                <label className="text-xs font-bold text-slate-600">Scope<select value={assignmentDraft.scopeType} onChange={(event) => setAssignmentDraft({ ...assignmentDraft, scopeType: event.target.value as CertificateAssignmentScope, programmeId: '', examinationId: '' })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"><option value="global">Global category default</option><option value="programme">Programme</option><option value="examination">Examination</option></select></label>
                {assignmentDraft.scopeType === 'programme' && <label className="text-xs font-bold text-slate-600">Programme<select value={assignmentDraft.programmeId} onChange={(event) => setAssignmentDraft({ ...assignmentDraft, programmeId: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"><option value="">Select programme</option>{snapshot.programmes.map((programme) => <option key={programme.id} value={programme.id}>{programme.code} — {programme.name}</option>)}</select></label>}
                {assignmentDraft.scopeType === 'examination' && <label className="text-xs font-bold text-slate-600">Examination<select value={assignmentDraft.examinationId} onChange={(event) => setAssignmentDraft({ ...assignmentDraft, examinationId: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"><option value="">Select examination</option>{snapshot.examinations.map((examination) => <option key={examination.id} value={examination.id}>{examination.programmeCode || 'IIPM'} — {examination.title}</option>)}</select></label>}
                <label className="text-xs font-bold text-slate-600">Priority<input type="number" min={1} max={1000} value={assignmentDraft.priority} onChange={(event) => setAssignmentDraft({ ...assignmentDraft, priority: Number(event.target.value) })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5" /></label>
                <div className="grid grid-cols-2 gap-3"><label className="text-xs font-bold text-slate-600">Effective from<input type="datetime-local" value={assignmentDraft.effectiveFrom} onChange={(event) => setAssignmentDraft({ ...assignmentDraft, effectiveFrom: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5" /></label><label className="text-xs font-bold text-slate-600">Effective to<input type="datetime-local" value={assignmentDraft.effectiveTo} onChange={(event) => setAssignmentDraft({ ...assignmentDraft, effectiveTo: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5" /></label></div>
              </div>
              <button type="button" onClick={() => void assignTemplate()} disabled={!snapshot.access.canManageAssignments || busyKey === 'assignment'} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-xs font-black text-white disabled:opacity-50">{busyKey === 'assignment' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />} Create assignment</button>
            </div>
            <div className="space-y-3">
              {snapshot.assignments.map((assignment) => (
                <div key={assignment.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><p className="text-[10px] font-black uppercase tracking-wide text-indigo-600">{assignment.categoryName} · {assignment.scopeType}</p><h3 className="mt-1 font-black text-slate-950">{assignment.institutionCode} · {assignment.templateName} v{assignment.versionNumber}</h3><p className="mt-2 text-xs text-slate-500">{assignment.scopeType === 'global' ? 'All programmes without a more specific assignment' : assignment.scopeType === 'programme' ? `${assignment.programmeCode} — ${assignment.programmeName}` : assignment.examinationTitle}</p></div>{badge(assignment.isActive ? 'active' : 'retired')}</div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-[10px] font-bold text-slate-400"><span>Priority {assignment.priority} · {dateLabel(assignment.effectiveFrom)} → {dateLabel(assignment.effectiveTo)}</span>{assignment.isActive && snapshot.access.canManageAssignments && <button type="button" onClick={() => { const reason = window.prompt('Reason for deactivating this assignment:')?.trim() || ''; if (reason) void runAction(`assignment:${assignment.id}`, () => setCertificateAssignmentActive({ assignmentId: assignment.id, isActive: false, reason }), 'Template assignment deactivated.'); }} className="rounded-lg border border-rose-200 px-3 py-2 text-[10px] font-black text-rose-700">Deactivate</button>}</div>
                </div>
              ))}
              {!snapshot.assignments.length && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">No published master has been assigned.</div>}
            </div>
          </section>
        </div>
      )}

      {activeTab === 'permissions' && snapshot.access.canManagePermissions && (
        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-violet-600" /><h2 className="font-black text-slate-950">Examination Administrator permissions</h2></div><p className="mt-2 text-sm leading-6 text-slate-500">Super Administrators retain all authority. Publication, assignments, institution governance and permission management are restricted by default.</p><label className="mt-4 block text-xs font-bold text-slate-600">Reason for permission changes<input value={permissionReason} onChange={(event) => setPermissionReason(event.target.value)} className="mt-1 w-full max-w-3xl rounded-xl border border-slate-200 px-3 py-2.5" /></label></section>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {snapshot.permissionMatrix.map((permission) => (
              <div key={permission.permissionKey} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3"><div><p className="font-black text-slate-950">{permission.name}</p><p className="mt-2 text-xs leading-5 text-slate-500">{permission.description}</p></div><span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${permission.riskLevel === 'restricted' ? 'bg-rose-100 text-rose-700' : permission.riskLevel === 'sensitive' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{permission.riskLevel}</span></div>
                <button type="button" disabled={permission.permissionKey === 'certificate.permissions.manage' || permissionReason.trim().length < 5 || busyKey === `permission:${permission.permissionKey}`} onClick={() => void runAction(`permission:${permission.permissionKey}`, () => setCertificatePermission({ permissionKey: permission.permissionKey as CertificatePermissionKey, isGranted: !permission.isGranted, reason: permissionReason }), `${permission.name} ${permission.isGranted ? 'revoked' : 'granted'} for Examination Administrators.`)} className={`mt-5 w-full rounded-xl px-4 py-3 text-xs font-black disabled:opacity-40 ${permission.isGranted ? 'border border-rose-200 bg-rose-50 text-rose-700' : 'bg-emerald-600 text-white'}`}>{permission.isGranted ? 'Revoke permission' : 'Grant permission'}</button>
              </div>
            ))}
          </section>
        </div>
      )}

      {activeTab === 'audit' && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4"><h2 className="font-black text-slate-950">Immutable certificate administration audit</h2><p className="mt-1 text-xs text-slate-500">Template, asset, assignment, institution, category and permission events cannot be edited or deleted.</p></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wide text-slate-400"><tr><th className="px-4 py-3">Time</th><th className="px-4 py-3">Actor</th><th className="px-4 py-3">Entity</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">Metadata</th></tr></thead><tbody className="divide-y divide-slate-100">{snapshot.audit.map((event) => <tr key={event.id}><td className="px-4 py-3 text-xs text-slate-500">{dateLabel(event.createdAt)}</td><td className="px-4 py-3 font-bold text-slate-800">{event.actorName || event.actorId || 'System'}</td><td className="px-4 py-3 text-xs text-slate-600">{event.entityType}<p className="mt-1 font-mono text-[9px] text-slate-400">{event.entityId}</p></td><td className="px-4 py-3">{badge(event.action)}</td><td className="max-w-md px-4 py-3 font-mono text-[10px] text-slate-500">{JSON.stringify(event.metadata)}</td></tr>)}{!snapshot.audit.length && <tr><td colSpan={5} className="px-5 py-12 text-center text-sm text-slate-500">No certificate administration events have been recorded.</td></tr>}</tbody></table></div>
        </section>
      )}
    </main>
  );
}

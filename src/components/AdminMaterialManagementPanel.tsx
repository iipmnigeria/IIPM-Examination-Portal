import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Clock3,
  Database,
  FilePlus2,
  Link2,
  Loader2,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import {
  getMaterialAdminConsole,
  reconcileMaterialEntitlements,
  removeMaterialMapping,
  saveMaterialMapping,
  saveMaterialVersion,
  savePreparationMaterial,
  setMaterialVersionStatus,
  type EntitlementReconciliation,
  type MaterialAdminConsole,
  type MaterialAdminMapping,
  type MaterialAdminRecord,
  type MaterialAdminVersion,
  type MaterialStatus,
  type MaterialType,
  type MaterialVersionStatus,
} from '../services/materialAdminService';

interface AdminMaterialManagementPanelProps {
  onBackToAudits: () => void;
  onExit: () => void;
}

const materialTypes: Array<{ value: MaterialType; label: string }> = [
  { value: 'study_guide', label: 'Study guide' },
  { value: 'workbook', label: 'Workbook' },
  { value: 'mock_exam', label: 'Mock examination' },
  { value: 'checklist', label: 'Checklist' },
  { value: 'video', label: 'Video' },
  { value: 'reference', label: 'Reference' },
  { value: 'other', label: 'Other' },
];

const statusClass = (status: string): string => {
  if (status === 'published' || status === 'active') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }
  if (status === 'archived' || status === 'retired' || status === 'revoked') {
    return 'border-slate-200 bg-slate-100 text-slate-600';
  }
  return 'border-amber-200 bg-amber-50 text-amber-700';
};

const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
};

const toDateTimeInput = (value?: string | null): string => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
};

const toIsoOrNull = (value: string): string | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

export default function AdminMaterialManagementPanel({
  onBackToAudits,
  onExit,
}: AdminMaterialManagementPanelProps) {
  const [consoleData, setConsoleData] = useState<MaterialAdminConsole | null>(null);
  const [selectedMaterialId, setSelectedMaterialId] = useState('');
  const [isBusy, setIsBusy] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [reconciliation, setReconciliation] = useState<EntitlementReconciliation | null>(null);
  const [reconcileExamId, setReconcileExamId] = useState('');

  const [materialForm, setMaterialForm] = useState<{
    id?: string;
    title: string;
    description: string;
    materialType: MaterialType;
    status: MaterialStatus;
  }>({
    title: '',
    description: '',
    materialType: 'study_guide',
    status: 'draft',
  });

  const [versionForm, setVersionForm] = useState({
    id: '',
    versionLabel: '',
    storageBucket: 'agilecert-preparation-materials',
    storagePath: '',
    fileName: '',
    mimeType: 'application/pdf',
    sizeBytes: '0',
    checksumSha256: '',
  });

  const [mappingForm, setMappingForm] = useState({
    examinationId: '',
    position: '1',
    isRequired: false,
    availableFrom: '',
    expiresAt: '',
    isActive: true,
  });

  const selectedMaterial = useMemo(
    () => consoleData?.materials.find((material) => material.id === selectedMaterialId) || null,
    [consoleData, selectedMaterialId],
  );

  const refreshConsole = async (preferredMaterialId?: string) => {
    try {
      setIsBusy(true);
      setError('');
      const next = await getMaterialAdminConsole();
      setConsoleData(next);
      const preferred = preferredMaterialId || selectedMaterialId;
      const nextSelection = next.materials.some((material) => material.id === preferred)
        ? preferred
        : next.materials[0]?.id || '';
      setSelectedMaterialId(nextSelection);
    } catch (refreshError: any) {
      setError(refreshError?.message || 'Unable to load the material administration console.');
    } finally {
      setIsBusy(false);
    }
  };

  useEffect(() => {
    void refreshConsole();
  }, []);

  const selectMaterial = (material: MaterialAdminRecord) => {
    setSelectedMaterialId(material.id);
    setMaterialForm({
      id: material.id,
      title: material.title,
      description: material.description,
      materialType: material.materialType,
      status: material.status,
    });
    setVersionForm({
      id: '',
      versionLabel: '',
      storageBucket: 'agilecert-preparation-materials',
      storagePath: '',
      fileName: '',
      mimeType: 'application/pdf',
      sizeBytes: '0',
      checksumSha256: '',
    });
    setMappingForm({
      examinationId: '',
      position: String(material.mappings.length + 1),
      isRequired: false,
      availableFrom: '',
      expiresAt: '',
      isActive: true,
    });
    setMessage('');
    setError('');
  };

  const startNewMaterial = () => {
    setSelectedMaterialId('');
    setMaterialForm({
      title: '',
      description: '',
      materialType: 'study_guide',
      status: 'draft',
    });
    setMessage('');
    setError('');
  };

  const handleSaveMaterial = async () => {
    try {
      setIsBusy(true);
      setError('');
      setMessage('');
      if (materialForm.status === 'published') {
        throw new Error('Published materials are controlled through their published version. Retire the version before changing publication state.');
      }
      await savePreparationMaterial({
        id: materialForm.id,
        title: materialForm.title,
        description: materialForm.description,
        materialType: materialForm.materialType,
        status: materialForm.status,
      });
      setMessage(materialForm.id ? 'Material details updated.' : 'Draft material created.');
      await refreshConsole(materialForm.id);
    } catch (saveError: any) {
      setError(saveError?.message || 'The material could not be saved.');
    } finally {
      setIsBusy(false);
    }
  };

  const editVersion = (version: MaterialAdminVersion) => {
    setVersionForm({
      id: version.id,
      versionLabel: version.versionLabel,
      storageBucket: version.storageBucket,
      storagePath: version.storagePath,
      fileName: version.fileName,
      mimeType: version.mimeType,
      sizeBytes: String(version.sizeBytes),
      checksumSha256: version.checksumSha256 || '',
    });
  };

  const resetVersionForm = () => {
    setVersionForm({
      id: '',
      versionLabel: '',
      storageBucket: 'agilecert-preparation-materials',
      storagePath: '',
      fileName: '',
      mimeType: 'application/pdf',
      sizeBytes: '0',
      checksumSha256: '',
    });
  };

  const handleSaveVersion = async () => {
    if (!selectedMaterial) return;
    const editingVersion = selectedMaterial.versions.find((version) => version.id === versionForm.id);
    if (editingVersion?.status === 'published') {
      setError('A published version must be retired before its private storage metadata can be edited.');
      return;
    }

    try {
      setIsBusy(true);
      setError('');
      setMessage('');
      await saveMaterialVersion({
        id: versionForm.id || undefined,
        materialId: selectedMaterial.id,
        versionLabel: versionForm.versionLabel,
        storageBucket: versionForm.storageBucket,
        storagePath: versionForm.storagePath,
        fileName: versionForm.fileName,
        mimeType: versionForm.mimeType,
        sizeBytes: Number(versionForm.sizeBytes),
        checksumSha256: versionForm.checksumSha256,
      });
      setMessage(versionForm.id ? 'Version metadata updated.' : 'Draft version metadata created.');
      resetVersionForm();
      await refreshConsole(selectedMaterial.id);
    } catch (saveError: any) {
      setError(saveError?.message || 'The material version could not be saved.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleVersionStatus = async (versionId: string, status: MaterialVersionStatus) => {
    if (!selectedMaterial) return;
    try {
      setIsBusy(true);
      setError('');
      setMessage('');
      await setMaterialVersionStatus(versionId, status);
      setMessage(
        status === 'published'
          ? 'Version published and previous published versions retired.'
          : `Version moved to ${status}.`,
      );
      await refreshConsole(selectedMaterial.id);
    } catch (statusError: any) {
      setError(statusError?.message || 'The version status could not be changed.');
    } finally {
      setIsBusy(false);
    }
  };

  const editMapping = (mapping: MaterialAdminMapping) => {
    setMappingForm({
      examinationId: mapping.examinationId,
      position: String(mapping.position),
      isRequired: mapping.isRequired,
      availableFrom: toDateTimeInput(mapping.availableFrom),
      expiresAt: toDateTimeInput(mapping.expiresAt),
      isActive: mapping.isActive,
    });
  };

  const handleSaveMapping = async () => {
    if (!selectedMaterial) return;
    try {
      setIsBusy(true);
      setError('');
      setMessage('');
      await saveMaterialMapping({
        examinationId: mappingForm.examinationId,
        materialId: selectedMaterial.id,
        position: Number(mappingForm.position),
        isRequired: mappingForm.isRequired,
        availableFrom: toIsoOrNull(mappingForm.availableFrom),
        expiresAt: toIsoOrNull(mappingForm.expiresAt),
        isActive: mappingForm.isActive,
      });
      setMessage('Examination mapping saved and candidate entitlements refreshed.');
      await refreshConsole(selectedMaterial.id);
    } catch (mappingError: any) {
      setError(mappingError?.message || 'The examination mapping could not be saved.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleRemoveMapping = async (mapping: MaterialAdminMapping) => {
    if (!selectedMaterial) return;
    if (!window.confirm(`Remove this material from ${mapping.examinationTitle}?`)) return;
    try {
      setIsBusy(true);
      setError('');
      await removeMaterialMapping(mapping.examinationId, selectedMaterial.id);
      setMessage('Mapping removed and related active entitlements revoked.');
      await refreshConsole(selectedMaterial.id);
    } catch (removeError: any) {
      setError(removeError?.message || 'The examination mapping could not be removed.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleReconcile = async () => {
    try {
      setIsBusy(true);
      setError('');
      setMessage('');
      const result = await reconcileMaterialEntitlements(reconcileExamId || undefined);
      setReconciliation(result);
      setMessage(`Reconciled ${result.assignmentsProcessed} assignment records.`);
      await refreshConsole(selectedMaterialId);
    } catch (reconcileError: any) {
      setError(reconcileError?.message || 'Entitlements could not be reconciled.');
    } finally {
      setIsBusy(false);
    }
  };

  const summary = consoleData?.summary;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <section className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 p-6 text-white shadow-xl md:p-8">
        <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div>
            <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.18em] text-emerald-400">
              <Database className="h-4 w-4" /> Phase 2.3B Staff Controls
            </div>
            <h1 className="mt-2 text-2xl font-black">Preparation Material Management</h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
              Create logical materials, register private version metadata, publish one current version,
              map materials to examinations and reconcile payment-verified candidate entitlements.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onBackToAudits}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs font-bold hover:bg-slate-800"
            >
              <ArrowLeft className="h-4 w-4" /> Proctor Audits
            </button>
            <button
              type="button"
              onClick={onExit}
              className="rounded-xl border border-slate-700 px-4 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-900"
            >
              Exit Control Hub
            </button>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Materials', value: summary?.materials || 0, detail: `${summary?.publishedMaterials || 0} published` },
          { label: 'Versions', value: summary?.versions || 0, detail: `${summary?.publishedVersions || 0} current` },
          { label: 'Active mappings', value: summary?.activeMappings || 0, detail: 'Examination links' },
          { label: 'Available access', value: summary?.activeEntitlements || 0, detail: `${summary?.scheduledEntitlements || 0} scheduled` },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">{item.label}</p>
            <p className="mt-1 text-3xl font-black text-slate-950">{item.value}</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">{item.detail}</p>
          </div>
        ))}
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </div>
      )}
      {message && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> {message}
        </div>
      )}

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-extrabold">Metadata publication only</p>
            <p className="mt-1 text-xs leading-relaxed text-amber-800">
              Storage bucket and object-path values are visible only to examination administrators. Candidate downloads,
              signed file URLs, download audit records and watermarking remain disabled until Phase 2.4.
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Material catalogue</h2>
            <button
              type="button"
              onClick={startNewMaterial}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-950 px-3 py-2 text-[11px] font-bold text-white"
            >
              <FilePlus2 className="h-3.5 w-3.5" /> New
            </button>
          </div>

          <div className="max-h-[720px] space-y-2 overflow-y-auto pr-1">
            {consoleData?.materials.length ? (
              consoleData.materials.map((material) => (
                <button
                  type="button"
                  key={material.id}
                  onClick={() => selectMaterial(material)}
                  className={`w-full rounded-xl border p-4 text-left transition ${
                    selectedMaterialId === material.id
                      ? 'border-slate-950 bg-slate-950 text-white'
                      : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-extrabold">{material.title}</p>
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-wide opacity-60">
                        {material.materialType.replace('_', ' ')}
                      </p>
                    </div>
                    <span className={`rounded-full border px-2 py-0.5 text-[9px] font-extrabold uppercase ${statusClass(material.status)}`}>
                      {material.status}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[10px] font-bold opacity-75">
                    <span>{material.versions.length} versions</span>
                    <span>{material.mappings.length} maps</span>
                    <span>{material.entitlementSummary.available} active</span>
                  </div>
                </button>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-xs text-slate-500">
                No preparation materials have been created.
              </div>
            )}
          </div>
        </aside>

        <main className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-emerald-600">Logical record</p>
                <h2 className="text-lg font-black text-slate-950">
                  {materialForm.id ? 'Edit material' : 'Create material'}
                </h2>
              </div>
              {isBusy && <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />}
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="md:col-span-2">
                <span className="mb-1.5 block text-xs font-bold text-slate-600">Material title</span>
                <input
                  value={materialForm.title}
                  onChange={(event) => setMaterialForm((current) => ({ ...current, title: event.target.value }))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
                  placeholder="Example: Project Management Foundation Study Guide"
                />
              </label>
              <label>
                <span className="mb-1.5 block text-xs font-bold text-slate-600">Material type</span>
                <select
                  value={materialForm.materialType}
                  onChange={(event) => setMaterialForm((current) => ({ ...current, materialType: event.target.value as MaterialType }))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                >
                  {materialTypes.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className="mb-1.5 block text-xs font-bold text-slate-600">Record status</span>
                <select
                  value={materialForm.status}
                  disabled={materialForm.status === 'published'}
                  onChange={(event) => setMaterialForm((current) => ({ ...current, status: event.target.value as MaterialStatus }))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm disabled:bg-slate-100"
                >
                  <option value="draft">Draft</option>
                  {materialForm.status === 'published' && <option value="published">Published</option>}
                  <option value="archived">Archived</option>
                </select>
              </label>
              <label className="md:col-span-2">
                <span className="mb-1.5 block text-xs font-bold text-slate-600">Description</span>
                <textarea
                  value={materialForm.description}
                  onChange={(event) => setMaterialForm((current) => ({ ...current, description: event.target.value }))}
                  rows={3}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
                />
              </label>
            </div>

            <button
              type="button"
              onClick={() => void handleSaveMaterial()}
              disabled={isBusy || materialForm.status === 'published'}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save className="h-4 w-4" /> Save material
            </button>
          </section>

          {selectedMaterial && (
            <>
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-indigo-600">Private version metadata</p>
                    <h2 className="text-lg font-black text-slate-950">Versions</h2>
                    <p className="mt-1 text-xs text-slate-500">Publishing a version retires any previously published version.</p>
                  </div>
                  <button type="button" onClick={resetVersionForm} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600">
                    New version
                  </button>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <label>
                    <span className="mb-1.5 block text-xs font-bold text-slate-600">Version label</span>
                    <input value={versionForm.versionLabel} onChange={(event) => setVersionForm((current) => ({ ...current, versionLabel: event.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" placeholder="2026 Edition" />
                  </label>
                  <label>
                    <span className="mb-1.5 block text-xs font-bold text-slate-600">Private bucket</span>
                    <input value={versionForm.storageBucket} onChange={(event) => setVersionForm((current) => ({ ...current, storageBucket: event.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
                  </label>
                  <label className="md:col-span-2">
                    <span className="mb-1.5 block text-xs font-bold text-slate-600">Private object path</span>
                    <input value={versionForm.storagePath} onChange={(event) => setVersionForm((current) => ({ ...current, storagePath: event.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" placeholder="materials/programme-code/file.pdf" />
                  </label>
                  <label>
                    <span className="mb-1.5 block text-xs font-bold text-slate-600">File name</span>
                    <input value={versionForm.fileName} onChange={(event) => setVersionForm((current) => ({ ...current, fileName: event.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
                  </label>
                  <label>
                    <span className="mb-1.5 block text-xs font-bold text-slate-600">MIME type</span>
                    <input value={versionForm.mimeType} onChange={(event) => setVersionForm((current) => ({ ...current, mimeType: event.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
                  </label>
                  <label>
                    <span className="mb-1.5 block text-xs font-bold text-slate-600">Size in bytes</span>
                    <input type="number" min="0" value={versionForm.sizeBytes} onChange={(event) => setVersionForm((current) => ({ ...current, sizeBytes: event.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
                  </label>
                  <label>
                    <span className="mb-1.5 block text-xs font-bold text-slate-600">SHA-256 checksum</span>
                    <input value={versionForm.checksumSha256} onChange={(event) => setVersionForm((current) => ({ ...current, checksumSha256: event.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 font-mono text-xs" placeholder="Optional 64-character checksum" />
                  </label>
                </div>

                <button type="button" onClick={() => void handleSaveVersion()} disabled={isBusy} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-extrabold text-white disabled:opacity-50">
                  <Save className="h-4 w-4" /> {versionForm.id ? 'Update draft metadata' : 'Create draft version'}
                </button>

                <div className="mt-6 space-y-3">
                  {selectedMaterial.versions.length ? selectedMaterial.versions.map((version) => (
                    <article key={version.id} className="rounded-xl border border-slate-200 p-4">
                      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-extrabold text-slate-900">{version.versionLabel}</p>
                            <span className={`rounded-full border px-2 py-0.5 text-[9px] font-extrabold uppercase ${statusClass(version.status)}`}>{version.status}</span>
                          </div>
                          <p className="mt-1 truncate text-xs text-slate-500">{version.fileName} · {formatBytes(version.sizeBytes)} · {version.mimeType}</p>
                          <p className="mt-1 truncate font-mono text-[10px] text-slate-400">{version.storageBucket}/{version.storagePath}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {version.status !== 'published' && (
                            <button type="button" onClick={() => editVersion(version)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-[10px] font-bold text-slate-600">Edit</button>
                          )}
                          {version.status !== 'published' && (
                            <button type="button" onClick={() => void handleVersionStatus(version.id, 'published')} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[10px] font-bold text-white">Publish</button>
                          )}
                          {version.status === 'published' && (
                            <button type="button" onClick={() => void handleVersionStatus(version.id, 'retired')} className="rounded-lg bg-slate-800 px-3 py-1.5 text-[10px] font-bold text-white">Retire</button>
                          )}
                          {version.status === 'retired' && (
                            <button type="button" onClick={() => void handleVersionStatus(version.id, 'draft')} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-[10px] font-bold text-amber-700">Return draft</button>
                          )}
                        </div>
                      </div>
                    </article>
                  )) : (
                    <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-xs text-slate-500">No version metadata has been registered.</div>
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-cyan-700">Examination mapping</p>
                  <h2 className="text-lg font-black text-slate-950">Availability and ordering</h2>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <label className="md:col-span-2">
                    <span className="mb-1.5 block text-xs font-bold text-slate-600">Examination</span>
                    <select value={mappingForm.examinationId} onChange={(event) => setMappingForm((current) => ({ ...current, examinationId: event.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm">
                      <option value="">Select examination</option>
                      {consoleData?.examinations.map((exam) => (
                        <option key={exam.id} value={exam.id}>{exam.programmeCode} — {exam.title} ({exam.status})</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="mb-1.5 block text-xs font-bold text-slate-600">Display position</span>
                    <input type="number" min="1" value={mappingForm.position} onChange={(event) => setMappingForm((current) => ({ ...current, position: event.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
                  </label>
                  <div className="flex flex-wrap items-end gap-5 pb-2">
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-700"><input type="checkbox" checked={mappingForm.isRequired} onChange={(event) => setMappingForm((current) => ({ ...current, isRequired: event.target.checked }))} /> Required</label>
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-700"><input type="checkbox" checked={mappingForm.isActive} onChange={(event) => setMappingForm((current) => ({ ...current, isActive: event.target.checked }))} /> Active</label>
                  </div>
                  <label>
                    <span className="mb-1.5 block text-xs font-bold text-slate-600">Available from</span>
                    <input type="datetime-local" value={mappingForm.availableFrom} onChange={(event) => setMappingForm((current) => ({ ...current, availableFrom: event.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
                  </label>
                  <label>
                    <span className="mb-1.5 block text-xs font-bold text-slate-600">Expires at</span>
                    <input type="datetime-local" value={mappingForm.expiresAt} onChange={(event) => setMappingForm((current) => ({ ...current, expiresAt: event.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
                  </label>
                </div>

                <button type="button" onClick={() => void handleSaveMapping()} disabled={isBusy || !mappingForm.examinationId} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-cyan-700 px-4 py-2.5 text-xs font-extrabold text-white disabled:opacity-50">
                  <Link2 className="h-4 w-4" /> Save mapping
                </button>

                <div className="mt-6 space-y-3">
                  {selectedMaterial.mappings.length ? selectedMaterial.mappings.map((mapping) => (
                    <article key={mapping.examinationId} className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center">
                      <div>
                        <p className="text-sm font-extrabold text-slate-900">{mapping.programmeCode} — {mapping.examinationTitle}</p>
                        <p className="mt-1 text-xs text-slate-500">Position {mapping.position} · {mapping.isRequired ? 'Required' : 'Optional'} · {mapping.isActive ? 'Active' : 'Inactive'}</p>
                        {(mapping.availableFrom || mapping.expiresAt) && (
                          <p className="mt-1 text-[10px] text-slate-400">{mapping.availableFrom ? `From ${new Date(mapping.availableFrom).toLocaleString()}` : 'Immediate'}{mapping.expiresAt ? ` · Until ${new Date(mapping.expiresAt).toLocaleString()}` : ''}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => editMapping(mapping)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-[10px] font-bold text-slate-600">Edit</button>
                        <button type="button" onClick={() => void handleRemoveMapping(mapping)} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-[10px] font-bold text-rose-700"><Trash2 className="h-3 w-3" /> Remove</button>
                      </div>
                    </article>
                  )) : (
                    <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-xs text-slate-500">This material is not mapped to an examination.</div>
                  )}
                </div>
              </section>
            </>
          )}

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-amber-700">Entitlement reconciliation</p>
                <h2 className="text-lg font-black text-slate-950">Refresh authoritative access</h2>
                <p className="mt-1 max-w-2xl text-xs text-slate-500">Re-evaluate access from examination assignments, fulfilled paid or waived orders, successful payments, publication status and mapping windows.</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <select value={reconcileExamId} onChange={(event) => setReconcileExamId(event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2.5 text-xs">
                  <option value="">All examinations</option>
                  {consoleData?.examinations.map((exam) => <option key={exam.id} value={exam.id}>{exam.programmeCode} — {exam.title}</option>)}
                </select>
                <button type="button" onClick={() => void handleReconcile()} disabled={isBusy} className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-extrabold text-slate-950 disabled:opacity-50">
                  <RefreshCw className={`h-4 w-4 ${isBusy ? 'animate-spin' : ''}`} /> Reconcile
                </button>
              </div>
            </div>

            {reconciliation && (
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {[
                  { label: 'Assignments', value: reconciliation.assignmentsProcessed, icon: BookOpen },
                  { label: 'Available', value: reconciliation.activeEntitlements, icon: CheckCircle2 },
                  { label: 'Scheduled', value: reconciliation.scheduledEntitlements, icon: Clock3 },
                  { label: 'Expired', value: reconciliation.expiredEntitlements, icon: Archive },
                  { label: 'Revoked', value: reconciliation.revokedEntitlements, icon: AlertTriangle },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
                    <item.icon className="mx-auto h-4 w-4 text-slate-500" />
                    <p className="mt-1 text-xl font-black text-slate-950">{item.value}</p>
                    <p className="text-[9px] font-extrabold uppercase tracking-wide text-slate-500">{item.label}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

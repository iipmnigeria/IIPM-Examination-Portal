import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CopyPlus,
  Eye,
  FileImage,
  Grid3X3,
  Image as ImageIcon,
  Loader2,
  LockKeyhole,
  MousePointer2,
  QrCode,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  Type,
  ZoomIn,
} from 'lucide-react';
import {
  certificatePageRatio,
  createCertificateDesignerSignedUrl,
  createCertificateQrPreview,
  defaultSamplePayload,
  getCertificateDesignerSnapshot,
  normaliseDesignElement,
  saveCertificateTemplateDesign,
  validateCertificateTemplateDesign,
  type CertificateDesignElement,
  type CertificateDesignerFieldDefinition,
  type CertificateDesignerPreviewProfile,
  type CertificateDesignerSnapshot,
  type CertificateDesignerVersion,
  type CertificateDesignValidation,
} from '../services/certificateDesignerService';

const emptySnapshot: CertificateDesignerSnapshot = {
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
  fieldDefinitions: [],
  versions: [],
  assets: [],
  previewProfiles: [],
};

const emptyValidation: CertificateDesignValidation = {
  valid: false,
  errors: [],
  warnings: [],
  missingRequiredFields: [],
  elementCount: 0,
};

const fieldClass = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100 disabled:bg-slate-100 disabled:text-slate-400';
const smallButton = 'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40';
const primaryButton = 'inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-black text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-45';

const numberValue = (value: string, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const clamp = (value: number, minimum: number, maximum: number): number => (
  Math.min(maximum, Math.max(minimum, value))
);

const assetTypeForField = (fieldKey: string): string | null => {
  if (fieldKey === 'institutionLogo') return 'logo';
  if (fieldKey === 'institutionSeal') return 'seal';
  if (fieldKey === 'authorisedSignature') return 'signature';
  return null;
};

const fontStack = (family: CertificateDesignElement['fontFamily']): string => {
  if (family === 'serif') return 'Georgia, Cambria, "Times New Roman", serif';
  if (family === 'mono') return 'ui-monospace, SFMono-Regular, Menlo, monospace';
  return 'Inter, ui-sans-serif, system-ui, sans-serif';
};

const formatDate = (value?: string | null): string => {
  if (!value) return 'Not saved';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
};

const DesignerStatus = ({ version }: { version: CertificateDesignerVersion }) => {
  const editable = ['draft', 'changes_requested'].includes(version.status);
  return (
    <span className={`rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-wide ${editable ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
      {editable ? 'Editable design' : version.status.replaceAll('_', ' ')}
    </span>
  );
};

export default function AdminCertificateDesigner() {
  const [snapshot, setSnapshot] = useState<CertificateDesignerSnapshot>(emptySnapshot);
  const [selectedVersionId, setSelectedVersionId] = useState('');
  const [elements, setElements] = useState<CertificateDesignElement[]>([]);
  const [samplePayload, setSamplePayload] = useState<Record<string, string>>({});
  const [previewOptions, setPreviewOptions] = useState<CertificateDesignerPreviewProfile['previewOptions']>({
    showSafeArea: true,
    showGrid: false,
    zoom: 1,
    backgroundMode: 'master',
  });
  const [selectedElementId, setSelectedElementId] = useState('');
  const [masterUrl, setMasterUrl] = useState('');
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({});
  const [qrPreview, setQrPreview] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [validation, setValidation] = useState<CertificateDesignValidation>(emptyValidation);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    elementId: string;
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startXPct: number;
    startYPct: number;
  } | null>(null);

  const selectedVersion = useMemo(
    () => snapshot.versions.find((version) => version.id === selectedVersionId) || null,
    [selectedVersionId, snapshot.versions],
  );
  const selectedElement = useMemo(
    () => elements.find((element) => element.id === selectedElementId) || null,
    [elements, selectedElementId],
  );
  const fieldByKey = useMemo(
    () => new Map(snapshot.fieldDefinitions.map((definition) => [definition.fieldKey, definition])),
    [snapshot.fieldDefinitions],
  );
  const relevantAssets = useMemo(
    () => snapshot.assets.filter((asset) => asset.institutionId === selectedVersion?.institutionId),
    [selectedVersion?.institutionId, snapshot.assets],
  );
  const canEdit = Boolean(
    selectedVersion
      && snapshot.access.canManageTemplates
      && ['draft', 'changes_requested'].includes(selectedVersion.status),
  );
  const pageRatio = certificatePageRatio(selectedVersion);

  const refresh = async (retainVersion = true) => {
    try {
      setLoading(true);
      setError('');
      const next = await getCertificateDesignerSnapshot();
      setSnapshot(next);
      setSelectedVersionId((current) => (
        retainVersion && next.versions.some((version) => version.id === current)
          ? current
          : next.versions[0]?.id || ''
      ));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load the Certificate Designer.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh(false);
  }, []);

  useEffect(() => {
    if (!selectedVersion) {
      setElements([]);
      setMasterUrl('');
      return;
    }

    const profile = snapshot.previewProfiles.find((item) => item.versionId === selectedVersion.id);
    const defaults = defaultSamplePayload(snapshot.fieldDefinitions);
    setElements(selectedVersion.overlaySchema.map((element) => normaliseDesignElement(element, fieldByKey.get(element.fieldKey))));
    setSamplePayload({ ...defaults, ...(profile?.samplePayload || {}) });
    setPreviewOptions({
      showSafeArea: true,
      showGrid: false,
      zoom: 1,
      backgroundMode: 'master',
      ...(profile?.previewOptions || {}),
    });
    setValidation(profile?.lastValidationReport || emptyValidation);
    setSelectedElementId('');
    setMessage('');
    setError('');

    let active = true;
    void createCertificateDesignerSignedUrl(selectedVersion.storageBucket, selectedVersion.storagePath)
      .then((url) => {
        if (active) setMasterUrl(url);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Unable to open the private master file.');
      });

    return () => {
      active = false;
    };
  }, [fieldByKey, selectedVersion, snapshot.fieldDefinitions, snapshot.previewProfiles]);

  useEffect(() => {
    let active = true;
    const value = samplePayload.qrCode || samplePayload.verificationCode || 'https://agilecert.iipmi.org/verify';
    void createCertificateQrPreview(value).then((url) => {
      if (active) setQrPreview(url);
    });
    return () => {
      active = false;
    };
  }, [samplePayload.qrCode, samplePayload.verificationCode]);

  useEffect(() => {
    let active = true;
    const ids = Array.from(new Set(elements.map((element) => element.assetId).filter(Boolean))) as string[];
    const missing = ids.filter((id) => !assetUrls[id]);
    if (!missing.length) return undefined;

    void Promise.all(missing.map(async (id) => {
      const asset = snapshot.assets.find((item) => item.id === id);
      if (!asset) return null;
      const url = await createCertificateDesignerSignedUrl(asset.storageBucket, asset.storagePath);
      return [id, url] as const;
    })).then((entries) => {
      if (!active) return;
      setAssetUrls((current) => ({
        ...current,
        ...Object.fromEntries(entries.filter(Boolean) as Array<readonly [string, string]>),
      }));
    }).catch((reason) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Unable to open a private certificate asset.');
    });

    return () => {
      active = false;
    };
  }, [assetUrls, elements, snapshot.assets]);

  const updateElement = (id: string, patch: Partial<CertificateDesignElement>) => {
    setElements((current) => current.map((element) => (
      element.id === id ? normaliseDesignElement({ ...element, ...patch }, fieldByKey.get(element.fieldKey)) : element
    )));
    setValidation(emptyValidation);
  };

  const addField = (definition: CertificateDesignerFieldDefinition) => {
    if (!canEdit) return;
    const existing = elements.find((element) => element.fieldKey === definition.fieldKey && definition.fieldKey !== 'customText');
    if (existing) {
      setSelectedElementId(existing.id);
      setMessage(`${definition.label} is already mapped. The existing element is selected.`);
      return;
    }

    const expectedAssetType = assetTypeForField(definition.fieldKey);
    const firstAsset = definition.dataType === 'asset'
      ? relevantAssets.find((asset) => !expectedAssetType || asset.assetType === expectedAssetType)
      : undefined;
    const next = normaliseDesignElement({
      id: crypto.randomUUID(),
      fieldKey: definition.fieldKey,
      label: definition.label,
      dataType: definition.dataType,
      xPct: definition.dataType === 'asset' || definition.dataType === 'qr' ? 8 : 20,
      yPct: clamp(10 + ((elements.length * 7) % 70), 2, 82),
      assetId: firstAsset?.id || null,
      customText: definition.fieldKey === 'customText' ? definition.sampleValue : '',
    }, definition);
    setElements((current) => [...current, next]);
    setSelectedElementId(next.id);
    setValidation(emptyValidation);
  };

  const removeSelected = () => {
    if (!selectedElement || !canEdit) return;
    setElements((current) => current.filter((element) => element.id !== selectedElement.id));
    setSelectedElementId('');
    setValidation(emptyValidation);
  };

  const resetDesign = () => {
    if (!selectedVersion) return;
    const profile = snapshot.previewProfiles.find((item) => item.versionId === selectedVersion.id);
    setElements(selectedVersion.overlaySchema.map((element) => normaliseDesignElement(element, fieldByKey.get(element.fieldKey))));
    setSamplePayload({ ...defaultSamplePayload(snapshot.fieldDefinitions), ...(profile?.samplePayload || {}) });
    setPreviewOptions({ showSafeArea: true, showGrid: false, zoom: 1, backgroundMode: 'master', ...(profile?.previewOptions || {}) });
    setValidation(profile?.lastValidationReport || emptyValidation);
    setSelectedElementId('');
    setMessage('Unsaved designer changes were reset.');
  };

  const runValidation = async () => {
    if (!selectedVersion) return;
    try {
      setBusy('validate');
      setError('');
      const report = await validateCertificateTemplateDesign(selectedVersion.id, elements);
      setValidation(report);
      setMessage(report.valid ? 'The template design passed server-side validation.' : 'The template design requires corrections.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to validate the certificate design.');
    } finally {
      setBusy('');
    }
  };

  const saveDesign = async () => {
    if (!selectedVersion || !canEdit) return;
    try {
      setBusy('save');
      setError('');
      setMessage('');
      const result = await saveCertificateTemplateDesign({
        versionId: selectedVersion.id,
        overlaySchema: elements,
        samplePayload,
        previewOptions,
        pageWidthPoints: selectedVersion.pageWidthPoints,
        pageHeightPoints: selectedVersion.pageHeightPoints,
        notes: 'Visual design and preview profile saved in Phase 1B.',
      });
      setValidation(result.validation);
      setMessage('Visual design, field mapping and preview sample data saved.');
      await refresh(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save the certificate design.');
    } finally {
      setBusy('');
    }
  };

  const displayValue = (element: CertificateDesignElement): string => {
    const definition = fieldByKey.get(element.fieldKey);
    const raw = element.fieldKey === 'customText'
      ? element.customText || samplePayload[element.fieldKey] || definition?.sampleValue || ''
      : samplePayload[element.fieldKey] || definition?.sampleValue || element.label;
    const result = `${element.prefix}${raw}${element.suffix}`;
    return element.uppercase ? result.toUpperCase() : result;
  };

  const beginDrag = (event: PointerEvent<HTMLDivElement>, element: CertificateDesignElement) => {
    if (!canEdit) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedElementId(element.id);
    dragRef.current = {
      elementId: element.id,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startXPct: element.xPct,
      startYPct: element.yPct,
    };
  };

  const moveDrag = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const canvas = canvasRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !canvas) return;
    const element = elements.find((item) => item.id === drag.elementId);
    if (!element) return;
    const rect = canvas.getBoundingClientRect();
    const xPct = drag.startXPct + ((event.clientX - drag.startClientX) / rect.width) * 100;
    const yPct = drag.startYPct + ((event.clientY - drag.startClientY) / rect.height) * 100;
    updateElement(element.id, {
      xPct: clamp(xPct, 0, 100 - element.widthPct),
      yPct: clamp(yPct, 0, 100 - element.heightPct),
    });
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  };

  const selectedDefinition = selectedElement ? fieldByKey.get(selectedElement.fieldKey) : undefined;
  const selectedAssetOptions = selectedElement?.dataType === 'asset'
    ? relevantAssets.filter((asset) => {
        const expected = assetTypeForField(selectedElement.fieldKey);
        return !expected || asset.assetType === expected;
      })
    : [];

  if (loading && !snapshot.access.actorId) {
    return (
      <div className="grid min-h-[70vh] place-items-center">
        <div className="flex items-center gap-3 text-sm font-black text-slate-500">
          <Loader2 className="h-7 w-7 animate-spin text-violet-600" /> Loading Certificate Designer…
        </div>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-[1720px] space-y-4 px-4 py-5 text-slate-900 md:px-6">
      <section className="overflow-hidden rounded-3xl bg-gradient-to-r from-violet-950 via-slate-950 to-indigo-950 text-white shadow-xl">
        <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-300">Phase 1B controlled design workspace</p>
            <h1 className="mt-2 flex items-center gap-2 text-2xl font-black"><Sparkles className="h-6 w-6 text-amber-300" />Visual Certificate Designer</h1>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">
              Position dynamic certificate fields over an immutable master, bind approved institutional assets, test representative data and save a validated overlay for later server-side renderer integration.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={smallButton} onClick={() => void refresh(true)} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <button type="button" className={smallButton} onClick={resetDesign} disabled={!selectedVersion}>
              <RotateCcw className="h-4 w-4" /> Reset
            </button>
            <button type="button" className={smallButton} onClick={() => void runValidation()} disabled={!selectedVersion || busy !== ''}>
              {busy === 'validate' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Validate
            </button>
            <button type="button" className={primaryButton} onClick={() => void saveDesign()} disabled={!canEdit || busy !== ''}>
              {busy === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save design
            </button>
          </div>
        </div>
      </section>

      {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{message}</div>}
      {error && <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}

      <section className="grid gap-4 xl:grid-cols-[300px_minmax(560px,1fr)_330px]">
        <aside className="space-y-4">
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <label className="text-xs font-black">Master version
              <select className={fieldClass} value={selectedVersionId} onChange={(event) => setSelectedVersionId(event.target.value)}>
                {snapshot.versions.map((version) => (
                  <option key={version.id} value={version.id}>
                    {version.institutionCode} · {version.templateName} · v{version.versionNumber} · {version.status}
                  </option>
                ))}
              </select>
            </label>
            {selectedVersion && (
              <div className="mt-4 space-y-2 text-xs text-slate-600">
                <div className="flex items-center justify-between gap-2"><DesignerStatus version={selectedVersion} /><span>{selectedVersion.sourceFormat.toUpperCase()}</span></div>
                <p className="font-black text-slate-900">{selectedVersion.templateName}</p>
                <p>{selectedVersion.categoryName} · {selectedVersion.orientation} {selectedVersion.pageSize}</p>
                <p className="text-[10px] text-slate-400">Design saved: {formatDate(selectedVersion.designerUpdatedAt)}</p>
                <button type="button" className={`${smallButton} mt-2 w-full`} disabled={!masterUrl} onClick={() => window.open(masterUrl, '_blank', 'noopener,noreferrer')}>
                  <Eye className="h-4 w-4" /> Open immutable master
                </button>
              </div>
            )}
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-black"><CopyPlus className="h-4 w-4 text-violet-600" />Dynamic fields</h2>
              <span className="text-[10px] font-bold text-slate-400">{elements.length}/80</span>
            </div>
            <div className="mt-3 max-h-[390px] space-y-3 overflow-y-auto pr-1">
              {Array.from(new Set(snapshot.fieldDefinitions.map((definition) => definition.category))).map((category) => (
                <div key={category}>
                  <p className="mb-1 text-[9px] font-black uppercase tracking-wide text-slate-400">{category}</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {snapshot.fieldDefinitions.filter((definition) => definition.category === category).map((definition) => {
                      const mapped = elements.some((element) => element.fieldKey === definition.fieldKey && definition.fieldKey !== 'customText');
                      const Icon = definition.dataType === 'qr' ? QrCode : definition.dataType === 'asset' ? ImageIcon : Type;
                      return (
                        <button
                          key={definition.fieldKey}
                          type="button"
                          disabled={!canEdit}
                          title={definition.description}
                          onClick={() => addField(definition)}
                          className={`flex min-h-16 flex-col items-start justify-between rounded-xl border p-2 text-left transition ${mapped ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50 hover:border-violet-300 hover:bg-violet-50'} disabled:opacity-45`}
                        >
                          <Icon className={`h-4 w-4 ${mapped ? 'text-emerald-600' : 'text-violet-600'}`} />
                          <span className="mt-2 text-[9px] font-black leading-3">{definition.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="flex items-center gap-2 text-sm font-black"><Type className="h-4 w-4 text-indigo-600" />Preview sample data</h2>
            <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
              {snapshot.fieldDefinitions.filter((definition) => definition.dataType !== 'asset').map((definition) => (
                <label key={definition.fieldKey} className="block text-[10px] font-bold text-slate-600">
                  {definition.label}
                  <input
                    className={fieldClass}
                    value={samplePayload[definition.fieldKey] || ''}
                    onChange={(event) => setSamplePayload((current) => ({ ...current, [definition.fieldKey]: event.target.value }))}
                  />
                </label>
              ))}
            </div>
          </article>
        </aside>

        <section className="min-w-0 rounded-2xl border border-slate-200 bg-slate-900 p-3 shadow-xl">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-white">
            <div>
              <p className="text-xs font-black">Live master preview</p>
              <p className="text-[10px] text-slate-400">Drag selected fields; use the property panel for exact print positioning.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className={`${smallButton} ${previewOptions.showSafeArea ? 'border-violet-300 bg-violet-50 text-violet-700' : ''}`} onClick={() => setPreviewOptions((current) => ({ ...current, showSafeArea: !current.showSafeArea }))}>
                <MousePointer2 className="h-4 w-4" /> Safe area
              </button>
              <button type="button" className={`${smallButton} ${previewOptions.showGrid ? 'border-violet-300 bg-violet-50 text-violet-700' : ''}`} onClick={() => setPreviewOptions((current) => ({ ...current, showGrid: !current.showGrid }))}>
                <Grid3X3 className="h-4 w-4" /> Grid
              </button>
              <label className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-[10px] font-black">
                <ZoomIn className="h-4 w-4" />
                <select className="bg-transparent outline-none" value={previewOptions.zoom || 1} onChange={(event) => setPreviewOptions((current) => ({ ...current, zoom: numberValue(event.target.value, 1) }))}>
                  <option className="text-slate-900" value={0.75}>75%</option>
                  <option className="text-slate-900" value={1}>100%</option>
                  <option className="text-slate-900" value={1.25}>125%</option>
                </select>
              </label>
            </div>
          </div>

          <div className="max-h-[calc(100vh-220px)] overflow-auto rounded-xl bg-slate-800 p-4">
            <div
              ref={canvasRef}
              className="relative mx-auto overflow-hidden bg-white shadow-2xl"
              style={{
                width: `${(previewOptions.zoom || 1) * 100}%`,
                maxWidth: `${(previewOptions.zoom || 1) * 1040}px`,
                aspectRatio: String(pageRatio),
                backgroundImage: previewOptions.showGrid
                  ? 'linear-gradient(rgba(99,102,241,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,.12) 1px, transparent 1px)'
                  : undefined,
                backgroundSize: previewOptions.showGrid ? '5% 5%' : undefined,
              }}
              onPointerDown={() => setSelectedElementId('')}
            >
              {previewOptions.backgroundMode !== 'plain' && masterUrl && selectedVersion && (
                selectedVersion.sourceFormat === 'pdf' ? (
                  <iframe
                    title="Certificate master preview"
                    src={`${masterUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                    className="pointer-events-none absolute inset-0 h-full w-full border-0"
                  />
                ) : (
                  <img src={masterUrl} alt="Certificate master" className="pointer-events-none absolute inset-0 h-full w-full object-fill" />
                )
              )}

              {previewOptions.showSafeArea && <div className="pointer-events-none absolute inset-[3%] border border-dashed border-rose-500/70" />}

              {elements.map((element) => {
                const selected = selectedElementId === element.id;
                const assetUrl = element.assetId ? assetUrls[element.assetId] : '';
                return (
                  <div
                    key={element.id}
                    role="button"
                    tabIndex={0}
                    onPointerDown={(event) => beginDrag(event, element)}
                    onPointerMove={moveDrag}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedElementId(element.id);
                    }}
                    className={`absolute flex touch-none select-none items-center overflow-hidden ${selected ? 'z-20 cursor-move border-2 border-violet-600 bg-violet-100/10 shadow-lg' : 'z-10 border border-transparent hover:border-violet-400/70'} ${canEdit ? 'cursor-move' : 'cursor-default'}`}
                    style={{
                      left: `${element.xPct}%`,
                      top: `${element.yPct}%`,
                      width: `${element.widthPct}%`,
                      height: `${element.heightPct}%`,
                      opacity: element.opacity,
                      transform: `rotate(${element.rotation}deg)`,
                      justifyContent: element.textAlign === 'left' ? 'flex-start' : element.textAlign === 'right' ? 'flex-end' : 'center',
                    }}
                  >
                    {element.dataType === 'qr' ? (
                      qrPreview ? <img src={qrPreview} alt="Verification QR preview" className="h-full w-full object-contain" /> : <QrCode className="h-8 w-8 text-slate-500" />
                    ) : element.dataType === 'asset' ? (
                      assetUrl ? <img src={assetUrl} alt={element.label} className="h-full w-full object-contain" /> : <div className="grid h-full w-full place-items-center bg-slate-100 text-[9px] font-black text-slate-400"><FileImage className="h-5 w-5" />Select approved asset</div>
                    ) : (
                      <span
                        className="block w-full whitespace-pre-wrap px-1"
                        style={{
                          color: element.color,
                          fontFamily: fontStack(element.fontFamily),
                          fontSize: `${Math.max(7, element.fontSizePt * 0.82)}px`,
                          fontWeight: element.fontWeight,
                          textAlign: element.textAlign,
                          lineHeight: element.lineHeight,
                          letterSpacing: `${element.letterSpacing}px`,
                        }}
                      >
                        {displayValue(element)}
                      </span>
                    )}
                    {selected && <span className="pointer-events-none absolute right-0 top-0 rounded-bl bg-violet-600 px-1.5 py-0.5 text-[7px] font-black text-white">{element.label}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="flex items-center gap-2 text-sm font-black"><MousePointer2 className="h-4 w-4 text-violet-600" />Element properties</h2>
            {!selectedElement ? (
              <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-6 text-center text-xs leading-5 text-slate-500">
                Select a mapped field on the certificate preview to edit its exact position and print styling.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs font-black">{selectedElement.label}</p>
                  <p className="mt-1 text-[10px] leading-4 text-slate-500">{selectedDefinition?.description}</p>
                </div>

                {selectedElement.fieldKey === 'customText' && (
                  <label className="block text-[10px] font-bold">Approved static wording
                    <textarea className={`${fieldClass} min-h-20`} value={selectedElement.customText} disabled={!canEdit} onChange={(event) => updateElement(selectedElement.id, { customText: event.target.value })} />
                  </label>
                )}

                {selectedElement.dataType === 'asset' && (
                  <label className="block text-[10px] font-bold">Approved institutional asset
                    <select className={fieldClass} value={selectedElement.assetId || ''} disabled={!canEdit} onChange={(event) => updateElement(selectedElement.id, { assetId: event.target.value || null })}>
                      <option value="">Select an approved asset</option>
                      {selectedAssetOptions.map((asset) => <option key={asset.id} value={asset.id}>{asset.assetType} · {asset.name} · v{asset.versionNumber}</option>)}
                    </select>
                  </label>
                )}

                <div className="grid grid-cols-2 gap-2">
                  {([
                    ['X position %', 'xPct', 0, 98],
                    ['Y position %', 'yPct', 0, 98],
                    ['Width %', 'widthPct', 2, 100],
                    ['Height %', 'heightPct', 2, 100],
                  ] as const).map(([label, key, min, max]) => (
                    <label key={key} className="text-[10px] font-bold">{label}
                      <input type="number" step="0.1" min={min} max={max} className={fieldClass} value={selectedElement[key]} disabled={!canEdit} onChange={(event) => updateElement(selectedElement.id, { [key]: numberValue(event.target.value, selectedElement[key]) })} />
                    </label>
                  ))}
                </div>

                {['text', 'date', 'number'].includes(selectedElement.dataType) && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-[10px] font-bold">Font size pt<input type="number" min="4" max="160" className={fieldClass} value={selectedElement.fontSizePt} disabled={!canEdit} onChange={(event) => updateElement(selectedElement.id, { fontSizePt: numberValue(event.target.value, selectedElement.fontSizePt) })} /></label>
                      <label className="text-[10px] font-bold">Weight<select className={fieldClass} value={selectedElement.fontWeight} disabled={!canEdit} onChange={(event) => updateElement(selectedElement.id, { fontWeight: numberValue(event.target.value, selectedElement.fontWeight) })}><option value="400">Regular</option><option value="500">Medium</option><option value="600">Semibold</option><option value="700">Bold</option><option value="800">Extra bold</option></select></label>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-[10px] font-bold">Font<select className={fieldClass} value={selectedElement.fontFamily} disabled={!canEdit} onChange={(event) => updateElement(selectedElement.id, { fontFamily: event.target.value as CertificateDesignElement['fontFamily'] })}><option value="serif">Serif</option><option value="sans">Sans serif</option><option value="mono">Monospace</option></select></label>
                      <label className="text-[10px] font-bold">Alignment<select className={fieldClass} value={selectedElement.textAlign} disabled={!canEdit} onChange={(event) => updateElement(selectedElement.id, { textAlign: event.target.value as CertificateDesignElement['textAlign'] })}><option value="left">Left</option><option value="center">Centre</option><option value="right">Right</option></select></label>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-[10px] font-bold">Text colour<input type="color" className={`${fieldClass} h-10 p-1`} value={selectedElement.color} disabled={!canEdit} onChange={(event) => updateElement(selectedElement.id, { color: event.target.value })} /></label>
                      <label className="text-[10px] font-bold">Line height<input type="number" min="0.8" max="3" step="0.05" className={fieldClass} value={selectedElement.lineHeight} disabled={!canEdit} onChange={(event) => updateElement(selectedElement.id, { lineHeight: numberValue(event.target.value, selectedElement.lineHeight) })} /></label>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-[10px] font-bold">Prefix<input className={fieldClass} value={selectedElement.prefix} disabled={!canEdit} onChange={(event) => updateElement(selectedElement.id, { prefix: event.target.value })} /></label>
                      <label className="text-[10px] font-bold">Suffix<input className={fieldClass} value={selectedElement.suffix} disabled={!canEdit} onChange={(event) => updateElement(selectedElement.id, { suffix: event.target.value })} /></label>
                    </div>
                    <label className="flex items-center gap-2 text-[10px] font-bold"><input type="checkbox" checked={selectedElement.uppercase} disabled={!canEdit} onChange={(event) => updateElement(selectedElement.id, { uppercase: event.target.checked })} />Display in uppercase</label>
                  </>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[10px] font-bold">Rotation<input type="number" min="-180" max="180" className={fieldClass} value={selectedElement.rotation} disabled={!canEdit} onChange={(event) => updateElement(selectedElement.id, { rotation: numberValue(event.target.value, selectedElement.rotation) })} /></label>
                  <label className="text-[10px] font-bold">Opacity<input type="number" min="0.05" max="1" step="0.05" className={fieldClass} value={selectedElement.opacity} disabled={!canEdit} onChange={(event) => updateElement(selectedElement.id, { opacity: numberValue(event.target.value, selectedElement.opacity) })} /></label>
                </div>

                <button type="button" className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-black text-rose-700 hover:bg-rose-100 disabled:opacity-40" disabled={!canEdit} onClick={removeSelected}>
                  <Trash2 className="h-4 w-4" /> Remove field
                </button>
              </div>
            )}
          </article>

          <article className={`rounded-2xl border p-4 shadow-sm ${validation.valid ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-black">{validation.valid ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}Design validation</h2>
              <span className="text-[10px] font-black">{validation.elementCount || elements.length} elements</span>
            </div>
            {validation.errors.length === 0 && validation.warnings.length === 0 && !validation.valid ? (
              <p className="mt-3 text-xs leading-5 text-amber-900/80">Run validation before saving or submitting this master version for review.</p>
            ) : (
              <div className="mt-3 space-y-2 text-xs leading-5">
                {validation.errors.map((item) => <p key={item} className="flex gap-2 text-rose-700"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{item}</p>)}
                {validation.warnings.map((item) => <p key={item} className="flex gap-2 text-amber-800"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{item}</p>)}
                {validation.valid && <p className="flex gap-2 font-bold text-emerald-700"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />All required fields and print bounds passed validation.</p>}
              </div>
            )}
          </article>

          <article className="rounded-2xl border border-slate-300 bg-slate-950 p-4 text-white shadow-sm">
            <h2 className="flex items-center gap-2 text-sm font-black"><LockKeyhole className="h-4 w-4 text-amber-300" />Release boundary</h2>
            <p className="mt-3 text-xs leading-5 text-slate-300">
              This designer saves overlay metadata and preview samples only. It does not issue certificates, replace current PDF renderers, alter verification codes, or publish a template automatically.
            </p>
          </article>
        </aside>
      </section>
    </main>
  );
}

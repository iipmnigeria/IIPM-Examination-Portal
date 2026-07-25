import { useEffect, useMemo, useState } from 'react';
import {
  Award,
  CheckCircle2,
  CircleAlert,
  FileClock,
  History,
  LayoutTemplate,
  Loader2,
  RefreshCw,
  RotateCcw,
  Save,
  Settings2,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import {
  getCertificateAdminConsole,
  type AdminCertificateConsole,
  type AdminCertificateRecord,
} from '../services/certificateService';
import {
  correctAndReissueCertificate,
  decideCertificateRequest,
  getCertificateCompletionConsole,
  saveCertificateTemplate,
  setCertificateApprovalPolicy,
  type CertificateApprovalDecision,
  type CertificateCompletionConsole,
  type CertificateTemplateRecord,
} from '../services/certificateCompletionService';

const emptyAuthority: AdminCertificateConsole = {
  eligibilities: [],
  certificates: [],
  policies: [],
  counts: {
    eligible: 0,
    requested: 0,
    issued: 0,
    blocked: 0,
    activeCertificates: 0,
    restrictedCertificates: 0,
  },
};

const emptyCompletion: CertificateCompletionConsole = {
  templates: [],
  approvalQueue: [],
  decisions: [],
  revisions: [],
  auditEvents: [],
  approvalPolicies: [],
};

type TabKey = 'approvals' | 'templates' | 'reissue' | 'history';

interface TemplateDraft {
  templateId: string;
  programmeId: string;
  programmeName: string;
  productCode: 'achievement' | 'professional';
  templateName: string;
  certificateTitle: string;
  issuerName: string;
  subtitle: string;
  leftSignatoryName: string;
  leftSignatoryTitle: string;
  rightSignatoryName: string;
  rightSignatoryTitle: string;
  primaryColour: string;
  accentColour: string;
}

const formatDate = (value?: string | null): string => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const draftFromTemplate = (template: CertificateTemplateRecord): TemplateDraft => ({
  templateId: template.id,
  programmeId: template.programmeId,
  programmeName: template.programmeName,
  productCode: template.productCode,
  templateName: template.templateName,
  certificateTitle: template.certificateTitle,
  issuerName: template.issuerName,
  subtitle: template.subtitle,
  leftSignatoryName: template.leftSignatoryName,
  leftSignatoryTitle: template.leftSignatoryTitle,
  rightSignatoryName: template.rightSignatoryName,
  rightSignatoryTitle: template.rightSignatoryTitle,
  primaryColour: template.primaryColour,
  accentColour: template.accentColour,
});

const badgeClass = (value: string): string => {
  if (['approved', 'active', 'issued', 'automatic'].includes(value)) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }
  if (['pending', 'requested', 'manual', 'changes_requested', 'superseded'].includes(value)) {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }
  return 'border-rose-200 bg-rose-50 text-rose-700';
};

export default function AdminCertificateCompletionPanel() {
  const [authority, setAuthority] = useState<AdminCertificateConsole>(emptyAuthority);
  const [completion, setCompletion] = useState<CertificateCompletionConsole>(emptyCompletion);
  const [activeTab, setActiveTab] = useState<TabKey>('approvals');
  const [templateDraft, setTemplateDraft] = useState<TemplateDraft | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busyKey, setBusyKey] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const refresh = async () => {
    try {
      setIsLoading(true);
      setError('');
      const [nextAuthority, nextCompletion] = await Promise.all([
        getCertificateAdminConsole(200),
        getCertificateCompletionConsole(200),
      ]);
      setAuthority(nextAuthority);
      setCompletion(nextCompletion);
      const activeTemplate = nextCompletion.templates.find((item) => item.active);
      if (!templateDraft && activeTemplate) setTemplateDraft(draftFromTemplate(activeTemplate));
    } catch (refreshError) {
      console.error('Unable to load certificate lifecycle controls:', refreshError);
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : 'Unable to load certificate lifecycle controls.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const activeTemplates = useMemo(
    () => completion.templates.filter((template) => template.active),
    [completion.templates],
  );

  const pendingQueue = useMemo(
    () => completion.approvalQueue.filter((item) => item.approvalStatus === 'pending'),
    [completion.approvalQueue],
  );

  const handlePolicy = async (
    examinationId: string,
    approvalMode: 'automatic' | 'manual',
    requireCandidateRequest: boolean,
  ) => {
    try {
      setBusyKey(`policy:${examinationId}`);
      setError('');
      setMessage('');
      await setCertificateApprovalPolicy({
        examinationId,
        approvalMode,
        requireCandidateRequest,
      });
      setMessage(`Certificate approval policy changed to ${approvalMode}.`);
      await refresh();
    } catch (policyError) {
      setError(policyError instanceof Error ? policyError.message : 'Unable to update approval policy.');
    } finally {
      setBusyKey('');
    }
  };

  const handleDecision = async (
    eligibilityId: string,
    decision: CertificateApprovalDecision,
  ) => {
    let reason = '';
    if (decision !== 'approved') {
      reason = window.prompt(
        decision === 'changes_requested'
          ? 'State the changes the candidate must make:'
          : 'State the reason for rejecting this certificate request:',
      )?.trim() || '';
      if (!reason) return;
    }

    try {
      setBusyKey(`decision:${eligibilityId}`);
      setError('');
      setMessage('');
      await decideCertificateRequest({ eligibilityId, decision, reason });
      setMessage(`Certificate request marked ${decision.replace(/_/g, ' ')}.`);
      await refresh();
    } catch (decisionError) {
      setError(
        decisionError instanceof Error
          ? decisionError.message
          : 'Unable to record the certificate decision.',
      );
    } finally {
      setBusyKey('');
    }
  };

  const handleTemplateSave = async () => {
    if (!templateDraft) return;
    const requiredValues = [
      templateDraft.templateName,
      templateDraft.certificateTitle,
      templateDraft.issuerName,
      templateDraft.subtitle,
      templateDraft.leftSignatoryName,
      templateDraft.leftSignatoryTitle,
      templateDraft.rightSignatoryName,
      templateDraft.rightSignatoryTitle,
    ];
    if (requiredValues.some((value) => value.trim().length < 2)) {
      setError('Complete all certificate-template and signatory fields.');
      return;
    }

    try {
      setBusyKey('template');
      setError('');
      setMessage('');
      const saved = await saveCertificateTemplate({
        templateId: templateDraft.templateId,
        programmeId: templateDraft.programmeId,
        productCode: templateDraft.productCode,
        templateName: templateDraft.templateName,
        certificateTitle: templateDraft.certificateTitle,
        issuerName: templateDraft.issuerName,
        subtitle: templateDraft.subtitle,
        leftSignatoryName: templateDraft.leftSignatoryName,
        leftSignatoryTitle: templateDraft.leftSignatoryTitle,
        rightSignatoryName: templateDraft.rightSignatoryName,
        rightSignatoryTitle: templateDraft.rightSignatoryTitle,
        primaryColour: templateDraft.primaryColour,
        accentColour: templateDraft.accentColour,
      });
      setMessage(`Created ${saved.templateName} version ${saved.version}.`);
      await refresh();
      setTemplateDraft(draftFromTemplate({
        ...saved,
        programmeCode: '',
        programmeName: templateDraft.programmeName,
      }));
    } catch (templateError) {
      setError(templateError instanceof Error ? templateError.message : 'Unable to save certificate template.');
    } finally {
      setBusyKey('');
    }
  };

  const handleReissue = async (certificate: AdminCertificateRecord) => {
    const holderName = window.prompt('Correct certificate-holder name:', certificate.holderName)?.trim();
    if (!holderName) return;
    const certificateTitle = window.prompt(
      'Correct certificate title:',
      certificate.certificateTitle,
    )?.trim();
    if (!certificateTitle) return;
    const reason = window.prompt(
      'State the correction and reissuance reason. The previous certificate will remain in the audit history:',
    )?.trim();
    if (!reason) return;

    try {
      setBusyKey(`reissue:${certificate.id}`);
      setError('');
      setMessage('');
      const result = await correctAndReissueCertificate({
        certificateId: certificate.id,
        holderName,
        certificateTitle,
        reason,
      });
      setMessage(
        `${certificate.certificateNumber} was superseded. New certificate: ${result.certificateNumber}.`,
      );
      await refresh();
    } catch (reissueError) {
      setError(reissueError instanceof Error ? reissueError.message : 'Certificate reissuance failed.');
    } finally {
      setBusyKey('');
    }
  };

  const tabs: Array<[TabKey, string, typeof Settings2]> = [
    ['approvals', 'Approval Workflow', FileClock],
    ['templates', 'Programme Templates', LayoutTemplate],
    ['reissue', 'Correction & Reissue', RotateCcw],
    ['history', 'Audit & History', History],
  ];

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 text-slate-900">
      <section className="rounded-3xl bg-slate-950 p-6 text-white shadow-xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-blue-500/15 p-3 text-blue-400">
              <FileClock className="h-7 w-7" />
            </div>
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-blue-400">
                Original Roadmap Phase 3
              </p>
              <h1 className="mt-1 text-2xl font-black">Certificate Lifecycle Completion</h1>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
                Configure automatic or manual approval, maintain versioned programme templates,
                correct and reissue certificates, and inspect the permanent lifecycle audit trail.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-extrabold text-white transition hover:bg-emerald-700 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Pending approvals', pendingQueue.length, FileClock, 'text-amber-600'],
          ['Active templates', activeTemplates.length, LayoutTemplate, 'text-blue-600'],
          ['Superseded revisions', completion.revisions.length, RotateCcw, 'text-violet-600'],
          ['Audit events', completion.auditEvents.length, ShieldCheck, 'text-emerald-600'],
        ].map(([label, value, Icon, colour]) => (
          <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">{String(label)}</p>
              <Icon className={`h-5 w-5 ${String(colour)}`} />
            </div>
            <p className="mt-3 text-3xl font-black text-slate-950">{Number(value)}</p>
          </div>
        ))}
      </section>

      {message && (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> {message}
        </div>
      )}
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      <nav className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        {tabs.map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-extrabold transition ${
              activeTab === key
                ? 'bg-slate-950 text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </nav>

      {isLoading ? (
        <div className="grid min-h-80 place-items-center rounded-2xl border border-slate-200 bg-white">
          <div className="flex flex-col items-center gap-3 text-slate-500">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            <p className="text-sm font-bold">Loading certificate lifecycle records...</p>
          </div>
        </div>
      ) : activeTab === 'approvals' ? (
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="font-extrabold text-slate-950">Examination approval policies</h2>
              <p className="mt-1 text-xs text-slate-500">
                Automatic mode preserves payment- or waiver-authorised issuance. Manual mode requires an administrator decision first.
              </p>
            </div>
            <div className="grid gap-4 p-5 lg:grid-cols-2">
              {completion.approvalPolicies.map((policy) => (
                <article key={policy.examinationId} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-extrabold uppercase text-slate-400">{policy.programmeCode || 'IIPM'}</p>
                      <h3 className="mt-1 font-extrabold text-slate-900">{policy.examinationTitle}</h3>
                    </div>
                    <span className={`rounded-full border px-2 py-1 text-[10px] font-extrabold uppercase ${badgeClass(policy.approvalMode)}`}>
                      {policy.approvalMode}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => void handlePolicy(policy.examinationId, 'automatic', false)}
                      disabled={busyKey === `policy:${policy.examinationId}`}
                      className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-extrabold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                    >
                      Automatic issuance
                    </button>
                    <button
                      type="button"
                      onClick={() => void handlePolicy(policy.examinationId, 'manual', true)}
                      disabled={busyKey === `policy:${policy.examinationId}`}
                      className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-extrabold text-amber-700 transition hover:bg-amber-100 disabled:opacity-50"
                    >
                      Manual approval
                    </button>
                  </div>
                  <p className="mt-3 text-[11px] text-slate-500">
                    Candidate request required: <strong>{policy.requireCandidateRequest ? 'Yes' : 'No'}</strong>
                  </p>
                </article>
              ))}
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="font-extrabold text-slate-950">Manual approval queue</h2>
              <p className="mt-1 text-xs text-slate-500">Only pending, integrity-cleared certificate requests appear here.</p>
            </div>
            {pendingQueue.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">No certificate requests are awaiting approval.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-left text-sm">
                  <thead className="bg-slate-50 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="px-5 py-3">Candidate</th>
                      <th className="px-5 py-3">Examination</th>
                      <th className="px-5 py-3 text-center">Result</th>
                      <th className="px-5 py-3">Requested</th>
                      <th className="px-5 py-3 text-right">Decision</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pendingQueue.map((item) => (
                      <tr key={item.eligibilityId}>
                        <td className="px-5 py-4">
                          <p className="font-bold text-slate-900">{item.candidateName}</p>
                          <p className="mt-1 text-xs text-slate-500">{item.candidateEmail}</p>
                        </td>
                        <td className="px-5 py-4">
                          <p className="font-bold text-slate-800">{item.examinationTitle}</p>
                          <p className="mt-1 text-[10px] font-bold uppercase text-slate-400">{item.programmeCode || 'IIPM'}</p>
                        </td>
                        <td className="px-5 py-4 text-center font-mono font-black text-emerald-600">
                          {item.score}%
                          <p className="mt-1 text-[10px] font-normal text-slate-400">Pass {item.passMark}%</p>
                        </td>
                        <td className="px-5 py-4 text-xs text-slate-500">{formatDate(item.requestedAt)}</td>
                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => void handleDecision(item.eligibilityId, 'approved')}
                              disabled={busyKey === `decision:${item.eligibilityId}`}
                              className="rounded-lg bg-emerald-600 px-3 py-2 text-[11px] font-extrabold text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDecision(item.eligibilityId, 'changes_requested')}
                              disabled={busyKey === `decision:${item.eligibilityId}`}
                              className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-extrabold text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                            >
                              Request changes
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDecision(item.eligibilityId, 'rejected')}
                              disabled={busyKey === `decision:${item.eligibilityId}`}
                              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-extrabold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      ) : activeTab === 'templates' ? (
        <section className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="font-extrabold text-slate-950">Active programme templates</h2>
            <p className="mt-1 text-xs text-slate-500">Saving creates a new immutable template version.</p>
            <div className="mt-4 space-y-2">
              {activeTemplates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => setTemplateDraft(draftFromTemplate(template))}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    templateDraft?.templateId === template.id
                      ? 'border-blue-300 bg-blue-50'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <p className="text-[10px] font-extrabold uppercase text-slate-400">{template.programmeCode} · {template.productCode}</p>
                  <p className="mt-1 text-sm font-extrabold text-slate-900">{template.templateName}</p>
                  <p className="mt-1 text-xs text-slate-500">Version {template.version}</p>
                </button>
              ))}
            </div>
          </aside>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            {!templateDraft ? (
              <div className="grid min-h-72 place-items-center text-sm text-slate-500">Select a template to create its next version.</div>
            ) : (
              <div className="space-y-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black text-slate-950">{templateDraft.programmeName}</h2>
                    <p className="mt-1 text-xs uppercase text-slate-500">{templateDraft.productCode} certificate template</p>
                  </div>
                  <div className="flex gap-2">
                    <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600">
                      Primary
                      <input
                        type="color"
                        value={templateDraft.primaryColour}
                        onChange={(event) => setTemplateDraft({ ...templateDraft, primaryColour: event.target.value })}
                        className="h-6 w-8 border-0 bg-transparent"
                      />
                    </label>
                    <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600">
                      Accent
                      <input
                        type="color"
                        value={templateDraft.accentColour}
                        onChange={(event) => setTemplateDraft({ ...templateDraft, accentColour: event.target.value })}
                        className="h-6 w-8 border-0 bg-transparent"
                      />
                    </label>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {[
                    ['Template name', 'templateName'],
                    ['Certificate title', 'certificateTitle'],
                    ['Issuer name', 'issuerName'],
                    ['Subtitle', 'subtitle'],
                    ['Left signatory name', 'leftSignatoryName'],
                    ['Left signatory title', 'leftSignatoryTitle'],
                    ['Right signatory name', 'rightSignatoryName'],
                    ['Right signatory title', 'rightSignatoryTitle'],
                  ].map(([label, key]) => (
                    <label key={key} className={key === 'issuerName' || key === 'subtitle' ? 'sm:col-span-2' : ''}>
                      <span className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-wider text-slate-500">{label}</span>
                      <input
                        value={String(templateDraft[key as keyof TemplateDraft])}
                        onChange={(event) => setTemplateDraft({ ...templateDraft, [key]: event.target.value })}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      />
                    </label>
                  ))}
                </div>

                <div className="rounded-2xl border-4 p-6 text-center" style={{ borderColor: templateDraft.primaryColour }}>
                  <p className="text-xs font-extrabold uppercase" style={{ color: templateDraft.accentColour }}>{templateDraft.subtitle}</p>
                  <h3 className="mt-4 text-2xl font-black" style={{ color: templateDraft.primaryColour }}>{templateDraft.certificateTitle}</h3>
                  <p className="mt-3 text-sm text-slate-500">Programme-specific preview · QR verification appears on issued PDFs</p>
                  <div className="mt-8 flex justify-between text-xs font-bold text-slate-600">
                    <span>{templateDraft.leftSignatoryName}</span>
                    <span>{templateDraft.rightSignatoryName}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void handleTemplateSave()}
                  disabled={busyKey === 'template'}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-extrabold text-white transition hover:bg-blue-700 disabled:opacity-60"
                >
                  {busyKey === 'template' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save as new active template version
                </button>
              </div>
            )}
          </div>
        </section>
      ) : activeTab === 'reissue' ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="font-extrabold text-slate-950">Certificate correction and reissuance</h2>
            <p className="mt-1 text-xs text-slate-500">
              Reissuance archives the current certificate as superseded and creates a new number and verification code.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead className="bg-slate-50 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-5 py-3">Holder</th>
                  <th className="px-5 py-3">Certificate</th>
                  <th className="px-5 py-3">Examination</th>
                  <th className="px-5 py-3 text-center">Status</th>
                  <th className="px-5 py-3">Issued</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {authority.certificates.map((certificate) => (
                  <tr key={certificate.id}>
                    <td className="px-5 py-4">
                      <p className="font-bold text-slate-900">{certificate.holderName}</p>
                      <p className="mt-1 text-xs text-slate-500">{certificate.candidateEmail}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-bold text-slate-800">{certificate.certificateTitle}</p>
                      <p className="mt-1 font-mono text-[10px] text-slate-500">{certificate.certificateNumber}</p>
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-600">{certificate.examinationTitle}</td>
                    <td className="px-5 py-4 text-center">
                      <span className={`rounded-full border px-2 py-1 text-[10px] font-extrabold uppercase ${badgeClass(certificate.status)}`}>{certificate.status}</span>
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-500">{formatDate(certificate.issuedAt)}</td>
                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => void handleReissue(certificate)}
                        disabled={certificate.status === 'revoked' || busyKey === `reissue:${certificate.id}`}
                        className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-xs font-extrabold text-white transition hover:bg-violet-700 disabled:bg-slate-300"
                      >
                        {busyKey === `reissue:${certificate.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                        Correct & reissue
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="font-extrabold text-slate-950">Approval decisions</h2>
            </div>
            <div className="max-h-[520px] divide-y divide-slate-100 overflow-y-auto">
              {completion.decisions.length === 0 ? (
                <p className="p-6 text-sm text-slate-500">No manual approval decisions recorded.</p>
              ) : completion.decisions.map((decision) => (
                <article key={decision.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-slate-900">{decision.candidateName}</p>
                      <p className="mt-1 text-xs text-slate-500">{decision.examinationTitle}</p>
                    </div>
                    <span className={`rounded-full border px-2 py-1 text-[10px] font-extrabold uppercase ${badgeClass(decision.decision)}`}>{decision.decision.replace(/_/g, ' ')}</span>
                  </div>
                  {decision.reason && <p className="mt-3 text-xs leading-relaxed text-slate-600">{decision.reason}</p>}
                  <p className="mt-2 text-[10px] text-slate-400">{decision.decidedBy || 'Administrator'} · {formatDate(decision.decidedAt)}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="font-extrabold text-slate-950">Superseded certificate revisions</h2>
            </div>
            <div className="max-h-[520px] divide-y divide-slate-100 overflow-y-auto">
              {completion.revisions.length === 0 ? (
                <p className="p-6 text-sm text-slate-500">No corrected or reissued certificates recorded.</p>
              ) : completion.revisions.map((revision) => (
                <article key={revision.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-slate-900">{revision.holderName}</p>
                      <p className="mt-1 font-mono text-[10px] text-slate-500">{revision.certificateNumber}</p>
                    </div>
                    <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-1 text-[10px] font-extrabold uppercase text-violet-700">Revision {revision.revisionNumber}</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-600">{revision.supersededReason}</p>
                  <p className="mt-2 text-[10px] text-slate-400">Superseded by {revision.supersededBy || 'Administrator'} · {formatDate(revision.supersededAt)}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm xl:col-span-2">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="font-extrabold text-slate-950">Certificate lifecycle audit trail</h2>
              <p className="mt-1 text-xs text-slate-500">Includes issuance, lifecycle, reissue, PDF rendering and public verification activity.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-slate-50 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-5 py-3">Event</th>
                    <th className="px-5 py-3">Actor</th>
                    <th className="px-5 py-3">Details</th>
                    <th className="px-5 py-3">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {completion.auditEvents.map((event) => (
                    <tr key={event.id}>
                      <td className="px-5 py-4">
                        <span className={`rounded-full border px-2 py-1 text-[10px] font-extrabold uppercase ${badgeClass(event.eventType)}`}>{event.eventType.replace(/_/g, ' ')}</span>
                      </td>
                      <td className="px-5 py-4 text-xs font-semibold text-slate-700">{event.actorName || 'Public/System'}</td>
                      <td className="max-w-xl px-5 py-4 font-mono text-[10px] text-slate-500">{JSON.stringify(event.metadata)}</td>
                      <td className="px-5 py-4 text-xs text-slate-500">{formatDate(event.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

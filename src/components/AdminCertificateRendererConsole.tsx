import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileCheck2,
  Loader2,
  RefreshCw,
  ServerCog,
  ShieldAlert,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import {
  getCertificateRendererConsoleSnapshot,
  setCertificateAssignmentRendererEnabled,
  type CertificateRendererAssignment,
  type CertificateRendererConsoleSnapshot,
} from '../services/certificateRendererAdminService';

const emptySnapshot: CertificateRendererConsoleSnapshot = {
  access: { canManageRenderer: false },
  assignments: [],
  recentJobs: [],
};

const formatDateTime = (value?: string | null): string => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

const formatBytes = (value?: number | null): string => {
  if (!value || value <= 0) return '—';
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(2)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${value} bytes`;
};

const assignmentScope = (assignment: CertificateRendererAssignment): string => {
  if (assignment.scopeType === 'examination') {
    return `Examination · ${assignment.examinationCode || assignment.examinationTitle || 'Selected examination'}`;
  }
  if (assignment.scopeType === 'programme') {
    return `Programme · ${assignment.programmeCode || assignment.programmeName || 'Selected programme'}`;
  }
  return 'Global category default';
};

const rendererReadiness = (assignment: CertificateRendererAssignment) => {
  const issues: string[] = [];
  if (!assignment.isActive) issues.push('Assignment is inactive');
  if (assignment.versionStatus !== 'published') issues.push('Version is not published');
  if (!['passed', 'waived'].includes(assignment.qualityStatus)) {
    issues.push('Print-quality review has not passed');
  }
  if (!['pdf', 'png', 'jpeg'].includes(assignment.sourceFormat)) {
    issues.push('Use a PDF, PNG or JPEG master');
  }
  if (!assignment.sourceSha256) issues.push('Master SHA-256 is missing');
  if (assignment.overlayElementCount < 1) issues.push('No visual fields are mapped');
  return issues;
};

export default function AdminCertificateRendererConsole() {
  const [snapshot, setSnapshot] = useState<CertificateRendererConsoleSnapshot>(emptySnapshot);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setSnapshot(await getCertificateRendererConsoleSnapshot());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load renderer controls.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const enabledCount = useMemo(
    () => snapshot.assignments.filter((item) => item.rendererEnabled).length,
    [snapshot.assignments],
  );

  const toggleRenderer = async (assignment: CertificateRendererAssignment) => {
    const reason = reasons[assignment.id]?.trim() || '';
    setSavingId(assignment.id);
    setError('');
    setNotice('');
    try {
      await setCertificateAssignmentRendererEnabled({
        assignmentId: assignment.id,
        enabled: !assignment.rendererEnabled,
        reason,
      });
      setReasons((current) => ({ ...current, [assignment.id]: '' }));
      setNotice(
        assignment.rendererEnabled
          ? 'Server rendering was suspended for the assignment.'
          : 'Server rendering was enabled after the server-side readiness checks passed.',
      );
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to update renderer status.');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <main className="mx-auto max-w-[1720px] space-y-6 px-4 py-6 md:px-6">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-950 px-5 py-5 text-white md:px-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
                Phase 1C protected control
              </p>
              <h2 className="mt-2 flex items-center gap-3 text-2xl font-black">
                <ServerCog className="h-6 w-6 text-cyan-300" />
                Server PDF Rendering
              </h2>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">
                Explicitly enable only published, print-reviewed and digest-verified master assignments.
                Certificates without an enabled assignment continue through the existing legacy PDF renderer.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs font-black text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        <div className="grid gap-4 p-5 md:grid-cols-3 md:p-7">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Assignments</p>
            <p className="mt-2 text-3xl font-black text-slate-950">{snapshot.assignments.length}</p>
            <p className="mt-1 text-xs text-slate-500">Published assignment records available for review</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Renderer enabled</p>
            <p className="mt-2 text-3xl font-black text-emerald-950">{enabledCount}</p>
            <p className="mt-1 text-xs text-emerald-700">Assignments allowed to produce managed PDFs</p>
          </div>
          <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
            <p className="text-[10px] font-black uppercase tracking-wider text-cyan-700">Recent render requests</p>
            <p className="mt-2 text-3xl font-black text-cyan-950">{snapshot.recentJobs.length}</p>
            <p className="mt-1 text-xs text-cyan-700">Metadata evidence only; generated PDFs are not retained</p>
          </div>
        </div>
      </section>

      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-900">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {!snapshot.access.canManageRenderer && !loading && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-black">Read-only renderer access</p>
            <p className="mt-1">
              Renderer activation is restricted to Super Administrators or an explicitly delegated
              <code className="mx-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs">
                certificate.render.manage
              </code>
              permission.
            </p>
          </div>
        </div>
      )}

      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-black text-slate-950">Master assignment activation</h3>
          <p className="mt-1 text-sm text-slate-500">
            Enabling is separate from template approval, publication and assignment. The server repeats
            every readiness check before recording activation.
          </p>
        </div>

        {loading ? (
          <div className="flex min-h-48 items-center justify-center rounded-3xl border border-slate-200 bg-white">
            <Loader2 className="h-7 w-7 animate-spin text-slate-500" />
          </div>
        ) : snapshot.assignments.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <FileCheck2 className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 font-black text-slate-700">No master assignment has been created.</p>
            <p className="mt-1 text-sm text-slate-500">
              Publish and assign an approved master before server rendering can be considered.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {snapshot.assignments.map((assignment) => {
              const issues = rendererReadiness(assignment);
              const busy = savingId === assignment.id;
              return (
                <article
                  key={assignment.id}
                  className={`rounded-3xl border bg-white p-5 shadow-sm ${
                    assignment.rendererEnabled ? 'border-emerald-300' : 'border-slate-200'
                  }`}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-950 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white">
                          {assignment.institutionCode}
                        </span>
                        <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-violet-800">
                          {assignment.categoryName}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${
                            assignment.rendererEnabled
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {assignment.rendererEnabled ? 'Server renderer enabled' : 'Legacy renderer retained'}
                        </span>
                      </div>
                      <h4 className="mt-3 text-base font-black text-slate-950">
                        {assignment.templateName} · v{assignment.versionNumber}
                      </h4>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {assignmentScope(assignment)}
                      </p>
                    </div>
                    {assignment.rendererEnabled ? (
                      <ToggleRight className="h-9 w-9 shrink-0 text-emerald-600" />
                    ) : (
                      <ToggleLeft className="h-9 w-9 shrink-0 text-slate-400" />
                    )}
                  </div>

                  <dl className="mt-5 grid grid-cols-2 gap-3 text-xs">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <dt className="font-bold text-slate-500">Master format</dt>
                      <dd className="mt-1 font-black uppercase text-slate-900">{assignment.sourceFormat}</dd>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <dt className="font-bold text-slate-500">Quality status</dt>
                      <dd className="mt-1 font-black uppercase text-slate-900">{assignment.qualityStatus}</dd>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <dt className="font-bold text-slate-500">Mapped elements</dt>
                      <dd className="mt-1 font-black text-slate-900">{assignment.overlayElementCount}</dd>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <dt className="font-bold text-slate-500">Bound certificates</dt>
                      <dd className="mt-1 font-black text-slate-900">{assignment.bindingCount}</dd>
                    </div>
                  </dl>

                  {issues.length > 0 && !assignment.rendererEnabled && (
                    <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3">
                      <p className="text-xs font-black text-amber-900">Readiness items</p>
                      <p className="mt-1 text-xs leading-5 text-amber-800">{issues.join(' · ')}</p>
                    </div>
                  )}

                  <div className="mt-4">
                    <label className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                      Required reason
                    </label>
                    <textarea
                      value={reasons[assignment.id] || ''}
                      onChange={(event) =>
                        setReasons((current) => ({
                          ...current,
                          [assignment.id]: event.target.value,
                        }))
                      }
                      rows={2}
                      placeholder={
                        assignment.rendererEnabled
                          ? 'Explain why managed rendering is being suspended.'
                          : 'Record the print-review and activation decision.'
                      }
                      className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-600"
                      disabled={!snapshot.access.canManageRenderer || busy}
                    />
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-[11px] text-slate-500">
                      Last enabled: {formatDateTime(assignment.rendererEnabledAt)}
                    </p>
                    <button
                      type="button"
                      onClick={() => void toggleRenderer(assignment)}
                      disabled={
                        !snapshot.access.canManageRenderer ||
                        busy ||
                        (!assignment.rendererEnabled && issues.length > 0)
                      }
                      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
                        assignment.rendererEnabled
                          ? 'bg-rose-700 hover:bg-rose-800'
                          : 'bg-emerald-700 hover:bg-emerald-800'
                      }`}
                    >
                      {busy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : assignment.rendererEnabled ? (
                        <ToggleLeft className="h-4 w-4" />
                      ) : (
                        <ToggleRight className="h-4 w-4" />
                      )}
                      {assignment.rendererEnabled ? 'Suspend managed rendering' : 'Enable managed rendering'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="font-black text-slate-950">Recent rendering evidence</h3>
          <p className="mt-1 text-xs text-slate-500">
            The PDF bytes are returned to the authorised user and are not retained by this console.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Certificate</th>
                <th className="px-4 py-3">Mode</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Output</th>
                <th className="px-4 py-3">Requested</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {snapshot.recentJobs.map((job) => (
                <tr key={job.id}>
                  <td className="px-4 py-3">
                    <p className="font-black text-slate-900">{job.certificateNumber}</p>
                    <p className="mt-0.5 max-w-[240px] truncate text-slate-500">{job.holderName}</p>
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-700">{job.renderMode}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-slate-100 px-2 py-1 font-black uppercase text-slate-700">
                      {job.status}
                    </span>
                    {job.failureCode && <p className="mt-1 text-rose-700">{job.failureCode}</p>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {job.outputPageCount ? `${job.outputPageCount} page · ` : ''}
                    {formatBytes(job.outputSizeBytes)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatDateTime(job.requestedAt)}</td>
                </tr>
              ))}
              {!loading && snapshot.recentJobs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    No managed render request has been recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

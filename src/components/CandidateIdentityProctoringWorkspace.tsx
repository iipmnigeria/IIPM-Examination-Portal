import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  Camera,
  ChevronDown,
  FileKey2,
  Fingerprint,
  Gavel,
  Loader2,
  RefreshCw,
  Scale,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react';
import {
  emptyIdentityProctoringWorkspace,
  getMyIdentityProctoringWorkspace,
  prepareExamIdentityCheck,
  recordIdentityProctoringConsent,
  submitIncidentExplanation,
  submitMisconductAppeal,
  submitSensitiveIdentity,
  type CandidateIntegrityWorkspace,
  type IdentityProctoringPolicy,
} from '../services/identityProctoringService';

const statusClass = (status: string) => {
  if (['approved', 'active', 'closed', 'no_violation', 'upheld'].includes(status)) return 'bg-emerald-100 text-emerald-800';
  if (['rejected', 'expired', 'deleted', 'critical', 'invalidate_attempt', 'suspend_candidate'].includes(status)) return 'bg-rose-100 text-rose-800';
  if (['changes_requested', 'warning', 'flagged', 'high', 'appealed'].includes(status)) return 'bg-amber-100 text-amber-800';
  return 'bg-slate-100 text-slate-700';
};

const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleString() : '—');

export default function CandidateIdentityProctoringWorkspace() {
  const [open, setOpen] = useState(false);
  const [workspace, setWorkspace] = useState<CandidateIntegrityWorkspace>(emptyIdentityProctoringWorkspace);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [selectedExamId, setSelectedExamId] = useState('');
  const [documentType, setDocumentType] = useState('national_identity');
  const [documentNumber, setDocumentNumber] = useState('');
  const [issuerCountry, setIssuerCountry] = useState('NG');
  const [issuedOn, setIssuedOn] = useState('');
  const [expiresOn, setExpiresOn] = useState('');
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [examSelfieFile, setExamSelfieFile] = useState<File | null>(null);
  const [explanationByIncident, setExplanationByIncident] = useState<Record<string, string>>({});
  const [appealByCase, setAppealByCase] = useState<Record<string, string>>({});

  const isCandidate = typeof window !== 'undefined' && localStorage.getItem('aura_logged_role') === 'student';

  const load = useCallback(async () => {
    if (!isCandidate) return;
    setLoading(true);
    setError('');
    try {
      const next = await getMyIdentityProctoringWorkspace();
      setWorkspace(next);
      setSelectedExamId((current) => current || next.policies[0]?.examinationId || '');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load identity and proctoring records.');
    } finally {
      setLoading(false);
    }
  }, [isCandidate]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const policy = useMemo(
    () => workspace.policies.find((item) => item.examinationId === selectedExamId) || null,
    [workspace.policies, selectedExamId],
  );

  const run = async (operation: () => Promise<void>, success: string) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await operation();
      setMessage(success);
      await load();
    } catch (operationError) {
      setError(operationError instanceof Error ? operationError.message : 'The requested action could not be completed.');
    } finally {
      setBusy(false);
    }
  };

  if (!isCandidate) return null;

  const acceptConsent = async (activePolicy: IdentityProctoringPolicy) => {
    await run(
      async () => {
        await recordIdentityProctoringConsent({
          examinationId: activePolicy.examinationId,
          identityProcessingAccepted: true,
          proctoringProcessingAccepted: true,
          cameraPermissionAccepted: activePolicy.requireCamera,
          microphonePermissionAccepted: activePolicy.requireMicrophone,
          fullscreenMonitoringAccepted: activePolicy.requireFullscreen,
          automatedProcessingAccepted: false,
        });
      },
      'The current identity and proctoring consent has been recorded.',
    );
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-24 left-4 z-40 flex items-center gap-2 rounded-full bg-slate-950 px-4 py-3 text-xs font-black text-white shadow-xl transition hover:bg-emerald-700"
        aria-label="Open identity and exam integrity workspace"
      >
        <Fingerprint className="h-4 w-4 text-emerald-400" />
        <span className="hidden sm:inline">Identity & Integrity</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] overflow-y-auto bg-slate-950/70 p-3 backdrop-blur-sm md:p-8">
          <div className="mx-auto max-w-6xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <header className="flex items-start justify-between gap-4 bg-slate-950 px-5 py-5 text-white md:px-8">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">Candidate privacy and examination integrity</p>
                <h2 className="mt-1 text-xl font-black">Identity & Exam Integrity Workspace</h2>
                <p className="mt-1 max-w-3xl text-sm text-slate-300">
                  Manage required consent, private identity evidence, examination-day checks, incident explanations and appeals.
                </p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-xl p-2 hover:bg-slate-800" aria-label="Close workspace">
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="space-y-6 p-5 md:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="min-w-72 flex-1 text-xs font-black uppercase tracking-wide text-slate-500">
                  Examination policy
                  <div className="relative mt-2">
                    <select
                      value={selectedExamId}
                      onChange={(event) => setSelectedExamId(event.target.value)}
                      className="w-full appearance-none rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-800"
                    >
                      {workspace.policies.map((item) => (
                        <option key={item.examinationId} value={item.examinationId}>{item.examinationTitle} · {item.programmeCode}</option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-slate-400" />
                  </div>
                </label>
                <button type="button" onClick={() => void load()} className="mt-5 flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-3 text-xs font-black text-slate-700 hover:bg-slate-50">
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
                </button>
              </div>

              {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div>}
              {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{message}</div>}
              {loading && <div className="flex items-center justify-center gap-3 py-12 text-sm font-bold text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /> Loading protected records…</div>}

              {!loading && !policy && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-600">No assigned or self-enrolled examination policy is currently available.</div>
              )}

              {!loading && policy && (
                <>
                  <section className="rounded-2xl border border-slate-200 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="max-w-3xl">
                        <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-600" /><h3 className="font-black">Current consent and privacy notice</h3></div>
                        <p className="mt-3 text-sm leading-6 text-slate-600">{policy.privacyNotice}</p>
                        <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-black">
                          {policy.requireGovernmentId && <span className="rounded-full bg-blue-100 px-3 py-1 text-blue-800">Government ID</span>}
                          {policy.requireSelfie && <span className="rounded-full bg-violet-100 px-3 py-1 text-violet-800">Selfie</span>}
                          {policy.requireExamDayIdentityCheck && <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-800">Pre-exam review</span>}
                          {policy.requireCamera && <span className="rounded-full bg-cyan-100 px-3 py-1 text-cyan-800">Camera</span>}
                          {policy.requireMicrophone && <span className="rounded-full bg-cyan-100 px-3 py-1 text-cyan-800">Microphone permission</span>}
                          {policy.requireFullscreen && <span className="rounded-full bg-slate-200 px-3 py-1 text-slate-800">Fullscreen</span>}
                          {policy.liveEventCaptureEnabled && <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-800">Live event audit</span>}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`rounded-full px-3 py-1 text-xs font-black ${policy.consented ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                          {policy.consented ? 'Consent current' : 'Consent required'}
                        </span>
                        {!policy.consented && (
                          <button type="button" disabled={busy} onClick={() => void acceptConsent(policy)} className="mt-3 block rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white disabled:opacity-50">
                            Accept current policy
                          </button>
                        )}
                      </div>
                    </div>
                    {(policy.externalKycEnabled || policy.automatedFaceMatchEnabled || policy.livenessEnabled) && (
                      <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">
                        Automated identity processing is not activated in this release.
                      </div>
                    )}
                  </section>

                  {(policy.requireGovernmentId || policy.requireSelfie) && (
                    <section className="grid gap-5 rounded-2xl border border-slate-200 p-5 lg:grid-cols-2">
                      <div>
                        <div className="flex items-center gap-2"><FileKey2 className="h-5 w-5 text-blue-600" /><h3 className="font-black">Private government identity evidence</h3></div>
                        <p className="mt-2 text-xs leading-5 text-slate-500">The raw document number is never stored. Only a one-way digest and the last four characters are retained.</p>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <select value={documentType} onChange={(event) => setDocumentType(event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
                            <option value="national_identity">National identity</option><option value="passport">Passport</option><option value="driving_licence">Driving licence</option><option value="voter_identity">Voter identity</option><option value="residence_permit">Residence permit</option><option value="other_government_identity">Other government ID</option>
                          </select>
                          <input value={issuerCountry} onChange={(event) => setIssuerCountry(event.target.value.toUpperCase().slice(0, 2))} placeholder="Issuer country, e.g. NG" className="rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                          <input value={documentNumber} onChange={(event) => setDocumentNumber(event.target.value)} placeholder="Document number" className="rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                          <input type="date" value={issuedOn} onChange={(event) => setIssuedOn(event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                          <input type="date" value={expiresOn} onChange={(event) => setExpiresOn(event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                          <label className="rounded-xl border border-dashed border-slate-300 px-3 py-2 text-xs font-bold text-slate-600">
                            <Upload className="mr-2 inline h-4 w-4" /> Government ID PDF/JPG/PNG
                            <input type="file" accept="application/pdf,image/jpeg,image/png" className="hidden" onChange={(event) => setDocumentFile(event.target.files?.[0] || null)} />
                            {documentFile && <span className="mt-1 block truncate text-emerald-700">{documentFile.name}</span>}
                          </label>
                          <label className="rounded-xl border border-dashed border-slate-300 px-3 py-2 text-xs font-bold text-slate-600">
                            <Camera className="mr-2 inline h-4 w-4" /> Candidate selfie
                            <input type="file" accept="image/jpeg,image/png" className="hidden" onChange={(event) => setSelfieFile(event.target.files?.[0] || null)} />
                            {selfieFile && <span className="mt-1 block truncate text-emerald-700">{selfieFile.name}</span>}
                          </label>
                        </div>
                        <button
                          type="button"
                          disabled={busy || !policy.consented || !documentFile || !documentNumber.trim() || (policy.requireSelfie && !selfieFile)}
                          onClick={() => void run(async () => {
                            if (!documentFile) return;
                            await submitSensitiveIdentity({ examinationId: policy.examinationId, documentType, documentNumber, issuerCountry, issuedOn: issuedOn || null, expiresOn: expiresOn || null, documentFile, selfieFile });
                            setDocumentNumber(''); setDocumentFile(null); setSelfieFile(null);
                          }, 'Private identity evidence submitted for review.')}
                          className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-xs font-black text-white disabled:opacity-40"
                        >Submit for secure review</button>
                      </div>

                      <div>
                        <h4 className="text-xs font-black uppercase tracking-wide text-slate-500">Submission history</h4>
                        <div className="mt-3 space-y-3">
                          {workspace.identityDocuments.length === 0 && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No government identity evidence submitted.</p>}
                          {workspace.identityDocuments.map((item) => (
                            <div key={item.id} className="rounded-xl border border-slate-200 p-4 text-sm">
                              <div className="flex items-center justify-between gap-2"><span className="font-black">{item.documentType.replaceAll('_', ' ')}</span><span className={`rounded-full px-2 py-1 text-[10px] font-black ${statusClass(item.status)}`}>{item.status.replaceAll('_', ' ')}</span></div>
                              <p className="mt-2 text-xs text-slate-500">•••• {item.documentNumberLast4} · {item.issuerCountry} · expires {item.expiresOn || 'not stated'}</p>
                              {item.reviewNote && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">{item.reviewNote}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    </section>
                  )}

                  {policy.requireExamDayIdentityCheck && (
                    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                      <div className="flex items-center gap-2"><Camera className="h-5 w-5 text-amber-700" /><h3 className="font-black text-amber-950">Pre-examination identity check</h3></div>
                      <p className="mt-2 text-sm text-amber-900">Submit a current selfie before starting this examination. Questions remain server-restricted until an administrator approves this check.</p>
                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        <label className="rounded-xl border border-dashed border-amber-400 bg-white px-4 py-2 text-xs font-bold text-amber-900">
                          Select current selfie
                          <input type="file" accept="image/jpeg,image/png" className="hidden" onChange={(event) => setExamSelfieFile(event.target.files?.[0] || null)} />
                        </label>
                        {examSelfieFile && <span className="text-xs font-bold text-amber-900">{examSelfieFile.name}</span>}
                        <button type="button" disabled={busy || !policy.consented || !examSelfieFile} onClick={() => void run(async () => {
                          await prepareExamIdentityCheck({ examinationId: policy.examinationId, selfieFile: examSelfieFile }); setExamSelfieFile(null);
                        }, 'The pre-examination identity check has been submitted.')}
                        className="rounded-xl bg-amber-700 px-4 py-2 text-xs font-black text-white disabled:opacity-40">Submit identity check</button>
                      </div>
                      <div className="mt-4 space-y-2">
                        {workspace.identityChecks.filter((item) => item.examinationId === policy.examinationId).map((item) => (
                          <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white p-3 text-xs">
                            <span className="font-bold">Submitted {formatDate(item.candidateAttestedAt)}</span>
                            <span className={`rounded-full px-2 py-1 font-black ${statusClass(item.status)}`}>{item.status.replaceAll('_', ' ')}</span>
                            {item.reviewNote && <span className="w-full text-amber-800">{item.reviewNote}</span>}
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  <section className="grid gap-5 lg:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 p-5">
                      <div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-600" /><h3 className="font-black">Integrity incidents</h3></div>
                      <div className="mt-4 space-y-3">
                        {workspace.incidents.length === 0 && <p className="text-sm text-slate-500">No integrity incident has been recorded.</p>}
                        {workspace.incidents.map((incident) => (
                          <div key={incident.id} className="rounded-xl border border-slate-200 p-4">
                            <div className="flex items-start justify-between gap-2"><div><p className="font-black">{incident.title}</p><p className="mt-1 text-xs text-slate-500">{incident.examinationTitle}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-black ${statusClass(incident.severity)}`}>{incident.severity}</span></div>
                            <p className="mt-3 text-xs leading-5 text-slate-600">{incident.summary}</p>
                            {!incident.candidateExplanation && ['open', 'awaiting_candidate', 'under_investigation'].includes(incident.status) && (
                              <div className="mt-3"><textarea value={explanationByIncident[incident.id] || ''} onChange={(event) => setExplanationByIncident((current) => ({ ...current, [incident.id]: event.target.value }))} placeholder="Explain what happened during the session…" className="min-h-24 w-full rounded-xl border border-slate-300 p-3 text-sm" /><button type="button" disabled={busy || (explanationByIncident[incident.id] || '').trim().length < 20} onClick={() => void run(() => submitIncidentExplanation(incident.id, explanationByIncident[incident.id] || ''), 'Your explanation has been submitted.')} className="mt-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-black text-white disabled:opacity-40">Submit explanation</button></div>
                            )}
                            {incident.candidateExplanation && <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-700"><strong>Your explanation:</strong> {incident.candidateExplanation}</p>}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 p-5">
                      <div className="flex items-center gap-2"><Scale className="h-5 w-5 text-violet-600" /><h3 className="font-black">Misconduct decisions and appeals</h3></div>
                      <div className="mt-4 space-y-3">
                        {workspace.misconductCases.length === 0 && <p className="text-sm text-slate-500">No misconduct case has been opened.</p>}
                        {workspace.misconductCases.map((item) => {
                          const appeal = workspace.appeals.find((entry) => entry.misconductCaseId === item.id);
                          return <div key={item.id} className="rounded-xl border border-slate-200 p-4 text-sm">
                            <div className="flex items-center justify-between gap-2"><span className="font-black">Case {item.id.slice(0, 8).toUpperCase()}</span><span className={`rounded-full px-2 py-1 text-[10px] font-black ${statusClass(item.status)}`}>{item.status}</span></div>
                            {item.decision && <p className="mt-2 text-xs"><strong>Decision:</strong> {item.decision.replaceAll('_', ' ')}</p>}
                            {item.decisionReason && <p className="mt-2 text-xs leading-5 text-slate-600">{item.decisionReason}</p>}
                            {appeal ? <p className={`mt-3 rounded-lg px-3 py-2 text-xs font-bold ${statusClass(appeal.status)}`}>Appeal: {appeal.status.replaceAll('_', ' ')}</p> : item.decision && (
                              <div className="mt-3"><textarea value={appealByCase[item.id] || ''} onChange={(event) => setAppealByCase((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="State your appeal grounds…" className="min-h-24 w-full rounded-xl border border-slate-300 p-3 text-sm" /><button type="button" disabled={busy || (appealByCase[item.id] || '').trim().length < 20} onClick={() => void run(() => submitMisconductAppeal({ misconductCaseId: item.id, grounds: appealByCase[item.id] || '' }), 'Your appeal has been submitted.')} className="mt-2 flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2 text-xs font-black text-white disabled:opacity-40"><Gavel className="h-4 w-4" /> Submit appeal</button></div>
                            )}
                          </div>;
                        })}
                      </div>
                    </div>
                  </section>

                  <section className="rounded-2xl border border-slate-200 p-5">
                    <div className="flex items-center gap-2"><BadgeCheck className="h-5 w-5 text-emerald-600" /><h3 className="font-black">Proctored session history</h3></div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {workspace.proctoringSessions.length === 0 && <p className="text-sm text-slate-500">No live proctoring session recorded.</p>}
                      {workspace.proctoringSessions.map((session) => (
                        <div key={session.id} className="rounded-xl bg-slate-50 p-4 text-xs">
                          <div className="flex items-center justify-between"><span className="font-black">{session.examinationTitle}</span><span className={`rounded-full px-2 py-1 font-black ${statusClass(session.riskLevel)}`}>{session.riskLevel}</span></div>
                          <p className="mt-2 text-slate-500">Risk {session.riskScore}% · {session.eventCount} audited events</p>
                          <p className="mt-1 text-slate-500">{formatDate(session.startedAt)}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

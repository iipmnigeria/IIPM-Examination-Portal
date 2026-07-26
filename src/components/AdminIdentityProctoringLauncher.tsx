import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertOctagon,
  BadgeCheck,
  Camera,
  Eye,
  FileWarning,
  Fingerprint,
  Gavel,
  Loader2,
  RefreshCw,
  Save,
  Scale,
  ShieldAlert,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import {
  createSensitiveIdentitySignedUrl,
  decideMisconductAppeal,
  decideMisconductCase,
  getIdentityProctoringAdminConsole,
  reviewExamIdentityCheck,
  reviewSensitiveIdentity,
  updateIdentityProctoringPolicy,
  type AdminIntegrityConsole,
  type AdminIntegrityPolicy,
} from '../services/identityProctoringService';

const emptyCounts = {
  identityPending: 0,
  identityChecksPending: 0,
  highRiskSessions: 0,
  openIncidents: 0,
  resultHolds: 0,
  appealsPending: 0,
};

const emptyConsole: AdminIntegrityConsole = {
  policies: [], identityDocuments: [], identityChecks: [], proctoringSessions: [], incidents: [], misconductCases: [], appeals: [], auditEvents: [], counts: emptyCounts,
};

const statusClass = (value: string) => {
  if (['approved', 'active', 'closed', 'no_violation', 'upheld'].includes(value)) return 'bg-emerald-100 text-emerald-800';
  if (['rejected', 'expired', 'critical', 'invalidate_attempt', 'suspend_candidate'].includes(value)) return 'bg-rose-100 text-rose-800';
  if (['changes_requested', 'high', 'warning', 'flag_attempt', 'appealed'].includes(value)) return 'bg-amber-100 text-amber-800';
  return 'bg-slate-100 text-slate-700';
};

const askReason = (label: string, minimum = 5) => {
  const value = window.prompt(label)?.trim() || '';
  if (value.length < minimum) throw new Error(`Provide at least ${minimum} characters.`);
  return value;
};

export default function AdminIdentityProctoringLauncher() {
  const role = typeof window !== 'undefined' ? localStorage.getItem('aura_logged_role') : null;
  const isAdmin = role === 'admin' || role === 'super_admin';
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'policy' | 'identity' | 'sessions' | 'cases' | 'appeals'>('overview');
  const [data, setData] = useState<AdminIntegrityConsole>(emptyConsole);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [selectedPolicyId, setSelectedPolicyId] = useState('');
  const [policyDraft, setPolicyDraft] = useState<AdminIntegrityPolicy | null>(null);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError('');
    try {
      const next = await getIdentityProctoringAdminConsole();
      setData(next);
      setSelectedPolicyId((current) => current || next.policies[0]?.examinationId || '');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load identity and proctoring administration.');
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => { if (open) void load(); }, [open, load]);

  const selectedPolicy = useMemo(
    () => data.policies.find((item) => item.examinationId === selectedPolicyId) || null,
    [data.policies, selectedPolicyId],
  );

  useEffect(() => {
    if (selectedPolicy) setPolicyDraft({ ...selectedPolicy });
  }, [selectedPolicy]);

  const run = async (operation: () => Promise<void>, success: string) => {
    setBusy(true); setError(''); setMessage('');
    try { await operation(); setMessage(success); await load(); }
    catch (operationError) { setError(operationError instanceof Error ? operationError.message : 'The administrator action failed.'); }
    finally { setBusy(false); }
  };

  if (!isAdmin) return null;

  const openEvidence = async (path?: string | null) => {
    if (!path) return;
    try {
      const url = await createSensitiveIdentitySignedUrl(path);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : 'Unable to open private evidence.');
    }
  };

  const reviewDocument = async (id: string, decision: 'under_review' | 'changes_requested' | 'approved' | 'rejected' | 'expired') => {
    const note = decision === 'approved' ? (window.prompt('Approval note (optional):') || '') : askReason(`Reason for ${decision.replaceAll('_', ' ')}:`);
    await run(() => reviewSensitiveIdentity({ documentId: id, decision, note }), `Sensitive identity record marked ${decision.replaceAll('_', ' ')}.`);
  };

  const reviewCheck = async (id: string, decision: 'under_review' | 'approved' | 'changes_requested' | 'rejected' | 'expired') => {
    const documentMatch = (window.prompt('Document comparison: match, mismatch or inconclusive', decision === 'approved' ? 'match' : 'inconclusive') || 'inconclusive') as 'match' | 'mismatch' | 'inconclusive';
    const faceMatch = (window.prompt('Face comparison: match, mismatch, inconclusive or not_required', decision === 'approved' ? 'match' : 'inconclusive') || 'inconclusive') as 'match' | 'mismatch' | 'inconclusive' | 'not_required';
    const note = decision === 'approved' ? (window.prompt('Review note (optional):') || '') : askReason(`Reason for ${decision.replaceAll('_', ' ')}:`);
    await run(() => reviewExamIdentityCheck({ checkId: id, decision, documentMatch, faceMatch, note }), `Pre-examination identity check marked ${decision.replaceAll('_', ' ')}.`);
  };

  const decideCase = async (id: string, decision: 'no_violation' | 'warning' | 'flag_attempt' | 'invalidate_attempt' | 'suspend_candidate') => {
    const reason = askReason(`Reason for ${decision.replaceAll('_', ' ')}:`, 10);
    const suspensionUntil = decision === 'suspend_candidate' ? window.prompt('Suspension end date/time in ISO format, or leave blank for indefinite:') : null;
    await run(() => decideMisconductCase({ caseId: id, decision, reason, suspensionUntil: suspensionUntil || null }), `Misconduct decision recorded: ${decision.replaceAll('_', ' ')}.`);
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="fixed bottom-40 right-4 z-40 flex items-center gap-2 rounded-full bg-rose-700 px-4 py-3 text-xs font-black text-white shadow-xl hover:bg-rose-800" aria-label="Open identity and proctoring administration">
        <ShieldAlert className="h-4 w-4" /><span className="hidden sm:inline">Integrity Admin</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[90] overflow-y-auto bg-slate-950/75 p-3 backdrop-blur-sm md:p-7">
          <div className="mx-auto max-w-7xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <header className="flex items-start justify-between gap-4 bg-slate-950 px-5 py-5 text-white md:px-8">
              <div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-400">Restricted administrator authority</p><h2 className="mt-1 text-xl font-black">Identity, Proctoring & Misconduct Administration</h2><p className="mt-1 text-sm text-slate-300">Sensitive evidence, live risk, incidents, result holds and appeals.</p></div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-xl p-2 hover:bg-slate-800"><X className="h-5 w-5" /></button>
            </header>

            <nav className="flex gap-2 overflow-x-auto border-b border-slate-200 bg-slate-50 px-4 py-3">
              {([
                ['overview', 'Overview'], ['policy', 'Policies'], ['identity', 'Identity review'], ['sessions', 'Risk sessions'], ['cases', 'Misconduct'], ['appeals', 'Appeals'],
              ] as const).map(([key, label]) => <button key={key} type="button" onClick={() => setActiveTab(key)} className={`whitespace-nowrap rounded-xl px-4 py-2 text-xs font-black ${activeTab === key ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-white'}`}>{label}</button>)}
              <button type="button" onClick={() => void load()} className="ml-auto rounded-xl border border-slate-300 bg-white p-2"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
            </nav>

            <div className="space-y-5 p-5 md:p-8">
              {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</div>}
              {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{message}</div>}
              {loading && <div className="flex items-center justify-center gap-3 py-16 text-sm font-bold text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /> Loading restricted administration…</div>}

              {!loading && activeTab === 'overview' && (
                <>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                    {[
                      ['Identity pending', data.counts.identityPending, Fingerprint, 'text-blue-600'],
                      ['Pre-exam checks', data.counts.identityChecksPending, Camera, 'text-violet-600'],
                      ['High-risk sessions', data.counts.highRiskSessions, ShieldAlert, 'text-rose-600'],
                      ['Open incidents', data.counts.openIncidents, AlertOctagon, 'text-amber-600'],
                      ['Result holds', data.counts.resultHolds, Gavel, 'text-slate-700'],
                      ['Pending appeals', data.counts.appealsPending, Scale, 'text-emerald-600'],
                    ].map(([label, value, Icon, colour]) => <div key={String(label)} className="rounded-2xl border border-slate-200 p-4"><Icon className={`h-5 w-5 ${colour}`} /><p className="mt-3 text-2xl font-black">{String(value)}</p><p className="text-xs font-bold text-slate-500">{String(label)}</p></div>)}
                  </div>
                  <div className="grid gap-5 lg:grid-cols-2">
                    <section className="rounded-2xl border border-slate-200 p-5"><h3 className="font-black">Highest-risk sessions</h3><div className="mt-3 space-y-2">{data.proctoringSessions.slice().sort((a,b)=>b.riskScore-a.riskScore).slice(0,8).map((item)=><div key={item.id} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-xs"><div><p className="font-black">{item.candidateName}</p><p className="text-slate-500">{item.examinationTitle} · {item.eventCount} events</p></div><span className={`rounded-full px-2 py-1 font-black ${statusClass(item.riskLevel)}`}>{item.riskScore}% {item.riskLevel}</span></div>)}</div></section>
                    <section className="rounded-2xl border border-slate-200 p-5"><h3 className="font-black">Open incidents</h3><div className="mt-3 space-y-2">{data.incidents.filter((item)=>!['closed','dismissed'].includes(item.status)).slice(0,8).map((item)=><div key={item.id} className="rounded-xl bg-slate-50 p-3 text-xs"><div className="flex justify-between gap-2"><p className="font-black">{item.candidateName}</p><span className={`rounded-full px-2 py-1 font-black ${statusClass(item.severity)}`}>{item.severity}</span></div><p className="mt-1 text-slate-500">{item.title} · {item.examinationTitle}</p></div>)}</div></section>
                  </div>
                </>
              )}

              {!loading && activeTab === 'policy' && policyDraft && (
                <section className="rounded-2xl border border-slate-200 p-5">
                  <div className="flex flex-wrap items-end gap-3"><label className="min-w-72 flex-1 text-xs font-black uppercase text-slate-500">Examination<select value={selectedPolicyId} onChange={(event)=>setSelectedPolicyId(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm normal-case text-slate-900">{data.policies.map((item)=><option key={item.examinationId} value={item.examinationId}>{item.examinationTitle} · {item.programmeCode}</option>)}</select></label><span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-black">Policy v{policyDraft.policyVersion}</span></div>
                  <div className="mt-5 grid gap-4 lg:grid-cols-2">
                    <label className="text-xs font-bold text-slate-600">Consent version<input value={policyDraft.consentVersion} onChange={(event)=>setPolicyDraft({...policyDraft,consentVersion:event.target.value})} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" /></label>
                    <label className="text-xs font-bold text-slate-600">Privacy notice<textarea value={policyDraft.privacyNotice} onChange={(event)=>setPolicyDraft({...policyDraft,privacyNotice:event.target.value})} className="mt-1 min-h-24 w-full rounded-xl border border-slate-300 p-3 text-sm" /></label>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{([
                      ['requireExistingIdentityApproval','Existing IIPM identity'],['requireGovernmentId','Government ID'],['requireSelfie','Selfie'],['requireExamDayIdentityCheck','Pre-exam review'],['requireCamera','Camera'],['requireMicrophone','Microphone permission'],['requireFullscreen','Fullscreen'],['liveEventCaptureEnabled','Live event audit'],['aiVisualAnalysisEnabled','AI visual event input'],['retainWebcamImages','Retain webcam images'],['active','Policy active'],
                    ] as const).map(([field,label])=><label key={field} className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-xs font-bold"><input type="checkbox" checked={Boolean(policyDraft[field])} onChange={(event)=>setPolicyDraft({...policyDraft,[field]:event.target.checked})} />{label}</label>)}</div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{([
                      ['incidentThreshold','Incident threshold'],['criticalThreshold','Critical threshold'],['identityRetentionDays','Identity retention days'],['proctorEventRetentionDays','Event retention days'],['incidentRetentionDays','Incident retention days'],['appealWindowDays','Appeal window days'],
                    ] as const).map(([field,label])=><label key={field} className="text-xs font-bold text-slate-600">{label}<input type="number" value={Number(policyDraft[field])} onChange={(event)=>setPolicyDraft({...policyDraft,[field]:Number(event.target.value)})} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" /></label>)}</div>
                  </div>
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-800">External KYC, automated face matching and liveness scoring remain blocked until privacy/provider decisions are approved.</div>
                  <button type="button" disabled={busy} onClick={()=>void run(()=>updateIdentityProctoringPolicy(policyDraft),'Identity and proctoring policy updated; candidates must accept the new version.')} className="mt-4 flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-xs font-black text-white disabled:opacity-50"><Save className="h-4 w-4" /> Save versioned policy</button>
                </section>
              )}

              {!loading && activeTab === 'identity' && (
                <div className="grid gap-5 xl:grid-cols-2">
                  <section className="rounded-2xl border border-slate-200 p-5"><div className="flex items-center gap-2"><Fingerprint className="h-5 w-5 text-blue-600" /><h3 className="font-black">Government identity review</h3></div><div className="mt-4 space-y-3">{data.identityDocuments.map((item)=><div key={item.id} className="rounded-xl border border-slate-200 p-4 text-xs"><div className="flex flex-wrap justify-between gap-2"><div><p className="text-sm font-black">{item.candidateName}</p><p className="text-slate-500">{item.candidateEmail}</p></div><span className={`rounded-full px-2 py-1 font-black ${statusClass(item.status)}`}>{item.status.replaceAll('_',' ')}</span></div><p className="mt-2">{item.documentType.replaceAll('_',' ')} · •••• {item.documentNumberLast4} · {item.issuerCountry}</p>{item.duplicateReviewRequired&&<p className="mt-2 rounded-lg bg-rose-50 p-2 font-bold text-rose-700">The same document digest exists on another candidate record.</p>}<div className="mt-3 flex flex-wrap gap-2"><button onClick={()=>void openEvidence(item.documentObjectPath)} className="flex items-center gap-1 rounded-lg border px-3 py-1.5 font-black"><Eye className="h-3 w-3" />ID</button>{item.selfieObjectPath&&<button onClick={()=>void openEvidence(item.selfieObjectPath)} className="flex items-center gap-1 rounded-lg border px-3 py-1.5 font-black"><Camera className="h-3 w-3" />Selfie</button>}<button disabled={busy} onClick={()=>void reviewDocument(item.id,'approved')} className="rounded-lg bg-emerald-600 px-3 py-1.5 font-black text-white">Approve</button><button disabled={busy} onClick={()=>void reviewDocument(item.id,'changes_requested')} className="rounded-lg bg-amber-600 px-3 py-1.5 font-black text-white">Changes</button><button disabled={busy} onClick={()=>void reviewDocument(item.id,'rejected')} className="rounded-lg bg-rose-700 px-3 py-1.5 font-black text-white">Reject</button></div></div>)}</div></section>
                  <section className="rounded-2xl border border-slate-200 p-5"><div className="flex items-center gap-2"><Camera className="h-5 w-5 text-violet-600" /><h3 className="font-black">Pre-examination identity review</h3></div><div className="mt-4 space-y-3">{data.identityChecks.map((item)=><div key={item.id} className="rounded-xl border border-slate-200 p-4 text-xs"><div className="flex justify-between gap-2"><div><p className="text-sm font-black">{item.candidateName}</p><p className="text-slate-500">{item.examinationTitle}</p></div><span className={`rounded-full px-2 py-1 font-black ${statusClass(item.status)}`}>{item.status.replaceAll('_',' ')}</span></div><div className="mt-3 flex flex-wrap gap-2">{item.selfieObjectPath&&<button onClick={()=>void openEvidence(item.selfieObjectPath)} className="flex items-center gap-1 rounded-lg border px-3 py-1.5 font-black"><Eye className="h-3 w-3" />Current selfie</button>}<button disabled={busy} onClick={()=>void reviewCheck(item.id,'approved')} className="rounded-lg bg-emerald-600 px-3 py-1.5 font-black text-white">Approve</button><button disabled={busy} onClick={()=>void reviewCheck(item.id,'changes_requested')} className="rounded-lg bg-amber-600 px-3 py-1.5 font-black text-white">Changes</button><button disabled={busy} onClick={()=>void reviewCheck(item.id,'rejected')} className="rounded-lg bg-rose-700 px-3 py-1.5 font-black text-white">Reject</button></div></div>)}</div></section>
                </div>
              )}

              {!loading && activeTab === 'sessions' && <section className="overflow-x-auto rounded-2xl border border-slate-200"><table className="min-w-full text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr><th className="p-3">Candidate</th><th className="p-3">Examination</th><th className="p-3">Status</th><th className="p-3">Risk</th><th className="p-3">Events</th><th className="p-3">Permissions</th></tr></thead><tbody>{data.proctoringSessions.map((item)=><tr key={item.id} className="border-t"><td className="p-3"><p className="font-black">{item.candidateName}</p><p className="text-slate-500">{item.candidateEmail}</p></td><td className="p-3 font-bold">{item.examinationTitle}</td><td className="p-3">{item.status}</td><td className="p-3"><span className={`rounded-full px-2 py-1 font-black ${statusClass(item.riskLevel)}`}>{item.riskScore}% {item.riskLevel}</span></td><td className="p-3">{item.eventCount} · H{item.highEventCount}/M{item.mediumEventCount}/L{item.lowEventCount}</td><td className="p-3">Camera {item.cameraPermission}<br/>Fullscreen {item.fullscreenStatus}</td></tr>)}</tbody></table></section>}

              {!loading && activeTab === 'cases' && <div className="space-y-4">{data.misconductCases.map((item)=><section key={item.id} className="rounded-2xl border border-slate-200 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-black">{item.candidateName} · {item.examinationTitle}</p><p className="mt-1 text-xs text-slate-500">Case {item.id} · attempt {item.attemptId || 'pending submission'}</p></div><div className="flex gap-2"><span className={`rounded-full px-3 py-1 text-xs font-black ${statusClass(item.status)}`}>{item.status}</span>{item.resultHold&&<span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-black text-rose-800">Result held</span>}</div></div>{item.decisionReason&&<p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{item.decisionReason}</p>}<div className="mt-4 flex flex-wrap gap-2">{(['no_violation','warning','flag_attempt','invalidate_attempt','suspend_candidate'] as const).map((decision)=><button key={decision} disabled={busy||Boolean(item.decision)} onClick={()=>void decideCase(item.id,decision)} className={`rounded-lg px-3 py-2 text-xs font-black text-white disabled:opacity-40 ${decision==='no_violation'?'bg-emerald-600':decision==='warning'?'bg-amber-600':decision==='flag_attempt'?'bg-orange-600':'bg-rose-700'}`}>{decision.replaceAll('_',' ')}</button>)}</div></section>)}</div>}

              {!loading && activeTab === 'appeals' && <div className="space-y-4">{data.appeals.map((item)=><section key={item.id} className="rounded-2xl border border-slate-200 p-5"><div className="flex justify-between gap-3"><div><p className="font-black">{item.candidateName}</p><p className="text-xs text-slate-500">Appeal {item.id} · case {item.misconductCaseId}</p></div><span className={`rounded-full px-3 py-1 text-xs font-black ${statusClass(item.status)}`}>{item.status.replaceAll('_',' ')}</span></div><p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-700">{item.grounds}</p>{['submitted','under_review'].includes(item.status)&&<div className="mt-4 flex flex-wrap gap-2"><button disabled={busy} onClick={()=>void run(()=>decideMisconductAppeal({appealId:item.id,outcome:'upheld',reason:askReason('Reason for upholding the appeal:',10),replacementDecision:'no_violation'}),'Appeal upheld.')} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-black text-white">Uphold</button><button disabled={busy} onClick={()=>void run(()=>decideMisconductAppeal({appealId:item.id,outcome:'partially_upheld',reason:askReason('Reason and revised outcome:',10),replacementDecision:'warning'}),'Appeal partially upheld.')} className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-black text-white">Partially uphold</button><button disabled={busy} onClick={()=>void run(()=>decideMisconductAppeal({appealId:item.id,outcome:'rejected',reason:askReason('Reason for rejecting the appeal:',10)}),'Appeal rejected.')} className="rounded-lg bg-rose-700 px-3 py-2 text-xs font-black text-white">Reject</button></div>}</section>)}</div>}

              {!loading && !data.policies.length && <div className="rounded-2xl bg-slate-50 p-8 text-center text-sm text-slate-500"><FileWarning className="mx-auto h-8 w-8" /><p className="mt-3 font-bold">No Phase 5 policy data is available.</p></div>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

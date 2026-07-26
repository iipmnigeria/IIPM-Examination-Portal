import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Award,
  BadgeCheck,
  BookOpenCheck,
  CalendarClock,
  CheckCircle2,
  ClipboardCopy,
  Download,
  ExternalLink,
  FileJson,
  FileText,
  GraduationCap,
  History,
  Linkedin,
  Loader2,
  RefreshCw,
  RotateCcw,
  Send,
  Share2,
  ShieldCheck,
  Trash2,
  WalletCards,
  X,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { supabase } from '../lib/supabase';
import { getCurrentPortalUser } from '../services/authService';
import {
  createCredentialShareLink,
  getMyCredentialWallet,
  requestCredentialRenewal,
  revokeCredentialShareLink,
  saveMyCpdRecord,
  setTranscriptPublic,
  submitMyCpdRecord,
  type CpdRecord,
  type CredentialShareLink,
  type CredentialWallet,
  type WalletCredential,
} from '../services/credentialWalletService';

const emptyWallet: CredentialWallet = {
  credentials: [],
  examinationHistory: [],
  cpdRecords: [],
  renewals: [],
  shareLinks: [],
  transcript: {},
  counts: {
    credentials: 0,
    activeCredentials: 0,
    examinations: 0,
    approvedCpdHours: 0,
    pendingRenewals: 0,
    activeShareLinks: 0,
  },
};

const formatDate = (value?: string | null): string => {
  if (!value) return 'Not applicable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

const formatDateTime = (value?: string | null): string => {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const escapeXml = (value: string): string => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&apos;');

const downloadBlob = (content: BlobPart, type: string, filename: string) => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const downloadBadgeSvg = (credential: WalletCredential) => {
  const status = credential.effectiveStatus.toUpperCase();
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200" role="img" aria-label="${escapeXml(credential.linkedinCredentialName)}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#071d35"/>
      <stop offset="1" stop-color="#0f766e"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="1200" rx="160" fill="url(#bg)"/>
  <circle cx="600" cy="480" r="330" fill="none" stroke="#fbbf24" stroke-width="28"/>
  <circle cx="600" cy="480" r="270" fill="#ffffff" opacity="0.08"/>
  <text x="600" y="245" text-anchor="middle" fill="#fbbf24" font-size="66" font-family="Arial" font-weight="700">AGILECERT GLOBAL</text>
  <text x="600" y="435" text-anchor="middle" fill="#ffffff" font-size="116" font-family="Georgia" font-weight="700">IIPM</text>
  <text x="600" y="550" text-anchor="middle" fill="#ffffff" font-size="50" font-family="Arial" font-weight="700">${escapeXml(credential.productTitle.toUpperCase())}</text>
  <text x="600" y="635" text-anchor="middle" fill="#dbeafe" font-size="38" font-family="Arial">${escapeXml(credential.programmeCode || 'PROFESSIONAL CREDENTIAL')}</text>
  <text x="600" y="875" text-anchor="middle" fill="#ffffff" font-size="44" font-family="Arial" font-weight="700">${escapeXml(credential.holderName.toUpperCase())}</text>
  <text x="600" y="950" text-anchor="middle" fill="#cbd5e1" font-size="30" font-family="Courier New">${escapeXml(credential.badgeCode)}</text>
  <text x="600" y="1025" text-anchor="middle" fill="#fbbf24" font-size="30" font-family="Arial" font-weight="700">STATUS: ${escapeXml(status)}</text>
  <text x="600" y="1085" text-anchor="middle" fill="#ffffff" font-size="24" font-family="Arial">Verify at ${escapeXml(credential.verificationUrl)}</text>
</svg>`;
  downloadBlob(svg, 'image/svg+xml;charset=utf-8', `${credential.badgeCode}.svg`);
};

const downloadBadgeJson = (credential: WalletCredential) => {
  downloadBlob(
    JSON.stringify(credential.badgeAssertion || {}, null, 2),
    'application/json;charset=utf-8',
    `${credential.badgeCode}.json`,
  );
};

const downloadConsolidatedTranscript = (wallet: CredentialWallet) => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const holder = wallet.credentials[0]?.holderName || 'AgileCert Candidate';
  const transcriptCode = wallet.transcript.transcriptCode || 'CANDIDATE-TRANSCRIPT';
  let y = 22;

  const ensureSpace = (height = 18) => {
    if (y + height > 280) {
      doc.addPage();
      y = 20;
    }
  };

  doc.setTextColor(15, 42, 74);
  doc.setFont('times', 'bold');
  doc.setFontSize(18);
  doc.text('INTEGRATED INSTITUTE OF PROFESSIONAL MANAGEMENT', 105, y, { align: 'center' });
  y += 11;
  doc.setFontSize(24);
  doc.text('CONSOLIDATED CANDIDATE TRANSCRIPT', 105, y, { align: 'center' });
  y += 12;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Candidate: ${holder}`, 18, y);
  y += 7;
  doc.text(`Transcript code: ${transcriptCode}`, 18, y);
  y += 7;
  doc.text(`Generated: ${new Date().toLocaleString()}`, 18, y);
  y += 10;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Examination History', 18, y);
  y += 7;

  wallet.examinationHistory.forEach((item, index) => {
    ensureSpace(28);
    doc.setDrawColor(203, 213, 225);
    doc.rect(18, y, 174, 23);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`${index + 1}. ${item.examinationTitle}`, 22, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Programme: ${item.programmeCode || 'IIPM'} · Score: ${item.score}% · Pass mark: ${item.passMark}%`, 22, y + 12);
    doc.text(`Result: ${item.result === 'pass' ? 'PASS' : 'NOT PASSED'} · Completed: ${formatDate(item.completedAt)}`, 22, y + 18);
    y += 28;
  });

  ensureSpace(18);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Professional Credentials', 18, y);
  y += 7;

  wallet.credentials.forEach((credential, index) => {
    ensureSpace(34);
    doc.setDrawColor(203, 213, 225);
    doc.rect(18, y, 174, 29);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`${index + 1}. ${credential.linkedinCredentialName}`, 22, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(`Credential ID: ${credential.credentialCode}`, 22, y + 12);
    doc.text(`Certificate: ${credential.certificateNumber} · Status: ${credential.effectiveStatus.toUpperCase()}`, 22, y + 18);
    doc.text(`Issued: ${formatDate(credential.issuedAt)} · Expires: ${formatDate(credential.expiresAt)}`, 22, y + 24);
    y += 34;
  });

  ensureSpace(18);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Approved Continuing Professional Development', 18, y);
  y += 7;

  const approved = wallet.cpdRecords.filter((record) => record.status === 'approved');
  approved.forEach((record, index) => {
    ensureSpace(22);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(`${index + 1}. ${record.title}`, 22, y);
    doc.setFont('helvetica', 'normal');
    doc.text(`${record.provider} · ${record.hours} hours · ${formatDate(record.completedOn)}`, 26, y + 6);
    y += 13;
  });
  if (!approved.length) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('No approved CPD record is currently attached to this transcript.', 22, y);
    y += 10;
  }

  ensureSpace(15);
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('This transcript is generated from server-owned AgileCert examination and credential records.', 105, y + 4, { align: 'center' });
  doc.save(`${transcriptCode}.pdf`);
};

const statusClass: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  expired: 'bg-amber-50 text-amber-700 border-amber-200',
  suspended: 'bg-orange-50 text-orange-700 border-orange-200',
  revoked: 'bg-rose-50 text-rose-700 border-rose-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  submitted: 'bg-blue-50 text-blue-700 border-blue-200',
  draft: 'bg-slate-50 text-slate-600 border-slate-200',
  changes_requested: 'bg-amber-50 text-amber-700 border-amber-200',
  rejected: 'bg-rose-50 text-rose-700 border-rose-200',
};

export default function CandidateCredentialWallet() {
  const [isCandidate, setIsCandidate] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [wallet, setWallet] = useState<CredentialWallet>(emptyWallet);
  const [isLoading, setIsLoading] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [tab, setTab] = useState<'credentials' | 'history' | 'cpd' | 'sharing'>('credentials');
  const [cpdForm, setCpdForm] = useState({
    title: '',
    provider: '',
    activityType: 'course',
    completedOn: new Date().toISOString().slice(0, 10),
    hours: '1',
    credentialId: '',
    evidenceReference: '',
  });

  const refreshAuthorisation = async () => {
    try {
      const current = await getCurrentPortalUser();
      const candidate = current?.profile.role === 'candidate';
      setIsCandidate(candidate);
      if (!candidate) setIsOpen(false);
    } catch {
      setIsCandidate(false);
      setIsOpen(false);
    }
  };

  const refresh = async () => {
    if (!isCandidate) return;
    try {
      setIsLoading(true);
      setError('');
      setWallet(await getMyCredentialWallet());
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Unable to load the credential wallet.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refreshAuthorisation();
    const refreshHandler = () => void refresh();
    window.addEventListener('agilecert-credential-wallet-refresh', refreshHandler);
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      window.setTimeout(() => void refreshAuthorisation(), 0);
    });
    return () => {
      window.removeEventListener('agilecert-credential-wallet-refresh', refreshHandler);
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (isOpen && isCandidate) void refresh();
  }, [isOpen, isCandidate]);

  const activeShares = useMemo(
    () => wallet.shareLinks.filter((share) => !share.revokedAt && new Date(share.expiresAt).getTime() > Date.now()),
    [wallet.shareLinks],
  );

  const runAction = async (key: string, action: () => Promise<void>, success: string) => {
    try {
      setBusy(key);
      setError('');
      setMessage('');
      await action();
      setMessage(success);
      await refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'The credential action could not be completed.');
    } finally {
      setBusy('');
    }
  };

  const copyText = async (value: string, success = 'Copied to clipboard.') => {
    try {
      await navigator.clipboard.writeText(value);
      setMessage(success);
      setError('');
    } catch {
      setError('Clipboard access is unavailable. Select and copy the value manually.');
    }
  };

  const saveCpd = (event: FormEvent) => {
    event.preventDefault();
    void runAction('save-cpd', async () => {
      const result = await saveMyCpdRecord({
        title: cpdForm.title,
        provider: cpdForm.provider,
        activityType: cpdForm.activityType,
        completedOn: cpdForm.completedOn,
        hours: Number(cpdForm.hours),
        credentialId: cpdForm.credentialId || null,
        evidenceReference: cpdForm.evidenceReference || null,
      });
      if (!result.id) throw new Error('The CPD draft identifier was not returned.');
      setCpdForm({
        title: '',
        provider: '',
        activityType: 'course',
        completedOn: new Date().toISOString().slice(0, 10),
        hours: '1',
        credentialId: '',
        evidenceReference: '',
      });
    }, 'CPD record saved as a draft.');
  };

  const submitCpd = (record: CpdRecord) => {
    void runAction(`submit-cpd-${record.id}`, async () => {
      await submitMyCpdRecord(record.id);
    }, 'CPD record submitted for administrator review.');
  };

  const shareCredential = (credential: WalletCredential) => {
    const validDays = Number(window.prompt('How many days should the employer link remain active?', String(credential.policy.shareLinkDefaultDays || 30)) || '0');
    if (!Number.isFinite(validDays) || validDays < 1) return;
    const label = window.prompt('Enter a label for this share link.', 'Employer credential verification') || 'Employer credential verification';
    void runAction(`share-${credential.credentialId}`, async () => {
      const result = await createCredentialShareLink({
        scope: 'credential',
        credentialId: credential.credentialId,
        label,
        validDays,
      });
      if (result.shareUrl) await navigator.clipboard.writeText(result.shareUrl);
    }, 'Credential verification link created and copied.');
  };

  const shareTranscript = () => {
    const validDays = Number(window.prompt('How many days should the transcript link remain active?', '30') || '0');
    if (!Number.isFinite(validDays) || validDays < 1) return;
    void runAction('share-transcript', async () => {
      const result = await createCredentialShareLink({
        scope: 'transcript',
        label: 'Professional transcript verification',
        validDays,
      });
      if (result.shareUrl) await navigator.clipboard.writeText(result.shareUrl);
    }, 'Transcript verification link created and copied.');
  };

  const revokeShare = (share: CredentialShareLink) => {
    if (!window.confirm(`Revoke “${share.label}”? The link will stop verifying immediately.`)) return;
    void runAction(`revoke-share-${share.id}`, async () => {
      await revokeCredentialShareLink(share.id);
    }, 'The verification link was revoked.');
  };

  const renewCredential = (credential: WalletCredential) => {
    void runAction(`renew-${credential.credentialId}`, async () => {
      await requestCredentialRenewal(credential.credentialId);
    }, 'Credential renewal request submitted.');
  };

  const openLinkedIn = async (credential: WalletCredential) => {
    const details = [
      `Name: ${credential.linkedinCredentialName}`,
      'Issuing organisation: Integrated Institute of Professional Management (IIPM)',
      `Issue date: ${formatDate(credential.issuedAt)}`,
      `Expiry date: ${credential.expiresAt ? formatDate(credential.expiresAt) : 'This credential does not expire'}`,
      `Credential ID: ${credential.credentialCode}`,
      `Credential URL: ${credential.verificationUrl}`,
    ].join('\n');
    await copyText(details, 'LinkedIn credential details copied. Paste them into LinkedIn’s certification form.');
    window.open('https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME', '_blank', 'noopener,noreferrer');
  };

  if (!isCandidate) return null;

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 left-5 z-[84] inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-slate-950 px-4 py-3 text-xs font-extrabold text-white shadow-2xl transition hover:-translate-y-0.5 hover:bg-slate-900"
        aria-label="Open professional credential wallet"
      >
        <WalletCards className="h-4 w-4 text-cyan-300" />
        <span className="hidden sm:inline">Credential Wallet</span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[150] overflow-y-auto bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950 text-white shadow-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-cyan-400/15 p-2.5 text-cyan-300">
              <WalletCards className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-lg font-black">Professional Credential Wallet</h1>
              <p className="mt-1 text-xs text-slate-400">Credentials, badges, transcript, CPD, renewal and verified sharing</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void refresh()} className="rounded-lg border border-slate-700 p-2 text-slate-300" aria-label="Refresh credential wallet">
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button type="button" onClick={() => setIsOpen(false)} className="rounded-lg border border-slate-700 p-2 text-slate-300" aria-label="Close credential wallet">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-7">
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {[
            ['Credentials', wallet.counts.credentials, Award],
            ['Active', wallet.counts.activeCredentials, ShieldCheck],
            ['Examinations', wallet.counts.examinations, GraduationCap],
            ['Approved CPD', `${wallet.counts.approvedCpdHours}h`, BookOpenCheck],
            ['Renewals', wallet.counts.pendingRenewals, RotateCcw],
            ['Shared links', wallet.counts.activeShareLinks, Share2],
          ].map(([label, value, Icon]) => (
            <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{String(label)}</p>
                <Icon className="h-4 w-4 text-cyan-700" />
              </div>
              <p className="mt-2 text-2xl font-black text-slate-950">{String(value)}</p>
            </div>
          ))}
        </section>

        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div>}
        {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">{message}</div>}

        <nav className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm" aria-label="Credential wallet sections">
          {([
            ['credentials', 'Credentials & Badges', BadgeCheck],
            ['history', 'Transcript & History', History],
            ['cpd', 'CPD Records', BookOpenCheck],
            ['sharing', 'Verification Links', Share2],
          ] as const).map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition ${tab === value ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>

        {tab === 'credentials' && (
          <section className="grid gap-5 lg:grid-cols-2">
            {wallet.credentials.map((credential) => (
              <article key={credential.credentialId} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-cyan-700">{credential.productTitle}</p>
                    <h2 className="mt-1 text-xl font-black text-slate-950">{credential.certificateTitle}</h2>
                    <p className="mt-2 text-sm text-slate-500">{credential.examinationTitle}</p>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-black capitalize ${statusClass[credential.effectiveStatus] || statusClass.draft}`}>
                    {credential.effectiveStatus}
                  </span>
                </div>

                <dl className="mt-5 grid gap-4 rounded-2xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
                  <div><dt className="text-[10px] font-black uppercase text-slate-400">Credential ID</dt><dd className="mt-1 break-all font-mono font-bold">{credential.credentialCode}</dd></div>
                  <div><dt className="text-[10px] font-black uppercase text-slate-400">Badge ID</dt><dd className="mt-1 break-all font-mono font-bold">{credential.badgeCode}</dd></div>
                  <div><dt className="text-[10px] font-black uppercase text-slate-400">Issued</dt><dd className="mt-1 font-bold">{formatDate(credential.issuedAt)}</dd></div>
                  <div><dt className="text-[10px] font-black uppercase text-slate-400">Expires</dt><dd className="mt-1 font-bold">{credential.expiresAt ? formatDate(credential.expiresAt) : 'Does not expire'}</dd></div>
                  <div><dt className="text-[10px] font-black uppercase text-slate-400">Score</dt><dd className="mt-1 font-bold">{credential.score}% / {credential.passMark}% required</dd></div>
                  <div><dt className="text-[10px] font-black uppercase text-slate-400">Renewals</dt><dd className="mt-1 font-bold">{credential.renewalCount}</dd></div>
                </dl>

                {credential.expiresAt && (
                  <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                    <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>Renewal window: {formatDate(credential.renewalDueAt)} · Required approved CPD: {credential.policy.cpdHoursRequired} hours.</p>
                  </div>
                )}

                <div className="mt-5 flex flex-wrap gap-2">
                  <a href={credential.verificationUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white"><ExternalLink className="h-4 w-4" />Verify</a>
                  <button type="button" onClick={() => downloadBadgeSvg(credential)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold"><Download className="h-4 w-4" />Badge SVG</button>
                  <button type="button" onClick={() => downloadBadgeJson(credential)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold"><FileJson className="h-4 w-4" />Badge JSON</button>
                  <button type="button" onClick={() => void openLinkedIn(credential)} className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700"><Linkedin className="h-4 w-4" />Add to LinkedIn</button>
                  <button type="button" onClick={() => shareCredential(credential)} disabled={busy === `share-${credential.credentialId}`} className="inline-flex items-center gap-2 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-bold text-cyan-800 disabled:opacity-50"><Share2 className="h-4 w-4" />Share</button>
                  {credential.renewalEligible && (
                    <button type="button" onClick={() => renewCredential(credential)} disabled={busy === `renew-${credential.credentialId}`} className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 disabled:opacity-50">
                      {busy === `renew-${credential.credentialId}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                      Request renewal
                    </button>
                  )}
                </div>
              </article>
            ))}
            {!wallet.credentials.length && (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500 lg:col-span-2">
                Paid or administrator-waived credentials will appear here after certificate issuance.
              </div>
            )}
          </section>
        )}

        {tab === 'history' && (
          <section className="space-y-5">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-xl font-black">Consolidated candidate transcript</h2>
                  <p className="mt-2 text-sm text-slate-500">Code: <span className="font-mono font-bold">{wallet.transcript.transcriptCode || 'Created after first credential'}</span></p>
                  <p className="mt-1 text-xs text-slate-500">Permanent public verification is {wallet.transcript.publicEnabled ? 'enabled' : 'disabled'}.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => downloadConsolidatedTranscript(wallet)} disabled={!wallet.examinationHistory.length} className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><FileText className="h-4 w-4" />Download transcript</button>
                  <button type="button" onClick={shareTranscript} disabled={!wallet.transcript.transcriptCode || busy === 'share-transcript'} className="inline-flex items-center gap-2 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-bold text-cyan-800 disabled:opacity-50"><Share2 className="h-4 w-4" />Temporary share link</button>
                  <button type="button" onClick={() => void runAction('transcript-public', async () => { await setTranscriptPublic(!wallet.transcript.publicEnabled); }, `Permanent transcript verification ${wallet.transcript.publicEnabled ? 'disabled' : 'enabled'}.`)} disabled={!wallet.transcript.transcriptCode || busy === 'transcript-public'} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold disabled:opacity-50"><ShieldCheck className="h-4 w-4" />{wallet.transcript.publicEnabled ? 'Make private' : 'Enable permanent verification'}</button>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-100 text-xs uppercase tracking-wider text-slate-500"><tr><th className="p-4">Examination</th><th className="p-4">Programme</th><th className="p-4">Score</th><th className="p-4">Result</th><th className="p-4">Credential</th><th className="p-4">Completed</th></tr></thead>
                <tbody>
                  {wallet.examinationHistory.map((item) => (
                    <tr key={item.attemptId} className="border-t border-slate-100">
                      <td className="p-4 font-bold">{item.examinationTitle}</td>
                      <td className="p-4">{item.programmeCode}</td>
                      <td className="p-4">{item.score}% / {item.passMark}%</td>
                      <td className="p-4 font-bold uppercase">{item.result === 'pass' ? 'Pass' : 'Not passed'}</td>
                      <td className="p-4 font-mono text-xs">{item.credentialCode || 'Not issued'}</td>
                      <td className="p-4">{formatDate(item.completedAt)}</td>
                    </tr>
                  ))}
                  {!wallet.examinationHistory.length && <tr><td colSpan={6} className="p-8 text-center text-slate-500">No completed examination record is available.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === 'cpd' && (
          <section className="grid gap-6 lg:grid-cols-[380px_1fr]">
            <form onSubmit={saveCpd} className="h-fit space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div><h2 className="text-lg font-black">Add CPD activity</h2><p className="mt-1 text-xs text-slate-500">Save a draft, then submit it for administrator review.</p></div>
              <label className="block text-xs font-bold text-slate-600">Activity title<input required value={cpdForm.title} onChange={(event) => setCpdForm((current) => ({ ...current, title: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" /></label>
              <label className="block text-xs font-bold text-slate-600">Provider<input required value={cpdForm.provider} onChange={(event) => setCpdForm((current) => ({ ...current, provider: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" /></label>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <label className="block text-xs font-bold text-slate-600">Activity type<select value={cpdForm.activityType} onChange={(event) => setCpdForm((current) => ({ ...current, activityType: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"><option value="course">Course</option><option value="workshop">Workshop</option><option value="conference">Conference</option><option value="webinar">Webinar</option><option value="professional_practice">Professional practice</option><option value="research">Research</option><option value="publication">Publication</option><option value="mentoring">Mentoring</option><option value="volunteering">Volunteering</option><option value="other">Other</option></select></label>
                <label className="block text-xs font-bold text-slate-600">Hours<input required min="0.25" max="1000" step="0.25" type="number" value={cpdForm.hours} onChange={(event) => setCpdForm((current) => ({ ...current, hours: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" /></label>
              </div>
              <label className="block text-xs font-bold text-slate-600">Completion date<input required type="date" max={new Date().toISOString().slice(0, 10)} value={cpdForm.completedOn} onChange={(event) => setCpdForm((current) => ({ ...current, completedOn: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" /></label>
              <label className="block text-xs font-bold text-slate-600">Related credential<select value={cpdForm.credentialId} onChange={(event) => setCpdForm((current) => ({ ...current, credentialId: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"><option value="">General professional development</option>{wallet.credentials.map((credential) => <option key={credential.credentialId} value={credential.credentialId}>{credential.certificateTitle} — {credential.programmeCode}</option>)}</select></label>
              <label className="block text-xs font-bold text-slate-600">Evidence reference or URL<input value={cpdForm.evidenceReference} onChange={(event) => setCpdForm((current) => ({ ...current, evidenceReference: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" /></label>
              <button type="submit" disabled={busy === 'save-cpd'} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white disabled:opacity-50">{busy === 'save-cpd' ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpenCheck className="h-4 w-4" />}Save CPD draft</button>
            </form>

            <div className="space-y-4">
              {wallet.cpdRecords.map((record) => (
                <article key={record.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div><h3 className="font-black">{record.title}</h3><p className="mt-1 text-sm text-slate-500">{record.provider} · {record.hours} hours · {formatDate(record.completedOn)}</p></div>
                    <span className={`w-fit rounded-full border px-3 py-1 text-xs font-black capitalize ${statusClass[record.status] || statusClass.draft}`}>{record.status.replaceAll('_', ' ')}</span>
                  </div>
                  {record.evidenceReference && <p className="mt-3 break-all text-xs text-slate-500">Evidence: {record.evidenceReference}</p>}
                  {record.reviewReason && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">Review note: {record.reviewReason}</p>}
                  <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <span>Created {formatDateTime(record.createdAt)}</span>
                    {(record.status === 'draft' || record.status === 'changes_requested') && (
                      <button type="button" onClick={() => submitCpd(record)} disabled={busy === `submit-cpd-${record.id}`} className="ml-auto inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 font-bold text-white disabled:opacity-50">{busy === `submit-cpd-${record.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Submit for review</button>
                    )}
                  </div>
                </article>
              ))}
              {!wallet.cpdRecords.length && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">No CPD activity has been recorded.</div>}
            </div>
          </section>
        )}

        {tab === 'sharing' && (
          <section className="space-y-5">
            <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-5 text-sm text-cyan-950">
              <p className="font-black">Candidate-controlled verification</p>
              <p className="mt-1 leading-6">Temporary links can be revoked at any time. Public verification excludes your email, account identifier, payment details, examination answers, identity evidence and private CPD evidence.</p>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {wallet.shareLinks.map((share) => {
                const active = !share.revokedAt && new Date(share.expiresAt).getTime() > Date.now();
                return (
                  <article key={share.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-4"><div><h3 className="font-black">{share.label}</h3><p className="mt-1 text-xs uppercase tracking-wider text-slate-400">{share.scope.replaceAll('_', ' ')}</p></div><span className={`rounded-full border px-3 py-1 text-xs font-black ${active ? statusClass.active : statusClass.revoked}`}>{active ? 'Active' : share.revokedAt ? 'Revoked' : 'Expired'}</span></div>
                    <p className="mt-4 break-all rounded-lg bg-slate-50 p-3 font-mono text-xs">{share.shareUrl}</p>
                    <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2"><div><dt className="text-slate-400">Expires</dt><dd className="mt-1 font-bold">{formatDateTime(share.expiresAt)}</dd></div><div><dt className="text-slate-400">Verifications</dt><dd className="mt-1 font-bold">{share.accessCount}</dd></div></dl>
                    <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => void copyText(share.shareUrl)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold"><ClipboardCopy className="h-4 w-4" />Copy</button>{active && <button type="button" onClick={() => revokeShare(share)} disabled={busy === `revoke-share-${share.id}`} className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 disabled:opacity-50"><Trash2 className="h-4 w-4" />Revoke</button>}</div>
                  </article>
                );
              })}
              {!wallet.shareLinks.length && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500 lg:col-span-2">No credential or transcript share link has been created.</div>}
            </div>
            {activeShares.length > 0 && <p className="text-xs text-slate-400">{activeShares.length} active candidate-controlled verification link{activeShares.length === 1 ? '' : 's'}.</p>}
          </section>
        )}
      </main>
    </div>
  );
}

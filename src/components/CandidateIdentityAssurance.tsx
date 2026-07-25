import { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  FileCheck2,
  FileUp,
  Loader2,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getCurrentPortalUser } from '../services/authService';
import {
  getMyIdentityAssurance,
  submitMyIdentityAssurance,
  uploadIdentityEvidence,
  withdrawMyIdentityAssurance,
  type CandidateIdentityAssuranceWorkspace,
  type IdentityAffiliationType,
  type IdentityEvidenceCategory,
} from '../services/identityAssuranceService';

const emptyWorkspace: CandidateIdentityAssuranceWorkspace = {
  profile: {
    legalName: null,
    phone: null,
    countryCode: null,
    professionalHeadline: null,
    employer: null,
  },
  verification: null,
  professionalCheckoutUnlocked: false,
  allowedEvidenceCategories: [
    'professional_membership',
    'employer_confirmation',
    'educational_credential',
    'institutional_identity',
    'other_professional_evidence',
  ],
  prohibitedEvidenceNotice:
    'Do not upload passports, national identity cards, driving licences, voter cards, selfies or biometric material.',
};

const categoryLabels: Record<IdentityEvidenceCategory, string> = {
  professional_membership: 'Professional membership card or licence',
  employer_confirmation: 'Employer confirmation letter',
  educational_credential: 'Educational or training credential',
  institutional_identity: 'Institutional identity card',
  other_professional_evidence: 'Other non-government professional evidence',
};

const affiliationLabels: Record<IdentityAffiliationType, string> = {
  professional_body: 'Professional body',
  employer: 'Employer',
  educational_institution: 'Educational institution',
  training_provider: 'Training provider',
  other: 'Other professional affiliation',
};

const formatDate = (value?: string | null) => {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export default function CandidateIdentityAssurance() {
  const [isCandidate, setIsCandidate] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [workspace, setWorkspace] = useState<CandidateIdentityAssuranceWorkspace>(emptyWorkspace);
  const [affiliationType, setAffiliationType] = useState<IdentityAffiliationType>('professional_body');
  const [affiliationName, setAffiliationName] = useState('');
  const [affiliationReference, setAffiliationReference] = useState('');
  const [evidenceCategory, setEvidenceCategory] = useState<IdentityEvidenceCategory>('professional_membership');
  const [candidateNotes, setCandidateNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [attestation, setAttestation] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

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
      const next = await getMyIdentityAssurance();
      setWorkspace(next);
      if (!affiliationName && next.profile.employer) {
        setAffiliationType('employer');
        setAffiliationName(next.profile.employer);
      }
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Unable to load identity assurance.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refreshAuthorisation();
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      window.setTimeout(() => void refreshAuthorisation(), 0);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (isOpen && isCandidate) void refresh();
  }, [isOpen, isCandidate]);

  const profileComplete = useMemo(
    () => Boolean(workspace.profile.legalName && workspace.profile.phone && workspace.profile.countryCode),
    [workspace.profile],
  );

  const canSubmit = !workspace.verification || ['changes_requested', 'rejected', 'withdrawn', 'expired'].includes(workspace.verification.status);

  const submit = async () => {
    try {
      setIsSubmitting(true);
      setError('');
      setMessage('');
      if (!profileComplete) throw new Error('Complete your legal name, phone and country in the candidate profile first.');
      if (!affiliationName.trim()) throw new Error('Enter your professional or institutional affiliation.');
      if (!file) throw new Error('Select one permitted evidence file.');
      if (!attestation) throw new Error('Confirm the accuracy and consent attestation.');

      const uploaded = await uploadIdentityEvidence(file);
      await submitMyIdentityAssurance({
        affiliationType,
        affiliationName,
        affiliationReference,
        evidenceCategory,
        evidenceObjectPath: uploaded.objectPath,
        evidenceFilename: uploaded.filename,
        evidenceMimeType: uploaded.mimeType,
        evidenceSizeBytes: uploaded.sizeBytes,
        candidateNotes,
        attestation,
      });

      setMessage('Identity-assurance submission received for confidential IIPM review.');
      setFile(null);
      setAttestation(false);
      await refresh();
      window.dispatchEvent(new Event('agilecert-identity-assurance-refresh'));
      window.dispatchEvent(new Event('agilecert-certificate-commerce-refresh'));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to submit identity assurance.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const withdraw = async () => {
    try {
      setIsSubmitting(true);
      setError('');
      await withdrawMyIdentityAssurance('Withdrawn by candidate from the Phase 5 identity-assurance workspace.');
      setMessage('The active identity-assurance submission has been withdrawn.');
      await refresh();
      window.dispatchEvent(new Event('agilecert-identity-assurance-refresh'));
      window.dispatchEvent(new Event('agilecert-certificate-commerce-refresh'));
    } catch (withdrawError) {
      setError(withdrawError instanceof Error ? withdrawError.message : 'Unable to withdraw identity assurance.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isCandidate) return null;

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 left-5 z-[83] inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-slate-950 px-4 py-3 text-xs font-extrabold text-white shadow-2xl transition hover:-translate-y-0.5 hover:bg-slate-900"
        aria-label="Open identity assurance"
      >
        <UserCheck className="h-4 w-4 text-blue-300" />
        <span className="hidden sm:inline">Identity Assurance</span>
      </button>
    );
  }

  const verification = workspace.verification;

  return (
    <div className="fixed inset-0 z-[146] overflow-y-auto bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-slate-950 text-white shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <div>
            <h1 className="text-lg font-black">Identity Assurance</h1>
            <p className="mt-1 text-xs text-slate-400">Private manual IIPM review for Professional Certificate eligibility</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void refresh()} className="rounded-lg border border-slate-700 p-2 text-slate-300" aria-label="Refresh identity assurance">
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button type="button" onClick={() => setIsOpen(false)} className="rounded-lg border border-slate-700 p-2 text-slate-300" aria-label="Close identity assurance">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <section className={`rounded-2xl border p-5 ${workspace.professionalCheckoutUnlocked ? 'border-emerald-200 bg-emerald-50' : 'border-blue-200 bg-blue-50'}`}>
          <div className="flex items-start gap-3">
            {workspace.professionalCheckoutUnlocked ? <BadgeCheck className="mt-0.5 h-6 w-6 text-emerald-700" /> : <ShieldCheck className="mt-0.5 h-6 w-6 text-blue-700" />}
            <div>
              <p className="font-black">{workspace.professionalCheckoutUnlocked ? 'Professional Certificate checkout unlocked' : 'Professional Certificate verification required'}</p>
              <p className="mt-1 text-sm leading-6">{workspace.professionalCheckoutUnlocked ? 'Your approved identity record will be rechecked by the server before payment and credential issuance.' : 'Submit one permitted non-government professional evidence file for confidential manual review.'}</p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-900">
          <p className="font-black">Privacy restriction</p>
          <p className="mt-1 leading-6">{workspace.prohibitedEvidenceNotice}</p>
        </section>

        {error && <div className="rounded-xl border border-rose-200 bg-white p-4 text-sm font-bold text-rose-700">{error}</div>}
        {message && <div className="rounded-xl border border-emerald-200 bg-white p-4 text-sm font-bold text-emerald-700">{message}</div>}

        <section className="grid gap-5 lg:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-black">Candidate profile snapshot</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div><dt className="text-xs font-bold uppercase text-slate-400">Legal name</dt><dd className="mt-1 font-bold">{workspace.profile.legalName || 'Not completed'}</dd></div>
              <div><dt className="text-xs font-bold uppercase text-slate-400">Phone</dt><dd className="mt-1 font-bold">{workspace.profile.phone || 'Not completed'}</dd></div>
              <div><dt className="text-xs font-bold uppercase text-slate-400">Country</dt><dd className="mt-1 font-bold">{workspace.profile.countryCode || 'Not completed'}</dd></div>
              <div><dt className="text-xs font-bold uppercase text-slate-400">Employer</dt><dd className="mt-1 font-bold">{workspace.profile.employer || 'Not recorded'}</dd></div>
            </dl>
            {!profileComplete && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-800">Complete the missing profile fields before submitting identity assurance.</p>}
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-black">Current verification</h2>
            {!verification ? (
              <p className="mt-4 text-sm text-slate-500">No identity-assurance submission has been created.</p>
            ) : (
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3"><span className="text-slate-500">Status</span><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase">{verification.status.replace('_', ' ')}</span></div>
                <div className="flex items-center justify-between gap-3"><span className="text-slate-500">Submitted</span><span className="font-bold">{formatDate(verification.submittedAt)}</span></div>
                <div className="flex items-center justify-between gap-3"><span className="text-slate-500">Evidence</span><span className="font-bold">{verification.evidenceFilename}</span></div>
                <div className="flex items-center justify-between gap-3"><span className="text-slate-500">Affiliation</span><span className="font-bold">{verification.affiliationName}</span></div>
                {verification.reviewNote && <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-black uppercase text-slate-400">Reviewer note</p><p className="mt-1 leading-6">{verification.reviewNote}</p></div>}
                {verification.approvalExpiresAt && <div className="flex items-center justify-between gap-3"><span className="text-slate-500">Approval valid until</span><span className="font-bold">{formatDate(verification.approvalExpiresAt)}</span></div>}
                {['submitted', 'under_review', 'changes_requested', 'approved'].includes(verification.status) && (
                  <button type="button" disabled={isSubmitting} onClick={() => void withdraw()} className="mt-2 inline-flex items-center gap-2 rounded-lg border border-rose-200 px-3 py-2 text-xs font-black text-rose-700 disabled:opacity-50">
                    {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />} Withdraw submission
                  </button>
                )}
              </div>
            )}
          </article>
        </section>

        {canSubmit && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3"><FileCheck2 className="h-6 w-6 text-blue-700" /><div><h2 className="font-black">Submit identity assurance</h2><p className="mt-1 text-sm text-slate-500">One private evidence file is required.</p></div></div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="text-sm font-bold">Affiliation type<select value={affiliationType} onChange={(event) => setAffiliationType(event.target.value as IdentityAffiliationType)} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 font-normal">{Object.entries(affiliationLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label className="text-sm font-bold">Affiliation name<input value={affiliationName} onChange={(event) => setAffiliationName(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 font-normal" placeholder="Organisation or institution" /></label>
              <label className="text-sm font-bold">Reference number <span className="font-normal text-slate-400">(optional)</span><input value={affiliationReference} onChange={(event) => setAffiliationReference(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 font-normal" placeholder="Membership, employee or student number" /></label>
              <label className="text-sm font-bold">Evidence category<select value={evidenceCategory} onChange={(event) => setEvidenceCategory(event.target.value as IdentityEvidenceCategory)} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 font-normal">{workspace.allowedEvidenceCategories.map((category) => <option key={category} value={category}>{categoryLabels[category]}</option>)}</select></label>
              <label className="text-sm font-bold md:col-span-2">Private evidence file<input type="file" accept="application/pdf,image/jpeg,image/png" onChange={(event) => setFile(event.target.files?.[0] || null)} className="mt-2 block w-full rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-5 text-sm font-normal" /><span className="mt-2 block text-xs font-normal text-slate-500">PDF, JPG or PNG. Maximum 10 MB.</span></label>
              <label className="text-sm font-bold md:col-span-2">Notes <span className="font-normal text-slate-400">(optional)</span><textarea value={candidateNotes} onChange={(event) => setCandidateNotes(event.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 font-normal" placeholder="Information that will help the reviewer confirm the evidence" /></label>
            </div>
            <label className="mt-5 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6"><input type="checkbox" checked={attestation} onChange={(event) => setAttestation(event.target.checked)} className="mt-1" /><span>I confirm that the information is accurate, the evidence belongs to me, and I consent to confidential manual review by authorised IIPM administrators.</span></label>
            <button type="button" disabled={isSubmitting || !profileComplete} onClick={() => void submit()} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />} Submit for review
            </button>
          </section>
        )}
      </main>
    </div>
  );
}

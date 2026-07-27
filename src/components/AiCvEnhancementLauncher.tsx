import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  FileText,
  Lightbulb,
  Loader2,
  ShieldCheck,
  Sparkles,
  Target,
  WandSparkles,
  X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getCurrentPortalUser } from '../services/authService';
import {
  getMyCandidateCvDocument,
  type CandidateCvDocument,
} from '../services/aiCvProfileBuilderService';
import {
  applyAiCvEnhancement,
  requestAiCvEnhancement,
  setMyAiCvProcessingConsent,
  type AiCvEnhancementKind,
  type AiCvEnhancementResponse,
} from '../services/aiCvEnhancementService';

const actionOptions: Array<{
  key: AiCvEnhancementKind;
  title: string;
  description: string;
}> = [
  {
    key: 'professional_summary',
    title: 'Professional summary',
    description: 'Produce a concise, fact-grounded professional summary from the saved CV.',
  },
  {
    key: 'role_tailoring',
    title: 'Tailor for a role',
    description: 'Align the summary, skills and achievement language to a stated target role.',
  },
  {
    key: 'achievement_rewrite',
    title: 'Strengthen achievements',
    description: 'Rewrite existing experience bullets with clearer action and outcome language.',
  },
  {
    key: 'skills_recommendation',
    title: 'Refine skills',
    description: 'Recommend applicant-tracking-system-friendly skills grounded in the CV facts.',
  },
];

export default function AiCvEnhancementLauncher() {
  const [isCandidate, setIsCandidate] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [document, setDocument] = useState<CandidateCvDocument | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');
  const [action, setAction] = useState<AiCvEnhancementKind>('professional_summary');
  const [targetRole, setTargetRole] = useState('');
  const [instruction, setInstruction] = useState('');
  const [suggestion, setSuggestion] = useState<AiCvEnhancementResponse | null>(null);
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

  const refreshDocument = async () => {
    if (!isCandidate) return;
    try {
      setLoading(true);
      setError('');
      const next = await getMyCandidateCvDocument();
      setDocument(next);
      if (next?.target_role && !targetRole) setTargetRole(next.target_role);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load the private CV document.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshAuthorisation();
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      window.setTimeout(() => void refreshAuthorisation(), 0);
    });
    const openHandler = () => setIsOpen(true);
    window.addEventListener('agilecert-ai-cv-open', openHandler);
    return () => {
      listener.subscription.unsubscribe();
      window.removeEventListener('agilecert-ai-cv-open', openHandler);
    };
  }, []);

  useEffect(() => {
    if (isOpen && isCandidate) void refreshDocument();
  }, [isOpen, isCandidate]);

  const previewItems = useMemo(() => {
    if (!suggestion) return [];
    return [
      suggestion.professionalSummary ? 'Professional summary' : '',
      suggestion.skills.length ? `${suggestion.skills.length} skills` : '',
      suggestion.experienceHighlights.length
        ? `${suggestion.experienceHighlights.length} experience section${suggestion.experienceHighlights.length === 1 ? '' : 's'}`
        : '',
    ].filter(Boolean);
  }, [suggestion]);

  const updateConsent = async (consent: boolean) => {
    try {
      setBusy('consent');
      setError('');
      setMessage('');
      const enabled = await setMyAiCvProcessingConsent(consent);
      setDocument((current) =>
        current ? { ...current, ai_processing_consent: enabled, updated_at: new Date().toISOString() } : current,
      );
      setMessage(
        enabled
          ? 'AI processing consent is enabled. Suggestions remain private until you explicitly apply them.'
          : 'AI processing consent has been withdrawn.',
      );
      if (!enabled) setSuggestion(null);
    } catch (consentError) {
      setError(consentError instanceof Error ? consentError.message : 'Unable to update AI consent.');
    } finally {
      setBusy('');
    }
  };

  const requestSuggestion = async () => {
    if (!document) {
      setError('Open the CV Builder, create your private CV and save it before using AI assistance.');
      return;
    }
    if (!document.ai_processing_consent) {
      setError('Enable explicit AI processing consent before requesting a suggestion.');
      return;
    }
    if (action === 'role_tailoring' && !targetRole.trim()) {
      setError('Enter the target role for role-tailored assistance.');
      return;
    }

    try {
      setBusy('request');
      setError('');
      setMessage('');
      setSuggestion(null);
      const result = await requestAiCvEnhancement({ action, targetRole, instruction });
      setSuggestion(result);
      setMessage('The private suggestion is ready for your review. Nothing has been changed yet.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to generate the CV suggestion.');
    } finally {
      setBusy('');
    }
  };

  const applySuggestion = async () => {
    if (!document || !suggestion) return;
    try {
      setBusy('apply');
      setError('');
      setMessage('');
      const saved = await applyAiCvEnhancement(document, suggestion);
      setDocument(saved);
      setSuggestion(null);
      setMessage('The reviewed AI suggestion has been applied to your private CV.');
      window.dispatchEvent(new CustomEvent('agilecert-cv-document-refresh'));
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : 'Unable to apply the CV suggestion.');
    } finally {
      setBusy('');
    }
  };

  if (!isCandidate) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 left-4 z-[70] inline-flex items-center gap-2 rounded-full bg-violet-700 px-4 py-3 text-sm font-black text-white shadow-xl transition hover:bg-violet-800"
        aria-label="Open AI CV Studio"
      >
        <Sparkles className="h-5 w-5" /> AI CV Studio
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-950/65 p-3 backdrop-blur-sm md:p-6">
          <section className="mx-auto min-h-full max-w-5xl rounded-3xl bg-slate-50 shadow-2xl">
            <header className="flex items-start justify-between gap-4 rounded-t-3xl bg-slate-950 px-5 py-5 text-white md:px-7">
              <div className="flex gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-600">
                  <WandSparkles className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-300">Phase 7</p>
                  <h2 className="text-xl font-black md:text-2xl">Private AI CV Studio</h2>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-300">
                    Generate fact-grounded CV suggestions, review every change and decide what to apply.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-xl border border-slate-700 p-2 text-slate-300 hover:bg-slate-800 hover:text-white"
                aria-label="Close AI CV Studio"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="space-y-5 p-5 md:p-7">
              {error && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                  {error}
                </div>
              )}
              {message && (
                <div className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> {message}
                </div>
              )}

              {loading ? (
                <div className="flex min-h-56 items-center justify-center gap-3 text-sm font-bold text-slate-500">
                  <Loader2 className="h-6 w-6 animate-spin text-violet-600" /> Loading your private CV...
                </div>
              ) : !document ? (
                <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
                  <div className="flex items-start gap-3">
                    <FileText className="mt-1 h-6 w-6 shrink-0" />
                    <div>
                      <h3 className="font-black">A saved CV is required</h3>
                      <p className="mt-1 text-sm leading-6">
                        Open the candidate CV Builder, complete the relevant facts and save the private document. The AI Studio never invents missing career facts.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <section className="rounded-3xl border border-violet-200 bg-violet-50 p-5">
                    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                      <div className="flex items-start gap-3">
                        <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-violet-700" />
                        <div>
                          <h3 className="font-black text-violet-950">Explicit AI processing consent</h3>
                          <p className="mt-1 max-w-2xl text-sm leading-6 text-violet-800">
                            Contact details, identity evidence, payment records and examination data are excluded. Request audits retain metadata only, not raw CV content.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={busy === 'consent'}
                        onClick={() => void updateConsent(!document.ai_processing_consent)}
                        className={`rounded-xl px-4 py-3 text-sm font-black transition disabled:opacity-60 ${
                          document.ai_processing_consent
                            ? 'border border-violet-300 bg-white text-violet-800 hover:bg-violet-100'
                            : 'bg-violet-700 text-white hover:bg-violet-800'
                        }`}
                      >
                        {busy === 'consent'
                          ? 'Updating...'
                          : document.ai_processing_consent
                            ? 'Withdraw consent'
                            : 'Enable AI assistance'}
                      </button>
                    </div>
                  </section>

                  <section className="grid gap-4 md:grid-cols-2">
                    {actionOptions.map((option) => (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => setAction(option.key)}
                        className={`rounded-2xl border p-4 text-left transition ${
                          action === option.key
                            ? 'border-violet-500 bg-violet-50 ring-4 ring-violet-100'
                            : 'border-slate-200 bg-white hover:border-violet-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 font-black text-slate-900">
                          {option.key === 'role_tailoring' ? (
                            <Target className="h-5 w-5 text-violet-600" />
                          ) : (
                            <Sparkles className="h-5 w-5 text-violet-600" />
                          )}
                          {option.title}
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{option.description}</p>
                      </button>
                    ))}
                  </section>

                  <section className="rounded-3xl border border-slate-200 bg-white p-5">
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="text-xs font-black uppercase tracking-wider text-slate-500">
                        Target role
                        <input
                          value={targetRole}
                          onChange={(event) => setTargetRole(event.target.value)}
                          className="mt-2 w-full rounded-xl border border-slate-300 px-3.5 py-3 text-sm normal-case tracking-normal outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                          placeholder="Senior Project Manager"
                        />
                      </label>
                      <label className="text-xs font-black uppercase tracking-wider text-slate-500">
                        Optional instruction
                        <input
                          value={instruction}
                          onChange={(event) => setInstruction(event.target.value)}
                          className="mt-2 w-full rounded-xl border border-slate-300 px-3.5 py-3 text-sm normal-case tracking-normal outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                          placeholder="Emphasise leadership and public-sector transformation"
                        />
                      </label>
                    </div>
                    <button
                      type="button"
                      disabled={busy === 'request' || !document.ai_processing_consent}
                      onClick={() => void requestSuggestion()}
                      className="mt-4 inline-flex items-center gap-2 rounded-xl bg-violet-700 px-5 py-3 text-sm font-black text-white transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busy === 'request' ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
                      Generate private suggestion
                    </button>
                  </section>

                  {suggestion && (
                    <section className="space-y-4 rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
                      <div className="flex items-start gap-3">
                        <Lightbulb className="mt-0.5 h-6 w-6 shrink-0 text-emerald-700" />
                        <div>
                          <h3 className="font-black text-emerald-950">Review before applying</h3>
                          <p className="mt-1 text-sm leading-6 text-emerald-800">{suggestion.rationale}</p>
                          <p className="mt-2 text-xs font-bold uppercase tracking-wider text-emerald-700">
                            Suggested: {previewItems.join(', ') || 'wording refinements'} · {suggestion.remainingRequests} of {suggestion.hourlyLimit} requests remaining this hour
                          </p>
                        </div>
                      </div>

                      {suggestion.professionalSummary && (
                        <div className="rounded-2xl bg-white p-4">
                          <p className="text-xs font-black uppercase tracking-wider text-slate-500">Suggested professional summary</p>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-800">{suggestion.professionalSummary}</p>
                        </div>
                      )}

                      {suggestion.skills.length > 0 && (
                        <div className="rounded-2xl bg-white p-4">
                          <p className="text-xs font-black uppercase tracking-wider text-slate-500">Suggested skills</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {suggestion.skills.map((skill) => (
                              <span key={skill} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{skill}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {suggestion.cautions.length > 0 && (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                          <p className="font-black">Verify before use</p>
                          <ul className="mt-2 list-disc space-y-1 pl-5">
                            {suggestion.cautions.map((caution) => <li key={caution}>{caution}</li>)}
                          </ul>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          disabled={busy === 'apply'}
                          onClick={() => void applySuggestion()}
                          className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-black text-white hover:bg-emerald-800 disabled:opacity-60"
                        >
                          {busy === 'apply' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                          Apply reviewed suggestion
                        </button>
                        <button
                          type="button"
                          onClick={() => setSuggestion(null)}
                          className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-black text-slate-700 hover:bg-slate-50"
                        >
                          Discard suggestion
                        </button>
                      </div>
                    </section>
                  )}
                </>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

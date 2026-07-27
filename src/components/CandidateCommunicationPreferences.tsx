import { useEffect, useState } from 'react';
import { BellRing, CheckCircle2, Loader2, Mail, ShieldCheck, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getCurrentPortalUser } from '../services/authService';
import {
  getMyCommunicationPreferences,
  updateMyCommunicationPreferences,
  type CommunicationPreferences,
} from '../services/communicationsService';

export default function CandidateCommunicationPreferences() {
  const [isCandidate, setIsCandidate] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [preferences, setPreferences] = useState<CommunicationPreferences | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const refreshAuthorisation = async () => {
    try {
      const current = await getCurrentPortalUser();
      const allowed = current?.profile.role === 'candidate';
      setIsCandidate(allowed);
      if (!allowed) setIsOpen(false);
    } catch {
      setIsCandidate(false);
      setIsOpen(false);
    }
  };

  const loadPreferences = async () => {
    try {
      setLoading(true);
      setError('');
      setPreferences(await getMyCommunicationPreferences());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load email preferences.');
    } finally {
      setLoading(false);
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
    if (isOpen && isCandidate) void loadPreferences();
  }, [isOpen, isCandidate]);

  const save = async () => {
    if (!preferences) return;
    try {
      setSaving(true);
      setError('');
      setMessage('');
      const next = await updateMyCommunicationPreferences({
        certificateReminders: preferences.certificateReminders,
        courseRecommendations: preferences.courseRecommendations,
      });
      setPreferences(next);
      setMessage('Your optional email preferences have been updated.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save email preferences.');
    } finally {
      setSaving(false);
    }
  };

  if (!isCandidate) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 left-4 z-[69] inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 shadow-xl transition hover:border-emerald-300 hover:text-emerald-800"
        aria-label="Open email preferences"
      >
        <Mail className="h-5 w-5" /> Email Preferences
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[110] grid place-items-center overflow-y-auto bg-slate-950/65 p-4 backdrop-blur-sm">
          <section className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl">
            <header className="flex items-start justify-between gap-4 rounded-t-3xl bg-slate-950 px-5 py-5 text-white md:px-7">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600">
                  <BellRing className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">Communication centre</p>
                  <h2 className="text-xl font-black">Manage optional emails</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-300">
                    Control certificate reminders and post-purchase learning recommendations.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-xl border border-slate-700 p-2 text-slate-300 hover:bg-slate-800 hover:text-white"
                aria-label="Close email preferences"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="space-y-5 p-5 md:p-7">
              {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}
              {message && (
                <div className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> {message}
                </div>
              )}

              {loading || !preferences ? (
                <div className="flex min-h-40 items-center justify-center gap-3 text-sm font-bold text-slate-500">
                  <Loader2 className="h-5 w-5 animate-spin text-emerald-600" /> Loading preferences...
                </div>
              ) : (
                <>
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <label className="flex cursor-pointer items-start justify-between gap-4">
                      <div>
                        <p className="font-black text-slate-900">Certificate offer reminders</p>
                        <p className="mt-1 text-sm leading-6 text-slate-600">
                          Receive the immediate, day 2, day 5 and final day 7 reminders while a passed examination certificate remains unpurchased.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={preferences.certificateReminders}
                        onChange={(event) => setPreferences({ ...preferences, certificateReminders: event.target.checked })}
                        className="mt-1 h-5 w-5 accent-emerald-600"
                      />
                    </label>
                  </div>

                  <div className="rounded-2xl border border-slate-200 p-4">
                    <label className="flex cursor-pointer items-start justify-between gap-4">
                      <div>
                        <p className="font-black text-slate-900">Relevant-course recommendations</p>
                        <p className="mt-1 text-sm leading-6 text-slate-600">
                          Receive occasional recommendations from the published AgileCert catalogue after a credential is issued.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={preferences.courseRecommendations}
                        onChange={(event) => setPreferences({ ...preferences, courseRecommendations: event.target.checked })}
                        className="mt-1 h-5 w-5 accent-emerald-600"
                      />
                    </label>
                  </div>

                  <div className="flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-blue-900">
                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
                    <p className="text-sm leading-6">
                      Operational messages about verified examination access, payment confirmation and issued credentials remain enabled so paid or authorised services can be delivered. Hard bounces and complaints suppress all further delivery automatically.
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void save()}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-black text-white hover:bg-emerald-800 disabled:opacity-60"
                  >
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    Save email preferences
                  </button>
                </>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

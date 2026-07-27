import { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Loader2, MailCheck, RefreshCw, Settings2, ShieldCheck, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getCurrentPortalUser } from '../services/authService';
import {
  getCommunicationsAdminConsole,
  updateCommunicationSettings,
  type CommunicationsAdminConsole,
} from '../services/communicationsService';

export default function AdminCommunicationsLauncher() {
  const [role, setRole] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [consoleData, setConsoleData] = useState<CommunicationsAdminConsole | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [fromName, setFromName] = useState('AgileCert Global');
  const [fromEmail, setFromEmail] = useState('');
  const [replyToEmail, setReplyToEmail] = useState('');
  const [providerEnabled, setProviderEnabled] = useState(false);
  const [hourlyBatchSize, setHourlyBatchSize] = useState(40);
  const [maxAttempts, setMaxAttempts] = useState(5);

  const authorised = role === 'exam_admin' || role === 'super_admin';
  const isSuperAdmin = role === 'super_admin';

  const refreshAuthorisation = async () => {
    try {
      const current = await getCurrentPortalUser();
      setRole(current?.profile.role || '');
    } catch {
      setRole('');
      setIsOpen(false);
    }
  };

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getCommunicationsAdminConsole();
      setConsoleData(data);
      setFromName(data.settings.from_name || 'AgileCert Global');
      setFromEmail(data.settings.from_email || '');
      setReplyToEmail(data.settings.reply_to_email || '');
      setProviderEnabled(Boolean(data.settings.provider_enabled));
      setHourlyBatchSize(Number(data.settings.hourly_batch_size || 40));
      setMaxAttempts(Number(data.settings.max_attempts || 5));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load communications console.');
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
    if (isOpen && authorised) void load();
  }, [isOpen, authorised]);

  const saveSettings = async () => {
    try {
      setSaving(true);
      setError('');
      setMessage('');
      const data = await updateCommunicationSettings({
        providerEnabled,
        fromName,
        fromEmail,
        replyToEmail,
        hourlyBatchSize,
        maxAttempts,
      });
      setConsoleData(data);
      setProviderEnabled(Boolean(data.settings.provider_enabled));
      setMessage(data.settings.provider_enabled
        ? 'Communications delivery settings have been updated.'
        : 'Delivery settings have been saved. Provider activation remains controlled by the credential-gated release workflow.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to update communications settings.');
    } finally {
      setSaving(false);
    }
  };

  const statusRows = useMemo(() => {
    if (!consoleData) return [];
    return [
      ['Queued', consoleData.counts.queued],
      ['Processing', consoleData.counts.processing],
      ['Sent', consoleData.counts.sent],
      ['Failed', consoleData.counts.failed],
      ['Suppressed', consoleData.counts.suppressed],
      ['Cancelled', consoleData.counts.cancelled],
    ];
  }, [consoleData]);

  if (!authorised) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-52 right-4 z-[68] inline-flex items-center gap-2 rounded-full bg-cyan-700 px-4 py-3 text-sm font-black text-white shadow-xl hover:bg-cyan-800"
        aria-label="Open communications administration"
      >
        <MailCheck className="h-5 w-5" /> Communications
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[115] overflow-y-auto bg-slate-950/70 p-3 backdrop-blur-sm md:p-6">
          <section className="mx-auto min-h-full max-w-6xl rounded-3xl bg-slate-50 shadow-2xl">
            <header className="flex items-start justify-between gap-4 rounded-t-3xl bg-slate-950 px-5 py-5 text-white md:px-7">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">Administrator console</p>
                <h2 className="text-xl font-black md:text-2xl">Communications Automation</h2>
                <p className="mt-1 text-sm leading-6 text-slate-300">
                  Queue health, suppression, delivery evidence and controlled provider activation.
                </p>
              </div>
              <button type="button" onClick={() => setIsOpen(false)} className="rounded-xl border border-slate-700 p-2 text-slate-300 hover:bg-slate-800 hover:text-white" aria-label="Close communications console">
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="space-y-5 p-5 md:p-7">
              {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}
              {message && <div className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800"><CheckCircle2 className="mt-0.5 h-4 w-4" />{message}</div>}

              <div className="flex justify-end">
                <button type="button" disabled={loading} onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-100 disabled:opacity-60">
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
                </button>
              </div>

              {loading || !consoleData ? (
                <div className="flex min-h-60 items-center justify-center gap-3 text-sm font-bold text-slate-500"><Loader2 className="h-6 w-6 animate-spin text-cyan-600" /> Loading communications data...</div>
              ) : (
                <>
                  <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                    {statusRows.map(([label, count]) => (
                      <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</p>
                        <p className="mt-2 text-2xl font-black text-slate-950">{Number(count).toLocaleString()}</p>
                      </div>
                    ))}
                  </section>

                  <section className={`rounded-3xl border p-5 ${providerEnabled ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
                    <div className="flex items-start gap-3">
                      {providerEnabled ? <Activity className="mt-0.5 h-6 w-6 text-emerald-700" /> : <AlertTriangle className="mt-0.5 h-6 w-6 text-amber-700" />}
                      <div>
                        <h3 className="font-black">Provider delivery is {providerEnabled ? 'enabled' : 'disabled'}</h3>
                        <p className="mt-1 text-sm leading-6">
                          Queue derivation remains safe when delivery is disabled. Enabling requires verified Resend credentials, a signed webhook and the controlled production activation workflow.
                        </p>
                        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                          <div><dt className="font-black text-slate-600">Verified sender domain</dt><dd>{consoleData.settings.verified_sender_domain || 'Not activated'}</dd></div>
                          <div><dt className="font-black text-slate-600">Delivery cutover</dt><dd>{consoleData.settings.delivery_cutover_at ? new Date(consoleData.settings.delivery_cutover_at).toLocaleString() : 'Not established'}</dd></div>
                        </dl>
                      </div>
                    </div>
                  </section>

                  {isSuperAdmin && (
                    <section className="rounded-3xl border border-slate-200 bg-white p-5">
                      <div className="flex items-center gap-2"><Settings2 className="h-5 w-5 text-cyan-700" /><h3 className="font-black">Delivery settings</h3></div>
                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <label className="text-xs font-black uppercase tracking-wider text-slate-500">Sender name<input value={fromName} onChange={(event) => setFromName(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3.5 py-3 text-sm normal-case tracking-normal" /></label>
                        <label className="text-xs font-black uppercase tracking-wider text-slate-500">Verified sender email<input type="email" value={fromEmail} onChange={(event) => setFromEmail(event.target.value)} placeholder="notifications@example.org" className="mt-2 w-full rounded-xl border border-slate-300 px-3.5 py-3 text-sm normal-case tracking-normal" /></label>
                        <label className="text-xs font-black uppercase tracking-wider text-slate-500">Reply-to email<input type="email" value={replyToEmail} onChange={(event) => setReplyToEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3.5 py-3 text-sm normal-case tracking-normal" /></label>
                        <div className="grid grid-cols-2 gap-3">
                          <label className="text-xs font-black uppercase tracking-wider text-slate-500">Batch size<input type="number" min={1} max={100} value={hourlyBatchSize} onChange={(event) => setHourlyBatchSize(Number(event.target.value))} className="mt-2 w-full rounded-xl border border-slate-300 px-3.5 py-3 text-sm normal-case tracking-normal" /></label>
                          <label className="text-xs font-black uppercase tracking-wider text-slate-500">Max attempts<input type="number" min={1} max={12} value={maxAttempts} onChange={(event) => setMaxAttempts(Number(event.target.value))} className="mt-2 w-full rounded-xl border border-slate-300 px-3.5 py-3 text-sm normal-case tracking-normal" /></label>
                        </div>
                      </div>
                      <div className="mt-4 flex items-start gap-3 rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
                        <ShieldCheck className="mt-0.5 h-5 w-5 text-cyan-700" />
                        <div><strong>Controlled activation</strong><span className="mt-1 block text-sm leading-6 text-slate-600">The portal cannot activate a disabled provider. Use the production workflow after credentials, sender-domain verification, signed webhook and cutover review are complete.</span></div>
                      </div>
                      {providerEnabled && (
                        <label className="mt-4 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4"><input type="checkbox" checked={providerEnabled} onChange={(event) => setProviderEnabled(event.target.checked)} className="mt-1 h-5 w-5 accent-rose-700" /><span><strong>Keep provider delivery enabled</strong><span className="mt-1 block text-sm leading-6 text-slate-600">Clear this checkbox and save to disable delivery immediately. Re-enabling requires the controlled workflow.</span></span></label>
                      )}
                      <button type="button" disabled={saving} onClick={() => void saveSettings()} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-cyan-700 px-5 py-3 text-sm font-black text-white hover:bg-cyan-800 disabled:opacity-60">{saving && <Loader2 className="h-4 w-4 animate-spin" />}Save delivery settings</button>
                    </section>
                  )}

                  <section className="rounded-3xl border border-slate-200 bg-white p-5">
                    <h3 className="font-black">Recent outbox</h3>
                    <div className="mt-4 overflow-x-auto">
                      <table className="min-w-full text-left text-sm">
                        <thead><tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500"><th className="px-3 py-2">Type</th><th className="px-3 py-2">Category</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Attempts</th><th className="px-3 py-2">Due</th></tr></thead>
                        <tbody>{consoleData.recentOutbox.slice(0, 30).map((row) => <tr key={row.id} className="border-b border-slate-100"><td className="px-3 py-3 font-bold">{String(row.message_type || '')}</td><td className="px-3 py-3">{String(row.category || '')}</td><td className="px-3 py-3">{String(row.status || '')}</td><td className="px-3 py-3">{Number(row.attempts || 0)}</td><td className="px-3 py-3 whitespace-nowrap">{row.due_at ? new Date(row.due_at).toLocaleString() : '—'}</td></tr>)}</tbody>
                      </table>
                    </div>
                  </section>
                </>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  MailPlus,
  Loader2,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getCurrentPortalUser, type PortalRole } from '../services/authService';
import {
  getPeopleDirectory,
  invitePortalAccount,
  queueAdminMessage,
  updatePortalPerson,
  type PeopleDirectoryRecord,
} from '../services/peopleAdminService';

type WorkspaceTab = 'people' | 'invite' | 'message';

const roleLabel: Record<PortalRole, string> = {
  candidate: 'Candidate',
  auditor: 'Auditor',
  exam_admin: 'Exam Administrator',
  super_admin: 'Super Administrator',
};

const statusClass = (active: boolean) => active
  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
  : 'border-rose-200 bg-rose-50 text-rose-700';

export default function AdminPeopleMessagingLauncher() {
  const [role, setRole] = useState<PortalRole | ''>('');
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<WorkspaceTab>('people');
  const [records, setRecords] = useState<PeopleDirectoryRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | PortalRole>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [profileFilter, setProfileFilter] = useState<'all' | 'complete' | 'incomplete' | 'staff'>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Exclude<PortalRole, 'super_admin'>>('candidate');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<'operational' | 'marketing'>('operational');
  const [groupLabel, setGroupLabel] = useState('Selected recipients');

  const authorised = role === 'exam_admin' || role === 'super_admin';
  const isSuperAdmin = role === 'super_admin';

  const refreshAuthorisation = async () => {
    try {
      const current = await getCurrentPortalUser();
      setRole(current?.profile.role || '');
    } catch {
      setRole('');
      setOpen(false);
    }
  };

  const loadDirectory = async () => {
    try {
      setLoading(true);
      setError('');
      const result = await getPeopleDirectory({
        search,
        role: roleFilter,
        status: statusFilter,
        profileState: profileFilter,
        limit: 500,
      });
      setRecords(result.records);
      setTotal(result.total);
      setSelectedIds((current) => current.filter((id) => result.records.some((record) => record.id === id)));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load the people directory.');
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
    if (open && authorised) void loadDirectory();
  }, [open, authorised]);

  const selectedRecords = useMemo(
    () => records.filter((record) => selectedIds.includes(record.id)),
    [records, selectedIds],
  );

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => current.includes(id)
      ? current.filter((value) => value !== id)
      : [...current, id]);
  };

  const selectGroup = (label: string, predicate: (record: PeopleDirectoryRecord) => boolean) => {
    const ids = records.filter(predicate).map((record) => record.id);
    setSelectedIds(ids);
    setGroupLabel(label);
    setTab('message');
  };

  const submitInvite = async (event: FormEvent) => {
    event.preventDefault();
    try {
      setBusy('invite');
      setError('');
      setMessage('');
      const result = await invitePortalAccount({ fullName: inviteName, email: inviteEmail, role: inviteRole });
      setMessage(`Invitation created for ${String(result.email || inviteEmail)} as ${roleLabel[inviteRole]}.`);
      setInviteName('');
      setInviteEmail('');
      setInviteRole('candidate');
      await loadDirectory();
      setTab('people');
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : 'Unable to create the invitation.');
    } finally {
      setBusy('');
    }
  };

  const toggleAccount = async (record: PeopleDirectoryRecord) => {
    try {
      setBusy(`status:${record.id}`);
      setError('');
      setMessage('');
      await updatePortalPerson({ userId: record.id, isActive: !record.isActive });
      setMessage(`${record.fullName} has been ${record.isActive ? 'suspended' : 'activated'}.`);
      await loadDirectory();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to update the account.');
    } finally {
      setBusy('');
    }
  };

  const requireProfileUpdate = async (record: PeopleDirectoryRecord) => {
    try {
      setBusy(`profile:${record.id}`);
      setError('');
      setMessage('');
      await updatePortalPerson({ userId: record.id, requireProfileUpdate: true });
      setMessage(`${record.fullName} must complete the profile gate on the next login.`);
      await loadDirectory();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to require a profile update.');
    } finally {
      setBusy('');
    }
  };

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    try {
      setBusy('send');
      setError('');
      setMessage('');
      if (!selectedIds.length) throw new Error('Select at least one recipient.');
      const result = await queueAdminMessage({
        recipientIds: selectedIds,
        subject,
        body,
        category,
        groupLabel,
      });
      setMessage(`${result.queued} email${result.queued === 1 ? '' : 's'} queued${result.skipped ? `; ${result.skipped} skipped by consent controls` : ''}.`);
      setSubject('');
      setBody('');
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Unable to queue the message.');
    } finally {
      setBusy('');
    }
  };

  if (!authorised) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-64 right-4 z-[68] inline-flex items-center gap-2 rounded-full bg-violet-700 px-4 py-3 text-sm font-black text-white shadow-xl hover:bg-violet-800"
        aria-label="Open people and messaging administration"
      >
        <Users className="h-5 w-5" /> People & Messaging
      </button>

      {open && (
        <div className="fixed inset-0 z-[190] overflow-y-auto bg-slate-950/75 p-3 backdrop-blur-sm md:p-6">
          <section className="mx-auto min-h-full max-w-7xl overflow-hidden rounded-3xl bg-slate-50 shadow-2xl">
            <header className="flex items-start justify-between gap-4 bg-slate-950 px-5 py-5 text-white md:px-7">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-300">Administrator people operations</p>
                <h2 className="mt-1 text-xl font-black md:text-2xl">People Directory & Messaging</h2>
                <p className="mt-1 text-sm leading-6 text-slate-300">Manage portal people, profile readiness and auditable communications.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-slate-700 p-2 text-slate-300 hover:bg-slate-800" aria-label="Close people administration">
                <X className="h-5 w-5" />
              </button>
            </header>

            <nav className="flex flex-wrap gap-2 border-b border-slate-200 bg-white px-5 py-3 md:px-7">
              {([
                ['people', 'People Directory', Users],
                ['invite', 'Add / Invite', UserPlus],
                ['message', `Email (${selectedIds.length})`, MailPlus],
              ] as const).map(([value, label, Icon]) => (
                <button key={value} type="button" onClick={() => setTab(value)} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black ${tab === value ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  <Icon className="h-4 w-4" /> {label}
                </button>
              ))}
            </nav>

            <div className="space-y-5 p-5 md:p-7">
              {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}
              {message && <div className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800"><CheckCircle2 className="mt-0.5 h-4 w-4" />{message}</div>}

              {tab === 'people' && (
                <>
                  <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto_auto_auto]">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void loadDirectory(); }} placeholder="Search name, email or candidate code" className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-violet-500" />
                    </div>
                    <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as typeof roleFilter)} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm">
                      <option value="all">All roles</option><option value="candidate">Candidates</option><option value="auditor">Auditors</option><option value="exam_admin">Exam Admins</option><option value="super_admin">Super Admins</option>
                    </select>
                    <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm">
                      <option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option>
                    </select>
                    <select value={profileFilter} onChange={(event) => setProfileFilter(event.target.value as typeof profileFilter)} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm">
                      <option value="all">All profiles</option><option value="complete">Complete profiles</option><option value="incomplete">Incomplete profiles</option><option value="staff">Staff</option>
                    </select>
                    <button type="button" onClick={() => void loadDirectory()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-xs font-black text-white hover:bg-violet-800"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh</button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => selectGroup('All active candidates', (record) => record.role === 'candidate' && record.isActive)} className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold">All candidates</button>
                    <button type="button" onClick={() => selectGroup('Incomplete candidate profiles', (record) => record.role === 'candidate' && !record.onboardingComplete)} className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800">Incomplete profiles</button>
                    <button type="button" onClick={() => selectGroup('All active administrators', (record) => record.role !== 'candidate' && record.isActive)} className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold">All administrators</button>
                    <button type="button" onClick={() => selectGroup('CIPMN candidates', (record) => record.role === 'candidate' && record.programmeCodes.some((code) => code.toUpperCase().includes('CIPMN')))} className="rounded-full border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-800">CIPMN candidates</button>
                    <button type="button" onClick={() => { setSelectedIds(records.map((record) => record.id)); setGroupLabel('Current filtered directory'); }} className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold">Select current results</button>
                    <button type="button" onClick={() => setSelectedIds([])} className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold">Clear selection</button>
                  </div>

                  <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                    <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                      <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500">
                        <tr><th className="px-4 py-3">Select</th><th className="px-4 py-3">Person</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Profile</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Last sign-in</th><th className="px-4 py-3">Actions</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {records.map((record) => (
                          <tr key={record.id} className="align-top">
                            <td className="px-4 py-4"><input type="checkbox" checked={selectedIds.includes(record.id)} onChange={() => toggleSelected(record.id)} className="h-4 w-4 accent-violet-700" /></td>
                            <td className="px-4 py-4"><p className="font-black text-slate-900">{record.fullName}</p><p className="mt-1 text-xs text-slate-500">{record.email}</p><p className="mt-1 text-[10px] text-slate-400">{record.phone || 'No phone'} {record.candidateCode ? `· ${record.candidateCode}` : ''}</p></td>
                            <td className="px-4 py-4 text-xs font-bold text-slate-700">{roleLabel[record.role]}</td>
                            <td className="px-4 py-4"><span className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${record.role !== 'candidate' || record.onboardingComplete ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>{record.role !== 'candidate' ? 'Staff profile' : record.onboardingComplete ? 'Complete' : 'Required'}</span><p className="mt-2 max-w-40 text-[10px] text-slate-400">{record.programmeCodes.join(', ') || 'No programme activity'}</p></td>
                            <td className="px-4 py-4"><span className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${statusClass(record.isActive)}`}>{record.isActive ? 'Active' : 'Suspended'}</span></td>
                            <td className="px-4 py-4 text-xs text-slate-500">{record.lastSignInAt ? new Date(record.lastSignInAt).toLocaleString() : 'Never'}</td>
                            <td className="px-4 py-4"><div className="flex flex-col gap-2">{isSuperAdmin && <button type="button" disabled={busy === `status:${record.id}`} onClick={() => void toggleAccount(record)} className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-[10px] font-black hover:bg-slate-50">{record.isActive ? 'Suspend' : 'Activate'}</button>}{isSuperAdmin && record.role === 'candidate' && <button type="button" disabled={busy === `profile:${record.id}`} onClick={() => void requireProfileUpdate(record)} className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-[10px] font-black text-amber-800">Require update</button>}<button type="button" onClick={() => { setSelectedIds([record.id]); setGroupLabel(`Individual: ${record.fullName}`); setTab('message'); }} className="rounded-lg border border-violet-300 bg-violet-50 px-2.5 py-1.5 text-[10px] font-black text-violet-800">Email</button></div></td>
                          </tr>
                        ))}
                        {!loading && !records.length && <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">No people match the selected filters.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-slate-500">Showing {records.length} of {total} record{total === 1 ? '' : 's'}.</p>
                </>
              )}

              {tab === 'invite' && (
                <form onSubmit={submitInvite} className="mx-auto max-w-2xl space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
                  <div><h3 className="text-lg font-black text-slate-900">Add a portal person</h3><p className="mt-1 text-sm leading-6 text-slate-500">The person receives a secure Supabase invitation. Passwords are never created or displayed by administrators.</p></div>
                  {!isSuperAdmin && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">Only a Super Administrator may create portal accounts.</div>}
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-500">Full name<input required value={inviteName} onChange={(event) => setInviteName(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3.5 py-3 text-sm" /></label>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-500">Email address<input required type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3.5 py-3 text-sm" /></label>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-500">Portal role<select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as typeof inviteRole)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm"><option value="candidate">Candidate</option><option value="auditor">Auditor</option><option value="exam_admin">Exam Administrator</option></select></label>
                  <button disabled={!isSuperAdmin || busy === 'invite'} className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-700 px-5 py-3 text-sm font-black text-white disabled:opacity-50">{busy === 'invite' ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Send secure invitation</button>
                </form>
              )}

              {tab === 'message' && (
                <form onSubmit={sendMessage} className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
                  <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h3 className="font-black text-slate-900">Recipients</h3><p className="mt-1 text-sm text-slate-500">{groupLabel}</p><p className="mt-4 text-4xl font-black text-violet-700">{selectedRecords.length}</p><p className="text-xs font-bold text-slate-500">selected people</p>
                    <div className="mt-4 max-h-72 space-y-2 overflow-y-auto">{selectedRecords.map((record) => <div key={record.id} className="rounded-xl border border-slate-200 p-3"><p className="text-xs font-black text-slate-900">{record.fullName}</p><p className="mt-1 text-[10px] text-slate-500">{record.email} · {roleLabel[record.role]}</p></div>)}</div>
                    <button type="button" onClick={() => setTab('people')} className="mt-4 w-full rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-black">Change recipients</button>
                  </aside>
                  <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
                    <div><h3 className="text-lg font-black text-slate-900">Compose email</h3><p className="mt-1 text-sm leading-6 text-slate-500">Messages enter the existing Resend queue with delivery evidence and administrator audit history.</p></div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-500">Message category<select value={category} onChange={(event) => setCategory(event.target.value as typeof category)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm"><option value="operational">Operational / service message</option><option value="marketing">Optional marketing message</option></select><span className="mt-1 block text-[11px] normal-case leading-5 tracking-normal text-slate-400">Marketing messages automatically skip candidates without the required consent.</span></label>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-500">Subject<input required minLength={3} maxLength={180} value={subject} onChange={(event) => setSubject(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3.5 py-3 text-sm" /></label>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-500">Message<textarea required minLength={10} maxLength={10000} rows={10} value={body} onChange={(event) => setBody(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3.5 py-3 text-sm leading-6" /></label>
                    <button disabled={!selectedIds.length || busy === 'send'} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-black text-white disabled:opacity-50">{busy === 'send' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Queue email to {selectedIds.length} recipient{selectedIds.length === 1 ? '' : 's'}</button>
                  </section>
                </form>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

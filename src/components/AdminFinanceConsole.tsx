import { useEffect, useMemo, useState } from 'react';
import {
  Award,
  BadgePercent,
  Banknote,
  BarChart3,
  CircleDollarSign,
  ClipboardCheck,
  KeyRound,
  Loader2,
  RefreshCw,
  Settings,
  ShieldCheck,
  WalletCards,
  X,
  type LucideIcon,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import FinanceCertificationFeesPanel from './FinanceCertificationFeesPanel';
import FinanceConsoleCompletionPanel, {
  type FinanceCompletionView,
} from './FinanceConsoleCompletionPanel';
import FinanceGovernancePanel from './FinanceGovernancePanel';
import {
  getFinanceConsoleSnapshot,
  getMyFinanceConsoleAccess,
  type FinanceConsoleAccess,
  type FinanceConsoleSnapshot,
} from '../services/financeConsoleService';
import {
  getFinanceCompletionSnapshot,
  setFinancePermission,
  type FinanceCompletionSnapshot,
} from '../services/financeConsoleCompletionService';

type ConsoleTab =
  | 'overview'
  | 'pricing'
  | 'certification'
  | 'coupons'
  | 'settings'
  | 'transactions'
  | 'dashboard'
  | 'governance'
  | 'permissions';

type TabDefinition = {
  id: ConsoleTab;
  label: string;
  icon: LucideIcon;
};

export default function AdminFinanceConsole() {
  const [access, setAccess] = useState<FinanceConsoleAccess | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ConsoleTab>('overview');
  const [core, setCore] = useState<FinanceConsoleSnapshot | null>(null);
  const [completion, setCompletion] = useState<FinanceCompletionSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [permissionReason, setPermissionReason] = useState('Approved finance responsibility update');

  const refreshAuthorisation = async () => {
    try {
      const next = await getMyFinanceConsoleAccess();
      setAccess(next);
      if (!next.canViewConsole) setIsOpen(false);
    } catch (authError) {
      console.error('Unable to initialise Finance Console access:', authError);
      setAccess(null);
      setIsOpen(false);
    }
  };

  useEffect(() => {
    void refreshAuthorisation();
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setAccess(null);
        setIsOpen(false);
        setCore(null);
        setCompletion(null);
      } else {
        window.setTimeout(() => void refreshAuthorisation(), 0);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError('');
      const [nextCore, nextCompletion] = await Promise.all([
        getFinanceConsoleSnapshot(500),
        getFinanceCompletionSnapshot({ limit: 750 }),
      ]);
      setCore(nextCore);
      setCompletion(nextCompletion);
      setAccess(nextCore.access);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load Finance Console data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) void loadData();
  }, [isOpen]);

  const tabs = useMemo<TabDefinition[]>(() => {
    if (!access) return [];
    const completionAccess = completion?.access;
    const permissions = access.permissions as string[];
    const available: TabDefinition[] = [
      { id: 'overview', label: 'Overview', icon: BarChart3 },
      { id: 'pricing', label: 'Examination Fees', icon: CircleDollarSign },
    ];
    if (access.canManageCertificatePrices || access.canViewConsole) {
      available.push({ id: 'certification', label: 'Certification Fees', icon: Award });
    }
    if (access.canManageCoupons || access.canViewConsole) {
      available.push({ id: 'coupons', label: 'Discount Codes', icon: BadgePercent });
    }
    if (completionAccess?.canManageSettings || completionAccess?.role === 'super_admin') {
      available.push({ id: 'settings', label: 'Finance Settings', icon: Settings });
    }
    available.push({ id: 'transactions', label: 'Transactions', icon: WalletCards });
    if (completionAccess?.canViewDashboard || completionAccess?.role === 'super_admin') {
      available.push({ id: 'dashboard', label: 'Revenue Dashboard', icon: BarChart3 });
    }
    if (access.role === 'super_admin' || permissions.includes('finance.governance.view')) {
      available.push({ id: 'governance', label: 'Operations & Governance', icon: ClipboardCheck });
    }
    if (access.canManagePermissions) {
      available.push({ id: 'permissions', label: 'Permissions', icon: KeyRound });
    }
    return available;
  }, [access, completion]);

  useEffect(() => {
    if (tabs.length && !tabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(tabs[0].id);
    }
  }, [tabs, activeTab]);

  const changePermission = async (permissionKey: string, name: string, isGranted: boolean) => {
    if (permissionReason.trim().length < 5) {
      setError('Enter a reason of at least five characters before changing finance permissions.');
      return;
    }
    if (!window.confirm(`${isGranted ? 'Revoke' : 'Grant'} “${name}” for Examination Administrators?`)) return;
    try {
      setIsLoading(true);
      setError('');
      await setFinancePermission({
        permissionKey,
        isGranted: !isGranted,
        reason: permissionReason,
      });
      setMessage(`${name} ${isGranted ? 'revoked' : 'granted'} for Examination Administrators.`);
      await loadData();
    } catch (permissionError) {
      setError(permissionError instanceof Error ? permissionError.message : 'Unable to change the permission.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!access?.canViewConsole) return null;

  const renderCompletion = (view: FinanceCompletionView) => {
    if (!core || !completion) return null;
    return (
      <FinanceConsoleCompletionPanel
        view={view}
        core={core}
        completion={completion}
        onRefresh={loadData}
        onMessage={setMessage}
        onError={setError}
      />
    );
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-5 left-5 z-50 flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-extrabold text-white shadow-2xl hover:bg-slate-800"
        aria-label="Open Finance Console"
      >
        <Banknote className="h-4 w-4 text-amber-400" /> Finance Console
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[90] overflow-y-auto bg-slate-950/80 p-3 backdrop-blur-sm md:p-6">
          <div className="mx-auto min-h-[calc(100vh-1.5rem)] max-w-[1500px] overflow-hidden rounded-2xl bg-slate-50 shadow-2xl md:min-h-[calc(100vh-3rem)]">
            <header className="sticky top-0 z-20 flex items-center justify-between gap-4 bg-slate-950 px-5 py-4 text-white">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-amber-400">
                  Protected Administrator Workspace
                </p>
                <h1 className="text-xl font-extrabold">Finance Console</h1>
                <p className="mt-1 text-xs text-slate-400">
                  Pricing, transactions, reconciliation, reporting, operations and governance
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void loadData()}
                  disabled={isLoading}
                  className="rounded-xl bg-slate-800 p-2 hover:bg-slate-700 disabled:opacity-50"
                  aria-label="Refresh Finance Console"
                >
                  <RefreshCw className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-xl bg-slate-800 p-2 hover:bg-slate-700"
                  aria-label="Close Finance Console"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </header>

            <div className="border-b border-slate-200 bg-white px-4 py-3">
              <div className="flex flex-wrap gap-2">
                {tabs.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveTab(id)}
                    className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-extrabold ${
                      activeTab === id
                        ? 'bg-slate-950 text-white'
                        : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="h-4 w-4" /> {label}
                  </button>
                ))}
              </div>
            </div>

            <main className="space-y-5 p-4 md:p-6">
              {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                  {error}
                </div>
              )}
              {message && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                  {message}
                </div>
              )}
              {isLoading && (!core || !completion) && (
                <div className="flex min-h-80 items-center justify-center gap-3 text-sm font-bold text-slate-500">
                  <Loader2 className="h-5 w-5 animate-spin" /> Loading Finance Console…
                </div>
              )}

              {core && completion && activeTab === 'overview' && renderCompletion('overview')}
              {core && completion && activeTab === 'pricing' && renderCompletion('pricing')}
              {core && completion && activeTab === 'coupons' && renderCompletion('coupons')}
              {core && completion && activeTab === 'settings' && renderCompletion('settings')}
              {core && completion && activeTab === 'transactions' && renderCompletion('transactions')}
              {core && completion && activeTab === 'dashboard' && renderCompletion('dashboard')}

              {core && activeTab === 'certification' && (
                <FinanceCertificationFeesPanel
                  snapshot={core}
                  onRefresh={loadData}
                  onMessage={setMessage}
                  onError={setError}
                />
              )}

              {activeTab === 'governance' && (
                <FinanceGovernancePanel onMessage={setMessage} onError={setError} />
              )}

              {core && activeTab === 'permissions' && access.canManagePermissions && (
                <section className="space-y-5">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5 text-violet-600" />
                      <h2 className="font-black text-slate-950">Examination Administrator finance permissions</h2>
                    </div>
                    <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-500">
                      Super Administrators retain all authority. High-impact settings, verification, recovery, adjustment, governance review, alert and reporting permissions are ungranted by default and require an audited reason.
                    </p>
                    <label className="mt-4 block text-xs font-bold text-slate-600">
                      Reason for permission changes
                      <input
                        value={permissionReason}
                        onChange={(event) => setPermissionReason(event.target.value)}
                        className="mt-1 w-full max-w-3xl rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                      />
                    </label>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {core.permissionMatrix.map((grant) => (
                      <div key={grant.permissionKey} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-black text-slate-950">{grant.name}</p>
                            <p className="mt-2 text-xs leading-5 text-slate-500">{grant.description}</p>
                          </div>
                          <span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${
                            grant.riskLevel === 'restricted'
                              ? 'bg-rose-100 text-rose-800'
                              : grant.riskLevel === 'sensitive'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-700'
                          }`}>
                            {grant.riskLevel}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => void changePermission(grant.permissionKey, grant.name, grant.isGranted)}
                          disabled={isLoading}
                          className={`mt-5 w-full rounded-xl px-4 py-3 text-sm font-black ${
                            grant.isGranted
                              ? 'border border-rose-200 bg-rose-50 text-rose-700'
                              : 'bg-emerald-600 text-white'
                          }`}
                        >
                          {grant.isGranted ? 'Revoke permission' : 'Grant permission'}
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </main>
          </div>
        </div>
      )}
    </>
  );
}

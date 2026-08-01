import { type FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BellRing,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  FileClock,
  Loader2,
  MessageSquareText,
  PlayCircle,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
  UserCheck,
  XCircle,
} from 'lucide-react';
import {
  addFinanceCaseNote,
  assignFinanceCase,
  cancelFinanceCase,
  createFinanceOperationCase,
  decideFinanceCase,
  executeFinanceCase,
  getFinanceGovernanceSnapshot,
  processDueFinanceReports,
  saveFinanceReportSchedule,
  scanFinanceAlerts,
  updateFinanceAlertRule,
  updateFinanceAlertStatus,
  type FinanceAlertRule,
  type FinanceAlertSeverity,
  type FinanceGovernanceSnapshot,
  type FinanceOperationCase,
  type FinanceReportCadence,
  type FinanceReportType,
} from '../services/financeGovernanceService';

type Workspace = 'cases' | 'alerts' | 'reports';

type Props = {
  onMessage: (message: string) => void;
  onError: (message: string) => void;
};

const caseTypeOptions = [
  ['reconciliation', 'Payment reconciliation'],
  ['manual_payment', 'Manual payment approval'],
  ['access_recovery', 'Paid-access recovery'],
  ['refund', 'Refund review'],
  ['reversal', 'Payment reversal'],
  ['adjustment', 'Finance adjustment'],
  ['exception', 'Other finance exception'],
] as const;

const reportTypeOptions: Array<[FinanceReportType, string]> = [
  ['revenue_summary', 'Revenue summary'],
  ['transaction_exceptions', 'Transaction exceptions'],
  ['coupon_performance', 'Coupon performance'],
  ['reconciliation_backlog', 'Reconciliation backlog'],
  ['governance_cases', 'Governance cases'],
];

const statusTone = (status: string): string => {
  if (['approved', 'executed', 'resolved', 'queued'].includes(status)) return 'bg-emerald-100 text-emerald-800';
  if (['rejected', 'cancelled', 'failed', 'suppressed'].includes(status)) return 'bg-rose-100 text-rose-800';
  if (['in_review', 'acknowledged', 'partial'].includes(status)) return 'bg-blue-100 text-blue-800';
  return 'bg-amber-100 text-amber-800';
};

const severityTone = (severity: string): string => {
  if (severity === 'critical') return 'bg-rose-700 text-white';
  if (severity === 'high') return 'bg-orange-100 text-orange-800';
  if (severity === 'medium') return 'bg-amber-100 text-amber-800';
  return 'bg-slate-100 text-slate-700';
};

const formatDate = (value?: string | null): string => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const caseTypeLabel = (value: string): string =>
  caseTypeOptions.find(([key]) => key === value)?.[1] || value.replaceAll('_', ' ');

const blankCase = {
  caseType: 'reconciliation' as const,
  title: '',
  description: '',
  priority: 'normal' as const,
  orderType: '' as '' | 'exam' | 'bulk' | 'certificate' | 'other',
  orderId: '',
  reference: '',
  candidateId: '',
  currency: 'NGN',
  amount: '',
};

const blankSchedule = {
  scheduleId: '',
  name: '',
  reportType: 'revenue_summary' as FinanceReportType,
  cadence: 'weekly' as FinanceReportCadence,
  dayOfWeek: '1',
  dayOfMonth: '1',
  runTime: '08:00',
  timezone: 'Africa/Lagos',
  recipientIds: [] as string[],
  subject: 'AgileCert Finance Management Report',
  isActive: true,
  reason: 'Approved finance management reporting schedule',
};

export default function FinanceGovernancePanel({ onMessage, onError }: Props) {
  const [snapshot, setSnapshot] = useState<FinanceGovernanceSnapshot | null>(null);
  const [workspace, setWorkspace] = useState<Workspace>('cases');
  const [busy, setBusy] = useState(false);
  const [caseForm, setCaseForm] = useState(blankCase);
  const [scheduleForm, setScheduleForm] = useState(blankSchedule);
  const [caseSearch, setCaseSearch] = useState('');
  const [caseStatus, setCaseStatus] = useState('open');
  const [alertStatus, setAlertStatus] = useState('active');

  const load = async () => {
    try {
      setBusy(true);
      onError('');
      setSnapshot(await getFinanceGovernanceSnapshot(500));
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Unable to load Finance Governance.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const run = async (action: () => Promise<void>, message: string) => {
    try {
      setBusy(true);
      onError('');
      await action();
      onMessage(message);
      await load();
    } catch (error) {
      onError(error instanceof Error ? error.message : 'The finance governance action failed.');
    } finally {
      setBusy(false);
    }
  };

  const visibleCases = useMemo(() => {
    const query = caseSearch.trim().toLowerCase();
    return (snapshot?.cases || []).filter((item) => {
      const statusMatches = caseStatus === 'all'
        || (caseStatus === 'open' && ['submitted', 'in_review', 'approved'].includes(item.status))
        || item.status === caseStatus;
      const searchMatches = !query || [
        item.caseNumber,
        item.title,
        item.reference,
        item.requesterName,
        item.assignedName,
      ].some((value) => String(value || '').toLowerCase().includes(query));
      return statusMatches && searchMatches;
    });
  }, [snapshot, caseSearch, caseStatus]);

  const visibleAlerts = useMemo(() => {
    return (snapshot?.alerts || []).filter((item) => (
      alertStatus === 'all'
      || (alertStatus === 'active' && ['open', 'acknowledged'].includes(item.status))
      || item.status === alertStatus
    ));
  }, [snapshot, alertStatus]);

  const submitCase = async (event: FormEvent) => {
    event.preventDefault();
    await run(async () => {
      const amountMinor = caseForm.amount ? Math.round(Number(caseForm.amount) * 100) : null;
      if (!caseForm.title.trim() || !caseForm.description.trim()) {
        throw new Error('Enter a case title and full description.');
      }
      if ((caseForm.orderType && !caseForm.orderId) || (!caseForm.orderType && caseForm.orderId)) {
        throw new Error('Order type and order ID must be entered together.');
      }
      if (caseForm.amount && (!Number.isFinite(amountMinor) || Number(amountMinor) < 0)) {
        throw new Error('Enter a valid non-negative case amount.');
      }
      await createFinanceOperationCase({
        caseType: caseForm.caseType,
        title: caseForm.title,
        description: caseForm.description,
        priority: caseForm.priority,
        orderType: caseForm.orderType || null,
        orderId: caseForm.orderId || null,
        reference: caseForm.reference || null,
        candidateId: caseForm.candidateId || null,
        currency: caseForm.amount ? caseForm.currency : null,
        amountMinor,
      });
      setCaseForm(blankCase);
    }, 'Finance operations case submitted for independent review.');
  };

  const requestText = (label: string, initial = ''): string | null => {
    const value = window.prompt(label, initial);
    if (value === null) return null;
    const trimmed = value.trim();
    if (!trimmed) {
      onError('Enter a written reason before continuing.');
      return null;
    }
    return trimmed;
  };

  const addNote = async (item: FinanceOperationCase) => {
    const note = requestText(`Add an immutable note to ${item.caseNumber}`);
    if (!note) return;
    await run(() => addFinanceCaseNote(item.id, note).then(() => undefined), 'Finance case note recorded.');
  };

  const assignCase = async (item: FinanceOperationCase) => {
    const reviewerId = window.prompt(
      `Assign ${item.caseNumber} to a staff ID.\nAvailable staff:\n${(snapshot?.staffRecipients || []).map((staff) => `${staff.fullName}: ${staff.id}`).join('\n')}`,
      item.assignedTo || '',
    );
    if (!reviewerId?.trim()) return;
    const reason = requestText('Reason for assigning this case', 'Assigned for independent finance review');
    if (!reason) return;
    await run(
      () => assignFinanceCase(item.id, reviewerId.trim(), reason).then(() => undefined),
      `${item.caseNumber} assigned for review.`,
    );
  };

  const decideCase = async (item: FinanceOperationCase, decision: 'approve' | 'reject') => {
    const reason = requestText(
      `${decision === 'approve' ? 'Approval' : 'Rejection'} reason for ${item.caseNumber}`,
      decision === 'approve' ? 'Reviewed against finance evidence and approved' : 'Finance evidence does not support approval',
    );
    if (!reason) return;
    if (!window.confirm(`${decision === 'approve' ? 'Approve' : 'Reject'} ${item.caseNumber}?`)) return;
    await run(
      () => decideFinanceCase(item.id, decision, reason).then(() => undefined),
      `${item.caseNumber} ${decision === 'approve' ? 'reviewed' : 'rejected'}.`,
    );
  };

  const executeCase = async (item: FinanceOperationCase) => {
    const reason = requestText(
      `Execution evidence for ${item.caseNumber}`,
      'Approved action completed through the existing controlled finance authority',
    );
    if (!reason) return;
    const outcomeReference = window.prompt('Optional execution reference or outcome identifier', item.reference || '') || '';
    await run(
      () => executeFinanceCase(item.id, { executionReference: outcomeReference.trim() || null }, reason).then(() => undefined),
      `${item.caseNumber} marked executed with audit evidence.`,
    );
  };

  const cancelCase = async (item: FinanceOperationCase) => {
    const reason = requestText(`Cancellation reason for ${item.caseNumber}`, 'Request withdrawn before finance execution');
    if (!reason) return;
    if (!window.confirm(`Cancel ${item.caseNumber}?`)) return;
    await run(() => cancelFinanceCase(item.id, reason).then(() => undefined), `${item.caseNumber} cancelled.`);
  };

  const scanAlerts = async () => {
    await run(() => scanFinanceAlerts().then(() => undefined), 'Finance operational alert scan completed.');
  };

  const changeAlertStatus = async (
    alertId: string,
    status: 'acknowledged' | 'resolved' | 'suppressed',
  ) => {
    const note = requestText(
      `${status.charAt(0).toUpperCase() + status.slice(1)} note`,
      status === 'acknowledged' ? 'Alert received and assigned for review' : 'Finance condition reviewed and closed',
    );
    if (!note) return;
    await run(
      () => updateFinanceAlertStatus(alertId, status, note).then(() => undefined),
      `Finance alert ${status}.`,
    );
  };

  const editAlertRule = async (rule: FinanceAlertRule) => {
    const hoursText = window.prompt(`Threshold hours for ${rule.name}`, String(rule.thresholdHours));
    if (hoursText === null) return;
    const thresholdHours = Number(hoursText);
    if (!Number.isInteger(thresholdHours) || thresholdHours < 0) {
      onError('Threshold hours must be a non-negative whole number.');
      return;
    }
    const severity = window.prompt('Severity: low, medium, high or critical', rule.severity) as FinanceAlertSeverity | null;
    if (!severity || !['low', 'medium', 'high', 'critical'].includes(severity)) {
      onError('Select a valid alert severity.');
      return;
    }
    const reason = requestText('Reason for alert-rule update', 'Approved finance operational alert configuration');
    if (!reason) return;
    await run(
      () => updateFinanceAlertRule({
        ruleCode: rule.ruleCode,
        severity,
        thresholdHours,
        thresholdCount: rule.thresholdCount,
        recipientIds: rule.recipientIds,
        emailEnabled: rule.emailEnabled,
        isActive: rule.isActive,
        reason,
      }).then(() => undefined),
      `${rule.name} updated.`,
    );
  };

  const editSchedule = (scheduleId: string) => {
    const schedule = snapshot?.reportSchedules.find((item) => item.id === scheduleId);
    if (!schedule) return;
    setScheduleForm({
      scheduleId: schedule.id,
      name: schedule.name,
      reportType: schedule.reportType,
      cadence: schedule.cadence,
      dayOfWeek: String(schedule.dayOfWeek ?? 1),
      dayOfMonth: String(schedule.dayOfMonth ?? 1),
      runTime: String(schedule.runTime).slice(0, 5),
      timezone: schedule.timezone,
      recipientIds: schedule.recipientIds,
      subject: schedule.subject,
      isActive: schedule.isActive,
      reason: `Approved update to ${schedule.name}`,
    });
    onMessage(`${schedule.name} loaded for editing.`);
  };

  const submitSchedule = async (event: FormEvent) => {
    event.preventDefault();
    await run(async () => {
      if (!scheduleForm.name.trim() || !scheduleForm.subject.trim()) {
        throw new Error('Enter a schedule name and report subject.');
      }
      if (!scheduleForm.recipientIds.length) throw new Error('Select at least one staff recipient.');
      await saveFinanceReportSchedule({
        scheduleId: scheduleForm.scheduleId || null,
        name: scheduleForm.name,
        reportType: scheduleForm.reportType,
        cadence: scheduleForm.cadence,
        dayOfWeek: scheduleForm.cadence === 'weekly' ? Number(scheduleForm.dayOfWeek) : null,
        dayOfMonth: scheduleForm.cadence === 'monthly' ? Number(scheduleForm.dayOfMonth) : null,
        runTime: scheduleForm.runTime,
        timezone: scheduleForm.timezone,
        recipientIds: scheduleForm.recipientIds,
        subject: scheduleForm.subject,
        isActive: scheduleForm.isActive,
        reason: scheduleForm.reason,
      });
      setScheduleForm(blankSchedule);
    }, 'Finance management report schedule saved.');
  };

  const toggleRecipient = (recipientId: string) => {
    setScheduleForm((current) => ({
      ...current,
      recipientIds: current.recipientIds.includes(recipientId)
        ? current.recipientIds.filter((id) => id !== recipientId)
        : [...current.recipientIds, recipientId],
    }));
  };

  if (!snapshot && busy) {
    return (
      <div className="flex min-h-80 items-center justify-center gap-3 text-sm font-bold text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading Finance Governance…
      </div>
    );
  }

  if (!snapshot?.access.canViewGovernance) return null;

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-violet-600" />
              <h2 className="font-black text-slate-950">Finance Operations & Governance</h2>
            </div>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-500">
              Maker–checker cases, operational alerts and scheduled management reporting. Approved cases record execution evidence but never bypass the existing payment, Paystack, fulfilment or certificate authorities.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={busy}
            className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {[
          ['Open cases', snapshot.summary.openCases, FileClock],
          ['Pending approvals', snapshot.summary.pendingApprovals, ClipboardCheck],
          ['Overdue cases', snapshot.summary.overdueCases, AlertTriangle],
          ['Open alerts', snapshot.summary.openAlerts, BellRing],
          ['Critical alerts', snapshot.summary.criticalAlerts, AlertTriangle],
          ['Active reports', snapshot.summary.activeSchedules, CalendarClock],
        ].map(([label, value, Icon]) => (
          <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <Icon className="h-5 w-5 text-violet-600" />
            <p className="mt-3 text-2xl font-black text-slate-950">{String(value)}</p>
            <p className="text-xs font-bold text-slate-500">{String(label)}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        {([
          ['cases', 'Cases', FileCheck2],
          ['alerts', 'Operational Alerts', BellRing],
          ['reports', 'Management Reports', CalendarClock],
        ] as Array<[Workspace, string, typeof FileCheck2]>).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setWorkspace(id)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black ${
              workspace === id ? 'bg-violet-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {workspace === 'cases' && (
        <div className="space-y-5">
          {snapshot.access.canSubmitCases && (
            <form onSubmit={(event) => void submitCase(event)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="font-black text-slate-950">Submit a finance operations case</h3>
              <p className="mt-1 text-xs text-slate-500">Manual payments, refunds, reversals and adjustments automatically require two independent approvals.</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <label className="text-xs font-bold text-slate-600">
                  Case type
                  <select
                    value={caseForm.caseType}
                    onChange={(event) => setCaseForm({ ...caseForm, caseType: event.target.value as typeof caseForm.caseType })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  >
                    {caseTypeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label className="text-xs font-bold text-slate-600">
                  Priority
                  <select
                    value={caseForm.priority}
                    onChange={(event) => setCaseForm({ ...caseForm, priority: event.target.value as typeof caseForm.priority })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  >
                    <option value="low">Low — 5 days</option>
                    <option value="normal">Normal — 48 hours</option>
                    <option value="high">High — 24 hours</option>
                    <option value="critical">Critical — 4 hours</option>
                  </select>
                </label>
                <label className="text-xs font-bold text-slate-600 xl:col-span-2">
                  Case title
                  <input
                    value={caseForm.title}
                    onChange={(event) => setCaseForm({ ...caseForm, title: event.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                    placeholder="Example: Review duplicate payment evidence"
                  />
                </label>
                <label className="text-xs font-bold text-slate-600">
                  Order type
                  <select
                    value={caseForm.orderType}
                    onChange={(event) => setCaseForm({ ...caseForm, orderType: event.target.value as typeof caseForm.orderType })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  >
                    <option value="">No linked order</option>
                    <option value="exam">Individual examination</option>
                    <option value="bulk">Consolidated examination</option>
                    <option value="certificate">Certificate</option>
                    <option value="other">Other order</option>
                  </select>
                </label>
                <label className="text-xs font-bold text-slate-600">
                  Order ID
                  <input value={caseForm.orderId} onChange={(event) => setCaseForm({ ...caseForm, orderId: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
                </label>
                <label className="text-xs font-bold text-slate-600">
                  Reference
                  <input value={caseForm.reference} onChange={(event) => setCaseForm({ ...caseForm, reference: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
                </label>
                <label className="text-xs font-bold text-slate-600">
                  Candidate ID
                  <input value={caseForm.candidateId} onChange={(event) => setCaseForm({ ...caseForm, candidateId: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
                </label>
                <label className="text-xs font-bold text-slate-600">
                  Amount
                  <input type="number" min="0" step="0.01" value={caseForm.amount} onChange={(event) => setCaseForm({ ...caseForm, amount: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
                </label>
                <label className="text-xs font-bold text-slate-600">
                  Currency
                  <input value={caseForm.currency} onChange={(event) => setCaseForm({ ...caseForm, currency: event.target.value.toUpperCase() })} maxLength={3} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
                </label>
                <label className="text-xs font-bold text-slate-600 md:col-span-2 xl:col-span-3">
                  Full case description and evidence
                  <textarea value={caseForm.description} onChange={(event) => setCaseForm({ ...caseForm, description: event.target.value })} rows={3} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
                </label>
              </div>
              <button type="submit" disabled={busy} className="mt-4 flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-3 text-sm font-black text-white disabled:opacity-50">
                <Send className="h-4 w-4" /> Submit for review
              </button>
            </form>
          )}

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid gap-3 md:grid-cols-[1fr_220px]">
              <input value={caseSearch} onChange={(event) => setCaseSearch(event.target.value)} placeholder="Search case, reference, requester or assignee" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
              <select value={caseStatus} onChange={(event) => setCaseStatus(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
                <option value="open">Open cases</option>
                <option value="submitted">Submitted</option>
                <option value="in_review">In review</option>
                <option value="approved">Approved</option>
                <option value="executed">Executed</option>
                <option value="rejected">Rejected</option>
                <option value="cancelled">Cancelled</option>
                <option value="all">All cases</option>
              </select>
            </div>
          </div>

          <div className="space-y-4">
            {visibleCases.map((item) => (
              <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-black text-slate-950">{item.caseNumber}</p>
                      <span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${statusTone(item.status)}`}>{item.status.replaceAll('_', ' ')}</span>
                      <span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${severityTone(item.priority === 'critical' ? 'critical' : item.priority === 'high' ? 'high' : 'low')}`}>{item.priority}</span>
                    </div>
                    <h3 className="mt-2 text-lg font-black text-slate-950">{item.title}</h3>
                    <p className="mt-1 text-xs font-bold uppercase tracking-wide text-violet-700">{caseTypeLabel(item.caseType)}</p>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    <p>Submitted {formatDate(item.submittedAt)}</p>
                    <p className={new Date(item.dueAt) < new Date() && !['rejected', 'executed', 'cancelled'].includes(item.status) ? 'font-black text-rose-700' : ''}>Due {formatDate(item.dueAt)}</p>
                  </div>
                </div>
                <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-600">{item.description}</p>
                <div className="mt-4 grid gap-2 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
                  <p><strong>Requester:</strong> {item.requesterName || item.requestedBy}</p>
                  <p><strong>Assignee:</strong> {item.assignedName || 'Unassigned'}</p>
                  <p><strong>Approvals:</strong> {item.approvalCount}/{item.requiredApprovals}</p>
                  <p><strong>Reference:</strong> {item.reference || '—'}</p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" onClick={() => void addNote(item)} disabled={busy} className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-black text-slate-700"><MessageSquareText className="h-4 w-4" /> Add note</button>
                  {snapshot.access.canReviewCases && ['submitted', 'in_review'].includes(item.status) && (
                    <>
                      <button type="button" onClick={() => void assignCase(item)} disabled={busy} className="flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black text-blue-700"><UserCheck className="h-4 w-4" /> Assign</button>
                      <button type="button" onClick={() => void decideCase(item, 'approve')} disabled={busy} className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-black text-white"><CheckCircle2 className="h-4 w-4" /> Approve</button>
                      <button type="button" onClick={() => void decideCase(item, 'reject')} disabled={busy} className="flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-2 text-xs font-black text-white"><XCircle className="h-4 w-4" /> Reject</button>
                    </>
                  )}
                  {snapshot.access.canReviewCases && item.status === 'approved' && (
                    <button type="button" onClick={() => void executeCase(item)} disabled={busy} className="flex items-center gap-1 rounded-lg bg-violet-700 px-3 py-2 text-xs font-black text-white"><PlayCircle className="h-4 w-4" /> Record execution</button>
                  )}
                  {['submitted', 'in_review'].includes(item.status) && (
                    <button type="button" onClick={() => void cancelCase(item)} disabled={busy} className="flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-2 text-xs font-black text-rose-700"><XCircle className="h-4 w-4" /> Cancel</button>
                  )}
                </div>
                <details className="mt-4 rounded-xl bg-slate-50 p-3">
                  <summary className="cursor-pointer text-xs font-black text-slate-700">Immutable case timeline ({item.events.length})</summary>
                  <div className="mt-3 space-y-3">
                    {item.events.map((event) => (
                      <div key={event.id} className="border-l-2 border-violet-200 pl-3 text-xs text-slate-600">
                        <p className="font-black text-slate-800">{event.eventType.replaceAll('_', ' ')} · {event.actorName || 'System'}</p>
                        <p>{formatDate(event.createdAt)}</p>
                        {event.note && <p className="mt-1 whitespace-pre-wrap">{event.note}</p>}
                      </div>
                    ))}
                  </div>
                </details>
              </article>
            ))}
            {!visibleCases.length && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-bold text-slate-500">No finance cases match the selected filters.</div>}
          </div>
        </div>
      )}

      {workspace === 'alerts' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <h3 className="font-black text-slate-950">Operational alert centre</h3>
              <p className="mt-1 text-xs text-slate-500">Detects overdue governance cases, approval backlog, paid-but-unfulfilled orders and failed recovery actions.</p>
            </div>
            {snapshot.access.canManageAlerts && (
              <button type="button" onClick={() => void scanAlerts()} disabled={busy} className="flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-3 text-sm font-black text-white disabled:opacity-50"><BellRing className="h-4 w-4" /> Run alert scan</button>
            )}
          </div>

          {snapshot.access.canManageAlerts && (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {snapshot.alertRules.map((rule) => (
                <div key={rule.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <h4 className="font-black text-slate-950">{rule.name}</h4>
                    <span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${severityTone(rule.severity)}`}>{rule.severity}</span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-500">{rule.description}</p>
                  <p className="mt-3 text-xs font-bold text-slate-700">Threshold: {rule.thresholdHours} hour(s)</p>
                  <p className="text-xs text-slate-500">Email: {rule.emailEnabled ? 'Enabled' : 'Disabled'} · {rule.isActive ? 'Active' : 'Inactive'}</p>
                  <button type="button" onClick={() => void editAlertRule(rule)} disabled={busy} className="mt-4 w-full rounded-xl border border-violet-200 px-3 py-2 text-xs font-black text-violet-700">Edit rule</button>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <select value={alertStatus} onChange={(event) => setAlertStatus(event.target.value)} className="w-full max-w-xs rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
              <option value="active">Open and acknowledged</option>
              <option value="open">Open</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="resolved">Resolved</option>
              <option value="suppressed">Suppressed</option>
              <option value="all">All alerts</option>
            </select>
          </div>

          <div className="space-y-3">
            {visibleAlerts.map((alert) => (
              <article key={alert.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${severityTone(alert.severity)}`}>{alert.severity}</span>
                      <span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${statusTone(alert.status)}`}>{alert.status}</span>
                    </div>
                    <h3 className="mt-2 font-black text-slate-950">{alert.title}</h3>
                    <p className="mt-1 text-sm text-slate-600">{alert.message}</p>
                  </div>
                  <p className="text-xs text-slate-500">Last seen {formatDate(alert.lastSeenAt)}</p>
                </div>
                <p className="mt-3 text-xs font-bold text-slate-600">Reference: {alert.reference || alert.entityId}</p>
                {alert.resolutionNote && <p className="mt-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">{alert.resolutionNote}</p>}
                <div className="mt-4 flex flex-wrap gap-2">
                  {alert.status === 'open' && <button type="button" onClick={() => void changeAlertStatus(alert.id, 'acknowledged')} disabled={busy} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black text-blue-700">Acknowledge</button>}
                  {snapshot.access.canManageAlerts && ['open', 'acknowledged'].includes(alert.status) && (
                    <>
                      <button type="button" onClick={() => void changeAlertStatus(alert.id, 'resolved')} disabled={busy} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-black text-white">Resolve</button>
                      <button type="button" onClick={() => void changeAlertStatus(alert.id, 'suppressed')} disabled={busy} className="rounded-lg bg-slate-700 px-3 py-2 text-xs font-black text-white">Suppress</button>
                    </>
                  )}
                </div>
              </article>
            ))}
            {!visibleAlerts.length && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-bold text-slate-500">No operational alerts match the selected status.</div>}
          </div>
        </div>
      )}

      {workspace === 'reports' && (
        <div className="space-y-5">
          {snapshot.access.canScheduleReports && (
            <form onSubmit={(event) => void submitSchedule(event)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-black text-slate-950">Schedule a management report</h3>
                  <p className="mt-1 text-xs text-slate-500">Due reports are queued through the controlled operational communications outbox.</p>
                </div>
                <button type="button" onClick={() => void run(() => processDueFinanceReports().then(() => undefined), 'Due finance report schedules processed.')} disabled={busy} className="flex items-center gap-2 rounded-xl border border-violet-200 px-3 py-2 text-xs font-black text-violet-700"><PlayCircle className="h-4 w-4" /> Process due now</button>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <label className="text-xs font-bold text-slate-600 xl:col-span-2">Schedule name<input value={scheduleForm.name} onChange={(event) => setScheduleForm({ ...scheduleForm, name: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /></label>
                <label className="text-xs font-bold text-slate-600">Report type<select value={scheduleForm.reportType} onChange={(event) => setScheduleForm({ ...scheduleForm, reportType: event.target.value as FinanceReportType })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm">{reportTypeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label className="text-xs font-bold text-slate-600">Cadence<select value={scheduleForm.cadence} onChange={(event) => setScheduleForm({ ...scheduleForm, cadence: event.target.value as FinanceReportCadence })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label>
                {scheduleForm.cadence === 'weekly' && <label className="text-xs font-bold text-slate-600">Day of week<select value={scheduleForm.dayOfWeek} onChange={(event) => setScheduleForm({ ...scheduleForm, dayOfWeek: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"><option value="0">Sunday</option><option value="1">Monday</option><option value="2">Tuesday</option><option value="3">Wednesday</option><option value="4">Thursday</option><option value="5">Friday</option><option value="6">Saturday</option></select></label>}
                {scheduleForm.cadence === 'monthly' && <label className="text-xs font-bold text-slate-600">Day of month<input type="number" min="1" max="28" value={scheduleForm.dayOfMonth} onChange={(event) => setScheduleForm({ ...scheduleForm, dayOfMonth: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /></label>}
                <label className="text-xs font-bold text-slate-600">Run time<input type="time" value={scheduleForm.runTime} onChange={(event) => setScheduleForm({ ...scheduleForm, runTime: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /></label>
                <label className="text-xs font-bold text-slate-600">Time zone<input value={scheduleForm.timezone} onChange={(event) => setScheduleForm({ ...scheduleForm, timezone: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /></label>
                <label className="text-xs font-bold text-slate-600 md:col-span-2">Email subject<input value={scheduleForm.subject} onChange={(event) => setScheduleForm({ ...scheduleForm, subject: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /></label>
                <label className="text-xs font-bold text-slate-600 md:col-span-2">Change reason<input value={scheduleForm.reason} onChange={(event) => setScheduleForm({ ...scheduleForm, reason: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /></label>
              </div>
              <div className="mt-4 rounded-xl border border-slate-200 p-4">
                <p className="text-xs font-black text-slate-700">Staff recipients</p>
                <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {snapshot.staffRecipients.map((staff) => (
                    <label key={staff.id} className="flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
                      <input type="checkbox" checked={scheduleForm.recipientIds.includes(staff.id)} onChange={() => toggleRecipient(staff.id)} className="mt-0.5" />
                      <span><strong>{staff.fullName}</strong><br />{staff.email} · {staff.role}</span>
                    </label>
                  ))}
                </div>
              </div>
              <label className="mt-4 flex items-center gap-2 text-xs font-bold text-slate-700"><input type="checkbox" checked={scheduleForm.isActive} onChange={(event) => setScheduleForm({ ...scheduleForm, isActive: event.target.checked })} /> Active schedule</label>
              <button type="submit" disabled={busy} className="mt-4 flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-3 text-sm font-black text-white disabled:opacity-50"><Save className="h-4 w-4" /> Save schedule</button>
            </form>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            {snapshot.reportSchedules.map((schedule) => (
              <article key={schedule.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div><h3 className="font-black text-slate-950">{schedule.name}</h3><p className="mt-1 text-xs font-bold uppercase text-violet-700">{schedule.reportType.replaceAll('_', ' ')}</p></div>
                  <span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${schedule.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>{schedule.isActive ? 'active' : 'inactive'}</span>
                </div>
                <div className="mt-4 space-y-1 text-xs text-slate-600">
                  <p><strong>Cadence:</strong> {schedule.cadence}</p>
                  <p><strong>Next run:</strong> {formatDate(schedule.nextRunAt)}</p>
                  <p><strong>Last run:</strong> {formatDate(schedule.lastRunAt)}</p>
                  <p><strong>Recipients:</strong> {schedule.recipientIds.length}</p>
                </div>
                {snapshot.access.canScheduleReports && <button type="button" onClick={() => editSchedule(schedule.id)} className="mt-4 rounded-xl border border-violet-200 px-3 py-2 text-xs font-black text-violet-700">Edit schedule</button>}
              </article>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-black text-slate-950">Recent report runs</h3>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead><tr className="border-b border-slate-200 text-slate-500"><th className="px-3 py-2">Schedule</th><th className="px-3 py-2">Scheduled</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Queued</th><th className="px-3 py-2">Error</th></tr></thead>
                <tbody>{snapshot.reportRuns.map((runItem) => <tr key={runItem.id} className="border-b border-slate-100"><td className="px-3 py-3 font-bold text-slate-800">{runItem.scheduleName}</td><td className="px-3 py-3 text-slate-600">{formatDate(runItem.scheduledFor)}</td><td className="px-3 py-3"><span className={`rounded-full px-2 py-1 font-black uppercase ${statusTone(runItem.status)}`}>{runItem.status}</span></td><td className="px-3 py-3 text-slate-600">{runItem.queuedCount}/{runItem.recipientCount}</td><td className="px-3 py-3 text-rose-600">{runItem.errorMessage || '—'}</td></tr>)}</tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

import { supabase } from '../lib/supabase';

export type FinanceCaseType =
  | 'reconciliation'
  | 'manual_payment'
  | 'access_recovery'
  | 'refund'
  | 'reversal'
  | 'adjustment'
  | 'exception';

export type FinanceCaseStatus =
  | 'submitted'
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'executed'
  | 'cancelled';

export type FinanceCasePriority = 'low' | 'normal' | 'high' | 'critical';
export type FinanceAlertSeverity = 'low' | 'medium' | 'high' | 'critical';
export type FinanceAlertStatus = 'open' | 'acknowledged' | 'resolved' | 'suppressed';
export type FinanceReportCadence = 'daily' | 'weekly' | 'monthly';
export type FinanceReportType =
  | 'revenue_summary'
  | 'transaction_exceptions'
  | 'coupon_performance'
  | 'reconciliation_backlog'
  | 'governance_cases';

export interface FinanceGovernanceAccess {
  actorId: string;
  role: string;
  permissions: string[];
  canViewGovernance: boolean;
  canSubmitCases: boolean;
  canReviewCases: boolean;
  canManageAlerts: boolean;
  canScheduleReports: boolean;
}

export interface FinanceGovernanceSummary {
  openCases: number;
  pendingApprovals: number;
  overdueCases: number;
  openAlerts: number;
  criticalAlerts: number;
  activeSchedules: number;
}

export interface FinanceGovernanceStaff {
  id: string;
  fullName: string;
  email: string;
  role: string;
}

export interface FinanceCaseEvent {
  id: string;
  eventType: string;
  actorId?: string | null;
  actorName?: string | null;
  fromStatus?: string | null;
  toStatus?: string | null;
  note?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface FinanceOperationCase {
  id: string;
  caseNumber: string;
  caseType: FinanceCaseType;
  orderType?: 'exam' | 'bulk' | 'certificate' | 'other' | null;
  orderId?: string | null;
  reference?: string | null;
  candidateId?: string | null;
  currency?: string | null;
  amountMinor?: number | null;
  title: string;
  description: string;
  priority: FinanceCasePriority;
  status: FinanceCaseStatus;
  requiredApprovals: number;
  approvalCount: number;
  requestedBy: string;
  requesterName?: string | null;
  assignedTo?: string | null;
  assignedName?: string | null;
  submittedAt: string;
  dueAt: string;
  resolvedAt?: string | null;
  outcome: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  events: FinanceCaseEvent[];
}

export interface FinanceAlertRule {
  id: string;
  ruleCode: string;
  name: string;
  description: string;
  severity: FinanceAlertSeverity;
  thresholdHours: number;
  thresholdCount: number;
  recipientIds: string[];
  emailEnabled: boolean;
  isActive: boolean;
  updatedAt: string;
}

export interface FinanceAlert {
  id: string;
  ruleId: string;
  ruleCode: string;
  entityType: string;
  entityId: string;
  reference?: string | null;
  title: string;
  message: string;
  severity: FinanceAlertSeverity;
  status: FinanceAlertStatus;
  firstSeenAt: string;
  lastSeenAt: string;
  acknowledgedBy?: string | null;
  acknowledgedAt?: string | null;
  resolvedBy?: string | null;
  resolvedAt?: string | null;
  resolutionNote?: string | null;
  lastNotifiedAt?: string | null;
  metadata: Record<string, unknown>;
}

export interface FinanceReportSchedule {
  id: string;
  name: string;
  reportType: FinanceReportType;
  cadence: FinanceReportCadence;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  runTime: string;
  timezone: string;
  recipientIds: string[];
  subject: string;
  isActive: boolean;
  nextRunAt: string;
  lastRunAt?: string | null;
  createdBy: string;
  updatedAt: string;
}

export interface FinanceReportRun {
  id: string;
  scheduleId: string;
  scheduleName: string;
  scheduledFor: string;
  periodStart: string;
  periodEnd: string;
  status: 'queued' | 'partial' | 'failed' | 'skipped';
  recipientCount: number;
  queuedCount: number;
  errorMessage?: string | null;
  summary: Record<string, unknown>;
  createdAt: string;
}

export interface FinanceGovernanceSnapshot {
  generatedAt: string;
  access: FinanceGovernanceAccess;
  summary: FinanceGovernanceSummary;
  staffRecipients: FinanceGovernanceStaff[];
  cases: FinanceOperationCase[];
  alertRules: FinanceAlertRule[];
  alerts: FinanceAlert[];
  reportSchedules: FinanceReportSchedule[];
  reportRuns: FinanceReportRun[];
}

const emptySummary: FinanceGovernanceSummary = {
  openCases: 0,
  pendingApprovals: 0,
  overdueCases: 0,
  openAlerts: 0,
  criticalAlerts: 0,
  activeSchedules: 0,
};

export async function getFinanceGovernanceSnapshot(limit = 300): Promise<FinanceGovernanceSnapshot> {
  const { data, error } = await supabase.rpc('get_finance_governance_snapshot', { p_limit: limit });
  if (error) throw new Error(error.message);
  if (!data || typeof data !== 'object') throw new Error('Finance governance data was not returned.');
  const raw = data as Partial<FinanceGovernanceSnapshot>;
  return {
    generatedAt: raw.generatedAt || new Date().toISOString(),
    access: (raw.access || {}) as FinanceGovernanceAccess,
    summary: { ...emptySummary, ...(raw.summary || {}) },
    staffRecipients: Array.isArray(raw.staffRecipients) ? raw.staffRecipients : [],
    cases: Array.isArray(raw.cases) ? raw.cases : [],
    alertRules: Array.isArray(raw.alertRules) ? raw.alertRules : [],
    alerts: Array.isArray(raw.alerts) ? raw.alerts : [],
    reportSchedules: Array.isArray(raw.reportSchedules) ? raw.reportSchedules : [],
    reportRuns: Array.isArray(raw.reportRuns) ? raw.reportRuns : [],
  };
}

export async function createFinanceOperationCase(input: {
  caseType: FinanceCaseType;
  title: string;
  description: string;
  priority: FinanceCasePriority;
  orderType?: 'exam' | 'bulk' | 'certificate' | 'other' | null;
  orderId?: string | null;
  reference?: string | null;
  candidateId?: string | null;
  currency?: string | null;
  amountMinor?: number | null;
  metadata?: Record<string, unknown>;
}): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.rpc('finance_create_operation_case', {
    p_case_type: input.caseType,
    p_title: input.title.trim(),
    p_description: input.description.trim(),
    p_priority: input.priority,
    p_order_type: input.orderType || null,
    p_order_id: input.orderId || null,
    p_reference: input.reference?.trim() || null,
    p_candidate_id: input.candidateId || null,
    p_currency: input.currency?.trim().toUpperCase() || null,
    p_amount_minor: input.amountMinor ?? null,
    p_metadata: input.metadata || {},
  });
  if (error) throw new Error(error.message);
  return (data || {}) as Record<string, unknown>;
}

async function invokeGovernanceRpc(
  functionName: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.rpc(functionName, args);
  if (error) throw new Error(error.message);
  return (data || {}) as Record<string, unknown>;
}

export const addFinanceCaseNote = (caseId: string, note: string) =>
  invokeGovernanceRpc('finance_add_operation_case_note', {
    p_case_id: caseId,
    p_note: note.trim(),
  });

export const assignFinanceCase = (caseId: string, assignedTo: string, reason: string) =>
  invokeGovernanceRpc('finance_assign_operation_case', {
    p_case_id: caseId,
    p_assigned_to: assignedTo,
    p_reason: reason.trim(),
  });

export const decideFinanceCase = (caseId: string, decision: 'approve' | 'reject', reason: string) =>
  invokeGovernanceRpc('finance_decide_operation_case', {
    p_case_id: caseId,
    p_decision: decision,
    p_reason: reason.trim(),
  });

export const executeFinanceCase = (
  caseId: string,
  outcome: Record<string, unknown>,
  reason: string,
) => invokeGovernanceRpc('finance_execute_operation_case', {
  p_case_id: caseId,
  p_outcome: outcome,
  p_reason: reason.trim(),
});

export const cancelFinanceCase = (caseId: string, reason: string) =>
  invokeGovernanceRpc('finance_cancel_operation_case', {
    p_case_id: caseId,
    p_reason: reason.trim(),
  });

export const scanFinanceAlerts = () =>
  invokeGovernanceRpc('finance_scan_governance_alerts', {});

export const updateFinanceAlertStatus = (
  alertId: string,
  status: 'acknowledged' | 'resolved' | 'suppressed',
  note: string,
) => invokeGovernanceRpc('finance_update_alert_status', {
  p_alert_id: alertId,
  p_status: status,
  p_note: note.trim(),
});

export const updateFinanceAlertRule = (input: {
  ruleCode: string;
  severity: FinanceAlertSeverity;
  thresholdHours: number;
  thresholdCount: number;
  recipientIds: string[];
  emailEnabled: boolean;
  isActive: boolean;
  reason: string;
}) => invokeGovernanceRpc('finance_update_alert_rule', {
  p_rule_code: input.ruleCode,
  p_severity: input.severity,
  p_threshold_hours: input.thresholdHours,
  p_threshold_count: input.thresholdCount,
  p_recipient_ids: input.recipientIds,
  p_email_enabled: input.emailEnabled,
  p_is_active: input.isActive,
  p_reason: input.reason.trim(),
});

export const saveFinanceReportSchedule = (input: {
  scheduleId?: string | null;
  name: string;
  reportType: FinanceReportType;
  cadence: FinanceReportCadence;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  runTime: string;
  timezone: string;
  recipientIds: string[];
  subject: string;
  isActive: boolean;
  reason: string;
}) => invokeGovernanceRpc('finance_upsert_report_schedule', {
  p_schedule_id: input.scheduleId || null,
  p_name: input.name.trim(),
  p_report_type: input.reportType,
  p_cadence: input.cadence,
  p_day_of_week: input.dayOfWeek ?? null,
  p_day_of_month: input.dayOfMonth ?? null,
  p_run_time: input.runTime,
  p_timezone: input.timezone.trim(),
  p_recipient_ids: input.recipientIds,
  p_subject: input.subject.trim(),
  p_is_active: input.isActive,
  p_reason: input.reason.trim(),
});

export const processDueFinanceReports = (limit = 20) =>
  invokeGovernanceRpc('finance_process_due_report_schedules', { p_limit: limit });

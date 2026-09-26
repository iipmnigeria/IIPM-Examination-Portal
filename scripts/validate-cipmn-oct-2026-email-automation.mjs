import fs from 'node:fs';

const dryRun = fs.readFileSync('scripts/cipmn-oct-2026-email-dry-run.sql', 'utf8');
const config = fs.readFileSync('scripts/cipmn-oct-2026-monitor-copy-config-draft.sql', 'utf8');
const planner = fs.readFileSync('scripts/cipmn-oct-2026-outbox-planner.sql', 'utf8');
const matrix = fs.readFileSync('docs/CIPMN_OCT_2026_SIMULATED_SEND_MATRIX.md', 'utf8');
const comms = fs.readFileSync('supabase/functions/agilecert-communications/index.ts', 'utf8');
const spec = fs.readFileSync('docs/CIPMN_OCT_2026_EMAIL_AUTOMATION.md', 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const officialCodes = [
  'MOD-001','MOD-002','MOD-003','MOD-004','MOD-005','MOD-006',
  'MOD-007','MOD-008','MOD-009','MOD-010','MOD-011','MOD-012',
  'EL01','EL02','EL03','EL04','EL05',
];

for (const code of officialCodes) {
  assert(dryRun.includes(`'${code}'`), `Missing official module code ${code}`);
}

assert(!dryRun.includes("'EL06'"), 'Dry-run must not expose EL06 as an official campaign module.');
assert(dryRun.includes("'MOD-012',date '2026-10-15','3327bd65-d739-9b41-78f5-1c54da529c35'::uuid"),
  'Official MOD-012 must map to the live international-programmes record.');
assert(dryRun.includes("when exam_date < ((now() at time zone 'Africa/Lagos')::date) then 'examination_passed'"),
  'Expired examination stop condition is missing.');
assert(dryRun.includes("when completed then 'completed'") && dryRun.indexOf("when completed then 'completed'") < dryRun.indexOf("when started then 'in_progress'"),
  'Completed state must take precedence over in-progress state.');
assert(dryRun.includes("paid.status in ('paid','waived')"),
  'Recovery must suppress unresolved historical orders after successful replacement.');
assert(dryRun.includes("'iipmnigeria@gmail.com'::text monitor_copy_email"),
  'Dry-run monitoring copy recipient is missing.');
assert(config.includes("monitor_copy_email = 'iipmnigeria@gmail.com'"),
  'Central monitoring-copy configuration is missing.');
assert(/^begin;/m.test(config) && /^rollback;/m.test(config),
  'Monitoring-copy draft must remain rollback-only during dry-run.');
assert(comms.includes("monitor_copy_email: string | null;"),
  'Communications settings type lacks central monitoring-copy support.');
assert(comms.includes("cc: settings.monitor_copy_email?.trim() ? [settings.monitor_copy_email.trim()] : undefined"),
  'Resend request lacks central monitoring-copy CC support.');
assert(spec.includes('maximum 2 CIPMN campaign emails') && spec.includes('minimum 6 hours'),
  'Candidate-level frequency guard is missing.');
assert(planner.includes('eligible_for_existing_outbox'),
  'Outbox planner must distinguish registered candidates from email-only outreach.');
assert(planner.includes("when b.completed then 'completed'") && planner.indexOf("when b.completed then 'completed'") < planner.indexOf("when b.started then 'in_progress'"),
  'Outbox planner must prioritize completed over in-progress.');
assert(planner.includes("paid.status in ('paid','waived')"),
  'Outbox planner must suppress historical recovery after successful replacement.');
assert(planner.includes("exam_date < ((select as_of from params) at time zone 'Africa/Lagos')::date"),
  'Outbox planner must suppress passed examinations.');
assert(planner.includes("'iipmnigeria@gmail.com'::text monitor_copy_email"),
  'Outbox planner monitoring copy is missing.');
for (const messageType of [
  'cipmn_exam_preparation',
  'cipmn_payment_recovery',
  'cipmn_unpurchased_modules',
  'cipmn_mock_start',
  'cipmn_mock_resume',
]) {
  assert(comms.includes(`row.message_type === '${messageType}'`),
    `Missing renderer for ${messageType}`);
}
assert(matrix.includes('Izedonmen Friday Egbokhare') && matrix.includes('MOD-011 unresolved payment'),
  'Simulated send matrix must capture the validated recovery target.');
assert(matrix.includes('Chiemerie Nnenna Awuzie') && matrix.includes('Not registered'),
  'Simulated matrix must retain unregistered official candidates.');

const forbiddenWrite = /\b(insert\s+into|update\s+public\.|delete\s+from|alter\s+table|drop\s+table)\b/i;
assert(!forbiddenWrite.test(dryRun), 'Dry-run preview contains a mutating SQL statement.');
assert(!forbiddenWrite.test(planner), 'Outbox planner contains a mutating SQL statement.');

console.log(JSON.stringify({
  ok: true,
  officialModuleCount: officialCodes.length,
  monitoringCopy: 'iipmnigeria@gmail.com',
  dryRunReadOnly: true,
  outboxPlannerReadOnly: !/\\b(insert\\s+into|update\\s+public\\.|delete\\s+from|alter\\s+table|drop\\s+table)\\b/i.test(planner),
  stopConditionsValidated: [
    'exam-passed',
    'paid-replacement-suppresses-recovery',
    'completed-suppresses-resume',
    'daily-frequency-guard',
  ],
}, null, 2));

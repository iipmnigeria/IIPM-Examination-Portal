import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const fail = (message) => {
  console.error(`[cipmn-section-launch] ${message}`);
  process.exitCode = 1;
};
const expect = (condition, message) => {
  if (!condition) fail(message);
};

const app = read('src/App.tsx');
const dashboard = read('src/components/StudentDashboard.tsx');
const mount = read('src/components/CipmnModuleMaterialsMount.tsx');
const hub = read('src/components/CipmnModuleHubContext.tsx');
const service = read('src/services/examService.ts');

const appMcqStart = app.match(/const handleStartCipmnMcq = async \(testId: string\) => \{([\s\S]*?)\n  \};/);
expect(Boolean(appMcqStart), 'App.handleStartCipmnMcq must exist.');
if (appMcqStart) {
  expect(appMcqStart[1].includes('startCipmnMcqAttempt(testId)'), 'MCQ start must call startCipmnMcqAttempt(testId).');
  expect(!appMcqStart[1].includes('startSecureExam('), 'MCQ start must not fall back to generic startSecureExam().');
  expect(appMcqStart[1].includes("setView('exam')"), 'MCQ start must hand the authoritative test to the exam view.');
}

expect(
  app.includes('onStartCipmnMcq={(testId) => void handleStartCipmnMcq(testId)}'),
  'StudentDashboard MCQ callback must route to handleStartCipmnMcq.',
);
expect(
  app.includes('onStartTheory={(testId) => void handleStartExam(testId)}'),
  'StudentDashboard Theory callback must remain on the Theory-aware secure launcher.',
);

const cameraIndex = dashboard.indexOf('navigator.mediaDevices.getUserMedia');
const mcqCallbackIndex = dashboard.indexOf('onStartCipmnMcq(test.id)');
const theoryCallbackIndex = dashboard.indexOf('onStartTheory(test.id)');
expect(cameraIndex >= 0, 'CIPMN launch must retain the camera preflight.');
expect(mcqCallbackIndex > cameraIndex, 'MCQ callback must execute only after camera preflight.');
expect(theoryCallbackIndex > cameraIndex, 'Theory callback must execute only after camera preflight.');
expect(
  dashboard.includes("section: 'default' | 'mcq' | 'theory' = 'default'"),
  'Dashboard secure launcher must retain explicit section intent.',
);
expect(
  dashboard.includes("window.addEventListener('agilecert-cipmn-launch-section'"),
  'Dashboard must listen for the separate-root CIPMN section launch bridge.',
);
expect(
  dashboard.includes("if (detail.section !== 'mcq' && detail.section !== 'theory') return;"),
  'Section launch bridge must reject unknown section values.',
);

expect(
  mount.includes("dispatchCipmnSectionLaunch(examinationId, 'mcq')"),
  'Module Hub MCQ action must dispatch explicit mcq intent.',
);
expect(
  mount.includes("dispatchCipmnSectionLaunch(examinationId, 'theory')"),
  'Module Hub Theory action must dispatch explicit theory intent.',
);
expect(
  mount.includes("new CustomEvent('agilecert-cipmn-launch-section'"),
  'Separate React root must use the section-intent bridge.',
);

expect(
  hub.includes('onClick={canAttemptMcq?onAttemptMcq:undefined}'),
  'MCQ button must use only onAttemptMcq.',
);
expect(
  hub.includes('onClick={canStartTheory?onStartTheory:undefined}'),
  'Theory start button must use only onStartTheory.',
);
expect(
  hub.includes('await startCipmnTheoryRetake(examinationId)'),
  'Theory retake must keep the dedicated Theory retake launcher.',
);
expect(
  hub.includes('onStartTheory();'),
  'Theory retake handoff must return through the Theory callback.',
);
expect(
  !hub.includes('onClick={canStartTheory?onAttemptMcq:undefined}'),
  'Theory start must never reuse the MCQ callback.',
);

expect(
  service.includes("supabase.rpc('start_cipmn_mcq_attempt'"),
  'MCQ service must use the dedicated start_cipmn_mcq_attempt RPC.',
);
expect(
  service.includes("supabase.rpc('start_cipmn_theory_retake'"),
  'Theory retake service must use the dedicated start_cipmn_theory_retake RPC.',
);
expect(
  service.includes("supabase.rpc('start_exam_secure'"),
  'Generic secure launcher must remain available for normal/Theory-aware launches.',
);

if (!process.exitCode) {
  console.log('[cipmn-section-launch] All section-aware launch regression contracts passed.');
}

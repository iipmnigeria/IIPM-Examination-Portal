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
const experience = read('src/components/CipmnExamExperience.tsx');
const mixedScreen = read('src/components/CipmnMixedExamScreen.tsx');
const migration = read('supabase/migrations/20260926170000_cipmn_independent_section_guard.sql');

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


const appMcqSubmit = app.match(/const handleSubmitCipmnMcq = async \([\s\S]*?\n  \};/);
expect(Boolean(appMcqSubmit), 'App.handleSubmitCipmnMcq must exist.');
if (appMcqSubmit) {
  expect(appMcqSubmit[0].includes("currentSection: 'theory'"), 'MCQ submission must preserve the same live session as Theory-ready after scoring.');
  expect(!appMcqSubmit[0].includes("setView('dashboard')"), 'Normal MCQ submission must not force a return to the Module Hub before the scorecard.');
  expect(!appMcqSubmit[0].includes('setSelectedTest(null)'), 'Normal MCQ submission must keep the active examination mounted for the scorecard.');
}

expect(
  experience.includes('submitMcqAndHydrateTheory'),
  'CipmnExamExperience must securely hydrate the server-authoritative Theory payload after MCQ submission.',
);
expect(
  experience.includes('getProctoredExamPayload'),
  'Theory hydration must use the protected server-authoritative payload.',
);
expect(
  mixedScreen.includes("setSection('mcq_result')"),
  'Successful MCQ submission must enter the historical MCQ result checkpoint.',
);
expect(
  mixedScreen.includes('Section A Complete'),
  'The MCQ result checkpoint must show Section A Complete.',
);
expect(
  mixedScreen.includes('MCQ Score: {mcqScore}%'),
  'The MCQ result checkpoint must display the MCQ score.',
);
expect(
  mixedScreen.includes('Proceed to Theory'),
  'The MCQ result checkpoint must provide the explicit Proceed to Theory action.',
);
expect(
  mixedScreen.includes("setSection('theory');setIndex(0)"),
  'Proceed to Theory must open the five Theory questions inside the active secure examination.',
);
expect(
  mixedScreen.includes("'Confirm Final Submission'"),
  'Theory completion must retain the final submission confirmation.',
);
expect(
  hub.includes("theoryReady?'Complete Theory First'"),
  'The Module Hub must protect a Theory-ready recovery session from a destructive MCQ retake.',
);
expect(
  hub.includes("const canAttemptMcq=examUnlocked&&!theoryReady"),
  'MCQ retake must remain disabled while a Theory-ready recovery session is active.',
);
expect(
  migration.includes("if v_session.current_section='theory' then"),
  'The server guard must explicitly protect an active Theory session.',
);
expect(
  !migration.includes("set status='terminated'"),
  'The server guard must never terminate an active Theory session to start another MCQ attempt.',
);

if (!process.exitCode) {
  console.log('[cipmn-approved-flow] Historical continuous MCQ-to-Theory flow and recovery safeguards passed.');
}

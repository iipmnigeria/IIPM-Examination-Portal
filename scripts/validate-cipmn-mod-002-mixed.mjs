import fs from 'node:fs';

const path = 'supabase/migrations/20260925214500_cipmn_mod_002_mixed_exam.sql';
const sql = fs.readFileSync(path, 'utf8');

const fail = (message) => {
  console.error('[cipmn-mod-002-mixed] ' + message);
  process.exitCode = 1;
};
const expect = (condition, message) => {
  if (!condition) fail(message);
};

expect(sql.includes("'fe7a116b-72ef-5d1f-acc8-36938ee8b0cf'"), 'Migration must target only Module 2 examination id.');
expect(sql.includes("if v_format='cipmn_mixed' then"), 'Migration must abort on rerun against an already mixed exam.');
expect(sql.includes("status='active'") && sql.includes("expires_at<=now()"), 'Migration must expire only stale active sessions.');
expect(sql.includes("expires_at>now()"), 'Migration must check for genuinely live sessions.');
expect(sql.includes('conversion aborted.'), 'Migration must abort when a live session exists.');
expect(!/delete\s+from\s+public\.questions/i.test(sql), 'Historical questions must never be deleted.');
expect(sql.includes('position>25'), 'Only legacy questions after position 25 may be retired.');
expect(sql.includes('position=retirement.position+1000'), 'Retired questions must be moved out of active positions, preserving history.');
expect((sql.match(/'theory','theory',2[6-9]|'theory','theory',30/g) || []).length === 5, 'Migration must add exactly five Theory questions.');
expect((sql.match(/insert into public\.theory_marking_rubrics/g) || []).length === 5, 'Migration must add exactly five Theory rubrics.');
expect(sql.includes("if v_mcq<>25"), 'Migration must assert exactly 25 active MCQs.');
expect(sql.includes("if v_theory<>5"), 'Migration must assert exactly 5 active Theory questions.');
expect(sql.includes("if v_keys<>25"), 'Migration must assert 25 MCQ answer keys.');
expect(sql.includes("if v_rubrics<>5"), 'Migration must assert 5 active Theory rubrics.');
expect(sql.includes("if v_bad_mcq<>0"), 'Migration must reject incomplete MCQs.');
expect(sql.lastIndexOf("set exam_format='cipmn_mixed'") > sql.lastIndexOf('$verify$'), 'Exam format must change only after invariant verification.');
expect(!/update\s+public\.attempts/i.test(sql), 'Existing attempts must not be modified.');
expect(!/delete\s+from\s+public\.candidate_answers/i.test(sql), 'Candidate answers must not be deleted.');
expect(!/update\s+public\.exam_assignments/i.test(sql), 'Existing assignment history must not be modified.');

if (!process.exitCode) {
  console.log('[cipmn-mod-002-mixed] Migration safety contracts passed.');
}

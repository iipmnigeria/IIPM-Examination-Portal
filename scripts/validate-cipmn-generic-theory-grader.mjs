import fs from 'node:fs';

const source = fs.readFileSync('supabase/functions/grade-cipmn-theory/index.ts', 'utf8');
const fail = (message) => {
  console.error('[cipmn-theory-grader] ' + message);
  process.exitCode = 1;
};
const expect = (condition, message) => {
  if (!condition) fail(message);
};

expect(
  source.includes("import { createClient } from 'npm:@supabase/supabase-js@2.116.0';"),
  'Supabase JS dependency must stay pinned to the approved exact version.',
);
expect(
  !source.includes('CIPMN Module 001'),
  'Theory grader must not hard-code Module 001.',
);
expect(
  source.includes('You are an examination marker for ${exam.title}.'),
  'Theory grader prompt must use the live examination title.',
);
expect(
  source.includes('number: index + 1'),
  'Theory question numbering must be independent of database position offsets.',
);
expect(
  !source.includes('position-25') && !source.includes('position - 25'),
  'Theory grader must not assume Theory always starts at position 26.',
);
expect(
  source.includes("admin.rpc('agilecert_cipmn_weighted_score'"),
  'Final score must use the central CIPMN weighted score contract.',
);
expect(
  !source.includes('(mcqPct+theoryPct)/2') && !source.includes('(mcqPercentage + theoryPercentage) / 2'),
  'Legacy 50/50 arithmetic must not reappear.',
);
expect(
  source.includes("rows.length !== 5"),
  'Grader must require the complete five-question Theory submission.',
);
expect(
  source.includes("rubric?.rubric"),
  'Every Theory question must have an approved marking rubric.',
);
expect(
  source.includes('theoryMaximum = gradingInput.reduce'),
  'Theory percentage must derive from the actual rubric maxima.',
);
expect(
  source.includes('Human review/override remains available.'),
  'Human review/override must remain explicitly preserved.',
);

if (!process.exitCode) {
  console.log('[cipmn-theory-grader] All generic grader regression contracts passed.');
}

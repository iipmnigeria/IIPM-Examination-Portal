import fs from 'node:fs';

const path = 'supabase/migrations/20260925230000_cipmn_mod_002_pptx_question_bank.sql';
const sql = fs.readFileSync(path, 'utf8');

const fail = (message) => {
  console.error('[cipmn-mod-002-pptx-bank] ' + message);
  process.exitCode = 1;
};
const expect = (condition, message) => {
  if (!condition) fail(message);
};

function extract(tag) {
  const match = sql.match(new RegExp('\\$' + tag + '\\$\\n([\\s\\S]*?)\\n\\$' + tag + '\\$::jsonb;'));
  if (!match) throw new Error('Could not extract ' + tag + ' JSON bank.');
  return JSON.parse(match[1]);
}

function normalizedTokens(text) {
  const stop = new Set(['a','an','the','and','or','to','of','in','on','for','with','which','is','are','from','this','that','most','module']);
  return new Set((text.toLowerCase().match(/[a-z0-9]+/g) || []).filter(token => !stop.has(token)));
}

function jaccard(a,b) {
  const A=normalizedTokens(a), B=normalizedTokens(b);
  const intersection=[...A].filter(x=>B.has(x)).length;
  const union=new Set([...A,...B]).size;
  return union ? intersection/union : 0;
}

const mcqs = extract('mcq');
const theory = extract('theory');

expect(mcqs.length === 25, 'Bank must contain exactly 25 MCQs.');
expect(theory.length === 5, 'Bank must contain exactly 5 Theory questions.');

const positions = [...mcqs,...theory].map(item => Number(item.position));
expect(new Set(positions).size === 30, 'Question positions must be unique.');
expect(Math.min(...positions) === 1 && Math.max(...positions) === 30, 'Question positions must cover 1-30.');

for (const item of mcqs) {
  expect(Array.isArray(item.options) && item.options.length === 4, 'Every MCQ must have four options at position ' + item.position + '.');
  expect(new Set(item.options.map(x=>x.trim().toLowerCase())).size === 4, 'MCQ options must be unique at position ' + item.position + '.');
  expect(Number.isInteger(item.correct) && item.correct >= 1 && item.correct <= 4, 'Correct option must be 1-4 at position ' + item.position + '.');
  expect(item.question.trim().length >= 45, 'MCQ must be substantive at position ' + item.position + '.');
}

for (const item of theory) {
  expect(Array.isArray(item.criteria) && item.criteria.length === 5, 'Every Theory question must have five rubric criteria at position ' + item.position + '.');
  expect(item.criteria.every(c => Number(c.marks) === 2), 'Each Theory rubric criterion must be worth 2 marks at position ' + item.position + '.');
  expect(item.criteria.reduce((sum,c)=>sum+Number(c.marks),0) === 10, 'Theory rubric must total 10 marks at position ' + item.position + '.');
}

const allQuestions=[...mcqs,...theory];
const normalized=allQuestions.map(item=>item.question.toLowerCase().replace(/\s+/g,' ').trim());
expect(new Set(normalized).size === 30, 'No question text may repeat exactly.');

for (let i=0;i<mcqs.length;i++) {
  for (let j=i+1;j<mcqs.length;j++) {
    const similarity=jaccard(mcqs[i].question,mcqs[j].question);
    expect(similarity < 0.60, 'MCQs ' + (i+1) + ' and ' + (j+1) + ' are too similar (' + similarity.toFixed(2) + ').');
  }
}

const joined=allQuestions.map(item=>item.question).join(' ') + ' ' + theory.flatMap(item=>item.criteria.map(c=>c.expected)).join(' ');
for (const required of ['Waterfall','CPM','Agile','Scrum','Kanban','Lean','PRINCE2','PMBOK','DUCAP','WBS','Gantt','RACI','Risk Register','scoring']) {
  expect(joined.toLowerCase().includes(required.toLowerCase()), 'Required slide topic is not assessed: ' + required);
}

for (const forbidden of ['management by exception','continued business justification','delegated tolerance','regulatory approval','vendor governance','sustainability concerns','cultural expectations']) {
  expect(!joined.toLowerCase().includes(forbidden), 'Question bank includes content outside the supplied deck: ' + forbidden);
}

expect(sql.includes("status='active'") && sql.includes('expires_at>now()'), 'Migration must block while a genuinely live session exists.');
expect(!/delete\s+from\s+public\.questions/i.test(sql), 'Historical questions must not be deleted.');
expect(!/update\s+public\.attempts/i.test(sql), 'Historical attempts must not be modified.');
expect(!/delete\s+from\s+public\.candidate_answers/i.test(sql), 'Candidate answers must not be deleted.');
expect(sql.includes('CIPMN-MOD-002.pptx (37 slides; supplied 2026-09-25)'), 'Theory rubrics must identify the supplied PPTX as their source.');

if (!process.exitCode) {
  console.log('[cipmn-mod-002-pptx-bank] 25 MCQs + 5 Theory questions passed source-scope, uniqueness, difficulty-structure and migration-safety checks.');
}

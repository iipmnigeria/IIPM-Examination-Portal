import fs from 'node:fs';

const path='supabase/migrations/20260926093000_cipmn_el01_outcome_realisation.sql';
const sql=fs.readFileSync(path,'utf8');
const fail=(m)=>{console.error('[cipmn-el01-outcome-realisation] '+m);process.exitCode=1;};
const expect=(c,m)=>{if(!c) fail(m);};

function extract(tag){
  const m=sql.match(new RegExp('\\$'+tag+'\\$\\n([\\s\\S]*?)\\n\\$'+tag+'\\$::jsonb;'));
  if(!m) throw new Error('Could not extract '+tag+' JSON bank.');
  return JSON.parse(m[1]);
}
function tokens(text){
  const stop=new Set(['a','an','the','and','or','to','of','in','on','for','with','which','is','are','from','this','that','most','module','project','projects']);
  return new Set((text.toLowerCase().match(/[a-z0-9]+/g)||[]).filter(x=>!stop.has(x)));
}
function jaccard(a,b){
  const A=tokens(a),B=tokens(b);
  const inter=[...A].filter(x=>B.has(x)).length;
  const union=new Set([...A,...B]).size;
  return union?inter/union:0;
}

const mcqs=extract('mcq');
const theory=extract('theory');

expect(mcqs.length===25,'Must contain exactly 25 MCQs.');
expect(theory.length===5,'Must contain exactly 5 Theory questions.');

const positions=[...mcqs,...theory].map(x=>Number(x.position));
expect(new Set(positions).size===30,'Question positions must be unique.');
expect(Math.min(...positions)===1&&Math.max(...positions)===30,'Positions must cover 1-30.');

const answerPositions=new Set();
for(const q of mcqs){
  expect(Array.isArray(q.options)&&q.options.length===4,'MCQ '+q.position+' must have four options.');
  expect(new Set(q.options.map(x=>x.trim().toLowerCase())).size===4,'MCQ '+q.position+' options must be unique.');
  expect(Number.isInteger(q.correct)&&q.correct>=1&&q.correct<=4,'MCQ '+q.position+' correct option must be 1-4.');
  expect(q.question.trim().length>=45,'MCQ '+q.position+' must be substantive.');
  answerPositions.add(q.correct);
}
expect(answerPositions.size===4,'Correct answers must use all four option positions.');

for(const q of theory){
  expect(Array.isArray(q.criteria)&&q.criteria.length===5,'Theory '+q.position+' must have five criteria.');
  expect(q.criteria.every(c=>Number(c.marks)===2),'Every Theory criterion must be worth 2 marks.');
  expect(q.criteria.reduce((s,c)=>s+Number(c.marks),0)===10,'Theory '+q.position+' must total 10 marks.');
}

const all=[...mcqs,...theory];
const normalized=all.map(x=>x.question.toLowerCase().replace(/\s+/g,' ').trim());
expect(new Set(normalized).size===30,'Exact duplicate question text detected.');

for(let i=0;i<mcqs.length;i++){
  for(let j=i+1;j<mcqs.length;j++){
    const sim=jaccard(mcqs[i].question,mcqs[j].question);
    expect(sim<0.58,'MCQs '+(i+1)+' and '+(j+1)+' too similar ('+sim.toFixed(2)+').');
  }
}

const joined=[
  ...all.map(x=>x.question),
  ...mcqs.flatMap(x=>x.options),
  ...theory.flatMap(x=>x.criteria.map(c=>c.expected))
].join(' ').toLowerCase();

for(const required of [
  'outcome realisation','outputs','outcomes','benefits','activity trap',
  'kaduna','rural-road','travel time','agricultural income',
  'benefits realisation management','identify and quantify','value and appraise',
  'plan','realise','review','benefit management strategy',
  'baseline','midline','endline','post-project review',
  'national m&e policy 2020','donor-driven','community engagement',
  'performance scorecards','national development plan 2021–2025',
  'nigeria vision 2050','sustainable development goals',
  'infrastructure','health','education','ppp','weak m&e','corruption',
  'political interference','community ownership','strong governance'
]){
  expect(joined.includes(required),'Required EL01 source topic not assessed: '+required);
}

for(const forbidden of [
  'managing successful programmes','msp benefits','benefits dependency network',
  'p3m3','logic model matrix','social return on investment','sroi',
  'net present value of benefits','balanced scorecard framework',
  'theory of constraints','okr framework','benefits owner rasic'
]){
  expect(!joined.includes(forbidden),'Unsupported outside BRM/outcome-realisation content found: '+forbidden);
}

expect(sql.includes("'CIPMN-MOD-EL01'"),'Migration must create the EL01 examination code.');
expect(sql.includes("'draft'")&&sql.includes("'standard'"),'EL01 must be created non-launchable before verification.');
expect(sql.includes("set exam_format='cipmn_mixed'")&&sql.includes("status='published'"),'EL01 must publish as cipmn_mixed only after verification.');
expect(sql.lastIndexOf("status='published'")>sql.lastIndexOf('$verify$'),'Publication must occur after the verification block.');
expect(sql.includes("2500000")&&sql.includes("'NGN'"),'EL01 must include the current NGN exam access price.');
expect(sql.includes("5000")&&sql.includes("'USD'"),'EL01 must include the current USD exam access price.');
expect(sql.includes("require_camera")&&sql.includes("ai_visual_analysis_enabled"),'EL01 must include the established CIPMN proctoring policy.');
expect(!/delete\s+from\s+public\./i.test(sql),'EL01 creation migration must not delete production data.');
expect(!/update\s+public\.attempts/i.test(sql),'Historical attempts must not be modified.');
expect(!/delete\s+from\s+public\.candidate_answers/i.test(sql),'Candidate answers must not be deleted.');
expect(sql.includes('CIPMN-MOD-EL01.pptx (36 slides/pages; reviewed 2026-09-26)'),'Theory rubrics must identify the authoritative EL01 deck.');

if(!process.exitCode) console.log('[cipmn-el01-outcome-realisation] Source scope, uniqueness, staged creation, commerce and migration safety checks passed.');

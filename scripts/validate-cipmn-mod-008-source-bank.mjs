import fs from 'node:fs';

const path='supabase/migrations/20260926043000_cipmn_mod_008_source_question_bank.sql';
const sql=fs.readFileSync(path,'utf8');
const fail=(m)=>{console.error('[cipmn-mod-008-source-bank] '+m);process.exitCode=1;};
const expect=(c,m)=>{if(!c) fail(m);};

function extract(tag){
  const m=sql.match(new RegExp('\\$'+tag+'\\$\\n([\\s\\S]*?)\\n\\$'+tag+'\\$::jsonb;'));
  if(!m) throw new Error('Could not extract '+tag+' JSON bank.');
  return JSON.parse(m[1]);
}
function tokens(text){
  const stop=new Set(['a','an','the','and','or','to','of','in','on','for','with','which','is','are','from','this','that','most','module','project','quality','management']);
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
  'quality vs grade','precision','accuracy','prevention','inspection',
  'quality planning','quality management plan','quality metrics','acceptance criteria',
  'quality assurance','quality control','quality audit','kaizen','lean','six sigma','dmaic','pdsa',
  'statistical sampling','control chart','pareto chart','histogram','scatter diagram','flowchart',
  'check sheet','fishbone','corrective action','preventive action','iso 9001','tqm',
  'appraisal cost','internal failure','external failure','raci','smart kpis',
  'quality dashboards','lessons learned'
]){
  expect(joined.includes(required),'Required official-source topic not assessed: '+required);
}

for(const forbidden of [
  'process capability index','cpk','six sigma 3.4 defects per million','dmaic tollgate',
  'house of quality','quality function deployment','malcolm baldrige',
  'taguchi loss function','fmea risk priority number','rpn formula',
  'cost performance index','schedule performance index'
]){
  expect(!joined.includes(forbidden),'Unsupported outside/deeper quality content found: '+forbidden);
}

expect(sql.includes("status='active'")&&sql.includes('expires_at>now()'),'Migration must block on genuinely live sessions.');
expect(sql.includes('position=position+17000'),'Legacy questions must be retired out of active positions.');
expect(!/delete\s+from\s+public\.questions/i.test(sql),'Historical questions must not be deleted.');
expect(!/update\s+public\.attempts/i.test(sql),'Historical attempts must not be modified.');
expect(!/delete\s+from\s+public\.candidate_answers/i.test(sql),'Candidate answers must not be deleted.');
expect(sql.includes("set exam_format='cipmn_mixed'")&&sql.lastIndexOf("set exam_format='cipmn_mixed'")>sql.lastIndexOf('$verify$'),'Format switch must occur only after verification.');
expect(sql.includes('CIPMN-MOD-008 official PDF + PPTX; reviewed 2026-09-26'),'Theory rubrics must identify both official Module 8 sources.');

if(!process.exitCode) console.log('[cipmn-mod-008-source-bank] Official-source scope, uniqueness, answer diversity and migration safety checks passed.');

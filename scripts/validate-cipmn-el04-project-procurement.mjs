import fs from 'node:fs';

const path='supabase/migrations/20260926123000_cipmn_el04_project_procurement.sql';
const sql=fs.readFileSync(path,'utf8');
const fail=(m)=>{console.error('[cipmn-el04-project-procurement] '+m);process.exitCode=1;};
const expect=(c,m)=>{if(!c) fail(m);};

function extract(tag){
  const m=sql.match(new RegExp('\\$'+tag+'\\$\\n([\\s\\S]*?)\\n\\$'+tag+'\\$::jsonb;'));
  if(!m) throw new Error('Could not extract '+tag+' JSON bank.');
  return JSON.parse(m[1]);
}
function tokens(text){
  const stop=new Set(['a','an','the','and','or','to','of','in','on','for','with','which','is','are','from','this','that','most','module','project','procurement','management']);
  return new Set((text.toLowerCase().match(/[a-z0-9₦$]+/g)||[]).filter(x=>!stop.has(x)));
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
  'public procurement act 2007','bureau of public procurement','national council on public procurement',
  'certificate of no objection','value for money','open competitive bidding',
  'needs assessment','market analysis','import dependency','pricing trends',
  'financial','performance','legal/regulatory','ethical','logistical',
  'local-content','nafdac','two-stage tendering','total cost of ownership',
  'request for quotations','restricted','direct','emergency procurement',
  'less than ₦30','less than ₦50',
  'vendor relationship management','supplier performance management',
  'service level agreements','lagos blue line',
  'performance guarantee','kickoff','change management','payment administration',
  'negotiation','mediation','conciliation','arbitration','litigation',
  'integrity','objectivity','fairness','professionalism','accountability',
  'p&id','bribery','conflicts of interest'
]){
  expect(joined.includes(required),'Required EL04 source topic not assessed: '+required);
}

for(const forbidden of [
  'federal acquisition regulation','far clause',
  'incoterms','fidic red book','fidic yellow book','nec4','jct contract',
  'kraljic matrix','porter five forces','economic order quantity','eoq',
  'total cost of ownership formula','net present value','internal rate of return',
  'procurement maturity model','supplier preferencing model',
  'arbitration and mediation act 2023','seat of arbitration','lex arbitri',
  'nigeria data protection act 2023','gdpr'
]){
  expect(!joined.includes(forbidden),'Unsupported outside EL04 content found: '+forbidden);
}

expect(sql.includes("'CIPMN-MOD-EL04'"),'Migration must create the EL04 examination code.');
expect(sql.includes("'draft'")&&sql.includes("'standard'"),'EL04 must begin non-launchable.');
expect(sql.includes("set exam_format='cipmn_mixed'")&&sql.includes("status='published'"),'EL04 must publish only after verification.');
expect(sql.lastIndexOf("status='published'")>sql.lastIndexOf('$verify$'),'Publication must occur after verification.');
expect(sql.includes("2500000")&&sql.includes("'NGN'"),'EL04 must include current NGN paid pricing policy.');
expect(sql.includes("require_camera=true"),'EL04 must require camera.');
expect(sql.includes("live_event_capture_enabled=true"),'EL04 must enable live proctor events.');
expect(sql.includes("ai_visual_analysis_enabled=true"),'EL04 must enable AI visual analysis.');
expect(!/delete\s+from\s+public\./i.test(sql),'EL04 migration must not delete production data.');
expect(!/update\s+public\.attempts/i.test(sql),'Historical attempts must not be modified.');
expect(!/delete\s+from\s+public\.candidate_answers/i.test(sql),'Candidate answers must not be deleted.');
expect(sql.includes('CIPMN-MOD-EL04.pptx (73 slides/pages; reviewed 2026-09-26)'),'Theory rubrics must identify the authoritative EL04 deck.');

if(!process.exitCode) console.log('[cipmn-el04-project-procurement] Source scope, thresholds, uniqueness, staged creation, commerce and migration safety checks passed.');

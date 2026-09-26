import fs from 'node:fs';

const path='supabase/migrations/20260926113000_cipmn_el03_accounting_budget.sql';
const sql=fs.readFileSync(path,'utf8');
const fail=(m)=>{console.error('[cipmn-el03-accounting-budget] '+m);process.exitCode=1;};
const expect=(c,m)=>{if(!c) fail(m);};

function extract(tag){
  const m=sql.match(new RegExp('\\$'+tag+'\\$\\n([\\s\\S]*?)\\n\\$'+tag+'\\$::jsonb;'));
  if(!m) throw new Error('Could not extract '+tag+' JSON bank.');
  return JSON.parse(m[1]);
}
function tokens(text){
  const stop=new Set(['a','an','the','and','or','to','of','in','on','for','with','which','is','are','from','this','that','most','module','project','financial','cost','budget']);
  return new Set((text.toLowerCase().match(/[a-z0-9₦]+/g)||[]).filter(x=>!stop.has(x)));
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
  'project financials','cost estimation','project budgeting','direct','indirect','capital','operating',
  'contingency reserve','management reserve','analogous','parametric','bottom-up','three-point',
  'cost baseline','planned value','earned value','actual cost','cost variance','schedule variance',
  'cost performance index','schedule performance index','estimate at completion',
  'estimate to complete','variance at completion','financial reporting','financial forecasting',
  'trend analysis','moving average','regression analysis','earned value forecasting',
  'scenario','sensitivity','financial risk','risk identification','risk assessment',
  'risk prioritization','risk avoidance','risk mitigation','risk transfer','risk acceptance',
  'change request','change control board','impact analysis','cost baseline update',
  'ogun state','lagos urban drainage','smart city infrastructure','abuja affordable-housing'
]){
  expect(joined.includes(required),'Required EL03 source topic not assessed: '+required);
}

for(const requiredFormula of [
  'cv=ev-ac','sv=ev-pv','cpi=ev/ac','spi=ev/pv','eac=bac/cpi','etc=eac-ac','vac=bac-eac'
]){
  const compact=joined.replace(/\s+/g,'').replace(/[()]/g,'').replace(/÷/g,'/').replace(/–/g,'-').replace(/—/g,'-');
  expect(compact.includes(requiredFormula),'Required EL03 formula not represented: '+requiredFormula);
}

// Block formulas/frameworks not taught in the deck.
for(const forbidden of [
  'to-complete performance index','tcpi',
  'eac=ac+(bac-ev)','eac=ac+(bac-ev)/(cpi*spi)',
  'schedule performance index at completion','earned schedule',
  'net present value formula','internal rate of return formula',
  'weighted average cost of capital','wacc',
  'activity based costing','abc costing',
  'zero based budgeting','rolling wave budgeting',
  'value engineering function analysis','parametric regression coefficient'
]){
  expect(!joined.includes(forbidden),'Unsupported outside EL03 content found: '+forbidden);
}

expect(sql.includes("'CIPMN-MOD-EL03'"),'Migration must create the EL03 examination code.');
expect(sql.includes("'draft'")&&sql.includes("'standard'"),'EL03 must begin non-launchable.');
expect(sql.includes("set exam_format='cipmn_mixed'")&&sql.includes("status='published'"),'EL03 must publish only after verification.');
expect(sql.lastIndexOf("status='published'")>sql.lastIndexOf('$verify$'),'Publication must occur after verification.');
expect(sql.includes("2500000")&&sql.includes("'NGN'"),'EL03 must include current NGN paid pricing policy.');
expect(sql.includes("require_camera=true"),'EL03 must require camera.');
expect(sql.includes("live_event_capture_enabled=true"),'EL03 must enable live proctor events.');
expect(sql.includes("ai_visual_analysis_enabled=true"),'EL03 must enable AI visual analysis.');
expect(!/delete\s+from\s+public\./i.test(sql),'EL03 migration must not delete production data.');
expect(!/update\s+public\.attempts/i.test(sql),'Historical attempts must not be modified.');
expect(!/delete\s+from\s+public\.candidate_answers/i.test(sql),'Candidate answers must not be deleted.');
expect(sql.includes('CIPMN-MOD-EL03.pptx (50 slides/pages; reviewed 2026-09-26)'),'Theory rubrics must identify the authoritative EL03 deck.');

if(!process.exitCode) console.log('[cipmn-el03-accounting-budget] Source scope, formulas, uniqueness, staged creation, commerce and migration safety checks passed.');

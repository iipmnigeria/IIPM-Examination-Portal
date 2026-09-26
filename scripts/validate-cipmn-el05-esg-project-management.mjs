import fs from 'node:fs';

const path='supabase/migrations/20260926143000_cipmn_el05_esg_project_management.sql';
const sql=fs.readFileSync(path,'utf8');
const fail=(m)=>{console.error('[cipmn-el05-esg-project-management] '+m);process.exitCode=1;};
const expect=(c,m)=>{if(!c) fail(m);};

function extract(tag){
  const m=sql.match(new RegExp('\\$'+tag+'\\$\\n([\\s\\S]*?)\\n\\$'+tag+'\\$::jsonb;'));
  if(!m) throw new Error('Could not extract '+tag+' JSON bank.');
  return JSON.parse(m[1]);
}
function tokens(text){
  const stop=new Set(['a','an','the','and','or','to','of','in','on','for','with','which','is','are','from','this','that','most','module','project','projects','management','esg']);
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
for(let i=0;i<mcqs.length;i++) for(let j=i+1;j<mcqs.length;j++){
  const sim=jaccard(mcqs[i].question,mcqs[j].question);
  expect(sim<0.58,'MCQs '+(i+1)+' and '+(j+1)+' too similar ('+sim.toFixed(2)+').');
}

const joined=[...all.map(x=>x.question),...mcqs.flatMap(x=>x.options),...theory.flatMap(x=>x.criteria.map(c=>c.expected))].join(' ').toLowerCase();
for(const required of [
  'environmental','social','governance','triple bottom line','people','planet','profit',
  'global reporting initiative','sustainability accounting standards board','task force on climate-related financial disclosures',
  'international sustainability standards board','ifrs s1','ifrs s2','nigerian sustainable banking principles',
  'climate change act 2021','energy transition plan','net-zero','life cycle assessment','life cycle costing',
  'green procurement','sustainable supply chains','azura-edo','lekki deep sea port','solar power naija',
  'environmental impact assessment','screening','scoping','social impact assessment','corporate social responsibility',
  'cama 2020','uk bribery act','fcpa','stakeholder engagement','grievance',
  'ideation','initiation','planning','execution','monitoring','closing'
]) expect(joined.includes(required),'Required EL05 source topic not assessed: '+required);

for(const forbidden of [
  'public procurement act 2007','bureau of public procurement','certificate of no objection',
  'open competitive bidding','request for quotations','performance guarantee','p&id',
  'fidic red book','nec4','kraljic matrix','economic order quantity'
]) expect(!joined.includes(forbidden),'Unsupported outside EL05 content found: '+forbidden);

expect(sql.includes("'CIPMN-MOD-EL05'"),'Migration must create the EL05 examination code.');
expect(sql.includes("'draft'")&&sql.includes("'standard'"),'EL05 must begin non-launchable.');
expect(sql.includes("set exam_format='cipmn_mixed'")&&sql.includes("status='published'"),'EL05 must publish only after verification.');
expect(sql.lastIndexOf("status='published'")>sql.lastIndexOf('$verify$'),'Publication must occur after verification.');
expect(sql.includes('2500000')&&sql.includes("'NGN'"),'EL05 must include current NGN paid pricing policy.');
expect(sql.includes('require_camera=true'),'EL05 must require camera.');
expect(sql.includes('live_event_capture_enabled=true'),'EL05 must enable live proctor events.');
expect(sql.includes('ai_visual_analysis_enabled=true'),'EL05 must enable AI visual analysis.');
expect(!/delete\s+from\s+public\./i.test(sql),'EL05 migration must not delete production data.');
expect(!/update\s+public\.attempts/i.test(sql),'Historical attempts must not be modified.');
expect(!/delete\s+from\s+public\.candidate_answers/i.test(sql),'Candidate answers must not be deleted.');
expect(sql.includes('CIPMN-MOD-EL05.pptx (46 slides/pages; reviewed 2026-09-26)'),'Theory rubrics must identify the authoritative EL05 deck.');

if(!process.exitCode) console.log('[cipmn-el05-esg-project-management] Source scope, uniqueness, staged creation, commerce and migration safety checks passed.');

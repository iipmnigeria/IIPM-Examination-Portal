import fs from 'node:fs';

const path='supabase/migrations/20260926033000_cipmn_mod_007_pptx_question_bank.sql';
const sql=fs.readFileSync(path,'utf8');
const fail=(m)=>{console.error('[cipmn-mod-007-pptx-bank] '+m);process.exitCode=1;};
const expect=(c,m)=>{if(!c) fail(m);};

function extract(tag){
  const m=sql.match(new RegExp('\\$'+tag+'\\$\\n([\\s\\S]*?)\\n\\$'+tag+'\\$::jsonb;'));
  if(!m) throw new Error('Could not extract '+tag+' JSON bank.');
  return JSON.parse(m[1]);
}
function tokens(text){
  const stop=new Set(['a','an','the','and','or','to','of','in','on','for','with','which','is','are','from','this','that','most','module','project','scope','change','management']);
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
expect(new Set(positions).size===30,'Positions must be unique.');
expect(Math.min(...positions)===1&&Math.max(...positions)===30,'Positions must cover 1-30.');

const answers=new Set();
for(const q of mcqs){
  expect(Array.isArray(q.options)&&q.options.length===4,'MCQ '+q.position+' must have four options.');
  expect(new Set(q.options.map(x=>x.trim().toLowerCase())).size===4,'MCQ '+q.position+' options must be unique.');
  expect(Number.isInteger(q.correct)&&q.correct>=1&&q.correct<=4,'MCQ '+q.position+' correct index invalid.');
  expect(q.question.trim().length>=40,'MCQ '+q.position+' is too short.');
  answers.add(q.correct);
}
expect(answers.size===4,'Correct answers must use all four option positions.');

for(const q of theory){
  expect(Array.isArray(q.criteria)&&q.criteria.length===5,'Theory '+q.position+' must have five criteria.');
  expect(q.criteria.every(c=>Number(c.marks)===2),'Each Theory criterion must be worth 2 marks.');
  expect(q.criteria.reduce((s,c)=>s+Number(c.marks),0)===10,'Theory '+q.position+' must total 10 marks.');
}

const all=[...mcqs,...theory];
const exact=all.map(x=>x.question.toLowerCase().replace(/\s+/g,' ').trim());
expect(new Set(exact).size===30,'Exact duplicate question text detected.');

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
  'project scope management','product scope','scope baseline','work breakdown structure',
  'facilitator','guardian','communicator','integrator','scope creep','gold plating',
  'moscow','requirements gathering','interviews','workshops','brainstorming','focus groups',
  'questionnaires','prototyping','observation','document analysis','requirements management plan',
  'requirements traceability matrix','scope statement','wbs dictionary','variance analysis',
  'performance reporting','change request form','change control board','people','process',
  'technology','culture','pestle','stakeholder engagement','resistance management',
  'community borehole'
]){
  expect(joined.includes(required),'Required deck topic not assessed: '+required);
}

for(const forbidden of [
  'unfreeze change refreeze','create urgency','form a powerful coalition','anchor changes in culture',
  'adkar','prosci adkar','force field analysis','balanced scorecard',
  'earned value formula','cpi','spi','net present value'
]){
  expect(!joined.includes(forbidden),'Unsupported outside/deeper content found: '+forbidden);
}

expect(sql.includes("status='active'")&&sql.includes('expires_at>now()'),'Must block on genuinely live sessions.');
expect(sql.includes('position=position+15000'),'Must retire legacy questions out of active positions.');
expect(!/delete\s+from\s+public\.questions/i.test(sql),'Historical questions must not be deleted.');
expect(!/update\s+public\.attempts/i.test(sql),'Historical attempts must not be modified.');
expect(!/delete\s+from\s+public\.candidate_answers/i.test(sql),'Candidate answers must not be deleted.');
expect(sql.includes("set exam_format='cipmn_mixed'")&&sql.lastIndexOf("set exam_format='cipmn_mixed'")>sql.lastIndexOf('$verify$'),'Format switch must occur only after verification.');
expect(sql.includes('CIPMN-MOD-007.pptx (74 slides; reviewed 2026-09-26)'),'Theory rubrics must identify the sole official source.');

if(!process.exitCode) console.log('[cipmn-mod-007-pptx-bank] Deck scope, uniqueness, answer diversity and migration safety checks passed.');

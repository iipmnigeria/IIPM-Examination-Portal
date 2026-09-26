import fs from 'node:fs';

const path='supabase/migrations/20260926073000_cipmn_mod_011_pdf_question_bank.sql';
const sql=fs.readFileSync(path,'utf8');
const fail=(m)=>{console.error('[cipmn-mod-011-pdf-bank] '+m);process.exitCode=1;};
const expect=(c,m)=>{if(!c) fail(m);};

function extract(tag){
  const m=sql.match(new RegExp('\\$'+tag+'\\$\\n([\\s\\S]*?)\\n\\$'+tag+'\\$::jsonb;'));
  if(!m) throw new Error('Could not extract '+tag+' JSON bank.');
  return JSON.parse(m[1]);
}
function tokens(text){
  const stop=new Set(['a','an','the','and','or','to','of','in','on','for','with','which','is','are','from','this','that','most','module','project','ducap']);
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
  'pillar','activity','process','vision',
  'cultural','religious','political sensitivity',
  'lessons learned','project value justification','project case',
  'segmented delivery management','financial sustainability',
  'team cohesion','wellbeing','equality','understanding stakeholders',
  'environmental','post-delivery sustainability',
  'scope & viability','raci','rag','red important/urgent','amber important/not urgent','green important/can be later',
  'quality','regulation','change','risk','schedule','stakeholder/community',
  'outcome realization','project preparatory','implementation/control','closure and handover',
  'segment interaction','project board','continue, redirect or abort','bau',
  'national development','national integration','inclusion'
]){
  expect(joined.includes(required),'Required DUCAP source topic not assessed: '+required);
}

for(const forbidden of [
  'prince2 seven processes','prince2 themes','safe agile','program increment',
  'earned value formula','cost performance index','schedule performance index','pert formula','critical chain',
  'adkar','kotter 8','scrum master','product owner','story points',
  'iso 21500 process groups','pmbok knowledge areas'
]){
  expect(!joined.includes(forbidden),'Unsupported outside/deeper content found: '+forbidden);
}

expect(sql.includes("status='active'")&&sql.includes('expires_at>now()'),'Migration must block on genuinely live sessions.');
expect(sql.includes('position=position+23000'),'Legacy questions must be retired out of active positions.');
expect(!/delete\s+from\s+public\.questions/i.test(sql),'Historical questions must not be deleted.');
expect(!/update\s+public\.attempts/i.test(sql),'Historical attempts must not be modified.');
expect(!/delete\s+from\s+public\.candidate_answers/i.test(sql),'Candidate answers must not be deleted.');
expect(sql.includes("set exam_format='cipmn_mixed'")&&sql.lastIndexOf("set exam_format='cipmn_mixed'")>sql.lastIndexOf('$verify$'),'Format switch must occur only after verification.');
expect(sql.includes('CIPMN-MOD-011.pdf (48 pages; current library edition reviewed 2026-09-26)'),'Theory rubrics must identify the current official Module 11 source.');

if(!process.exitCode) console.log('[cipmn-mod-011-pdf-bank] DUCAP source scope, uniqueness, answer diversity and migration safety checks passed.');

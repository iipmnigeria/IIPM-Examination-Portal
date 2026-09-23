import React, { useMemo, useState } from 'react';
import { CheckCircle, ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import type { ProctorLogEvent, Question, Test } from '../types';

interface Props {
  test: Test;
  studentName: string;
  onSubmitMcq: (answers: Record<string, number>, logs: ProctorLogEvent[], tabAwayCount: number) => Promise<number>;
  onSubmitTheory: (answers: Record<string, string>, logs: ProctorLogEvent[], tabAwayCount: number) => Promise<void>;
}

export default function CipmnMixedExamScreen({ test, studentName, onSubmitMcq, onSubmitTheory }: Props) {
  const mcqs = useMemo(() => test.questions.filter(q => (q.section || q.type) !== 'theory'), [test.questions]);
  const theory = useMemo(() => test.questions.filter(q => q.section === 'theory' || q.type === 'theory'), [test.questions]);
  const [section, setSection] = useState<'mcq'|'mcq_result'|'theory'>('mcq');
  const [index, setIndex] = useState(0);
  const [mcqAnswers, setMcqAnswers] = useState<Record<string, number>>({});
  const [theoryAnswers, setTheoryAnswers] = useState<Record<string, string>>({});
  const [mcqScore, setMcqScore] = useState<number | null>(test.mcqScore ?? null);
  const [busy, setBusy] = useState(false);

  const current: Question | undefined = section === 'theory' ? theory[index] : mcqs[index];
  const list = section === 'theory' ? theory : mcqs;
  const answered = section === 'theory'
    ? Object.values(theoryAnswers).filter(v => v.trim()).length
    : Object.keys(mcqAnswers).length;

  async function submitMcq() {
    if (!test.sessionId || busy) return;
    setBusy(true);
    try {
      const score = await onSubmitMcq(mcqAnswers, [], 0);
      setMcqScore(score);
      setSection('mcq_result');
      setIndex(0);
    } finally { setBusy(false); }
  }

  async function submitTheory() {
    if (!test.sessionId || busy) return;
    setBusy(true);
    try { await onSubmitTheory(theoryAnswers, [], 0); }
    finally { setBusy(false); }
  }

  if (section === 'mcq_result') {
    return <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
      <div className="max-w-xl w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-6">
        <CheckCircle className="w-14 h-14 text-emerald-400 mx-auto" />
        <div><p className="text-xs uppercase tracking-widest text-slate-400 font-bold">Section A Complete</p>
        <h1 className="text-3xl font-extrabold mt-2">MCQ Score: {mcqScore}%</h1></div>
        <p className="text-sm text-slate-300">Your 25 MCQ responses are locked. Continue to the five theory questions to complete this CIPMN examination.</p>
        <button onClick={()=>{setSection('theory');setIndex(0)}} className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-bold">
          Proceed to Theory
        </button>
      </div>
    </div>;
  }

  return <div className="min-h-screen bg-slate-950 text-slate-100">
    <header className="border-b border-slate-800 px-6 py-4 flex justify-between items-center">
      <div><p className="text-xs text-emerald-400 font-bold uppercase">{section==='mcq'?'Section A — MCQ':'Section B — Theory'}</p>
      <h1 className="font-bold">{test.title}</h1><p className="text-xs text-slate-400">Candidate: {studentName}</p></div>
      <div className="text-right"><p className="font-bold">{answered} / {list.length} answered</p>
      {section==='theory' && mcqScore!==null && <p className="text-xs text-slate-400 flex gap-1 items-center justify-end"><Lock className="w-3 h-3"/> MCQ locked: {mcqScore}%</p>}</div>
    </header>
    <main className="max-w-4xl mx-auto p-6 md:p-10 space-y-6">
      <div className="flex flex-wrap gap-2">{list.map((q,i)=><button key={q.id} onClick={()=>setIndex(i)}
        className={`w-10 h-10 rounded-lg border font-bold ${i===index?'bg-emerald-600 border-emerald-500':'bg-slate-900 border-slate-800'}`}>{i+1}</button>)}</div>
      {current && <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-6">
        <div><p className="text-xs text-slate-400 uppercase font-bold tracking-widest">Question {index+1} of {list.length}</p>
        <h2 className="text-lg font-semibold leading-relaxed mt-2 whitespace-pre-line">{current.text}</h2></div>
        {section==='mcq' ? <div className="space-y-3">{current.options.map((o,i)=><button key={i} onClick={()=>setMcqAnswers(a=>({...a,[current.id]:i}))}
          className={`w-full text-left p-4 rounded-xl border ${mcqAnswers[current.id]===i?'border-emerald-500 bg-emerald-500/10':'border-slate-800 bg-slate-950/40'}`}>
          <span className="font-bold mr-2">{String.fromCharCode(65+i)}.</span>{o}</button>)}</div>
        : <div><textarea value={theoryAnswers[current.id]||''} onChange={e=>setTheoryAnswers(a=>({...a,[current.id]:e.target.value}))}
            rows={14} placeholder="Type your answer and calculations here. No drawing or graphical input is required."
            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-sm leading-relaxed focus:border-emerald-500 outline-none"/>
          <p className="text-xs text-slate-500 mt-2">Text and calculation workings are accepted.</p></div>}
      </section>}
      <div className="flex justify-between gap-4">
        <button disabled={index===0} onClick={()=>setIndex(i=>Math.max(0,i-1))} className="px-4 py-2 rounded-lg bg-slate-800 disabled:opacity-30 flex gap-2"><ChevronLeft/> Previous</button>
        {index<list.length-1 ? <button onClick={()=>setIndex(i=>i+1)} className="px-4 py-2 rounded-lg bg-slate-800 flex gap-2">Next <ChevronRight/></button>
        : section==='mcq' ? <button disabled={busy} onClick={submitMcq} className="px-6 py-3 rounded-lg bg-emerald-600 font-bold disabled:opacity-50">{busy?'Submitting...':'Submit MCQ & View Score'}</button>
        : <button disabled={busy} onClick={submitTheory} className="px-6 py-3 rounded-lg bg-emerald-600 font-bold disabled:opacity-50">{busy?'Submitting...':'Submit Theory'}</button>}
      </div>
    </main>
  </div>;
}

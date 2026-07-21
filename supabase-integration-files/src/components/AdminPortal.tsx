import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Search, 
  Filter, 
  AlertTriangle, 
  CheckCircle2, 
  ShieldAlert, 
  FileText, 
  Clock, 
  Eye, 
  Camera, 
  X,
  TrendingUp,
  UserCheck,
  ShieldX
} from 'lucide-react';
import { Attempt, ProctorLogEvent } from '../types';

interface AdminPortalProps {
  attempts: Attempt[];
  onBackToDashboard: () => void;
  onOverrideStatus: (attemptId: string, newStatus: 'submitted' | 'flagged' | 'terminated') => void;
}

export default function AdminPortal({
  attempts,
  onBackToDashboard,
  onOverrideStatus
}: AdminPortalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'submitted' | 'flagged' | 'terminated'>('all');
  const [selectedAttempt, setSelectedAttempt] = useState<Attempt | null>(null);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  // Filter attempts based on search and status
  const filteredAttempts = attempts.filter((attempt) => {
    const matchesSearch = attempt.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          attempt.testTitle.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || attempt.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Calculate high level stats
  const totalAttempts = attempts.length;
  const flaggedAttemptsCount = attempts.filter(a => a.status === 'flagged' || a.suspiciousScore >= 50).length;
  const clearAttemptsCount = totalAttempts - flaggedAttemptsCount;
  const averageScore = totalAttempts > 0 
    ? Math.round(attempts.reduce((sum, a) => sum + (a.score || 0), 0) / totalAttempts)
    : 0;

  return (
    <div id="admin-portal" className="max-w-7xl mx-auto px-4 py-6 space-y-8">
      {/* Admin Dashboard Welcome banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 -mt-8 -mr-8 w-40 h-40 bg-teal-500/10 rounded-full blur-3xl"></div>
        
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-400" />
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">
              Administrator Management Console
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">AI Proctor Integrity Audit</h1>
          <p className="text-slate-400 text-sm max-w-xl">
            Review detailed candidate proctor timelines, inspect visual base64 camera evidence flagged by Gemini AI, and perform override clearances.
          </p>
        </div>

        <button
          onClick={onBackToDashboard}
          className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold border border-slate-700 transition"
        >
          Exit Auditor Panel
        </button>
      </div>

      {/* Overview statistical Grid cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-white border border-slate-100 rounded-xl p-5 shadow-sm space-y-2">
          <p className="text-xs text-slate-400 font-bold uppercase">Total Exam Audits</p>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-extrabold text-slate-950">{totalAttempts}</p>
            <span className="text-xs text-slate-500 font-medium">submissions</span>
          </div>
        </div>

        <div className="bg-white border border-slate-100 rounded-xl p-5 shadow-sm space-y-2">
          <p className="text-xs text-rose-500 font-bold uppercase">High Risk Flags</p>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-extrabold text-rose-600">{flaggedAttemptsCount}</p>
            <span className="text-xs text-slate-500 font-medium">
              ({totalAttempts > 0 ? Math.round((flaggedAttemptsCount / totalAttempts) * 100) : 0}%)
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-100 rounded-xl p-5 shadow-sm space-y-2">
          <p className="text-xs text-emerald-600 font-bold uppercase">Integrity Cleared</p>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-extrabold text-emerald-600">{clearAttemptsCount}</p>
            <span className="text-xs text-slate-500 font-medium">
              ({totalAttempts > 0 ? Math.round((clearAttemptsCount / totalAttempts) * 100) : 0}%)
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-100 rounded-xl p-5 shadow-sm space-y-2">
          <p className="text-xs text-slate-400 font-bold uppercase">Avg Academic Score</p>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-extrabold text-slate-950">{averageScore}%</p>
            <span className="text-[11px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-bold">Standard</span>
          </div>
        </div>

      </div>

      {/* Main split grid: listing vs selected detail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Side: Filter and Lists */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm space-y-4">
            
            {/* Search Box */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search candidates or exams..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 text-sm rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition-all"
              />
            </div>

            {/* Filter Pills */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Filter By Compliance</label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { value: 'all', label: 'All Audits' },
                  { value: 'submitted', label: 'Secure Pass' },
                  { value: 'flagged', label: 'AI Flagged' }
                ].map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setStatusFilter(p.value as any)}
                    className={`px-3 py-1 text-xs font-semibold rounded-full border transition-all ${
                      statusFilter === p.value
                        ? 'bg-slate-900 border-slate-900 text-white'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* Candidates List Container */}
          <div className="space-y-3">
            <h3 className="text-xs font-extrabold uppercase text-slate-400 tracking-wider">Submissions ({filteredAttempts.length})</h3>
            
            {filteredAttempts.length === 0 ? (
              <div className="bg-white border border-slate-100 rounded-xl p-8 text-center text-slate-400 text-xs">
                No matching submissions found.
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {filteredAttempts.map((attempt) => {
                  const isSelected = selectedAttempt?.id === attempt.id;
                  const isHighRisk = attempt.status === 'flagged' || attempt.suspiciousScore >= 50;

                  return (
                    <div
                      key={attempt.id}
                      onClick={() => setSelectedAttempt(attempt)}
                      className={`p-4 border rounded-xl cursor-pointer transition-all flex flex-col justify-between ${
                        isSelected
                          ? 'bg-slate-900 border-slate-900 text-white'
                          : 'bg-white border-slate-100 hover:border-slate-200 text-slate-700 shadow-sm'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="text-xs font-bold uppercase tracking-wider opacity-60">
                              {attempt.testTitle.split(' ').slice(0, 3).join(' ')}...
                            </h4>
                            <p className={`text-sm font-extrabold ${isSelected ? 'text-white' : 'text-slate-950'}`}>
                              {attempt.studentName}
                            </p>
                          </div>

                          <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full uppercase ${
                            isHighRisk
                              ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                              : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                          }`}>
                            {isHighRisk ? 'AI Flagged' : 'Secure Pass'}
                          </span>
                        </div>

                        <div className={`grid grid-cols-2 gap-2 text-center p-2 rounded-lg text-xs ${
                          isSelected ? 'bg-slate-950/60' : 'bg-slate-50'
                        }`}>
                          <div>
                            <p className="text-[9px] uppercase font-semibold opacity-60">Exam Score</p>
                            <p className="font-extrabold">{attempt.score}%</p>
                          </div>
                          <div>
                            <p className="text-[9px] uppercase font-semibold opacity-60">AI Suspicion</p>
                            <p className={`font-extrabold ${isHighRisk ? 'text-rose-500' : 'text-emerald-500'}`}>
                              {attempt.suspiciousScore}%
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[10px] opacity-60 pt-2 border-t border-slate-100/10 mt-2 font-medium">
                        <span>{new Date(attempt.startTime).toLocaleTimeString()}</span>
                        <span className="flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> {attempt.logs.length} alerts
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* Right Side: Detailed Security Transcript View */}
        <div className="lg:col-span-2">
          {selectedAttempt ? (
            <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm space-y-6">
              
              {/* Header profile of student */}
              <div className="border-b border-slate-100 pb-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded text-[10px] font-bold uppercase tracking-wider">
                      Audit Record: {selectedAttempt.id.substring(8, 14)}
                    </span>
                    <h2 className="text-xl font-black text-slate-900 mt-1">{selectedAttempt.studentName}</h2>
                    <p className="text-xs text-slate-500 font-semibold">{selectedAttempt.testTitle}</p>
                  </div>

                  {/* Override controls */}
                  <div className="flex flex-wrap items-center gap-1.5 bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                    <span className="text-[10px] uppercase font-bold text-slate-400 px-2">Audit Action:</span>
                    <button
                      onClick={() => {
                        onOverrideStatus(selectedAttempt.id, 'submitted');
                        setSelectedAttempt(prev => prev ? { ...prev, status: 'submitted' } : null);
                      }}
                      className={`px-2.5 py-1 text-[10px] font-bold rounded ${
                        selectedAttempt.status === 'submitted'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-white text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Clear
                    </button>
                    <button
                      onClick={() => {
                        onOverrideStatus(selectedAttempt.id, 'flagged');
                        setSelectedAttempt(prev => prev ? { ...prev, status: 'flagged' } : null);
                      }}
                      className={`px-2.5 py-1 text-[10px] font-bold rounded ${
                        selectedAttempt.status === 'flagged'
                          ? 'bg-rose-600 text-white'
                          : 'bg-white text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Flag
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 rounded-xl p-4 border border-slate-100 text-center">
                  <div>
                    <p className="text-[9px] uppercase font-bold text-slate-400">Exam score</p>
                    <p className="text-base font-black text-slate-900">{selectedAttempt.score}%</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase font-bold text-slate-400">Suspicious score</p>
                    <p className={`text-base font-black ${
                      selectedAttempt.suspiciousScore >= 50 ? 'text-rose-600' : 'text-emerald-600'
                    }`}>{selectedAttempt.suspiciousScore}%</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase font-bold text-slate-400">AI Flag count</p>
                    <p className="text-base font-black text-slate-900">{selectedAttempt.logs.length}</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase font-bold text-slate-400">Date audited</p>
                    <p className="text-xs font-black text-slate-900 mt-1">
                      {new Date(selectedAttempt.startTime).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Proctor Security timeline logs with images */}
              <div className="space-y-4">
                <h3 className="text-sm font-extrabold uppercase text-slate-950 tracking-wider">AI Proctor Compliance Timeline</h3>
                
                {selectedAttempt.logs.length === 0 ? (
                  <div className="bg-emerald-50/50 border border-dashed border-emerald-200 rounded-xl p-6 text-center text-emerald-800 text-xs flex flex-col items-center gap-1.5 font-semibold">
                    <UserCheck className="w-6 h-6 text-emerald-600" />
                    <span>Flawless Audit Score: No suspicious activity flagged by AI proctoring services.</span>
                  </div>
                ) : (
                  <div className="relative border-l-2 border-slate-100 pl-6 space-y-6 ml-2.5">
                    {selectedAttempt.logs.map((log) => {
                      const isHigh = log.severity === 'high';

                      return (
                        <div key={log.id} className="relative">
                          {/* Chronological bullet marker */}
                          <div className={`absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-2 ${
                            isHigh ? 'bg-rose-500 border-rose-100' : 'bg-amber-500 border-amber-100'
                          }`}></div>

                          <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-3 shadow-sm">
                            <div className="flex items-center justify-between text-[10px] font-bold">
                              <span className={`uppercase ${isHigh ? 'text-rose-600' : 'text-amber-600'}`}>
                                {log.type.replace('_', ' ')}
                              </span>
                              <span className="text-slate-400">
                                {new Date(log.timestamp).toLocaleTimeString()}
                              </span>
                            </div>

                            <p className="text-slate-700 text-xs font-medium leading-relaxed">
                              {log.message}
                            </p>

                            {/* Camera snapshot base64 thumbnail if it exists */}
                            {log.snapshotUrl && (
                              <div className="space-y-1.5 pt-1">
                                <span className="text-[9px] uppercase font-extrabold text-slate-400 flex items-center gap-1">
                                  <Camera className="w-3.5 h-3.5" /> Photographic Evidence Snapshot
                                </span>
                                <div className="relative group overflow-hidden w-40 aspect-video rounded-lg border border-slate-200 bg-slate-900 cursor-pointer">
                                  <img 
                                    src={log.snapshotUrl} 
                                    alt="Audit Evidence Snapshot" 
                                    className="w-full h-full object-cover group-hover:scale-105 transition-all"
                                    onClick={() => setExpandedImage(log.snapshotUrl || null)}
                                  />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                                    <Eye className="w-5 h-5 text-white" />
                                  </div>
                                </div>
                              </div>
                            )}

                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          ) : (
            <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-16 text-center text-slate-400 space-y-2 max-w-md mx-auto">
              <ShieldAlert className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="font-bold text-slate-700">Audit Record Inspector</h3>
              <p className="text-xs leading-relaxed max-w-sm">
                Select a candidate from the left list column to inspect their complete question score sheet, AI proctoring compliance timeline, and visual evidence logs.
              </p>
            </div>
          )}
        </div>

      </div>

      {/* Lightbox Modal for camera snapshots expansion */}
      <AnimatePresence>
        {expandedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setExpandedImage(null)}
            className="fixed inset-0 bg-slate-950/95 backdrop-blur-md z-50 flex items-center justify-center p-4 cursor-pointer"
          >
            <div className="relative max-w-xl w-full bg-slate-900 rounded-2xl border border-slate-800 p-3 overflow-hidden shadow-2xl">
              <button 
                onClick={() => setExpandedImage(null)}
                className="absolute top-4 right-4 p-2 bg-slate-950/80 rounded-full text-white hover:bg-slate-800 z-10"
              >
                <X className="w-4.5 h-4.5" />
              </button>
              <img 
                src={expandedImage} 
                alt="Audit Evidence Expanded" 
                className="w-full h-auto rounded-xl border border-slate-800 scale-x-[-1]"
              />
              <div className="pt-3 text-center text-xs text-slate-400 font-semibold">
                Captured Audit Frame: Registered violation evidence log
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

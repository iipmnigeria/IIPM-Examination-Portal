import React from 'react';
import { motion } from 'motion/react';
import { Clock, AlertTriangle } from 'lucide-react';

interface CountdownTimerProps {
  timeLeft: number; // in seconds
  durationMinutes: number;
}

export default function CountdownTimer({ timeLeft, durationMinutes }: CountdownTimerProps) {
  const totalSeconds = durationMinutes * 60;
  const percentage = Math.max(0, Math.min(100, (timeLeft / totalSeconds) * 100));
  
  // Format MM:SS
  const formatTime = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  // Determine status color configurations
  const isUrgent = timeLeft < 60; // Less than 1 minute remaining
  const isLow = timeLeft < 120;    // Less than 2 minutes remaining
  
  let trackColor = 'bg-emerald-500/10 border-emerald-500/20';
  let barColor = 'bg-emerald-500';
  let textColor = 'text-white';
  let iconColor = 'text-emerald-400';

  if (isUrgent) {
    trackColor = 'bg-rose-500/20 border-rose-500/30 animate-pulse';
    barColor = 'bg-rose-500';
    textColor = 'text-rose-400 font-extrabold';
    iconColor = 'text-rose-500';
  } else if (isLow) {
    trackColor = 'bg-amber-500/15 border-amber-500/25';
    barColor = 'bg-amber-500';
    textColor = 'text-amber-400';
    iconColor = 'text-amber-400';
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-slate-900 border border-slate-800 p-2.5 rounded-xl min-w-[220px]">
      <div className="flex items-center gap-2">
        <div className={`p-1.5 rounded-lg ${isUrgent ? 'bg-rose-500/10' : 'bg-slate-950'} transition-colors`}>
          <Clock className={`w-4 h-4 ${iconColor} ${isUrgent ? 'animate-spin [animation-duration:4s]' : ''}`} />
        </div>
        
        <div className="flex flex-col">
          <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider leading-none mb-0.5">Time Remaining</span>
          <span className={`text-sm font-bold font-mono tracking-wider transition-colors ${textColor}`}>
            {formatTime(timeLeft)}
          </span>
        </div>
      </div>

      {/* visual mini progress bar */}
      <div className="flex-1 min-w-[80px] space-y-1">
        <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
          <motion.div 
            className={`h-full ${barColor} rounded-full`}
            initial={{ width: '100%' }}
            animate={{ width: `${percentage}%` }}
            transition={{ ease: 'easeOut', duration: 0.5 }}
          />
        </div>
        
        {isUrgent && (
          <p className="text-[8px] text-rose-500 font-bold uppercase tracking-wide animate-pulse flex items-center gap-0.5">
            <AlertTriangle className="w-2.5 h-2.5" /> Auto-submitting soon
          </p>
        )}
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  GraduationCap, 
  Lock, 
  User, 
  Key, 
  ShieldCheck, 
  AlertTriangle,
  Info,
  ChevronRight,
  Eye,
  EyeOff
} from 'lucide-react';

interface LoginPortalProps {
  onLoginSuccess: (name: string, role: 'student' | 'admin') => void;
  isLoading?: boolean;
}

export default function LoginPortal({ onLoginSuccess }: LoginPortalProps) {
  const [activeTab, setActiveTab] = useState<'student' | 'admin'>('student');
  
  // Student Login Fields
  const [studentNameInput, setStudentNameInput] = useState('');
  const [studentPin, setStudentPin] = useState('');
  const [studentError, setStudentError] = useState('');

  // Admin Login Fields
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [adminError, setAdminError] = useState('');
  const [isValidating, setIsValidating] = useState(false);

  // Handle Student Log-In / Registration
  const handleStudentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStudentError('');

    if (!studentNameInput.trim()) {
      setStudentError('Please enter your legal full name to register or login.');
      return;
    }

    if (studentNameInput.trim().length < 3) {
      setStudentError('Name must be at least 3 characters long for professional identification.');
      return;
    }

    // Success! Log in as student
    onLoginSuccess(studentNameInput.trim(), 'student');
  };

  // Handle Admin Auth
  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError('');
    setIsValidating(true);

    // Simulate server side delay for secure cryptography check
    setTimeout(() => {
      setIsValidating(false);
      const isUsernameCorrect = adminUsername.trim().toLowerCase() === 'admin';
      const isPasswordCorrect = adminPassword === 'iipmadmin';

      if (isUsernameCorrect && isPasswordCorrect) {
        onLoginSuccess('Administrator', 'admin');
      } else {
        setAdminError('Invalid administrative identification code or passkey.');
      }
    }, 750);
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12 bg-slate-50">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200/80 shadow-xl overflow-hidden">
        
        {/* Banner header */}
        <div className="bg-slate-950 text-white p-6 relative overflow-hidden border-b border-slate-900">
          <div className="absolute right-0 top-0 -mt-6 -mr-6 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl"></div>
          
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white font-black shadow-inner">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-sm tracking-wider text-emerald-400 uppercase">AURA</span>
                <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[8px] font-bold uppercase tracking-wide rounded">
                  PORTAL SECURE
                </span>
              </div>
              <h2 className="text-xl font-bold tracking-tight">Institutional Examination Console</h2>
            </div>
          </div>
        </div>

        {/* Tab Selectors */}
        <div className="flex border-b border-slate-200 bg-slate-50/50 p-1">
          <button
            type="button"
            onClick={() => {
              setActiveTab('student');
              setStudentError('');
              setAdminError('');
            }}
            className={`flex-1 py-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
              activeTab === 'student'
                ? 'bg-white text-emerald-700 shadow-sm border border-slate-200/50 font-extrabold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <User className="w-4 h-4" /> Candidate Entry
          </button>
          
          <button
            type="button"
            onClick={() => {
              setActiveTab('admin');
              setStudentError('');
              setAdminError('');
            }}
            className={`flex-1 py-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
              activeTab === 'admin'
                ? 'bg-white text-emerald-700 shadow-sm border border-slate-200/50 font-extrabold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Lock className="w-4 h-4 text-emerald-600" /> Auditor Access
          </button>
        </div>

        {/* Content Container */}
        <div className="p-6 md:p-8">
          {activeTab === 'student' ? (
            <form onSubmit={handleStudentSubmit} className="space-y-5">
              <div className="text-center space-y-1.5 mb-2">
                <h3 className="text-base font-bold text-slate-800">Secure Student Verification</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Enter your official name to start your dynamic candidate profile, write examinations, and access valid certificates.
                </p>
              </div>

              {studentError && (
                <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 text-xs font-semibold rounded-lg flex items-start gap-2 animate-shake">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{studentError}</span>
                </div>
              )}

              <div className="space-y-4">
                {/* Name Input */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Full Legal Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={studentNameInput}
                      onChange={(e) => setStudentNameInput(e.target.value)}
                      placeholder="e.g. Obinna Nwosu"
                      className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-900 placeholder-slate-400 text-sm rounded-lg focus:outline-none focus:border-emerald-600 focus:bg-white transition-all font-medium"
                    />
                  </div>
                </div>

                {/* Candidate PIN */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                      Student Access Code <span className="text-slate-400 lowercase font-medium">(optional)</span>
                    </label>
                  </div>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={studentPin}
                      onChange={(e) => setStudentPin(e.target.value)}
                      placeholder="e.g. STU-2026 (Optional)"
                      className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-900 placeholder-slate-400 text-sm rounded-lg focus:outline-none focus:border-emerald-600 focus:bg-white transition-all font-mono text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-emerald-50/50 p-3.5 rounded-lg border border-emerald-100/60 flex items-start gap-2.5 text-slate-600">
                <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed">
                  Your identity label is legally synchronized with issued professional certificates. Ensure spelling matches your official government ID.
                </p>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs uppercase tracking-wider rounded-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-1.5"
              >
                Establish Secure Session <ChevronRight className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <form onSubmit={handleAdminSubmit} className="space-y-5">
              <div className="text-center space-y-1.5 mb-2">
                <h3 className="text-base font-bold text-slate-800">Administrator Credentials</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Provide audit credentials to review active candidate webcams, flag status, and manage proctor logs.
                </p>
              </div>

              {adminError && (
                <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 text-xs font-semibold rounded-lg flex items-start gap-2 animate-shake">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{adminError}</span>
                </div>
              )}

              <div className="space-y-4">
                {/* Username */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Administrative Username
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={adminUsername}
                      onChange={(e) => setAdminUsername(e.target.value)}
                      placeholder="e.g. admin"
                      className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-900 placeholder-slate-400 text-sm rounded-lg focus:outline-none focus:border-emerald-600 focus:bg-white transition-all font-mono"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Auditor Security Key
                  </label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-900 placeholder-slate-400 text-sm rounded-lg focus:outline-none focus:border-emerald-600 focus:bg-white transition-all font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-slate-100 p-3 rounded-lg border border-slate-200 flex items-start gap-2 text-slate-600">
                <ShieldCheck className="w-4.5 h-4.5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-[10px] leading-relaxed">
                  <span className="font-semibold block text-slate-700">Demoralized Preview/Testing mode:</span>
                  Use username <code className="bg-white px-1 py-0.5 rounded border font-mono">admin</code> and security key <code className="bg-white px-1 py-0.5 rounded border font-mono">iipmadmin</code>.
                </div>
              </div>

              <button
                type="submit"
                disabled={isValidating}
                className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white font-bold text-xs uppercase tracking-wider rounded-lg shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-75"
              >
                {isValidating ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Verifying Credentials...
                  </>
                ) : (
                  <>
                    Authenticate Auditor <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
  EyeOff,
  Mail,
  UserPlus,
  CheckCircle2
} from 'lucide-react';

// Dynamically determine API Base URL.
const API_BASE = (
  typeof window !== 'undefined' && 
  !window.location.hostname.includes('localhost') && 
  !window.location.hostname.includes('run.app') &&
  !window.location.hostname.includes('0.0.0.0') &&
  !window.location.hostname.includes('127.0.0.1')
) ? 'https://ais-pre-y7jivk2vjghx37l36lh74p-385275779151.europe-west2.run.app' : '';

interface LoginPortalProps {
  onLoginSuccess: (name: string, role: 'student' | 'admin') => void;
  isLoading?: boolean;
}

export default function LoginPortal({ onLoginSuccess }: LoginPortalProps) {
  const [activeTab, setActiveTab] = useState<'student' | 'admin'>('student');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  
  // Toggle show password
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // ----------------------------------------------------
  // Form States
  // ----------------------------------------------------
  
  // Student Login
  const [studentEmail, setStudentEmail] = useState('');
  const [studentPassword, setStudentPassword] = useState('');
  
  // Student Login Legacy/Quick Access Mode (toggled if they want to enter instantly by Name)
  const [useLegacyLogin, setUseLegacyLogin] = useState(false);
  const [studentNameInput, setStudentNameInput] = useState('');

  // Student Registration
  const [regStudentName, setRegStudentName] = useState('');
  const [regStudentEmail, setRegStudentEmail] = useState('');
  const [regStudentPassword, setRegStudentPassword] = useState('');
  const [regStudentPin, setRegStudentPin] = useState('');

  // Admin Login
  const [adminUsernameOrEmail, setAdminUsernameOrEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  // Admin Registration
  const [regAdminName, setRegAdminName] = useState('');
  const [regAdminEmail, setRegAdminEmail] = useState('');
  const [regAdminUsername, setRegAdminUsername] = useState('');
  const [regAdminPassword, setRegAdminPassword] = useState('');
  const [regAdminCode, setRegAdminCode] = useState('');

  // Reset helper
  const resetFormState = (role: 'student' | 'admin', mode: 'login' | 'register') => {
    setErrorMessage('');
    setSuccessMessage('');
    setShowPassword(false);
    setAuthMode(mode);
  };

  // ----------------------------------------------------
  // Submit Handlers
  // ----------------------------------------------------

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(true);

    try {
      if (activeTab === 'student') {
        if (authMode === 'login') {
          // Student Login
          const payload = useLegacyLogin 
            ? { role: 'student', name: studentNameInput }
            : { role: 'student', email: studentEmail, password: studentPassword };

          if (useLegacyLogin && studentNameInput.trim().length < 3) {
            throw new Error('Candidate full legal name must be at least 3 characters.');
          }
          if (!useLegacyLogin && (!studentEmail || !studentPassword)) {
            throw new Error('Please fill in all email and password fields.');
          }

          const response = await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.error || 'Authentication failed.');
          }

          setSuccessMessage(`Welcome back, ${data.name}! Initializing examination profile...`);
          setTimeout(() => {
            onLoginSuccess(data.name, 'student');
          }, 1200);

        } else {
          // Student Registration
          if (!regStudentName || !regStudentEmail || !regStudentPassword) {
            throw new Error('Please fill in all required fields to register.');
          }

          const response = await fetch(`${API_BASE}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              role: 'student',
              name: regStudentName,
              email: regStudentEmail,
              password: regStudentPassword,
              pin: regStudentPin
            })
          });

          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.error || 'Registration failed.');
          }

          setSuccessMessage(`Account created successfully for ${data.name}! Logging in...`);
          setTimeout(() => {
            onLoginSuccess(data.name, 'student');
          }, 1500);
        }
      } else {
        // Admin Accounts
        if (authMode === 'login') {
          // Admin Login
          if (!adminUsernameOrEmail || !adminPassword) {
            throw new Error('Please enter your administrative credentials.');
          }

          const response = await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              role: 'admin',
              username: adminUsernameOrEmail,
              password: adminPassword
            })
          });

          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.error || 'Invalid credentials.');
          }

          setSuccessMessage(`Welcome back, ${data.name}! Initializing administrative panel...`);
          setTimeout(() => {
            onLoginSuccess(data.name, 'admin');
          }, 1200);

        } else {
          // Admin Registration
          if (!regAdminName || !regAdminEmail || !regAdminUsername || !regAdminPassword || !regAdminCode) {
            throw new Error('Please fill in all fields to request administrative credentials.');
          }

          const response = await fetch(`${API_BASE}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              role: 'admin',
              name: regAdminName,
              email: regAdminEmail,
              username: regAdminUsername,
              password: regAdminPassword,
              adminCode: regAdminCode
            })
          });

          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.error || 'Admin registration failed.');
          }

          setSuccessMessage(`Administrative account created successfully! Establishing secure session...`);
          setTimeout(() => {
            onLoginSuccess(data.name, 'admin');
          }, 1500);
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected authentication error occurred.');
    } finally {
      setIsSubmitting(false);
    }
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

        {/* Outer Tabs: Candidate vs Auditor */}
        <div className="flex border-b border-slate-200 bg-slate-50/50 p-1">
          <button
            type="button"
            onClick={() => {
              setActiveTab('student');
              resetFormState('student', 'login');
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
              resetFormState('admin', 'login');
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

        {/* Inner sub-tabs: Sign In vs Sign Up */}
        <div className="px-6 pt-5 flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
            {activeTab === 'student' ? 'Student Workspace' : 'Auditor Control'}
          </h3>
          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              onClick={() => resetFormState(activeTab, 'login')}
              className={`px-3 py-1 text-[11px] font-bold rounded-md transition ${
                authMode === 'login' 
                  ? 'bg-white text-slate-900 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Log In
            </button>
            <button
              onClick={() => resetFormState(activeTab, 'register')}
              className={`px-3 py-1 text-[11px] font-bold rounded-md transition flex items-center gap-1 ${
                authMode === 'register' 
                  ? 'bg-white text-slate-900 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <UserPlus className="w-3 h-3" /> Register
            </button>
          </div>
        </div>

        {/* Forms Content */}
        <div className="p-6 md:p-8">
          
          {/* Messages Alert Box */}
          <AnimatePresence mode="wait">
            {errorMessage && (
              <motion.div 
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="p-3 mb-4 bg-rose-50 border border-rose-100 text-rose-700 text-xs font-semibold rounded-lg flex items-start gap-2 animate-shake"
              >
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
                <span>{errorMessage}</span>
              </motion.div>
            )}

            {successMessage && (
              <motion.div 
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="p-3 mb-4 bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs font-semibold rounded-lg flex items-start gap-2"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500 mt-0.5" />
                <span>{successMessage}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* ---------------- STUDENT LOGIN ---------------- */}
            {activeTab === 'student' && authMode === 'login' && (
              <div className="space-y-4">
                <div className="text-center mb-1">
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Provide your candidate login credentials below to log in, write proctored exams, and download certified academic papers.
                  </p>
                </div>

                {useLegacyLogin ? (
                  /* Legacy name login */
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
                    <p className="text-[10px] text-slate-400">
                      Ideal for fast demonstration sessions. It will retrieve or auto-create a simple session account.
                    </p>
                  </div>
                ) : (
                  /* Standard email/password login */
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                        Email Address
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="email"
                          required
                          value={studentEmail}
                          onChange={(e) => setStudentEmail(e.target.value)}
                          placeholder="e.g. obinna@iipm.org"
                          className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-900 placeholder-slate-400 text-sm rounded-lg focus:outline-none focus:border-emerald-600 focus:bg-white transition-all"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                        Password
                      </label>
                      <div className="relative">
                        <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          value={studentPassword}
                          onChange={(e) => setStudentPassword(e.target.value)}
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
                )}

                {/* Legacy Mode Selector Toggle */}
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setUseLegacyLogin(!useLegacyLogin);
                      setErrorMessage('');
                    }}
                    className="text-[10px] text-emerald-600 hover:text-emerald-700 font-bold tracking-wider uppercase hover:underline"
                  >
                    {useLegacyLogin ? '← Use Email & Password' : 'Or Fast Entry with Legal Name'}
                  </button>
                </div>
              </div>
            )}

            {/* ---------------- STUDENT REGISTRATION ---------------- */}
            {activeTab === 'student' && authMode === 'register' && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Full Legal Name <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={regStudentName}
                      onChange={(e) => setRegStudentName(e.target.value)}
                      placeholder="e.g. Obinna Nwosu"
                      className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-900 placeholder-slate-400 text-sm rounded-lg focus:outline-none focus:border-emerald-600 focus:bg-white transition-all font-medium"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Official Email <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      required
                      value={regStudentEmail}
                      onChange={(e) => setRegStudentEmail(e.target.value)}
                      placeholder="e.g. obinna@iipm.org"
                      className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-900 placeholder-slate-400 text-sm rounded-lg focus:outline-none focus:border-emerald-600 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Password (min 6 chars) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={regStudentPassword}
                      onChange={(e) => setRegStudentPassword(e.target.value)}
                      placeholder="Choose a strong password"
                      className="w-full pl-9 pr-10 py-2 bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-900 placeholder-slate-400 text-sm rounded-lg focus:outline-none focus:border-emerald-600 focus:bg-white transition-all font-mono"
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

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Candidate Code / Access PIN <span className="text-slate-400 lowercase font-medium">(optional)</span>
                  </label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={regStudentPin}
                      onChange={(e) => setRegStudentPin(e.target.value)}
                      placeholder="e.g. STU-2026 (or auto-generated)"
                      className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-900 placeholder-slate-400 text-sm rounded-lg focus:outline-none focus:border-emerald-600 focus:bg-white transition-all font-mono text-xs"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ---------------- ADMIN LOGIN ---------------- */}
            {activeTab === 'admin' && authMode === 'login' && (
              <div className="space-y-3">
                <div className="text-center mb-1">
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Provide auditor credentials to review active candidate webcams, flag status, and manage proctor logs.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Auditor Username or Email
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={adminUsernameOrEmail}
                      onChange={(e) => setAdminUsernameOrEmail(e.target.value)}
                      placeholder="e.g. admin"
                      className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-900 placeholder-slate-400 text-sm rounded-lg focus:outline-none focus:border-emerald-600 focus:bg-white transition-all font-mono"
                    />
                  </div>
                </div>

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

                {/* Live testing demo tip */}
                <div className="bg-slate-100 p-2.5 rounded-lg border border-slate-200 flex items-start gap-2 text-slate-600">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="text-[10px] leading-relaxed">
                    <span className="font-semibold block text-slate-700">Audit testing fallback codes:</span>
                    Username <code className="bg-white px-1 py-0.5 rounded border font-mono">admin</code> and security key <code className="bg-white px-1 py-0.5 rounded border font-mono">iipmadmin</code>.
                  </div>
                </div>
              </div>
            )}

            {/* ---------------- ADMIN REGISTRATION ---------------- */}
            {activeTab === 'admin' && authMode === 'register' && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Auditor Full Legal Name <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={regAdminName}
                      onChange={(e) => setRegAdminName(e.target.value)}
                      placeholder="e.g. Auditor-General One"
                      className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-900 placeholder-slate-400 text-sm rounded-lg focus:outline-none focus:border-emerald-600 focus:bg-white transition-all font-medium"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Official Email <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      required
                      value={regAdminEmail}
                      onChange={(e) => setRegAdminEmail(e.target.value)}
                      placeholder="e.g. auditor@iipm.org"
                      className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-900 placeholder-slate-400 text-sm rounded-lg focus:outline-none focus:border-emerald-600 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                      Username <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        required
                        value={regAdminUsername}
                        onChange={(e) => setRegAdminUsername(e.target.value)}
                        placeholder="e.g. admin2"
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-900 placeholder-slate-400 text-sm rounded-lg focus:outline-none focus:border-emerald-600 focus:bg-white transition-all font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                      Access Key <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="password"
                        required
                        value={regAdminPassword}
                        onChange={(e) => setRegAdminPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-900 placeholder-slate-400 text-sm rounded-lg focus:outline-none focus:border-emerald-600 focus:bg-white transition-all font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Auditor Access Code <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={regAdminCode}
                      onChange={(e) => setRegAdminCode(e.target.value)}
                      placeholder="Enter administrative authorization key"
                      className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-900 placeholder-slate-400 text-sm rounded-lg focus:outline-none focus:border-emerald-600 focus:bg-white transition-all font-mono text-xs uppercase"
                    />
                  </div>
                  <p className="text-[9px] text-slate-400">
                    Use authorization code <code className="bg-slate-100 px-1 py-0.5 rounded font-mono font-bold">IIPM-ADMIN-2026</code> to register administrative accounts.
                  </p>
                </div>
              </div>
            )}

            {/* General Information Warning Label */}
            {authMode === 'register' && (
              <div className="bg-emerald-50/50 p-3 rounded-lg border border-emerald-100/60 flex items-start gap-2.5 text-slate-600">
                <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <p className="text-[10px] leading-relaxed">
                  Your registration is securely protected under state privacy protocols. Official names must correspond exactly to your government identity records.
                </p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-2.5 px-4 rounded-lg font-bold text-xs uppercase tracking-wider shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-1.5 disabled:opacity-75 ${
                activeTab === 'admin' 
                  ? 'bg-slate-900 hover:bg-slate-800 text-white' 
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Security Verification in Progress...
                </>
              ) : (
                <>
                  {authMode === 'login' ? 'Establish Secure Session' : 'Create Registered Profile'} 
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

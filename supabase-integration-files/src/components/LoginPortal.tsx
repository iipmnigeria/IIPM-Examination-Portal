import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Eye,
  EyeOff,
  GraduationCap,
  Info,
  Key,
  Lock,
  Mail,
  ShieldCheck,
  User,
  UserPlus,
} from 'lucide-react';
import {
  registerCandidate,
  requestPasswordReset,
  signInAsCandidate,
  signInAsStaff,
} from '../services/authService';

interface LoginPortalProps {
  onLoginSuccess: (name: string, role: 'student' | 'admin') => void;
  isLoading?: boolean;
}

export default function LoginPortal({ onLoginSuccess }: LoginPortalProps) {
  const [activeTab, setActiveTab] = useState<'student' | 'admin'>('student');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [studentName, setStudentName] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [studentPassword, setStudentPassword] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPassword, setStaffPassword] = useState('');

  const switchPortal = (portal: 'student' | 'admin') => {
    setActiveTab(portal);
    setAuthMode('login');
    setErrorMessage('');
    setSuccessMessage('');
    setShowPassword(false);
  };

  const handlePasswordReset = async () => {
    const email = activeTab === 'student' ? studentEmail : staffEmail;
    setErrorMessage('');
    setSuccessMessage('');

    if (!email.trim()) {
      setErrorMessage('Enter your registered email address before requesting a password reset.');
      return;
    }

    try {
      setIsSubmitting(true);
      await requestPasswordReset(email);
      setSuccessMessage('Password reset instructions have been sent to your registered email address.');
    } catch (error: any) {
      setErrorMessage(error?.message || 'Unable to send password reset instructions.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(true);

    try {
      if (activeTab === 'student' && authMode === 'register') {
        const registration = await registerCandidate({
          fullName: studentName,
          email: studentEmail,
          password: studentPassword,
        });

        if (registration.requiresEmailConfirmation) {
          setSuccessMessage(
            'Registration successful. Check your email and confirm the account before signing in.',
          );
          setAuthMode('login');
          return;
        }

        const result = await signInAsCandidate(studentEmail, studentPassword);
        setSuccessMessage(`Welcome, ${result.profile.full_name}. Your candidate profile is ready.`);
        window.setTimeout(() => onLoginSuccess(result.profile.full_name, 'student'), 600);
        return;
      }

      if (activeTab === 'student') {
        const result = await signInAsCandidate(studentEmail, studentPassword);
        setSuccessMessage(`Welcome back, ${result.profile.full_name}.`);
        window.setTimeout(() => onLoginSuccess(result.profile.full_name, 'student'), 500);
        return;
      }

      const result = await signInAsStaff(staffEmail, staffPassword);
      setSuccessMessage(`Welcome, ${result.profile.full_name}. Opening the control hub...`);
      window.setTimeout(() => onLoginSuccess(result.profile.full_name, 'admin'), 500);
    } catch (error: any) {
      setErrorMessage(error?.message || 'Authentication could not be completed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12 bg-slate-50">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200/80 shadow-xl overflow-hidden">
        <div className="bg-slate-950 text-white p-6 relative overflow-hidden border-b border-slate-900">
          <div className="absolute right-0 top-0 -mt-6 -mr-6 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl" />
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-inner">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-sm tracking-wider text-emerald-400 uppercase">IIPM</span>
                <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[8px] font-bold uppercase tracking-wide rounded">
                  Supabase Secure
                </span>
              </div>
              <h2 className="text-xl font-bold tracking-tight">Institutional Examination Console</h2>
            </div>
          </div>
        </div>

        <div className="flex border-b border-slate-200 bg-slate-50/50 p-1">
          <button
            type="button"
            onClick={() => switchPortal('student')}
            className={`flex-1 py-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
              activeTab === 'student'
                ? 'bg-white text-emerald-700 shadow-sm border border-slate-200/50'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <User className="w-4 h-4" /> Candidate Entry
          </button>
          <button
            type="button"
            onClick={() => switchPortal('admin')}
            className={`flex-1 py-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
              activeTab === 'admin'
                ? 'bg-white text-emerald-700 shadow-sm border border-slate-200/50'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Lock className="w-4 h-4" /> Staff Access
          </button>
        </div>

        {activeTab === 'student' && (
          <div className="px-6 pt-5 flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Candidate Workspace</h3>
            <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('login');
                  setErrorMessage('');
                  setSuccessMessage('');
                }}
                className={`px-3 py-1 text-[11px] font-bold rounded-md transition ${
                  authMode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                }`}
              >
                Log In
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('register');
                  setErrorMessage('');
                  setSuccessMessage('');
                }}
                className={`px-3 py-1 text-[11px] font-bold rounded-md transition flex items-center gap-1 ${
                  authMode === 'register' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                }`}
              >
                <UserPlus className="w-3 h-3" /> Register
              </button>
            </div>
          </div>
        )}

        {activeTab === 'admin' && (
          <div className="px-6 pt-5 border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Authorised Staff Access</h3>
          </div>
        )}

        <div className="p-6 md:p-8">
          <AnimatePresence mode="wait">
            {errorMessage && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 mb-4 bg-rose-50 border border-rose-100 text-rose-700 text-xs font-semibold rounded-lg flex items-start gap-2"
              >
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </motion.div>
            )}
            {successMessage && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 mb-4 bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs font-semibold rounded-lg flex items-start gap-2"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{successMessage}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-4">
            {activeTab === 'student' && authMode === 'register' && (
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">Full Legal Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={studentName}
                    onChange={(event) => setStudentName(event.target.value)}
                    placeholder="Enter your full legal name"
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                {activeTab === 'student' ? 'Email Address' : 'Authorised Staff Email'}
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  required
                  value={activeTab === 'student' ? studentEmail : staffEmail}
                  onChange={(event) =>
                    activeTab === 'student'
                      ? setStudentEmail(event.target.value)
                      : setStaffEmail(event.target.value)
                  }
                  placeholder={activeTab === 'student' ? 'candidate@example.com' : 'staff@iipmi.org'}
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-lg focus:outline-none focus:border-emerald-600"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">Password</label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={activeTab === 'student' ? studentPassword : staffPassword}
                  onChange={(event) =>
                    activeTab === 'student'
                      ? setStudentPassword(event.target.value)
                      : setStaffPassword(event.target.value)
                  }
                  placeholder="Minimum eight characters"
                  className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-lg focus:outline-none focus:border-emerald-600"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {authMode === 'login' && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handlePasswordReset}
                  className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider hover:underline"
                >
                  Forgot password?
                </button>
              </div>
            )}

            {activeTab === 'admin' && (
              <div className="bg-slate-100 p-3 rounded-lg border border-slate-200 flex items-start gap-2 text-slate-600">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <p className="text-[10px] leading-relaxed">
                  Staff accounts are created and authorised by IIPM Super Administrators. Public auditor registration is disabled.
                </p>
              </div>
            )}

            {activeTab === 'student' && authMode === 'register' && (
              <div className="bg-emerald-50/60 p-3 rounded-lg border border-emerald-100 flex items-start gap-2 text-slate-600">
                <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <p className="text-[10px] leading-relaxed">
                  Use your official name and an accessible email address. You may be required to verify the email before signing in.
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-2.5 px-4 rounded-lg font-bold text-xs uppercase tracking-wider shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-70 ${
                activeTab === 'admin'
                  ? 'bg-slate-900 hover:bg-slate-800 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Verifying Secure Account...
                </>
              ) : (
                <>
                  {activeTab === 'student' && authMode === 'register'
                    ? 'Create Candidate Account'
                    : 'Establish Secure Session'}
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

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
} from 'firebase/auth';
import {
  Layers,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  FileCheck2,
  Sparkles,
  Check,
} from 'lucide-react';
import { auth } from '../firebase';
import { ensureUserProfile } from '../services/firestoreService';

type AuthMode = 'login' | 'register' | 'forgot';

export default function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [jobTitle, setJobTitle] = useState('Principal Systems Architect');
  const [department, setDepartment] = useState('Core Platform Engineering');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      if (cred.user) {
        await ensureUserProfile(
          cred.user.uid,
          cred.user.email || 'user@enterprise.example',
          cred.user.displayName || cred.user.email?.split('@')[0] || 'Platform User',
          jobTitle,
          department
        );
        navigate('/');
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    setLoading(true);

    try {
      if (mode === 'forgot') {
        if (!email.trim()) {
          throw new Error('Please enter your work email address.');
        }
        await sendPasswordResetEmail(auth, email.trim());
        setInfoMsg(
          `Password reset link sent to ${email.trim()}. Check your inbox to reset your password.`
        );
        setLoading(false);
        return;
      }

      if (mode === 'register') {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (displayName.trim()) {
          await updateProfile(cred.user, { displayName: displayName.trim() });
        }
        await sendEmailVerification(cred.user);
        setInfoMsg(
          'Account registered! A verification link has been sent to your email. For instant verified database access, click "Google" below.'
        );
        navigate('/');
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
        navigate('/');
      }
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : String(err);
      if (raw.includes('auth/operation-not-allowed')) {
        setErrorMsg(
          'Email/Password sign-in is not yet enabled in your Firebase Console. Please click "Google" below (pre-configured with verified email) or enable Email/Password in Firebase Console > Authentication.'
        );
      } else {
        setErrorMsg(raw);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white grid grid-cols-1 lg:grid-cols-12">
      {/* Left Panel: Clean White Split-Screen Auth Form (Inspired by Reference 4) */}
      <div className="lg:col-span-6 flex flex-col justify-between p-6 sm:p-10 lg:p-14 xl:p-16">
        {/* Top Brand Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-xs">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-base font-bold tracking-tight text-slate-900 font-display leading-tight">
              Campus Continuity
            </span>
            <span className="block text-[11px] font-medium text-emerald-700 leading-tight">
              Preserve Knowledge. Continue Innovation.
            </span>
          </div>
        </div>

        {/* Center Auth Form */}
        <div className="w-full max-w-[420px] mx-auto my-10">
          <div className="text-center mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 font-display tracking-tight">
              {mode === 'login' && 'Welcome Back'}
              {mode === 'register' && 'Create Your Account'}
              {mode === 'forgot' && 'Reset Your Password'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-2">
              {mode === 'login' &&
                'Enter your email and password or use Google to access your continuity workspace.'}
              {mode === 'register' &&
                'Register your profile to reconstruct and verify critical project knowledge.'}
              {mode === 'forgot' &&
                'Enter your registered work email and we will send a password recovery link.'}
            </p>
          </div>

          {errorMsg && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-800">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {infoMsg && (
            <div className="mb-5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-2.5 text-xs text-emerald-900">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{infoMsg}</span>
            </div>
          )}

          <form onSubmit={handleEmailSubmit} className="space-y-4">
            {mode === 'register' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Elena Rostova"
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Role / Title
                    </label>
                    <input
                      type="text"
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Department
                    </label>
                    <input
                      type="text"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="architect@enterprise.com"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              />
            </div>

            {mode !== 'forgot' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-3.5 pr-10 py-2.5 text-sm bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {mode === 'login' && (
              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 text-slate-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-slate-300 accent-emerald-600 w-3.5 h-3.5"
                  />
                  <span>Remember Me</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setMode('forgot');
                    setErrorMsg(null);
                    setInfoMsg(null);
                  }}
                  className="font-semibold text-emerald-600 hover:text-emerald-700 cursor-pointer"
                >
                  Forgot Your Password?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              {loading
                ? 'Authenticating...'
                : mode === 'login'
                ? 'Log In'
                : mode === 'register'
                ? 'Create Account'
                : 'Send Reset Instructions'}
            </button>
          </form>

          {/* Divider */}
          <div className="relative flex py-5 items-center">
            <div className="grow border-t border-slate-200" />
            <span className="shrink mx-3 text-xs text-slate-400 font-medium">
              Or Continue With
            </span>
            <div className="grow border-t border-slate-200" />
          </div>

          {/* Google Sign-In Button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-2.5 shadow-2xs transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.3 0 6.08-1.09 8.1-2.96l-3.88-3.05c-1.08.72-2.45 1.16-4.22 1.16-3.24 0-5.98-2.18-6.96-5.11H1.04v3.14C3.05 21.18 7.21 24 12 24Z"
              />
              <path
                fill="#FBBC05"
                d="M5.04 14.04c-.25-.72-.39-1.5-.39-2.3s.14-1.58.39-2.3V6.3H1.04C.38 7.62 0 9.12 0 11.74s.38 4.12 1.04 5.44l4-3.14Z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.8 0 3.41.62 4.68 1.84l3.5-3.5C18.07 1.19 15.3 0 12 0 7.21 0 3.05 2.82 1.04 6.82l4 3.14c.98-2.93 3.72-5.21 6.96-5.21Z"
              />
            </svg>
            <span>Google (Instant Verified Access)</span>
          </button>

          {/* Bottom Mode Switch Link */}
          <div className="mt-7 text-center text-xs text-slate-500">
            {mode === 'login' ? (
              <>
                Don&apos;t Have An Account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setErrorMsg(null);
                    setInfoMsg(null);
                  }}
                  className="font-bold text-emerald-600 hover:underline cursor-pointer"
                >
                  Register Now.
                </button>
              </>
            ) : (
              <>
                Already Have An Account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setErrorMsg(null);
                    setInfoMsg(null);
                  }}
                  className="font-bold text-emerald-600 hover:underline cursor-pointer"
                >
                  Sign In.
                </button>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span>© 2026 Continuum Handover Platform</span>
          <span>Enterprise Zero-Trust Continuity</span>
        </div>
      </div>

      {/* Right Panel: Deep Navy & Emerald SaaS Preview Showcase (Inspired by Reference 4) */}
      <div className="hidden lg:flex lg:col-span-6 p-4 xl:p-6">
        <div className="w-full h-full rounded-3xl bg-[#0B1727] text-white p-10 xl:p-14 flex flex-col justify-between relative overflow-hidden">
          {/* Subtle Ambient Glow */}
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-emerald-500/15 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-sky-500/10 blur-3xl pointer-events-none" />

          {/* Top Copy */}
          <div className="relative z-10 max-w-lg">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              Preserve Knowledge. Continue Innovation.
            </span>
            <h2
              className="text-3xl xl:text-4xl font-bold font-display tracking-tight leading-tight text-white"
              style={{ textWrap: 'balance' }}
            >
              Campus Continuity ensures that no academic project loses its knowledge when its students leave.
            </h2>
            <p className="text-sm text-slate-300 mt-3 leading-relaxed">
              Sign in to reconstruct decisions, unfinished tasks, verified owners, and cross-document knowledge gaps into structured handover packages.
            </p>
          </div>

          {/* Interactive SaaS Dashboard Preview Mock Card Stack */}
          <div className="relative z-10 my-8 bg-white/95 text-slate-900 rounded-2xl p-6 shadow-2xl border border-white/20">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
              <div>
                <p className="text-[11px] font-semibold text-emerald-600 uppercase">
                  Live Continuity Snapshot
                </p>
                <h3 className="text-sm font-bold text-slate-900 font-display">
                  HZN-CORE · Cross-Border Settlement Handover
                </h3>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg tabular-nums">
                94% Evidence Verified
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-[11px] text-slate-500">Extracted Decisions</p>
                <p className="text-xl font-bold text-slate-900 font-mono tabular-nums mt-1">18</p>
                <p className="text-[10px] text-emerald-600 font-semibold mt-1">
                  100% Source Quoted
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-[11px] text-slate-500">Pending Tasks</p>
                <p className="text-xl font-bold text-slate-900 font-mono tabular-nums mt-1">7</p>
                <p className="text-[10px] text-amber-600 font-semibold mt-1">
                  2 Unassigned Flagged
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-[11px] text-slate-500">Contradictions</p>
                <p className="text-xl font-bold text-red-600 font-mono tabular-nums mt-1">2</p>
                <p className="text-[10px] text-slate-500 font-semibold mt-1">
                  Cutover Date Conflict
                </p>
              </div>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-100 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 truncate">
                      Adopt Cloud Spanner for Multi-Region Ledger
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      Source: ADR-014_Payment_Settlement.pdf · Page 1 · Verified
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-emerald-700 shrink-0">
                  Approved
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-6 h-6 rounded-lg bg-sky-600 text-white flex items-center justify-center shrink-0">
                    <FileCheck2 className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 truncate">
                      Resolve JPY Zero-Decimal Shadow Rounding Bug
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      Source: Sprint_42_Exit_Notes.docx · Owner: Unassigned
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-amber-700 shrink-0">
                  In Review
                </span>
              </div>
            </div>
          </div>

          {/* Bottom Trust Row */}
          <div className="relative z-10 flex items-center justify-between text-xs text-slate-400 pt-4 border-t border-white/10">
            <span className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Zero Hallucination Guarantee
            </span>
            <span>Server-Side Gemini 3.8 Flash · Cloud Firestore</span>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { User, Shield, Bell, KeyRound, CheckCircle2, AlertCircle } from 'lucide-react';
import { auth } from '../firebase';
import { useAppContext } from '../context/AppContext';
import { updateUserProfile } from '../services/firestoreService';

export default function SettingsPage() {
  const { user, userProfile, projects, refreshUserProfile } = useAppContext();

  const [displayName, setDisplayName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [notifyOnReview, setNotifyOnReview] = useState(true);
  const [notifyOnHandover, setNotifyOnHandover] = useState(true);

  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState(false);

  useEffect(() => {
    if (userProfile) {
      setDisplayName(userProfile.displayName || '');
      setJobTitle(userProfile.jobTitle || '');
      setDepartment(userProfile.department || '');
      setNotifyOnReview(userProfile.notifyOnReview ?? true);
      setNotifyOnHandover(userProfile.notifyOnHandover ?? true);
    }
  }, [userProfile]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setStatusMsg(null);
    setErrorMsg(null);
    try {
      await updateUserProfile(user.uid, {
        displayName,
        jobTitle,
        department,
        notifyOnReview,
        notifyOnHandover,
      });
      await refreshUserProfile();
      setStatusMsg('Profile and notification preferences saved to Firestore.');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordResetEmail = async () => {
    if (!user?.email) return;
    setStatusMsg(null);
    setErrorMsg(null);
    try {
      await sendPasswordResetEmail(auth, user.email);
      setStatusMsg(`Password reset email sent to ${user.email}.`);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="border-b border-slate-200 pb-6">
        <h1 className="text-2xl font-bold text-slate-900 font-display tracking-tight">
          Account, Permissions & Notification Settings
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Manage your user profile, project access control permissions, and review notification preferences.
        </p>
      </div>

      {statusMsg && (
        <div className="p-4 rounded-xl bg-teal-50 border border-teal-200 flex items-center gap-2 text-xs text-teal-900">
          <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
          <span>{statusMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2 text-xs text-red-800">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSaveProfile} className="space-y-6">
        {/* User Profile Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center gap-4 pb-6 mb-6 border-b border-slate-100">
            <div className="w-16 h-16 rounded-full overflow-hidden border border-slate-200 bg-slate-100 shrink-0">
              {!avatarError ? (
                <img
                  src="/src/assets/images/avatar_executive_user_1794487410566.jpg"
                  alt="Executive User Avatar"
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarError(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-slate-900 text-white font-bold text-lg">
                  {(displayName || 'U').charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 font-display">
                {displayName || 'Authenticated User'}
              </h2>
              <p className="text-xs text-slate-500">
                {user?.email} · Email Verified: {user?.emailVerified ? 'Yes' : 'Pending'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                <User className="w-3.5 h-3.5 inline mr-1 text-slate-400" />
                Display Name
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Job Title
              </label>
              <input
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Department
              </label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>
        </div>

        {/* Notification Preferences */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-4 h-4 text-teal-600" />
            <h3 className="text-base font-bold text-slate-900 font-display">
              Notification Preferences
            </h3>
          </div>
          <div className="space-y-3 text-xs">
            <label className="flex items-center justify-between py-2 border-b border-slate-100 cursor-pointer">
              <div>
                <p className="font-semibold text-slate-900">
                  Knowledge Review Queue Alerts
                </p>
                <p className="text-slate-500">
                  Notify when new AI-extracted findings require human verification or comment sign-off.
                </p>
              </div>
              <input
                type="checkbox"
                checked={notifyOnReview}
                onChange={(e) => setNotifyOnReview(e.target.checked)}
                className="h-4 w-4 accent-teal-600 rounded"
              />
            </label>

            <label className="flex items-center justify-between py-2 cursor-pointer">
              <div>
                <p className="font-semibold text-slate-900">
                  Handover Package Publication Alerts
                </p>
                <p className="text-slate-500">
                  Notify when a role-specific handover report is finalized or exported.
                </p>
              </div>
              <input
                type="checkbox"
                checked={notifyOnHandover}
                onChange={(e) => setNotifyOnHandover(e.target.checked)}
                className="h-4 w-4 accent-teal-600 rounded"
              />
            </label>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              {saving ? 'Saving Preferences...' : 'Save Profile & Preferences'}
            </button>
          </div>
        </div>
      </form>

      {/* Project Permissions & Security */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-teal-600" />
            <h3 className="text-base font-bold text-slate-900 font-display">
              Project Access & ABAC Permissions
            </h3>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed mb-4">
            Your UID (<code className="font-mono text-slate-800">{user?.uid.slice(0, 12)}...</code>)
            holds Owner permissions across{' '}
            <strong className="font-mono tabular-nums">{projects.length}</strong> project
            workspace(s). All child records enforce relational parent verification in Firestore security rules.
          </p>
          <p className="text-xs text-slate-500">
            PII Isolation: User profile records are restricted strictly to owner read/write access with list queries disabled.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <KeyRound className="w-4 h-4 text-teal-600" />
              <h3 className="text-base font-bold text-slate-900 font-display">
                Account Credentials & Password Reset
              </h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Send a password reset link to your registered email address ({user?.email}) or manage your Google OAuth session.
            </p>
          </div>
          <button
            type="button"
            onClick={handlePasswordResetEmail}
            className="w-fit px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
          >
            Send Password Reset Email
          </button>
        </div>
      </div>
    </div>
  );
}

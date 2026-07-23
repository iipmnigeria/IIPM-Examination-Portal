import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  ImagePlus,
  Loader2,
  ShieldCheck,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import { getMyCandidateProfile, type CandidateProfile } from '../services/candidateProfileService';
import {
  createCandidateProfilePhotoSignedUrl,
  removeMyCandidateProfilePhoto,
  uploadMyCandidateProfilePhoto,
  validateCandidateProfilePhoto,
} from '../services/candidateProfilePhotoService';

function candidateInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  return parts.map((part) => part.charAt(0).toUpperCase()).join('') || 'AC';
}

export default function CandidateProfilePhotoLauncher() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isCandidate, setIsCandidate] = useState(
    () => localStorage.getItem('aura_logged_role') === 'student',
  );
  const [isOpen, setIsOpen] = useState(false);
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [photoUrl, setPhotoUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const candidateName =
    profile?.legal_name || localStorage.getItem('aura_student_name') || 'AgileCert Candidate';
  const initials = useMemo(() => candidateInitials(candidateName), [candidateName]);

  useEffect(() => {
    const checkRole = () => {
      const candidate = localStorage.getItem('aura_logged_role') === 'student';
      setIsCandidate(candidate);
      if (!candidate) {
        setIsOpen(false);
        setProfile(null);
        setPhotoUrl('');
      }
    };

    checkRole();
    const interval = window.setInterval(checkRole, 1_000);
    window.addEventListener('storage', checkRole);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('storage', checkRole);
    };
  }, []);

  const loadPhoto = async () => {
    try {
      setIsLoading(true);
      setError('');
      const nextProfile = await getMyCandidateProfile();
      setProfile(nextProfile);
      setPhotoUrl(
        nextProfile?.profile_photo_path
          ? await createCandidateProfilePhotoSignedUrl(nextProfile.profile_photo_path)
          : '',
      );
    } catch (loadError: any) {
      setError(loadError?.message || 'Your profile photo could not be loaded.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isCandidate) return;
    void loadPhoto();
  }, [isCandidate]);

  useEffect(() => {
    const refresh = () => {
      if (isCandidate) void loadPhoto();
    };
    window.addEventListener('agilecert-profile-photo-refresh', refresh);
    return () => window.removeEventListener('agilecert-profile-photo-refresh', refresh);
  }, [isCandidate]);

  const handleOpen = () => {
    setError('');
    setMessage('');
    setIsOpen(true);
    void loadPhoto();
  };

  const handleFileChange = async (file: File | null) => {
    if (!file) return;

    let previewUrl = '';
    try {
      validateCandidateProfilePhoto(file);
      previewUrl = URL.createObjectURL(file);
      setPhotoUrl(previewUrl);
      setIsUploading(true);
      setError('');
      setMessage('');

      const result = await uploadMyCandidateProfilePhoto(file);
      setProfile(result.profile);
      setPhotoUrl(result.signedUrl);
      setMessage('Your private candidate profile photo has been updated.');
      window.dispatchEvent(new Event('agilecert-profile-photo-refresh'));
    } catch (uploadError: any) {
      setError(uploadError?.message || 'Your profile photo could not be uploaded.');
      await loadPhoto();
    } finally {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (inputRef.current) inputRef.current.value = '';
      setIsUploading(false);
    }
  };

  const handleRemove = async () => {
    try {
      setIsRemoving(true);
      setError('');
      setMessage('');
      const updatedProfile = await removeMyCandidateProfilePhoto(profile?.profile_photo_path);
      setProfile(updatedProfile);
      setPhotoUrl('');
      setMessage('Your candidate profile photo has been removed.');
      window.dispatchEvent(new Event('agilecert-profile-photo-refresh'));
    } catch (removeError: any) {
      setError(removeError?.message || 'Your profile photo could not be removed.');
    } finally {
      setIsRemoving(false);
    }
  };

  if (!isCandidate) return null;

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="fixed bottom-5 left-5 z-[90] flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-black text-white shadow-2xl transition hover:border-emerald-500 hover:bg-slate-900"
        aria-label="Manage candidate profile photo"
      >
        <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-emerald-400/50 bg-emerald-600 text-[11px] font-black">
          {photoUrl ? (
            <img src={photoUrl} alt="Candidate profile" className="h-full w-full object-cover" />
          ) : (
            initials
          )}
        </span>
        <span className="hidden sm:inline">Profile photo</span>
        <Camera className="h-3.5 w-3.5 text-emerald-400" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center overflow-y-auto bg-slate-950/75 p-4 backdrop-blur-sm">
          <section className="my-6 w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <header className="flex items-center justify-between bg-slate-950 px-5 py-4 text-white">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-400">
                  Phase 2.2A
                </p>
                <h2 className="mt-1 text-xl font-black">Candidate Profile Photo</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-full border border-slate-700 p-2 text-slate-300 transition hover:bg-slate-800 hover:text-white"
                aria-label="Close profile photo manager"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="space-y-5 p-5 md:p-7">
              {error && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                  {error}
                </div>
              )}
              {message && (
                <div className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  {message}
                </div>
              )}

              <div className="flex flex-col items-center rounded-3xl border border-slate-200 bg-slate-50 p-6 text-center">
                <div className="flex h-36 w-36 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-emerald-600 text-4xl font-black text-white shadow-lg">
                  {isLoading ? (
                    <Loader2 className="h-8 w-8 animate-spin" />
                  ) : photoUrl ? (
                    <img src={photoUrl} alt={`${candidateName} profile`} className="h-full w-full object-cover" />
                  ) : (
                    initials
                  )}
                </div>
                <h3 className="mt-4 text-lg font-black text-slate-900">{candidateName}</h3>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  This image is stored privately and is visible only through an authenticated, temporary signed link.
                </p>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                  <p className="text-xs leading-5 text-amber-900">
                    A profile photo is not identity-verification evidence. Government-ID verification remains excluded until Phase 5.
                  </p>
                </div>
              </div>

              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(event) => void handleFileChange(event.target.files?.[0] || null)}
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  disabled={isUploading || isRemoving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : photoUrl ? (
                    <Camera className="h-4 w-4" />
                  ) : (
                    <ImagePlus className="h-4 w-4" />
                  )}
                  {photoUrl ? 'Replace photo' : 'Upload photo'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleRemove()}
                  disabled={!profile?.profile_photo_path || isUploading || isRemoving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-3 text-sm font-black text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isRemoving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Remove photo
                </button>
              </div>

              <div className="flex items-start gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs leading-5 text-slate-600">
                <UserRound className="mt-0.5 h-4 w-4 shrink-0" />
                JPEG, PNG or WebP only. Maximum file size: 3 MB.
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

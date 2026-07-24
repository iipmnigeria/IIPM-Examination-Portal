import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  ImagePlus,
  Loader2,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { getMyCandidateProfile, type CandidateProfile } from '../services/candidateProfileService';
import {
  createCandidateProfilePhotoSignedUrl,
  removeMyCandidateProfilePhoto,
  uploadMyCandidateProfilePhoto,
  validateCandidateProfilePhoto,
} from '../services/candidateProfilePhotoService';
import { CandidateAvatarFrame } from './CandidateAvatar';

interface CandidateProfilePhotoEditorProps {
  candidateName: string;
}

export default function CandidateProfilePhotoEditor({
  candidateName,
}: CandidateProfilePhotoEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [photoUrl, setPhotoUrl] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const displayName = profile?.legal_name || candidateName || 'AgileCert Candidate';

  const loadPhoto = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');
      const nextProfile = await getMyCandidateProfile();
      const nextPhotoUrl = nextProfile?.profile_photo_path
        ? await createCandidateProfilePhotoSignedUrl(nextProfile.profile_photo_path)
        : '';
      setProfile(nextProfile);
      setPhotoUrl(nextPhotoUrl);
    } catch (loadError: any) {
      setError(loadError?.message || 'Your profile photo could not be loaded.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPhoto();

    const refresh = () => void loadPhoto();
    window.addEventListener('agilecert-profile-photo-refresh', refresh);
    return () => window.removeEventListener('agilecert-profile-photo-refresh', refresh);
  }, [loadPhoto]);

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

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-50">
      <div className="grid gap-6 p-5 md:grid-cols-[auto_1fr] md:items-center md:p-6">
        <div className="flex justify-center md:justify-start">
          <CandidateAvatarFrame
            candidateName={displayName}
            photoUrl={photoUrl}
            isLoading={isLoading}
            size="xl"
            className="border-4 border-white shadow-lg"
          />
        </div>

        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
            Candidate profile photo
          </p>
          <h2 className="mt-1 text-xl font-black text-slate-900">Personalise your workspace</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Upload a clear professional image for your private candidate workspace and authenticated header.
            The image is delivered through a temporary signed link and is not publicly accessible.
          </p>

          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(event) => void handleFileChange(event.target.files?.[0] || null)}
          />

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={isLoading || isUploading || isRemoving}
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
              disabled={!profile?.profile_photo_path || isLoading || isUploading || isRemoving}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-3 text-sm font-black text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isRemoving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Remove photo
            </button>
          </div>

          <p className="mt-3 text-xs leading-5 text-slate-500">
            JPEG, PNG or WebP only. Maximum file size: 3 MB.
          </p>
        </div>
      </div>

      {(error || message) && (
        <div className="border-t border-slate-200 bg-white px-5 py-4 md:px-6">
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
        </div>
      )}

      <div className="flex items-start gap-3 border-t border-amber-200 bg-amber-50 px-5 py-4 text-xs leading-5 text-amber-900 md:px-6">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
        <p>
          This workspace image is not identity-verification evidence. Government-ID, selfie and biometric
          verification remain outside Phase 2.
        </p>
      </div>
    </section>
  );
}

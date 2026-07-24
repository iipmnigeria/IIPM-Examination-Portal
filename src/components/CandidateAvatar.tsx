import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { getMyCandidateProfile } from '../services/candidateProfileService';
import { createCandidateProfilePhotoSignedUrl } from '../services/candidateProfilePhotoService';

export type CandidateAvatarSize = 'sm' | 'md' | 'lg' | 'xl';

const sizeClasses: Record<CandidateAvatarSize, string> = {
  sm: 'h-9 w-9 text-[11px]',
  md: 'h-12 w-12 text-sm',
  lg: 'h-16 w-16 text-lg',
  xl: 'h-32 w-32 text-3xl',
};

export function candidateInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  return parts.map((part) => part.charAt(0).toUpperCase()).join('') || 'AC';
}

interface CandidateAvatarFrameProps {
  candidateName: string;
  photoUrl?: string;
  isLoading?: boolean;
  size?: CandidateAvatarSize;
  className?: string;
}

export function CandidateAvatarFrame({
  candidateName,
  photoUrl = '',
  isLoading = false,
  size = 'md',
  className = '',
}: CandidateAvatarFrameProps) {
  const initials = useMemo(() => candidateInitials(candidateName), [candidateName]);

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-emerald-400/50 bg-emerald-600 font-black text-white shadow-sm ${sizeClasses[size]} ${className}`}
      aria-label={`${candidateName || 'Candidate'} profile photo`}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : photoUrl ? (
        <img
          src={photoUrl}
          alt={`${candidateName || 'Candidate'} profile`}
          className="h-full w-full object-cover"
          decoding="async"
          draggable={false}
        />
      ) : (
        initials
      )}
    </span>
  );
}

interface CandidateAvatarProps {
  candidateName: string;
  size?: CandidateAvatarSize;
  className?: string;
}

export default function CandidateAvatar({
  candidateName,
  size = 'md',
  className = '',
}: CandidateAvatarProps) {
  const [photoUrl, setPhotoUrl] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const loadPhoto = useCallback(async () => {
    try {
      setIsLoading(true);
      const profile = await getMyCandidateProfile();
      const nextPhotoUrl = profile?.profile_photo_path
        ? await createCandidateProfilePhotoSignedUrl(profile.profile_photo_path)
        : '';
      setPhotoUrl(nextPhotoUrl);
    } catch (error) {
      console.warn('Candidate avatar could not be refreshed.', error);
      setPhotoUrl('');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPhoto();

    const refresh = () => void loadPhoto();
    const signedUrlRefresh = window.setInterval(refresh, 50 * 60 * 1_000);
    window.addEventListener('agilecert-profile-photo-refresh', refresh);

    return () => {
      window.clearInterval(signedUrlRefresh);
      window.removeEventListener('agilecert-profile-photo-refresh', refresh);
    };
  }, [loadPhoto]);

  return (
    <CandidateAvatarFrame
      candidateName={candidateName}
      photoUrl={photoUrl}
      isLoading={isLoading}
      size={size}
      className={className}
    />
  );
}

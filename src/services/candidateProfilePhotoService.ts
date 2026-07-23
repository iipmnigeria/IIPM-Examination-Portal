import { supabase } from '../lib/supabase';
import type { CandidateProfile } from './candidateProfileService';

const PROFILE_PHOTO_BUCKET = 'candidate-profile-photos';
const PROFILE_PHOTO_MAX_BYTES = 3 * 1024 * 1024;
const PROFILE_PHOTO_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const PROFILE_PHOTO_SIGNED_URL_SECONDS = 60 * 60;

export interface CandidateProfilePhotoResult {
  profile: CandidateProfile;
  path: string;
  signedUrl: string;
}

async function requireCandidateUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw new Error(`Unable to confirm the authenticated candidate: ${error.message}`);
  if (!data.user?.id) throw new Error('Authentication is required to manage a profile photo.');
  return data.user.id;
}

function expectedPhotoPath(userId: string): string {
  return `${userId}/profile/avatar`;
}

export function validateCandidateProfilePhoto(file: File): void {
  if (!PROFILE_PHOTO_MIME_TYPES.has(file.type)) {
    throw new Error('Choose a JPEG, PNG or WebP image.');
  }

  if (file.size <= 0) {
    throw new Error('The selected image is empty.');
  }

  if (file.size > PROFILE_PHOTO_MAX_BYTES) {
    throw new Error('Profile photos must not exceed 3 MB.');
  }
}

export async function createCandidateProfilePhotoSignedUrl(
  profilePhotoPath: string | null | undefined,
): Promise<string> {
  if (!profilePhotoPath) return '';

  const userId = await requireCandidateUserId();
  if (profilePhotoPath !== expectedPhotoPath(userId)) {
    throw new Error('The stored candidate photo path is invalid.');
  }

  const { data, error } = await supabase.storage
    .from(PROFILE_PHOTO_BUCKET)
    .createSignedUrl(profilePhotoPath, PROFILE_PHOTO_SIGNED_URL_SECONDS);

  if (error) throw new Error(`Unable to display your profile photo: ${error.message}`);
  return data.signedUrl;
}

export async function uploadMyCandidateProfilePhoto(
  file: File,
): Promise<CandidateProfilePhotoResult> {
  validateCandidateProfilePhoto(file);

  const userId = await requireCandidateUserId();
  const path = expectedPhotoPath(userId);

  const { error: uploadError } = await supabase.storage
    .from(PROFILE_PHOTO_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Unable to upload your profile photo: ${uploadError.message}`);
  }

  const { data: profile, error: profileError } = await supabase.rpc(
    'set_my_agilecert_candidate_profile_photo',
    { p_profile_photo_path: path },
  );

  if (profileError) {
    // Do not delete the deterministic object here. On replacement, doing so
    // would also remove the candidate's previously linked photo. A retry safely
    // overwrites the same private object path.
    throw new Error(`Unable to link the uploaded profile photo: ${profileError.message}`);
  }

  if (!profile || typeof profile !== 'object') {
    throw new Error('The updated candidate profile was not returned.');
  }

  const signedUrl = await createCandidateProfilePhotoSignedUrl(path);
  return { profile: profile as CandidateProfile, path, signedUrl };
}

export async function removeMyCandidateProfilePhoto(
  currentPath: string | null | undefined,
): Promise<CandidateProfile> {
  const userId = await requireCandidateUserId();
  const path = expectedPhotoPath(userId);

  if (currentPath && currentPath !== path) {
    throw new Error('The stored candidate photo path is invalid.');
  }

  // Clear the profile link first so a storage-cleanup problem never leaves the
  // candidate profile pointing to a missing object.
  const { data: profile, error: profileError } = await supabase.rpc(
    'set_my_agilecert_candidate_profile_photo',
    { p_profile_photo_path: null },
  );

  if (profileError) {
    throw new Error(`Unable to clear your profile photo: ${profileError.message}`);
  }

  if (!profile || typeof profile !== 'object') {
    throw new Error('The updated candidate profile was not returned.');
  }

  const { error: removeError } = await supabase.storage
    .from(PROFILE_PHOTO_BUCKET)
    .remove([path]);

  if (removeError && !/not found/i.test(removeError.message)) {
    console.warn('Candidate profile photo link was cleared but storage cleanup failed:', removeError);
  }

  return profile as CandidateProfile;
}

import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export type PortalRole = 'candidate' | 'auditor' | 'exam_admin' | 'super_admin';

export interface PortalProfile {
  id: string;
  full_name: string;
  email: string;
  role: PortalRole;
  candidate_code: string | null;
  is_active: boolean;
}

export interface AuthenticatedPortalUser {
  user: User;
  session: Session;
  profile: PortalProfile;
}

async function loadProfile(userId: string): Promise<PortalProfile> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, candidate_code, is_active')
    .eq('id', userId)
    .single();

  if (error) {
    throw new Error(`Unable to load the portal profile: ${error.message}`);
  }

  if (!data.is_active) {
    await supabase.auth.signOut();
    throw new Error('This portal account has been suspended. Contact IIPM support.');
  }

  return data as PortalProfile;
}

export async function registerCandidate(input: {
  fullName: string;
  email: string;
  password: string;
}): Promise<{ requiresEmailConfirmation: boolean }> {
  const fullName = input.fullName.trim();
  const email = input.email.trim().toLowerCase();

  if (fullName.length < 3) throw new Error('Enter the candidate’s full legal name.');
  if (!email.includes('@')) throw new Error('Enter a valid email address.');
  if (input.password.length < 8) throw new Error('Password must contain at least eight characters.');

  const { data, error } = await supabase.auth.signUp({
    email,
    password: input.password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${window.location.origin}${window.location.pathname}`,
    },
  });

  if (error) throw new Error(error.message);

  return { requiresEmailConfirmation: !data.session };
}

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<AuthenticatedPortalUser> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  if (error) throw new Error(error.message);
  if (!data.user || !data.session) throw new Error('Supabase did not return an authenticated session.');

  const profile = await loadProfile(data.user.id);
  return { user: data.user, session: data.session, profile };
}

export async function signInAsCandidate(
  email: string,
  password: string,
): Promise<AuthenticatedPortalUser> {
  const result = await signInWithEmail(email, password);
  if (result.profile.role !== 'candidate') {
    await supabase.auth.signOut();
    throw new Error('This account is not registered as a candidate.');
  }
  return result;
}

export async function signInAsStaff(
  email: string,
  password: string,
): Promise<AuthenticatedPortalUser> {
  const result = await signInWithEmail(email, password);
  if (!['auditor', 'exam_admin', 'super_admin'].includes(result.profile.role)) {
    await supabase.auth.signOut();
    throw new Error('This account has not been authorised for auditor access.');
  }
  return result;
}

export async function getCurrentPortalUser(): Promise<AuthenticatedPortalUser | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(error.message);
  if (!data.session?.user) return null;

  const profile = await loadProfile(data.session.user.id);
  return { user: data.session.user, session: data.session, profile };
}

export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: `${window.location.origin}${window.location.pathname}`,
  });
  if (error) throw new Error(error.message);
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}

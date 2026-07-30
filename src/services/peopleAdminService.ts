import { supabase } from '../lib/supabase';
import type { PortalRole } from './authService';

export interface PeopleDirectoryRecord {
  id: string;
  fullName: string;
  email: string;
  role: PortalRole;
  candidateCode?: string | null;
  phone: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  emailConfirmedAt?: string | null;
  lastSignInAt?: string | null;
  countryCode?: string | null;
  preferredCurrency?: string | null;
  timezone?: string | null;
  professionalHeadline?: string | null;
  employer?: string | null;
  industry?: string | null;
  marketingConsent: boolean;
  certificateEmailUpdates: boolean;
  courseRecommendationEmails: boolean;
  profileUpdateRequired: boolean;
  onboardingComplete: boolean;
  onboardingCompletedAt?: string | null;
  profileUpdatedAt?: string | null;
  programmeCodes: string[];
}

export interface PeopleDirectoryResponse {
  total: number;
  records: PeopleDirectoryRecord[];
}

export interface PeopleDirectoryFilters {
  search?: string;
  role?: 'all' | PortalRole;
  status?: 'all' | 'active' | 'inactive';
  profileState?: 'all' | 'complete' | 'incomplete' | 'staff';
  limit?: number;
  offset?: number;
}

async function functionErrorMessage(error: any, fallback: string): Promise<string> {
  const context = error?.context;
  if (context instanceof Response) {
    try {
      const payload = await context.clone().json();
      if (payload?.error) return String(payload.error);
      if (payload?.message) return String(payload.message);
    } catch {
      // Use the normal function error below.
    }
  }
  return error?.message || fallback;
}

export async function getPeopleDirectory(
  filters: PeopleDirectoryFilters = {},
): Promise<PeopleDirectoryResponse> {
  const { data, error } = await supabase.rpc('get_agilecert_people_directory', {
    p_search: filters.search?.trim() || null,
    p_role: filters.role || 'all',
    p_status: filters.status || 'all',
    p_profile_state: filters.profileState || 'all',
    p_limit: filters.limit || 200,
    p_offset: filters.offset || 0,
  });
  if (error) throw new Error(`Unable to load the people directory: ${error.message}`);
  const payload = (data || {}) as Record<string, unknown>;
  return {
    total: Number(payload.total || 0),
    records: Array.isArray(payload.records) ? payload.records as PeopleDirectoryRecord[] : [],
  };
}

export async function invitePortalAccount(input: {
  fullName: string;
  email: string;
  role: Exclude<PortalRole, 'super_admin'>;
}): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.functions.invoke('agilecert-people-admin', {
    body: {
      action: 'invite-account',
      fullName: input.fullName.trim(),
      email: input.email.trim().toLowerCase(),
      role: input.role,
    },
  });
  if (error) {
    throw new Error(await functionErrorMessage(error, 'The portal invitation could not be created.'));
  }
  return (data || {}) as Record<string, unknown>;
}

export async function updatePortalPerson(input: {
  userId: string;
  fullName?: string | null;
  phone?: string | null;
  role?: PortalRole | null;
  isActive?: boolean | null;
  requireProfileUpdate?: boolean | null;
}): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.rpc('update_agilecert_person_admin', {
    p_user_id: input.userId,
    p_full_name: input.fullName ?? null,
    p_phone: input.phone ?? null,
    p_role: input.role ?? null,
    p_is_active: input.isActive ?? null,
    p_require_profile_update: input.requireProfileUpdate ?? null,
  });
  if (error) throw new Error(`Unable to update the portal account: ${error.message}`);
  return (data || {}) as Record<string, unknown>;
}

export async function queueAdminMessage(input: {
  recipientIds: string[];
  subject: string;
  body: string;
  category: 'operational' | 'marketing';
  groupLabel?: string;
}): Promise<{ queued: number; skipped: number; category: string; subject: string }> {
  const { data, error } = await supabase.rpc('queue_agilecert_admin_message', {
    p_recipient_ids: input.recipientIds,
    p_subject: input.subject.trim(),
    p_body: input.body.trim(),
    p_category: input.category,
    p_group_label: input.groupLabel?.trim() || null,
  });
  if (error) throw new Error(`Unable to queue the administrator message: ${error.message}`);
  const payload = (data || {}) as Record<string, unknown>;
  return {
    queued: Number(payload.queued || 0),
    skipped: Number(payload.skipped || 0),
    category: String(payload.category || input.category),
    subject: String(payload.subject || input.subject),
  };
}

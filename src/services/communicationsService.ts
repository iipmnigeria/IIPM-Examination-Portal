import { supabase } from '../lib/supabase';

export interface CommunicationPreferences {
  certificateReminders: boolean;
  courseRecommendations: boolean;
  operationalMessages: boolean;
  optionalUnsubscribedAt?: string | null;
  updatedAt?: string | null;
}

export interface CommunicationSettings {
  singleton: boolean;
  provider: string;
  provider_enabled: boolean;
  from_name: string;
  from_email?: string | null;
  reply_to_email?: string | null;
  portal_url: string;
  hourly_batch_size: number;
  max_attempts: number;
  updated_at?: string;
}

export interface CommunicationsAdminConsole {
  generatedAt: string;
  settings: CommunicationSettings;
  counts: {
    queued: number;
    processing: number;
    sent: number;
    failed: number;
    suppressed: number;
    cancelled: number;
  };
  recentOutbox: Array<Record<string, any>>;
  recentEvents: Array<Record<string, any>>;
}

export async function getMyCommunicationPreferences(): Promise<CommunicationPreferences> {
  const { data, error } = await supabase.rpc('get_my_agilecert_communication_preferences');
  if (error) throw new Error(`Unable to load communication preferences: ${error.message}`);
  return data as CommunicationPreferences;
}

export async function updateMyCommunicationPreferences(input: {
  certificateReminders: boolean;
  courseRecommendations: boolean;
}): Promise<CommunicationPreferences> {
  const { data, error } = await supabase.rpc('update_my_agilecert_communication_preferences', {
    p_certificate_reminders: input.certificateReminders,
    p_course_recommendations: input.courseRecommendations,
  });
  if (error) throw new Error(`Unable to update communication preferences: ${error.message}`);
  return data as CommunicationPreferences;
}

export async function getCommunicationsAdminConsole(): Promise<CommunicationsAdminConsole> {
  const { data, error } = await supabase.rpc('get_agilecert_communications_admin_console');
  if (error) throw new Error(`Unable to load communications console: ${error.message}`);
  return data as CommunicationsAdminConsole;
}

export async function updateCommunicationSettings(input: {
  providerEnabled: boolean;
  fromName: string;
  fromEmail: string;
  replyToEmail: string;
  hourlyBatchSize: number;
  maxAttempts: number;
}): Promise<CommunicationsAdminConsole> {
  const { data, error } = await supabase.rpc('update_agilecert_communication_settings', {
    p_provider_enabled: input.providerEnabled,
    p_from_name: input.fromName.trim(),
    p_from_email: input.fromEmail.trim() || null,
    p_reply_to_email: input.replyToEmail.trim() || null,
    p_hourly_batch_size: input.hourlyBatchSize,
    p_max_attempts: input.maxAttempts,
  });
  if (error) throw new Error(`Unable to update communication settings: ${error.message}`);
  return data as CommunicationsAdminConsole;
}

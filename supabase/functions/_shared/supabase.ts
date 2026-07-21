import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2';
import { bearerToken } from './http.ts';

function parseNamedKey(variableName: string): string {
  const raw = Deno.env.get(variableName);
  if (!raw) return '';

  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return Object.values(parsed).find(Boolean) || '';
  } catch {
    return '';
  }
}

export function requiredEnvironment(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

export function supabaseUrl(): string {
  return requiredEnvironment('SUPABASE_URL');
}

export function publishableKey(): string {
  const key =
    Deno.env.get('SUPABASE_ANON_KEY') ||
    Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ||
    parseNamedKey('SUPABASE_PUBLISHABLE_KEYS');

  if (!key) throw new Error('A Supabase publishable key is not available to the Edge Function.');
  return key;
}

export function serviceRoleKey(): string {
  const key =
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ||
    Deno.env.get('SUPABASE_SECRET_KEY') ||
    parseNamedKey('SUPABASE_SECRET_KEYS');

  if (!key) throw new Error('A Supabase service-role or secret key is not available.');
  return key;
}

export function adminClient(): SupabaseClient {
  return createClient(supabaseUrl(), serviceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function userClient(request: Request): SupabaseClient {
  const token = bearerToken(request);
  if (!token) throw new Error('Authentication is required.');

  return createClient(supabaseUrl(), publishableKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: { Authorization: `Bearer ${token}` },
    },
  });
}

export async function requireAuthenticatedUser(request: Request): Promise<User> {
  const token = bearerToken(request);
  if (!token) throw new Error('Authentication is required.');

  const client = adminClient();
  const { data, error } = await client.auth.getUser(token);

  if (error || !data.user) {
    throw new Error('The candidate session is invalid or has expired.');
  }

  return data.user;
}

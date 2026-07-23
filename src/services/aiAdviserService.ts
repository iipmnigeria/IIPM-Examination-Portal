import { supabase } from '../lib/supabase';

export type AgileCertAdviserRole = 'user' | 'assistant';

export interface AgileCertAdviserHistoryMessage {
  role: AgileCertAdviserRole;
  text: string;
}

export interface AgileCertAdviserRecommendation {
  examinationId: string;
  title: string;
  reason: string;
}

export interface AgileCertAdviserResponse {
  answer: string;
  recommendations: AgileCertAdviserRecommendation[];
  leadIntent:
    | 'information'
    | 'comparison'
    | 'ready_to_register'
    | 'ready_to_pay'
    | 'support'
    | 'human_escalation';
  escalationRequired: boolean;
  suggestedActions: string[];
  remainingMessages?: number;
  model?: string;
}

const SESSION_STORAGE_KEY = 'agilecert_ai_adviser_session_id';

function createSessionId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `agc-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

export function getAgileCertAdviserSessionId(): string {
  try {
    const existing = window.localStorage.getItem(SESSION_STORAGE_KEY)?.trim();
    if (existing && existing.length >= 16) return existing;

    const created = createSessionId();
    window.localStorage.setItem(SESSION_STORAGE_KEY, created);
    return created;
  } catch {
    return createSessionId();
  }
}

async function functionErrorMessage(error: any, fallback: string): Promise<string> {
  const context = error?.context;

  if (context instanceof Response) {
    try {
      const payload = await context.clone().json();
      if (payload?.error) return String(payload.error);
      if (payload?.message) return String(payload.message);
    } catch {
      try {
        const text = await context.clone().text();
        if (text.trim()) return text.trim();
      } catch {
        // Use the normal function error below.
      }
    }
  }

  return error?.message || fallback;
}

export async function askAgileCertAdviser(input: {
  message: string;
  history?: AgileCertAdviserHistoryMessage[];
}): Promise<AgileCertAdviserResponse> {
  const message = input.message.trim();
  if (message.length < 2) throw new Error('Enter a certification or examination question.');

  const { data, error } = await supabase.functions.invoke('agilecert-ai-adviser', {
    body: {
      sessionId: getAgileCertAdviserSessionId(),
      message,
      history: (input.history || []).slice(-8),
    },
  });

  if (error) {
    throw new Error(
      await functionErrorMessage(error, 'The AgileCert AI Certification Adviser is temporarily unavailable.'),
    );
  }
  if (!data || typeof data !== 'object') {
    throw new Error('The AI Certification Adviser did not return a response.');
  }

  return data as AgileCertAdviserResponse;
}

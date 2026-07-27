import { supabase } from '../lib/supabase';
import {
  getMyCandidateCvDocument,
  saveMyCandidateCvDocument,
  type CandidateCvDocument,
  type CandidateCvExperience,
} from './aiCvProfileBuilderService';

export type AiCvEnhancementKind =
  | 'professional_summary'
  | 'role_tailoring'
  | 'achievement_rewrite'
  | 'skills_recommendation';

export interface AiCvExperienceSuggestion {
  experienceId: string;
  highlights: string[];
}

export interface AiCvEnhancementResponse {
  requestId: string;
  action: AiCvEnhancementKind;
  professionalSummary: string;
  skills: string[];
  experienceHighlights: AiCvExperienceSuggestion[];
  rationale: string;
  cautions: string[];
  remainingRequests: number;
  hourlyLimit: number;
  model: string;
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

function uniqueStrings(values: string[], limit: number): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).slice(0, limit);
}

function mergeExperience(
  experience: CandidateCvExperience[],
  suggestions: AiCvExperienceSuggestion[],
): CandidateCvExperience[] {
  const suggestionById = new Map(
    suggestions.map((suggestion) => [suggestion.experienceId, uniqueStrings(suggestion.highlights, 12)]),
  );

  return experience.map((item) => {
    const suggested = suggestionById.get(item.id);
    return suggested?.length ? { ...item, highlights: suggested } : item;
  });
}

export async function setMyAiCvProcessingConsent(consent: boolean): Promise<boolean> {
  const { data, error } = await supabase.rpc('set_my_agilecert_ai_cv_consent', {
    p_consent: consent,
  });
  if (error) throw new Error(`Unable to update AI CV consent: ${error.message}`);
  return Boolean((data as Record<string, unknown> | null)?.consent);
}

export async function requestAiCvEnhancement(input: {
  action: AiCvEnhancementKind;
  targetRole?: string;
  instruction?: string;
}): Promise<AiCvEnhancementResponse> {
  const { data, error } = await supabase.functions.invoke('agilecert-ai-cv', {
    body: {
      action: input.action,
      targetRole: input.targetRole?.trim() || null,
      instruction: input.instruction?.trim() || null,
    },
  });

  if (error) {
    throw new Error(
      await functionErrorMessage(error, 'The AI CV assistant is temporarily unavailable.'),
    );
  }
  if (!data || typeof data !== 'object') {
    throw new Error('The AI CV assistant did not return a suggestion.');
  }
  return data as AiCvEnhancementResponse;
}

export async function applyAiCvEnhancement(
  document: CandidateCvDocument,
  enhancement: AiCvEnhancementResponse,
): Promise<CandidateCvDocument> {
  const professionalSummary = enhancement.professionalSummary.trim()
    ? enhancement.professionalSummary.trim()
    : document.professional_summary || '';
  const skills = enhancement.skills.length
    ? uniqueStrings(enhancement.skills, 50)
    : document.skills;
  const experience = mergeExperience(document.experience, enhancement.experienceHighlights);

  const saved = await saveMyCandidateCvDocument({
    documentTitle: document.document_title,
    targetRole: document.target_role || '',
    professionalSummary,
    contactEmail: document.contact_email || '',
    contactPhone: document.contact_phone || '',
    contactLocation: document.contact_location || '',
    linkedinUrl: document.linkedin_url || '',
    portfolioUrl: document.portfolio_url || '',
    skills,
    languages: document.languages,
    experience,
    education: document.education,
    certifications: document.certifications,
    projects: document.projects,
    awards: document.awards,
    affiliations: document.affiliations,
    referencesText: document.references_text || '',
    templateKey: document.template_key,
    status: document.status,
    aiProcessingConsent: true,
  });

  const { error } = await supabase.rpc('mark_my_agilecert_ai_cv_enhancement_applied', {
    p_request_id: enhancement.requestId,
  });
  if (error) {
    throw new Error(
      `The CV was saved, but the AI enhancement audit could not be completed: ${error.message}`,
    );
  }

  return (await getMyCandidateCvDocument()) || saved;
}

import { bearerToken, jsonResponse, preflightResponse } from '../_shared/http.ts';
import { adminClient } from '../_shared/supabase.ts';

type AdviserMessage = {
  role?: 'user' | 'assistant';
  text?: string;
};

type AdviserRequest = {
  sessionId?: string;
  message?: string;
  history?: AdviserMessage[];
};

type Programme = {
  id: string;
  code: string;
  name: string;
  description: string | null;
};

type Examination = {
  id: string;
  programme_id: string;
  title: string;
  instructions: string | null;
  duration_minutes: number;
  pass_mark: number;
};

type ExamPrice = {
  examination_id: string;
  currency: string;
  amount_minor: number;
  is_default: boolean;
};

type AdviserRecommendation = {
  examinationId: string;
  title: string;
  reason: string;
};

type AdviserResponse = {
  answer: string;
  recommendations: AdviserRecommendation[];
  leadIntent: string;
  escalationRequired: boolean;
  suggestedActions: string[];
};

function requiredEnvironment(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function cleanText(value: unknown, maxLength: number): string {
  return String(value || '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLength);
}

function money(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat(currency === 'NGN' ? 'en-NG' : 'en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'NGN' ? 0 : 2,
  }).format(amountMinor / 100);
}

async function optionalCandidateId(
  admin: ReturnType<typeof adminClient>,
  request: Request,
): Promise<string | null> {
  const token = bearerToken(request);
  if (!token) return null;

  try {
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data.user) return null;
    return data.user.id;
  } catch {
    return null;
  }
}

function catalogueContext(
  programmes: Programme[],
  examinations: Examination[],
  prices: ExamPrice[],
): string {
  const programmeById = new Map(programmes.map((programme) => [programme.id, programme]));

  return examinations
    .map((examination) => {
      const programme = programmeById.get(examination.programme_id);
      const examinationPrices = prices
        .filter((price) => price.examination_id === examination.id)
        .map((price) => `${price.currency} ${money(Number(price.amount_minor), price.currency)}`)
        .join(' / ');

      return [
        `Examination ID: ${examination.id}`,
        `Programme code: ${programme?.code || 'N/A'}`,
        `Programme: ${programme?.name || examination.title}`,
        `Title: ${examination.title}`,
        `Description: ${programme?.description || 'Focused specialist competency examination.'}`,
        `Duration: ${examination.duration_minutes} minutes`,
        `Pass mark: ${Number(examination.pass_mark)}%`,
        `Examination price: ${examinationPrices || 'Displayed in the candidate portal'}`,
      ].join('\n');
    })
    .join('\n\n');
}

function parseGeminiJson(text: string): AdviserResponse {
  const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
  const parsed = JSON.parse(cleaned) as Record<string, unknown>;

  const answer = cleanText(parsed.answer, 5000);
  if (!answer) throw new Error('The AI adviser returned an empty answer.');

  const recommendations = Array.isArray(parsed.recommendations)
    ? parsed.recommendations.slice(0, 4).map((item) => {
        const row = (item || {}) as Record<string, unknown>;
        return {
          examinationId: cleanText(row.examinationId, 80),
          title: cleanText(row.title, 200),
          reason: cleanText(row.reason, 500),
        };
      })
    : [];

  const suggestedActions = Array.isArray(parsed.suggestedActions)
    ? parsed.suggestedActions.slice(0, 4).map((item) => cleanText(item, 200)).filter(Boolean)
    : [];

  return {
    answer,
    recommendations,
    leadIntent: cleanText(parsed.leadIntent, 80) || 'information',
    escalationRequired: Boolean(parsed.escalationRequired),
    suggestedActions,
  };
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return preflightResponse(request);
  if (request.method !== 'POST') {
    return jsonResponse(request, { error: 'Method not allowed.' }, 405);
  }

  try {
    const body = (await request.json()) as AdviserRequest;
    const rawSessionId = cleanText(body.sessionId, 128);
    const message = cleanText(body.message, 2000);

    if (rawSessionId.length < 16) {
      return jsonResponse(request, { error: 'A valid adviser session is required.' }, 400);
    }
    if (message.length < 2) {
      return jsonResponse(request, { error: 'Enter a certification or examination question.' }, 400);
    }

    const salt = requiredEnvironment('AGILECERT_CHAT_SALT');
    const apiKey = requiredEnvironment('GEMINI_API_KEY');
    const model = Deno.env.get('AGILECERT_GEMINI_MODEL')?.trim() || 'gemini-3.6-flash';
    const admin = adminClient();
    const candidateId = await optionalCandidateId(admin, request);
    const sessionKeyHash = await sha256Hex(`${salt}:${rawSessionId}`);

    const { data: rateData, error: rateError } = await admin.rpc(
      'register_agilecert_ai_chat_request',
      {
        p_session_key_hash: sessionKeyHash,
        p_candidate_id: candidateId,
        p_hourly_limit: 30,
      },
    );

    if (rateError) throw new Error(rateError.message);
    const rate = (rateData || {}) as Record<string, unknown>;
    if (!rate.allowed) {
      return jsonResponse(
        request,
        {
          error: 'The adviser message limit has been reached for this hour. Please continue later or use the candidate support contact.',
          remaining: 0,
        },
        429,
      );
    }

    const [programmesResult, examinationsResult, pricesResult] = await Promise.all([
      admin
        .from('programmes')
        .select('id, code, name, description')
        .eq('is_active', true)
        .order('name'),
      admin
        .from('examinations')
        .select('id, programme_id, title, instructions, duration_minutes, pass_mark')
        .eq('status', 'published')
        .order('title'),
      admin
        .from('exam_prices')
        .select('examination_id, currency, amount_minor, is_default')
        .eq('is_active', true)
        .lte('effective_from', new Date().toISOString())
        .or(`effective_to.is.null,effective_to.gt.${new Date().toISOString()}`),
    ]);

    if (programmesResult.error) throw new Error(programmesResult.error.message);
    if (examinationsResult.error) throw new Error(examinationsResult.error.message);
    if (pricesResult.error) throw new Error(pricesResult.error.message);

    const programmes = (programmesResult.data || []) as Programme[];
    const examinations = (examinationsResult.data || []) as Examination[];
    const prices = (pricesResult.data || []) as ExamPrice[];
    const allowedExaminationIds = new Set(examinations.map((examination) => examination.id));
    const history = Array.isArray(body.history)
      ? body.history
          .slice(-8)
          .map((item) => ({
            role: item.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: cleanText(item.text, 1200) }],
          }))
          .filter((item) => item.parts[0].text)
      : [];

    const systemInstruction = `You are the AgileCert Global AI Certification Adviser, powered by IIPM.

Your responsibilities:
- Help visitors choose focused, modular specialist examinations from the published catalogue supplied below.
- Explain examination requirements, separate examination and certificate fees, the seven-day certificate early-price window, preparation materials, digital badges, LinkedIn sharing and verification.
- Encourage a suitable next step without pressure or invented claims.
- Clearly distinguish AgileCert Global modular examination-led credentials from IIPM full professional training and certification pathways.
- State that AgileCert Global credentials are independently developed and issued by AgileCert Global, powered by IIPM.

Mandatory safeguards:
- Never claim that AgileCert Global is PMI, SHRM, Microsoft, Scrum.org, CIPM or any third-party body.
- Never claim endorsement, authorisation, equivalence or universal recognition unless explicitly provided in the catalogue context.
- Never provide, reconstruct, guess or discuss live examination questions, answer keys or correct answers.
- Never change scores, approve certificates, promise refunds or disclose personal account/payment records.
- For payment disputes, suspected fraud, identity rejection, refunds, legal complaints or inaccessible paid services, set escalationRequired to true and advise human support.
- Examination payment covers examination access and available preparation PDFs. Certificate issuance is optional and separately paid after passing.
- Certificate of Achievement and Professional Certificate are available only after meeting the pass mark. Professional Certificate requires verified identity and integrity clearance.
- Keep answers concise, warm and commercially helpful.

Published catalogue:
${catalogueContext(programmes, examinations, prices)}

Return valid JSON only with this shape:
{
  "answer": "helpful response",
  "recommendations": [{"examinationId":"published UUID","title":"published title","reason":"why it fits"}],
  "leadIntent": "information|comparison|ready_to_register|ready_to_pay|support|human_escalation",
  "escalationRequired": false,
  "suggestedActions": ["short action"]
}`;

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    const geminiResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemInstruction }],
        },
        contents: [
          ...history,
          { role: 'user', parts: [{ text: message }] },
        ],
        generationConfig: {
          temperature: 0.25,
          maxOutputTokens: 1200,
          responseMimeType: 'application/json',
          responseJsonSchema: {
            type: 'object',
            required: ['answer', 'recommendations', 'leadIntent', 'escalationRequired', 'suggestedActions'],
            properties: {
              answer: { type: 'string' },
              recommendations: {
                type: 'array',
                maxItems: 4,
                items: {
                  type: 'object',
                  required: ['examinationId', 'title', 'reason'],
                  properties: {
                    examinationId: { type: 'string' },
                    title: { type: 'string' },
                    reason: { type: 'string' },
                  },
                },
              },
              leadIntent: {
                type: 'string',
                enum: ['information', 'comparison', 'ready_to_register', 'ready_to_pay', 'support', 'human_escalation'],
              },
              escalationRequired: { type: 'boolean' },
              suggestedActions: {
                type: 'array',
                maxItems: 4,
                items: { type: 'string' },
              },
            },
          },
        },
      }),
    });

    let geminiPayload: Record<string, unknown> = {};
    try {
      geminiPayload = (await geminiResponse.json()) as Record<string, unknown>;
    } catch {
      // The HTTP status below remains authoritative.
    }

    if (!geminiResponse.ok) {
      const errorPayload = (geminiPayload.error || {}) as Record<string, unknown>;
      throw new Error(String(errorPayload.message || `Gemini returned ${geminiResponse.status}.`));
    }

    const candidates = Array.isArray(geminiPayload.candidates)
      ? (geminiPayload.candidates as Array<Record<string, unknown>>)
      : [];
    const content = (candidates[0]?.content || {}) as Record<string, unknown>;
    const parts = Array.isArray(content.parts)
      ? (content.parts as Array<Record<string, unknown>>)
      : [];
    const responseText = parts.map((part) => String(part.text || '')).join('').trim();
    const adviser = parseGeminiJson(responseText);

    adviser.recommendations = adviser.recommendations.filter(
      (recommendation) => allowedExaminationIds.has(recommendation.examinationId),
    );
    if (adviser.escalationRequired) adviser.leadIntent = 'human_escalation';

    const recommendationIds = adviser.recommendations.map(
      (recommendation) => recommendation.examinationId,
    );
    const providerRequestId = geminiResponse.headers.get('x-request-id') || null;
    const { error: recordError } = await admin.rpc('record_agilecert_ai_chat_response', {
      p_session_id: String(rate.sessionId),
      p_candidate_id: candidateId,
      p_user_message: message,
      p_assistant_message: adviser.answer,
      p_recommended_examination_ids: recommendationIds,
      p_lead_intent: adviser.leadIntent,
      p_escalation_required: adviser.escalationRequired,
      p_model: model,
      p_provider_request_id: providerRequestId,
      p_metadata: {
        recommendationCount: adviser.recommendations.length,
        remainingMessages: rate.remaining,
      },
    });

    if (recordError) console.error('Unable to record AI adviser response:', recordError);

    return jsonResponse(request, {
      ...adviser,
      remainingMessages: rate.remaining,
      model,
    });
  } catch (error) {
    console.error('agilecert-ai-adviser failed:', error);
    const message = error instanceof Error ? error.message : 'The AI adviser is temporarily unavailable.';
    return jsonResponse(request, { error: message }, 400);
  }
});

import { jsonResponse, preflightResponse } from '../_shared/http.ts';
import {
  renderAgileCertAutomationEmail,
  sendAgileCertEmail,
  type AgileCertEmailContext,
} from '../_shared/agilecertEmail.ts';
import { adminClient } from '../_shared/supabase.ts';

type WorkerRequest = {
  limit?: number;
  workerId?: string;
};

type AutomationJob = {
  id: string;
  candidate_id: string;
  eligibility_id: string | null;
  certificate_order_id: string | null;
  job_type: string;
  scheduled_for: string;
  status: string;
  attempt_count: number;
  payload: Record<string, unknown> | null;
};

type CandidateProfile = {
  legal_name: string | null;
  country_code: string | null;
  pricing_currency: string | null;
  certification_interests: string[] | null;
  certificate_email_updates: boolean;
  course_recommendation_emails: boolean;
  marketing_consent: boolean;
};

type Eligibility = {
  id: string;
  examination_title: string;
  score: number;
  pass_mark: number;
  passed_at: string;
  early_price_expires_at: string;
  eligibility_status: string;
  integrity_status: string;
};

type Credential = {
  id: string;
  credential_title: string;
  credential_code: string;
  verification_slug: string;
  examination_title: string;
  status: string;
};

type PriceRow = {
  product_code: 'achievement' | 'professional';
  currency: string;
  standard_amount_minor: number;
  early_amount_minor: number;
};

function constantTimeEqual(left: string, right: string): boolean {
  if (!left || left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function portalUrl(value: unknown): string {
  return String(value || 'https://iipmnigeria.github.io/IIPM-Examination-Portal/')
    .trim()
    .replace(/\/$/, '');
}

function candidateCurrency(profile: CandidateProfile | null): 'NGN' | 'USD' {
  if (profile?.pricing_currency === 'NGN' || profile?.pricing_currency === 'USD') {
    return profile.pricing_currency;
  }
  return profile?.country_code?.toUpperCase() === 'NG' ? 'NGN' : 'USD';
}

function isCertificateReminder(jobType: string): boolean {
  return jobType.startsWith('certificate_');
}

async function finishJob(
  admin: ReturnType<typeof adminClient>,
  input: {
    jobId: string;
    status: 'sent' | 'failed' | 'cancelled' | 'suppressed' | 'pending';
    provider?: string | null;
    providerMessageId?: string | null;
    providerStatus?: string | null;
    lastError?: string | null;
    payload?: Record<string, unknown>;
  },
) {
  const { error } = await admin.rpc('finish_agilecert_automation_job', {
    p_job_id: input.jobId,
    p_status: input.status,
    p_provider: input.provider || null,
    p_provider_message_id: input.providerMessageId || null,
    p_provider_status: input.providerStatus || null,
    p_last_error: input.lastError || null,
    p_payload: input.payload || {},
  });
  if (error) throw new Error(error.message);
}

async function hasPurchasedCertificate(
  admin: ReturnType<typeof adminClient>,
  eligibilityId: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from('agilecert_certificate_orders')
    .select('id')
    .eq('eligibility_id', eligibilityId)
    .in('status', ['paid', 'waived'])
    .limit(1);

  if (error) throw new Error(error.message);
  return Boolean(data?.length);
}

async function loadContext(
  admin: ReturnType<typeof adminClient>,
  job: AutomationJob,
): Promise<{
  context: AgileCertEmailContext;
  profile: CandidateProfile | null;
  eligibility: Eligibility | null;
}> {
  const [{ data: settings, error: settingsError }, userResult, profileResult] = await Promise.all([
    admin
      .from('agilecert_platform_settings')
      .select('portal_url')
      .eq('singleton', true)
      .single(),
    admin.auth.admin.getUserById(job.candidate_id),
    admin
      .from('agilecert_candidate_profiles')
      .select(
        'legal_name, country_code, pricing_currency, certification_interests, certificate_email_updates, course_recommendation_emails, marketing_consent',
      )
      .eq('user_id', job.candidate_id)
      .maybeSingle(),
  ]);

  if (settingsError) throw new Error(settingsError.message);
  if (userResult.error) throw new Error(userResult.error.message);
  if (profileResult.error) throw new Error(profileResult.error.message);

  const recipientEmail = String(userResult.data.user?.email || '').trim().toLowerCase();
  if (!recipientEmail) throw new Error('The candidate email address is unavailable.');

  const profile = (profileResult.data || null) as CandidateProfile | null;
  const publicPortalUrl = portalUrl(settings.portal_url);
  let eligibility: Eligibility | null = null;
  let credential: Credential | null = null;

  if (job.eligibility_id) {
    const { data, error } = await admin
      .from('agilecert_certificate_eligibilities')
      .select(
        'id, examination_title, score, pass_mark, passed_at, early_price_expires_at, eligibility_status, integrity_status',
      )
      .eq('id', job.eligibility_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    eligibility = (data || null) as Eligibility | null;
  }

  if (job.certificate_order_id || job.job_type === 'credential_delivery_email') {
    let query = admin
      .from('agilecert_credentials')
      .select('id, credential_title, credential_code, verification_slug, examination_title, status');

    query = job.certificate_order_id
      ? query.eq('certificate_order_id', job.certificate_order_id)
      : query.eq('eligibility_id', job.eligibility_id || '00000000-0000-0000-0000-000000000000');

    const { data, error } = await query.maybeSingle();
    if (error) throw new Error(error.message);
    credential = (data || null) as Credential | null;
  }

  const currency = candidateCurrency(profile);
  const { data: priceData, error: priceError } = await admin
    .from('agilecert_certificate_product_prices')
    .select('product_code, currency, standard_amount_minor, early_amount_minor')
    .eq('currency', currency)
    .eq('active', true);
  if (priceError) throw new Error(priceError.message);

  const prices = (priceData || []) as PriceRow[];
  const earlyActive = eligibility
    ? Date.now() <= new Date(eligibility.early_price_expires_at).getTime()
    : false;
  const priceFor = (productCode: PriceRow['product_code']) => {
    const row = prices.find((item) => item.product_code === productCode);
    if (!row) return null;
    return earlyActive ? Number(row.early_amount_minor) : Number(row.standard_amount_minor);
  };

  const candidateName = profile?.legal_name?.trim()
    || String(userResult.data.user?.user_metadata?.full_name || '').trim()
    || recipientEmail.split('@')[0];

  const verificationUrl = credential
    ? `${publicPortalUrl}/?verify=${encodeURIComponent(credential.verification_slug)}`
    : null;

  const context: AgileCertEmailContext = {
    jobId: job.id,
    jobType: job.job_type,
    candidateName,
    recipientEmail,
    examinationTitle: eligibility?.examination_title || credential?.examination_title || null,
    score: eligibility?.score ?? null,
    passMark: eligibility?.pass_mark ?? null,
    earlyPriceExpiresAt: eligibility?.early_price_expires_at || null,
    currency,
    achievementPriceMinor: priceFor('achievement'),
    professionalPriceMinor: priceFor('professional'),
    credentialTitle: credential?.credential_title || null,
    credentialCode: credential?.credential_code || null,
    verificationUrl,
    portalUrl: publicPortalUrl,
    profileUrl: publicPortalUrl,
    recommendedProgrammes: profile?.certification_interests?.filter(Boolean) || [],
  };

  return { context, profile, eligibility };
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return preflightResponse(request);
  if (request.method !== 'POST') {
    return jsonResponse(request, { error: 'Method not allowed.' }, 405);
  }

  const expectedSecret = Deno.env.get('AGILECERT_AUTOMATION_SECRET')?.trim() || '';
  const suppliedSecret = request.headers.get('x-agilecert-automation-secret')?.trim() || '';
  if (!expectedSecret || !constantTimeEqual(expectedSecret, suppliedSecret)) {
    return jsonResponse(request, { error: 'Invalid automation worker secret.' }, 401);
  }

  const workerInput = (await request.json().catch(() => ({}))) as WorkerRequest;
  const limit = Math.max(1, Math.min(Number(workerInput.limit) || 25, 100));
  const workerId = workerInput.workerId?.trim() || crypto.randomUUID();
  const admin = adminClient();

  const { data: claimedData, error: claimError } = await admin.rpc(
    'claim_due_agilecert_automation_jobs',
    {
      p_limit: limit,
      p_worker_id: workerId,
    },
  );

  if (claimError) {
    return jsonResponse(request, { error: claimError.message }, 500);
  }

  const jobs = (claimedData || []) as AutomationJob[];
  const results: Array<Record<string, unknown>> = [];

  for (const job of jobs) {
    try {
      const { context, profile, eligibility } = await loadContext(admin, job);

      if (isCertificateReminder(job.job_type)) {
        if (!profile?.certificate_email_updates) {
          await finishJob(admin, {
            jobId: job.id,
            status: 'suppressed',
            lastError: 'Candidate disabled certificate email updates.',
          });
          results.push({ jobId: job.id, status: 'suppressed', reason: 'preference' });
          continue;
        }

        if (!eligibility || eligibility.eligibility_status !== 'eligible' || eligibility.integrity_status !== 'cleared') {
          await finishJob(admin, {
            jobId: job.id,
            status: 'cancelled',
            lastError: 'Certificate eligibility is not active and cleared.',
          });
          results.push({ jobId: job.id, status: 'cancelled', reason: 'eligibility' });
          continue;
        }

        if (job.eligibility_id && await hasPurchasedCertificate(admin, job.eligibility_id)) {
          await finishJob(admin, {
            jobId: job.id,
            status: 'cancelled',
            lastError: 'Certificate has already been purchased.',
          });
          results.push({ jobId: job.id, status: 'cancelled', reason: 'purchased' });
          continue;
        }
      }

      if (job.job_type === 'course_cross_sell' && !profile?.course_recommendation_emails) {
        await finishJob(admin, {
          jobId: job.id,
          status: 'suppressed',
          lastError: 'Candidate disabled course recommendation emails.',
        });
        results.push({ jobId: job.id, status: 'suppressed', reason: 'preference' });
        continue;
      }

      const email = renderAgileCertAutomationEmail(context);
      const sent = await sendAgileCertEmail(context, email);

      await finishJob(admin, {
        jobId: job.id,
        status: 'sent',
        provider: 'resend',
        providerMessageId: sent.id,
        providerStatus: 'email.sent',
        payload: {
          subject: email.subject,
          recipient: context.recipientEmail,
          sentByWorker: workerId,
          sentAt: new Date().toISOString(),
        },
      });

      results.push({ jobId: job.id, status: 'sent', providerMessageId: sent.id });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Automation email failed.';
      const finalAttempt = Number(job.attempt_count) >= 5;

      try {
        await finishJob(admin, {
          jobId: job.id,
          status: finalAttempt ? 'failed' : 'pending',
          lastError: message,
          payload: {
            failedAt: new Date().toISOString(),
            failedByWorker: workerId,
          },
        });
      } catch (finishError) {
        console.error('Unable to record AgileCert automation failure:', finishError);
      }

      results.push({
        jobId: job.id,
        status: finalAttempt ? 'failed' : 'retry_scheduled',
        error: message,
      });
    }
  }

  return jsonResponse(request, {
    workerId,
    claimed: jobs.length,
    processed: results.length,
    results,
  });
});

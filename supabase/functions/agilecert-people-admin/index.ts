import { jsonResponse, preflightResponse } from '../_shared/http.ts';
import { adminClient, requireAuthenticatedUser } from '../_shared/supabase.ts';

type InviteRequest = {
  action?: string;
  fullName?: string;
  email?: string;
  role?: string;
};

const allowedRoles = new Set(['candidate', 'auditor', 'exam_admin']);

function clean(value: unknown, maxLength: number): string {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, maxLength);
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return preflightResponse(request);
  if (request.method !== 'POST') return jsonResponse(request, { error: 'Method not allowed.' }, 405);

  try {
    const actor = await requireAuthenticatedUser(request);
    const admin = adminClient();
    const { data: actorProfile, error: actorError } = await admin
      .from('profiles')
      .select('id, full_name, role, is_active')
      .eq('id', actor.id)
      .single();

    if (actorError) throw new Error(actorError.message);
    if (!actorProfile?.is_active || actorProfile.role !== 'super_admin') {
      return jsonResponse(request, { error: 'Only an active Super Administrator may create portal accounts.' }, 403);
    }

    const body = (await request.json()) as InviteRequest;
    if (body.action !== 'invite-account') {
      return jsonResponse(request, { error: 'Unsupported people administration action.' }, 400);
    }

    const fullName = clean(body.fullName, 180);
    const email = clean(body.email, 320).toLowerCase();
    const role = clean(body.role, 40);
    if (fullName.length < 3) return jsonResponse(request, { error: 'Enter the person’s full name.' }, 400);
    if (!/^\S+@\S+\.\S+$/.test(email)) return jsonResponse(request, { error: 'Enter a valid email address.' }, 400);
    if (!allowedRoles.has(role)) return jsonResponse(request, { error: 'Select candidate, auditor or exam administrator.' }, 400);

    const portalUrl = (Deno.env.get('IIPM_PORTAL_URL') || 'https://iipmnigeria.github.io/IIPM-Examination-Portal/').trim();
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName, invited_role: role },
      redirectTo: portalUrl,
    });
    if (inviteError) throw new Error(inviteError.message);
    const invitedUser = invited.user;
    if (!invitedUser?.id) throw new Error('Supabase did not return the invited account identifier.');

    const { error: profileError } = await admin
      .from('profiles')
      .update({ full_name: fullName, email, role, is_active: true, updated_at: new Date().toISOString() })
      .eq('id', invitedUser.id);
    if (profileError) throw new Error(profileError.message);

    if (role === 'candidate') {
      const { error: candidateProfileError } = await admin
        .from('agilecert_candidate_profiles')
        .upsert({
          user_id: invitedUser.id,
          legal_name: fullName,
          profile_update_required: true,
          onboarding_completed_at: null,
        }, { onConflict: 'user_id' });
      if (candidateProfileError) throw new Error(candidateProfileError.message);
    }

    await admin.from('audit_logs').insert({
      actor_id: actor.id,
      action: 'invite_portal_account',
      entity_type: 'profile',
      entity_id: invitedUser.id,
      metadata: { email, role, invitation: true },
    });

    return jsonResponse(request, {
      success: true,
      id: invitedUser.id,
      email,
      fullName,
      role,
      invitationSent: true,
    });
  } catch (error) {
    console.error('agilecert-people-admin failed:', error);
    const message = error instanceof Error ? error.message : 'People administration failed.';
    return jsonResponse(request, { error: message }, 400);
  }
});

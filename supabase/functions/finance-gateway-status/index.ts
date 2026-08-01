import { jsonResponse, preflightResponse } from '../_shared/http.ts';
import { requireAuthenticatedUser, userClient } from '../_shared/supabase.ts';

type FinanceAccess = {
  canViewConsole?: boolean;
  permissions?: string[];
  role?: string;
};

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return preflightResponse(request);
  if (request.method !== 'POST') {
    return jsonResponse(request, { error: 'Method not allowed.' }, 405);
  }

  try {
    await requireAuthenticatedUser(request);
    const client = userClient(request);
    const { data, error } = await client.rpc('get_my_finance_console_access');
    if (error) throw new Error(error.message);
    const access = (data || {}) as FinanceAccess;
    const authorised = access.role === 'super_admin'
      || access.canViewConsole === true
      || access.permissions?.includes('finance.console.view');
    if (!authorised) {
      return jsonResponse(request, { error: 'Finance Console access is required.' }, 403);
    }

    const secret = Deno.env.get('PAYSTACK_SECRET_KEY')?.trim() || '';
    const paystackConfigured = secret.length > 0;
    const paystackEnvironment = secret.startsWith('sk_test_') ? 'test' : 'production';

    return jsonResponse(request, {
      paystackConfigured,
      paystackEnvironment,
      gatewayStatusCheckedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('finance-gateway-status failed:', error);
    const message = error instanceof Error ? error.message : 'Unable to read gateway status.';
    return jsonResponse(request, { error: message }, 400);
  }
});

const allowedOrigins = new Set([
  'https://iipmnigeria.github.io',
  'https://agilecert.iipmi.org',
  'http://localhost:5173',
  'http://127.0.0.1:5173',

  // Capacitor serves packaged Android content from a localhost origin. The
  // current Android configuration uses the HTTPS scheme, while the remaining
  // explicit origins keep local and future native shells compatible without
  // opening authenticated Edge Functions to a wildcard origin.
  'https://localhost',
  'http://localhost',
  'capacitor://localhost',
  'ionic://localhost',
]);

export function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('origin') || '';
  const allowOrigin = allowedOrigins.has(origin) ? origin : 'https://iipmnigeria.github.io';

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

export function jsonResponse(
  request: Request,
  payload: Record<string, unknown>,
  status = 200,
): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders(request),
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

export function preflightResponse(request: Request): Response {
  return new Response('ok', { headers: corsHeaders(request) });
}

export function bearerToken(request: Request): string {
  const authorization = request.headers.get('authorization') || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || '';
}

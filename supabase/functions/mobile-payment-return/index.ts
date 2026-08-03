const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#0f3f2f" />
    <title>Returning to AgileCert Global</title>
    <style>
      :root { color-scheme: light; font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; background: #f4f8f6; color: #17352c; }
      main { width: min(100%, 440px); padding: 28px; border: 1px solid #d8e6df; border-radius: 24px; background: #fff; box-shadow: 0 20px 50px rgba(15, 63, 47, .12); text-align: center; }
      .mark { width: 56px; height: 56px; display: grid; place-items: center; margin: 0 auto 16px; border-radius: 18px; background: #e9f7ef; color: #0f7a4d; font-size: 28px; font-weight: 900; }
      h1 { margin: 0 0 10px; font-size: 22px; }
      p { margin: 0; color: #5b6f67; line-height: 1.55; }
      small { display: block; margin-top: 16px; color: #7b8d86; }
    </style>
  </head>
  <body>
    <main>
      <div class="mark" aria-hidden="true">✓</div>
      <h1>Returning to AgileCert Global</h1>
      <p>Your payment result is being sent securely back to the app for verification.</p>
      <small>You may close this page if the app does not close it automatically.</small>
    </main>
  </body>
</html>`;

Deno.serve((request: Request) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    return new Response('Method not allowed.', {
      status: 405,
      headers: { 'Allow': 'GET, HEAD, OPTIONS' },
    });
  }

  return new Response(request.method === 'HEAD' ? null : html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
    },
  });
});

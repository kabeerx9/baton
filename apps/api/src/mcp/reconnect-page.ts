// Shown in the browser when an agent starts sign-in with a client_id this
// server no longer knows. It holds no request data, so nothing is escaped.
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Reconnect your agent to Baton</title>
<style>
body{font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem;line-height:1.5;color:#1f2328;background:#fff}
@media (prefers-color-scheme:dark){body{color:#e6edf3;background:#0d1117}}
code{font-size:.9em}
</style>
</head>
<body>
<h1>Reconnect your agent</h1>
<p>Your agent tried to sign in with a connection Baton no longer knows. This happens when an old connection expired or was removed.</p>
<ol>
<li>In your agent, clear the stored sign-in for Baton (for example <code>/mcp</code> &gt; baton &gt; Clear authentication in Claude Code, or <code>codex mcp logout baton</code>).</li>
<li>Start the sign-in again. Your agent registers a new connection and opens this page.</li>
</ol>
<p>You can close this tab.</p>
</body>
</html>`;

export function reconnectPageResponse(): Response {
  return new Response(html, {
    status: 400,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

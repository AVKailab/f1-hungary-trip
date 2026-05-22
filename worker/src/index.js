/* f1-hungary-translate Worker
 * Dutch -> Hungarian translation proxy for the F1 trip app.
 *
 * Routes:
 *   POST /translate   { "text": "..." } -> { "hungarian": "..." }
 *   GET  /health       -> { "ok": true }
 *
 * Why a Worker?
 *   The Anthropic API key cannot live in the frontend (visible to anyone
 *   inspecting the page). The Worker holds the key as a secret and only
 *   accepts requests from configured origins.
 */

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5';
const MAX_TOKENS = 300;

const SYSTEM_PROMPT = `You are a professional Dutch-to-Hungarian translator specializing in travel and conversational contexts. The user is a Dutch F1 fan visiting Hungary for the Hungarian Grand Prix.

Rules:
- Reply with ONLY the Hungarian translation — no explanations, no quotes, no Dutch text, no parenthetical alternatives.
- Use natural, idiomatic Hungarian as a native speaker would say it.
- For polite phrases (restaurant, asking strangers), use the formal "ön" form by default unless the source is clearly informal.
- For F1 jargon (paddock, pitlane, tribune, pole position) use the standard Hungarian terms or the loanword if that is what locals actually use.
- Numbers and brand names stay in their original form unless there is a clear Hungarian equivalent.
- If the input is ambiguous (e.g. "kaart" = card or map), translate the most likely meaning for a tourist context.
- Keep the same register, energy and length as the source. Short input → short output.`;

/* ---------- CORS ---------- */
function corsHeaders(origin, allowedOrigins) {
  // If the request origin is in the allowlist, echo it. Otherwise pick the first allowed one.
  // "*" wildcard is supported for local dev.
  const allowed = (allowedOrigins || '').split(',').map(s => s.trim()).filter(Boolean);
  let allowOrigin = '';
  if (allowed.includes('*')) allowOrigin = '*';
  else if (origin && allowed.includes(origin)) allowOrigin = origin;
  else if (allowed.length > 0) allowOrigin = allowed[0];

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function jsonResponse(body, status, extraHeaders) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: Object.assign(
      { 'Content-Type': 'application/json' },
      extraHeaders || {}
    )
  });
}

/* ---------- Anthropic call ---------- */
async function translateWithClaude(text, apiKey) {
  const body = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        // Cache the system prompt — every translation reuses it, so we
        // pay ~10% of the input tokens for it after the first call.
        cache_control: { type: 'ephemeral' }
      }
    ],
    messages: [
      { role: 'user', content: text }
    ]
  };

  const res = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Anthropic API ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  // Response shape: { content: [{ type: "text", text: "..." }, ...], ... }
  const block = (data.content || []).find(c => c.type === 'text');
  if (!block || !block.text) throw new Error('Empty response from Anthropic');
  return block.text.trim();
}

/* ---------- Router ---------- */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin, env.ALLOWED_ORIGINS);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    // Health check
    if (url.pathname === '/health' && request.method === 'GET') {
      return jsonResponse({ ok: true, model: MODEL }, 200, cors);
    }

    // Translation endpoint
    if (url.pathname === '/translate' && request.method === 'POST') {
      if (!env.ANTHROPIC_API_KEY) {
        return jsonResponse(
          { error: 'Server misconfigured: ANTHROPIC_API_KEY not set' },
          500,
          cors
        );
      }

      let payload;
      try {
        payload = await request.json();
      } catch (e) {
        return jsonResponse({ error: 'Invalid JSON body' }, 400, cors);
      }

      const text = (payload && payload.text || '').toString().trim();
      if (!text) {
        return jsonResponse({ error: 'Field "text" is required' }, 400, cors);
      }
      if (text.length > 1000) {
        return jsonResponse({ error: 'Text too long (max 1000 chars)' }, 400, cors);
      }

      try {
        const hungarian = await translateWithClaude(text, env.ANTHROPIC_API_KEY);
        return jsonResponse({ hungarian }, 200, cors);
      } catch (e) {
        return jsonResponse({ error: e.message || 'Translation failed' }, 502, cors);
      }
    }

    return jsonResponse({ error: 'Not found' }, 404, cors);
  }
};

/* f1-hungary-translate Worker
 * Backend for the F1 trip app: translation + shared prediction sync.
 *
 * Routes:
 *   POST /translate   { "text": "..." }                      -> { "hungarian": "..." }
 *   GET  /sync                                               -> { predictions, raceResult }
 *   POST /sync        { predictions, raceResult }            -> merged { predictions, raceResult }
 *   GET  /health                                             -> { ok: true }
 *
 * Why a Worker?
 *   1. The Anthropic API key cannot live in the frontend (visible to anyone
 *      inspecting the page). The Worker holds the key as a secret.
 *   2. Prediction sync needs a persistent, CORS-friendly store. The previous
 *      jsonblob.com + corsproxy.io setup broke (proxy now paywalled, blobs
 *      expire after 24h). Cloudflare KV is persistent and free for our scale.
 */

const SYNC_KEY = 'shared-state-v1'; // KV key holding the whole shared blob

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

/* ---------- Prediction sync (KV-backed) ---------- */

/* Merge two prediction maps with the same locked-wins rules the client uses:
   1. A LOCKED prediction is immutable — locked version always wins (earliest
      lockedAt if both sides locked).
   2. If only one side is locked, that one wins regardless of timestamps.
   3. Neither locked: newest _updated wins. */
function mergePredictions(a, b) {
  a = a || {};
  b = b || {};
  const merged = {};
  const names = {};
  Object.keys(a).forEach(n => { names[n] = true; });
  Object.keys(b).forEach(n => { names[n] = true; });

  Object.keys(names).forEach(name => {
    const l = a[name];
    const r = b[name];
    if (!l) { merged[name] = r; return; }
    if (!r) { merged[name] = l; return; }

    if (l.locked && !r.locked) { merged[name] = l; return; }
    if (r.locked && !l.locked) { merged[name] = r; return; }
    if (l.locked && r.locked) {
      const ll = l.lockedAt || 0;
      const rl = r.lockedAt || 0;
      merged[name] = (ll <= rl && ll > 0) ? l : r;
      return;
    }
    const lu = l._updated || 0;
    const ru = r._updated || 0;
    merged[name] = (ru > lu) ? r : l;
  });
  return merged;
}

async function readState(env) {
  if (!env.SYNC) return { predictions: {}, raceResult: null };
  const raw = await env.SYNC.get(SYNC_KEY);
  if (!raw) return { predictions: {}, raceResult: null };
  try {
    const parsed = JSON.parse(raw);
    return {
      predictions: parsed.predictions || {},
      raceResult: (parsed.raceResult !== undefined) ? parsed.raceResult : null
    };
  } catch (e) {
    return { predictions: {}, raceResult: null };
  }
}

async function writeState(env, state) {
  if (!env.SYNC) throw new Error('SYNC KV namespace not bound');
  await env.SYNC.put(SYNC_KEY, JSON.stringify(state));
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
      return jsonResponse({ ok: true, model: MODEL, sync: !!env.SYNC }, 200, cors);
    }

    // Sync: read the shared state (predictions + raceResult)
    if (url.pathname === '/sync' && request.method === 'GET') {
      try {
        const state = await readState(env);
        return jsonResponse(state, 200, cors);
      } catch (e) {
        return jsonResponse({ error: e.message || 'Sync read failed' }, 502, cors);
      }
    }

    // Sync: merge an incoming partial state into the stored state
    if (url.pathname === '/sync' && request.method === 'POST') {
      let payload;
      try {
        payload = await request.json();
      } catch (e) {
        return jsonResponse({ error: 'Invalid JSON body' }, 400, cors);
      }

      try {
        const current = await readState(env);
        const incomingPreds = (payload && payload.predictions) || {};
        const mergedPreds = mergePredictions(current.predictions, incomingPreds);

        // Race result: accept incoming if it is a complete result. Once a
        // result exists it never gets wiped by an empty incoming payload.
        let raceResult = current.raceResult;
        const inc = payload && payload.raceResult;
        if (inc && inc.p1 && inc.p2 && inc.p3) {
          raceResult = inc;
        }

        const next = { predictions: mergedPreds, raceResult: raceResult };
        await writeState(env, next);
        return jsonResponse(next, 200, cors);
      } catch (e) {
        return jsonResponse({ error: e.message || 'Sync write failed' }, 502, cors);
      }
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

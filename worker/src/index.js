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

/* Merge nested predictionsByRace: { round: { name: pred } }. */
function mergePredictionsByRace(a, b) {
  a = a || {};
  b = b || {};
  const rounds = {};
  Object.keys(a).forEach(r => { rounds[r] = true; });
  Object.keys(b).forEach(r => { rounds[r] = true; });
  const out = {};
  Object.keys(rounds).forEach(r => { out[r] = mergePredictions(a[r], b[r]); });
  return out;
}

/* Merge raceResultsByRace: keep a complete result once it exists. */
function mergeResultsByRace(a, b) {
  a = a || {};
  b = b || {};
  const rounds = {};
  Object.keys(a).forEach(r => { rounds[r] = true; });
  Object.keys(b).forEach(r => { rounds[r] = true; });
  const out = {};
  Object.keys(rounds).forEach(r => {
    const ra = a[r], rb = b[r];
    const aok = ra && ra.p1 && ra.p2 && ra.p3;
    const bok = rb && rb.p1 && rb.p2 && rb.p3;
    if (aok && !bok) out[r] = ra;
    else if (bok && !aok) out[r] = rb;
    else if (aok && bok) out[r] = ((ra._updated || 0) >= (rb._updated || 0)) ? ra : rb;
  });
  return out;
}

async function readState(env) {
  const empty = { predictionsByRace: {}, raceResultsByRace: {} };
  if (!env.SYNC) return empty;
  const raw = await env.SYNC.get(SYNC_KEY);
  if (!raw) return empty;
  try {
    const parsed = JSON.parse(raw);
    return {
      predictionsByRace: parsed.predictionsByRace || {},
      raceResultsByRace: parsed.raceResultsByRace || {}
    };
  } catch (e) {
    return empty;
  }
}

async function writeState(env, state) {
  if (!env.SYNC) throw new Error('SYNC KV namespace not bound');
  await env.SYNC.put(SYNC_KEY, JSON.stringify(state));
}

/* ---------- Push reminders ----------
   Hourly cron: for every race whose start is <= 24h away, remind each
   subscribed person who hasn't locked a prediction yet. Pushes are sent
   WITHOUT payload (avoids RFC 8291 message encryption); the service worker
   fetches its personalized message from /push/message on arrival. */

const SUBS_KEY = 'push-subscriptions';   // { [endpoint]: {endpoint, keys, owner, created} }
const PENDING_KEY = 'push-pending';      // { [endpoint]: {title, body, ts} }
const SENT_KEY = 'reminders-sent';       // { [round]: timestamp }
const MAX_SUBSCRIPTIONS = 25;

// Same calendar as js/data.js SEASON_RACES (deadline = race start, UTC)
const SEASON_DEADLINES = [
  { round: '8',  name: 'Oostenrijk',        deadline: '2026-06-28T13:00:00Z' },
  { round: '9',  name: 'Groot-Brittannië',  deadline: '2026-07-05T14:00:00Z' },
  { round: '10', name: 'België',            deadline: '2026-07-19T13:00:00Z' },
  { round: '11', name: 'Hongarije',         deadline: '2026-07-26T13:00:00Z' },
  { round: '12', name: 'Nederland',         deadline: '2026-08-23T13:00:00Z' },
  { round: '13', name: 'Italië',            deadline: '2026-09-06T13:00:00Z' },
  { round: '14', name: 'Spanje',            deadline: '2026-09-13T13:00:00Z' },
  { round: '15', name: 'Azerbeidzjan',      deadline: '2026-09-26T11:00:00Z' },
  { round: '16', name: 'Singapore',         deadline: '2026-10-11T12:00:00Z' },
  { round: '17', name: 'Verenigde Staten',  deadline: '2026-10-25T20:00:00Z' },
  { round: '18', name: 'Mexico',            deadline: '2026-11-01T20:00:00Z' },
  { round: '19', name: 'Brazilië',          deadline: '2026-11-08T17:00:00Z' },
  { round: '20', name: 'Las Vegas',         deadline: '2026-11-22T04:00:00Z' },
  { round: '21', name: 'Qatar',             deadline: '2026-11-29T16:00:00Z' },
  { round: '22', name: 'Abu Dhabi',         deadline: '2026-12-06T13:00:00Z' }
];

async function kvGetJson(env, key, fallback) {
  const raw = await env.SYNC.get(key);
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch (e) { return fallback; }
}

function b64url(buf) {
  let s = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/* VAPID (RFC 8292): ES256-signed JWT proving we own the application server key */
async function vapidAuthHeader(endpoint, env) {
  const aud = new URL(endpoint).origin;
  const claims = {
    aud: aud,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: 'mailto:amoprive@gmail.com'
  };
  const enc = new TextEncoder();
  const unsigned =
    b64url(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' }))) + '.' +
    b64url(enc.encode(JSON.stringify(claims)));
  const key = await crypto.subtle.importKey(
    'jwk', JSON.parse(env.VAPID_PRIVATE_JWK),
    { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']
  );
  // WebCrypto ECDSA yields raw r||s — exactly the JWS ES256 signature format
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(unsigned));
  return 'vapid t=' + unsigned + '.' + b64url(sig) + ', k=' + env.VAPID_PUBLIC_KEY;
}

/* Send a payload-less push. Returns the push service's HTTP status. */
async function sendPush(endpoint, env) {
  const auth = await vapidAuthHeader(endpoint, env);
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Authorization': auth, 'TTL': '86400' }
  });
  return res.status;
}

/* Core reminder pass. Returns a report (also used by /push/preview). */
async function runReminderCheck(env, opts) {
  opts = opts || {};
  const now = Date.now();
  const state = await readState(env);
  const subs = await kvGetJson(env, SUBS_KEY, {});
  const sent = await kvGetJson(env, SENT_KEY, {});
  const pending = await kvGetJson(env, PENDING_KEY, {});
  const report = { checked: [], sent: [], cleaned: [] };
  let subsChanged = false;

  for (const race of SEASON_DEADLINES) {
    const msLeft = new Date(race.deadline).getTime() - now;
    const inWindow = msLeft > 0 && msLeft <= 24 * 3600 * 1000;
    const forced = opts.forceRound === race.round;
    if (!inWindow && !forced) continue;

    const preds = (state.predictionsByRace || {})[race.round] || {};
    const missing = Object.keys(subs)
      .filter(ep => !(preds[subs[ep].owner] && preds[subs[ep].owner].locked))
      .map(ep => subs[ep].owner);
    report.checked.push({ round: race.round, name: race.name, hoursLeft: Math.max(0, Math.round(msLeft / 3600000)), missing: missing });

    if (opts.dryRun) continue;
    if (sent[race.round] && !forced) continue;

    const hours = Math.max(1, Math.round(msLeft / 3600000));
    for (const ep of Object.keys(subs)) {
      const sub = subs[ep];
      if (preds[sub.owner] && preds[sub.owner].locked) continue;
      pending[ep] = {
        title: '🏁 ' + race.name + ' sluit over ' + hours + ' uur',
        body: 'Hoi ' + sub.owner + '! Je hebt nog niet voorspeld voor ' + race.name + '. Lever je top 3 in vóór de start.',
        ts: now
      };
      try {
        const status = await sendPush(ep, env);
        report.sent.push({ owner: sub.owner, status: status });
        if (status === 404 || status === 410) {
          delete subs[ep];
          delete pending[ep];
          report.cleaned.push(sub.owner);
          subsChanged = true;
        }
      } catch (e) {
        report.sent.push({ owner: sub.owner, status: 'error: ' + e.message });
      }
    }
    sent[race.round] = now;
  }

  if (!opts.dryRun) {
    await env.SYNC.put(SENT_KEY, JSON.stringify(sent));
    await env.SYNC.put(PENDING_KEY, JSON.stringify(pending));
    if (subsChanged) await env.SYNC.put(SUBS_KEY, JSON.stringify(subs));
  }
  return report;
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
        const next = {
          predictionsByRace: mergePredictionsByRace(
            current.predictionsByRace, (payload && payload.predictionsByRace) || {}
          ),
          raceResultsByRace: mergeResultsByRace(
            current.raceResultsByRace, (payload && payload.raceResultsByRace) || {}
          )
        };
        await writeState(env, next);
        return jsonResponse(next, 200, cors);
      } catch (e) {
        return jsonResponse({ error: e.message || 'Sync write failed' }, 502, cors);
      }
    }

    // Push: register a subscription (owner = group member name)
    if (url.pathname === '/push/subscribe' && request.method === 'POST') {
      let p;
      try { p = await request.json(); } catch (e) {
        return jsonResponse({ error: 'Invalid JSON body' }, 400, cors);
      }
      const sub = p && p.subscription;
      const owner = ((p && p.owner) || '').toString().slice(0, 40);
      if (!sub || typeof sub.endpoint !== 'string' || !sub.endpoint.startsWith('https://') || !owner) {
        return jsonResponse({ error: 'subscription.endpoint (https) en owner zijn verplicht' }, 400, cors);
      }
      try {
        const subs = await kvGetJson(env, SUBS_KEY, {});
        if (!subs[sub.endpoint] && Object.keys(subs).length >= MAX_SUBSCRIPTIONS) {
          return jsonResponse({ error: 'Te veel registraties' }, 429, cors);
        }
        subs[sub.endpoint] = { endpoint: sub.endpoint, keys: sub.keys || {}, owner: owner, created: Date.now() };
        await env.SYNC.put(SUBS_KEY, JSON.stringify(subs));
        return jsonResponse({ ok: true }, 200, cors);
      } catch (e) {
        return jsonResponse({ error: e.message || 'Subscribe failed' }, 502, cors);
      }
    }

    // Push: remove a subscription
    if (url.pathname === '/push/unsubscribe' && request.method === 'POST') {
      let p;
      try { p = await request.json(); } catch (e) {
        return jsonResponse({ error: 'Invalid JSON body' }, 400, cors);
      }
      try {
        const subs = await kvGetJson(env, SUBS_KEY, {});
        if (p && p.endpoint && subs[p.endpoint]) {
          delete subs[p.endpoint];
          await env.SYNC.put(SUBS_KEY, JSON.stringify(subs));
        }
        return jsonResponse({ ok: true }, 200, cors);
      } catch (e) {
        return jsonResponse({ error: e.message || 'Unsubscribe failed' }, 502, cors);
      }
    }

    // Push: the service worker fetches its personalized message on arrival
    if (url.pathname === '/push/message' && request.method === 'POST') {
      let p;
      try { p = await request.json(); } catch (e) {
        return jsonResponse({ error: 'Invalid JSON body' }, 400, cors);
      }
      try {
        const pending = await kvGetJson(env, PENDING_KEY, {});
        const msg = p && p.endpoint && pending[p.endpoint];
        if (msg) {
          delete pending[p.endpoint];
          await env.SYNC.put(PENDING_KEY, JSON.stringify(pending));
          return jsonResponse({ title: msg.title, body: msg.body }, 200, cors);
        }
        return jsonResponse({ title: null, body: null }, 200, cors);
      } catch (e) {
        return jsonResponse({ error: e.message || 'Message fetch failed' }, 502, cors);
      }
    }

    // Push: dry-run report (who would be reminded). ?send=1&round=N&key=... forces a real send.
    if (url.pathname === '/push/preview' && request.method === 'GET') {
      try {
        const wantSend = url.searchParams.get('send') === '1';
        const keyOk = env.PUSH_TEST_KEY && url.searchParams.get('key') === env.PUSH_TEST_KEY;
        const subs = await kvGetJson(env, SUBS_KEY, {});
        const report = await runReminderCheck(env, {
          dryRun: !(wantSend && keyOk),
          forceRound: (wantSend && keyOk) ? (url.searchParams.get('round') || null) : null
        });
        report.subscriptions = Object.keys(subs).map(ep => ({ owner: subs[ep].owner, created: subs[ep].created }));
        return jsonResponse(report, 200, cors);
      } catch (e) {
        return jsonResponse({ error: e.message || 'Preview failed' }, 502, cors);
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
  },

  /* Hourly cron: send deadline reminders (see [triggers] in wrangler.toml) */
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runReminderCheck(env, {}));
  }
};

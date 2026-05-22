# Translate Worker

Cloudflare Worker dat NL→HU vertaling doet via Claude (Haiku 4.5). De
frontend roept dit aan i.p.v. de Anthropic API direct, zodat de API key
veilig blijft.

## Setup (eenmalig, ~5 min)

### 1. Installeer wrangler

```bash
cd worker
npm install
```

### 2. Login op Cloudflare

```bash
npx wrangler login
```
Opent een browser; log in en bevestig de toegang. Gratis Cloudflare
account is genoeg (100.000 requests/dag inbegrepen).

### 3. Zet je Anthropic API key als secret

Haal de key op via https://console.anthropic.com/settings/keys
en zet 'm dan als Worker secret:

```bash
npx wrangler secret put ANTHROPIC_API_KEY
```
Plak de key (begint met `sk-ant-...`) en druk Enter.

### 4. (Optioneel) Pas de allowed origins aan

Open `wrangler.toml` en zet `ALLOWED_ORIGINS` naar jouw GitHub Pages URL
(zonder trailing slash). Tijdens lokaal testen mag `http://localhost:3000`
erbij blijven.

### 5. Deploy

```bash
npm run deploy
```

Output toont een URL als `https://f1-hungary-translate.<jouw-naam>.workers.dev`.
**Kopieer die URL** — die heb je nodig in stap 6.

### 6. Vertel de frontend over de Worker

Open `js/translate.js` en zet bovenaan:

```js
var WORKER_URL = 'https://f1-hungary-translate.<jouw-naam>.workers.dev';
```

Commit + push naar GitHub Pages.

## Testen

Lokaal (zonder deploy):
```bash
npm run dev
# In een andere terminal:
curl -X POST http://localhost:8787/translate \
  -H "Content-Type: application/json" \
  -d '{"text":"Twee bier, alstublieft"}'
```

Verwachte response:
```json
{ "hungarian": "Két sört kérek." }
```

## Kosten-inschatting

Claude Haiku 4.5: ~$1 per 1M input tokens, ~$5 per 1M output tokens.
Een vertaling is ±100 input tokens (incl. system prompt) en ±20 output
tokens. **Per vertaling kost het ~$0.0002** = 5000 vertalingen per dollar.

Met prompt caching (al ingebouwd) zakken kosten nog verder bij herhaalde
sessies — de cached system prompt kost slechts 10% van het normale
input-tarief.

Cloudflare Worker: gratis tot 100k req/dag, daarna $5 voor 10M req/maand.

## Onderhoud

- **Tail logs**: `npm run tail`
- **Update prompt**: bewerk `SYSTEM_PROMPT` in `src/index.js`, dan `npm run deploy`
- **Update model**: wijzig `MODEL` constante, dan deploy

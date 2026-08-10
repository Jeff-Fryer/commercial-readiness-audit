# Website-check function

One Netlify function. Takes a company homepage URL, fetches the public page, and
scores it against the 40 `WEBSITE_RUBRIC` criteria using the Claude API. Returns a
`websiteSignals` object shaped exactly as `scoreCommercialReadiness()` expects.

```
POST /api/website-check
Content-Type: application/json

{ "url": "https://acme-semiconductors.com" }
```

```jsonc
// 200
{
  "url": "https://acme-semiconductors.com",
  "signals": {
    "story":        { "targetApplicationOrUseCaseNamed": 1, "targetBuyerOrDesignRoleNamed": null, ... },
    "sell":         { ... },
    "charge":       { ... },
    "partnerships": { ... }
  }
}
```

Every value is `1`, `0`, or `null` — always all 40 keys, always in rubric shape.
On any failure the response carries `"signals": null` and an `error` code; the
front end then shows the self-report result and says the check didn't complete.

---

## Deploy

**Status: the site exists; the code has not been deployed yet.**

| | |
|---|---|
| Netlify site | `jf-commercial-readiness` (created, free team plan) |
| Site ID | `c4fab0db-5ecb-428d-af9f-75373f118c81` |
| Function URL | `https://jf-commercial-readiness.netlify.app/api/website-check` |
| Admin | https://app.netlify.com/projects/jf-commercial-readiness |

That URL is already set in `frontend/commercial-readiness-code-block.html` — there
is nothing to edit there.

**The function has never been executed or typechecked.** The machine that generated
these files has no Node, npm, or Netlify CLI, so `npm install`, `netlify dev`, and
the deploy could not be run. Node 20+ is required for the steps below; there is no
path that avoids it.

**1. Deploy.** This uploads the folder and runs the build — including `npm install` —
in Netlify's cloud, so you do **not** need to install dependencies locally:

```bash
cd commercial-readiness-audit/function
npx -y netlify-cli deploy --prod --site c4fab0db-5ecb-428d-af9f-75373f118c81
```

(The Netlify connector can also mint a one-shot `npx -y @netlify/mcp@latest --site-id
… --proxy-path …` command that does the same thing without a login. Either works;
the CLI form above is stable and re-runnable.)

**2. Set the API key.** Do this yourself — it's your secret, and it must be set for
the function to score anything:

```bash
npx -y netlify-cli env:set ANTHROPIC_API_KEY "sk-ant-..." --site c4fab0db-5ecb-428d-af9f-75373f118c81
```

Or paste it under **Site configuration → Environment variables** in the Netlify UI.
It is read server-side via `Netlify.env.get()` and never reaches the browser.

**3. First real test.** Nothing has run this code yet, so treat this as the actual
first execution, not a formality:

```bash
curl -s -X POST https://jf-commercial-readiness.netlify.app/api/website-check \
  -H 'Content-Type: application/json' -H 'Origin: https://jefffryer.com' \
  -d '{"url":"https://www.analog.com"}' | python3 -m json.tool | head -40
```

Expect all 40 keys, values only `1` / `0` / `null`. A response of
`{"signals": null, "error": "not_configured"}` means step 2 hasn't been done — which
is itself a useful signal that routing, CORS and the handler are all working.

Then check duration and the observed-criteria count in the logs:

```bash
npx -y netlify-cli logs:function website-check --site c4fab0db-5ecb-428d-af9f-75373f118c81
```

---

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | yes | Claude API key. Server-side only. |
| `ALLOWED_ORIGINS` | no | Comma-separated CORS allowlist. Defaults to `https://jefffryer.com,https://www.jefffryer.com`. Any `*.netlify.app` origin is also accepted so previews work. |
| `RATE_LIMIT_DISABLED` | no | Set to `true` to switch the rate limiter off. |

---

## How it behaves

**Model.** `claude-opus-5` at `effort: "low"`, using **structured outputs** so the
40-key shape is guaranteed without a tool-call round trip.

**The rule that matters.** The system prompt makes the rubric's own instruction the
headline: `1` = positive evidence observed, `0` = material was extracted and it
contradicts, `null` = not applicable or not extractable — and *missing evidence is
never 0*. It also states the non-requirements verbatim (public pricing, named logos,
public case studies, trials, self-serve checkout, generic "book a demo" are all not
required), because this is a design-in motion and scoring it like e-commerce would
be systematically wrong.

**Homepage only.** We fetch one page. The model also receives a map of link text →
href, which is genuine evidence for criteria about whether a *route* is visible (a
distributor locator, a design-support path). Criteria needing the linked page's
contents return `null`, not `0`.

**Output sanitising.** `publicEvidenceScore()` in the engine *throws* on any value
that isn't `1`, `0`, or `null` — which would crash the results screen. The function
forces the payload into rubric shape before returning, so a malformed model response
degrades to nulls instead of breaking the page.

---

## Timing

Budget is roughly 4s page fetch + up to 15s model call. That targets a **10-second**
platform ceiling, because Netlify's documented synchronous-function timeout is
inconsistent across sources: the current [configuration
docs](https://docs.netlify.com/build/functions/configuration/) say 60s, support
threads say 10s, and a 2025 note says 30s.

**Measure the real number after the first deploy** — the function logs its own
duration on every call:

```bash
npx netlify logs:function website-check
```

If p95 sits uncomfortably close to the ceiling, reduce `MAX_EXTRACT_CHARS` first;
that cuts input tokens and latency together without touching model or effort.

Free-tier headroom is not a concern: **125,000 invocations/month**, and this tool
will use a few dozen.

---

## Security

The endpoint is public and spends money on an API key, and it fetches a
user-supplied URL server-side. Three guards:

- **SSRF.** http/https only; literal IPs, `localhost`, `.local`, `.internal` and
  `.home.arpa` rejected; DNS resolved and checked against loopback, private,
  link-local (including the `169.254.169.254` metadata address), CGNAT, multicast
  and reserved ranges; redirects followed manually, max 3 hops, **every hop
  re-validated**; response capped at 1.5 MB and required to be HTML.
- **Origin allowlist.** CORS is restricted rather than `*`. Netlify's own guidance
  is to avoid CORS headers unless needed — they're needed here, because the browser
  calls this cross-origin from Squarespace.
- **Rate limit.** Netlify Blobs counter: 5 checks per IP per hour, 200 per day
  globally. If Blobs is unavailable the limiter fails open rather than taking the
  endpoint down.

Nothing is persisted. The submitted URL and the extracted page exist only for the
life of the request; the rate limiter stores counts, not URLs.

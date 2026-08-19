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

**Status: the site exists and serves a placeholder. The rebuilt audit is in the
repo at `public/index.html` but has NOT been deployed yet.**

> **Deploying needs you.** There is no Node, no npx, no Netlify CLI and no git
> remote on this machine, and installing them was ruled out. That leaves the
> Git-based path below, which is the right long-term answer anyway: it keeps the
> `npm install` for the function in Netlify's cloud, so no local Node is ever
> needed. Steps 1 and 2 are the ones only you can do.

**Netlify Forms is enabled** on the project (done via the Netlify connector).
The audit posts to a form named `crg-audit`; a hidden static twin of the form
lives in `public/index.html` so Netlify registers it at build time. After the
first deploy, add a submission notification under
Project configuration -> Forms -> Form notifications.

| | |
|---|---|
| Netlify site | `jf-commercial-readiness` (created, free team plan) |
| Site ID | `c4fab0db-5ecb-428d-af9f-75373f118c81` |
| Function URL | `https://jf-commercial-readiness.netlify.app/api/website-check` |
| Admin | https://app.netlify.com/projects/jf-commercial-readiness |

That URL is already set in `frontend/commercial-readiness-code-block.html` — there
is nothing to edit there.

**The function has never been executed or typechecked.** The machine that generated
these files has no Node, npm, or Netlify CLI.

**Deployment is Git-based**, so no local Node is needed — now or for future changes.
The repo root `netlify.toml` sets `base = "function"`, which points Netlify's build
system at `package.json` and makes it run `npm install` in the cloud.

**1. Get the repo onto GitHub.** The folder is already a git repo with one commit.
Create an empty repo on github.com (no README, no .gitignore), then either:

```bash
cd commercial-readiness-audit
git remote add origin https://github.com/<you>/commercial-readiness-audit.git
git push -u origin main
```

…or, if you'd rather avoid a terminal auth prompt, use GitHub's web uploader
("uploading an existing file") and drag the folder contents in.

**2. Link the repo to the site.** In the Netlify dashboard for
`jf-commercial-readiness` → **Site configuration → Build & deploy → Link repository**.
This requires authorising Netlify's GitHub App, which is why it has to be done by
you rather than through the API. Leave the build settings alone — `netlify.toml`
already specifies base, publish, functions and bundler.

Netlify runs its first build on link. Watch it under **Deploys**; a green
"Published" with `npm install` in the log means the dependencies resolved.

**3. Set the API key.** Do this yourself — it's your secret. **Site configuration →
Environment variables → Add a variable**, key `ANTHROPIC_API_KEY`. It is read
server-side via `Netlify.env.get()` and never reaches the browser. Redeploy after
adding it (**Deploys → Trigger deploy**) so the function picks it up.

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

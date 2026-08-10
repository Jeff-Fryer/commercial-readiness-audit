# Commercial Readiness Audit

A public self-assessment for semiconductor and deep-tech CEOs, living at
`jefffryer.com/commercial-readiness-audit`. Five questions across six commercial
pillars, an optional AI-powered read of the company's public homepage, and a
results screen that ends in a book-a-call CTA.

This is a **services lead-gen tool for a fractional CMO practice** — not a SaaS
product, and not a manufacturing- or technology-readiness assessment. Copy and
code comments stay inside that frame.

The CEO premise it answers: *"Your technology works. Why isn't the market
buying?"*

---

## What's here

```
commercial-readiness-audit/
├── BRIEF.md                                   ← you are here
├── commercial_readiness_assessment_final.js   ← scoring engine (logic frozen)
├── reference/
│   └── CRG-Interactive-...html                ← layout reference only, not content
├── frontend/
│   ├── commercial-readiness-code-block.html   ← the paste artifact
│   └── TESTING.md                             ← pre-publish checklist
└── function/
    ├── netlify.toml
    ├── package.json
    ├── netlify/functions/website-check.mts
    └── README.md                              ← deploy + env var steps
```

---

## The three parts

**1. Scoring engine** — `commercial_readiness_assessment_final.js`, shipped as
written. Weighting, composite formula (`C = [0.75A + 0.25H] × (1 − 0.08V)`),
reconciliation, flags, and thresholds are all frozen.

**2. Front end** — one self-contained file pasted into a Squarespace 7.1 Code
Block. Contains a verbatim copy of the engine plus the UI.

**3. Website-read function** — one Netlify function that fetches a homepage,
scores it against the 40 `WEBSITE_RUBRIC` criteria via the Claude API, and
returns a `websiteSignals` object.

---

## Changes made to the supplied engine

Exactly two, both approved:

1. **Browser-safe export.** `module.exports = {...}` → `window.CRA_ENGINE = {...}`.
   The file runs in a static Code Block: no bundler, no module system.

2. **Content fix in `QUESTIONS[0]`.** Options 1 and 2 had their text swapped so
   the four options read in ascending severity. `answerScore()` maps option
   *position* to 1–4 ascending, so the previous order scored "different buyers
   hear different versions of what we do" as more mature than "they understand
   the technology, but not necessarily the business case." Text only — no
   scoring logic touched. Every other question was already monotonic.

**The front end inlines a copy of the engine.** This file is the single source
of truth; if it changes, re-copy the block marked
`ENGINE — verbatim copy` in `frontend/commercial-readiness-code-block.html`.

---

## Key decisions

| Decision | Choice | Why |
|---|---|---|
| Model | `claude-opus-5`, `effort: "low"` | The rubric's hard call is 0 (contradicts) vs `null` (not extractable). Judgment matters more than cost here; volume is a handful a week. |
| Output shape | Structured outputs (`output_config.format`) | Guarantees the 40-key shape without a tool-call round trip. |
| Netlify site | New dedicated site | Nothing existing was visible to the connected token. |
| CTA target | `https://calendly.com/JeffFryer` | Confirmed by Jeff. |
| Timeout budget | Finish inside ~10s | See below. |

### Netlify free tier — verified

- **125,000 function invocations/month**, 100 GB bandwidth, 300 build minutes.
  This tool will use a few dozen invocations a month. Not a concern.
- **Timeout is the real constraint, and the sources conflict.** Netlify's
  current configuration docs list 60s for synchronous functions; support-forum
  threads say 10s; a 2025 note says 30s. The function is therefore built to
  finish inside ~10s, and the front end degrades gracefully if it doesn't.
  Measure the actual duration in the function log after the first real deploy
  and record it here.

---

## Honest limitations

**We read the homepage only.** The rubric permits evidence on "a first-level
public resource clearly linked from the homepage." The function gives the model
the homepage text *plus a map of link text → href*, which covers criteria that
ask whether a path is *visible* (a distributor locator, a design-support route,
a product family). It does **not** fetch those linked pages, so any criterion
that would need their contents scores `null`, not `0`.

That is the rubric's own rule — *never convert missing evidence into 0* — and it
keeps results conservative rather than unfairly harsh. It also means the
buyer-facing evidence check is a comparison, not a website grade, and the copy
says so.

**This is a transparent, theory-driven index, not a validated predictive
instrument.** Per the engine's own note: persist answers, signals, and later
outcomes to recalibrate weights against observed results. Never represent it as
causal proof.

---

## Out of scope (deliberately not built)

- **Email capture / lead gating.** Not requested. The flow ends in a Calendly CTA.
- **CRM or webhook persistence.** Note that `diagnostic` — pillar scores,
  confidence, contradiction variance, flags, `publicEvidence` coverage — is
  explicitly built to feed a CRM and the Gap Analysis. Persisting it is the
  natural next step whenever it's wanted.
- **Analytics.** No tracking beyond what Squarespace already does page-wide.

---

## Security notes

The function is a public endpoint that spends money on an Anthropic API key, and
it fetches a user-supplied URL server-side. Three guards, all in
`website-check.mts`:

- **SSRF protection.** http/https only; literal IPs, `localhost`, `.local`,
  `.internal` and the cloud metadata address rejected; DNS resolution checked
  against private/loopback/link-local ranges; redirects followed manually with
  every hop re-validated.
- **Origin allowlist.** CORS restricted to the jefffryer.com origins rather than
  `*`. (Netlify's default guidance is to avoid CORS headers entirely — they're
  required here because the browser calls cross-origin from Squarespace.)
- **Rate limiting.** A small Netlify Blobs counter, per-IP/hour and global/day.
  Set `RATE_LIMIT_DISABLED=true` to switch it off.

`ANTHROPIC_API_KEY` lives only in the function's Netlify environment. It is never
sent to, or reachable from, the browser.

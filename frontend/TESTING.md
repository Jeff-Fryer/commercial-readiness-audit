# Testing checklist — before publishing

Two things to know first:

- **Test on the published URL**, not the Squarespace editor preview. The preview
  pane has been unreliable on this site, and it also strips query strings, which
  the debug hooks below need.
- The debug hooks are query parameters. They're inert without them — no code needs
  removing before or after launch.

| Parameter | Effect |
|---|---|
| `?cra_debug=1` | Logs the full `diagnostic` object (flags, variance, `publicEvidence` coverage) to the browser console. |
| `?cra_answers=41141` | Preloads five answers (digits 1–4, one per question) and jumps straight to results. |
| `?cra_signals=strong\|weak\|sparse\|empty` | Stubs the website response locally — no function call, no API spend. |

Combine them: `?cra_answers=44444&cra_signals=weak&cra_debug=1`

---

## The five required cases

Already verified against the engine during the build; re-run after publishing to
confirm the deployed page behaves the same.

### 1. Self-report only — no URL
Answer five questions, click **Skip — show my result**.

- Result appears with a composite score and six pillar bars
- Evidence block reads *"Add your website in the Gap Analysis…"* (`status: not_requested`)
- A "Fix first" recommendation is present
- Footer says answers stay in your browser and are not sent anywhere

### 2. Strong site
`?cra_answers=22222&cra_signals=strong&cra_debug=1`

- No `*_BUYER_FACING_EVIDENCE_GAP` flags in the console `diagnostic`
- Pillar scores nudge slightly **up**, capped at +5 (the `gap < 0` rule).
  Verified: story self-report 33 → 38.

### 3. Weak site + confident answers
`?cra_answers=44444&cra_signals=weak&cra_debug=1`

- Four gap flags fire; four evidence checks render with "You: N · Publicly visible: N"
- Pillar scores pulled **down** — verified: story 100 → 55, composite 100 → 71
- `timingLane` and `alignment` are unchanged (no public-evidence rubric exists for them)

### 4. Contradictory answers — variance flag
`?cra_answers=41141&cra_debug=1`

- `diagnostic.contradictionVariance` = **60**
- `diagnostic.flags` contains **`COMMERCIAL_SYSTEM_INCONSISTENCY`**
  (and `FOUNDER_DEPENDENCY_ALIGNMENT_RISK`, since sell and alignment are both < 50)

### 5. No extractable signal — nulls must not become zeros
`?cra_answers=44444&cra_signals=empty&cra_debug=1`

**This is the one that matters most.** Compare against case 1 with the same answers:

- `publicEvidence.story.available` = `false`, `.score` = `null`
- Composite is **identical** to the self-report-only result (verified: 100 = 100)
- If the composite drops, nulls are being scored as zeros — stop and fix

Also worth running: `?cra_answers=44444&cra_signals=sparse` — only 2.15 of the
required 3.2 observed weight, so the pillar correctly falls back to self-report
rather than scoring on thin evidence.

---

## Degrade paths (verified during the build)

| Scenario | Expected |
|---|---|
| Function unreachable / times out | Result still shows. Message: *"We could not complete the website check this time…"* — **not** the engine's "no material contradiction" wording, which would misattribute a technical failure to the site. |
| Function returns a malformed payload | Same graceful path. |
| Invalid URL typed | Inline error, no request sent, stays on the website step. |
| Bare domain typed (`acme.com`) | Normalised to `https://acme.com` before sending. |

Client abort is 25s, comfortably above the function's ~20s worst case.

---

## Live function checks

Once deployed, with a real URL (this does spend API credit):

```bash
curl -s -X POST https://<site>.netlify.app/api/website-check \
  -H 'Content-Type: application/json' -H 'Origin: https://jefffryer.com' \
  -d '{"url":"https://www.analog.com"}' | python3 -m json.tool | head -40
```

- All 40 keys present, values only `1` / `0` / `null`
- A believable mix — **all-zeros is a red flag**, it usually means missing evidence
  is being scored as contradiction rather than `null`
- Check the logged duration: `npx netlify logs:function website-check`

Security spot-checks (all should be rejected):

```bash
for u in http://127.0.0.1 http://169.254.169.254 http://localhost:8080; do
  curl -s -X POST https://<site>.netlify.app/api/website-check \
    -H 'Content-Type: application/json' -H 'Origin: https://jefffryer.com' \
    -d "{\"url\":\"$u\"}"; echo; done
```

And that a disallowed origin is refused:

```bash
curl -s -X POST https://<site>.netlify.app/api/website-check \
  -H 'Content-Type: application/json' -H 'Origin: https://evil.example' \
  -d '{"url":"https://www.analog.com"}'
```

---

## Rendering

- Mobile (375px) and desktop — the six pillar bars are horizontal rows, so the
  long labels ("One team, one story") stay readable at any width
- The block sits inside Squarespace's page; nothing outside `#cra-app` should change
- Console clean of errors on load

---

## Known, expected behaviour

**Answering all 4s tags three pillars "FOCUS" at a score of 100.** With every pillar
tied, the engine's `weakest` selection still returns three, and the UI renders what
the engine reports. It's an artefact of a perfect tie, not a bug, and the render is
deliberately faithful to `ui.weakestPillars` rather than second-guessing frozen
scoring logic.

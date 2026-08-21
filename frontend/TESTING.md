# Testing checklist, before publishing

The tool is one file: `function/public/index.html`. Open it through a local
server (query strings are needed for the debug hooks):

```
cd function/public && python3 -m http.server 8765
```

## Debug hooks

| Parameter | Effect |
|---|---|
| `?crg=40,60,0,100,20,80` | Preloads the six sliders in pillar order (story, sell, timingLane, charge, partnerships, alignment) and jumps straight to results. Values are clamped to 0-100. |
| `?cra_debug=1` | Logs the full `diagnostic` object (flags, variance, pillar scores) and the selected stage to the console. |
| `?embed=1` | Renders embed mode: no page nav, no footer, no page background. This is what the Squarespace iframe loads. |

Combine them: `?crg=100,100,0,100,100,0&cra_debug=1`

## The cases that must pass

### 1. Scoring floor and ceiling
- `?crg=0,0,0,0,0,0` shows **0**, band **Commercially blocked**, Fix First **One team, one story**.
- `?crg=100,100,100,100,100,100` counts up to **100**, band **Commercially ready**.

### 2. Fix First tie-break
Lowest score wins. On a tie, `One team, one story` wins; otherwise the tied pillar
with the higher weight wins; ties beyond that break in canonical pillar order.
- `?crg=100,100,0,100,100,0` gives **43**, Fix First **One team, one story**
  (tied at 0 with Timing and lane, alignment wins the tie), and fires
  `COMMERCIAL_SYSTEM_INCONSISTENCY`.
- `?crg=20,20,60,60,60,60` gives **43**, Fix First **Your story** (tied at 20 with
  How you sell at equal weight, canonical order breaks it).

### 3. Untouched default
Clicking straight through without moving anything gives **40**, band
**Founder-dependent**, and fires `FOUNDER_DEPENDENCY_ALIGNMENT_RISK`.

### 4. Live read tracks the slider
On any question, every stop changes the quoted sentence by band:
0 and 20 -> option a, 40 -> b, 60 -> c, 80 and 100 -> d.

### 5. Navigation holds state
Previous from any question restores that question's slider position. Back from
the capture screen returns to the stage picker with the stage still selected,
and Previous from there returns to Q6 with its slider position.

### 6. Capture validation
- Submitting empty shows inline errors on all four required fields.
- A consumer address (gmail, yahoo, hotmail, outlook, icloud) is nudged once with
  "A work email helps me write the read for your company." A second submit goes through.
- If the form POST fails, the results screen still renders. This is deliberate.

### 7. The website step is gone, not hidden
With `websiteStepEnabled: false` the URL input must not exist in the DOM at all:
`document.querySelector('input[type=url]')` returns `null` on every screen.

### 8. No premature zero
`#s-results` must not exist in the DOM until a score has been computed, so
"0 / 100" never appears in page text on the intro or question screens.

## Product name

The container header reads **Commercial Readiness Audit**, with no trademark
symbol. The original brief specified a ™ on every screen; it was dropped on
2026-08-21 because the name is not registered and the symbol overclaimed for a
six-slider self-check. ™ does not legally require registration, so this was a
positioning call, not a legal one. If the name is ever registered, the two places
to restore a symbol are the container header in `public/index.html` and the email
header in `netlify/functions/submission-created.mts`.

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

### 9. Value at stake: the deal-value slider

The module sits between the score and the Fix First read, under the heading
**How It Affects The Bottom Line**. It is one slider plus at most two sentences.
Everything below the slider recalculates on drag.

- `?crg=40,40,40,40,40,40` with the slider left at its **$5M** default gives:
  - "Roughly **7.2 months** of commercial delay against a peer with the same
    technology and a clearer commercial engine."
  - "At $5M a design win, that's about **1.3 design wins** a year, or **$6.4M**
    of commercial capacity you can't currently reach."
- Drag the slider to each end at that same score. Nothing but the money moves:

  | Slider | Reads | Dollar figure |
  |---|---|---|
  | bottom | $250K | $320K |
  | middle | $5M | $6.4M |
  | top | $50M | $64M |

- The slider is logarithmic, so $250K to $500K takes the same drag as $25M to
  $50M. It snaps to a clean ladder: 50K steps under $1M, 0.5M steps to $20M, 1M
  steps above that. It must never read `$4.99M` or show cents.
- Dollar figures are **two significant figures**, always. `$11,437,200` renders
  `$11M`; a figure under a million renders `$740K`. An exact number anywhere in
  these two lines is a bug.

### 10. Value at stake: the suppression rules

Both rules are load-bearing. Verify all four rows.

| Preset | Composite | What must show |
|---|---|---|
| `?crg=80,80,80,80,80,80` | 80.0 | **Only** "No material gap. Your commercial engine is keeping pace with your technology." Both result lines and the bridge line are gone. |
| `?crg=100,100,100,100,100,100` | 100 | Same single sentence. |
| `?crg=68,68,68,68,68,68` | 68.0 | **Delay line only** ("Roughly 2.2 months..."). `winsAtStake` is 0.4, which rounds below 0.5, so the dollar line is suppressed at every slider position including the very bottom. |
| `?crg=80,80,80,80,80,60` | 76.7 | Delay line only ("Roughly 0.6 months..."). One weak pillar carrying the smallest coefficient. |

Note the composite these rules use is the **plain mean of the six pillar
scores**, not the weighted composite on the score ring. They answer different
questions and will not match.

One guard beyond the brief: a hand-built link such as `?crg=79,80,80,80,80,80`
lands at composite 79.83, where the delay rounds to 0.0 months. Rather than
print "Roughly 0 months of commercial delay", that falls through to the no-gap
sentence. Six 20-point sliders cannot reach it; a typed URL can.

### 11. Value at stake: the deal value never leaves the browser

This is a promise printed under the slider, so check it rather than trusting it.

- Set the slider to **$50M**, then hit Share. The copied link must be
  `...?crg=40,40,40,40,40,40` and nothing else. There is **no** deal-value
  parameter, bucketed or otherwise, so a shared link always opens with the
  slider back at its $5M default. That is deliberate: `?crg=` is forwarded by a
  Squarespace Code Block, pasted into email, and read by whoever the CEO
  forwards it to, and a deal value beside six pillar scores is a company
  fingerprint however coarsely it is rounded.
- The Netlify form POST must still carry **37 fields** and none of them may
  mention a deal value, a win value, or a dollar amount.
- The emailed report carries the **delay line only**. The dollar line is not in
  it and must not be added: the function rebuilds the delay from the six
  `pillar_*` fields it already receives, so no new field exists to carry a deal
  value in the first place.
- Nothing is written to `localStorage`, and no global on `window` holds it.

### 12. Value at stake: the methodology panel

- Collapsed by default, labelled **How this is calculated**, sitting at the
  bottom of the report under the Calendly CTA.
- Contains the formula, the six coefficients by pillar name, the benchmark of
  80, four sources with links, and the closing line "This is a structured
  estimate based on published benchmarks and your own inputs. It is not a
  forecast."
- The four published statistics appear **here and nowhere else** in the report.
  If one turns up in the result copy it reads as a claim about this company.
- **The four source links have never been fetched.** The build container has no
  egress. Click all four before publishing.

### 13. Value at stake: print and PDF

Print the results screen (the Save PDF / Print button, or Cmd-P).

- The slider is gone. In its place, the static line **"Design win value: $5M"**,
  showing whatever the slider was actually set to.
- Both result lines and the bridge line print normally.
- The methodology accordion prints **expanded**. A closed one-line summary on
  paper is a report with its arithmetic torn out, so this is checked three ways:
  the Print button opens it, `beforeprint` opens it, and a print media query
  opens it for the Safari path that skips `beforeprint`.

### 14. Value at stake: nothing answered

Click straight through without moving a slider. The whole module is absent, along
with the bridge line. A dollar figure hung off the midpoint of the scale is
exactly the confident diagnosis that section 3 exists to refuse.

## The tuning point

**`CRG_WIN_PER_FACTOR = 0.125`** in `commercial_readiness_assessment_final.js`,
mirrored into `public/index.html`. It means one full design win per 8 points of
capacity, and it is the only number to touch if the figures stop being
believable. Lower it and every dollar figure falls proportionally.

Do **not** cap the slider instead, and do not reach for the six coefficients:
they are set from the four published findings in the methodology panel, and
moving one changes which pillar the report says is costing the money.

The reachable ceiling is a factor of **0.32**, not the 0.40 the coefficients sum
to. A gap is `(80 - score)/100`, so it maxes at 0.80 on a score of zero, and a
factor of 0.40 would need a score of -20. At 0.32 the module puts **2.6 design
wins a year** at stake, which is $130M at the top of the slider. The comments on
`CRG_COEFF` and `CRG_WIN_PER_FACTOR` say this too; keep all three in step if the
gap is ever normalised by the benchmark instead.

## One deliberate exception to the copy sweep

`grep -ci "pricing\\|leak" function/public/index.html` now returns **1**, not 0.
The single hit is the McKinsey citation in the methodology panel, whose title is
*The Power of Pricing*. It is a published title, not product copy, and shortening
it would misquote a real source. Every other rule in the sweep still holds:
`grep -c "—"` is still 0.

## Product name

The container header reads **Commercial Readiness Audit**, with no trademark
symbol. The original brief specified a ™ on every screen; it was dropped on
2026-08-21 because the name is not registered and the symbol overclaimed for a
six-slider self-check. ™ does not legally require registration, so this was a
positioning call, not a legal one. If the name is ever registered, the two places
to restore a symbol are the container header in `public/index.html` and the email
header in `netlify/functions/submission-created.mts`.

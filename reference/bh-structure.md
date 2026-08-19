# Boutique Hub Website Growth Assessment — captured reference

Source: https://go.theboutiquehub.com/website-health-assessment
Captured: 2026-08-19, Chrome connector, 1440x1000 viewport.

Screenshots were taken through the Chrome connector and reviewed in-session. The
connector returns images into the conversation; it has no verified path to write
PNGs into this repo, so this file is the durable artifact. It records the block
order, type scale, spacing and colour behaviour that the PNGs were wanted for.

---

## Shell

| | |
|---|---|
| Page background | white (`rgb(255,255,255)`) |
| Container | 1200px wide, `border-radius: 24px`, bg `rgb(5,6,10)` |
| Container gradient | `radial-gradient(circle at 50% -20%, #1A1A1A 0%, #05060A 100%)` plus `radial-gradient(circle at 0% 100%, #121212 0%, transparent 50%)` |
| Heading font | **Archivo**, weight 800, letter-spacing −0.02em |
| Body font | **Public Sans**, 18px / 28.8px |
| Accent | gold/amber (`#E0A458`-ish); pills, eyebrows, headline second tone, slider fill, buttons |
| Nav | white bar, wordmark left, "JOIN THE HUB" all-caps text link right |
| Footer | black, two columns of small links, "JOIN THE HUB" outline button, `© The Boutique Hub 2026` |

## Header bar (every screen)

`BH` square mark (gold bg) · stacked `WEBSITE GROWTH ASSESSMENT™` (mono-ish, small caps,
letter-spaced, muted) over `By The Boutique Hub` (white 12.8px/500) · **centre: progress dots**
(8 dots, filled gold as answered) · right: `Start Over` (dark pill) **and** `FREE WEBSITE AUDIT`
(gold pill).

> Note: on the live page `Start Over` sits *beside* the gold pill from Q1 onward, it does not
> replace it. Our brief says replace. Following the brief.

## Intro

Eyebrow `A PREMIUM WEBSITE DIAGNOSTIC` (gold, caps, letter-spaced, centred)
→ H1, very large, two-tone, second line in gold
→ body card (lighter panel, rounded, hairline border): bold pain question, then a regular
  paragraph with the product name bold-gold
→ `✨ No test pressure: …` muted line
→ three tiles in a row: glyph / muted label / bold value (⏱ Under 2 Minutes · 📊 8 Growth Pillars
  · 🛡️ Instant Score & Report)
→ one full-width gold primary button, all caps, letter-spaced
→ trust line, two parts split by `•`

## Question screen

Eyebrow `QUESTION 1 OF 8 • WEBSITE CONFIDENCE` (gold, caps, letter-spaced) — left
`Pillar #1` — **top right**, muted, plain text, not a pill
**`Website Confidence`** — the *pillar name* is the large heading (Archivo 800)
`How confident are you that your website is helping grow your business?` — the *question* is the
smaller regular subline underneath

> Note: our brief inverts this (question as the large heading, pillar name as an H3 above).
> Our questions are full sentences, so the brief's order is the right call. Flagged, not silently changed.

Slider:
- `<input type=range min=0 max=100 step=20>` — **six discrete stops**, default **60**
- tick labels are small **pills above the track**: `00 02 04 06 08 10`; the active one is filled
- track ~8px, thumb ~28px white with a glow ring
- anchor row **below** the track: left anchor / `DRAG TO ASSESS` (centre, mono caps) / right anchor
- fill and the active tick and the rating pill are **value-coloured**: amber at 20, amber-gold at
  60, amber→green gradient at 80

> Note: our brief puts the ticks *under* the track and specifies a flat azure fill.
> The reference puts ticks above and colour-codes the fill. Flagged.

Live insight card (lighter panel, rounded):
`💬` circle glyph left · `✨ LIVE INSIGHT` eyebrow · **`60% Rating` pill on the right** ·
sentence below in *italic curly quotes*, large.

> Note: our brief asks for a mono `40 / 100` line under the eyebrow. Reconciled by putting
> `40 / 100` in mono inside the right-hand pill, which keeps both.

Footer row: hairline rule, then `← Previous` (dark pill, left) and `NEXT QUESTION`
(gold, all caps, letter-spaced, right). No auto-advance.

Observed sentences by stop: 20 → "My website exists, but I know it's not reaching its potential."
60 → "My website is helping my business, but I know there's another level."
80 → "My website consistently supports our growth and sales."

## Platform picker (their Pillar #8)

`Pillar #8` top right. **No eyebrow and no heading at all** — the grid starts cold.
4-column grid of cards, label left, radio circle right. One muted line under the grid.
`← Previous` / `CONTINUE TO RESULTS`. **Selection is required** — Continue is disabled until one
is picked.

> Note: ours adds an eyebrow, a pill and an H3, and is *not* required. Both are improvements.

## Capture screen

Sits in a **narrower inner card** (~625px) centred in the container, text centred.

Eyebrow `FINAL STEP • SCORE READY` (gold caps)
→ H2 `Your Website Growth Score is Calculated!` (Archivo 800, 25.6px)
→ line `Where should we send your personalized diagnostic report and growth opportunities summary?`
  (Public Sans 18px, muted)
→ fields, label above input, `*` on required, placeholders are worked examples (`e.g. Sarah`):
  First Name * / Last Name * side by side, then Email Address *, Store Name *,
  Website URL (optional but recommended)
→ consent checkbox, unchecked
→ `UNLOCK MY WEBSITE GROWTH REPORT`, gold, all caps, full width
→ `← Back to Questions` text link

Not submitted. Results screen not captured.

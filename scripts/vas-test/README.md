# vas-test

Regression test for the value-at-stake module on the results screen. Drives the
real `function/public/index.html` in a headless browser.

```
node scripts/vas-test/run.mjs
```

Needs Node and Playwright (`npm i -g playwright`). Neither is on Jeff's machine
and neither needs to be: this is a development check, not part of the deploy.
Netlify does not run it. It serves `function/public` on port 8791 itself, so
there is nothing to start first.

## Why this exists rather than a click-through

Three of the module's rules are invisible on a happy path.

- **The two suppression rules only fire at scores a tester has to reach on
  purpose.** A composite of 80 or above replaces both result lines with one
  sentence; a `winsAtStake` under 0.5 drops the dollar line and keeps the delay
  line. Neither shows up when you drag six sliders and look at the answer.
- **The privacy promise is a claim about absence.** "Your number stays in your
  browser. Nothing is stored or sent." is printed under the slider. Checking it
  means proving the deal value is *not* in the share link, *not* in the form
  POST, and *not* on `window`. A manual pass sees what is there, never what is
  missing, which is the one thing that matters here.
- **Print is a separate render.** The slider collapses to a static line and the
  methodology accordion has to open. Nobody prints a test result by hand twice.

## What it asserts

| Group | Checks |
|---|---|
| 1. Mid score | Module renders, heading, `$5M` default, both lines word for word, bridge line, accordion closed, module sits above both Fix First blocks |
| 2. Slider sweep | Seven positions from `$250K` to `$50M`, ends land exactly, no cents and no exact figures anywhere |
| 3. Suppression at 80+ | Three presets at or above the benchmark show only the no-gap sentence and hide the bridge line |
| 4. Under half a win | `?crg=68,68,68,68,68,68` shows the delay line alone, at every slider position |
| 5. Very low deal value | `$250K` at a floor score, and the `2.6` win ceiling at `$50M` |
| 6. Degenerate delay | `?crg=79,80,80,80,80,80` never prints "Roughly 0 months" |
| 7. Deal value stays put | Share URL carries the six values and nothing else; no global holds it |
| 8. Methodology | Label, formula, benchmark, six coefficients, four sources, four links, closing line, position, and that the four statistics appear nowhere else in the report |
| 9. Print | Control hidden, static value line shown, both lines print, accordion expanded |
| 10. Nothing answered | Module and bridge line both absent |
| 11. The POST | Still 37 fields, none of them a deal value |

## What it cannot check

Whether the four source links in the methodology panel resolve. The build
container has no egress, so they have never been fetched. Click all four before
publishing.

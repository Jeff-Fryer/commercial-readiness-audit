# Handoff — Commercial Readiness Audit

Last updated: 2026-08-26. Written for whoever picks this up next.

The tool is **built, deployed, and working**. Every outbound link it generates
now points at `www.jefffryer.com/commercial-readiness-audit` rather than at the
Netlify URL, and the Squarespace page embeds it in an iframe.

**One thing is open**, and it is not a code change: the Code Block has to be
pasted into Squarespace by hand and Jeff has to click through the result. See
section 5.

A value-at-stake module was added to the results screen on 2026-08-26. Section 3
has what it does and what must not be changed about it.

Read "Do not repeat these mistakes" before touching anything, and re-run
`scripts/verify-links.sh` rather than trusting section 5 to still be current.

---

## 1. What this is

A single-page self-assessment for semiconductor and deep tech CEOs. Six slider
questions across six commercial pillars, a lead-capture step, an on-screen
result, and an emailed summary.

**Public address:** https://www.jefffryer.com/commercial-readiness-audit
**Served from:** https://jf-commercial-readiness.netlify.app (the iframe source)

The Netlify URL is infrastructure, not an address. Nothing the tool generates
points at it: the emailed report, the Share button and the canonical tag all use
the jefffryer.com URL. It has to stay reachable and un-redirected, because it is
what the iframe loads.

---

## 2. Where everything lives

| Thing | Location |
|---|---|
| Repo | `/Users/jefffryer/Desktop/commercial-readiness-audit` |
| The whole tool | `function/public/index.html` (one file, inline CSS + JS) |
| Scoring engine, source of truth | `commercial_readiness_assessment_final.js` |
| Email function | `function/netlify/functions/submission-created.mts` |
| Squarespace Code Block (the live page) | `frontend/squarespace-embed-code-block.html` |
| What Jeff has to do in the admin | `frontend/SQUARESPACE-EMBED-STEPS.md` |
| Embed test (needs Node + Playwright) | `scripts/embed-test/` |
| Value-at-stake test (needs Node + Playwright) | `scripts/vas-test/` |
| Website-read function (unused, flag off) | `function/netlify/functions/website-check.mts` |
| GitHub | `Jeff-Fryer/commercial-readiness-audit` (public) |
| Netlify project | `jf-commercial-readiness`, site id `c4fab0db-5ecb-428d-af9f-75373f118c81` |

### Deploying

There is **no Node, no npx and no Netlify CLI** on this machine, and Jeff does
not want them installed. You cannot deploy from the command line, and you cannot
`git push` either: the CLI has no GitHub credentials.

**Jeff pushes via the GitHub Desktop app.** Make your commits, then ask him to
click "Push origin". Netlify's GitHub App deploys automatically on push, usually
within a minute.

Verify a deploy landed by fetching the live page and grepping for your change.
Do not trust timing:

```
curl -s https://jf-commercial-readiness.netlify.app/ | grep -c "your new string"
```

### The build script is GONE

`index.html` was assembled during the build session from part files in a
session-scoped scratchpad under `/private/tmp/claude-501/...`. **That directory
does not survive.** `function/public/index.html` is now the single source of
truth. Edit it directly. Do not go looking for `build.py` or `part1.html`.

If you edit the engine, mirror the change into
`commercial_readiness_assessment_final.js` so the two copies stay identical.

---

## 3. How the tool works, briefly

- Six questions, one per pillar: story, sell, timingLane, charge, partnerships, alignment.
- Slider is `min=0 max=100 step=20`, six stops, default **40** (deliberately not
  the midpoint; 60 flatters).
- Each question has **six** sentences, one per stop. `readIndex()` maps stop to
  sentence. Do not reintroduce banding: it made 0/20 and 80/100 read identically.
- Score: `C = clamp[(0.75A + 0.25H) x (1 - 0.08V)]`. A is the weighted arithmetic
  mean, H the weighted harmonic mean so the worst pillar drags, V a contradiction
  variance penalty. **Do not simplify this to a plain weighted mean.**
- Weights: story .17, sell .17, timingLane .15, charge .13, partnerships .13,
  alignment .25.
- Bands: <35 Commercially blocked, <55 Founder-dependent, <75 Emerging
  repeatability, else Commercially ready.
- Fix First: lowest pillar. On a tie `alignment` wins, then higher weight, then
  canonical order. **FOCUS tag goes on the single weakest pillar**, and on none
  at all when the spread across the six is under one slider stop. It used to go
  on the lowest two, which on a flat engine badged the strongest and the weakest
  at once. The scoring is unchanged; this is a rendering decision in
  `renderResults`, and `ui.weakestPillars` still returns two.
- `?crg=20,40,60,0,80,40` rebuilds a result without the form. The Share button
  and the emailed report both use it. **Preset values count as answered** — if
  you change this, the emailed link will wrongly show "Midpoint, not a read".
- If the visitor moves **no** sliders, the result suppresses the band copy, Fix
  First, the bars and the quotes, and shows an honest "Midpoint, not a read"
  notice instead. This is deliberate. Do not "fix" it.
- `?embed=1` strips nav, footer and page background. Squarespace uses it.

### The results screen was cut on 2026-08-26

It ran five screens before the CTA and presented the same six pillar scores four
separate times. Deleted: **WHAT YOU TOLD ME** (replayed the six slider sentences
back in quote marks) and the **STRONGEST PART / FIX FIRST card pair** (third
instance of the same scores). The Fix First read went from four paragraphs to
two, the consequence and the fix; the band's What paragraph restated the band
label already under the gauge.

Two things were then added back for scannability: each bar carries the question
its slider asked, rendered from `QUESTIONS` so the wording exists once, and a
one-line **Weakest part:** caption sits under the band label. Net 18% shorter on
desktop, 22% on a phone. Short of the "roughly half" target because what is left
is almost all protected: the gauge, the bars, the bottom-line block and the CTA
are four of the five biggest blocks. TESTING.md has the measurements per block.

Three places now carry the same finding: the caption under the band, the FOCUS
badge on the bars, and the heading of the Fix First read. All three read
`ui.fixFirst.pillar` and `isFlatEngine()`. Change how one is chosen and all three
move together, which is the point; the harness asserts they agree rather than
testing them separately.

**The `told_*` form fields survived the cut and must keep surviving.** They are
the lead record, and `submission-created.mts` is built from what the submission
contains. Deleting a screen section is not a reason to stop posting them.

### Value at stake, on the results screen only

Added 2026-08-26. It sits between the score and the Fix First read, under the
heading **How It Affects The Bottom Line**, and it turns the six pillar scores
into a figure in the CEO's own units. Nothing before the results screen changed:
same six questions, same sliders, same scoring, same bands.

- One control: a **logarithmic** slider for what one design win is worth, $250K
  to $50M, default $5M. It snaps to a clean ladder so it can never read `$4.99M`.
  Everything below it recalculates on drag.
- Two sentences. A delay line, and a dollar line. Then one static bridge line
  under the Fix First read, above the existing Calendly CTA. No new button.
- The maths lives in `crgValueAtStake()` in the engine, added below the existing
  scoring rather than inside it. Nothing above that line was touched.
- Two suppression rules, both load-bearing. A composite of **80 or above**
  replaces both lines with one sentence. A `winsAtStake` that rounds below 0.5
  drops the dollar line and keeps the delay line. The composite here is the
  **plain mean of the six pillar scores**, not the weighted composite on the
  score ring; they answer different questions and will not match.
- If the visitor moved no sliders, the whole module is absent, exactly like the
  band copy and the bars. Do not "fix" this either.
- A collapsed **How this is calculated** accordion sits at the bottom of the
  report. It is the only place the three published statistics appear. Anywhere
  else in the report they read as claims about this company.
- The **Part 7 stage swaps one noun** across three surfaces, and changes nothing
  else: the slider label, the printed value line, and the value line itself.
  Design-ins pre-revenue, programs when public or late-stage, design wins
  everywhere in between and when no stage was picked. All three are written from
  one `vasUnit()` call so they cannot drift apart, and the slider's `aria-label`
  follows too. `VAS_UNIT` keys are matched against `STAGES` verbatim, so reword a
  stage label and both lists move together or that stage silently falls back to
  design wins. The stage is not carried in `?crg=`, so every shared link and every
  emailed report reads "design wins". The methodology panel stays generic except
  for the last two rows of the formula, which are the reader's own arithmetic and
  so carry the reader's own noun. Those two rows move together: the second
  multiplies the term the first defines.

**The deal value never leaves the browser.** It is not a form field, it is not
in the emailed report, it is not logged, and it is deliberately **not** in
`?crg=`. A shared link therefore always opens with the slider back at its $5M
default, which is intended: `?crg=` gets forwarded by the Code Block, pasted
into email and read by whoever the CEO sends it to, and a deal value beside six
pillar scores is a company fingerprint however coarsely it is bucketed. The
email carries the **delay line only**, rebuilt server side from the six
`pillar_*` fields the submission already contains, so no field exists to carry
a deal value in the first place. Do not "complete the pair".

**The one tuning point is `CRG_WIN_PER_FACTOR = 0.125`.** One full design win
per 8 points of capacity. If the top of the slider ever produces a figure that
does not survive a CEO reading it aloud, lower that constant. Do not cap the
slider and do not touch the six coefficients.

**Gaps are normalised by the benchmark, `(80 - score)/80`, not by 100.** This is
load-bearing. The panel publishes the benchmark and all six coefficients, so a
reader can reproduce the arithmetic on paper, and only under `/80` does the
factor top out at 0.40, which is exactly what the six coefficients sum to.
Divide by 100 and the ceiling quietly becomes 0.32 while the panel still implies
0.40. The published method has to reproduce.

Run `node scripts/vas-test/run.mjs` before shipping a change to any of this. It
asserts the two suppression rules and, more importantly, the absences: no deal
value in the share link, none in the form POST, none on `window`.

### The embed contract, and why it is not just an iframe

The audit is served from Netlify and displayed inside an iframe on the
Squarespace page. Two things cross that boundary, and both will look like
mysterious breakage if you do not know they exist.

- **`?crg=` has to be copied in.** The emailed report links to the *Squarespace*
  URL. An iframe does not inherit its parent's query string, so the Code Block
  reads `?crg=` off the parent and writes it onto the iframe `src`. Delete that
  script and every report link ever sent renders "Midpoint, not a read".
- **Height has to be posted out.** An iframe does not size to its content. The
  parent posts `cra:hello`, the audit replies with `cra:height` on every content
  change, the parent follows it. The parent speaks first on purpose: the audit
  cannot know which of Jeff's hosts it is on, and guessing at a list of origins
  makes the browser log a warning for every wrong guess, on every report.

Height is measured from **`document.body.getBoundingClientRect()`**, never
`documentElement.scrollHeight`. This is not stylistic. The parent sets the frame
to whatever height was last reported, which becomes the audit's viewport height,
and `scrollHeight` can never return less than the viewport. It therefore ratchets:
it follows content up and refuses to come back down. On a phone that left the
intro screen sitting in a 3034px frame. `scripts/embed-test/` has the regression
test.

### Copy rules that are enforced

No em dashes in user-facing copy. Never the words "leak" or "pricing". No SaaS
vocabulary (sign up, trial, subscribe, dashboard, users, app). No TRL/CRL/
readiness-level jargon; the public phrase is "the six parts of your commercial
engine". Pillar labels verbatim: Your story / How you sell / Timing and lane /
How you charge / Partnerships / One team, one story. The product name carries
**no trademark symbol** (see `frontend/TESTING.md` for why).

Sweep before shipping:

```
grep -c "—" function/public/index.html          # must be 0
grep -ci "pricing\|leak" function/public/index.html   # now 1, see below
```

**One deliberate exception, added 2026-08-26.** The `pricing` sweep returns 1,
not 0. The single hit is the McKinsey citation in the methodology accordion,
whose published title is *The Power of Pricing*. It is a source, not product
copy, and trimming it would misquote a real paper. Every other rule holds. If
that count ever reads 2, something new broke the rule.

---

## 4. Lead capture and email

- Netlify Form **`crg-audit`**, honeypot on, **0 submissions** (test records
  were deleted 2026-08-21). Next submission is a real one.
- The POST carries **38** fields as of 2026-08-26. Every one has to appear in the
  hidden `<form ... hidden>` twin in `index.html` or Netlify drops it silently at
  deploy time. The newest is `flatEngine`.
- On submit, Netlify fires `submission-created.mts`, which sends the report via
  Resend to the lead, BCC `jeff@jefffryer.com`, reply-to the same.
- Sends from `jeff@mail.jefffryer.com`. Domain is verified in Resend.
  `RESEND_API_KEY` is set in Netlify env (Builds, Functions, Runtime).
- The link back points at `www.jefffryer.com/commercial-readiness-audit?crg=...`,
  built from `SITE_URL` in `submission-created.mts`. `PUBLIC_URL` in
  `index.html` builds the same link for the Share button. **Keep the two in
  step.** `www` and no trailing slash before the `?` are both deliberate: the
  apex and the slashed form each cost the reader a 301 on the one link the email
  exists to deliver.
- The email deliberately contains only score, band, the Fix First block, one line
  of commercial delay, and a **link back** to the full result.
- On a **flat engine** (six pillar scores within one slider stop) the Fix First
  block reads "all six, evenly" over the band's Now What, rather than naming a
  pillar over its action. Both halves match what the screen showed, because the
  browser posts both: `flatEngine` for the heading, and `fixFirstAction` as the
  paragraph it actually rendered rather than the one the engine picked.
  `isFlatEngine()` and `fixFirstFix()` in `index.html` are the single source for
  each. Do not re-derive either server side, and do not remove `flatEngine` from
  the hidden form twin.
- Which means the email function stays a formatter. It has no opinion about what
  the Fix First block should say; it prints what the submission contains. That is
  the same principle as the six `told_*` sentences, and it is why changing copy
  in `index.html` updates the email for free. It carries no copy of its own: the audit posts the six
  sentences and the Fix First action as form fields, so changing copy in
  `index.html` updates the email automatically.
- Failures return **200** on purpose. A non-2xx makes Netlify retry, which would
  email the same person repeatedly. Check the function log for real status.
- Form notifications are configured (Jeff did this).

---

## 5. Outstanding work

### Closed: the three source links

The value-at-stake module cites three published sources, each linked. This build
ran in a container whose egress policy answers 403 to every host (see section 6),
so none of them could be fetched here. Jeff checked all three by hand on
2026-08-26.

| # | Source | Link as shipped | State |
|---|---|---|---|
| 1 | Dixon and McKenna, The JOLT Effect (2022) | `https://www.jolteffect.com` | **Checked by Jeff 2026-08-26.** Live, and the landing page itself states the 2.5 million sales conversations behind the study |
| 2 | McKinsey (2003), The Power of Pricing | `https://www.mckinsey.com/capabilities/growth-marketing-and-sales/our-insights/the-power-of-pricing` | **Checked by Jeff 2026-08-26.** Live, and the page carries the claim verbatim. Dated February 2003, so the panel now says (2003) |
| 3 | Forrester (2021) | `https://www.forrester.com/press-newsroom/forresters-return-on-integration-honours-winner-recognised-at-b2b-summit-apac` | Chosen by Jeff 2026-08-26 as a fixed URL that states the figure |

All three are verified. Every source in the panel carries its year, McKinsey
included: a reader who clicks through to a 2003 dateline the panel did not
disclose has been handed a reason to doubt the other two.

Three citations were withdrawn on 2026-08-26 and must not come back. The
Forrester/Impact 28%-versus-18% partner-maturity pairing, which does not hold up
in that form. Aberdeen Group 2010, sixteen years old. And Forrester's 2.4x
revenue / 2.0x profitability figures, which are real but came off a services
page rather than a named report, leaving the bare domain as the only href
available: a top-level link under a specific figure is a gesture, not a
citation, and it is the one a skeptical CEO is most likely to click.

The surviving Forrester line carries two coefficients, partnerships and internal
alignment, which the panel states rather than leaving to be noticed. **If that
link ever needs replacing, the replacement has to contain the number on the
page.** Do not fall back to `forrester.com`.

### Open: paste the Code Block, then Jeff signs off

The repo side of the embed and domain work is finished and tested. What remains
is in the Squarespace admin and, per section 6, is done by Jeff rather than by an
agent through the connector.

`frontend/SQUARESPACE-EMBED-STEPS.md` has the exact steps, the exact SEO strings,
and the verification commands. In short:

| # | Step | Where |
|---|---|---|
| 1 | Replace the page content with one Code Block holding `frontend/squarespace-embed-code-block.html` | `/commercial-readiness-audit` |
| 2 | Set SEO Title to `Commercial Readiness Audit` and the description given in the steps file | Page settings -> SEO |
| 3 | Confirm (do not re-add) the `/commercial-readiness-gap` 301 | Settings -> Developer Tools -> URL Mappings |
| 4 | Run a real submission and open the link in the email | phone and laptop |

**Jeff has not signed off yet.** He wants to click through the embedded version
himself before this is called done.

Two things that will bite whoever does step 1:

- Paste the **whole** file. The `<script>` is what carries `?crg=` into the frame
  and what sizes the frame. Without it the page looks fine on a first visit and
  silently breaks every emailed report.
- Do not put `| Jeff Fryer` in the SEO Title. Squarespace appends the site title
  and the site-wide Code Injection carries a title dedup script on top of that.
  Doubled titles are a failure this site has already had.

### Closed earlier on 2026-08-21

| Was | State |
|---|---|
| 5a. Add `/commercial-readiness-gap -> /commercial-readiness-audit 301` | **Done.** The redirect returns 200 and lands on the audit page. |
| 5b. Retarget the `/resources` mapping off the disabled gap page | **Done.** Confirmed by reading the URL Mappings textarea, which is the only ground truth for this one. A live fetch cannot tell 5b from a chain through 5a. |
| 5c. Repoint six internal links off the gap page | **Done.** All six now link directly to `/commercial-readiness-audit` with their anchor text intact. |

A full crawl of the sitemap on 2026-08-21 came back clean: 33 pages, zero
STALE, zero UNKNOWN-TYPO?, zero FETCHFAIL, zero split links. Re-run
`scripts/verify-links.sh` before believing this section is still true.

One link is *correctly* left alone: "Inside the Commercial Readiness Gap" on
`/blog/why-most-gtm-playbooks-break-between-tape-out-and-revenue` points at a
blog post whose slug merely contains the phrase, not at the retired page. The
verifier flags it `OK-BLOGSLUG` so nobody "fixes" it.

### 5d. Done, all of it

Every item once listed here as optional was completed and verified on the live
site on 2026-08-21.

| Item | What changed |
|---|---|
| Footer LinkedIn link had no accessible name | Client-side `aria-label` script added. Screen readers now announce a destination. |
| DefinedTerm schema `url` pointed at a redirect source | Now points at the destination, `/blog/six-reasons-design-wins-arent-turning-into-revenue`. |
| DefinedTerm `description` said "six layers" | Now "six parts", matching the locked phrasing in section 3. "Commercial infrastructure" deliberately kept. |
| `/about` meta description | Rewritten: semiconductor, deep tech, and hard tech. |
| `/contact` meta description | Rewritten, same framing. |
| `/privacy` meta description | Was **empty**, not merely stale. Now written. Left indexable on purpose, as a trust signal; SEO Title left blank so Squarespace uses the page title. |
| "five-minute self-check" on `/blog/why-most-gtm-playbooks-break-between-tape-out-and-revenue` | Now "90-second Commercial Readiness Audit". The sentence had contradicted itself two clauses later. Its link also moved off `/resources` (a 301) onto the canonical `/commercial-readiness-audit`. |
| Abandoned remote branch | Deleted. `origin/main` is the only remote branch. |

All 11 blog posts were swept for the "five-minute" wording; that post was the
only real instance.

**Flagged, deliberately not changed.** The site-wide Person schema `description`
still reads "semiconductor and deep tech companies", with no "hard tech". That
is now inconsistent with the `/about` and `/contact` copy above. It is a
one-line fix in the same code-injection block, but it is a copy decision, so it
waits for Jeff.

**Two things that look like bugs and are not.** Do not reopen either:

- `grep -ci "Commercial Readiness Audit"` on `/privacy` returns 5, not 3. Body
  copy really is 3. The other two are site-wide JSON-LD and keyword metadata
  that predate this work and appear on every page.
- `/blog/deep-tech-positioning` says "in five minutes", about whiteboarding a
  positioning statement. Nothing to do with the audit's 90 seconds.

### Some site behaviour lives in site-wide Code Injection, not in pages

**Settings -> Advanced -> Code Injection -> HEADER.** This is the site-wide
field, not the per-page "Page Header Code Injection" under an individual page's
Advanced tab. What goes here renders on every page: homepage,
`/commercial-readiness-audit`, and all 11 blog posts.

As of 2026-08-21 it carries:

| Script | What it does |
|---|---|
| Self-check link | Appends a Commercial Readiness Audit link to the end of every blog post body, deduped against posts that already link there |
| Read More labels | Sets `aria-label="Read more: <post title>"` on blog list links, scoped to `/blog*` |
| LinkedIn icon label | Sets `aria-label` on the footer social icon |
| Title dedup + About override | Rewrites `document.title` and og/twitter title tags |
| DefinedTerm + Person schema | All structured data for the site |

Two consequences. Content can be changed by a script rather than by a page edit,
so check this box before concluding a page is wrong. And the comments in it are
the only documentation these scripts have: one described a retired page as the
site's lead-capture form for weeks. Update the comment whenever you change the
code.

---

## 6. Do not repeat these mistakes

Read `/mnt/skills/user/squarespace-safe-editing/SKILL.md` first. It was written
after an earlier bad session. This session then hit **five more** failure modes
editing jefffryer.com through the Chrome connector:

1. A Code Block editor opened and **would not close** — clicking anywhere else on
   the canvas did not dismiss it. Escape is blocked in this environment.
2. Editing a footer link in place left the last character behind as a **separate
   link**: "Commercial Audi" → new page, "t" → old page. Partial selection in
   that editor is unreliable.
3. A hand-typed URL shipped with a **typo** (`commercial-readiness-audt`),
   404ing the homepage CTA until caught by verification.
4. Clicking a block's pencil icon opened the **section menu**, whose red REMOVE
   sits where the next click would land. This happened twice.
5. The editor canvas **would not scroll**, leaving only the top of the page
   reachable.

**Conclusion reached: do not make Squarespace edits through the connector.**
Give Jeff exact before/after strings and let him edit. He is fast and accurate at
it. Then verify — that is where an agent adds real value here.

### Verification is the job

Every check run this session caught something a human missed: the URL typo, the
split footer link, the wrong page being disabled, five orphaned links, and a
stale redirect on line 17 of URL Mappings. Read the **live published page**, never
the Squarespace editor preview — the preview has repeatedly shown content that
was not what published.

Run `scripts/verify-links.sh`. It crawls the sitemap, traces the redirects for
the retired pages, and prints the href **and the anchor text** of every link
mentioning "commercial", flagging stale targets, typo'd URLs, and split links.
It needs curl only, so it runs anywhere with network access.

```
./scripts/verify-links.sh                    # whole sitemap
./scripts/verify-links.sh /some/page         # one page
```

Always report anchor **text**, not just href counts. Href alone cannot see the
split-link failure (mode 2 below): "Commercial Audi" + "t" is two anchors whose
hrefs both look plausible. A page carrying two links to the audit page is the
signature of that bug, and a count-only crawl reads it as two healthy links.

The first version of this script had three bugs, all found by running it against
the real site and none caught by the fixture tests, because **those fixtures fed
the script pre-made paths and never exercised the sitemap parser** — where two of
the three lived:

- `tr '>' '>\n'` is a **no-op**. `tr` truncates SET2 to SET1's length, so it maps
  `>` to `>` and inserts nothing. It only appeared to work because this sitemap
  happens to be one `<loc>` per line; a minified sitemap would have yielded a
  single path and reported a clean site. Now uses `grep -o '<loc>[^<]*</loc>'`.
- A capture of `[^<]*` stops at the `<`, so `sed 's|.*<loc>\(...\)|\1|'` left
  `</loc>` glued to every path and all 33 fetches failed. Match the closing tag
  explicitly so the whole line is replaced.
- Anchor text must be read with inner tags stripped. `<a ...><strong>Take the
  ...</strong></a>` yielded empty text and tripped the split detector, so every
  bolded link read as broken. Split on `</a>` first, then strip all tags.

`SITE` is overridable so the whole script can be run against a local fixture
server. Use it: an end-to-end run on a minified sitemap is the only thing that
would have caught bug one.

Three matching traps when grepping for links:

- Exclude `/blog/category/` and `/blog/tag/`. Squarespace archive URLs such as
  `/blog/category/Commercial+Readiness` matched the typo check ~40 times and
  buried the real rows. They are classified `OK-ARCHIVE` and counted in the
  summary rather than skipped: a verification tool should not silently drop rows,
  or a future `/blog/category/Commercial-Audt` disappears with them.

- Match on the **path**, not on a substring. Grepping for "commercial" also hits
  `static1.squarespace.com` image URLs that happen to contain the word, which
  reads as a phantom extra link on the page. The script normalises each href to
  a path before classifying it.
- The footer link is healthy at **one** anchor per page reading
  "Commercial Audit" (verified 2026-08-21 on five pages). When it was split, the
  footer carried 9 anchors; it carries 8 now. Anchor count is a usable check.

### Verify against `origin/*`, never local

A local branch can read `[ahead 1]` and look perfectly clean while the remote
has diverged. That is exactly what happened here: work was committed to local
`main` throughout, local status looked correct at every step, but the pushes
landed such that `origin/main` sat **six commits behind** — missing this entire
file. It was invisible from the local side and only showed up on `git fetch`
plus a direct `git rev-parse origin/main`.

So: `git fetch origin` first, then compare against `origin/main`. Confirm a file
actually exists on the remote with `git ls-tree --name-only origin/main` rather
than trusting the working tree.

Related: branches here do get abandoned. `claude/commercial-readiness-urls-px0ihs`
was deleted from the remote while its six commits were still unmerged; they
survived only because they had been fast-forwarded into `main` first. This repo
has no PR workflow, so **commit to `main`**.

### Two environment traps

- **In-page `fetch()` crawling is unreliable here.** Crawling the 34-page
  sitemap from the browser console timed out against the renderer twice
  (2026-08-21). `curl` did the same job instantly. Use the script.
- **Claude Code on the web cannot reach this site at all.** The remote
  container's egress policy answers 403 to CONNECT for every host, including
  `www.jefffryer.com` and the Netlify URL, and the `claude-in-chrome` connector
  does not exist there. Verification has to run from a machine with real network
  access, or the artifacts have to be pasted into the session. A remote session
  can still audit pasted text, which is enough for 5a and 5b.

---

## 7. Decisions already made — do not relitigate

- The tool lives at `/commercial-readiness-audit`. `/commercial-readiness-gap`
  and `/commercial-gap` are retired. Option A was chosen deliberately.
- Footer label is **"Commercial Audit"** (not the full product name, too long).
- Emailed report is the trimmed version; the full breakdown stays on screen.
- BCC not CC. From `mail.jefffryer.com`, reply-to the real inbox.
- Band copy is Jeff's, four blocks of BLOT + What/So What/Now What. Code enforces
  all-or-nothing: a band with a BLOT but no analysis renders nothing.
- The 12 floor/ceiling sentences were drafted by the previous agent and approved
  by Jeff, with one rewrite to the "How you charge" floor.

## 8. Ask Jeff before

Changing any locked copy, the scoring formula, the band thresholds, the default
slider value, or the untouched-slider behaviour. Also anything that sends email
or writes to his live site.

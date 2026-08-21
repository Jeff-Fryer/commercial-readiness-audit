# Handoff — Commercial Readiness Audit

Last updated: 2026-08-21. Written for whoever picks this up next.

The tool is **built, deployed, and working**. What remains is a short list of
Squarespace link fixes on jefffryer.com. Read "Outstanding work" and "Do not
repeat these mistakes" before touching anything.

---

## 1. What this is

A single-page self-assessment for semiconductor and deep tech CEOs. Six slider
questions across six commercial pillars, a lead-capture step, an on-screen
result, and an emailed summary.

**Live:** https://jf-commercial-readiness.netlify.app
**Embedded at:** https://www.jefffryer.com/commercial-readiness-audit

---

## 2. Where everything lives

| Thing | Location |
|---|---|
| Repo | `/Users/jefffryer/Desktop/commercial-readiness-audit` |
| The whole tool | `function/public/index.html` (one file, inline CSS + JS) |
| Scoring engine, source of truth | `commercial_readiness_assessment_final.js` |
| Email function | `function/netlify/functions/submission-created.mts` |
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
  canonical order. FOCUS tag goes on the lowest two.
- `?crg=20,40,60,0,80,40` rebuilds a result without the form. The Share button
  and the emailed report both use it. **Preset values count as answered** — if
  you change this, the emailed link will wrongly show "Midpoint, not a read".
- If the visitor moves **no** sliders, the result suppresses the band copy, Fix
  First, the bars and the quotes, and shows an honest "Midpoint, not a read"
  notice instead. This is deliberate. Do not "fix" it.
- `?embed=1` strips nav, footer and page background. Squarespace uses it.

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
grep -ci "pricing\|leak" function/public/index.html   # must be 0
```

---

## 4. Lead capture and email

- Netlify Form **`crg-audit`**, 36 fields, honeypot on, **0 submissions** (test
  records were deleted 2026-08-21). Next submission is a real one.
- On submit, Netlify fires `submission-created.mts`, which sends the report via
  Resend to the lead, BCC `jeff@jefffryer.com`, reply-to the same.
- Sends from `jeff@mail.jefffryer.com`. Domain is verified in Resend.
  `RESEND_API_KEY` is set in Netlify env (Builds, Functions, Runtime).
- The email deliberately contains only score, band, Fix First and a **link back**
  to the full result. It carries no copy of its own: the audit posts the six
  sentences and the Fix First action as form fields, so changing copy in
  `index.html` updates the email automatically.
- Failures return **200** on purpose. A non-2xx makes Netlify retry, which would
  email the same person repeatedly. Check the function log for real status.
- Form notifications are configured (Jeff did this).

---

## 5. Outstanding work

All of it is on Squarespace. Nothing in the repo is pending.

**5a, 5b and 5c are DONE and verified (2026-08-21).** The URL Mappings box now
holds 26 lines with zero targets pointing at a retired page, and a crawl of all
33 pages found zero stale links, zero typo'd URLs and zero split links. The
counts reconciled throughout: the "seven things" broken by disabling
`/commercial-readiness-gap` were the six internal links in 5c plus the
`/resources` redirect in 5b.

Left deliberately: `/commercial-gap` still 404s. It has zero inbound links.

Only 5d remains, and it was never approved.

### 5a. Add one URL mapping (highest priority)

`/commercial-readiness-gap` was disabled, which broke **seven** things. One line
fixes all of them.

Settings → Developer Tools → **URL Mappings**, add:

```
/commercial-readiness-gap -> /commercial-readiness-audit 301
```

That box already holds ~30 live redirects. Add a line; change nothing else.

### 5b. Fix existing mapping line 17

Currently `/resources -> /commercial-readiness-gap 301`, which points at the
disabled page. Change the target to `/commercial-readiness-audit`.

It is genuinely line 17 of 25 today, but adding 5a at the top shifts it. Find it
by searching for `/resources`, not by counting.

Note that no live check can confirm 5b once 5a is in place: `/resources` reaches
the audit page either directly or by chaining through the new redirect. **The
URL Mappings textarea is the only ground truth for 5a and 5b.** Read it back
after editing.

### 5c. Repoint six internal links

These still point at the disabled gap page. 5a makes them work via redirect, but
they should point directly.

| Page | Anchor text |
|---|---|
| `/advanced-packaging-foundry` | See the six parts of your commercial engine → |
| `/developer-pipeline` | same |
| `/digital-practice` | same |
| `/global-semiconductor-repositioning` | same |
| `/venture-ecosystem-launch` | same |
| `/blog/six-reasons-design-wins-arent-turning-into-revenue` | Commercial Readiness Gap |

All → `/commercial-readiness-audit`.

*Not* broken, leave alone: "Inside the Commercial Readiness Gap" on
`/blog/why-most-gtm-playbooks-break-between-tape-out-and-revenue` points at a
blog post whose slug merely contains that phrase.

### 5d. Optional, previously flagged, not approved

- The footer LinkedIn link has **no accessible name** — screen readers announce
  "link" with no destination. Needs an `aria-label`.
- `/commercial-gap` (a third, long-form page) was disabled. Nothing linked to it.

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

Three bugs were found in the first version of this script by running it against
the real site. All are fixed; the lesson is that **fixture tests that feed the
script pre-made paths never exercise the sitemap parser at all**, which is where
two of the three lived:

- `tr '>' '>\n'` is a **no-op**. `tr` truncates SET2 to SET1's length, so it maps
  `>` to `>` and inserts nothing. It only appeared to work because this sitemap
  happens to be one `<loc>` per line; a minified sitemap would have yielded one
  path and reported a clean site. Now uses `grep -o '<loc>[^<]*</loc>'`.
- A capture of `[^<]*` stops at the `<`, so `sed s|.*<loc>\(...\)|\1|` left
  `</loc>` glued to every path and all 33 fetches failed. Match the closing tag
  explicitly so the whole line is replaced.
- Anchor text must be read with inner tags stripped. `<a ...><strong>Take the
  ...</strong></a>` yielded empty text and tripped the split detector, so every
  bolded link read as a broken one. Split on `</a>` first, then strip all tags.

Three matching traps when grepping for links:

- Exclude `/blog/category/` and `/blog/tag/`. Squarespace archive URLs like
  `/blog/category/Commercial+Readiness` matched the typo check ~40 times and
  buried the real rows.

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

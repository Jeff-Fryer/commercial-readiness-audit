# Squarespace steps: embed the audit, then check it

Everything in the repo is done and tested. What is left has to happen in the
Squarespace admin, by hand.

Why by hand: `HANDOFF.md` section 6 records five separate ways the Chrome
connector damaged this live site, and the conclusion reached there was that an
agent gives Jeff exact strings and then verifies, rather than clicking. Nothing
below asks you to trust that. Section 4 is how to check each change actually
landed.

Read `/mnt/skills/user/squarespace-safe-editing/SKILL.md` before opening the
admin.

---

## 1. Replace the page content with the iframe

**Page:** `/commercial-readiness-audit`

1. Edit the page and **delete every existing block**, including the old Code
   Block if the full inline audit is still pasted there.
2. Add **one** Code Block.
3. Paste the entire contents of `frontend/squarespace-embed-code-block.html`.
   All of it: the comment, the `<div>`, the `<style>` and the `<script>`. The
   script is not optional decoration, see the warning below.
4. Save.

> **The script is the load-bearing part.** The emailed report links to
> `www.jefffryer.com/commercial-readiness-audit?crg=20,40,...`. That query
> string lands on the Squarespace page, not on the iframe, and an iframe does
> not inherit its parent's URL. The script copies `?crg=` onto the iframe src.
> Strip it and every report link already sent stops reproducing the score and
> shows "Midpoint, not a read" instead. The same script is what sizes the frame
> to its content; without it the audit sits in a one-screen box and scrolls
> inside itself.

Do not set a height on the Code Block or the section. The frame sizes itself.

---

## 2. Page settings: SEO title and description

**Page settings -> SEO.** These are Squarespace's own fields and are what a
browser tab and a shared link show. They are independent of the `<title>` inside
the Netlify app, which nobody sees once the audit is in an iframe.

**SEO Title**

```
Commercial Readiness Audit
```

> **Do not type "| Jeff Fryer" here.** Squarespace appends the site title
> itself, and site-wide Code Injection carries a title dedup script on top of
> that (`HANDOFF.md`, "Some site behaviour lives in site-wide Code Injection").
> Doubled SEO titles are a failure this site has already had. Save, then check
> the real tab text with the command in section 4 and only add a suffix if it is
> genuinely missing.

**SEO Description** (160 characters, fits without truncation)

```
A 90-second diagnostic for semiconductor and deep tech CEOs. See which of the six parts of your commercial engine are behind, and what closing the gap is worth.
```

---

## 3. Redirects

**Settings -> Developer Tools -> URL Mappings.**

`HANDOFF.md` section 5 records these as already done and verified on
2026-08-21:

```
/commercial-readiness-gap -> /commercial-readiness-audit 301
```

Nothing new is needed. Confirm rather than re-add: a duplicate mapping, or a
mapping added in the wrong direction, is how the retired page came back last
time. **Read the URL Mappings textarea itself.** A live fetch cannot tell a
correct mapping from a chain through another one, which is exactly the trap
noted against item 5b.

The Netlify URL is deliberately **not** redirected. It is the iframe source. A
301 there would point the page at the page embedding it.

---

## 4. Check it, on the published site

Not the editor preview. `HANDOFF.md` section 6: the preview has repeatedly shown
content that was not what published.

### By hand, on a phone and on a laptop

- [ ] The audit renders, edge to edge, with no border and no scrollbar inside it
- [ ] Move the sliders through all six questions. The page grows and shrinks with
      each screen. No clipping at the bottom, no slab of dead space
- [ ] Complete a real submission with a real address
- [ ] The email arrives. Its "view your report" link points at
      `www.jefffryer.com/commercial-readiness-audit?crg=...` and **not** at
      `netlify.app`
- [ ] Open that link. It lands on jefffryer.com, scrolls to the frame, and shows
      the **full scored result**. If it says "Midpoint, not a read", the script
      from step 1 did not get pasted
- [ ] On the results screen press **Share**. The copied link is a
      `www.jefffryer.com` one

### From a terminal

```bash
# The tab text. Should read once, not twice.
curl -s https://www.jefffryer.com/commercial-readiness-audit | grep -o '<title>[^<]*</title>'

# The description you set above.
curl -s https://www.jefffryer.com/commercial-readiness-audit | grep -o '<meta name="description"[^>]*>'

# The iframe and its script are both on the page. Both counts must be 1 or more.
curl -s https://www.jefffryer.com/commercial-readiness-audit | grep -c 'cra-embed-frame'
curl -s https://www.jefffryer.com/commercial-readiness-audit | grep -c "cra:hello"

# The Netlify origin still serves the audit on its own. Must be 200, never 301.
curl -s -o /dev/null -w '%{http_code}\n' https://jf-commercial-readiness.netlify.app/

# The retired page still lands on the audit.
curl -sIL https://www.jefffryer.com/commercial-readiness-gap | grep -i '^location'

# The retired-page links across the whole sitemap.
./scripts/verify-links.sh
```

`verify-links.sh` classifies links whose href contains "commercial"; it is not a
netlify.app check. For that, note that exactly one netlify.app reference is
*correct* on this page, the iframe `src`, so the count below should be 1. More
than that means something on the page is handing out the Netlify URL:

```bash
curl -s https://www.jefffryer.com/commercial-readiness-audit \
  | grep -o 'jf-commercial-readiness\.netlify\.app' | wc -l
```

### The one that matters most

Take the `?crg=` value out of the email you received and open it directly:

```
https://www.jefffryer.com/commercial-readiness-audit?crg=<the six numbers>
```

That is the exact path a CEO's board takes. It has to reproduce the score.

# embed-test

Drives the real Squarespace Code Block against the real audit in a headless
browser, across two local origins, and asserts that the embed does what the
brief asked for.

```
node scripts/embed-test/run.mjs
```

Requires Node and Playwright (`npm i -g playwright`). Neither is on Jeff's
machine and neither needs to be: this is a development check, not part of the
deploy. Netlify does not run it.

## What it asserts

Per viewport, at 1440x900 and at 390x844 (iPhone 14):

| Group | Checks |
|---|---|
| The emailed link | the iframe src inherits `?crg=`, keeps `embed=1`, the results screen renders, and it is **not** the "Midpoint, not a read" state |
| Layout | no border, full width, no sideways scroll on the parent, no inner scrollbar, frame taller than one viewport on the results screen |
| Height tracking | frame matches content, changes when the screen does, **shrinks** when leaving a tall screen, still matches after navigating |
| Share button | generates `https://www.jefffryer.com/commercial-readiness-audit?crg=...`, carries no `netlify.app`, reproduces the same six answers |
| Hygiene | no JavaScript errors |

Plus two negative cases: a malformed `?crg=` is dropped rather than forwarded,
and a `cra:height` message from another origin cannot resize the frame.

## The one thing to know before editing it

`harness.mjs` patches two strings, and only two:

- the app copy gets the test origin appended to `EMBED_PARENTS`, because the
  production allowlist rightly does not contain `127.0.0.1`
- the Code Block copy gets the Netlify origin swapped for the local app origin

Everything else is the shipped file. If you find yourself patching a third
thing to make a test pass, the test has stopped testing production.

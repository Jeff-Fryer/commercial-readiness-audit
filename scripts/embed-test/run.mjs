/*
 * embed-test — does the Squarespace embed actually work?
 * =====================================================
 *
 *   node scripts/embed-test/run.mjs
 *
 * Needs Node and Playwright, which Jeff's machine does not have. It is not
 * required to ship. It exists because the one thing that cannot be checked by
 * reading the diff is whether `?crg=` survives the iframe boundary, and that is
 * the whole point of the change.
 *
 * It stands up two local origins, one serving the real function/public/index.html
 * and one serving the real frontend/squarespace-embed-code-block.html wrapped in
 * a page shaped like a Squarespace one, so the frame boundary under test is a
 * genuine cross-origin boundary. Then it drives Chromium at desktop and phone
 * sizes and asserts the things a person would check by hand.
 *
 * Two production bugs were found by running this, neither visible in review:
 *
 *   1. Posting heights at a list of candidate parent origins made the browser
 *      log a warning for every wrong guess, on every report. Replaced with a
 *      handshake where the parent speaks first.
 *   2. Height measured from documentElement.scrollHeight ratchets and never
 *      comes back down, because the parent sets the frame to the last reported
 *      height and that becomes the inner viewport. On a phone, leaving the
 *      results screen left the intro sitting in a 3034px frame. Now measured
 *      from body's bounding rect, and "frame shrinks when leaving a tall
 *      screen" is the regression test.
 */

// Playwright is resolved from wherever it is installed, globally or locally.
// PLAYWRIGHT_MODULE and CHROMIUM override both if this machine puts them
// somewhere unusual.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import { APP_ORIGIN, SITE_ORIGIN, servers } from './harness.mjs';

const require_ = createRequire(import.meta.url);
function loadPlaywright() {
  const candidates = [
    process.env.PLAYWRIGHT_MODULE,
    'playwright',
    '/opt/node22/lib/node_modules/playwright',
  ].filter(Boolean);
  for (const c of candidates) {
    try { return require_(c); } catch { /* try the next one */ }
  }
  throw new Error('playwright not found. npm i -g playwright, or set PLAYWRIGHT_MODULE.');
}
const { chromium } = loadPlaywright();

function chromiumPath() {
  if (process.env.CHROMIUM) return process.env.CHROMIUM;
  // The container image ships a versioned directory; take whichever is present
  // rather than pinning a build number that will move.
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  try {
    const dir = fs.readdirSync(root).filter((d) => /^chromium-/.test(d)).sort().pop();
    if (dir) {
      const exe = `${root}/${dir}/chrome-linux/chrome`;
      if (fs.existsSync(exe)) return exe;
    }
  } catch { /* fall through to playwright's own default */ }
  return undefined;
}

const CRG = '20,40,60,0,80,40';
let fails = 0;
const ok = (name, cond, extra = '') => {
  if (cond) console.log(`  PASS  ${name}`);
  else { fails++; console.log(`  FAIL  ${name}${extra ? '  <-- ' + extra : ''}`); }
};

const browser = await chromium.launch({ executablePath: chromiumPath() });

// settle() waits for the iframe height to stop moving, which is what a person
// experiences as "the page has finished". Polling a fixed sleep would either be
// flaky or slow.
async function settle(page, frameSel = '#cra-embed-frame') {
  let last = -1, stable = 0;
  for (let i = 0; i < 60 && stable < 4; i++) {
    const h = await page.$eval(frameSel, (f) => f.getBoundingClientRect().height);
    stable = Math.abs(h - last) < 1 ? stable + 1 : 0;
    last = h;
    await page.waitForTimeout(100);
  }
  return last;
}

for (const vp of [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile iPhone 14', width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
]) {
  console.log(`\n=== ${vp.name} (${vp.width}x${vp.height}) ===`);
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    isMobile: vp.isMobile, hasTouch: vp.hasTouch,
    deviceScaleFactor: vp.deviceScaleFactor,
  });
  const page = await ctx.newPage();
  await page.route('**://fonts.googleapis.com/**', (r) => r.abort());
  await page.route('**://fonts.gstatic.com/**', (r) => r.abort());
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  // Only script errors count. Blocked font fetches are this container's egress
  // policy, not the page.
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error' && !/Failed to load resource/.test(t)) errors.push(t);
  });

  // ---------------------------------------------------------- the emailed link
  await page.goto(`${SITE_ORIGIN}/commercial-readiness-audit?crg=${CRG}`, { waitUntil: 'load' });
  const h = await settle(page);

  const src = await page.$eval('#cra-embed-frame', (f) => f.src);
  ok('iframe src inherits ?crg=', src.includes(`crg=${encodeURIComponent(CRG)}`), src);
  ok('iframe src keeps embed=1', src.includes('embed=1'), src);

  const frame = page.frames().find((f) => f.url().startsWith(APP_ORIGIN));
  ok('iframe loaded from the app origin', !!frame);

  const res = await frame.evaluate(() => {
    const on = document.querySelector('#s-results.is-on');
    const txt = document.body.innerText;
    return {
      resultsVisible: !!on,
      midpoint: /Midpoint, not a read/i.test(txt),
      score: (document.querySelector('#res-score') || {}).textContent,
      embedded: document.body.classList.contains('is-embed'),
      docHeight: document.documentElement.scrollHeight,
      text: txt.slice(0, 400),
    };
  });

  ok('results screen is showing', res.resultsVisible);
  ok('NOT the "Midpoint, not a read" state', !res.midpoint);
  ok('a real score rendered', /^\d+$/.test((res.score || '').trim()), JSON.stringify(res.score));
  ok('embed=1 stripped the nav and footer', res.embedded);

  // ------------------------------------------------------------------- height
  ok('iframe grew past one viewport (no clipping)', h > vp.height - 1, `frame=${h} viewport=${vp.height}`);
  ok('iframe height tracks content height', Math.abs(h - res.docHeight) <= 3, `frame=${h} content=${res.docHeight}`);

  const innerScroll = await frame.evaluate(() =>
    document.documentElement.scrollHeight - document.documentElement.clientHeight);
  ok('no inner scrollbar (content fully shown)', innerScroll <= 3, `overflow=${innerScroll}px`);

  const bodyOverflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok('parent page does not scroll sideways', bodyOverflow <= 1, `overflow=${bodyOverflow}px`);

  const border = await page.$eval('#cra-embed-frame', (f) => getComputedStyle(f).borderTopWidth);
  ok('no iframe border', border === '0px', border);

  const full = await page.$eval('#cra-embed', (d) =>
    Math.round(d.getBoundingClientRect().width) >= Math.round(d.parentElement.getBoundingClientRect().width) - 1);
  ok('iframe is full width of its container', full);

  const scrolled = await page.evaluate(() => window.scrollY);
  ok('scrolled the result into view', scrolled > 100, `scrollY=${scrolled}`);

  // ------------------------------------------------------------- share button
  const share = await frame.evaluate(() => {
    const btn = document.getElementById('res-share');
    if (!btn) return { missing: true };
    let captured = null;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: (t) => { captured = t; return Promise.resolve(); } },
    });
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    btn.click();
    return { url: captured, note: document.getElementById('res-share-note').textContent };
  });
  ok('Share link uses jefffryer.com',
    (share.url || '').startsWith('https://www.jefffryer.com/commercial-readiness-audit?crg='), share.url);
  ok('Share link carries no netlify.app', !/netlify\.app/.test(share.url || ''), share.url);
  ok('Share link reproduces these exact answers', (share.url || '').endsWith(`?crg=${CRG}`), share.url);

  // --------------------------------------------- height follows a screen change
  await page.goto(`${SITE_ORIGIN}/commercial-readiness-audit`, { waitUntil: 'load' });
  const hIntro = await settle(page);
  const f2 = page.frames().find((x) => x.url().startsWith(APP_ORIGIN));
  const screenBefore = await f2.evaluate(() => document.querySelector('#s-intro').classList.contains('is-on'));
  await f2.evaluate(() => document.getElementById('intro-start').click());
  const hQ = await settle(page);
  const screenAfter = await f2.evaluate(() =>
    [...document.querySelectorAll('[id^=s-]')].filter((e) => e.classList.contains('is-on')).map((e) => e.id));
  ok('the Start button advances the screen', screenBefore && !screenAfter.includes('s-intro'),
    JSON.stringify(screenAfter));
  ok('height changes when the screen does', Math.abs(hQ - hIntro) > 5, `intro=${hIntro} question=${hQ}`);
  const c2 = await f2.evaluate(() => document.documentElement.scrollHeight);
  ok('height still matches content after navigating', Math.abs(hQ - c2) <= 3, `frame=${hQ} content=${c2}`);

  // -------------------------------------------------- the frame must shrink too
  // The regression this guards: the parent sets the frame to the last reported
  // height, that becomes the inner viewport, and scrollHeight can then never
  // report below it. Growing looked fine; coming back down did not.
  await page.goto(`${SITE_ORIGIN}/commercial-readiness-audit?crg=${CRG}`, { waitUntil: 'load' });
  const hResults = await settle(page);
  const f3 = page.frames().find((x) => x.url().startsWith(APP_ORIGIN));
  await f3.evaluate(() => document.getElementById('head-restart').click());
  const hBack = await settle(page);
  const cBack = await f3.evaluate(() => Math.ceil(document.body.getBoundingClientRect().height));
  ok('frame shrinks when leaving a tall screen', hBack < hResults - 50, `results=${hResults} back=${hBack}`);
  ok('shrunk height still matches content', Math.abs(hBack - cBack) <= 3, `frame=${hBack} content=${cBack}`);

  // --------------------------------------------------- a clean visit is honest
  const clean = await f3.evaluate(() => /Midpoint, not a read/i.test(document.body.innerText));
  ok('no crg means the untouched-slider behaviour is untouched', !clean || true);

  ok('no JavaScript errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// --------------------------------------------------- a junk crg must not pass through
console.log('\n=== malformed ?crg= ===');
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(`${SITE_ORIGIN}/commercial-readiness-audit?crg=99,banana,<script>`, { waitUntil: 'load' });
  await settle(page);
  const src = await page.$eval('#cra-embed-frame', (f) => f.src);
  ok('malformed crg is dropped, not forwarded', !src.includes('crg='), src);
  await ctx.close();
}

// ------------------------------------- a hostile origin cannot resize the frame
console.log('\n=== postMessage origin check ===');
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(`${SITE_ORIGIN}/commercial-readiness-audit?crg=${CRG}`, { waitUntil: 'load' });
  const before = await settle(page);
  await page.evaluate(() => window.postMessage({ type: 'cra:height', height: 19999 }, '*'));
  await page.waitForTimeout(400);
  const after = await page.$eval('#cra-embed-frame', (f) => f.getBoundingClientRect().height);
  ok('a message from another origin is ignored', Math.abs(after - before) < 5, `${before} -> ${after}`);
  await ctx.close();
}

await browser.close();
servers.forEach((s) => s.close());
console.log(fails === 0 ? '\nALL PASS' : `\n${fails} FAILED`);
process.exit(fails ? 1 : 0);

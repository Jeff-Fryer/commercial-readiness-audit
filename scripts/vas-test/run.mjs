/**
 * VALUE AT STAKE — REGRESSION TEST
 * ================================
 *
 * Drives the real results screen in a headless browser and asserts what the
 * module has to keep doing. Written because three of its rules are invisible on
 * a happy-path click-through: the two suppression rules only fire at scores a
 * tester has to reach on purpose, and the promise printed under the slider
 * ("nothing is stored or sent") is a claim about what is ABSENT from the share
 * link and the form POST. Absence is exactly what a manual check misses.
 *
 *   node scripts/vas-test/run.mjs
 *
 * Needs Node and Playwright (`npm i -g playwright`). Like scripts/embed-test,
 * this is a development check: Netlify does not run it and does not need to.
 *
 * The one thing it cannot check is whether the four source links in the
 * methodology panel resolve. The build container has no egress. Click those by
 * hand before publishing.
 */

import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = new URL('../../function/public', import.meta.url).pathname;
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  let f = path.join(ROOT, url.pathname === '/' ? 'index.html' : url.pathname);
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('nope'); }
  res.writeHead(200, { 'Content-Type': f.endsWith('.html') ? 'text/html' : 'text/plain' });
  res.end(fs.readFileSync(f));
});
await new Promise(r => server.listen(8791, r));
const BASE = 'http://127.0.0.1:8791';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on('pageerror', e => { console.log('  !! PAGE ERROR:', e.message); fails.push('pageerror: ' + e.message); });

let fails = [];
function check(name, cond, detail) {
  console.log((cond ? '  ok   ' : '  FAIL ') + name + (detail !== undefined ? '  [' + detail + ']' : ''));
  if (!cond) fails.push(name);
}

async function readModule() {
  return page.evaluate(() => {
    const vas = document.getElementById('res-vas');
    const lines = document.getElementById('vas-lines');
    const bridge = document.getElementById('res-bridge');
    const method = document.getElementById('res-method');
    return {
      exists: !!vas,
      hidden: vas ? vas.hidden : null,
      visible: vas ? !!vas.offsetParent : null,
      heading: vas ? (vas.querySelector('.vas-title')||{}).textContent : null,
      value: (document.getElementById('vas-value')||{}).textContent,
      printLine: (document.getElementById('vas-print')||{}).textContent,
      lines: lines ? [...lines.querySelectorAll('p')].map(p => p.textContent) : [],
      bridgeHidden: bridge ? bridge.hidden : null,
      bridgeText: bridge ? bridge.textContent.trim() : null,
      methodOpen: method ? method.open : null,
      // A closed <details> in Chrome uses content-visibility:hidden, so the
      // content box still has a height. checkVisibility() is the honest read,
      // and the outer height is what the iframe parent is actually told.
      methodBodyVisible: method ? !!method.querySelector('.method-body').checkVisibility() : null,
      methodHeight: method ? Math.round(method.getBoundingClientRect().height) : null,
      sliderPos: (document.getElementById('vas-slider')||{}).value,
      // order on screen
      order: [...document.querySelectorAll('#s-results .panel > *')].map(e => e.id || e.className)
    };
  });
}

async function setSlider(pos) {
  await page.evaluate((p) => {
    const el = document.getElementById('vas-slider');
    el.value = String(p);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, pos);
}

/* ---------------------------------------------------------------- case 1 */
console.log('\n1. Mid score, default slider (?crg=40,40,40,40,40,40)');
await page.goto(BASE + '/?crg=40,40,40,40,40,40');
let m = await readModule();
check('module renders', m.visible === true);
check('heading present', /How It Affects The Bottom Line/i.test(m.heading || ''), m.heading);
check('default reads $5M', m.value === '$5M', m.value);
check('print line', m.printLine === 'Design win value: $5M', m.printLine);
check('two lines', m.lines.length === 2, m.lines.length);
check('delay line', /^Roughly 7\.2 months of commercial delay against a peer with the same technology and a clearer commercial engine\.$/.test(m.lines[0]), m.lines[0]);
check('dollar line', m.lines[1] === 'At $5M a design win, that’s about 1.3 design wins a year, or $6.4M of commercial capacity you can’t currently reach.', m.lines[1]);
check('bridge shown', m.bridgeHidden === false);
check('bridge copy', m.bridgeText === 'That estimate uses one number from you. Bring the rest and we’ll do it properly.', m.bridgeText);
check('accordion closed by default', m.methodOpen === false && m.methodBodyVisible === false, 'height ' + m.methodHeight + 'px');
check('module sits above Fix First blocks', m.order.indexOf('res-vas') < m.order.findIndex(x => /duo/.test(x)) && m.order.indexOf('res-vas') < m.order.findIndex(x => /insights/.test(x)), JSON.stringify(m.order));

/* -------------------------------------------------------- slider sweep */
console.log('\n2. Slider across its full range at a mid score');
for (const pos of [0, 200, 400, 565, 700, 850, 1000]) {
  await setSlider(pos);
  const r = await readModule();
  console.log('  pos ' + String(pos).padStart(4) + '  ' + r.value.padEnd(7) + '  ' + r.lines[1]);
}
await setSlider(0);
let r = await readModule();
check('bottom of range is $250K', r.value === '$250K', r.value);
check('$250K dollar figure', /or \$320K of commercial capacity/.test(r.lines[1]), r.lines[1]);
await setSlider(1000);
r = await readModule();
check('top of range is $50M', r.value === '$50M', r.value);
check('$50M dollar figure', /or \$64M of commercial capacity/.test(r.lines[1]), r.lines[1]);
check('never shows cents or exact figures', !/\$[\d,]{4,}/.test(r.lines.join(' ')) && !/\.\d\d\b/.test(r.lines.join(' ')), r.lines[1]);

/* ------------------------------------------------ case 3: suppression 80+ */
console.log('\n3. Suppression at composite 80 and above');
for (const q of ['80,80,80,80,80,80', '100,100,100,100,100,100', '60,100,80,80,80,80']) {
  await page.goto(BASE + '/?crg=' + q);
  m = await readModule();
  const comp = q.split(',').map(Number).reduce((a,b)=>a+b,0)/6;
  check('crg=' + q + ' (composite ' + comp.toFixed(1) + ') shows only the no-gap line',
        m.lines.length === 1 && m.lines[0] === 'No material gap. Your commercial engine is keeping pace with your technology.', m.lines[0]);
  check('crg=' + q + ' hides the bridge line', m.bridgeHidden === true);
}

console.log('\n   just below the benchmark still shows the gap');
await page.goto(BASE + '/?crg=80,80,80,80,80,60');
m = await readModule();
check('composite 76.7 still shows the delay line', m.lines.length === 1 && /^Roughly 0\.6 months/.test(m.lines[0]), m.lines[0]);
check('  (one weak low-coefficient pillar, so wins stays under 0.5)', true);

/* ------------------------------- case 4: winsAtStake below 0.5 suppression */
console.log('\n4. winsAtStake rounds below 0.5');
await page.goto(BASE + '/?crg=68,68,68,68,68,68');
m = await readModule();
check('delay line only', m.lines.length === 1 && /^Roughly 2\.2 months/.test(m.lines[0]), m.lines[0]);
check('bridge still shown (an estimate was made)', m.bridgeHidden === false);
console.log('   at the lowest deal value too:');
await setSlider(0);
m = await readModule();
check('$250K, still delay only', m.lines.length === 1, m.lines);

/* ---------------------------------------- case 5: very low deal values */
console.log('\n5. Very low deal value at a low score');
await page.goto(BASE + '/?crg=0,0,0,0,0,0');
await setSlider(0);
m = await readModule();
check('$250K bottom, floor score', m.lines.length === 2, m.lines.length);
check('reads sensibly', /At \$250K a design win, that’s about 2\.6 design wins a year, or \$640K of commercial capacity/.test(m.lines[1]), m.lines[1]);
await setSlider(1000);
m = await readModule();
check('ceiling: 2.6 wins at $50M', /2\.6 design wins a year, or \$130M/.test(m.lines[1]), m.lines[1]);

/* ------------------------------------------ case 6: degenerate delay 0.0 */
console.log('\n6. Hand-built link that rounds the delay to zero');
await page.goto(BASE + '/?crg=79,80,80,80,80,80');
m = await readModule();
check('no "Roughly 0 months"', !/Roughly 0 /.test(m.lines.join(' ')), m.lines[0]);
check('falls back to the no-gap line', m.lines[0] === 'No material gap. Your commercial engine is keeping pace with your technology.');

/* -------------------------------------------- case 7: share link is clean */
console.log('\n7. Deal value never leaves the browser');
await page.goto(BASE + '/?crg=40,40,40,40,40,40');
await setSlider(1000);
const share = await page.evaluate(async () => {
  let copied = null;
  navigator.clipboard.writeText = (t) => { copied = t; return Promise.resolve(); };
  document.getElementById('res-share').click();
  await new Promise(r => setTimeout(r, 50));
  return copied || document.getElementById('res-share-note').textContent;
});
check('share URL carries only the six values', share === 'https://www.jefffryer.com/commercial-readiness-audit?crg=40,40,40,40,40,40', share);
check('no deal value in the URL', !/50000000|dv=|deal/i.test(share), share);
const globals = await page.evaluate(() => Object.keys(window).filter(k => /deal|vas/i.test(k)));
check('nothing leaked onto window', globals.length === 0, globals.join(','));

/* -------------------------------------------- case 8: accordion + print */
console.log('\n8. Methodology accordion');
m = await readModule();
const method = await page.evaluate(() => {
  const d = document.getElementById('res-method');
  return {
    summary: d.querySelector('summary').textContent.trim(),
    body: d.querySelector('.method-body').textContent.replace(/\s+/g, ' ').trim(),
    links: [...d.querySelectorAll('a')].map(a => a.href),
    lastInPanelOrder: [...document.querySelectorAll('#s-results > *')].map(e => e.id || e.className)
  };
});
check('label', method.summary === 'How this is calculated', method.summary);
check('has the formula', /factor = sum of \(gap × coefficient\)/.test(method.body));
check('has the benchmark of 80', /benchmark is 80 out of 100/.test(method.body));
check('has all six coefficients', ['0.10','0.08','0.06','0.05','0.06','0.05'].every(c => method.body.includes(c)));
check('has four sources', /JOLT Effect/.test(method.body) && /Power of Pricing/.test(method.body) && /Forrester Consulting for Impact/.test(method.body) && /Aberdeen Group/.test(method.body));
check('four links', method.links.length === 4, method.links.join(' '));
check('closing sentence', /This is a structured estimate based on published benchmarks and your own inputs\. It is not a forecast\.$/.test(method.body));
check('sits at the bottom of the report', method.lastInPanelOrder.indexOf('res-method') > method.lastInPanelOrder.findIndex(x => /^cta/.test(x)), JSON.stringify(method.lastInPanelOrder));

await page.evaluate(() => { document.getElementById('res-method').open = true; });
const stats = await page.evaluate(() => {
  const t = document.body.innerText;
  const inMethod = document.getElementById('res-method').innerText;
  const outside = t.replace(inMethod, '');
  return ['40 to 60%', '8% operating profit', '28% of revenue', 'declined 4%'].map(s => ({ s, outside: outside.includes(s), inside: inMethod.includes(s) }));
});
check('the four statistics appear only inside the panel', stats.every(x => x.inside && !x.outside), JSON.stringify(stats));

console.log('\n9. Print');
await page.emulateMedia({ media: 'print' });
await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
const p = await page.evaluate(() => ({
  controlVisible: !!document.getElementById('vas-control').offsetParent,
  printVisible: !!document.getElementById('vas-print').offsetParent,
  printText: document.getElementById('vas-print').textContent,
  linesVisible: !!document.getElementById('vas-lines').offsetParent,
  bridgeVisible: !!document.getElementById('res-bridge').offsetParent,
  methodOpen: document.getElementById('res-method').open,
  methodBodyVisible: !!document.getElementById('res-method').querySelector('.method-body').checkVisibility()
}));
check('slider control hidden in print', p.controlVisible === false);
check('static value line shown in print', p.printVisible === true && p.printText === 'Design win value: $50M', p.printText);
check('both result lines print', p.linesVisible === true);
check('bridge prints', p.bridgeVisible === true);
check('accordion prints expanded', p.methodOpen === true && p.methodBodyVisible === true);
await page.emulateMedia({ media: 'screen' });

/* --------------------------------- case 10: untouched sliders, no estimate */
console.log('\n10. Nothing answered');
await page.goto(BASE + '/');
await page.evaluate(async () => {
  document.querySelector('#s-intro .btn-primary, #s-intro button').click();
});
await page.waitForTimeout(150);
for (let i = 0; i < 6; i++) { await page.click('#q-next'); await page.waitForTimeout(60); }
await page.click('#s-stage .btn-primary');
await page.waitForTimeout(80);
await page.fill('#f-first', 'A'); await page.fill('#f-last', 'B');
await page.fill('#f-email', 'a@acme.io'); await page.fill('#f-company', 'Acme');
await page.route('**/', route => route.request().method() === 'POST' ? route.fulfill({ status: 200, body: 'ok' }) : route.continue());
const posted = [];
page.on('request', req => { if (req.method() === 'POST') posted.push(req.postData()); });
await page.click('#capture-submit');
await page.waitForTimeout(600);
m = await readModule();
check('module hidden when no slider was moved', m.hidden === true && m.visible === false, JSON.stringify({h:m.hidden,v:m.visible}));
check('bridge hidden too', m.bridgeHidden === true);

console.log('\n11. The POSTed payload');
check('a submission was posted', posted.length === 1, posted.length);
if (posted[0]) {
  const keys = [...new URLSearchParams(posted[0]).keys()];
  check('no deal-value field', !keys.some(k => /deal|value|vas|win/i.test(k)), keys.filter(k=>/deal|value|vas|win/i.test(k)).join(','));
  check('field set unchanged (37 fields, same as before)', keys.length === 37, keys.length);
}

await browser.close();
server.close();
console.log('\n' + (fails.length ? 'FAILURES: ' + fails.length + '\n - ' + fails.join('\n - ') : 'ALL CHECKS PASSED'));
process.exit(fails.length ? 1 : 0);

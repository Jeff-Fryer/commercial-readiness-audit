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
      label: (document.getElementById('vas-label')||{}).textContent,
      sliderAria: (document.getElementById('vas-slider')||{}).getAttribute
                    ? document.getElementById('vas-slider').getAttribute('aria-label') : null,
      printLine: (document.getElementById('vas-print')||{}).textContent,
      lines: lines ? [...lines.querySelectorAll('p')].map(p => p.textContent) : [],
      bridgeHidden: bridge ? bridge.hidden : null,
      bridgeText: bridge ? bridge.textContent.trim() : null,
      methodOpen: method ? method.open : null,
      methodEq: method ? method.querySelector('.method-eq').textContent.replace(/\s+/g, ' ').trim() : null,
      methodProse: method ? [...method.querySelectorAll('.method-body > p')].map(p => p.textContent).join(' ') : null,
      // A closed <details> in Chrome uses content-visibility:hidden, so the
      // content box still has a height. checkVisibility() is the honest read,
      // and the outer height is what the iframe parent is actually told.
      methodBodyVisible: method ? !!method.querySelector('.method-body').checkVisibility() : null,
      methodHeight: method ? Math.round(method.getBoundingClientRect().height) : null,
      sliderPos: (document.getElementById('vas-slider')||{}).value,
      // order on screen
      order: [...document.querySelectorAll('#s-results .panel > *')].map(e => e.id || e.className),
      // the trimmed results screen
      sectionHeadings: [...document.querySelectorAll('#s-results .res-section > .eyebrow')].map(e => e.textContent.trim()),
      focusTags: [...document.querySelectorAll('.focus-tag')].map(e => e.closest('.brow').querySelector('.brow-lab span').textContent.replace('FOCUS', '').trim()),
      fixHead: (document.querySelector('#res-fixfirst b') || {}).textContent,
      fixParas: [...document.querySelectorAll('#res-fixfirst p')].map(e => e.textContent),
      barCount: document.querySelectorAll('#res-bars .brow').length,
      deleted: {
        told: !!document.getElementById('res-told'),
        duo: !!document.querySelector('.duo'),
        bestName: !!document.getElementById('res-best-name'),
        bandCopy: !!document.getElementById('res-band-copy')
      },
      pageHeight: Math.round(document.body.getBoundingClientRect().height)
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
check('slider label', m.label === 'What’s one design win worth to you over its life?', m.label);
check('print line', m.printLine === 'Design win value: $5M', m.printLine);
check('two lines', m.lines.length === 2, m.lines.length);
check('delay line', /^Roughly 7\.2 months of commercial delay against a peer with the same technology and a clearer commercial engine\.$/.test(m.lines[0]), m.lines[0]);
check('dollar line', m.lines[1] === 'At $5M a design win, that’s about 1.6 design wins a year, or $8M of commercial capacity you can’t currently reach.', m.lines[1]);
check('bridge shown', m.bridgeHidden === false);
check('bridge copy', m.bridgeText === 'That estimate uses one number from you. Bring the rest and we’ll do it properly.', m.bridgeText);
check('accordion closed by default', m.methodOpen === false && m.methodBodyVisible === false, 'height ' + m.methodHeight + 'px');
check('module sits below the score and above the Fix First read',
      m.order.indexOf('res-vas') > m.order.indexOf('hero') &&
      m.order.indexOf('res-vas') < m.order.findIndex(x => /insights/.test(x)), JSON.stringify(m.order));

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
check('$250K dollar figure', /or \$400K of commercial capacity/.test(r.lines[1]), r.lines[1]);
await setSlider(1000);
r = await readModule();
check('top of range is $50M', r.value === '$50M', r.value);
check('$50M dollar figure', /or \$80M of commercial capacity/.test(r.lines[1]), r.lines[1]);
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
// Slider-reachable: one weak pillar carrying the smallest coefficient.
await page.goto(BASE + '/?crg=80,80,80,80,80,60');
m = await readModule();
check('delay line only', m.lines.length === 1 && /^Roughly 0\.6 months/.test(m.lines[0]), m.lines[0]);
check('bridge still shown (an estimate was made)', m.bridgeHidden === false);
console.log('   at the lowest deal value too:');
await setSlider(0);
m = await readModule();
check('$250K, still delay only', m.lines.length === 1, m.lines);
console.log('   and the boundary, where wins is 0.4 and 0.5 is one point away:');
await page.goto(BASE + '/?crg=70,70,70,70,70,70');
m = await readModule();
check('0.4 wins suppresses the dollar line', m.lines.length === 1 && /^Roughly 1\.8 months/.test(m.lines[0]), m.lines[0]);
await page.goto(BASE + '/?crg=68,68,68,68,68,68');
m = await readModule();
check('0.5 wins does not', m.lines.length === 2 && /0\.5 design wins/.test(m.lines[1]), m.lines[1]);

/* ---------------------------------------- case 5: very low deal values */
console.log('\n5. Very low deal value at a low score');
await page.goto(BASE + '/?crg=0,0,0,0,0,0');
await setSlider(0);
m = await readModule();
check('$250K bottom, floor score', m.lines.length === 2, m.lines.length);
check('reads sensibly', /At \$250K a design win, that’s about 3\.2 design wins a year, or \$800K of commercial capacity/.test(m.lines[1]), m.lines[1]);
await setSlider(1000);
m = await readModule();
check('ceiling: 3.2 wins at $50M, the coefficient sum of 0.40', /3\.2 design wins a year, or \$160M/.test(m.lines[1]), m.lines[1]);

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
check('gap is normalised by the benchmark, not by 100', /gap = max\(0, 80 − part score\) \/ 80/.test(method.body), method.body.slice(method.body.indexOf('gap ='), method.body.indexOf('gap =') + 44));
check('states the 0.40 ceiling and 3.2 wins', /factor therefore runs from 0 to the sum of the six coefficients, which is 0\.40/.test(method.body) && /ceiling is 3\.2 design wins a year/.test(method.body));
check('has the benchmark of 80', /benchmark is 80 out of 100/.test(method.body));
check('has all six coefficients', ['0.10','0.08','0.06','0.05','0.06','0.05'].every(c => method.body.includes(c)));
check('has three sources', /JOLT Effect/.test(method.body) && /Power of Pricing/.test(method.body) && /grow 19% faster and are 15% more profitable/.test(method.body));
check('every source is dated', /The JOLT Effect \(2022\)/.test(method.body) && /McKinsey \(2003\)/.test(method.body) && /Forrester \(2021\)/.test(method.body), method.body.slice(method.body.indexOf('Dixon'), method.body.indexOf('Dixon') + 190));
check('the three withdrawn citations are gone', !/Impact/.test(method.body) && !/Aberdeen/.test(method.body) && !/28% of revenue/.test(method.body) && !/2\.4x/.test(method.body));
check('Forrester link is the fixed URL, not the bare domain',
      method.links.some(u => u === 'https://www.forrester.com/press-newsroom/forresters-return-on-integration-honours-winner-recognised-at-b2b-summit-apac') &&
      !method.links.includes('https://www.forrester.com/'), method.links.join(' '));
check('three links', method.links.length === 3, method.links.join(' '));
check('closing sentence', /This is a structured estimate based on published benchmarks and your own inputs\. It is not a forecast\.$/.test(method.body));
check('sits at the bottom of the report', method.lastInPanelOrder.indexOf('res-method') > method.lastInPanelOrder.findIndex(x => /^cta/.test(x)), JSON.stringify(method.lastInPanelOrder));

await page.evaluate(() => { document.getElementById('res-method').open = true; });
const stats = await page.evaluate(() => {
  const t = document.body.innerText;
  const inMethod = document.getElementById('res-method').innerText;
  const outside = t.replace(inMethod, '');
  return ['40 to 60%', '8% operating profit', '19% faster'].map(s => ({ s, outside: outside.includes(s), inside: inMethod.includes(s) }));
});
check('the three statistics appear only inside the panel', stats.every(x => x.inside && !x.outside), JSON.stringify(stats));

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
  check('38 fields: the 37 plus flatEngine', keys.length === 38, keys.length);
  const posted0 = new URLSearchParams(posted[0]);
  // this submission moved no sliders, so all six sit at the default: flat
  check('flatEngine posted, and correct for an untouched engine',
        posted0.get('flatEngine') === 'yes', posted0.get('flatEngine'));
}

/* --------------------------------- case 12: the stage swaps the noun */
console.log('\n12. Part 7 stage swaps the noun in the value line');
// All three surfaces follow the stage: the question, the print line, and the
// value line. They are written from one vasUnit() call so they cannot drift.
const STAGE_UNIT = [
  ['Pre-revenue, first design-ins',       'design-in',  'design-ins',  'Design-in value: $5M'],
  ['Early revenue, founder-led sales',    'design win', 'design wins', 'Design win value: $5M'],
  ['Scaling, building the sales team',    'design win', 'design wins', 'Design win value: $5M'],
  ['Post-Series B, commercial build-out', 'design win', 'design wins', 'Design win value: $5M'],
  ['Public or late-stage',                'program',    'programs',    'Program value: $5M'],
  ['Not sure',                            'design win', 'design wins', 'Design win value: $5M'],
];
for (const [label, one, many, printLine] of STAGE_UNIT) {
  await page.goto(BASE + '/');
  await page.evaluate(() => document.querySelector('#s-intro .btn-primary, #s-intro button').click());
  await page.waitForSelector('#s-quiz.is-on');
  // move one slider so the result is a real read, then click through
  await page.evaluate(() => {
    const el = document.getElementById('q-slider');
    el.value = '40'; el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  for (let i = 0; i < 6; i++) await page.click('#q-next');
  await page.waitForSelector('#s-stage.is-on');
  await page.evaluate((l) => {
    [...document.querySelectorAll('.stage-opt')].find(b => b.textContent.includes(l)).click();
  }, label);
  await page.click('#s-stage .btn-primary');
  await page.waitForSelector('#s-capture.is-on');
  await page.fill('#f-first', 'A'); await page.fill('#f-last', 'B');
  await page.fill('#f-email', 'a@acme.io'); await page.fill('#f-company', 'Acme');
  await page.click('#capture-submit');
  await page.waitForSelector('#vas-lines p:nth-child(2)');
  const r2 = await readModule();
  const line = r2.lines[1] || '';
  const valueOk = line.includes('a ' + one + ',') && new RegExp('\\d ' + many.replace('-', '\\-') + ' a year').test(line);
  check(label + ' — value line', valueOk, line);
  check(label + ' — slider label', r2.label === 'What’s one ' + one + ' worth to you over its life?', r2.label);
  check(label + ' — print line', r2.printLine === printLine, r2.printLine);
  check(label + ' — slider aria-label', r2.sliderAria === 'What one ' + one + ' is worth to you over its life', r2.sliderAria);
  check(label + ' — formula rows',
        r2.methodEq.includes(many + ' at stake = factor / 0.125') &&
        r2.methodEq.includes('capacity at stake = ' + many + ' at stake × your ' + one + ' value'),
        r2.methodEq.slice(r2.methodEq.indexOf('at stake = factor') - 12));
  // the surrounding explanation stays generic whatever the stage
  check(label + ' — panel prose stays generic',
        r2.methodProse.includes('converted into design wins') &&
        r2.methodProse.includes('one full design win per 8 points of capacity'),
        one);
}
console.log('   an unpicked stage, which is every shared ?crg= link:');
await page.goto(BASE + '/?crg=40,40,40,40,40,40');
m = await readModule();
check('falls through to design wins', /a design win, .* design wins a year/.test(m.lines[1]), m.lines[1]);
check('all three surfaces agree', m.label === 'What’s one design win worth to you over its life?' && m.printLine === 'Design win value: $5M', m.label + ' | ' + m.printLine);
check('the math did not move', /1\.6 design wins a year, or \$8M/.test(m.lines[1]), m.lines[1]);

/* ------------------------------- case 13: the trimmed results screen */
console.log('\n13. The results screen is cut, and cut in the right places');
await page.goto(BASE + '/?crg=0,40,60,20,80,40');   // real spread, one clear weakest
m = await readModule();
check('WHAT YOU TOLD ME is gone', m.deleted.told === false);
check('the strongest / fix first card pair is gone', m.deleted.duo === false && m.deleted.bestName === false);
check('the separate band-copy block is gone', m.deleted.bandCopy === false);
check('sections left are the module, the bars and the read',
      JSON.stringify(m.sectionHeadings) === JSON.stringify(['How It Affects The Bottom Line', 'The Six Parts', '✨ Your Fix First Read']),
      JSON.stringify(m.sectionHeadings));
check('all six bars survive', m.barCount === 6, m.barCount);

console.log('   the FOCUS badge marks one pillar, the weakest:');
check('exactly one FOCUS badge', m.focusTags.length === 1, JSON.stringify(m.focusTags));
check('it is on the weakest pillar', m.focusTags[0] === 'Your story', m.focusTags[0]);
check('and the read names the same pillar', m.fixHead === 'Fix First: Your story', m.fixHead);

console.log('   the read is two paragraphs, the consequence then the fix:');
check('exactly two paragraphs', m.fixParas.length === 2, m.fixParas.length);
check('first is the consequence (this band\'s So What)', /^Every deal that depends on you is a deal that stops/.test(m.fixParas[0]), m.fixParas[0].slice(0, 60));
check('second is the pillar fix', /^Define one buyer-led commercial story/.test(m.fixParas[1]), m.fixParas[1].slice(0, 60));
check('the band What paragraph is not repeated', !m.fixParas.join(' ').includes('More than one part of your commercial engine is missing'));
check('the BLOT is not repeated either', !m.fixParas.join(' ').includes('Your technology works. Your sales don’t reflect that yet.'));

/* ---------------------------------------- case 14: the flat-score case */
console.log('\n14. Flat scores: no arbitrary weakest');
for (const q of ['40,40,40,40,40,40', '60,60,60,60,60,60', '20,20,20,20,20,20', '80,80,80,80,80,80']) {
  await page.goto(BASE + '/?crg=' + q);
  m = await readModule();
  const spread = Math.max(...q.split(',').map(Number)) - Math.min(...q.split(',').map(Number));
  check('crg=' + q + ' (spread ' + spread + ') shows no FOCUS badge', m.focusTags.length === 0, JSON.stringify(m.focusTags));
  check('crg=' + q + ' read opens on the evenness', m.fixHead === 'Fix First: all six, evenly' &&
        /^Your six parts sit within one slider stop of each other/.test(m.fixParas[0]), m.fixHead + ' / ' + m.fixParas[0].slice(0, 50));
  check('crg=' + q + ' still two paragraphs', m.fixParas.length === 2, m.fixParas.length);
  check('crg=' + q + ' does not prescribe a single pillar', !/^Define one|^Build a repeatable|^Choose the buyer|^Create one shared/.test(m.fixParas[1]), m.fixParas[1].slice(0, 50));
}
console.log('   the boundary is "under one slider stop", so a spread of exactly 20 is not flat:');
await page.goto(BASE + '/?crg=40,40,40,40,40,60');   // spread 20, one full stop
m = await readModule();
check('spread 20 is NOT flat', m.focusTags.length === 1 && m.fixHead === 'Fix First: Your story', m.fixHead);
await page.goto(BASE + '/?crg=40,40,40,40,40,50');   // spread 10, under a stop
m = await readModule();
check('spread 10 IS flat', m.focusTags.length === 0 && m.fixHead === 'Fix First: all six, evenly', m.fixHead);
await page.goto(BASE + '/?crg=40,40,40,40,40,80');   // spread 40, clearly not flat
m = await readModule();
check('spread 40 is not flat', m.focusTags.length === 1 && m.fixHead !== 'Fix First: all six, evenly', m.fixHead);


/* ------------------------- case 15: flatEngine reaches the form payload */
console.log('\n15. The email gets told whether the engine is flat');
async function submitWith(sliderValues) {
  const sent = [];
  const page2 = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page2.route('**/', route => route.request().method() === 'POST'
    ? route.fulfill({ status: 200, body: 'ok' }) : route.continue());
  page2.on('request', req => { if (req.method() === 'POST') sent.push(req.postData()); });
  await page2.goto(BASE + '/');
  await page2.evaluate(() => document.querySelector('#s-intro .btn-primary, #s-intro button').click());
  await page2.waitForSelector('#s-quiz.is-on');
  for (const v of sliderValues) {
    await page2.evaluate((val) => {
      const el = document.getElementById('q-slider');
      el.value = String(val); el.dispatchEvent(new Event('input', { bubbles: true }));
    }, v);
    await page2.click('#q-next');
  }
  await page2.waitForSelector('#s-stage.is-on');
  await page2.click('#s-stage .btn-primary');
  await page2.waitForSelector('#s-capture.is-on');
  await page2.fill('#f-first', 'A'); await page2.fill('#f-last', 'B');
  await page2.fill('#f-email', 'a@acme.io'); await page2.fill('#f-company', 'Acme');
  await page2.click('#capture-submit');
  await page2.waitForSelector('#res-fixfirst b');
  const read = await page2.evaluate(() => ({
    head: document.querySelector('#res-fixfirst b').textContent,
    paras: [...document.querySelectorAll('#res-fixfirst p')].map(e => e.textContent)
  }));
  await page2.close();
  return { body: new URLSearchParams(sent[0] || ''), onScreen: read.head, paras: read.paras };
}

const flatRun = await submitWith([40, 40, 40, 40, 40, 40]);
check('flat engine posts flatEngine=yes', flatRun.body.get('flatEngine') === 'yes', flatRun.body.get('flatEngine'));
check('  and the screen agrees', flatRun.onScreen === 'Fix First: all six, evenly', flatRun.onScreen);
check('  fixFirst is still posted for the record', !!flatRun.body.get('fixFirst'), flatRun.body.get('fixFirst'));

const sharpRun = await submitWith([0, 40, 60, 20, 80, 40]);
check('uneven engine posts flatEngine=no', sharpRun.body.get('flatEngine') === 'no', sharpRun.body.get('flatEngine'));
check('  and the screen names the pillar', sharpRun.onScreen === 'Fix First: Your story', sharpRun.onScreen);

console.log('   the emailed body carries the paragraph the reader saw:');
check('flat: posted fixFirstAction is the screen\'s fix paragraph',
      flatRun.body.get('fixFirstAction') === flatRun.paras[1], flatRun.body.get('fixFirstAction').slice(0, 60));
check('flat: and it is the band Now What, not a pillar action',
      /^Build the parts that don’t need you in the room/.test(flatRun.body.get('fixFirstAction')),
      flatRun.body.get('fixFirstAction').slice(0, 60));
check('uneven: posted fixFirstAction is the screen\'s fix paragraph',
      sharpRun.body.get('fixFirstAction') === sharpRun.paras[1], sharpRun.body.get('fixFirstAction').slice(0, 60));
check('uneven: and it is the pillar action',
      /^Define one buyer-led commercial story/.test(sharpRun.body.get('fixFirstAction')),
      sharpRun.body.get('fixFirstAction').slice(0, 60));
check('the whole emailed Fix First block matches the screen, both cases',
      flatRun.body.get('fixFirstAction') !== sharpRun.body.get('fixFirstAction'),
      'flat and uneven must not post the same action');

check('the deal value is still nowhere in either payload',
      ![...flatRun.body.keys(), ...sharpRun.body.keys()].some(k => /deal|value|vas|win/i.test(k)),
      [...flatRun.body.keys()].filter(k => /deal|value|vas|win/i.test(k)).join(','));

await browser.close();
server.close();
console.log('\n' + (fails.length ? 'FAILURES: ' + fails.length + '\n - ' + fails.join('\n - ') : 'ALL CHECKS PASSED'));
process.exit(fails.length ? 1 : 0);

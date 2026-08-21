// Stands up two origins on localhost so the iframe boundary in the test is a
// real cross-origin boundary, the way it is in production. Same-document tests
// would pass even if postMessage were broken.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const APP_PORT = 8788;   // stands in for jf-commercial-readiness.netlify.app
const SITE_PORT = 8789;  // stands in for www.jefffryer.com

const APP_ORIGIN = `http://127.0.0.1:${APP_PORT}`;
const SITE_ORIGIN = `http://127.0.0.1:${SITE_PORT}`;

// --- the app origin: the real index.html, with the parent allowlist widened to
// the test origin. This is the only patch, and it is the production file
// otherwise, so the crg parsing and the height reporter under test are real.
let app = fs.readFileSync(path.join(REPO, 'function/public/index.html'), 'utf8');
const allowlistAnchor = "'https://jefffryer.squarespace.com'";
if (!app.includes(allowlistAnchor)) throw new Error('EMBED_PARENTS anchor missing');
app = app.replace(allowlistAnchor, `${allowlistAnchor},\n    '${SITE_ORIGIN}'`);

// --- the site origin: the real Code Block, with the Netlify origin swapped for
// the local app origin, wrapped in the kind of page Squarespace renders around
// a Code Block (a heading and padding above it, so scrollIntoView has somewhere
// to scroll from).
let block = fs.readFileSync(path.join(REPO, 'frontend/squarespace-embed-code-block.html'), 'utf8');
const NETLIFY = 'https://jf-commercial-readiness.netlify.app';
if (!block.includes(NETLIFY)) throw new Error('netlify origin missing from code block');
block = block.split(NETLIFY).join(APP_ORIGIN);

const page = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Commercial Readiness Audit &mdash; Jeff Fryer</title></head>
<body style="margin:0;font-family:sans-serif">
<div style="height:600px;padding:40px;background:#eee"><h1>Commercial Readiness Audit</h1>
<p>Squarespace section above the Code Block, so the frame starts off screen.</p></div>
${block}
<div style="height:400px;padding:40px;background:#eee"><p>Footer section below.</p></div>
</body></html>`;

function serve(port, routes) {
  return new Promise((res) => {
    const s = http.createServer((req, rq) => {
      const p = req.url.split('?')[0];
      const body = routes[p] ?? routes['/'];
      if (body === undefined) { rq.writeHead(404); return rq.end('nope'); }
      rq.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      rq.end(body);
    });
    s.listen(port, '127.0.0.1', () => res(s));
  });
}

const servers = await Promise.all([
  serve(APP_PORT, { '/': app }),
  serve(SITE_PORT, { '/commercial-readiness-audit': page, '/': page }),
]);

export { APP_ORIGIN, SITE_ORIGIN, servers };

/**
 * COMMERCIAL READINESS — BUYER-FACING EVIDENCE CHECK
 * =================================================
 *
 * Accepts a company homepage URL, fetches the public page, and scores it against
 * the 40 criteria in WEBSITE_RUBRIC. Returns a `websiteSignals` object shaped
 * exactly as `scoreCommercialReadiness()` expects.
 *
 * The single most important rule, from the rubric itself:
 *   1    = public positive evidence observed
 *   0    = relevant material was extracted and it contradicts the criterion
 *   null = not applicable, or not extractable
 * Missing evidence is NEVER 0. A null keeps a pillar out of the comparison;
 * a wrong 0 silently penalises the company.
 *
 * Scope note: we read the homepage only. The rubric also permits evidence on a
 * first-level public resource clearly linked from the homepage, so we pass the
 * model a map of link text -> href. That covers criteria asking whether a path is
 * *visible* (a distributor locator, a design-support route). Criteria that would
 * need the linked page's contents score null, not 0 — conservative by design.
 */

import Anthropic from "@anthropic-ai/sdk";
import { getStore } from "@netlify/blobs";
import { promises as dns } from "node:dns";
import type { Config, Context } from "@netlify/functions";

/* ---------------------------------------------------------------- tuning --- */

const PAGE_FETCH_TIMEOUT_MS = 4_000;
const LLM_TIMEOUT_MS = 15_000;
const MAX_PAGE_BYTES = 1_500_000;
const MAX_EXTRACT_CHARS = 40_000;
const MAX_LINKS = 150;
const MAX_REDIRECTS = 3;

const RATE_PER_IP_PER_HOUR = 5;
const RATE_GLOBAL_PER_DAY = 200;

const DEFAULT_ALLOWED_ORIGINS = [
  "https://jefffryer.com",
  "https://www.jefffryer.com",
];

/* ------------------------------------------------- the 40 rubric criteria --- */
/* Names copied verbatim from WEBSITE_RUBRIC in commercial_readiness_assessment_final.js.
   Weights live client-side in the engine; the function only needs the keys. */

const RUBRIC: Record<string, string[]> = {
  story: [
    "targetApplicationOrUseCaseNamed",
    "targetBuyerOrDesignRoleNamed",
    "buyerRelevantOutcomeNamed",
    "technologyTranslatedToSystemValue",
    "categoryOrCompetitiveAlternativeNamed",
    "productOrCapabilityFamilyNavigable",
    "technicalProofAccessible",
    "designOrCustomerEvidenceAccessible",
    "messageUnderstandableBeforeTechnicalDetail",
    "commercialOrTechnicalNextStepClear",
  ],
  sell: [
    "appropriateEntryPathClear",
    "requestPathMatchesOfferingType",
    "productOrCapabilitySelectionPathExists",
    "applicationNotesOrReferenceDesignsAccessible",
    "dataSheetsOrTechnicalDocumentationAccessible",
    "designSupportOrFAEPathVisible",
    "evaluationOrFeasibilityPathExplainedWhenRelevant",
    "quoteOrCommercialConversationRouteVisible",
    "distributorOrRepresentativeRouteVisibleWhenRelevant",
    "nextStepExplainsWhatHappensNext",
  ],
  charge: [
    "quoteRequestPathVisible",
    "commercialEngagementModelNamedWhenRelevant",
    "scopeBoundaryOrEngagementDeliverableNamed",
    "buyerValueOrEconomicImpactNamed",
    "procurementOrSourcingRouteVisibleWhenRelevant",
    "availabilityOrLeadTimeRouteVisibleWhenRelevant",
    "distributorPurchaseRouteVisibleWhenRelevant",
    "customWorkOrNREPathExplainedWhenRelevant",
    "qualificationOrCommercialCommitmentPathExplainedWhenRelevant",
    "buyerCanIdentifyAppropriateCommercialNextStep",
  ],
  partnerships: [
    "routeToMarketPartnerTypeNamed",
    "partnerFinderOrTerritoryRouteVisibleWhenRelevant",
    "distributorOrRepresentativeLocatorVisibleWhenRelevant",
    "designOrImplementationPartnerPathVisibleWhenRelevant",
    "ecosystemOrComplementarySolutionValueExplained",
    "jointSolutionOrReferenceArchitectureEvidenceVisible",
    "partnerEnablementOrEngagementPathVisible",
    "partnerContactRouteVisible",
    "partnerRoleInBuyerAccessClear",
    "partnerProofVisibleWithoutRequiringNamedLogos",
  ],
};

/* --------------------------------------------------------- output schema --- */

function buildSchema() {
  const pillar = (keys: string[]) => ({
    type: "object",
    properties: Object.fromEntries(
      keys.map((k) => [
        k,
        { anyOf: [{ type: "integer", enum: [0, 1] }, { type: "null" }] },
      ]),
    ),
    required: keys,
    additionalProperties: false,
  });

  return {
    type: "object",
    properties: Object.fromEntries(
      Object.entries(RUBRIC).map(([name, keys]) => [name, pillar(keys)]),
    ),
    required: Object.keys(RUBRIC),
    additionalProperties: false,
  };
}

/* ---------------------------------------------------------------- prompt --- */

const SYSTEM_PROMPT = `You assess the public homepage of a semiconductor or deep-tech company against a fixed rubric, on behalf of a fractional CMO practice advising the company's CEO.

You are judging one thing only: what commercial story a first-time buyer can actually see on the public site. You are not judging the technology, the company's quality, or website design.

SCORING VALUES — this is the most important instruction in this prompt.
For each criterion return exactly one of:
  1     public positive evidence for the criterion was observed
  0     relevant material WAS extracted and it CONTRADICTS the criterion
  null  not applicable to this company, or not extractable from what you were given

Never convert missing evidence into 0. If you simply did not see anything about a
criterion, that is null, not 0. Use 0 only when the page contains relevant material
that actively works against the criterion — for example, a page that describes the
technology at length while never naming a buyer contradicts "targetBuyerOrDesignRoleNamed".
When you are unsure between 0 and null, choose null.

Criteria whose names end in "WhenRelevant" should be null when the company's business
model makes them inapplicable (for example, a distributor route for a company that only
sells through direct design engagements).

WHAT IS NOT REQUIRED. Do not treat any of the following as necessary for a 1, and do not
mark a criterion 0 merely because they are absent: public pricing, named customer logos,
public case studies, free trials, self-serve checkout, or a generic "book a demo" button.
This is a design-in and commercial-engagement motion, not e-commerce or SaaS self-serve.

WHERE EVIDENCE MAY APPEAR. The homepage body, the primary navigation, or a first-level
public resource clearly linked from the homepage. You are given the homepage text plus a
map of link text to URL. A clearly labelled link (for example "Distributors", "Design
Resources", "Request a Quote") is itself valid evidence that a route is visible to a
buyer. You cannot see the contents of those linked pages — where a criterion depends on
what is actually on the linked page rather than on the route being visible, return null.

Judge only what you were given. Do not infer from the company name or from outside knowledge.`;

function buildUserPrompt(page: ExtractedPage): string {
  const list = Object.entries(RUBRIC)
    .map(([pillar, keys]) => `${pillar}:\n${keys.map((k) => `  - ${k}`).join("\n")}`)
    .join("\n\n");

  return [
    `HOMEPAGE URL: ${page.url}`,
    page.title ? `TITLE: ${page.title}` : "",
    page.description ? `META DESCRIPTION: ${page.description}` : "",
    "",
    "=== VISIBLE PAGE TEXT ===",
    page.text || "(no text extracted)",
    "",
    "=== LINKS (anchor text -> href) ===",
    page.links.length ? page.links.join("\n") : "(no links extracted)",
    "",
    "=== CRITERIA TO SCORE ===",
    list,
    "",
    "Score every criterion. Return 1, 0, or null for each, following the rules exactly.",
  ]
    .filter(Boolean)
    .join("\n");
}

/* ------------------------------------------------------- URL / SSRF guard --- */

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const v = Number(p);
    if (!Number.isInteger(v) || v < 0 || v > 255) return null;
    n = n * 256 + v;
  }
  return n;
}

function isPrivateIPv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  if (n === null) return true; // unparseable -> treat as unsafe
  const inRange = (base: string, bits: number) => {
    const b = ipv4ToInt(base)!;
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (n & mask) >>> 0 === (b & mask) >>> 0;
  };
  return (
    inRange("0.0.0.0", 8) ||
    inRange("10.0.0.0", 8) ||
    inRange("100.64.0.0", 10) ||   // carrier-grade NAT
    inRange("127.0.0.0", 8) ||     // loopback
    inRange("169.254.0.0", 16) ||  // link-local, incl. cloud metadata 169.254.169.254
    inRange("172.16.0.0", 12) ||
    inRange("192.0.0.0", 24) ||
    inRange("192.168.0.0", 16) ||
    inRange("198.18.0.0", 15) ||
    inRange("224.0.0.0", 4) ||     // multicast
    inRange("240.0.0.0", 4)        // reserved
  );
}

function isPrivateIPv6(ip: string): boolean {
  const a = ip.toLowerCase().split("%")[0];
  if (a === "::1" || a === "::") return true;
  const mapped = a.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIPv4(mapped[1]);
  const head = parseInt(a.split(":")[0] || "0", 16);
  if ((head & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((head & 0xffc0) === 0xfe80) return true; // fe80::/10 link local
  return false;
}

const BLOCKED_HOST_SUFFIXES = [".local", ".internal", ".localhost", ".home.arpa"];

/** Validates scheme + hostname, then resolves DNS and rejects private ranges. */
async function assertSafeUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new CheckError("invalid_url", "That does not look like a valid web address.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new CheckError("invalid_url", "Only http and https addresses can be checked.");
  }

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");

  if (host === "localhost" || BLOCKED_HOST_SUFFIXES.some((s) => host.endsWith(s))) {
    throw new CheckError("blocked_host", "That address cannot be checked.");
  }
  // Literal IPs are never a legitimate company homepage here — reject before DNS.
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(":")) {
    throw new CheckError("blocked_host", "That address cannot be checked.");
  }

  let records: Array<{ address: string; family: number }>;
  try {
    records = await dns.lookup(host, { all: true });
  } catch {
    throw new CheckError("dns_failed", "We could not resolve that domain.");
  }
  if (!records.length) {
    throw new CheckError("dns_failed", "We could not resolve that domain.");
  }
  for (const r of records) {
    const bad = r.family === 6 ? isPrivateIPv6(r.address) : isPrivateIPv4(r.address);
    if (bad) throw new CheckError("blocked_host", "That address cannot be checked.");
  }

  return url;
}

/* ---------------------------------------------------------------- fetch --- */

interface ExtractedPage {
  url: string;
  title: string;
  description: string;
  text: string;
  links: string[];
}

/** Fetches the page, following redirects manually and re-validating every hop. */
async function fetchHomepage(startUrl: URL): Promise<{ html: string; finalUrl: string }> {
  let current = startUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await fetch(current.toString(), {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(PAGE_FETCH_TIMEOUT_MS),
      headers: {
        // Identify honestly; some sites block unknown agents outright.
        "User-Agent":
          "Mozilla/5.0 (compatible; CommercialReadinessBot/1.0; +https://jefffryer.com/commercial-readiness-audit)",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) throw new CheckError("fetch_failed", "That site redirected without a destination.");
      const next = new URL(location, current);
      current = await assertSafeUrl(next.toString()); // re-validate every hop
      continue;
    }

    if (!res.ok) {
      throw new CheckError("fetch_failed", `That site returned HTTP ${res.status}.`);
    }

    const contentType = res.headers.get("content-type") || "";
    if (!/text\/html|application\/xhtml/i.test(contentType)) {
      throw new CheckError("not_html", "That address did not return a web page.");
    }

    // Read with a hard byte cap so a huge response cannot exhaust the function.
    const reader = res.body?.getReader();
    if (!reader) throw new CheckError("fetch_failed", "We could not read that page.");
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (total < MAX_PAGE_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.length;
    }
    try { await reader.cancel(); } catch { /* already closed */ }

    const merged = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      const take = Math.min(c.length, total - offset);
      merged.set(c.subarray(0, take), offset);
      offset += take;
      if (offset >= total) break;
    }

    return { html: new TextDecoder("utf-8").decode(merged), finalUrl: current.toString() };
  }

  throw new CheckError("too_many_redirects", "That site redirected too many times.");
}

/* ------------------------------------------------------------- extraction --- */

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)));
}

function extract(html: string, finalUrl: string): ExtractedPage {
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").trim();

  const description =
    html.match(
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i,
    )?.[1] ||
    html.match(
      /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i,
    )?.[1] ||
    "";

  // Link map BEFORE stripping tags — anchor text + href is load-bearing evidence
  // for the "is this route visible to a buyer" criteria.
  const links: string[] = [];
  const seen = new Set<string>();
  const anchorRe = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = anchorRe.exec(html)) && links.length < MAX_LINKS) {
    const href = m[1].trim();
    const text = decodeEntities(m[2].replace(/<[^>]*>/g, " "))
      .replace(/\s+/g, " ")
      .trim();
    if (!text || href.startsWith("#") || /^(javascript|mailto|tel):/i.test(href)) continue;
    let abs: string;
    try { abs = new URL(href, finalUrl).toString(); } catch { continue; }
    const key = `${text.toLowerCase()}|${abs}`;
    if (seen.has(key)) continue;
    seen.add(key);
    links.push(`${text} -> ${abs}`);
  }

  const text = decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/section)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t ]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();

  // Keep links and text inside a combined budget. Links are capped by count above,
  // but long URLs can still blow past it, so trim the list until it fits.
  const MAX_LINKS_CHARS = 8_000;
  let trimmed = links;
  while (trimmed.length && trimmed.join("\n").length > MAX_LINKS_CHARS) {
    trimmed = trimmed.slice(0, Math.floor(trimmed.length * 0.8));
  }
  const textBudget = Math.max(4_000, MAX_EXTRACT_CHARS - trimmed.join("\n").length);

  return {
    url: finalUrl,
    title: title.slice(0, 300),
    description: description.slice(0, 500),
    text: text.slice(0, textBudget),
    links: trimmed,
  };
}

/* ------------------------------------------------------------ sanitising --- */

/**
 * The engine THROWS on any value that is not 1, 0, or null — which would crash the
 * results screen. Force the payload into shape before it ever reaches the browser.
 */
function sanitiseSignals(raw: unknown): Record<string, Record<string, 0 | 1 | null>> {
  const out: Record<string, Record<string, 0 | 1 | null>> = {};
  const src = (raw ?? {}) as Record<string, Record<string, unknown>>;

  for (const [pillar, keys] of Object.entries(RUBRIC)) {
    out[pillar] = {};
    const from = (src?.[pillar] ?? {}) as Record<string, unknown>;
    for (const key of keys) {
      const v = from?.[key];
      out[pillar][key] = v === 1 || v === 0 ? (v as 0 | 1) : null;
    }
  }
  return out;
}

/* ---------------------------------------------------------- rate limiting --- */

async function underRateLimit(ip: string): Promise<boolean> {
  if (Netlify.env.get("RATE_LIMIT_DISABLED") === "true") return true;

  try {
    const store = getStore("cra-ratelimit");
    const now = new Date();
    const hourKey = `ip:${ip}:${now.toISOString().slice(0, 13)}`;
    const dayKey = `all:${now.toISOString().slice(0, 10)}`;

    const [ipRaw, allRaw] = await Promise.all([store.get(hourKey), store.get(dayKey)]);
    const ipCount = Number(ipRaw ?? 0);
    const allCount = Number(allRaw ?? 0);

    if (ipCount >= RATE_PER_IP_PER_HOUR || allCount >= RATE_GLOBAL_PER_DAY) return false;

    await Promise.all([
      store.set(hourKey, String(ipCount + 1)),
      store.set(dayKey, String(allCount + 1)),
    ]);
    return true;
  } catch {
    // Never let the limiter itself take the endpoint down.
    return true;
  }
}

/* ---------------------------------------------------------------- errors --- */

class CheckError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/* ----------------------------------------------------------------- CORS --- */
/* Netlify's guidance is to avoid CORS headers unless they're actually needed. They are
   needed here: the browser calls this cross-origin from Squarespace. The allowlist is
   deliberately narrow rather than "*", which also blunts casual abuse of an endpoint
   that spends money on an API key. */

function allowedOrigins(): string[] {
  const extra = Netlify.env.get("ALLOWED_ORIGINS");
  return extra
    ? extra.split(",").map((s) => s.trim()).filter(Boolean)
    : DEFAULT_ALLOWED_ORIGINS;
}

function corsHeaders(origin: string | null): Record<string, string> {
  const list = allowedOrigins();
  const ok = origin && (list.includes(origin) || /^https:\/\/[a-z0-9-]+\.netlify\.app$/i.test(origin));
  return {
    "Access-Control-Allow-Origin": ok ? origin! : list[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

/* ---------------------------------------------------------------- handler --- */

export default async (req: Request, context: Context): Promise<Response> => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (req.method !== "POST") {
    return json({ signals: null, error: "method_not_allowed" }, 405, origin);
  }

  const list = allowedOrigins();
  if (origin && !list.includes(origin) && !/^https:\/\/[a-z0-9-]+\.netlify\.app$/i.test(origin)) {
    return json({ signals: null, error: "origin_not_allowed" }, 403, origin);
  }

  const apiKey = Netlify.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY is not set");
    return json({ signals: null, error: "not_configured" }, 500, origin);
  }

  const ip =
    req.headers.get("x-nf-client-connection-ip") ||
    context.ip ||
    "unknown";
  if (!(await underRateLimit(ip))) {
    return json({ signals: null, error: "rate_limited" }, 429, origin);
  }

  let submitted: string;
  try {
    const body = (await req.json()) as { url?: unknown };
    if (typeof body?.url !== "string" || !body.url.trim()) {
      return json({ signals: null, error: "missing_url" }, 400, origin);
    }
    submitted = body.url.trim().slice(0, 2048);
  } catch {
    return json({ signals: null, error: "bad_request" }, 400, origin);
  }

  const started = Date.now();

  try {
    const safeUrl = await assertSafeUrl(submitted);
    const { html, finalUrl } = await fetchHomepage(safeUrl);
    const page = extract(html, finalUrl);

    if (page.text.length < 200 && page.links.length === 0) {
      // Almost certainly a JS-rendered shell. Nothing extractable is null, not zero.
      return json(
        { signals: sanitiseSignals(null), url: finalUrl, note: "little_extractable_content" },
        200,
        origin,
      );
    }

    const client = new Anthropic({ apiKey, timeout: LLM_TIMEOUT_MS, maxRetries: 1 });

    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 8_000,
      system: SYSTEM_PROMPT,
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: buildSchema() },
      },
      messages: [{ role: "user", content: buildUserPrompt(page) }],
    });

    if (response.stop_reason === "refusal") {
      console.warn("model refused", response.stop_details);
      return json({ signals: null, error: "refused" }, 502, origin);
    }
    if (response.stop_reason === "max_tokens") {
      // Truncated output means truncated JSON. Fail cleanly rather than half-score.
      console.warn("hit max_tokens; output truncated");
      return json({ signals: null, error: "truncated" }, 502, origin);
    }

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return json({ signals: null, error: "no_output" }, 502, origin);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(textBlock.text);
    } catch {
      console.warn("model output was not valid JSON");
      return json({ signals: null, error: "unparseable" }, 502, origin);
    }

    const signals = sanitiseSignals(parsed);

    const observed = Object.values(signals)
      .flatMap((p) => Object.values(p))
      .filter((v) => v !== null).length;
    console.log(
      `checked ${finalUrl} in ${Date.now() - started}ms — ${observed}/40 criteria observed, ` +
        `${response.usage.input_tokens} in / ${response.usage.output_tokens} out`,
    );

    return json({ signals, url: finalUrl }, 200, origin);
  } catch (err) {
    const ms = Date.now() - started;
    if (err instanceof CheckError) {
      console.warn(`check failed after ${ms}ms: ${err.code} — ${err.message}`);
      return json({ signals: null, error: err.code, message: err.message }, 400, origin);
    }
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      console.warn(`timed out after ${ms}ms`);
      return json({ signals: null, error: "timeout" }, 504, origin);
    }
    console.error(`unexpected failure after ${ms}ms`, err);
    return json({ signals: null, error: "internal_error" }, 500, origin);
  }
};

export const config: Config = {
  path: "/api/website-check",
};

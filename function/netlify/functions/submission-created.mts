/**
 * COMMERCIAL READINESS — EMAIL THE REPORT
 * =======================================
 *
 * Fires on Netlify's `submission-created` event, which Netlify raises once a form
 * submission has passed its own spam filtering. That is the reason this is an
 * event function rather than something the browser calls: the Resend key stays
 * server side, the send cannot be triggered by anyone hitting an endpoint, and a
 * submission can never be emailed twice because the browser is not involved.
 *
 * It sends the same report the visitor just saw on screen: score, band, the six
 * pillar scores, the six sentences they landed on, and the Fix First pillar with
 * its action. Jeff is blind-copied on every send.
 *
 * The report copy is NOT duplicated here. The audit posts the six sentences and
 * the Fix First action as form fields, so this function only ever formats what
 * the submission already contains. Change the copy in public/index.html and the
 * email follows automatically.
 *
 * Failure policy: log and return 200. A non-2xx makes Netlify retry the event,
 * which would risk sending the same person the same report several times. A lead
 * that reached Netlify Forms is already captured; the email is the bonus.
 */

/* ---------------------------------------------------------------- tuning --- */

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const SEND_TIMEOUT_MS = 8_000;

/** Verified sending domain in Resend. Replies go to the real inbox instead. */
const FROM = "Jeff Fryer <jeff@mail.jefffryer.com>";
const REPLY_TO = "jeff@jefffryer.com";
const BCC = "jeff@jefffryer.com";

const FORM_NAME = "crg-audit";

/** Engine order. Labels match PILLAR_NAME in the scoring engine exactly. */
const PILLARS = [
  { key: "story", label: "Your story" },
  { key: "sell", label: "How you sell" },
  { key: "timingLane", label: "Timing and lane" },
  { key: "charge", label: "How you charge" },
  { key: "partnerships", label: "Partnerships" },
  { key: "alignment", label: "One team, one story" },
] as const;

type Submission = Record<string, string | undefined>;

/* --------------------------------------------------------------- helpers --- */

function esc(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );
}

function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

/* ----------------------------------------------------------- the message --- */

function subject(d: Submission): string {
  return `Your Commercial Readiness Score: ${d.score} / 100`;
}

function plainText(d: Submission): string {
  const rows = PILLARS.map(
    (p) => `  ${p.label.padEnd(22)} ${String(d[`pillar_${p.key}`] ?? "").padStart(3)} / 100`
  ).join("\n");

  const told = PILLARS.map(
    (p) => `  ${p.label}\n  ${d[`slider_${p.key}`]} / 100\n  "${d[`told_${p.key}`]}"\n`
  ).join("\n");

  return [
    `${d.firstName}, here is your Commercial Readiness Score.`,
    ``,
    `SCORE: ${d.score} / 100`,
    `BAND: ${d.band}`,
    ``,
    `THE SIX PARTS`,
    rows,
    ``,
    `FIX FIRST: ${d.fixFirst}`,
    `${d.fixFirstAction}`,
    ``,
    `WHAT YOU TOLD ME`,
    told,
    `The score took a minute. The gap analysis is the call.`,
    `Book time to walk through your numbers: https://calendly.com/JeffFryer`,
    ``,
    `Jeff Fryer · The Fryer Group · jefffryer.com`,
  ].join("\n");
}

function html(d: Submission): string {
  const ink = "#002244";
  const azure = "#1B5A9E";
  const rule = "1px solid #dfe5ec";

  const bars = PILLARS.map((p) => {
    const score = Number(d[`pillar_${p.key}`] ?? 0);
    const isFix = d.fixFirst === p.label;
    return `
      <tr>
        <td style="padding:7px 0;font:600 14px/1.4 Helvetica,Arial,sans-serif;color:${ink};">
          ${esc(p.label)}${isFix ? ' <span style="font:700 10px/1 Helvetica,Arial,sans-serif;color:#fff;background:' + ink + ';padding:3px 6px;border-radius:3px;">FIX FIRST</span>' : ""}
        </td>
        <td width="140" style="padding:7px 0;">
          <div style="background:#e7ecf2;border-radius:4px;height:8px;">
            <div style="background:${azure};border-radius:4px;height:8px;width:${Math.max(2, score)}%;"></div>
          </div>
        </td>
        <td width="56" align="right" style="padding:7px 0;font:400 13px/1.4 Menlo,Consolas,monospace;color:#5a6b7d;">${esc(score)}</td>
      </tr>`;
  }).join("");

  const told = PILLARS.map(
    (p) => `
      <tr>
        <td style="padding:10px 0;border-top:${rule};">
          <div style="font:600 10px/1.4 Menlo,Consolas,monospace;letter-spacing:.08em;text-transform:uppercase;color:#7b8a99;">
            ${esc(p.label)} &nbsp; ${esc(d[`slider_${p.key}`])} / 100
          </div>
          <div style="margin-top:4px;font:italic 400 15px/1.5 Georgia,serif;color:${ink};">
            &ldquo;${esc(d[`told_${p.key}`])}&rdquo;
          </div>
        </td>
      </tr>`
  ).join("");

  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f6f9;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:28px 12px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:10px;padding:32px;">

  <tr><td style="font:600 11px/1.4 Menlo,Consolas,monospace;letter-spacing:.14em;text-transform:uppercase;color:${azure};">
    Commercial Readiness Audit&trade;
  </td></tr>

  <tr><td style="padding-top:14px;font:700 22px/1.3 Helvetica,Arial,sans-serif;color:${ink};">
    ${esc(d.firstName)}, here is your score.
  </td></tr>

  <tr><td align="center" style="padding:26px 0 6px;">
    <div style="font:700 52px/1 Helvetica,Arial,sans-serif;color:${ink};">${esc(d.score)}</div>
    <div style="font:400 12px/1.4 Menlo,Consolas,monospace;color:#7b8a99;padding-top:4px;">/ 100</div>
    <div style="display:inline-block;margin-top:12px;padding:7px 16px;border-radius:999px;background:${ink};color:#fff;font:700 12px/1 Helvetica,Arial,sans-serif;letter-spacing:.06em;text-transform:uppercase;">
      ${esc(d.band)}
    </div>
  </td></tr>

  <tr><td style="padding-top:26px;font:600 11px/1.4 Menlo,Consolas,monospace;letter-spacing:.12em;text-transform:uppercase;color:#7b8a99;">
    The six parts
  </td></tr>
  <tr><td style="padding-top:6px;"><table width="100%" cellpadding="0" cellspacing="0">${bars}</table></td></tr>

  <tr><td style="padding-top:26px;border-top:${rule};">
    <div style="font:600 11px/1.4 Menlo,Consolas,monospace;letter-spacing:.12em;text-transform:uppercase;color:#7b8a99;padding-top:18px;">Your Fix First read</div>
    <div style="margin-top:8px;font:700 16px/1.4 Helvetica,Arial,sans-serif;color:${ink};">Fix First: ${esc(d.fixFirst)}</div>
    <div style="margin-top:6px;font:400 15px/1.6 Helvetica,Arial,sans-serif;color:#3c4b5a;">${esc(d.fixFirstAction)}</div>
  </td></tr>

  <tr><td style="padding-top:26px;">
    <div style="font:600 11px/1.4 Menlo,Consolas,monospace;letter-spacing:.12em;text-transform:uppercase;color:#7b8a99;padding-bottom:4px;">What you told me</div>
    <table width="100%" cellpadding="0" cellspacing="0">${told}</table>
  </td></tr>

  <tr><td align="center" style="padding-top:30px;">
    <div style="font:700 18px/1.35 Helvetica,Arial,sans-serif;color:${ink};">The score took a minute. The gap analysis is the call.</div>
    <div style="margin-top:8px;font:400 15px/1.5 Helvetica,Arial,sans-serif;color:#3c4b5a;">Walk through your numbers with Jeff: what closing the gap costs in time, people, and money.</div>
    <a href="https://calendly.com/JeffFryer" style="display:inline-block;margin-top:16px;padding:14px 26px;background:${ink};color:#ffffff;font:700 13px/1 Helvetica,Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;text-decoration:none;">Book time to walk through my score</a>
  </td></tr>

  <tr><td style="padding-top:28px;border-top:${rule};font:400 12px/1.7 Helvetica,Arial,sans-serif;color:#7b8a99;">
    <b style="color:#3c4b5a;">Jeff Fryer &middot; The Fryer Group &middot; jefffryer.com</b><br>
    You are receiving this because you requested your report at jefffryer.com.
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;
}

/* --------------------------------------------------------------- handler --- */

export default async (req: Request): Promise<Response> => {
  let payload: Submission;
  try {
    const body = await req.json();
    payload = (body?.payload?.data ?? {}) as Submission;
    // Netlify puts the form name alongside the data, not inside it.
    const formName = body?.payload?.form_name;
    if (formName && formName !== FORM_NAME) {
      return new Response("ignored: other form", { status: 200 });
    }
  } catch (err) {
    console.error("could not parse submission payload", err);
    return new Response("bad payload", { status: 200 });
  }

  const to = (payload.email ?? "").trim();
  if (!looksLikeEmail(to)) {
    console.error("submission has no usable email, nothing sent");
    return new Response("no recipient", { status: 200 });
  }

  const apiKey = Netlify.env.get("RESEND_API_KEY");
  if (!apiKey) {
    console.error("RESEND_API_KEY is not set, nothing sent");
    return new Response("not configured", { status: 200 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [to],
        bcc: [BCC],
        reply_to: REPLY_TO,
        subject: subject(payload),
        html: html(payload),
        text: plainText(payload),
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      console.error(`resend rejected the send: ${res.status} ${await res.text()}`);
      return new Response("send failed", { status: 200 });
    }

    const { id } = (await res.json()) as { id?: string };
    console.log(`report sent to ${to} for ${payload.company ?? "unknown company"} (resend id ${id})`);
    return new Response("sent", { status: 200 });
  } catch (err) {
    if ((err as Error)?.name === "AbortError") {
      console.error(`resend timed out after ${SEND_TIMEOUT_MS}ms`);
    } else {
      console.error("unexpected failure sending the report", err);
    }
    return new Response("send failed", { status: 200 });
  } finally {
    clearTimeout(timer);
  }
};

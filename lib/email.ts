import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.RESEND_FROM || "KJ Studio <onboarding@resend.dev>";
const resend = apiKey ? new Resend(apiKey) : null;

type SendArgs = { to: string; subject: string; html: string };

/**
 * Send one transactional email. In dev without RESEND_API_KEY it logs the
 * message (including any magic link) to the server console instead of sending.
 */
export async function sendEmail({ to, subject, html }: SendArgs) {
  if (!resend) {
    // No Resend key (local dev): print the message, and any links on their own
    // line so a magic link is actually clickable from the terminal.
    const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const links = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    console.log(
      `\n──────── e-post (ej skickad – ingen RESEND_API_KEY) ────────\n` +
        `Till:   ${to}\nÄmne:   ${subject}\n${text}\n` +
        links.map((l) => `\n➜ ${l}`).join("") +
        `\n────────────────────────────────────────────────────────────\n`,
    );
    return { delivered: false as const };
  }
  const { error } = await resend.emails.send({ from, to, subject, html });
  if (error) throw new Error(`Resend: ${error.message}`);
  return { delivered: true as const };
}

/** Minimal branded wrapper so every email looks consistent. */
export function emailShell(bodyHtml: string) {
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;color:#16171d;line-height:1.6">
    <div style="font-weight:700;font-size:18px;letter-spacing:-.02em;padding:8px 0 16px">KJ Studio</div>
    ${bodyHtml}
    <div style="margin-top:28px;padding-top:16px;border-top:1px solid #e2e6ee;font-size:12px;color:#868ea1">
      KJ Marketing Sweden AB
    </div>
  </div>`;
}

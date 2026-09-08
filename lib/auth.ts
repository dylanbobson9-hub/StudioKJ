import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { and, eq, gt, isNull } from "drizzle-orm";
import { requireDb, schema } from "@/lib/db";
import { newToken, loginLink } from "@/lib/tokens";
import { sendEmail, emailShell } from "@/lib/email";
import type { TeamMember } from "@/lib/db/schema";

const COOKIE = "kjs_session";
const SESSION_DAYS = 30;
const LOGIN_TTL_MIN = 20;

/**
 * Start a sign-in: only emails already in `team_member` are accepted.
 * Always resolves the same way so the form can't be used to probe the allow-list.
 */
export async function requestLogin(email: string): Promise<void> {
  const db = requireDb();
  const clean = email.trim().toLowerCase();
  const member = await db.query.teamMember.findFirst({
    where: eq(schema.teamMember.email, clean),
  });
  if (!member) return;

  const token = newToken();
  await db.insert(schema.loginToken).values({
    token,
    email: clean,
    expiresAt: new Date(Date.now() + LOGIN_TTL_MIN * 60_000),
  });

  await sendEmail({
    to: clean,
    subject: "Din inloggningslänk till KJ Studio",
    html: emailShell(
      `<p>Klicka för att logga in. Länken gäller i ${LOGIN_TTL_MIN} minuter och kan bara användas en gång.</p>
       <p style="margin:20px 0"><a href="${loginLink(token)}"
         style="background:#1f6df0;color:#fff;padding:11px 20px;border-radius:9px;text-decoration:none;font-weight:600">
         Logga in</a></p>
       <p style="font-size:12px;color:#868ea1">Bad du inte om detta? Ignorera mejlet.</p>`,
    ),
  });
}

/** Consume a magic link. Returns the session id to set as a cookie, or null. */
export async function verifyLogin(token: string): Promise<string | null> {
  const db = requireDb();
  const row = await db.query.loginToken.findFirst({
    where: and(
      eq(schema.loginToken.token, token),
      isNull(schema.loginToken.usedAt),
      gt(schema.loginToken.expiresAt, new Date()),
    ),
  });
  if (!row) return null;

  const member = await db.query.teamMember.findFirst({
    where: eq(schema.teamMember.email, row.email),
  });
  if (!member) return null;

  await db
    .update(schema.loginToken)
    .set({ usedAt: new Date() })
    .where(eq(schema.loginToken.token, token));

  const sid = newToken(24);
  await db.insert(schema.session).values({
    id: sid,
    memberId: member.id,
    expiresAt: new Date(Date.now() + SESSION_DAYS * 86_400_000),
  });
  return sid;
}

export async function setSessionCookie(sid: string) {
  (await cookies()).set(COOKIE, sid, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
}

/** Current signed-in team member, or null. Cached for the request. */
export const getCurrentMember = cache(async (): Promise<TeamMember | null> => {
  const sid = (await cookies()).get(COOKIE)?.value;
  if (!sid) return null;
  try {
    const db = requireDb();
    const row = await db.query.session.findFirst({
      where: and(eq(schema.session.id, sid), gt(schema.session.expiresAt, new Date())),
    });
    if (!row) return null;
    const member = await db.query.teamMember.findFirst({
      where: eq(schema.teamMember.id, row.memberId),
    });
    return member ?? null;
  } catch {
    return null;
  }
});

export async function signOut() {
  const jar = await cookies();
  const sid = jar.get(COOKIE)?.value;
  if (sid) {
    try {
      await requireDb().delete(schema.session).where(eq(schema.session.id, sid));
    } catch {
      /* ignore */
    }
  }
  jar.delete(COOKIE);
}

export const can = {
  econ: (m: TeamMember | null) => m?.role === "admin" || m?.role === "ekonomi",
  managePeople: (m: TeamMember | null) => m?.role === "admin",
  operate: (m: TeamMember | null) =>
    m?.role === "admin" || m?.role === "ekonomi" || m?.role === "crew",
};

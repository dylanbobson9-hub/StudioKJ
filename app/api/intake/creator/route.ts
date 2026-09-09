import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireDb, schema } from "@/lib/db";
import { mapIntake } from "@/lib/intake";
import { sendEmail, emailShell } from "@/lib/email";
import { APP_URL } from "@/lib/tokens";

/**
 * Tar emot en ny kreatörsansökan från Google-formuläret.
 *
 * Skriptet i formuläret postar hit med `Authorization: Bearer $INTAKE_SECRET`.
 * Se GOOGLE-FORMULAR.md för skriptet och hur man kopplar in det.
 *
 * Endpointen är avsiktligt förlåtande: hittar den bara ett namn så sparas
 * ansökan. Ett formulärsvar som kastas bort är en kreatör som aldrig hör av
 * sig igen.
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = process.env.INTAKE_SECRET;
  if (!secret) return NextResponse.json({ error: "INTAKE_SECRET saknas" }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let answers: Record<string, unknown>;
  let defaults: Record<string, string> = {};
  try {
    const body = await req.json();
    // Skriptet skickar {answers:{…}, defaults:{…}}; vi tar även ett rått objekt.
    answers = (body?.answers ?? body) as Record<string, unknown>;
    defaults = (body?.defaults ?? {}) as Record<string, string>;
    if (!answers || typeof answers !== "object") throw new Error("no answers");
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const { values, unmapped } = mapIntake(answers);
  // Det svenska formuläret frågar inte efter land – det ger skriptet oss.
  for (const [k, v] of Object.entries(defaults)) if (!values[k] && v) values[k] = v;
  if (!values.name) {
    return NextResponse.json({ error: "hittade inget namn i svaret" }, { status: 422 });
  }

  const db = requireDb();
  const raw = Object.fromEntries(
    Object.entries(answers).map(([k, v]) => [k, Array.isArray(v) ? v.join(", ") : String(v ?? "")]),
  );

  // Samma person kan söka igen. Uppdatera i så fall, skapa inte en dubblett.
  const existing = values.email
    ? await db.query.creator.findFirst({ where: eq(schema.creator.email, values.email) })
    : null;

  const row = { ...values, source: "form", rawIntake: raw, reviewedAt: null };
  let id: string;
  let repeat = false;

  if (existing) {
    await db.update(schema.creator).set(row).where(eq(schema.creator.id, existing.id));
    id = existing.id;
    repeat = true;
  } else {
    const [created] = await db
      .insert(schema.creator)
      .values(row as typeof schema.creator.$inferInsert)
      .returning({ id: schema.creator.id });
    id = created.id;
  }

  // Pinga crew så en ansökan inte ligger oöppnad.
  try {
    const team = await db.select().from(schema.teamMember);
    const crew = team.filter((m) => m.role === "admin" || m.role === "crew").map((m) => m.email);
    if (crew.length) {
      const html = emailShell(
        `<p><b>${values.name}</b> har ansökt om att bli kreatör${repeat ? " (uppdaterade sin tidigare ansökan)" : ""}.</p>
         <p style="font-size:13px;color:#525a6b">
           ${[values.city, values.country].filter(Boolean).join(", ") || "Plats okänd"}
           ${values.niche ? ` · ${values.niche}` : ""}
         </p>
         <p style="margin:20px 0"><a href="${APP_URL}/creators/${id}"
           style="background:#1f6df0;color:#fff;padding:11px 20px;border-radius:9px;text-decoration:none;font-weight:600">
           Öppna profilen</a></p>`,
      );
      await Promise.all(
        crew.map((to) =>
          sendEmail({ to, subject: `Ny kreatörsansökan: ${values.name}`, html }).catch(() => {}),
        ),
      );
    }
  } catch (err) {
    console.error("[intake] kunde inte avisera crew:", err);
  }

  return NextResponse.json({ ok: true, id, repeat, unmapped });
}

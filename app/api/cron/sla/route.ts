import { NextResponse } from "next/server";
import { runSlaJob } from "@/lib/sla-job";

/**
 * Schemalagd koll av tidsplanen. Vercel Cron anropar den här med
 * `Authorization: Bearer $CRON_SECRET`; lokalt går den att köra utan nyckel.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    if (req.headers.get("authorization") !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    // Utan nyckel i produktion vore endpointen öppen för vem som helst.
    return NextResponse.json({ error: "CRON_SECRET saknas" }, { status: 503 });
  }

  try {
    return NextResponse.json(await runSlaJob());
  } catch (err) {
    console.error("[sla] jobbet kraschade:", err);
    return NextResponse.json({ error: "job failed" }, { status: 500 });
  }
}

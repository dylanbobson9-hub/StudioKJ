import { NextRequest, NextResponse } from "next/server";
import { verifyLogin, setSessionCookie } from "@/lib/auth";
import { APP_URL } from "@/lib/tokens";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.redirect(`${APP_URL}/login`);

  let sid: string | null = null;
  try {
    sid = await verifyLogin(token);
  } catch {
    sid = null;
  }
  if (!sid) return NextResponse.redirect(`${APP_URL}/login?expired=1`);

  await setSessionCookie(sid);
  return NextResponse.redirect(APP_URL + "/");
}

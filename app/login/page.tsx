import { redirect } from "next/navigation";
import { requestLogin } from "@/lib/auth";
import { db } from "@/lib/db";
import { LogoMark } from "@/components/Logo";

export const metadata = { title: "Logga in" };

async function submit(formData: FormData) {
  "use server";
  const email = String(formData.get("email") || "");
  if (email.includes("@")) await requestLogin(email);
  // Always land on the same confirmation — never reveals whether the email exists.
  redirect("/login?sent=1");
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const sent = sp.sent === "1";
  const noDb = !db;

  return (
    <div
      className="grid min-h-screen place-items-center p-8"
      style={{ background: "var(--paper)", color: "var(--ink)" }}
    >
      <div
        className="w-full max-w-[420px] rounded-[13px] border p-7"
        style={{ background: "var(--surface)", borderColor: "var(--line)" }}
      >
        <div className="mb-4 flex items-center gap-2.5">
          <LogoMark size={26} />
          <b
            className="text-[19px] tracking-[-0.02em]"
            style={{ fontFamily: "var(--font-display), system-ui" }}
          >
            KJ Studio
          </b>
        </div>

        {noDb ? (
          <p className="text-[13px]" style={{ color: "var(--ink-2)" }}>
            Databasen är inte konfigurerad ännu. Sätt <code>DATABASE_URL</code> och{" "}
            <code>RESEND_API_KEY</code> i <code>.env.local</code>, kör migreringarna och lägg in
            teamet (se README).
          </p>
        ) : sent ? (
          <p className="text-[13px]" style={{ color: "var(--ink-2)" }}>
            Om adressen finns i teamet har vi skickat en inloggningslänk. Kolla mejlen – länken
            gäller i 20 minuter.
          </p>
        ) : (
          <form action={submit} className="flex flex-col gap-3">
            <p className="text-[13px]" style={{ color: "var(--muted)" }}>
              Ange din jobbmejl så skickar vi en inloggningslänk.
            </p>
            <input
              name="email"
              type="email"
              required
              placeholder="du@kjmarketingsweden.com"
              className="rounded-lg border px-3 py-2.5 text-[14px]"
              style={{ borderColor: "var(--line-2)", background: "var(--surface)" }}
            />
            <button
              className="rounded-lg px-3.5 py-2.5 text-[13px] font-semibold"
              style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
            >
              Skicka länk
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

import type { Creator } from "@/lib/db/schema";
import { updateCreator } from "@/lib/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { decryptPII, maskPersonalNumber } from "@/lib/pii";
import type { Missing } from "@/lib/readiness";

const field = { borderColor: "var(--line-2)", background: "var(--surface-2)" } as const;

function F({
  label,
  name,
  value,
  missing,
  type = "text",
  placeholder,
  wide,
}: {
  label: string;
  name: string;
  value: string | null;
  missing?: boolean;
  type?: string;
  placeholder?: string;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <label className="mb-1 flex items-center gap-1.5 text-[11.5px]" style={{ color: "var(--ink-2)" }}>
        {label}
        {missing && (
          <span className="rounded px-1 text-[10.5px] font-semibold" style={{ background: "var(--warn-soft)", color: "var(--warn)" }}>
            saknas
          </span>
        )}
      </label>
      <input
        name={name}
        type={type}
        defaultValue={value ?? ""}
        placeholder={placeholder}
        className="w-full rounded-lg border px-3 py-2 text-[13px]"
        style={{ ...field, borderColor: missing ? "var(--warn)" : field.borderColor }}
      />
    </div>
  );
}

/**
 * Rätta en kreatörs uppgifter. Utbetalningsdelen renderas bara för Admin och
 * Ekonomi — och server action ignorerar de fälten för alla andra ändå.
 */
export function CreatorEdit({
  c,
  missing,
  canEcon,
  open,
}: {
  c: Creator;
  missing: Missing[];
  canEcon: boolean;
  open: boolean;
}) {
  const miss = new Set(missing.map((m) => m.key));
  const pn = canEcon ? decryptPII(c.personalNumberEnc) : null;

  return (
    <details open={open} className="group">
      <summary
        className="flex cursor-pointer list-none items-center justify-between text-[13.5px] font-semibold"
      >
        Uppgifter
        <span className="text-[12px] font-medium" style={{ color: "var(--accent)" }}>
          <span className="group-open:hidden">Redigera</span>
          <span className="hidden group-open:inline">Stäng</span>
        </span>
      </summary>

      <form action={updateCreator} className="mt-3">
        <input type="hidden" name="creatorId" value={c.id} />

        <div className="mb-1 text-[11px] font-semibold tracking-wide uppercase" style={{ color: "var(--muted)" }}>
          Kontakt och frakt
        </div>
        <div className="mb-4 grid gap-2.5 sm:grid-cols-2">
          <F label="Namn" name="name" value={c.name} />
          <F label="Mejl" name="email" type="email" value={c.email} missing={miss.has("email")} />
          <F label="Telefon" name="phone" value={c.phone} missing={miss.has("phone")} />
          <F label="Tröjstorlek" name="shirtSize" value={c.shirtSize} />
          <F
            label="Adress"
            name="address"
            value={c.address}
            missing={miss.has("address")}
            placeholder="Gatan 1, 123 45"
            wide
          />
          <F label="Stad" name="city" value={c.city} missing={miss.has("city")} />
          <F label="Land" name="country" value={c.country} />
        </div>

        {canEcon ? (
          <>
            <div
              className="mb-1 flex items-center gap-2 text-[11px] font-semibold tracking-wide uppercase"
              style={{ color: "var(--muted)" }}
            >
              Utbetalning
              <span className="font-normal tracking-normal normal-case">· bara Admin och Ekonomi</span>
            </div>

            <div className="mb-2.5">
              <label className="mb-1 flex items-center gap-1.5 text-[11.5px]" style={{ color: "var(--ink-2)" }}>
                Tar betalt som
                {miss.has("payoutType") && (
                  <span className="rounded px-1 text-[10.5px] font-semibold" style={{ background: "var(--warn-soft)", color: "var(--warn)" }}>
                    saknas
                  </span>
                )}
              </label>
              <select
                name="payoutType"
                defaultValue={c.payoutType ?? ""}
                className="w-full rounded-lg border px-3 py-2 text-[13px]"
                style={{ ...field, borderColor: miss.has("payoutType") ? "var(--warn)" : field.borderColor }}
              >
                <option value="">Vet inte än</option>
                <option value="company">Bolag (F-skatt, fakturerar oss)</option>
                <option value="private">Privatperson (vi betalar ut och rapporterar)</option>
              </select>
            </div>

            <div className="mb-2 grid gap-2.5 sm:grid-cols-2">
              {c.payoutType !== "private" && (
                <>
                  <F label="Bolagsnamn" name="companyName" value={c.companyName} missing={miss.has("companyName")} />
                  <F label="Orgnr" name="regNumber" value={c.regNumber} missing={miss.has("regNumber")} placeholder="556677-8899" />
                </>
              )}

              {c.payoutType !== "company" && (
                <div>
                  <label className="mb-1 flex items-center gap-1.5 text-[11.5px]" style={{ color: "var(--ink-2)" }}>
                    Personnummer
                    {miss.has("personalNumber") && (
                      <span className="rounded px-1 text-[10.5px] font-semibold" style={{ background: "var(--warn-soft)", color: "var(--warn)" }}>
                        saknas
                      </span>
                    )}
                  </label>
                  <input
                    name="personalNumber"
                    // Aldrig förifyllt: numret ska inte ligga i klartext i sidans HTML.
                    defaultValue=""
                    autoComplete="off"
                    inputMode="numeric"
                    placeholder={pn ? `${maskPersonalNumber(pn)}  (lämna tomt = behåll)` : "ÅÅÅÅMMDD-XXXX"}
                    className="w-full rounded-lg border px-3 py-2 text-[13px]"
                    style={{ ...field, borderColor: miss.has("personalNumber") ? "var(--warn)" : field.borderColor }}
                  />
                  {pn && (
                    <label className="mt-1 flex items-center gap-1.5 text-[11.5px]" style={{ color: "var(--muted)" }}>
                      <input type="checkbox" name="clearPersonalNumber" value="1" />
                      Ta bort sparat personnummer
                    </label>
                  )}
                </div>
              )}

              <F label="Bankkonto" name="bankAccount" value={c.bankAccount} missing={miss.has("bankAccount")} placeholder="Clearing + konto" />
            </div>

            <p className="mb-4 text-[11px] leading-relaxed" style={{ color: "var(--muted)" }}>
              Personnumret lagras krypterat och visas aldrig i klartext – inte här, inte i export, inte för kunden.
            </p>
          </>
        ) : (
          miss.has("personalNumber") || miss.has("bankAccount") || miss.has("payoutType") || miss.has("regNumber") ? (
            <p className="mb-4 text-[12px]" style={{ color: "var(--warn)" }}>
              Utbetalningsuppgifter saknas – Admin eller Ekonomi behöver fylla i dem.
            </p>
          ) : null
        )}

        <SubmitButton
          className="rounded-lg px-4 py-2 text-[13px] font-semibold"
          style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
        >
          Spara uppgifter
        </SubmitButton>
      </form>
    </details>
  );
}

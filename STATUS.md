# Status

Uppdaterad 2026-09-08. Fas 1 av 3 (se planen).

## Klart

- Projektstruktur: Next.js 16 + Tailwind v4 + Drizzle + TypeScript, matchar
  motoadvicer-repots konventioner.
- **Datamodell** (`lib/db/schema.ts`) – hela Fas 1: `team_member`, `login_token`,
  `session`, `client`, `campaign`, `creator`, `booking` (16 steg, godkännanden,
  produkt/tracking, deliverable-spec, hold), `booking_event` (tidslinje),
  `access_token` (magic links för kund/kreatör).
- **Inloggning** (`lib/auth.ts`) – magic link för team, allowlist via
  `team_member`, sessions-cookie. Login-/verify-/logout-flöde.
- **E-post** (`lib/email.ts`) – Resend-wrapper, loggar till konsol utan nyckel.
- Varumärke: KJ-palett + gradient, `LogoMark` (J:et exakt från `logo-02.svg`,
  stapeln handtraceat).
- App-skal: sidomeny med rollstyrd navigering, alla team-routes som skelett,
  `/k/<token>` och `/u/<token>` läser access_token och visar kampanj/uppdrag.
- Utvecklingsläge: appen kör utan databas (browsbar UI).

## Externa länkarna lever (2026-09-09)

Kund och kreatör kommer in helt utan konto, via oräkneliga engångslänkar.

- **/k/<token>** – kunden ser sina kreatörer (kandidater och utbytta göms),
  godkänner kreatörsurval, brief och material eller begär ändring med
  kommentar, och kan lägga in spårningslänk när produkten skickas.
  Disclaimern ligger under listan.
- **/u/<token>** – kreatören ser brief, leveransspec, produkt/tracking och
  uppladdningsmapp, bekräftar mottagen produkt, laddar upp material och
  markerar publicerat. Begärd ändring visas överst med kundens kommentar.
- Länkar skapas per kampanj respektive uppdrag i team-vyn, kan mejlas direkt,
  kopieras och återkallas. Varje åtgärd loggas i tidslinjen som "Kund" eller
  "Kreatör".

Verifierat end-to-end: kund godkänner kreatör → steget går till Offert &
förfrågan och 24h-klockan startar → kreatör laddar upp → kund begär ändring →
kreatören ser kommentaren och kan skicka ny version.

## Team-vyerna lever (2026-09-09)

Översikt, pipeline-board, kunder & kampanjer, kampanj-dashboard, uppdrags-
detalj och kreatörslistan hämtar riktig data. Server actions för skapa kund /
kampanj / uppdrag, flytta i flödet, spara brief och hela tidsplans-flödet
(påminnelse, starta om klockan, byt ut kreatör, återuppta). Verifierat mot
databasen end-to-end.

## Databasen är uppe (2026-09-09)

Supabase-projekt `kj-studio` i **North EU (Stockholm)**, Data API avstängt —
appen pratar direkt med Postgres via poolern (`aws-0-eu-north-1`).
Tabellerna är skapade (`db:push`) och en admin + exempelkund är inlagd.
Inloggningen fungerar; utan RESEND_API_KEY skrivs magic link-länken ut i
serverkonsolen istället för att mejlas.

## Mejlen går på riktigt (2026-09-09)

Resend är inkopplat med `send.kjmarketingnorway.com` som verifierad
avsändardomän (`kjmarketingsweden.com` rörs inte – där ligger Google
Workspace). Nyckeln sattes via `scripts/set-resend.mjs`, som läser den ur en
gitignorerad fil och raderar filen efteråt.

**Aviseringar** (`lib/notify.ts`) skickas nu automatiskt:

| Händelse | Mottagare |
| --- | --- |
| Kreatör föreslagen | kund – "väntar på ert ja" |
| Brief redo | kund |
| Material inlämnat | kund + crew |
| Kunden godkände kreatören | crew – 24h-klockan startar |
| Kunden tackade nej | crew |
| Brief godkänd | kreatör – "dags att spela in" |
| Material godkänt | kreatör |
| Ändring begärd | kreatör + crew, med kundens kommentar |

Två regler genomgående: ett mejl kan aldrig fälla en server action, och vi
mejlar bara adresser som redan har en aktiv länk. Varje utskick loggas i
uppdragets tidslinje.

**Tidsplanen plingar utanför appen** – `/api/cron/sla` (`lib/sla-job.ts`) letar
upp allt som spräckt sin deadline och mejlar crew ett samlat brev. Max två
pling per steg: ett när första deadlinen passeras, ett när utbytesdeadlinen
gör det. Vercel Cron kör den 07/12/16 på vardagar (`vercel.json`).
Endpointen kräver `CRON_SECRET` i produktion.

## Kvar i Fas 1

1. **Deploy** – Vercel, domän, riktig data, teamet testar.

## Behövs från KJ

- [ ] DNS för `studio.kjmarketingsweden.com` → Vercel
- [ ] `CRON_SECRET` satt i Vercel (valfritt värde, samma sträng räcker)
- [x] `DATABASE_URL` + `DATABASE_URL_DIRECT` – Supabase `kj-studio`
- [x] `RESEND_API_KEY` + verifierad avsändardomän
- [ ] Team-lista: namn + e-post + roll
- [ ] Vercel-projekt kopplat till detta repo
- [ ] Vänsterstapelns SVG (logo-01?) om den finns – annars kör vi med approximationen

## Fas 2 & 3

- Fas 2: ekonomi (`campaign_econ`, `booking_econ`, `price_proposal`) + rollspärr.
- Fas 3: kreatörskatalogen (~1 400) med sök/filter/guld/AI + redigerar-batchar.

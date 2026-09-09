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

## Uppe i produktion (2026-09-09)

**https://studio-kj.vercel.app** — Vercel-projektet `studio-kj`, alla
miljövariabler satta av `scripts/deploy.mjs`.

Projektet är **inte** kopplat till GitHub. En push deployar alltså ingenting;
det som ligger uppe är det som senast lagts upp med `node scripts/deploy.mjs`.
Repot är källkodshistorik, inte deploy-trigger. Vill man ha automatisk deploy
på varje push kopplar man ihop dem med `vercel git connect` — det fungerar
lika bra med ett privat repo.

Verifierat live: inloggningssidan svarar 200, `/api/cron/sla` svarar 401 utan
nyckel, en påhittad kundlänk ger 404.

Hobby-planen tillåter bara **ett** cron-anrop per dygn (06:00 UTC), vilket är
värdelöst mot en 24-timmarsdeadline. Därför kör översikten samma jobb i
`after()` när någon i teamet öppnar den — plinget kommer inom minuter under
arbetsdagen, och det schemalagda anropet är bara golvet. Blir det aktuellt
med Pro-planen kan `vercel.json` gå tillbaka till 07/12/16.

## Kreatörskatalogen lever (2026-09-09)

Alla **1 387 kreatörer** ligger i databasen, 22 guldmarkerade. Fälten som
katalogen faktiskt bär finns nu på `creator`: stad, nisch, språk, erfarenhet,
sociala länkar, adress och ett härlett `price_eur`.

- **/creators** – fritextsök över namn, nisch, stad, land, språk och vad de
  kan filma. Filter på land, plattform, kön, guld, har mejl och takpris.
  Sortering på guld/namn/pris, 60 per sida.
- **/creators/[id]** – hela profilen, uppdragshistorik och koppla-till-kampanj.
- **/creators/export** – CSV med samma filter som listan, 19 kolumner valda
  för att en AI ska kunna matcha. Bakom inloggning, `noindex`, `no-store`.
- **"+ Koppla kreatör"** på en kampanj öppnar katalogen i kopplingsläge.
  Knappen "Ny kreatör" finns kvar för någon som inte står i katalogen.

`price_eur` härleds ur kreatörernas egen pristext av importen och är därför
ungefärlig — originaltexten visas alltid bredvid.

### Personuppgifter

Katalogen innehåller 945 mejladresser, telefonnummer och hemadresser till
riktiga personer, och **repot är publikt**. Datan finns därför bara i
databasen: `scripts/import-catalog.mjs` läser en lokal fil rakt in i Postgres
och `/data/` är gitignorerad. Committa aldrig katalogen.

## Kvar i Fas 1

1. **Domänen** – `studio.kjmarketingsweden.com` (CNAME hos utvecklarna).
2. **Teamet in** och en riktig kampanj körd hela vägen.
3. **Överväg att göra repot privat** – se ovan.

## Behövs från KJ

- [ ] DNS för `studio.kjmarketingsweden.com` → Vercel
- [x] `CRON_SECRET` – slumpad av deploy-skriptet
- [x] `DATABASE_URL` + `DATABASE_URL_DIRECT` – Supabase `kj-studio`
- [x] `RESEND_API_KEY` + verifierad avsändardomän
- [ ] Team-lista: namn + e-post + roll
- [ ] Vercel-projekt kopplat till detta repo
- [ ] Vänsterstapelns SVG (logo-01?) om den finns – annars kör vi med approximationen

## Fas 2 & 3

- Fas 2: ekonomi (`campaign_econ`, `booking_econ`, `price_proposal`) + rollspärr.
- Fas 3: kreatörskatalogen (~1 400) med sök/filter/guld/AI + redigerar-batchar.

## Fas 2: ekonomin (2026-09-09)

`lib/econ.ts` är **enda** stället där en kampanjs siffror räknas fram. Både
ekonomivyn och kundens portal läser samma funktion — det var två uträkningar
som glappade i prototypen och gjorde att byråarvodet försvann ur kundens
total.

- Kundens faktura = uppdragens kundpris **+ byråarvodet**
- Vår kostnad = kreatörsarvoden + utlägg + redigering
- Utbytt kreatör faller ur båda sidor
- Allt i hela kronor **exklusive moms**; tomt fält = "inte prissatt", inte noll

Ekonomin syns bara för Admin och Ekonomi, både i menyn, på kampanjsidan och i
server actions. Kunden ser bara sitt fakturerade belopp, aldrig kreatörs-
arvoden, utlägg eller marginal.

Verifierat mot databasen: 5000 + 5000 + 2250 = 12 250 kr fakturerat,
7 400 kostnad, 4 850 vinst, 40 % marginal. Byte av kreatör → 7 250 kr.

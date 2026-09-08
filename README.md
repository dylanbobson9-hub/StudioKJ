# KJ Studio

Produktionsverktyget för KJ Marketing Swedens kreatörssamarbeten. Ersätter
Claude-prototypen ("Regi"). Kund och kreatör följer sitt uppdrag via en egen
länk – utan konto.

- Plan: <https://claude.ai/code/artifact/987b8bf8-1c67-4eba-af7a-a9791abe21f3>
- Prod: `studio.kjmarketingsweden.com`

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind v4 · Drizzle ORM · Postgres
(Supabase eller Neon) · Resend · Vercel.

## Kom igång lokalt

```bash
npm install
cp .env.example .env.local        # fyll i värdena
npm run db:push                   # skapar tabellerna i din databas
SEED_ADMIN_EMAIL=du@kjmarketingsweden.com SEED_ADMIN_NAME="Ditt namn" npm run db:seed
npm run dev
```

Öppna <http://localhost:3000>. Utan `DATABASE_URL` startar appen ändå i
**utvecklingsläge** (browsbar UI, ingen data/inloggning).

### Databas

Vilken Postgres som helst. Rekommendation: **Supabase** (gratisnivå).

- `DATABASE_URL` – pooled connection (Supabase: "Transaction" pooler, port 6543)
- `DATABASE_URL_DIRECT` – direkt connection (port 5432), används av `drizzle-kit`

### E-post

`RESEND_API_KEY` + `RESEND_FROM`. Avsändardomänen (`kjmarketingsweden.com` eller
`mail.kjmarketingsweden.com`) måste verifieras i Resend. Utan nyckel loggas
mejlen (inkl. inloggningslänkar) till serverkonsolen istället.

## Inloggning

Teamet loggar in med magic link. Bara e-postadresser som finns i
`team_member` accepteras – lägg till personer via seed-skriptet eller
(kommer) admin-vyn. Roller: `admin`, `ekonomi`, `crew`, `editor`.

Kund/kreatör har **inga konton** – de får en oräknelig `access_token`-länk
(`/k/<token>` respektive `/u/<token>`) mailad till sig.

## Kommandon

| kommando | vad |
| --- | --- |
| `npm run dev` | utvecklingsserver |
| `npm run build` | produktionsbygge |
| `npm run db:push` | synka schema → databas (dev) |
| `npm run db:generate` / `db:migrate` | migreringsfiler (prod) |
| `npm run db:studio` | Drizzle Studio – bläddra i datan |
| `npm run db:seed` | skapa admin + exempeldata |

Se `STATUS.md` för vad som är byggt och vad som är kvar.

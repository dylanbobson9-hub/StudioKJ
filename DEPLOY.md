# Deploy till Vercel

Produktionsbygget går igenom lokalt (`npx next build`), så det som återstår är
att lägga upp det. Räkna med tio minuter.

## 1. Importera repot

1. Gå till [vercel.com/new](https://vercel.com/new) och logga in med GitHub.
2. Välj **dylanbobson9-hub/StudioKJ** → Import.
3. Framework blir Next.js automatiskt. Rör inga byggkommandon.
4. **Tryck inte Deploy än** – fyll i miljövariablerna först (nästa steg), annars
   kraschar första bygget på att `DATABASE_URL` saknas.

## 2. Miljövariabler

Under **Environment Variables** finns en ruta där man kan klistra in en hel
`.env`-fil på en gång.

Öppna `.env.local` (`notepad .env.local` i projektmappen), markera allt, klistra
in i Vercel — och **ändra sedan två rader direkt i Vercel-formuläret**:

| Variabel | Värde i produktion |
| --- | --- |
| `APP_URL` | `https://studio.kjmarketingsweden.com` — eller tills vidare den `.vercel.app`-adress projektet får |
| `CRON_SECRET` | en lång slumpsträng du hittar på (finns inte i `.env.local` ännu) |

Ta **inte** med `SEED_ADMIN_EMAIL` / `SEED_ADMIN_NAME` — de behövs bara lokalt.

> `APP_URL` är den viktigaste raden. Den bygger varenda länk som mejlas ut.
> Står det `localhost` här får kunder och kreatörer länkar som inte går att
> öppna.

Tryck sedan **Deploy**.

## 3. Domänen

I projektet: **Settings → Domains → Add** → `studio.kjmarketingsweden.com`.
Vercel visar då en CNAME-post.

`kjmarketingsweden.com` ligger på Route 53 hos era utvecklare, så posten måste
läggas av dem. Skicka exakt det Vercel visar — det är en ren CNAME på
subdomänen `studio` och den rör **inte** mailen (MX-posterna på roten står
kvar orörda).

Fram tills dess fungerar allt på `.vercel.app`-adressen. Byt `APP_URL` när
domänen är live, annars pekar gamla länkar fel.

## 4. Cron-jobbet

`vercel.json` schemalägger `/api/cron/sla` vardagar 07, 12 och 16. Vercel läser
den vid deployen — inget att klicka. Kolla att den syns under **Settings →
Cron Jobs** efteråt.

Testa den skarpt genom att öppna `https://<din-app>/api/cron/sla` i webbläsaren:
den ska svara `401` (du saknar nyckeln). Svarar den `503` är `CRON_SECRET` inte
satt.

## 5. Efter deployen

1. Logga in på riktigt: `/login` → magic link i inkorgen.
2. Lägg upp teamet under **Team** (namn, e-post, roll). Bara adresser som ligger
   där kan logga in — det är hela behörighetsspärren.
3. Skapa en riktig kund och kampanj, koppla en kreatör, mejla kundlänken.
4. Kör igenom flödet en gång med Jacob innan ni släpper in en riktig kund.

## Vanliga fel

| Symptom | Orsak |
| --- | --- |
| Bygget faller på `DATABASE_URL` | miljövariablerna lades in efter första deployen — kör **Redeploy** |
| Länkar i mejl går till `localhost` | `APP_URL` inte uppdaterad i Vercel |
| Inga mejl kommer fram | `RESEND_FROM` måste ligga på `send.kjmarketingnorway.com`, den enda verifierade domänen |
| `/api/cron/sla` svarar 503 | `CRON_SECRET` saknas i produktion |
| "Behörighet saknas" efter inloggning | din e-post finns inte i `team_member` |

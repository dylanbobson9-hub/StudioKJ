# Koppla Google-formulären till KJ Studio

När någon skickar in en ansökan hamnar den direkt i katalogen, märkt som ny
och ogranskad, och crew får ett mejl. Ingen mellanlandning i Excel.

Det tar fem minuter per formulär och görs en gång.

## 1. Öppna skriptet

1. Öppna formuläret i **redigeringsläge** (inte viewform-länken).
2. Klicka på **⋮** uppe till höger → **Skriptredigeraren** / *Apps Script*.
3. Markera allt som står där och ersätt med koden nedan.

## 2. Koden

Byt ut `INTAKE_SECRET` mot nyckeln (den ligger i Vercel under
`Settings → Environment Variables → INTAKE_SECRET`).

I det **svenska** formuläret behåller du `DEFAULT_COUNTRY = "Sweden"` — det
formuläret frågar inte efter land. I det **engelska** sätter du den till `""`,
där svarar de själva.

```javascript
const STUDIO_URL     = "https://studio-kj.vercel.app/api/intake/creator";
const INTAKE_SECRET  = "klistra-in-nyckeln-har";
const DEFAULT_COUNTRY = "Sweden";   // engelska formuläret: ""

/** Körs vid varje inskickat svar. Kopplas in en gång, se steg 3. */
function onFormSubmit(e) {
  const answers = {};
  e.response.getItemResponses().forEach(function (item) {
    const value = item.getResponse();
    answers[item.getItem().getTitle()] = Array.isArray(value) ? value.join(", ") : value;
  });

  const payload = { answers: answers };
  if (DEFAULT_COUNTRY) payload.defaults = { country: DEFAULT_COUNTRY };

  const res = UrlFetchApp.fetch(STUDIO_URL, {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + INTAKE_SECRET },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  // Syns under "Utföranden" i skriptredigeraren om något går fel.
  console.log(res.getResponseCode(), res.getContentText());
}
```

## 3. Koppla igång den

I skriptredigeraren:

1. Klicka på **klockikonen** (Utlösare / *Triggers*) i vänsterkanten.
2. **Lägg till utlösare**.
3. Ställ in:
   - Funktion: `onFormSubmit`
   - Händelsekälla: **Från formulär**
   - Händelsetyp: **När ett formulär skickas**
4. Spara. Google frågar om behörighet första gången — godkänn.

Varningen *"Google har inte verifierat appen"* är väntad: det är ditt eget
skript i ditt eget formulär. Klicka **Avancerat → Fortsätt**.

## 4. Testa

Fyll i formuläret själv en gång. Inom några sekunder ska personen ligga under
**Kreatörer → Bara nya ansökningar**, och crew ha fått ett mejl.

Blir det tyst: skriptredigeraren → **Utföranden**. Där står svarskoden.

| Kod | Betyder |
| --- | --- |
| 200 | Klart, personen ligger inne |
| 401 | Fel `INTAKE_SECRET` |
| 422 | Hittade inget namn i svaret – frågan om namn måste vara obligatorisk |
| 503 | `INTAKE_SECRET` saknas i Vercel |

## Så tolkas svaren

Frågorna matchas på nyckelord, inte exakta rubriker, så formuläret tål att
skrivas om. Testat mot båda formulären i skarpt skick — alla fält utom
"Shoe size" hittar hem.

**Och det som inte hittar hem tappas inte bort.** Hela svaret sparas ord för
ord och visas under *"Hela ansökan, ord för ord"* på kreatörens profil. En
fråga vi inte känner igen blir aldrig till att någon skrivit något som
försvann.

Söker samma person igen (samma mejladress) uppdateras profilen i stället för
att en dubblett skapas.

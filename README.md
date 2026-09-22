# Compact Timeline

Een standalone, framework-loze HTML/CSS/JS-widget voor een compacte verticale tijdlijn.
De widget is qua UX geïnspireerd op het idee van een compacte verticale tijdlijn met
datum-markers en uitklapbare items, maar is volledig zelf ontworpen: geen code, CSS-
classnamen, afbeeldingen of branding zijn overgenomen van bestaande commerciële
producten.

Geen build-tools, geen dependencies, geen externe CDN's nodig — alles werkt lokaal.

## Bestandsstructuur

```
index.html            Demo-/preview-pagina
src/timeline.css       Styling (licht + donker skin, responsive)
src/timeline.js        Vanilla JS-widget (CompactTimeline class)
src/data.example.json  Voorbeeld dataset met 10 tijdlijn-items
README.md              Deze documentatie
```

## Snel starten

1. Open `index.html` direct in de browser (dubbelklikken volstaat, geen server nodig
   — de voorbeelddata staat inline in de pagina zodat `fetch()`/CORS-beperkingen van
   het `file://`-protocol niet in de weg zitten).
2. Wil je in plaats daarvan data laden via `src/data.example.json` met `fetch()`,
   start dan een simpele lokale server, bijvoorbeeld:
   ```bash
   python -m http.server 8080
   ```
   en open vervolgens `http://localhost:8080/index.html`.

## De widget initialiseren

Voeg de CSS en JS toe aan je pagina en maak een container-element aan:

```html
<link rel="stylesheet" href="src/timeline.css">
<div id="timeline"></div>
<script src="src/timeline.js"></script>
<script>
  var timeline = new CompactTimeline('#timeline', {
    data: [ /* array met items, zie hieronder */ ],
    perPage: 4,
    skin: 'light'
  });
</script>
```

`CompactTimeline` kan ook met een DOM-element in plaats van een selector worden
aangeroepen: `new CompactTimeline(document.getElementById('timeline'), { ... })`.

## Data-opties

| Optie         | Type              | Standaard   | Omschrijving |
|---------------|-------------------|-------------|--------------|
| `data`        | `Array`           | `null`      | Array met tijdlijn-items (heeft voorrang op `dataUrl`). |
| `dataUrl`     | `string`          | `null`      | Pad naar een JSON-bestand dat via `fetch()` wordt geladen als `data` niet is gezet. |
| `perPage`     | `number`          | `4`         | Aantal items dat per keer zichtbaar is; "Laad meer" toont er telkens `perPage` extra. |
| `skin`        | `'light' \| 'dark'` | `'light'` | Kleurenschema van de widget. |
| `animate`     | `boolean`         | `true`      | Fade/slide-animatie bij het in beeld scrollen van items (via `IntersectionObserver`). |
| `showFilter`  | `boolean`         | `true`      | Toon een categorie-dropdown boven de tijdlijn (alleen als items een `category` hebben). |
| `locale`      | `string`          | `'nl-NL'`   | Locale die gebruikt wordt voor het formatteren van de datumlabels (bv. "mei 27"). |
| `linkTarget`  | `string`          | `'_self'`   | `target`-attribuut voor titels/links van items met een `url`. |
| `texts`       | `object`          | zie code    | Overschrijf UI-teksten: `readMore`, `readLess`, `loadMore`, `allCategories`, `empty`. |

### Voorbeeld met alle opties

```js
new CompactTimeline('#timeline', {
  data: [...],
  perPage: 4,
  skin: 'dark',
  animate: true,
  showFilter: true,
  locale: 'nl-NL',
  linkTarget: '_blank',
  texts: {
    readMore: 'Meer lezen',
    loadMore: 'Toon meer items'
  }
});
```

## Structuur van een item

Elk item in `data` (of in het JSON-bestand voor `dataUrl`) is een object met de
volgende velden:

| Veld       | Verplicht | Omschrijving |
|------------|-----------|--------------|
| `title`    | ja        | Titel van het item. Wordt automatisch een link als `url` is ingevuld. |
| `date`     | ja        | Datum in een door `Date()` te parsen formaat, bv. `"2024-05-27"`. Wordt getoond als ronde datum-marker (maand + dag). |
| `excerpt`  | ja        | Korte samenvattingstekst onder de titel. |
| `image`    | nee       | URL of data-URI van een thumbnail-afbeelding. |
| `content`  | nee       | Volledige tekst die uitklapt via de "Lees meer"-knop (als er geen `url` is). |
| `url`      | nee       | Als aanwezig, wordt "Lees meer" een link naar deze URL in plaats van een uitklapbare sectie. |
| `category` | nee       | Categorienaam, gebruikt voor het filter-dropdown. |

Voorbeeld:

```json
{
  "title": "Publieke bèta van start",
  "date": "2021-09-03",
  "image": "https://voorbeeld.nl/afbeelding.jpg",
  "excerpt": "Honderden vroege gebruikers krijgen toegang.",
  "url": "https://voorbeeld.nl/blog/beta-lancering",
  "category": "Release"
}
```

Zie `src/data.example.json` voor een volledig voorbeeld met 10 items.

## Publieke API

| Methode                     | Omschrijving |
|------------------------------|--------------|
| `filterByCategory(category)` | Filter de items op categorie (`'all'` toont alles). Reset ook de paginering. |
| `loadMore()`                 | Toon de volgende `perPage` items. |
| `setSkin('light' \| 'dark')` | Wissel het kleurenschema tijdens runtime. |
| `destroy()`                  | Verwijdert event listeners en ruimt de DOM van de widget op. |

## Skins (licht/donker)

Het kleurenschema wordt bepaald door een CSS-class op de container:
`ct-timeline--light` of `ct-timeline--dark`. Deze class wordt automatisch gezet door
de `skin`-optie of door `setSkin()` aan te roepen; je hoeft dit dus niet handmatig te
doen. Alle kleuren zijn opgebouwd met CSS custom properties in `timeline.css`, dus
je kunt je eigen kleurenpalet toepassen door deze variabelen te overschrijven:

```css
.ct-timeline {
  --ct-accent: #ff6b35;
  --ct-card-bg: #fafafa;
}
```

## Integreren in een bestaande website of CMS

1. Kopieer `src/timeline.css` en `src/timeline.js` naar je project (of naar de
   juiste map van je CMS-thema, bv. `wp-content/themes/jouw-thema/assets/`).
2. Laad beide bestanden in de `<head>`/vlak voor `</body>` van je pagina-template:
   ```html
   <link rel="stylesheet" href="/assets/timeline.css">
   <script src="/assets/timeline.js" defer></script>
   ```
3. Plaats een leeg container-element op de plek waar de tijdlijn moet verschijnen,
   bijvoorbeeld in een pagina, post-template of widget-gebied:
   ```html
   <div id="mijn-tijdlijn"></div>
   ```
4. Initialiseer de widget met een klein inline script (of in een los JS-bestand dat
   na `timeline.js` wordt geladen), met je eigen data of een JSON-endpoint:
   ```html
   <script>
     document.addEventListener('DOMContentLoaded', function () {
       new CompactTimeline('#mijn-tijdlijn', {
         dataUrl: '/wp-json/mijn-plugin/v1/tijdlijn',
         perPage: 4,
         skin: 'light'
       });
     });
   </script>
   ```
   In een CMS zoals WordPress kun je `dataUrl` laten wijzen naar een eigen REST-
   endpoint of ACF/CPT-export die dezelfde item-structuur oplevert als hierboven
   beschreven.
5. Omdat de widget geen externe dependencies heeft, is er geen build-stap nodig:
   de bestanden kunnen direct als statische assets worden uitgeserveerd.

## Toegankelijkheid & prestaties

- De "Lees meer"-knop voor uitklapbare items gebruikt `aria-expanded` om de status
  door te geven aan schermlezers.
- Afbeeldingen worden met `loading="lazy"` geladen.
- De animatie bij scrollen gebruikt `IntersectionObserver` en valt terug op direct
  zichtbare items als deze API niet beschikbaar is (of als `animate: false` staat).

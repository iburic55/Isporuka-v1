# Leadovi HR — Mobile app (PWA)

Mobilna aplikacija (Progressive Web App) nad bazom ugostiteljskih objekata.
Instalira se na početni ekran telefona, ima vlastitu ikonu i radi **offline**.

## Datoteke
```
mobile/
├── index.html            # cijela app (UI + logika + ugrađeni demo podaci)
├── manifest.webmanifest  # ime, ikone, boje (za instalaciju na telefon)
├── sw.js                 # service worker (offline cache)
├── icon-192.png
└── icon-512.png
```

## Brzi pregled (na računalu)
Otvori `index.html` u browseru. Radi odmah, ali za **instalaciju na telefon**
i offline rad mora biti posluženo preko http(s) (service worker to zahtijeva).

## Pokretanje na telefonu (preko lokalne mreže)
1. Na računalu, u mapi `mobile/`:
   ```bash
   python -m http.server 8080
   ```
2. Saznaj IP računala (npr. `192.168.1.10`).
3. Na telefonu (isti Wi-Fi) otvori: `http://192.168.1.10:8080`
4. **Android (Chrome):** izbornik ⋮ → *Dodaj na početni zaslon* / *Instaliraj aplikaciju*.
   **iPhone (Safari):** *Podijeli* → *Dodaj na početni zaslon*.

> Za instalaciju izvan lokalne mreže (HTTPS) deployaj mapu na bilo koji static
> hosting (Netlify, Vercel, GitHub Pages, Cloudflare Pages) — PWA tada radi svugdje.

## Funkcije
- 🔎 pretraga po nazivu i naselju
- 🏷️ chip-filtri po kategoriji (restoran, kafić, konoba, fast food, apartman, hotel, kamp)
- 📞 tap-to-call, ✉️ email, 📍 otvori lokaciju u kartama
- ⬇️ izvoz CSV: **FREE** do 25 redaka, **PRO** sve (demo ključ: `PRO-2026`)
- 📲 instalacija na početni ekran + offline rad

## Pravi podaci
Demo koristi 15 uzoraka ugrađenih u `index.html`. Za pune podatke zamijeni
ugrađeni niz sadržajem iz `../data/allplacesclean.json` (koji generira scraper),
ili dodaj `fetch('data.json')` umjesto ugrađenog niza.

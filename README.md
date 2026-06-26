# Croatia Hospitality Scraper

Scraping ugostiteljskih objekata (restorani, kafici, konobe, fast food,
apartmani, hoteli, kampovi) za **cijelu Hrvatsku** kroz svih 5500+ naselja.

Izvori podataka:
- **OpenStreetMap / Overpass API** — primarni, besplatan i legalan izvor (bez kljuca), pokriva sve POI-jeve.
- **Google Maps** — best-effort lokalno parsiranje search stranice (bez sluzbenog API-ja).
- **Gastronaut.hr** — best-effort (JSON-LD / linkovi).

> Sve parsiranje HTML-a radi se **lokalno** uz cache i throttling -> minimalan usage.

---

## Struktura

```
croatia-hospitality-scraper/
├── generate_settlements.py   # automatski generira listu svih naselja -> settlements.json
├── scrape_places.py          # 1. korak: prikuplja URL-ove i osnovne podatke
├── scrape_details.py         # 2. korak: meta tagovi (naziv, adresa, tel, email, web, lat, lon)
├── cleaner.py                # 3. korak: ciscenje + deduplikacija
├── pipeline.py               # pokrece sve korake
├── utils.py                  # zajednicki alati (HTTP, cache, parsiranje)
├── requirements.txt
├── README.md
└── data/
    ├── allplacesraw.json     # sirovi rezultati
    ├── allplacesclean.json   # ocisceno + deduplicirano
    ├── final_output.csv      # finalni CSV
    └── cache/                # lokalni cache HTML odgovora
```

---

## Instalacija

```bash
cd croatia-hospitality-scraper
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Potreban je Python 3.10+.

---

## Pokretanje

### Sve odjednom
```bash
python pipeline.py
```

### Test na manjem uzorku (preporuceno prvi put)
```bash
python pipeline.py --limit 50
```

### Korak po korak
```bash
python generate_settlements.py     # -> settlements.json (5500+ naselja)
python scrape_places.py            # -> data/allplacesraw.json
python scrape_details.py           # obogacuje allplacesraw.json
python cleaner.py                  # -> data/allplacesclean.json + data/final_output.csv
```

### Korisne opcije
```bash
python pipeline.py --source overpass     # koristi samo OpenStreetMap (najpouzdanije)
python pipeline.py --skip-details        # brze, bez 2. koraka
python scrape_places.py --limit 100      # samo prvih 100 naselja
```

---

## Output format

Svaki objekt (`allplacesclean.json` / `final_output.csv`):

| polje | opis |
|-------|------|
| name | naziv objekta |
| category | restoran / kafic / konoba / fast_food / apartman / hotel / kamp |
| settlement | naselje |
| address | adresa |
| phone | telefon (normaliziran na +385...) |
| email | email |
| website | web stranica |
| lat / lon | koordinate |
| source | izvor (openstreetmap / google_maps / gastronaut) |
| url | izvorni URL |

---

## Otpornost na prekid (resume)

`scrape_places.py` vodi checkpoint u `data/_places_progress.json` i periodicno
sprema rezultate, pa nakon prekida nastavlja gdje je stao i ne radi duplo.
Lokalni cache (`data/cache/`) sprjecava ponovno preuzimanje istih stranica.

---

## Napomene (legalno i pristojno koristenje)

- Postuj `robots.txt` i Uvjete koristenja svakog izvora. Google Maps i
  Gastronaut.hr scraping moze biti protivan njihovim ToS-ovima — Overpass /
  OpenStreetMap (ODbL) je najsigurniji izvor i daje gotovo potpunu pokrivenost.
- Throttling je namjerno postavljen na 1–2.5 s po zahtjevu; nemoj ga snizavati.
- Email i telefon su osobni podaci — pri obradi i pohrani postuj **GDPR**.
- Projekt je namijenjen istrazivackom/agregacijskom koristenju javno dostupnih podataka.

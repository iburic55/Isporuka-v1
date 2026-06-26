# Leadovi HR u Termuxu (Android)

Pokretanje scrapera i web aplikacije direktno na Android telefonu preko
[Termux](https://f-droid.org/packages/com.termux/) (preporuka: instaliraj
Termux s **F-Droid**, ne s Google Playa — Play verzija je zastarjela).

> U Termuxu mreža radi normalno, pa scraper stvarno može dohvaćati podatke
> s Google Maps / Overpass / Gastronaut (za razliku od nekih cloud okruženja).

## 1. Dohvati projekt na telefon
Ako je projekt na GitHubu:
```bash
pkg install -y git
git clone <URL-tvog-repoa>
cd <ime-repoa>/croatia-hospitality-scraper
```
Ili prekopiraj mapu `croatia-hospitality-scraper` u Termux home (`~`).

## 2. Setup (jednom)
```bash
bash termux/setup.sh
```
Instalira Python, git, dozvolu za pohranu i sve Python ovisnosti.

## 3a. Pokreni WEB APP (preglednik na telefonu)
```bash
bash termux/run-web.sh
```
Otvori u pregledniku telefona: **http://127.0.0.1:5000**

Za pristup s drugog uređaja na istoj Wi-Fi mreži:
```bash
HOST=0.0.0.0 bash termux/run-web.sh
```
(skripta ispiše IP telefona koji upišeš u preglednik druge naprave)

## 3b. Pokreni SCRAPER
```bash
bash termux/run-scraper.sh --limit 50        # test
bash termux/run-scraper.sh --source overpass # samo OpenStreetMap (najpouzdanije)
bash termux/run-scraper.sh                    # puni run (5500+ naselja — dugo!)
```
Rezultati: `data/allplacesclean.json`, `data/final_output.csv`.
CSV se automatski kopira u **Download/leadovi_hr.csv** (vidljiv u Files app-u).

## Korisni savjeti za Termux
- Spriječi gašenje procesa: instaliraj `pkg install termux-services` ili drži
  Termux u prvom planu; za duge scrape-ove koristi `--limit` u serijama.
- Da ekran ne zaspi tijekom scrapinga: `termux-wake-lock` (paket `termux-api`).
- Ako `pip install` zapne na nekom paketu: `pkg install python-pip rust` pa ponovi.
- Naš projekt treba samo `requests` i `flask` — oba se instaliraju bez kompajliranja.

## Što NE ide u Termux
Native Expo app (`mobile-native/`) se ne buildаš u Termuxu — za to koristi
`npx expo start` na računalu + Expo Go na telefonu, ili EAS Build u cloudu.
Za "app na telefonu iz Termuxa" koristi web app (3a) ili PWA iz `mobile/`.

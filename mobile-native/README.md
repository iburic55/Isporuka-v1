# Leadovi HR — Native app (Expo / React Native)

Prava native aplikacija za **iOS i Android** iz jednog koda. Lista ugostiteljskih
objekata, pretraga, filtri po kategoriji, detalji s tap-to-call / email / karte,
te izvoz CSV-a (FREE/PRO) preko native share sheeta.

## Struktura
```
mobile-native/
├── App.js                     # navigacija (List -> Detail)
├── app.json                   # Expo konfiguracija (ime, ikone, bundle id-evi)
├── package.json
├── babel.config.js
├── assets/                    # icon, adaptive-icon, splash, favicon
└── src/
    ├── data.json              # podaci (demo uzorak; zamijeni s allplacesclean.json)
    ├── theme.js
    └── screens/
        ├── ListScreen.js
        └── DetailScreen.js
```

## Preduvjeti
- Node.js 18+ (preporuka 20/22)
- Telefon s aplikacijom **Expo Go** (App Store / Google Play) za brzi preview

## Pokretanje (preview na telefonu, par minuta)
```bash
cd mobile-native
npm install
npx expo start
```
Pojavit će se **QR kod**. Skeniraj ga:
- **Android:** unutar Expo Go app → *Scan QR code*
- **iPhone:** kamerom → otvori u Expo Go

App se učita na telefonu i osvježava uživo dok mijenjaš kod.

> Računalo i telefon trebaju biti na istoj Wi-Fi mreži. Ako mreža blokira,
> pokreni `npx expo start --tunnel`.

## Build za trgovine (App Store / Google Play)
Koristi se EAS Build (cloud build, ne treba ti Mac za iOS):
```bash
npm install -g eas-cli
eas login
eas build:configure
eas build -p android        # .aab za Google Play
eas build -p ios            # za App Store (treba Apple Developer račun)
```
Objava:
```bash
eas submit -p android
eas submit -p ios
```

## Pravi podaci
`src/data.json` je demo uzorak (15 objekata). Za pune podatke prekopiraj
sadržaj `../data/allplacesclean.json` (generira scraper) u `src/data.json`.
Za veće baze preporuka je učitavanje s API-ja umjesto bundleanja u app.

## Napomene
- Unos PRO ključa koristi `Alert.prompt` (iOS). Na Androidu je demo potvrda;
  u produkciji ovdje ide prava naplata (npr. RevenueCat / Stripe).
- Telefon/email/karte rade preko `Linking` (tel:, mailto:, maps URL).

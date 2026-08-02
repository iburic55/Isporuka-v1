# Evidencija radnog vremena i bakšiša

Web aplikacija za vođenje smjena, izračun zarade po satnici i praćenje
bakšiša, sa sinkronizacijom podataka na **Google Drive**.

Nema poslužitelja ni baze — statična stranica (HTML/CSS/JS) koja podatke drži
u pregledniku (`localStorage`) i, ako je povežeš s Driveom, u jednoj JSON
datoteci na tvom Google računu. Može se instalirati na mobitel i raditi bez
interneta (vidi [Na mobitel, bez interneta](#na-mobitel-bez-interneta)).

## Što radi

- **Smjene** — datum, početak, kraj, pauza u minutama, satnica, bakšiš i
  napomena. Smjena koja prelazi ponoć (npr. 18:00–02:00) računa se ispravno.
- **Zarada** — sati × satnica, plus bakšiš, po smjeni i zbirno.
- **Zadnjih 30 dana s kumulativom** — dan po dan, uz stupac **Kumulativno**
  koji zbraja zaradu od početka razdoblja (100 → 300 → 600 …) i ukupan zbroj
  za svih 30 dana. Strelicama se listaju i prethodni 30-dnevni prozori.
- **„Ako radim svaki dan"** — zaseban račun „što ako", odvojen od stvarnih
  zbrojeva: upišeš dnevnicu, bakšiš po danu i broj dana pa dobiješ koliko bi
  to ispalo ukupno. Polja se popunjavaju prema zadnjem odrađenom danu, imaju
  prečace za 7 / 30 / broj dana ovog mjeseca, i pamte se između otvaranja.
- **Izvještaji** — tjedan / 30 dana / mjesec / godina / sve, s navigacijom kroz
  razdoblja, raspodjelom po danima ili tjednima i pokazateljima poput
  **bakšiša po satu** i prosjeka po smjeni.
- **Mjesec dan po dan** — pregled mjeseca prikazuje svaki dan s unesenim
  smjenama (više smjena istog dana zbraja se u jedan redak), a zadnji redak
  je stvarni zbroj za cijeli mjesec.
- **Izvoz u CSV** — filtrirane smjene ili cijelo razdoblje; točka-zarez i BOM
  pa se datoteka ispravno otvara u Excelu s hrvatskim postavkama.
- **Spremanje na uređaj** — svaka izmjena odmah se zapisuje u pohranu
  preglednika i učita pri sljedećem otvaranju. U Postavkama piše vrijeme
  zadnjeg spremanja; ako preglednik pohranu ne dopušta, na vrhu se pojavi
  upozorenje umjesto tihog gubitka podataka. Aplikacija traži i **trajnu
  pohranu** (`navigator.storage.persist`) da mobilni preglednik podatke ne
  izbaci kad mu ponestane prostora.
- **Sigurnosna kopija** — ručni izvoz/uvoz svih podataka u JSON.
- **Sinkronizacija s Driveom** — spajanje po zapisu (pobjeđuje novija izmjena)
  pa možeš unositi s mobitela i s računala.

## Na mobitel, bez interneta

Postoje dva načina; oba rade bez mreže nakon što ih jednom postaviš.

### A) Jedna datoteka koju samo preneseš na mobitel

`offline/radno-vrijeme.html` sadrži cijelu aplikaciju — HTML, CSS i JavaScript
u jednoj datoteci, bez ijednog vanjskog zahtjeva. Prebaci je na mobitel
(kabelom, e-mailom, Driveom, kako god) i otvori u pregledniku. Nema
poslužitelja, nema interneta, nema Google prijave; podaci se čuvaju na uređaju,
a prijenos na drugi uređaj ide kroz **Preuzmi JSON** / **Učitaj JSON**.

Datoteka se ponovno gradi iz izvora naredbom:

```bash
node build-offline.js
```

> **Android:** otvori je tako da u Chromeu u adresnu traku upišeš punu putanju,
> npr. `file:///sdcard/Download/radno-vrijeme.html`. Ako datoteku otvoriš preko
> aplikacije *Files*, Chrome je ponekad učita kao `content://` adresu, gdje
> spremljeni podaci ne moraju preživjeti zatvaranje kartice. Zato u svakom
> slučaju povremeno napravi **Preuzmi JSON**.
>
> **iPhone:** Safari ne otvara datoteke s uređaja na način koji čuva podatke —
> na iOS-u koristi način B.

### B) Instalacija na početni zaslon (PWA)

Aplikacija ima `manifest.webmanifest` i service worker (`sw.js`), pa se može
instalirati kao ikona na početnom zaslonu i nakon toga radi potpuno bez mreže.
Uvjet je da se **jednom** posluži preko `https://` (ili `localhost`) jer
preglednici service worker odbijaju na nesigurnim adresama.

U repozitoriju je pripremljen workflow `.github/workflows/pages.yml` koji mapu
`radno-vrijeme/` objavljuje na GitHub Pages, pa je postupak ovakav:

1. Na GitHubu: **Settings → Pages → Build and deployment → Source: GitHub
   Actions**. (Dovoljno jednom.)
2. **Actions → Objavi aplikaciju za radno vrijeme → Run workflow**, ili
   jednostavno gurni izmjenu u `radno-vrijeme/`.
3. Aplikacija je na `https://<korisnik>.github.io/<repozitorij>/` — za ovaj
   repozitorij `https://iburic55.github.io/Isporuka-v1/`.
4. Otvori tu adresu na mobitelu.
5. Chrome: izbornik ⋮ → **Instaliraj aplikaciju** (ili *Dodaj na početni
   zaslon*). Safari: *Podijeli* → **Dodaj na početni zaslon**.

Objavljuje se samo kod aplikacije; unesene smjene nikad ne napuštaju uređaj
jer se drže u pohrani preglednika.

Nakon instalacije aplikacija se otvara kao zasebna aplikacija, u punom zaslonu
i bez adresne trake, te radi u zrakoplovnom načinu rada. Internet treba samo
ako koristiš sinkronizaciju s Google Driveom.

## Pokretanje

Za osnovni rad dovoljno je otvoriti `index.html` u pregledniku. Za prijavu na
Google Drive stranicu treba poslužiti preko `http://localhost` jer Google ne
dopušta prijavu s `file://` adrese:

```bash
# iz korijena repozitorija
python3 -m http.server 8080 --directory radno-vrijeme
# pa otvori http://localhost:8080
```

## Povezivanje s Google Driveom

Aplikacija nema ugrađene ključeve — koristiš vlastiti OAuth Client ID, pa
podaci idu isključivo na tvoj Google račun. Postavljanje je jednokratno:

1. Otvori [Google Cloud Console](https://console.cloud.google.com/) i kreiraj
   projekt (npr. „Radno vrijeme").
2. **APIs & Services → Library** → uključi **Google Drive API**.
3. **APIs & Services → OAuth consent screen** → tip *External*, upiši naziv i
   svoj e-mail. Dok je aplikacija u načinu *Testing*, pod **Test users** dodaj
   svoju Google adresu.
4. **APIs & Services → Credentials → Create credentials → OAuth client ID** →
   tip **Web application**. Pod *Authorized JavaScript origins* dodaj adresu s
   koje otvaraš aplikaciju, npr. `http://localhost:8080`.
5. Kopiraj **Client ID** (oblik `123456789-abc.apps.googleusercontent.com`) u
   aplikaciji pod **Postavke → Google OAuth Client ID** i spremi.
6. Klikni **Poveži s Driveom** i odobri pristup.

Nakon toga se svaka promjena automatski sprema na Drive (uz uključenu opciju
*Automatski sinkroniziraj*), a gumb **Sinkroniziraj** u zaglavlju radi to ručno.

Traženi opseg je `drive.file`, što znači da aplikacija vidi **samo datoteku
koju je sama kreirala** (`radno-vrijeme.json`) — ne i ostatak tvog Drivea.
Pristupni token živi samo u memoriji otvorene kartice i nigdje se ne sprema.

### Korištenje na više uređaja

Isti Client ID upiši na svakom uređaju, uz istu adresu u *Authorized JavaScript
origins*. Pri svakoj sinkronizaciji lokalno i Drive stanje se spajaju po
zapisu — za svaku smjenu vrijedi verzija s novijim vremenom izmjene, a brisanja
se pamte kao oznaka pa se obrisana smjena ne vraća s drugog uređaja.

## Struktura

```
radno-vrijeme/
├── index.html               # sučelje: smjene, izvještaji, postavke
├── manifest.webmanifest     # instalacija na početni zaslon
├── sw.js                    # service worker: rad bez mreže
├── build-offline.js         # gradi jednodatotečnu verziju
├── css/styles.css           # vizualni identitet, svijetla i tamna tema
├── icons/                   # ikone aplikacije (192, 512, maskable)
├── offline/
│   └── radno-vrijeme.html   # cijela aplikacija u jednoj datoteci
└── js/
    ├── store.js             # model podataka, localStorage, spajanje stanja
    ├── drive.js             # Google Identity Services + Drive REST API v3
    └── app.js               # izračuni, prikaz, izvoz, sinkronizacija
```

Dijelovi `index.html` označeni s `<!-- drive:start -->` / `<!-- drive:end -->`
izostavljaju se pri gradnji offline verzije, pa logika u `js/app.js` ostaje
zajednička objema verzijama.

## Pretpostavke

- Kraj smjene raniji od početka tumači se kao rad preko ponoći (do 24 h).
- Pauza se oduzima od ukupnog trajanja i ne plaća se.
- Satnica se pamti po smjeni, pa promjena zadane satnice ne mijenja
  ranije unesene smjene.
- Tjedan počinje ponedjeljkom (ISO 8601), kao i broj tjedna u izvještaju.
- Kartica „Ako radim svaki dan" jedini je izračun koji nije stvarno stanje;
  množi upisanu dnevnicu i bakšiš s brojem dana i ni na koji način ne dira
  evidenciju.
- Ostali izvještaji prikazuju isključivo uneseno — nema procjena ni
  ekstrapolacije.
  Tjedan i mjesec grupiraju se po danima, godina po mjesecima, „Sve" po
  godinama; dani bez unesene smjene ne pojavljuju se u tablici.
- Bez povezanog Drivea podaci žive samo u pregledniku tog uređaja; brisanje
  podataka preglednika ih briše. Za tu situaciju postoji izvoz u JSON.

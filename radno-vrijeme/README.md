# Evidencija radnog vremena i bakšiša

Web aplikacija za vođenje smjena, izračun zarade po satnici i praćenje
bakšiša, sa sinkronizacijom podataka na **Google Drive**.

Nema poslužitelja ni baze — statična stranica (HTML/CSS/JS) koja podatke drži
u pregledniku (`localStorage`) i, ako je povežeš s Driveom, u jednoj JSON
datoteci na tvom Google računu.

## Što radi

- **Smjene** — datum, početak, kraj, pauza u minutama, satnica, bakšiš i
  napomena. Smjena koja prelazi ponoć (npr. 18:00–02:00) računa se ispravno.
- **Zarada** — sati × satnica, plus bakšiš, po smjeni i zbirno.
- **Izvještaji** — tjedan / mjesec / godina / sve, s navigacijom kroz
  razdoblja, raspodjelom po danima ili tjednima i pokazateljima poput
  **bakšiša po satu** i prosjeka po smjeni.
- **Mjesec dan po dan** — pregled mjeseca prikazuje svaki dan s unesenim
  smjenama (više smjena istog dana zbraja se u jedan redak), a zadnji redak
  je stvarni zbroj za cijeli mjesec.
- **Izvoz u CSV** — filtrirane smjene ili cijelo razdoblje; točka-zarez i BOM
  pa se datoteka ispravno otvara u Excelu s hrvatskim postavkama.
- **Sigurnosna kopija** — ručni izvoz/uvoz svih podataka u JSON.
- **Sinkronizacija s Driveom** — spajanje po zapisu (pobjeđuje novija izmjena)
  pa možeš unositi s mobitela i s računala.

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
├── index.html          # sučelje: smjene, izvještaji, postavke
├── css/styles.css      # vizualni identitet, svijetla i tamna tema
└── js/
    ├── store.js        # model podataka, localStorage, spajanje stanja
    ├── drive.js        # Google Identity Services + Drive REST API v3
    └── app.js          # izračuni, prikaz, izvoz, sinkronizacija
```

## Pretpostavke

- Kraj smjene raniji od početka tumači se kao rad preko ponoći (do 24 h).
- Pauza se oduzima od ukupnog trajanja i ne plaća se.
- Satnica se pamti po smjeni, pa promjena zadane satnice ne mijenja
  ranije unesene smjene.
- Tjedan počinje ponedjeljkom (ISO 8601), kao i broj tjedna u izvještaju.
- Izvještaji prikazuju isključivo uneseno — nema procjena ni ekstrapolacije.
  Tjedan i mjesec grupiraju se po danima, godina po mjesecima, „Sve" po
  godinama; dani bez unesene smjene ne pojavljuju se u tablici.
- Bez povezanog Drivea podaci žive samo u pregledniku tog uređaja; brisanje
  podataka preglednika ih briše. Za tu situaciju postoji izvoz u JSON.

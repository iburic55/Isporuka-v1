# Upravljanje partnerima (Partner Management)

Web aplikacija za vođenje partnera i njihovih polica. Lista partnera s
detaljima u modalu, forma za unos partnera s potpunom validacijom te AJAX unos
polica koji u stvarnom vremenu označava „velike" partnere.

## Tehnološki stack

- **ASP.NET Core 8 MVC** (C#)
- **Dapper** (micro ORM) — isključivo parametrizirani upiti
- **SQL Server (LocalDB)** + T-SQL shema (CHECK / UNIQUE / FK ograničenja, indeksi)
- **Bootstrap 4** (CDN), Razor Views, jQuery **unobtrusive** validacija (CDN)

## Struktura projekta

```
/
├── PartnerManagement.sln
├── README.md
├── .gitignore
├── db/
│   ├── 01_schema.sql          # tablice, ograničenja, indeksi
│   └── 02_seed.sql            # opcionalni demo podaci
└── src/PartnerManagement.Web/
    ├── Program.cs             # DI, anti-forgery, invarijantna kultura, HTTPS/HSTS
    ├── appsettings.json       # ConnectionStrings:Default (LocalDB)
    ├── Controllers/           # PartnersController, PoliciesController, HomeController
    ├── Models/                # ulazni (PartnerInput, PolicyInput) + čitalački modeli
    ├── Data/                  # IDbConnectionFactory + Dapper repozitoriji
    ├── Validation/            # OIB validator + atribut + regex obrasci
    ├── Views/Partners/        # Index.cshtml, Create.cshtml
    ├── Views/Shared/          # _Layout.cshtml, Error.cshtml, _ValidationScriptsPartial
    └── wwwroot/{css,js}       # site.css, partners.js, oib-validation.js
```

## Preduvjeti

- [.NET SDK 8.0](https://dotnet.microsoft.com/download/dotnet/8.0)
- **SQL Server LocalDB** (dolazi uz Visual Studio ili „SQL Server Express LocalDB").
  LocalDB je dostupan na **Windowsu**. Na drugim platformama koristite punu
  instancu SQL Servera i prilagodite connection string (vidi niže).
- `sqlcmd` (uz SQL Server alate) za pokretanje SQL skripti.

## 1) Postavljanje baze

Kreirajte bazu, tablice i (opcionalno) demo podatke:

```powershell
# Iz korijena repozitorija
sqlcmd -S "(localdb)\MSSQLLocalDB" -i db\01_schema.sql
sqlcmd -S "(localdb)\MSSQLLocalDB" -i db\02_seed.sql   # opcionalno
```

`01_schema.sql` je idempotentan: kreira bazu `PartnerManagement` ako ne postoji
te (re)kreira tablice. Šifrarnik `PartnerType` (1 = Personal, 2 = Legal) puni se
u `02_seed.sql` — pokrenite barem taj dio prije unosa partnera.

> **Napomena:** ako koristite punu instancu SQL Servera, izmijenite
> `ConnectionStrings:Default` u `src/PartnerManagement.Web/appsettings.json`,
> npr.:
> ```
> Server=localhost;Database=PartnerManagement;User Id=sa;Password=...;TrustServerCertificate=True
> ```

## 2) Pokretanje aplikacije

```bash
cd src/PartnerManagement.Web
dotnet run
```

Aplikacija se prema zadanim postavkama otvara na adresi koju ispiše konzola
(npr. `http://localhost:5146`). Početna stranica je **lista partnera**.

Build / provjera kompilacije:

```bash
dotnet build PartnerManagement.sln -c Release
```

## Funkcionalnosti

### Lista partnera (`/`)
- Stupci: **Ime i prezime** (spojeni `FirstName` + `LastName`), Broj partnera, OIB,
  Tip, Datum zapisa (UTC), Inozemni, Spol. (Namjerno se **ne** prikazuju kao
  zasebni stupci: FirstName, LastName, Address, CreateByUser, ExternalCode.)
- Sortirano po datumu zapisa, **najnoviji prvi**.
- **Klik na redak** otvara modal sa **svim** detaljima (ime/prezime i ovdje kao
  FullName). Modal se zatvara i može se otvoriti drugi partner.
- Gumb **„+ Unesi partnera"** vodi na formu za unos.
- Gumb **„Unesi policu"** otvara modal (broj police, iznos, odabir partnera).
- Partner s **više od 5 polica** ILI **ukupnim iznosom polica > 5000** označen je
  znakom **`*`** ispred imena. Oznaka se ažurira **u stvarnom vremenu** nakon
  AJAX unosa police (bez osvježavanja stranice).

### Forma za unos partnera (`/Partners/Create`)
- Sva polja partnera s validacijom na **klijentu** (jQuery unobtrusive) i
  **serveru** (DataAnnotations), uz dodatna pravila u bazi.
- Nakon uspješnog spremanja korisnik se vraća na listu gdje je novouneseni
  partner na **vrhu** i **vizualno istaknut** (svjetlija pozadina + bold).

### Unos police (modal, AJAX)
- Odabir partnera, broj police (10–15 alfanumerik), iznos (> 0).
- Sprema se preko AJAX-a i ažurira oznaku `*` ciljanog partnera.

## Validacija i sigurnost

- **Dva sloja validacije:** DataAnnotations + jQuery unobtrusive na klijentu i
  mjerodavno na serveru; poslovna pravila dodatno osigurana CHECK/UNIQUE/FK u bazi.
- **OIB:** prilagođeni atribut `CroatianPinAttribute` (provjera kontrolne znamenke,
  ISO 7064 MOD 11,10) + klijentski adapter `oib-validation.js`.
- **SQL injection:** isključivo parametrizirani Dapper upiti.
- **CSRF:** globalni `AutoValidateAntiforgeryToken`; AJAX unos police šalje token
  kroz HTTP zaglavlje **`RequestVerificationToken`**.
- **XSS:** zadano HTML-enkodiranje u Razoru.
- **HTTPS redirect + HSTS** izvan developmenta.
- **Invarijantna kultura** za parsiranje decimala (HTML `number` input šalje točku).
- **ExternalCode jedinstvenost:** filtrirani UNIQUE indeks (dopušta više NULL-ova);
  pri prekršaju (i race-conditionu) hvata se `SqlException` i prikazuje prijateljska
  poruka.

## Model podataka

**Partner**

| Polje | Tip / pravilo |
|---|---|
| FirstName | alfanumerik, 2–255, obavezno |
| LastName | alfanumerik, 2–255, obavezno |
| Address | alfanumerik, neobavezno |
| PartnerNumber | točno 20 znamenki, obavezno (`CHAR(20)` jer premašuje BIGINT) |
| CroatianPIN | OIB, neobavezno (11 znamenki + kontrolna znamenka) |
| PartnerTypeId | 1 = Personal ili 2 = Legal, obavezno (FK) |
| CreatedAtUtc | postavlja **baza** (`SYSUTCDATETIME()`), obavezno |
| CreateByUser | e-mail, ≤ 255, obavezno |
| IsForeign | bool, obavezno |
| ExternalCode | alfanumerik 10–20, **jedinstveno**, neobavezno (filtrirani UNIQUE, dopušta više NULL) |
| Gender | M, F ili N, obavezno |

**Policy**

| Polje | Tip / pravilo |
|---|---|
| PolicyNumber | alfanumerik, 10–15, obavezno |
| Amount | decimal, > 0, obavezno |
| PartnerId | FK na partnera |

**Indeksi:** filtrirani UNIQUE na `ExternalCode`; `IX_Partner_CreatedAtUtc (DESC)`;
`IX_Policy_PartnerId`. Lista koristi agregat polica (`COUNT`, `SUM`) za oznaku `*`.

## Pretpostavke

- **Prag `*`** = više od 5 polica **ILI** ukupan zbroj iznosa polica partnera > 5000.
- Treća „stranica" za policu realizirana je kao **modal** na listi partnera.
- `CreateByUser` se u ovom opsegu unosi na formi; u produkciji bi došao iz
  prijavljenog korisnika (autentikacija).
- LocalDB je primarno ciljano okruženje (Windows). Build se može provjeriti na
  bilo kojoj platformi; za izvođenje s podacima potreban je dostupan SQL Server.

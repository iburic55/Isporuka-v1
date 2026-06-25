/*
    Partner Management - shema baze (T-SQL / SQL Server)
    -----------------------------------------------------
    Pokretanje (LocalDB):
        sqlcmd -S "(localdb)\MSSQLLocalDB" -i db\01_schema.sql

    Skripta je idempotentna u smislu da kreira bazu ako ne postoji
    i (re)kreira tablice/ograničenja unutar te baze.
*/

IF DB_ID(N'PartnerManagement') IS NULL
BEGIN
    CREATE DATABASE [PartnerManagement];
END;
GO

USE [PartnerManagement];
GO

/* ---------------------------------------------------------------
   Čišćenje (radi ponovljivog pokretanja u developmentu).
   Redoslijed: prvo zavisne tablice (FK), pa nadređene.
   --------------------------------------------------------------- */
IF OBJECT_ID(N'dbo.Policy', N'U') IS NOT NULL DROP TABLE dbo.Policy;
IF OBJECT_ID(N'dbo.Partner', N'U') IS NOT NULL DROP TABLE dbo.Partner;
IF OBJECT_ID(N'dbo.PartnerType', N'U') IS NOT NULL DROP TABLE dbo.PartnerType;
GO

/* ---------------------------------------------------------------
   Šifrarnik tipova partnera: 1 = Personal, 2 = Legal
   --------------------------------------------------------------- */
CREATE TABLE dbo.PartnerType
(
    PartnerTypeId   INT             NOT NULL,
    Name            NVARCHAR(50)    NOT NULL,
    CONSTRAINT PK_PartnerType PRIMARY KEY (PartnerTypeId),
    CONSTRAINT CK_PartnerType_Id CHECK (PartnerTypeId IN (1, 2))
);
GO

/* ---------------------------------------------------------------
   Partner
   --------------------------------------------------------------- */
CREATE TABLE dbo.Partner
(
    PartnerId       INT             IDENTITY(1,1) NOT NULL,
    FirstName       NVARCHAR(255)   NOT NULL,
    LastName        NVARCHAR(255)   NOT NULL,
    Address         NVARCHAR(255)   NULL,
    -- 20 znamenki premašuje BIGINT, stoga CHAR(20)
    PartnerNumber   CHAR(20)        NOT NULL,
    -- Hrvatski OIB: 11 znamenki (neobavezno)
    CroatianPIN     CHAR(11)        NULL,
    PartnerTypeId   INT             NOT NULL,
    -- Vrijeme zapisa postavlja baza (UTC)
    CreatedAtUtc    DATETIME2(3)    NOT NULL CONSTRAINT DF_Partner_CreatedAtUtc DEFAULT (SYSUTCDATETIME()),
    CreateByUser    NVARCHAR(255)   NOT NULL,
    IsForeign       BIT             NOT NULL,
    ExternalCode    NVARCHAR(20)    NULL,
    Gender          CHAR(1)         NOT NULL,

    CONSTRAINT PK_Partner PRIMARY KEY (PartnerId),

    CONSTRAINT FK_Partner_PartnerType
        FOREIGN KEY (PartnerTypeId) REFERENCES dbo.PartnerType (PartnerTypeId),

    -- Spol smije biti samo M, F ili N
    CONSTRAINT CK_Partner_Gender CHECK (Gender IN ('M', 'F', 'N')),

    -- FirstName / LastName: min 2 znaka
    CONSTRAINT CK_Partner_FirstName_Len CHECK (LEN(FirstName) >= 2),
    CONSTRAINT CK_Partner_LastName_Len  CHECK (LEN(LastName) >= 2),

    -- PartnerNumber: točno 20 znamenki
    CONSTRAINT CK_Partner_PartnerNumber CHECK (PartnerNumber LIKE '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'),

    -- OIB: 11 znamenki (kontrolna znamenka se dodatno provjerava u aplikaciji)
    CONSTRAINT CK_Partner_CroatianPIN CHECK (CroatianPIN IS NULL OR CroatianPIN LIKE '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'),

    -- ExternalCode: 10-20 alfanumeričkih znakova (ako je zadan)
    CONSTRAINT CK_Partner_ExternalCode CHECK
    (
        ExternalCode IS NULL
        OR (LEN(ExternalCode) BETWEEN 10 AND 20 AND ExternalCode NOT LIKE '%[^a-zA-Z0-9]%')
    ),

    -- CreateByUser: jednostavna provjera oblika e-mail adrese
    CONSTRAINT CK_Partner_CreateByUser CHECK (CreateByUser LIKE '%_@_%._%')
);
GO

/* Filtrirani UNIQUE indeks: ExternalCode mora biti jedinstven,
   ali dopušta više NULL vrijednosti. */
CREATE UNIQUE INDEX UX_Partner_ExternalCode
    ON dbo.Partner (ExternalCode)
    WHERE ExternalCode IS NOT NULL;
GO

/* Lista je sortirana po datumu zapisa (najnoviji prvi). */
CREATE INDEX IX_Partner_CreatedAtUtc
    ON dbo.Partner (CreatedAtUtc DESC);
GO

/* ---------------------------------------------------------------
   Polica
   --------------------------------------------------------------- */
CREATE TABLE dbo.Policy
(
    PolicyId        INT             IDENTITY(1,1) NOT NULL,
    PartnerId       INT             NOT NULL,
    PolicyNumber    NVARCHAR(15)    NOT NULL,
    Amount          DECIMAL(18,2)   NOT NULL,
    CreatedAtUtc    DATETIME2(3)    NOT NULL CONSTRAINT DF_Policy_CreatedAtUtc DEFAULT (SYSUTCDATETIME()),

    CONSTRAINT PK_Policy PRIMARY KEY (PolicyId),

    CONSTRAINT FK_Policy_Partner
        FOREIGN KEY (PartnerId) REFERENCES dbo.Partner (PartnerId),

    -- PolicyNumber: 10-15 alfanumeričkih znakova
    CONSTRAINT CK_Policy_PolicyNumber CHECK
    (
        LEN(PolicyNumber) BETWEEN 10 AND 15
        AND PolicyNumber NOT LIKE '%[^a-zA-Z0-9]%'
    ),

    -- Iznos police mora biti veći od 0
    CONSTRAINT CK_Policy_Amount CHECK (Amount > 0)
);
GO

/* Indeks za agregat polica po partneru (oznaka '*'). */
CREATE INDEX IX_Policy_PartnerId
    ON dbo.Policy (PartnerId);
GO

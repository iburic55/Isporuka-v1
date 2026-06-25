/*
    Partner Management - demo podaci (opcionalno)
    ---------------------------------------------
    Pokretanje (LocalDB):
        sqlcmd -S "(localdb)\MSSQLLocalDB" -i db\02_seed.sql

    Pretpostavlja da je 01_schema.sql već pokrenut.
*/

USE [PartnerManagement];
GO

/* Šifrarnik tipova partnera. */
IF NOT EXISTS (SELECT 1 FROM dbo.PartnerType WHERE PartnerTypeId = 1)
    INSERT INTO dbo.PartnerType (PartnerTypeId, Name) VALUES (1, N'Personal');
IF NOT EXISTS (SELECT 1 FROM dbo.PartnerType WHERE PartnerTypeId = 2)
    INSERT INTO dbo.PartnerType (PartnerTypeId, Name) VALUES (2, N'Legal');
GO

/* Demo partneri (samo ako tablica još nema podataka). */
IF NOT EXISTS (SELECT 1 FROM dbo.Partner)
BEGIN
    -- OIB-ovi imaju ispravnu kontrolnu znamenku (ISO 7064 MOD 11,10).
    INSERT INTO dbo.Partner
        (FirstName, LastName, Address, PartnerNumber, CroatianPIN, PartnerTypeId, CreateByUser, IsForeign, ExternalCode, Gender)
    VALUES
        (N'Ivan',  N'Horvat', N'Ilica 1, Zagreb',      '00000000000000000001', '69435151530', 1, N'demo@example.com', 0, N'EXTCODE0001', 'M'),
        (N'Ana',   N'Kovač',  N'Vukovarska 5, Split',  '00000000000000000002', '94577403194', 1, N'demo@example.com', 0, NULL,           'F'),
        (N'ACME',  N'd.o.o.',  N'Savska 10, Zagreb',    '00000000000000000003', NULL,          2, N'demo@example.com', 1, N'EXTCODE0003', 'N');
END;
GO

/* Demo police za prvog partnera (da se vidi oznaka '*'). */
IF NOT EXISTS (SELECT 1 FROM dbo.Policy)
BEGIN
    DECLARE @p1 INT = (SELECT TOP 1 PartnerId FROM dbo.Partner ORDER BY PartnerId ASC);

    INSERT INTO dbo.Policy (PartnerId, PolicyNumber, Amount) VALUES
        (@p1, N'POL0000000001', 3000.00),
        (@p1, N'POL0000000002', 2500.00);  -- ukupno 5500 > 5000 => partner dobiva '*'
END;
GO

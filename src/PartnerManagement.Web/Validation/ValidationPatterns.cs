namespace PartnerManagement.Web.Validation;

/// <summary>
/// Centralizirani regex obrasci za validaciju ulaznih podataka. Koriste se u
/// DataAnnotations atributima na modelima (klijent + server).
/// </summary>
public static class ValidationPatterns
{
    /// <summary>Alfanumerik (slova i znamenke), bez razmaka i posebnih znakova.</summary>
    public const string Alphanumeric = "^[a-zA-Z0-9]+$";

    /// <summary>Alfanumerik uz dopuštene razmake (npr. adresa, ime tvrtke).</summary>
    public const string AlphanumericWithSpaces = @"^[a-zA-Z0-9ČčĆćĐđŠšŽž\s\.,\-]+$";

    /// <summary>Točno 20 znamenki (PartnerNumber).</summary>
    public const string TwentyDigits = "^[0-9]{20}$";

    /// <summary>Jedno slovo spola: M, F ili N.</summary>
    public const string Gender = "^[MFN]$";

    /// <summary>E-mail (jednostavan, ali dovoljan obrazac za prikaz/validaciju).</summary>
    public const string Email = @"^[^@\s]+@[^@\s]+\.[^@\s]+$";
}

namespace PartnerManagement.Web.Validation;

/// <summary>
/// Provjera hrvatskog OIB-a: 11 znamenki + kontrolna znamenka po
/// algoritmu ISO 7064, MOD 11,10.
/// </summary>
public static class OibValidator
{
    /// <summary>
    /// Vraća <c>true</c> ako je <paramref name="oib"/> ispravan OIB.
    /// Prazna/null vrijednost se ovdje smatra neispravnom; obaveznost se
    /// odlučuje na razini modela (OIB je neobavezan).
    /// </summary>
    public static bool IsValid(string? oib)
    {
        if (string.IsNullOrWhiteSpace(oib))
            return false;

        if (oib.Length != 11)
            return false;

        foreach (char c in oib)
        {
            if (c < '0' || c > '9')
                return false;
        }

        // ISO 7064, MOD 11,10
        int remainder = 10;
        for (int i = 0; i < 10; i++)
        {
            remainder += oib[i] - '0';
            remainder %= 10;
            if (remainder == 0)
                remainder = 10;
            remainder *= 2;
            remainder %= 11;
        }

        int checkDigit = 11 - remainder;
        if (checkDigit == 10)
            checkDigit = 0;

        return checkDigit == (oib[10] - '0');
    }
}

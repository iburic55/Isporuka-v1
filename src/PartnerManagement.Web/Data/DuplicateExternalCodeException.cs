namespace PartnerManagement.Web.Data;

/// <summary>
/// Baca se kada se prekrši jedinstvenost <c>ExternalCode</c> (uključujući
/// race-condition na razini baze). Kontroler ovo mapira u prijateljsku poruku.
/// </summary>
public sealed class DuplicateExternalCodeException : Exception
{
    public DuplicateExternalCodeException(string? externalCode, Exception? inner = null)
        : base($"Vanjski kod '{externalCode}' već postoji. Odaberite drugi.", inner)
    {
        ExternalCode = externalCode;
    }

    public string? ExternalCode { get; }
}

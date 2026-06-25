namespace PartnerManagement.Web.Models;

/// <summary>
/// Čitalački model za listu partnera. Sadrži sva polja partnera (za modal s
/// detaljima) te agregat polica (broj i ukupan iznos) za oznaku <c>*</c>.
/// </summary>
public sealed class PartnerListItem
{
    public int PartnerId { get; init; }
    public string FirstName { get; init; } = string.Empty;
    public string LastName { get; init; } = string.Empty;
    public string? Address { get; init; }
    public string PartnerNumber { get; init; } = string.Empty;
    public string? CroatianPIN { get; init; }
    public int PartnerTypeId { get; init; }
    public string PartnerTypeName { get; init; } = string.Empty;
    public DateTime CreatedAtUtc { get; init; }
    public string CreateByUser { get; init; } = string.Empty;
    public bool IsForeign { get; init; }
    public string? ExternalCode { get; init; }
    public string Gender { get; init; } = string.Empty;

    public int PolicyCount { get; init; }
    public decimal PolicyTotal { get; init; }

    /// <summary>Ime i prezime spojeni u jedan prikaz.</summary>
    public string FullName => $"{FirstName} {LastName}".Trim();

    /// <summary>
    /// Prag za oznaku <c>*</c>: više od 5 polica ILI ukupan iznos > 5000.
    /// </summary>
    public bool IsHighlighted => PolicyCount > 5 || PolicyTotal > 5000m;
}

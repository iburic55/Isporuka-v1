namespace PartnerManagement.Web.Models;

/// <summary>
/// View model za početnu listu partnera.
/// </summary>
public sealed class PartnerListViewModel
{
    public IReadOnlyList<PartnerListItem> Partners { get; init; } = Array.Empty<PartnerListItem>();

    /// <summary>Tipovi partnera za padajući izbornik u modalu za unos police.</summary>
    public IReadOnlyList<PartnerType> PartnerTypes { get; init; } = Array.Empty<PartnerType>();

    /// <summary>
    /// Id netom unesenog partnera (preko TempData), radi vizualnog isticanja
    /// na vrhu liste.
    /// </summary>
    public int? NewPartnerId { get; init; }
}

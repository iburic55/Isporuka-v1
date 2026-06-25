namespace PartnerManagement.Web.Models;

/// <summary>
/// Rezultat AJAX unosa police — vraća osvježeni agregat partnera kako bi se
/// oznaka <c>*</c> ažurirala u stvarnom vremenu bez osvježavanja stranice.
/// </summary>
public sealed class PolicyCreatedResult
{
    public int PartnerId { get; init; }
    public int PolicyCount { get; init; }
    public decimal PolicyTotal { get; init; }
    public bool IsHighlighted { get; init; }
}

namespace PartnerManagement.Web.Models;

/// <summary>Šifrarnik tipova partnera (1 = Personal, 2 = Legal).</summary>
public sealed class PartnerType
{
    public int PartnerTypeId { get; init; }
    public string Name { get; init; } = string.Empty;
}

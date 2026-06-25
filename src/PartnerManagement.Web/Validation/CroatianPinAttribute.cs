using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Mvc.ModelBinding.Validation;

namespace PartnerManagement.Web.Validation;

/// <summary>
/// Prilagođeni validacijski atribut za hrvatski OIB. Polje je neobavezno —
/// prazna vrijednost prolazi; ako je zadana, mora imati 11 znamenki i
/// ispravnu kontrolnu znamenku. Implementira <see cref="IClientModelValidator"/>
/// kako bi klijentska (unobtrusive) validacija dobila potrebne data-* atribute.
/// </summary>
[AttributeUsage(AttributeTargets.Property | AttributeTargets.Field, AllowMultiple = false)]
public sealed class CroatianPinAttribute : ValidationAttribute, IClientModelValidator
{
    public CroatianPinAttribute()
        : base("Neispravan OIB (mora imati 11 znamenki i ispravnu kontrolnu znamenku).")
    {
    }

    public override bool IsValid(object? value)
    {
        // Neobavezno polje: prazno je valjano.
        var oib = value as string;
        if (string.IsNullOrWhiteSpace(oib))
            return true;

        return OibValidator.IsValid(oib);
    }

    public void AddValidation(ClientModelValidationContext context)
    {
        ArgumentNullException.ThrowIfNull(context);

        MergeAttribute(context.Attributes, "data-val", "true");
        MergeAttribute(context.Attributes, "data-val-croatianpin", FormatErrorMessage(string.Empty));
    }

    private static void MergeAttribute(IDictionary<string, string> attributes, string key, string value)
    {
        if (!attributes.ContainsKey(key))
            attributes.Add(key, value);
    }

    public override string FormatErrorMessage(string name) => ErrorMessageString;
}

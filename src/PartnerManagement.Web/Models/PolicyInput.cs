using System.ComponentModel.DataAnnotations;
using PartnerManagement.Web.Validation;

namespace PartnerManagement.Web.Models;

/// <summary>
/// Ulazni model za unos police (modal / AJAX). Vezan na partnera preko
/// <see cref="PartnerId"/>.
/// </summary>
public sealed class PolicyInput
{
    [Required(ErrorMessage = "Partner je obavezan.")]
    [Display(Name = "Partner")]
    public int PartnerId { get; set; }

    [Required(ErrorMessage = "Broj police je obavezan.")]
    [StringLength(15, MinimumLength = 10, ErrorMessage = "Broj police mora imati između 10 i 15 znakova.")]
    [RegularExpression(ValidationPatterns.Alphanumeric, ErrorMessage = "Broj police smije sadržavati samo slova i znamenke.")]
    [Display(Name = "Broj police")]
    public string PolicyNumber { get; set; } = string.Empty;

    [Required(ErrorMessage = "Iznos police je obavezan.")]
    [Range(0.01, 9999999999999.99, ErrorMessage = "Iznos police mora biti veći od 0.")]
    [Display(Name = "Iznos police")]
    public decimal Amount { get; set; }
}

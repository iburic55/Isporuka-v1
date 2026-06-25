using System.ComponentModel.DataAnnotations;
using PartnerManagement.Web.Validation;

namespace PartnerManagement.Web.Models;

/// <summary>
/// Ulazni model za unos partnera (forma). DataAnnotations pokrivaju klijentsku
/// (jQuery unobtrusive) i serversku validaciju. Poslovna pravila dodatno su
/// osigurana CHECK/UNIQUE/FK ograničenjima u bazi.
/// </summary>
public sealed class PartnerInput
{
    [Required(ErrorMessage = "Ime je obavezno.")]
    [StringLength(255, MinimumLength = 2, ErrorMessage = "Ime mora imati između 2 i 255 znakova.")]
    [RegularExpression(ValidationPatterns.AlphanumericWithSpaces, ErrorMessage = "Ime smije sadržavati samo slova, znamenke i osnovne znakove.")]
    [Display(Name = "Ime")]
    public string FirstName { get; set; } = string.Empty;

    [Required(ErrorMessage = "Prezime je obavezno.")]
    [StringLength(255, MinimumLength = 2, ErrorMessage = "Prezime mora imati između 2 i 255 znakova.")]
    [RegularExpression(ValidationPatterns.AlphanumericWithSpaces, ErrorMessage = "Prezime smije sadržavati samo slova, znamenke i osnovne znakove.")]
    [Display(Name = "Prezime")]
    public string LastName { get; set; } = string.Empty;

    [StringLength(255, ErrorMessage = "Adresa smije imati najviše 255 znakova.")]
    [RegularExpression(ValidationPatterns.AlphanumericWithSpaces, ErrorMessage = "Adresa sadrži nedopuštene znakove.")]
    [Display(Name = "Adresa")]
    public string? Address { get; set; }

    [Required(ErrorMessage = "Broj partnera je obavezan.")]
    [RegularExpression(ValidationPatterns.TwentyDigits, ErrorMessage = "Broj partnera mora imati točno 20 znamenki.")]
    [Display(Name = "Broj partnera")]
    public string PartnerNumber { get; set; } = string.Empty;

    [CroatianPin]
    [Display(Name = "OIB")]
    public string? CroatianPIN { get; set; }

    [Required(ErrorMessage = "Tip partnera je obavezan.")]
    [Range(1, 2, ErrorMessage = "Tip partnera mora biti Personal (1) ili Legal (2).")]
    [Display(Name = "Tip partnera")]
    public int PartnerTypeId { get; set; }

    [Required(ErrorMessage = "E-mail korisnika je obavezan.")]
    [StringLength(255, ErrorMessage = "E-mail smije imati najviše 255 znakova.")]
    [RegularExpression(ValidationPatterns.Email, ErrorMessage = "Neispravan e-mail.")]
    [EmailAddress(ErrorMessage = "Neispravan e-mail.")]
    [Display(Name = "Korisnik (e-mail)")]
    public string CreateByUser { get; set; } = string.Empty;

    [Display(Name = "Strani državljanin / inozemni")]
    public bool IsForeign { get; set; }

    [StringLength(20, MinimumLength = 10, ErrorMessage = "Vanjski kod mora imati između 10 i 20 znakova.")]
    [RegularExpression(ValidationPatterns.Alphanumeric, ErrorMessage = "Vanjski kod smije sadržavati samo slova i znamenke.")]
    [Display(Name = "Vanjski kod")]
    public string? ExternalCode { get; set; }

    [Required(ErrorMessage = "Spol je obavezan.")]
    [RegularExpression(ValidationPatterns.Gender, ErrorMessage = "Spol mora biti M, F ili N.")]
    [Display(Name = "Spol")]
    public string Gender { get; set; } = string.Empty;
}

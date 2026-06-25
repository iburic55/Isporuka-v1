using Microsoft.AspNetCore.Mvc;
using PartnerManagement.Web.Data;
using PartnerManagement.Web.Models;

namespace PartnerManagement.Web.Controllers;

/// <summary>
/// Unos police (AJAX). Antiforgery token se šalje kroz HTTP zaglavlje
/// "RequestVerificationToken" (konfigurirano u Program.cs) i provjerava
/// globalnim <c>AutoValidateAntiforgeryToken</c> filtrom.
/// </summary>
[Route("[controller]")]
public sealed class PoliciesController : Controller
{
    private readonly PolicyRepository _policies;
    private readonly PartnerRepository _partners;

    public PoliciesController(PolicyRepository policies, PartnerRepository partners)
    {
        _policies = policies;
        _partners = partners;
    }

    // POST /Policies/Create  (AJAX, vraća JSON)
    [HttpPost("Create")]
    public async Task<IActionResult> Create([FromForm] PolicyInput input, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(new { errors = CollectErrors() });
        }

        // FK provjera (osim CHECK/FK u bazi) radi prijateljske poruke.
        if (!await _partners.ExistsAsync(input.PartnerId, cancellationToken))
        {
            ModelState.AddModelError(nameof(PolicyInput.PartnerId), "Odabrani partner ne postoji.");
            return BadRequest(new { errors = CollectErrors() });
        }

        PolicyCreatedResult result = await _policies.InsertAsync(input, cancellationToken);
        return Ok(result);
    }

    private Dictionary<string, string[]> CollectErrors()
    {
        return ModelState
            .Where(kvp => kvp.Value is { Errors.Count: > 0 })
            .ToDictionary(
                kvp => kvp.Key,
                kvp => kvp.Value!.Errors.Select(e => e.ErrorMessage).ToArray());
    }
}

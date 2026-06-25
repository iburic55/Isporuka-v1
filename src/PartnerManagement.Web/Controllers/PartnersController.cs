using Microsoft.AspNetCore.Mvc;
using PartnerManagement.Web.Data;
using PartnerManagement.Web.Models;

namespace PartnerManagement.Web.Controllers;

/// <summary>
/// Lista partnera (početna stranica) i forma za unos partnera.
/// </summary>
public sealed class PartnersController : Controller
{
    private const string NewPartnerIdKey = "NewPartnerId";

    private readonly PartnerRepository _partners;

    public PartnersController(PartnerRepository partners)
    {
        _partners = partners;
    }

    // GET / , GET /Partners , GET /Partners/Index
    [HttpGet]
    public async Task<IActionResult> Index(CancellationToken cancellationToken)
    {
        var partners = await _partners.GetAllAsync(cancellationToken);
        var types = await _partners.GetPartnerTypesAsync(cancellationToken);

        int? newPartnerId = TempData[NewPartnerIdKey] is int id ? id : null;

        var model = new PartnerListViewModel
        {
            Partners = partners,
            PartnerTypes = types,
            NewPartnerId = newPartnerId
        };

        return View(model);
    }

    // GET /Partners/Create
    [HttpGet]
    public IActionResult Create()
    {
        return View(new PartnerInput());
    }

    // POST /Partners/Create
    [HttpPost]
    public async Task<IActionResult> Create(PartnerInput input, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return View(input);
        }

        try
        {
            int newId = await _partners.InsertAsync(input, cancellationToken);

            // Proslijedi id novog partnera radi vizualnog isticanja na listi.
            TempData[NewPartnerIdKey] = newId;
            return RedirectToAction(nameof(Index));
        }
        catch (DuplicateExternalCodeException ex)
        {
            // Prijateljska poruka + hvatanje race-condition prekršaja jedinstvenosti.
            ModelState.AddModelError(nameof(PartnerInput.ExternalCode), ex.Message);
            return View(input);
        }
    }
}

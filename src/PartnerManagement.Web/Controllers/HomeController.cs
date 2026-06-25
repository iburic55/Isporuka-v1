using System.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using PartnerManagement.Web.Models;

namespace PartnerManagement.Web.Controllers;

/// <summary>Globalna stranica greške.</summary>
public sealed class HomeController : Controller
{
    [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
    public IActionResult Error()
    {
        return View(new ErrorViewModel
        {
            RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier
        });
    }
}

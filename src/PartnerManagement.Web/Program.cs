using System.Globalization;
using Microsoft.AspNetCore.Mvc;
using PartnerManagement.Web.Data;

// Invarijantna kultura: decimalni separator je točka (HTML number input šalje
// točku), neovisno o lokalnim postavkama servera.
CultureInfo.DefaultThreadCurrentCulture = CultureInfo.InvariantCulture;
CultureInfo.DefaultThreadCurrentUICulture = CultureInfo.InvariantCulture;

var builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<RequestLocalizationOptions>(options =>
{
    var invariant = new[] { CultureInfo.InvariantCulture };
    options.DefaultRequestCulture =
        new Microsoft.AspNetCore.Localization.RequestCulture(CultureInfo.InvariantCulture);
    options.SupportedCultures = invariant;
    options.SupportedUICultures = invariant;
});

// MVC + globalni anti-forgery filter (CSRF zaštita na svim mutirajućim zahtjevima).
builder.Services.AddControllersWithViews(options =>
{
    options.Filters.Add(new AutoValidateAntiforgeryTokenAttribute());
});

// AJAX šalje token kroz HTTP zaglavlje "RequestVerificationToken".
builder.Services.AddAntiforgery(options =>
{
    options.HeaderName = "RequestVerificationToken";
});

// Pristup podacima: tvornica konekcija + Dapper repozitoriji.
var connectionString = builder.Configuration.GetConnectionString("Default")
    ?? throw new InvalidOperationException("Nedostaje ConnectionStrings:Default u konfiguraciji.");

builder.Services.AddSingleton<IDbConnectionFactory>(new SqlConnectionFactory(connectionString));
builder.Services.AddScoped<PartnerRepository>();
builder.Services.AddScoped<PolicyRepository>();

var app = builder.Build();

app.UseRequestLocalization();

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    // HSTS + HTTPS redirect izvan developmenta.
    app.UseHsts();
    app.UseHttpsRedirection();
}

app.UseStaticFiles();
app.UseRouting();
app.UseAuthorization();

// Početna stranica je lista partnera.
app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Partners}/{action=Index}/{id?}");

app.Run();

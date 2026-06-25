using System.Data;

namespace PartnerManagement.Web.Data;

/// <summary>
/// Tvornica konekcija prema bazi. Apstrahira konkretnog providera radi
/// testabilnosti i centraliziranog upravljanja connection stringom.
/// </summary>
public interface IDbConnectionFactory
{
    /// <summary>Vraća otvorenu konekciju spremnu za upotrebu.</summary>
    Task<IDbConnection> CreateOpenConnectionAsync(CancellationToken cancellationToken = default);
}

using Dapper;
using Microsoft.Data.SqlClient;
using PartnerManagement.Web.Models;

namespace PartnerManagement.Web.Data;

/// <summary>
/// Pristup podacima partnera preko Dappera. Svi upiti su parametrizirani
/// (zaštita od SQL injectiona).
/// </summary>
public sealed class PartnerRepository
{
    // SQL Server brojevi grešaka za prekršaj jedinstvenosti.
    private const int UniqueIndexViolation = 2601;
    private const int UniqueConstraintViolation = 2627;

    private readonly IDbConnectionFactory _connectionFactory;

    public PartnerRepository(IDbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    private const string SelectListSql = @"
SELECT  p.PartnerId,
        p.FirstName,
        p.LastName,
        p.Address,
        p.PartnerNumber,
        p.CroatianPIN,
        p.PartnerTypeId,
        pt.Name              AS PartnerTypeName,
        p.CreatedAtUtc,
        p.CreateByUser,
        p.IsForeign,
        p.ExternalCode,
        p.Gender,
        ISNULL(agg.PolicyCount, 0) AS PolicyCount,
        ISNULL(agg.PolicyTotal, 0) AS PolicyTotal
FROM    dbo.Partner       p
JOIN    dbo.PartnerType   pt ON pt.PartnerTypeId = p.PartnerTypeId
OUTER APPLY (
        SELECT COUNT(*)        AS PolicyCount,
               SUM(po.Amount)  AS PolicyTotal
        FROM   dbo.Policy po
        WHERE  po.PartnerId = p.PartnerId
) agg
ORDER BY p.CreatedAtUtc DESC, p.PartnerId DESC;";

    public async Task<IReadOnlyList<PartnerListItem>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        using var connection = await _connectionFactory.CreateOpenConnectionAsync(cancellationToken);
        var command = new CommandDefinition(SelectListSql, cancellationToken: cancellationToken);
        var rows = await connection.QueryAsync<PartnerListItem>(command);
        return rows.AsList();
    }

    public async Task<IReadOnlyList<PartnerType>> GetPartnerTypesAsync(CancellationToken cancellationToken = default)
    {
        const string sql = "SELECT PartnerTypeId, Name FROM dbo.PartnerType ORDER BY PartnerTypeId;";
        using var connection = await _connectionFactory.CreateOpenConnectionAsync(cancellationToken);
        var command = new CommandDefinition(sql, cancellationToken: cancellationToken);
        var rows = await connection.QueryAsync<PartnerType>(command);
        return rows.AsList();
    }

    public async Task<bool> ExistsAsync(int partnerId, CancellationToken cancellationToken = default)
    {
        const string sql = "SELECT CASE WHEN EXISTS (SELECT 1 FROM dbo.Partner WHERE PartnerId = @PartnerId) THEN 1 ELSE 0 END;";
        using var connection = await _connectionFactory.CreateOpenConnectionAsync(cancellationToken);
        var command = new CommandDefinition(sql, new { PartnerId = partnerId }, cancellationToken: cancellationToken);
        return await connection.ExecuteScalarAsync<bool>(command);
    }

    private const string InsertSql = @"
INSERT INTO dbo.Partner
        (FirstName, LastName, Address, PartnerNumber, CroatianPIN,
         PartnerTypeId, CreateByUser, IsForeign, ExternalCode, Gender)
OUTPUT  INSERTED.PartnerId
VALUES  (@FirstName, @LastName, @Address, @PartnerNumber, @CroatianPIN,
         @PartnerTypeId, @CreateByUser, @IsForeign, @ExternalCode, @Gender);";

    /// <summary>
    /// Unosi partnera i vraća novi <c>PartnerId</c>. CreatedAtUtc postavlja baza
    /// (SYSUTCDATETIME()). Baca <see cref="DuplicateExternalCodeException"/> ako
    /// je prekršena jedinstvenost vanjskog koda (hvata race-condition).
    /// </summary>
    public async Task<int> InsertAsync(PartnerInput input, CancellationToken cancellationToken = default)
    {
        var parameters = new
        {
            input.FirstName,
            input.LastName,
            Address = NullIfBlank(input.Address),
            input.PartnerNumber,
            CroatianPIN = NullIfBlank(input.CroatianPIN),
            input.PartnerTypeId,
            input.CreateByUser,
            input.IsForeign,
            ExternalCode = NullIfBlank(input.ExternalCode),
            input.Gender
        };

        try
        {
            using var connection = await _connectionFactory.CreateOpenConnectionAsync(cancellationToken);
            var command = new CommandDefinition(InsertSql, parameters, cancellationToken: cancellationToken);
            return await connection.ExecuteScalarAsync<int>(command);
        }
        catch (SqlException ex) when (ex.Number is UniqueIndexViolation or UniqueConstraintViolation)
        {
            // Jedini UNIQUE indeks na tablici je filtrirani UX_Partner_ExternalCode.
            throw new DuplicateExternalCodeException(input.ExternalCode, ex);
        }
    }

    private static string? NullIfBlank(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}

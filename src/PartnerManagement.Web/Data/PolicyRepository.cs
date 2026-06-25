using Dapper;
using PartnerManagement.Web.Models;

namespace PartnerManagement.Web.Data;

/// <summary>
/// Pristup podacima polica preko Dappera (parametrizirani upiti).
/// </summary>
public sealed class PolicyRepository
{
    private readonly IDbConnectionFactory _connectionFactory;

    public PolicyRepository(IDbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    private const string InsertAndAggregateSql = @"
INSERT INTO dbo.Policy (PartnerId, PolicyNumber, Amount)
VALUES (@PartnerId, @PolicyNumber, @Amount);

SELECT  @PartnerId                       AS PartnerId,
        COUNT(*)                         AS PolicyCount,
        ISNULL(SUM(po.Amount), 0)        AS PolicyTotal
FROM    dbo.Policy po
WHERE   po.PartnerId = @PartnerId;";

    /// <summary>
    /// Unosi policu i u istom round-tripu vraća osvježeni agregat partnera
    /// (broj i ukupan iznos polica) za ažuriranje oznake <c>*</c>.
    /// </summary>
    public async Task<PolicyCreatedResult> InsertAsync(PolicyInput input, CancellationToken cancellationToken = default)
    {
        var parameters = new
        {
            input.PartnerId,
            PolicyNumber = input.PolicyNumber.Trim(),
            input.Amount
        };

        using var connection = await _connectionFactory.CreateOpenConnectionAsync(cancellationToken);
        var command = new CommandDefinition(InsertAndAggregateSql, parameters, cancellationToken: cancellationToken);
        var row = await connection.QueryFirstAsync<PolicyAggregateRow>(command);

        return new PolicyCreatedResult
        {
            PartnerId = row.PartnerId,
            PolicyCount = row.PolicyCount,
            PolicyTotal = row.PolicyTotal,
            IsHighlighted = row.PolicyCount > 5 || row.PolicyTotal > 5000m
        };
    }

    private sealed class PolicyAggregateRow
    {
        public int PartnerId { get; init; }
        public int PolicyCount { get; init; }
        public decimal PolicyTotal { get; init; }
    }
}

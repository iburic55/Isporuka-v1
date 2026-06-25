using System.Data;
using Microsoft.Data.SqlClient;

namespace PartnerManagement.Web.Data;

/// <summary>
/// Implementacija <see cref="IDbConnectionFactory"/> za SQL Server
/// (Microsoft.Data.SqlClient).
/// </summary>
public sealed class SqlConnectionFactory : IDbConnectionFactory
{
    private readonly string _connectionString;

    public SqlConnectionFactory(string connectionString)
    {
        _connectionString = connectionString
            ?? throw new ArgumentNullException(nameof(connectionString));
    }

    public async Task<IDbConnection> CreateOpenConnectionAsync(CancellationToken cancellationToken = default)
    {
        var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken).ConfigureAwait(false);
        return connection;
    }
}

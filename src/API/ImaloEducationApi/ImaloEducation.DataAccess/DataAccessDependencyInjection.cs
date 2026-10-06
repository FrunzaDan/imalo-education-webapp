using ImaloEducation.BusinessLogic.Abstractions;
using ImaloEducation.DataAccess.DBConnection;
using ImaloEducation.DataAccess.Repositories;
using Microsoft.Extensions.DependencyInjection;

namespace ImaloEducation.DataAccess;

public static class DataAccessDependencyInjection
{
    /// <summary>Registers the SQL Server implementations of the abstractions BusinessLogic declares.</summary>
    public static void AddDataAccess(this IServiceCollection services)
    {
        services.AddSingleton<ISqlConnectionFactory, SqlConnectionFactory>();
        services.AddScoped<IScholarRepository, ScholarRepository>();
    }
}

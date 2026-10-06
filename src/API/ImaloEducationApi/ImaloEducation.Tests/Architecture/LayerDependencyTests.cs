using System.Reflection;
using ImaloEducation.BusinessLogic;
using ImaloEducation.DataAccess;
using ImaloEducation.Domain.Models;
using ImaloEducation.WebAPI.Controllers;
using NetArchTest.Rules;

namespace ImaloEducation.Tests.Architecture;

// Dependencies point inward: Domain ← BusinessLogic ← DataAccess, with WebAPI composing them.
public class LayerDependencyTests
{
    private static readonly Assembly Domain = typeof(Scholar).Assembly;
    private static readonly Assembly BusinessLogic = typeof(BusinessLogicDependencyInjection).Assembly;
    private static readonly Assembly DataAccess = typeof(DataAccessDependencyInjection).Assembly;
    private static readonly Assembly WebApi = typeof(ScholarsController).Assembly;

    private static void AssertNoDependency(Assembly assembly, params string[] forbidden)
    {
        var result = Types.InAssembly(assembly)
            .ShouldNot()
            .HaveDependencyOnAny(forbidden)
            .GetResult();

        Assert.True(result.IsSuccessful, string.Join(", ", result.FailingTypeNames ?? []));
    }

    [Fact]
    public void Domain_Should_Not_Reference_AnyOtherLayer_OrFramework() =>
        AssertNoDependency(Domain,
            "ImaloEducation.BusinessLogic",
            "ImaloEducation.DataAccess",
            "ImaloEducation.WebAPI",
            "Microsoft.AspNetCore",
            "Microsoft.Data.SqlClient");

    [Fact]
    public void BusinessLogic_Should_Not_Reference_DataAccess_WebApi_AspNetCore_OrSqlClient() =>
        AssertNoDependency(BusinessLogic,
            "ImaloEducation.DataAccess",
            "ImaloEducation.WebAPI",
            "Microsoft.AspNetCore",
            "Microsoft.Data.SqlClient");

    [Fact]
    public void DataAccess_Should_Not_Reference_WebApi_OrAspNetCore() =>
        AssertNoDependency(DataAccess,
            "ImaloEducation.WebAPI",
            "Microsoft.AspNetCore");

    [Fact]
    public void Controllers_Should_Not_Reference_DataAccess_OrSqlClient()
    {
        var result = Types.InAssembly(WebApi)
            .That()
            .ResideInNamespace("ImaloEducation.WebAPI.Controllers")
            .ShouldNot()
            .HaveDependencyOnAny("ImaloEducation.DataAccess", "Microsoft.Data.SqlClient")
            .GetResult();

        Assert.True(result.IsSuccessful, string.Join(", ", result.FailingTypeNames ?? []));
    }
}

using ImaloEducation.Domain.Models;
using NetArchTest.Rules;

namespace ImaloEducation.Tests.Architecture;

public class LayerDependencyTests
{
    [Fact]
    public void Domain_Should_Not_Reference_DataAccess()
    {
        var result = Types.InAssembly(typeof(Scholar).Assembly)
            .ShouldNot()
            .HaveDependencyOn("ImaloEducation.DataAccess")
            .GetResult();

        Assert.True(result.IsSuccessful, string.Join(", ", result.FailingTypeNames ?? []));
    }
}

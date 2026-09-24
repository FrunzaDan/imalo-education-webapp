using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Options;

namespace ImaloEducationApi.Tests.Configuration;

// Program.cs validates its options at startup (ValidateOnStart): a bad value stops the app with an
// error naming the setting, rather than surfacing on the first request that needs it.
public class StartupValidationTests
{
    [Theory]
    [InlineData("ConnectionStrings:Docker", "")]
    public void TheAppRefusesToStart_WhenASettingIsInvalid(string key, string value)
    {
        using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
            builder.UseSetting(key, value));

        var exception = Assert.Throws<OptionsValidationException>(() => factory.CreateClient());
        Assert.Contains(key.Split(':')[1], exception.Message);
    }

    [Fact]
    public void TheAppStarts_WithTheCheckedInSettings()
    {
        using var factory = new WebApplicationFactory<Program>();

        using var client = factory.CreateClient();
    }
}

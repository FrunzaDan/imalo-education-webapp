using System.Net;
using System.Text;
using System.Text.Json;
using ImaloEducationApi.Data;
using ImaloEducationApi.Models;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Testing;
using Moq;

namespace ImaloEducationApi.Tests.ErrorHandling;

// Runs the real request pipeline in memory (WebApplicationFactory) with a mocked data layer, so
// what's pinned here is what a client actually receives: every error is RFC 9457 Problem Details
// (application/problem+json), whether it comes from model validation, a controller's Problem(),
// an unmatched route or an unhandled exception.
public class ErrorResponseTests
{
    private static WebApplicationFactory<Program> CreateFactory(Mock<IScholarDataAccess> dataAccess,
        string environment = "Development") =>
        new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment(environment);
            // Captures what the app logs, next to the console, for the logging assertions below.
            builder.ConfigureLogging(logging => logging.AddFakeLogging());
            // No connection string: the startup diagnostics skip their DB check.
            builder.UseSetting("ConnectionStrings:DefaultConnection", "");
            builder.ConfigureTestServices(services => services.AddScoped(_ => dataAccess.Object));
        });

    private static async Task<JsonElement> ReadProblemAsync(HttpResponseMessage response, HttpStatusCode expected)
    {
        Assert.Equal(expected, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var problem = JsonDocument.Parse(
            await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).RootElement;
        Assert.Equal((int)expected, problem.GetProperty("status").GetInt32());
        Assert.True(problem.TryGetProperty("traceId", out _), "Every problem carries a traceId to match the log.");
        return problem;
    }

    [Theory]
    [InlineData("Development", true)]
    [InlineData("Production", false)]
    public async Task UnhandledException_Returns500Problem_WithTheMessageOnlyInDevelopment(string environment,
        bool exposesMessage)
    {
        var dataAccess = new Mock<IScholarDataAccess>();
        dataAccess.Setup(d => d.GetScholarsAsync(It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("Login failed for user 'sa'."));
        await using var factory = CreateFactory(dataAccess, environment);

        var response = await factory.CreateClient().GetAsync("/api/scholars", TestContext.Current.CancellationToken);

        var problem = await ReadProblemAsync(response, HttpStatusCode.InternalServerError);
        Assert.Equal("An error occurred while processing your request.", problem.GetProperty("title").GetString());
        Assert.Equal(exposesMessage, problem.TryGetProperty("detail", out var detail));
        if (exposesMessage) Assert.Equal("Login failed for user 'sa'.", detail.GetString());

        // Logged exactly once, by GlobalExceptionHandler (ExceptionHandlerMiddleware doesn't log an
        // exception an IExceptionHandler handled).
        var error = Assert.Single(factory.Services.GetFakeLogCollector().GetSnapshot(),
            record => record.Level >= LogLevel.Error);
        Assert.Equal(1, error.Id.Id);
        Assert.IsType<InvalidOperationException>(error.Exception);
    }

    [Theory]
    [InlineData(0, 20, "pageNumber")]
    [InlineData(1, 0, "pageSize")]
    [InlineData(1, 101, "pageSize")]
    public async Task OutOfRangePaging_Returns400ValidationProblem_WithoutTouchingTheDb(int pageNumber, int pageSize,
        string invalidParameter)
    {
        var dataAccess = new Mock<IScholarDataAccess>();
        await using var factory = CreateFactory(dataAccess);

        var response = await factory.CreateClient().GetAsync(
            $"/api/scholars/audit-log/all?pageNumber={pageNumber}&pageSize={pageSize}",
            TestContext.Current.CancellationToken);

        var problem = await ReadProblemAsync(response, HttpStatusCode.BadRequest);
        Assert.True(problem.GetProperty("errors").TryGetProperty(invalidParameter, out _));
        dataAccess.Verify(
            d => d.GetAllScholarAuditLogAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task InvalidScholar_Returns400ValidationProblem_NamingTheField()
    {
        var dataAccess = new Mock<IScholarDataAccess>();
        await using var factory = CreateFactory(dataAccess);
        using var body = new StringContent("""{"firstName":"","lastName":"Popescu","birthDate":"2016-05-01"}""",
            Encoding.UTF8, "application/json");

        var response = await factory.CreateClient().PostAsync("/api/scholars", body,
            TestContext.Current.CancellationToken);

        var problem = await ReadProblemAsync(response, HttpStatusCode.BadRequest);
        Assert.True(problem.GetProperty("errors").TryGetProperty("FirstName", out _));
        dataAccess.Verify(d => d.CreateScholarAsync(It.IsAny<Scholar>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task MalformedJson_Returns400ValidationProblem()
    {
        await using var factory = CreateFactory(new Mock<IScholarDataAccess>());
        using var body = new StringContent("""{"firstName":""", Encoding.UTF8, "application/json");

        var response = await factory.CreateClient().PostAsync("/api/scholars", body,
            TestContext.Current.CancellationToken);

        var problem = await ReadProblemAsync(response, HttpStatusCode.BadRequest);
        Assert.True(problem.TryGetProperty("errors", out _));
    }

    [Fact]
    public async Task UnknownScholar_Returns404Problem_WithADetail()
    {
        var dataAccess = new Mock<IScholarDataAccess>();
        var id = Guid.NewGuid();
        dataAccess.Setup(d => d.GetScholarAsync(id, It.IsAny<CancellationToken>())).ReturnsAsync((Scholar?)null);
        await using var factory = CreateFactory(dataAccess);

        var response = await factory.CreateClient().GetAsync($"/api/scholars/{id}",
            TestContext.Current.CancellationToken);

        var problem = await ReadProblemAsync(response, HttpStatusCode.NotFound);
        Assert.Equal($"Scholar with ID {id} not found.", problem.GetProperty("detail").GetString());
    }

    [Fact]
    public async Task UnknownRoute_Returns404Problem()
    {
        await using var factory = CreateFactory(new Mock<IScholarDataAccess>());

        var response = await factory.CreateClient().GetAsync("/api/does-not-exist",
            TestContext.Current.CancellationToken);

        await ReadProblemAsync(response, HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task EveryRequest_WritesOneAccessLogLine_ExceptTheHealthPoll()
    {
        await using var factory = CreateFactory(new Mock<IScholarDataAccess>());
        // https, so an HTTP-to-HTTPS redirect doesn't add a second request to the log.
        var client = factory.CreateClient(
            new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://localhost") });

        var response = await client.GetAsync("/api/no-such-route", TestContext.Current.CancellationToken);
        await client.GetAsync("/health", TestContext.Current.CancellationToken);

        var accessLog = Assert.Single(factory.Services.GetFakeLogCollector().GetSnapshot(),
            record => record.Category == "Microsoft.AspNetCore.HttpLogging.HttpLoggingMiddleware");
        Assert.Equal(LogLevel.Information, accessLog.Level);
        Assert.Equal("GET", accessLog.GetStructuredStateValue("Method"));
        Assert.Equal("/api/no-such-route", accessLog.GetStructuredStateValue("Path"));
        Assert.Equal(((int)response.StatusCode).ToString(), accessLog.GetStructuredStateValue("StatusCode"));
    }
}

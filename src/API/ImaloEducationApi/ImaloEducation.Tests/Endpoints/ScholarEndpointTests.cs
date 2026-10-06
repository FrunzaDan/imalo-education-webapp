using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using ImaloEducation.BusinessLogic.Abstractions;
using ImaloEducation.Domain.Models;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Moq;

namespace ImaloEducation.Tests.Endpoints;

// Each endpoint as the UI calls it, through the real API with only the SQL layer faked:
// URL, HTTP method, JSON wire format, model validation and status codes.
public sealed class ScholarEndpointTests : IAsyncDisposable
{
    private static readonly Guid ScholarId = Guid.Parse("11111111-1111-1111-1111-111111111111");

    private readonly Mock<IScholarRepository> _db = new();
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;

    public ScholarEndpointTests()
    {
        _factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
            builder.ConfigureTestServices(services => services.AddScoped(_ => _db.Object)));
        _client = _factory.CreateClient();
    }

    public async ValueTask DisposeAsync()
    {
        _client.Dispose();
        await _factory.DisposeAsync();
    }

    private static CancellationToken Token => TestContext.Current.CancellationToken;

    private static Scholar Ana() => new()
    {
        ScholarId = ScholarId,
        FirstName = "Ana",
        LastName = "Pop",
        Gender = Gender.Female,
        SchoolId = 1,
        Grade = 3,
        BirthDate = new DateOnly(2018, 5, 1),
        PickupSchedule = new PickupSchedule { Monday = new TimeOnly(12, 30) },
        MotherFirstName = "Maria",
        MotherPhoneNumber = "0712345678",
    };

    // The body the UI sends for a new scholar.
    private static object NewScholarBody(int grade = 3, string monday = "12:30") => new
    {
        firstName = "Ana",
        lastName = "Pop",
        gender = 2,
        schoolId = 1,
        grade,
        birthDate = "2018-05-01",
        pickupSchedule = new { monday, tuesday = (string?)null },
        motherFirstName = "Maria",
        motherPhoneNumber = "0712345678",
    };

    private static async Task<JsonElement> ReadJsonAsync(HttpResponseMessage response, HttpStatusCode expected)
    {
        Assert.Equal(expected, response.StatusCode);
        return await response.Content.ReadFromJsonAsync<JsonElement>(Token);
    }

    private static async Task<JsonElement> ReadProblemAsync(HttpResponseMessage response, HttpStatusCode expected)
    {
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        return await ReadJsonAsync(response, expected);
    }

    [Fact]
    public async Task Post_CreatesTheScholar_AndReturns201WithItsLocation()
    {
        Scholar? sent = null;
        _db.Setup(d => d.CreateScholarAsync(It.IsAny<Scholar>(), It.IsAny<CancellationToken>()))
            .Callback<Scholar, CancellationToken>((scholar, _) => sent = scholar)
            .ReturnsAsync(Ana());

        var response = await _client.PostAsJsonAsync("/api/scholars", NewScholarBody(), Token);

        var scholar = await ReadJsonAsync(response, HttpStatusCode.Created);
        Assert.Equal($"/api/scholars/{ScholarId}", response.Headers.Location?.AbsolutePath);
        Assert.Equal(ScholarId, scholar.GetProperty("scholarId").GetGuid());
        Assert.NotNull(sent);
        Assert.Equal("Ana", sent.FirstName);
        Assert.Equal(Gender.Female, sent.Gender);
        Assert.Equal((byte)3, sent.Grade);
        Assert.Equal(new DateOnly(2018, 5, 1), sent.BirthDate);
        Assert.Equal(new TimeOnly(12, 30), sent.PickupSchedule!.Monday);
        Assert.Null(sent.PickupSchedule.Tuesday);
        Assert.Equal("0712345678", sent.MotherPhoneNumber);
    }

    [Fact]
    public async Task Post_AnOutOfRangeGrade_IsA400ValidationProblem_WithoutTouchingTheDb()
    {
        var response = await _client.PostAsJsonAsync("/api/scholars", NewScholarBody(grade: 13), Token);

        var problem = await ReadProblemAsync(response, HttpStatusCode.BadRequest);
        Assert.Equal("Grade must be between 0 and 12.",
            problem.GetProperty("errors").GetProperty("Grade")[0].GetString());
        _db.Verify(d => d.CreateScholarAsync(It.IsAny<Scholar>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Post_APickupTimeNotInHhMm_IsA400ValidationProblem_WithoutTouchingTheDb()
    {
        var response = await _client.PostAsJsonAsync("/api/scholars", NewScholarBody(monday: "1230"), Token);

        await ReadProblemAsync(response, HttpStatusCode.BadRequest);
        _db.Verify(d => d.CreateScholarAsync(It.IsAny<Scholar>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task GetAll_ReturnsTheScholarsInTheWireFormat()
    {
        _db.Setup(d => d.GetScholarsAsync(It.IsAny<CancellationToken>())).ReturnsAsync([Ana()]);

        var scholar = (await ReadJsonAsync(await _client.GetAsync("/api/scholars", Token), HttpStatusCode.OK))[0];

        Assert.Equal("Ana", scholar.GetProperty("firstName").GetString());
        Assert.Equal(2, scholar.GetProperty("gender").GetInt32());
        Assert.Equal("2018-05-01", scholar.GetProperty("birthDate").GetString());
        Assert.Equal("12:30", scholar.GetProperty("pickupSchedule").GetProperty("monday").GetString());
        Assert.Equal(JsonValueKind.Null, scholar.GetProperty("pickupSchedule").GetProperty("tuesday").ValueKind);
        Assert.Equal("Maria", scholar.GetProperty("motherFirstName").GetString());
        Assert.Equal(JsonValueKind.Null, scholar.GetProperty("fatherFirstName").ValueKind);
    }

    [Fact]
    public async Task GetOne_ReturnsThatScholar()
    {
        _db.Setup(d => d.GetScholarAsync(ScholarId, It.IsAny<CancellationToken>())).ReturnsAsync(Ana());

        var scholar = await ReadJsonAsync(await _client.GetAsync($"/api/scholars/{ScholarId}", Token), HttpStatusCode.OK);

        Assert.Equal(ScholarId, scholar.GetProperty("scholarId").GetGuid());
    }

    [Fact]
    public async Task GetOne_AnUnknownScholar_IsA404Problem()
    {
        var response = await _client.GetAsync($"/api/scholars/{ScholarId}", Token);

        var problem = await ReadProblemAsync(response, HttpStatusCode.NotFound);
        Assert.Equal($"Scholar with ID {ScholarId} not found.", problem.GetProperty("detail").GetString());
    }

    [Fact]
    public async Task Put_UpdatesTheScholar_AndReturnsIt()
    {
        Scholar? sent = null;
        _db.Setup(d => d.UpdateScholarAsync(It.IsAny<Scholar>(), It.IsAny<CancellationToken>()))
            .Callback<Scholar, CancellationToken>((scholar, _) => sent = scholar)
            .ReturnsAsync(Ana());

        var body = new { scholarId = ScholarId, firstName = "Ioana", lastName = "Pop", birthDate = "2018-05-01" };
        var response = await _client.PutAsJsonAsync($"/api/scholars/{ScholarId}", body, Token);

        await ReadJsonAsync(response, HttpStatusCode.OK);
        Assert.NotNull(sent);
        Assert.Equal(ScholarId, sent.ScholarId);
        Assert.Equal("Ioana", sent.FirstName);
    }

    [Fact]
    public async Task Put_ADifferentIdInTheBody_IsA400ValidationProblem_WithoutTouchingTheDb()
    {
        var body = new { scholarId = Guid.NewGuid(), firstName = "Ana", lastName = "Pop", birthDate = "2018-05-01" };
        var response = await _client.PutAsJsonAsync($"/api/scholars/{ScholarId}", body, Token);

        var problem = await ReadProblemAsync(response, HttpStatusCode.BadRequest);
        Assert.Equal("The scholar ID in the URL does not match the one in the request body.",
            problem.GetProperty("errors").GetProperty("scholarId")[0].GetString());
        _db.Verify(d => d.UpdateScholarAsync(It.IsAny<Scholar>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Delete_DeletesTheScholar_AndReturns204()
    {
        _db.Setup(d => d.DeleteScholarAsync(ScholarId, It.IsAny<CancellationToken>())).ReturnsAsync(true);

        var response = await _client.DeleteAsync($"/api/scholars/{ScholarId}", Token);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        _db.Verify(d => d.DeleteScholarAsync(ScholarId, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Delete_AnUnknownScholar_IsA404Problem()
    {
        var response = await _client.DeleteAsync($"/api/scholars/{ScholarId}", Token);

        await ReadProblemAsync(response, HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GetAuditLog_ReturnsTheScholarsEntries_WithTheActionAsText()
    {
        _db.Setup(d => d.GetScholarAuditLogAsync(ScholarId, It.IsAny<CancellationToken>()))
            .ReturnsAsync([
                new AuditLogEntry
                {
                    ScholarAuditLogId = 7, ScholarId = ScholarId, ActionType = AuditAction.Edited,
                    Details = "Updated: grade", OccurredAt = DateTime.UtcNow
                }
            ]);

        var response = await _client.GetAsync($"/api/scholars/{ScholarId}/audit-log", Token);

        var entry = (await ReadJsonAsync(response, HttpStatusCode.OK))[0];
        Assert.Equal(7, entry.GetProperty("scholarAuditLogId").GetInt32());
        Assert.Equal("Edited", entry.GetProperty("actionType").GetString());
        Assert.Equal("Updated: grade", entry.GetProperty("details").GetString());
    }

    [Fact]
    public async Task GetAllAuditLog_PassesThePage_AndReturnsIt()
    {
        _db.Setup(d => d.GetAllScholarAuditLogAsync(2, 5, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PagedResponse<GlobalAuditLogEntry>([], 6, 2, 5));

        var response = await _client.GetAsync("/api/scholars/audit-log/all?pageNumber=2&pageSize=5", Token);

        var page = await ReadJsonAsync(response, HttpStatusCode.OK);
        Assert.Equal(6, page.GetProperty("totalItems").GetInt32());
        Assert.Equal(2, page.GetProperty("pageNumber").GetInt32());
        Assert.Equal(5, page.GetProperty("pageSize").GetInt32());
    }

    [Fact]
    public async Task GetAllAuditLog_ATooLargePage_IsA400ValidationProblem_WithoutTouchingTheDb()
    {
        var response = await _client.GetAsync("/api/scholars/audit-log/all?pageSize=101", Token);

        var problem = await ReadProblemAsync(response, HttpStatusCode.BadRequest);
        Assert.Equal("Page size must be between 1 and 100.",
            problem.GetProperty("errors").GetProperty("pageSize")[0].GetString());
        _db.Verify(d => d.GetAllScholarAuditLogAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task DeleteAllAuditLog_ClearsTheLog_AndReturns204()
    {
        var response = await _client.DeleteAsync("/api/scholars/audit-log/all", Token);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        _db.Verify(d => d.DeleteAllScholarAuditLogAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task PostAttendance_SavesTheRecords_AndReturns204()
    {
        List<AttendanceRecord>? sent = null;
        _db.Setup(d => d.SaveAttendanceAsync(ScholarId, It.IsAny<List<AttendanceRecord>>(), It.IsAny<CancellationToken>()))
            .Callback<Guid, List<AttendanceRecord>, CancellationToken>((_, records, _) => sent = records)
            .ReturnsAsync(true);

        var response = await _client.PostAsJsonAsync($"/api/scholars/{ScholarId}/attendance", new[]
        {
            new { date = "2026-09-01", lunchCost = 15.5, transportCost = 10, present = true, lunchSelected = true, transportSelected = false },
        }, Token);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var record = Assert.Single(sent!);
        Assert.Equal(new DateOnly(2026, 9, 1), record.Date);
        Assert.Equal(15.5m, record.LunchCost);
        Assert.True(record.LunchSelected);
        Assert.False(record.TransportSelected);
    }

    [Fact]
    public async Task PostAttendance_ForAnUnknownScholar_IsA404Problem()
    {
        var response = await _client.PostAsJsonAsync($"/api/scholars/{ScholarId}/attendance",
            new[] { new { date = "2026-09-01", present = true } }, Token);

        await ReadProblemAsync(response, HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task PostAttendance_LunchOnAnAbsentDay_IsA400ValidationProblem_WithoutTouchingTheDb()
    {
        var response = await _client.PostAsJsonAsync($"/api/scholars/{ScholarId}/attendance",
            new[] { new { date = "2026-09-01", present = false, lunchSelected = true, transportSelected = false } }, Token);

        await ReadProblemAsync(response, HttpStatusCode.BadRequest);
        _db.Verify(d => d.SaveAttendanceAsync(It.IsAny<Guid>(), It.IsAny<List<AttendanceRecord>>(),
            It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task GetAttendance_ReturnsTheScholarsRecords()
    {
        _db.Setup(d => d.GetAttendanceAsync(ScholarId, It.IsAny<CancellationToken>()))
            .ReturnsAsync([new AttendanceRecord { Date = new DateOnly(2026, 9, 1), LunchCost = 15 }]);

        var response = await _client.GetAsync($"/api/scholars/{ScholarId}/attendance", Token);

        var record = (await ReadJsonAsync(response, HttpStatusCode.OK))[0];
        Assert.Equal("2026-09-01", record.GetProperty("date").GetString());
        Assert.Equal(15m, record.GetProperty("lunchCost").GetDecimal());
        Assert.True(record.GetProperty("present").GetBoolean());
    }

    [Fact]
    public async Task GetAllAttendance_ReturnsEveryScholarsRecords()
    {
        _db.Setup(d => d.GetAllAttendanceAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync([new ScholarAttendance(ScholarId, [new AttendanceRecord { Date = new DateOnly(2026, 9, 1) }])]);

        var response = await _client.GetAsync("/api/scholars/attendance", Token);

        var entry = (await ReadJsonAsync(response, HttpStatusCode.OK))[0];
        Assert.Equal(ScholarId, entry.GetProperty("scholarId").GetGuid());
        Assert.Equal("2026-09-01", entry.GetProperty("attendance")[0].GetProperty("date").GetString());
    }

    [Fact]
    public async Task DeleteAttendance_DeletesTheRecords_AndReturns204()
    {
        _db.Setup(d => d.DeleteAttendanceAsync(ScholarId, It.IsAny<CancellationToken>())).ReturnsAsync(true);

        var response = await _client.DeleteAsync($"/api/scholars/{ScholarId}/attendance", Token);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task DeleteAttendance_WhenThereIsNone_IsA404Problem()
    {
        var response = await _client.DeleteAsync($"/api/scholars/{ScholarId}/attendance", Token);

        var problem = await ReadProblemAsync(response, HttpStatusCode.NotFound);
        Assert.Equal($"No attendance record found for scholar {ScholarId}.", problem.GetProperty("detail").GetString());
    }
}

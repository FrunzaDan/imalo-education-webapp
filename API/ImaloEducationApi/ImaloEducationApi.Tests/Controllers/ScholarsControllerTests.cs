using ImaloEducationApi.Controllers;
using ImaloEducationApi.Data;
using ImaloEducationApi.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Moq;

namespace ImaloEducationApi.Tests.Controllers;

// Exercises ScholarsController against a mocked IScholarDataAccess — the controller's own
// branching (success vs. not-found vs. the rules it checks itself), not ScholarDataAccess's SQL.
// What happens before or after an action (model validation, unhandled exceptions, the Problem
// Details shape on the wire) is covered by ErrorHandling/ErrorResponseTests.
public class ScholarsControllerTests
{
    // Problem()/ValidationProblem() build their bodies with the ProblemDetailsFactory from the
    // request's services, as they do in the running app.
    private static readonly IServiceProvider Services =
        new ServiceCollection().AddLogging().AddControllers().Services.BuildServiceProvider();

    private static Scholar SampleScholar(Guid? id = null) => new()
    {
        ScholarId = id ?? Guid.NewGuid(),
        FirstName = "Ana",
        LastName = "Popescu",
        BirthDate = DateOnly.FromDateTime(DateTime.UtcNow).AddYears(-8),
    };

    private static (ScholarsController controller, Mock<IScholarDataAccess> dataAccess) MakeController()
    {
        var dataAccess = new Mock<IScholarDataAccess>();
        var controller = new ScholarsController(dataAccess.Object)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { RequestServices = Services },
            },
        };
        return (controller, dataAccess);
    }

    private static ValidationProblemDetails AssertValidationProblem(IActionResult? result)
    {
        var objectResult = Assert.IsType<ObjectResult>(result, exactMatch: false);
        Assert.Equal(StatusCodes.Status400BadRequest, objectResult.StatusCode);
        return Assert.IsType<ValidationProblemDetails>(objectResult.Value);
    }

    private static ProblemDetails AssertNotFoundProblem(IActionResult? result)
    {
        var objectResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status404NotFound, objectResult.StatusCode);
        var problem = Assert.IsType<ProblemDetails>(objectResult.Value);
        Assert.Equal(StatusCodes.Status404NotFound, problem.Status);
        return problem;
    }

    // ---------------------------------------
    // CreateScholar
    // ---------------------------------------

    [Fact]
    public async Task CreateScholar_Success_ReturnsCreatedAtActionWithScholar()
    {
        var (controller, dataAccess) = MakeController();
        var created = SampleScholar();
        dataAccess.Setup(d => d.CreateScholarAsync(It.IsAny<Scholar>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(created);

        var result = await controller.CreateScholar(SampleScholar(), TestContext.Current.CancellationToken);

        var createdAt = Assert.IsType<CreatedAtActionResult>(result.Result);
        Assert.Equal(nameof(ScholarsController.GetScholarById), createdAt.ActionName);
        Assert.Equal(created.ScholarId, ((Scholar)createdAt.Value!).ScholarId);
    }

    [Fact]
    public async Task CreateScholar_DataAccessThrows_LetsTheExceptionReachTheGlobalHandler()
    {
        var (controller, dataAccess) = MakeController();
        dataAccess.Setup(d => d.CreateScholarAsync(It.IsAny<Scholar>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("boom"));

        // Not caught here: GlobalExceptionHandler logs it and answers 500.
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            controller.CreateScholar(SampleScholar(), TestContext.Current.CancellationToken));
    }

    // ---------------------------------------
    // GetScholars / GetScholarById
    // ---------------------------------------

    [Fact]
    public async Task GetScholars_ReturnsOkWithList()
    {
        var (controller, dataAccess) = MakeController();
        var scholars = new List<Scholar> { SampleScholar(), SampleScholar() };
        dataAccess.Setup(d => d.GetScholarsAsync(It.IsAny<CancellationToken>())).ReturnsAsync(scholars);

        var result = await controller.GetScholars(TestContext.Current.CancellationToken);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var returned = Assert.IsAssignableFrom<IEnumerable<Scholar>>(ok.Value);
        Assert.Equal(2, returned.Count());
    }

    [Fact]
    public async Task GetScholarById_Found_ReturnsOk()
    {
        var (controller, dataAccess) = MakeController();
        var scholar = SampleScholar();
        dataAccess.Setup(d => d.GetScholarByIdAsync(scholar.ScholarId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(scholar);

        var result = await controller.GetScholarById(scholar.ScholarId, TestContext.Current.CancellationToken);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        Assert.Equal(scholar.ScholarId, ((Scholar)ok.Value!).ScholarId);
    }

    [Fact]
    public async Task GetScholarById_NotFound_ReturnsNotFoundProblem()
    {
        var (controller, dataAccess) = MakeController();
        var id = Guid.NewGuid();
        dataAccess.Setup(d => d.GetScholarByIdAsync(id, It.IsAny<CancellationToken>())).ReturnsAsync((Scholar?)null);

        var result = await controller.GetScholarById(id, TestContext.Current.CancellationToken);

        var problem = AssertNotFoundProblem(result.Result);
        Assert.Equal($"Scholar with ID {id} not found.", problem.Detail);
    }

    [Fact]
    public async Task GetScholarById_EmptyId_ReturnsValidationProblem_WithoutTouchingTheDb()
    {
        var (controller, dataAccess) = MakeController();

        var result = await controller.GetScholarById(Guid.Empty, TestContext.Current.CancellationToken);

        var problem = AssertValidationProblem(result.Result);
        Assert.Contains("scholarId", problem.Errors.Keys);
        dataAccess.Verify(d => d.GetScholarByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    // ---------------------------------------
    // UpdateScholar
    // ---------------------------------------

    [Fact]
    public async Task UpdateScholar_UrlIdDoesNotMatchBodyId_ReturnsValidationProblem()
    {
        var (controller, dataAccess) = MakeController();
        var scholar = SampleScholar();

        var result = await controller.UpdateScholar(Guid.NewGuid(), scholar, TestContext.Current.CancellationToken);

        var problem = AssertValidationProblem(result.Result);
        Assert.Contains(nameof(Scholar.ScholarId), problem.Errors.Keys);
        dataAccess.Verify(d => d.UpdateScholarAsync(It.IsAny<Scholar>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task UpdateScholar_NotFound_ReturnsNotFoundProblem()
    {
        var (controller, dataAccess) = MakeController();
        var scholar = SampleScholar();
        dataAccess.Setup(d => d.UpdateScholarAsync(scholar, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Scholar?)null);

        var result = await controller.UpdateScholar(scholar.ScholarId, scholar, TestContext.Current.CancellationToken);

        AssertNotFoundProblem(result.Result);
    }

    [Fact]
    public async Task UpdateScholar_Success_ReturnsOk()
    {
        var (controller, dataAccess) = MakeController();
        var scholar = SampleScholar();
        dataAccess.Setup(d => d.UpdateScholarAsync(scholar, It.IsAny<CancellationToken>())).ReturnsAsync(scholar);

        var result = await controller.UpdateScholar(scholar.ScholarId, scholar, TestContext.Current.CancellationToken);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        Assert.Equal(scholar.ScholarId, ((Scholar)ok.Value!).ScholarId);
    }

    // ---------------------------------------
    // DeleteScholar
    // ---------------------------------------

    [Fact]
    public async Task DeleteScholar_Success_ReturnsNoContent()
    {
        var (controller, dataAccess) = MakeController();
        var id = Guid.NewGuid();
        dataAccess.Setup(d => d.DeleteScholarAsync(id, It.IsAny<CancellationToken>())).ReturnsAsync(true);

        var result = await controller.DeleteScholar(id, TestContext.Current.CancellationToken);

        Assert.IsType<NoContentResult>(result);
    }

    [Fact]
    public async Task DeleteScholar_NotFound_ReturnsNotFoundProblem()
    {
        var (controller, dataAccess) = MakeController();
        var id = Guid.NewGuid();
        dataAccess.Setup(d => d.DeleteScholarAsync(id, It.IsAny<CancellationToken>())).ReturnsAsync(false);

        var result = await controller.DeleteScholar(id, TestContext.Current.CancellationToken);

        AssertNotFoundProblem(result);
    }

    // ---------------------------------------
    // Audit log endpoints
    // ---------------------------------------

    [Fact]
    public async Task GetScholarAuditLog_ReturnsOkWithEntries()
    {
        var (controller, dataAccess) = MakeController();
        var id = Guid.NewGuid();
        var entries = new List<AuditLogEntry>
        {
            new()
            {
                ScholarAuditLogId = 1, ScholarId = id, ActionType = AuditAction.Created,
                OccurredAt = new DateTime(2026, 9, 23, 10, 0, 0, DateTimeKind.Utc)
            }
        };
        dataAccess.Setup(d => d.GetAuditLogByScholarIdAsync(id, It.IsAny<CancellationToken>())).ReturnsAsync(entries);

        var result = await controller.GetScholarAuditLog(id, TestContext.Current.CancellationToken);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        Assert.Single((IEnumerable<AuditLogEntry>)ok.Value!);
    }

    [Fact]
    public async Task GetAllAuditLog_ValidPaging_ReturnsOkWithPagedResponse()
    {
        var (controller, dataAccess) = MakeController();
        var page = new PagedResponse<GlobalAuditLogEntry>([], 45, 2, 20);
        dataAccess.Setup(d => d.GetAllAuditLogAsync(2, 20, It.IsAny<CancellationToken>())).ReturnsAsync(page);

        var result = await controller.GetAllAuditLog(2, 20, TestContext.Current.CancellationToken);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        Assert.Equal(45, ((PagedResponse<GlobalAuditLogEntry>)ok.Value!).TotalItems);
    }

    [Fact]
    public async Task DeleteAllAuditLog_Success_ReturnsNoContent()
    {
        var (controller, dataAccess) = MakeController();
        dataAccess.Setup(d => d.DeleteAllAuditLogAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

        var result = await controller.DeleteAllAuditLog(TestContext.Current.CancellationToken);

        Assert.IsType<NoContentResult>(result);
    }

    // ---------------------------------------
    // Attendance endpoints
    // ---------------------------------------

    private static void VerifyAttendanceNotSaved(Mock<IScholarDataAccess> dataAccess) =>
        dataAccess.Verify(
            d => d.CreateOrUpdateAttendanceAsync(It.IsAny<Guid>(), It.IsAny<List<AttendanceRecord>>(),
                It.IsAny<CancellationToken>()), Times.Never);

    [Fact]
    public async Task CreateOrUpdateAttendance_EmptyId_ReturnsValidationProblem()
    {
        var (controller, dataAccess) = MakeController();

        var result = await controller.CreateOrUpdateAttendance(Guid.Empty, [], TestContext.Current.CancellationToken);

        AssertValidationProblem(result);
        VerifyAttendanceNotSaved(dataAccess);
    }

    [Fact]
    public async Task CreateOrUpdateAttendance_AbsentButLunchSelected_ReturnsValidationProblemNamingTheDate()
    {
        var (controller, dataAccess) = MakeController();
        var records = new List<AttendanceRecord>
        {
            new() { Date = new DateOnly(2024, 3, 4), Present = false, LunchSelected = true },
        };

        var result = await controller.CreateOrUpdateAttendance(Guid.NewGuid(), records,
            TestContext.Current.CancellationToken);

        var message = Assert.Single(AssertValidationProblem(result).Errors["attendance"]);
        Assert.Equal(
            "Lunch or Transport cannot be selected on a day the scholar was not present: 2024-03-04.", message);
        VerifyAttendanceNotSaved(dataAccess);
    }

    [Fact]
    public async Task CreateOrUpdateAttendance_AbsentButTransportSelected_ReturnsValidationProblem()
    {
        var (controller, dataAccess) = MakeController();
        var records = new List<AttendanceRecord>
        {
            new() { Date = new DateOnly(2024, 3, 4), Present = false, TransportSelected = true },
        };

        var result = await controller.CreateOrUpdateAttendance(Guid.NewGuid(), records,
            TestContext.Current.CancellationToken);

        AssertValidationProblem(result);
        VerifyAttendanceNotSaved(dataAccess);
    }

    [Fact]
    public async Task CreateOrUpdateAttendance_MultipleOffendingRecords_ListsAllDates()
    {
        var (controller, dataAccess) = MakeController();
        var records = new List<AttendanceRecord>
        {
            new() { Date = new DateOnly(2024, 3, 4), Present = true, LunchSelected = true },
            new() { Date = new DateOnly(2024, 3, 5), Present = false, LunchSelected = true },
            new() { Date = new DateOnly(2024, 3, 6), Present = false, TransportSelected = true },
        };

        var result = await controller.CreateOrUpdateAttendance(Guid.NewGuid(), records,
            TestContext.Current.CancellationToken);

        var message = Assert.Single(AssertValidationProblem(result).Errors["attendance"]);
        Assert.EndsWith(": 2024-03-05, 2024-03-06.", message);
        VerifyAttendanceNotSaved(dataAccess);
    }

    [Fact]
    public async Task CreateOrUpdateAttendance_DuplicateDates_ListsThem()
    {
        var (controller, dataAccess) = MakeController();
        var repeated = new DateOnly(2024, 3, 4);
        var records = new List<AttendanceRecord>
        {
            new() { Date = repeated },
            new() { Date = new DateOnly(2024, 3, 5) },
            new() { Date = repeated },
        };

        var result = await controller.CreateOrUpdateAttendance(Guid.NewGuid(), records,
            TestContext.Current.CancellationToken);

        var message = Assert.Single(AssertValidationProblem(result).Errors["attendance"]);
        Assert.Equal("Each date can appear only once. Repeated: 2024-03-04.", message);
        VerifyAttendanceNotSaved(dataAccess);
    }

    [Fact]
    public async Task CreateOrUpdateAttendance_BreakingBothRules_ReportsBoth()
    {
        var (controller, _) = MakeController();
        var date = new DateOnly(2024, 3, 4);
        var records = new List<AttendanceRecord>
        {
            new() { Date = date, Present = false, LunchSelected = true },
            new() { Date = date },
        };

        var result = await controller.CreateOrUpdateAttendance(Guid.NewGuid(), records,
            TestContext.Current.CancellationToken);

        Assert.Equal(2, AssertValidationProblem(result).Errors["attendance"].Length);
    }

    [Fact]
    public async Task CreateOrUpdateAttendance_AbsentAndNothingSelected_Saves()
    {
        var (controller, dataAccess) = MakeController();
        var id = Guid.NewGuid();
        var records = new List<AttendanceRecord>
        {
            new() { Date = new DateOnly(2024, 3, 4), Present = false, LunchSelected = false, TransportSelected = false },
        };

        var result = await controller.CreateOrUpdateAttendance(id, records, TestContext.Current.CancellationToken);

        Assert.IsType<NoContentResult>(result);
        dataAccess.Verify(d => d.CreateOrUpdateAttendanceAsync(id, records, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task CreateOrUpdateAttendance_Success_ReturnsNoContent()
    {
        var (controller, dataAccess) = MakeController();
        var id = Guid.NewGuid();
        var records = new List<AttendanceRecord> { new() { Date = new DateOnly(2024, 3, 4), LunchCost = 10m } };

        var result = await controller.CreateOrUpdateAttendance(id, records, TestContext.Current.CancellationToken);

        Assert.IsType<NoContentResult>(result);
        dataAccess.Verify(d => d.CreateOrUpdateAttendanceAsync(id, records, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task GetAttendance_EmptyId_ReturnsValidationProblem()
    {
        var (controller, _) = MakeController();

        var result = await controller.GetAttendance(Guid.Empty, TestContext.Current.CancellationToken);

        AssertValidationProblem(result.Result);
    }

    [Fact]
    public async Task GetAttendance_NoneYet_ReturnsOkWithEmptyList()
    {
        var (controller, dataAccess) = MakeController();
        var id = Guid.NewGuid();
        dataAccess.Setup(d => d.GetAttendanceByScholarIdAsync(id, It.IsAny<CancellationToken>()))
            .ReturnsAsync([]);

        var result = await controller.GetAttendance(id, TestContext.Current.CancellationToken);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        Assert.Empty((IEnumerable<AttendanceRecord>)ok.Value!);
    }

    [Fact]
    public async Task DeleteAttendance_EmptyId_ReturnsValidationProblem()
    {
        var (controller, _) = MakeController();

        var result = await controller.DeleteAttendance(Guid.Empty, TestContext.Current.CancellationToken);

        AssertValidationProblem(result);
    }

    [Fact]
    public async Task DeleteAttendance_NotFound_ReturnsNotFoundProblem()
    {
        var (controller, dataAccess) = MakeController();
        var id = Guid.NewGuid();
        dataAccess.Setup(d => d.DeleteAttendanceAsync(id, It.IsAny<CancellationToken>())).ReturnsAsync(false);

        var result = await controller.DeleteAttendance(id, TestContext.Current.CancellationToken);

        AssertNotFoundProblem(result);
    }

    [Fact]
    public async Task DeleteAttendance_Success_ReturnsNoContent()
    {
        var (controller, dataAccess) = MakeController();
        var id = Guid.NewGuid();
        dataAccess.Setup(d => d.DeleteAttendanceAsync(id, It.IsAny<CancellationToken>())).ReturnsAsync(true);

        var result = await controller.DeleteAttendance(id, TestContext.Current.CancellationToken);

        Assert.IsType<NoContentResult>(result);
    }

    [Fact]
    public async Task GetAllAttendance_ReturnsOkWithShapedResult()
    {
        var (controller, dataAccess) = MakeController();
        var scholarId = Guid.NewGuid();
        var records = new List<AttendanceRecord> { new() { Date = new DateOnly(2024, 3, 4) } };
        dataAccess.Setup(d => d.GetAllAttendanceAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync([new ScholarAttendance(scholarId, records)]);

        var result = await controller.GetAllAttendance(TestContext.Current.CancellationToken);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var item = Assert.Single(Assert.IsAssignableFrom<IEnumerable<ScholarAttendance>>(ok.Value));
        Assert.Equal(scholarId, item.ScholarId);
    }
}

using ImaloEducation.BusinessLogic.Abstractions;
using ImaloEducation.BusinessLogic.Contracts;
using ImaloEducation.BusinessLogic.Features.Attendance;
using ImaloEducation.BusinessLogic.Features.AuditLog;
using ImaloEducation.BusinessLogic.Features.Scholars;
using ImaloEducation.Domain.Models;
using ImaloEducation.WebAPI.Controllers;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Moq;

namespace ImaloEducation.Tests.Controllers;

public class ScholarsControllerTests
{
    private static readonly IServiceProvider Services =
        new ServiceCollection().AddLogging().AddControllers().Services.BuildServiceProvider();

    // The handlers' audit writes are covered by ScholarHandlersTests.
    private static readonly IScholarAuditLogger NoAudit = Mock.Of<IScholarAuditLogger>();

    private static CancellationToken Token => TestContext.Current.CancellationToken;

    private static ScholarRequest SampleScholar(Guid? id = null) => new()
    {
        ScholarId = id ?? Guid.NewGuid(),
        FirstName = "Ana",
        LastName = "Popescu",
        BirthDate = DateOnly.FromDateTime(DateTime.UtcNow).AddYears(-8),
    };

    private static (ScholarsController controller, Mock<IScholarRepository> repository) MakeController()
    {
        var repository = new Mock<IScholarRepository>();
        var controller = new ScholarsController
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { RequestServices = Services },
            },
        };
        return (controller, repository);
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

    [Fact]
    public async Task CreateScholar_Success_ReturnsCreatedAtActionWithScholar()
    {
        var (controller, repository) = MakeController();
        var created = SampleScholar().ToScholar();
        repository.Setup(d => d.CreateScholarAsync(It.IsAny<Scholar>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(created);

        var result = await controller.CreateScholar(SampleScholar(),
            new CreateScholarHandler(repository.Object, NoAudit), Token);

        var createdAt = Assert.IsType<CreatedAtActionResult>(result.Result);
        Assert.Equal(nameof(ScholarsController.GetScholar), createdAt.ActionName);
        Assert.Equal(created.ScholarId, ((Scholar)createdAt.Value!).ScholarId);
    }

    [Fact]
    public async Task CreateScholar_ServiceThrows_LetsTheExceptionReachTheGlobalHandler()
    {
        var (controller, repository) = MakeController();
        repository.Setup(d => d.CreateScholarAsync(It.IsAny<Scholar>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("boom"));

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            controller.CreateScholar(SampleScholar(), new CreateScholarHandler(repository.Object, NoAudit), Token));
    }

    [Fact]
    public async Task GetScholars_ReturnsOkWithList()
    {
        var (controller, repository) = MakeController();
        var scholars = new List<Scholar> { SampleScholar().ToScholar(), SampleScholar().ToScholar() };
        repository.Setup(d => d.GetScholarsAsync(It.IsAny<CancellationToken>())).ReturnsAsync(scholars);

        var result = await controller.GetScholars(new GetScholarsHandler(repository.Object), Token);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var returned = Assert.IsAssignableFrom<IEnumerable<Scholar>>(ok.Value);
        Assert.Equal(2, returned.Count());
    }

    [Fact]
    public async Task GetScholarById_Found_ReturnsOk()
    {
        var (controller, repository) = MakeController();
        var scholar = SampleScholar().ToScholar();
        repository.Setup(d => d.GetScholarAsync(scholar.ScholarId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(scholar);

        var result = await controller.GetScholar(scholar.ScholarId, new GetScholarHandler(repository.Object), Token);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        Assert.Equal(scholar.ScholarId, ((Scholar)ok.Value!).ScholarId);
    }

    [Fact]
    public async Task GetScholarById_NotFound_ReturnsNotFoundProblem()
    {
        var (controller, repository) = MakeController();
        var id = Guid.NewGuid();
        repository.Setup(d => d.GetScholarAsync(id, It.IsAny<CancellationToken>())).ReturnsAsync((Scholar?)null);

        var result = await controller.GetScholar(id, new GetScholarHandler(repository.Object), Token);

        var problem = AssertNotFoundProblem(result.Result);
        Assert.Equal($"Scholar with ID {id} not found.", problem.Detail);
    }

    [Fact]
    public async Task GetScholarById_EmptyId_ReturnsValidationProblem_WithoutTouchingTheDb()
    {
        var (controller, repository) = MakeController();

        var result = await controller.GetScholar(Guid.Empty, new GetScholarHandler(repository.Object), Token);

        var problem = AssertValidationProblem(result.Result);
        Assert.Contains("scholarId", problem.Errors.Keys);
        repository.Verify(d => d.GetScholarAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task UpdateScholar_UrlIdDoesNotMatchBodyId_ReturnsValidationProblem()
    {
        var (controller, repository) = MakeController();
        var scholar = SampleScholar();

        var result = await controller.UpdateScholar(Guid.NewGuid(), scholar,
            new UpdateScholarHandler(repository.Object, NoAudit), Token);

        var problem = AssertValidationProblem(result.Result);
        Assert.Contains(nameof(ScholarRequest.ScholarId), problem.Errors.Keys);
        repository.Verify(d => d.UpdateScholarAsync(It.IsAny<Scholar>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task UpdateScholar_NotFound_ReturnsNotFoundProblem()
    {
        var (controller, repository) = MakeController();
        var scholar = SampleScholar();
        repository.Setup(d => d.UpdateScholarAsync(It.Is<Scholar>(s => s.ScholarId == scholar.ScholarId),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync((Scholar?)null);

        var result = await controller.UpdateScholar(scholar.ScholarId, scholar,
            new UpdateScholarHandler(repository.Object, NoAudit), Token);

        AssertNotFoundProblem(result.Result);
    }

    [Fact]
    public async Task UpdateScholar_Success_ReturnsOk()
    {
        var (controller, repository) = MakeController();
        var scholar = SampleScholar();
        repository.Setup(d => d.UpdateScholarAsync(It.Is<Scholar>(s => s.ScholarId == scholar.ScholarId),
            It.IsAny<CancellationToken>())).ReturnsAsync(scholar.ToScholar());

        var result = await controller.UpdateScholar(scholar.ScholarId, scholar,
            new UpdateScholarHandler(repository.Object, NoAudit), Token);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        Assert.Equal(scholar.ScholarId, ((Scholar)ok.Value!).ScholarId);
    }

    [Fact]
    public async Task DeleteScholar_Success_ReturnsNoContent()
    {
        var (controller, repository) = MakeController();
        var id = Guid.NewGuid();
        repository.Setup(d => d.DeleteScholarAsync(id, It.IsAny<CancellationToken>())).ReturnsAsync(true);

        var result = await controller.DeleteScholar(id, new DeleteScholarHandler(repository.Object, NoAudit), Token);

        Assert.IsType<NoContentResult>(result);
    }

    [Fact]
    public async Task DeleteScholar_NotFound_ReturnsNotFoundProblem()
    {
        var (controller, repository) = MakeController();
        var id = Guid.NewGuid();
        repository.Setup(d => d.DeleteScholarAsync(id, It.IsAny<CancellationToken>())).ReturnsAsync(false);

        var result = await controller.DeleteScholar(id, new DeleteScholarHandler(repository.Object, NoAudit), Token);

        AssertNotFoundProblem(result);
    }

    [Fact]
    public async Task GetScholarAuditLog_ReturnsOkWithEntries()
    {
        var (controller, repository) = MakeController();
        var id = Guid.NewGuid();
        var entries = new List<AuditLogEntry>
        {
            new()
            {
                ScholarAuditLogId = 1, ScholarId = id, ActionType = AuditAction.Created,
                OccurredAt = new DateTime(2026, 9, 23, 10, 0, 0, DateTimeKind.Utc)
            }
        };
        repository.Setup(d => d.GetScholarAuditLogAsync(id, It.IsAny<CancellationToken>())).ReturnsAsync(entries);

        var result = await controller.GetScholarAuditLog(id, new GetScholarAuditLogHandler(repository.Object), Token);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        Assert.Single((IEnumerable<AuditLogEntry>)ok.Value!);
    }

    [Fact]
    public async Task GetAllAuditLog_ValidPaging_ReturnsOkWithPagedResponse()
    {
        var (controller, repository) = MakeController();
        var page = new PagedResponse<GlobalAuditLogEntry>([], 45, 2, 20);
        repository.Setup(d => d.GetAllScholarAuditLogAsync(2, 20, It.IsAny<CancellationToken>())).ReturnsAsync(page);

        var result = await controller.GetAllScholarAuditLog(new GetAllScholarAuditLogHandler(repository.Object), 2, 20, Token);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        Assert.Equal(45, ((PagedResponse<GlobalAuditLogEntry>)ok.Value!).TotalItems);
    }

    [Fact]
    public async Task DeleteAllAuditLog_Success_ReturnsNoContent()
    {
        var (controller, repository) = MakeController();
        repository.Setup(d => d.DeleteAllScholarAuditLogAsync(It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var result = await controller.DeleteAllScholarAuditLog(
            new DeleteAllScholarAuditLogHandler(repository.Object), Token);

        Assert.IsType<NoContentResult>(result);
    }

    private static void VerifyAttendanceNotSaved(Mock<IScholarRepository> repository) =>
        repository.Verify(
            d => d.SaveAttendanceAsync(It.IsAny<Guid>(), It.IsAny<List<AttendanceRecord>>(),
                It.IsAny<CancellationToken>()), Times.Never);

    [Fact]
    public async Task SaveAttendance_EmptyId_ReturnsValidationProblem()
    {
        var (controller, repository) = MakeController();

        var result = await controller.SaveAttendance(Guid.Empty, [],
            new SaveAttendanceHandler(repository.Object), Token);

        AssertValidationProblem(result);
        VerifyAttendanceNotSaved(repository);
    }

    [Fact]
    public async Task SaveAttendance_AbsentButLunchSelected_ReturnsValidationProblemNamingTheDate()
    {
        var (controller, repository) = MakeController();
        var records = new List<AttendanceRecordRequest>
        {
            new() { Date = new DateOnly(2024, 3, 4), Present = false, LunchSelected = true },
        };

        var result = await controller.SaveAttendance(Guid.NewGuid(), records,
            new SaveAttendanceHandler(repository.Object), Token);

        var message = Assert.Single(AssertValidationProblem(result).Errors["attendance"]);
        Assert.Equal(
            "Lunch or Transport cannot be selected on a day the scholar was not present: 2024-03-04.", message);
        VerifyAttendanceNotSaved(repository);
    }

    [Fact]
    public async Task SaveAttendance_AbsentButTransportSelected_ReturnsValidationProblem()
    {
        var (controller, repository) = MakeController();
        var records = new List<AttendanceRecordRequest>
        {
            new() { Date = new DateOnly(2024, 3, 4), Present = false, TransportSelected = true },
        };

        var result = await controller.SaveAttendance(Guid.NewGuid(), records,
            new SaveAttendanceHandler(repository.Object), Token);

        AssertValidationProblem(result);
        VerifyAttendanceNotSaved(repository);
    }

    [Fact]
    public async Task SaveAttendance_MultipleOffendingRecords_ListsAllDates()
    {
        var (controller, repository) = MakeController();
        var records = new List<AttendanceRecordRequest>
        {
            new() { Date = new DateOnly(2024, 3, 4), Present = true, LunchSelected = true },
            new() { Date = new DateOnly(2024, 3, 5), Present = false, LunchSelected = true },
            new() { Date = new DateOnly(2024, 3, 6), Present = false, TransportSelected = true },
        };

        var result = await controller.SaveAttendance(Guid.NewGuid(), records,
            new SaveAttendanceHandler(repository.Object), Token);

        var message = Assert.Single(AssertValidationProblem(result).Errors["attendance"]);
        Assert.EndsWith(": 2024-03-05, 2024-03-06.", message);
        VerifyAttendanceNotSaved(repository);
    }

    [Fact]
    public async Task SaveAttendance_DuplicateDates_ListsThem()
    {
        var (controller, repository) = MakeController();
        var repeated = new DateOnly(2024, 3, 4);
        var records = new List<AttendanceRecordRequest>
        {
            new() { Date = repeated },
            new() { Date = new DateOnly(2024, 3, 5) },
            new() { Date = repeated },
        };

        var result = await controller.SaveAttendance(Guid.NewGuid(), records,
            new SaveAttendanceHandler(repository.Object), Token);

        var message = Assert.Single(AssertValidationProblem(result).Errors["attendance"]);
        Assert.Equal("Each date can appear only once. Repeated: 2024-03-04.", message);
        VerifyAttendanceNotSaved(repository);
    }

    [Fact]
    public async Task SaveAttendance_BreakingBothRules_ReportsBoth()
    {
        var (controller, repository) = MakeController();
        var date = new DateOnly(2024, 3, 4);
        var records = new List<AttendanceRecordRequest>
        {
            new() { Date = date, Present = false, LunchSelected = true },
            new() { Date = date },
        };

        var result = await controller.SaveAttendance(Guid.NewGuid(), records,
            new SaveAttendanceHandler(repository.Object), Token);

        Assert.Equal(2, AssertValidationProblem(result).Errors["attendance"].Length);
    }

    [Fact]
    public async Task SaveAttendance_AbsentAndNothingSelected_Saves()
    {
        var (controller, repository) = MakeController();
        var id = Guid.NewGuid();
        var records = new List<AttendanceRecordRequest>
        {
            new() { Date = new DateOnly(2024, 3, 4), Present = false, LunchSelected = false, TransportSelected = false },
        };

        repository.Setup(d => d.SaveAttendanceAsync(id, It.Is<List<AttendanceRecord>>(saved =>
                saved.Select(r => r.Date).SequenceEqual(records.Select(r => r.Date))),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var result = await controller.SaveAttendance(id, records, new SaveAttendanceHandler(repository.Object), Token);

        Assert.IsType<NoContentResult>(result);
        repository.Verify(d => d.SaveAttendanceAsync(id, It.Is<List<AttendanceRecord>>(saved =>
                saved.Select(r => r.Date).SequenceEqual(records.Select(r => r.Date))),
                It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task SaveAttendance_Success_ReturnsNoContent()
    {
        var (controller, repository) = MakeController();
        var id = Guid.NewGuid();
        var records = new List<AttendanceRecordRequest> { new() { Date = new DateOnly(2024, 3, 4), LunchCost = 10m } };

        repository.Setup(d => d.SaveAttendanceAsync(id, It.Is<List<AttendanceRecord>>(saved =>
                saved.Select(r => r.Date).SequenceEqual(records.Select(r => r.Date))),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var result = await controller.SaveAttendance(id, records, new SaveAttendanceHandler(repository.Object), Token);

        Assert.IsType<NoContentResult>(result);
        repository.Verify(d => d.SaveAttendanceAsync(id, It.Is<List<AttendanceRecord>>(saved =>
                saved.Select(r => r.Date).SequenceEqual(records.Select(r => r.Date))),
                It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task SaveAttendance_UnknownScholar_ReturnsNotFoundProblem()
    {
        var (controller, repository) = MakeController();
        var id = Guid.NewGuid();
        var records = new List<AttendanceRecordRequest> { new() { Date = new DateOnly(2024, 3, 4) } };
        repository.Setup(d => d.SaveAttendanceAsync(id, It.Is<List<AttendanceRecord>>(saved =>
                saved.Select(r => r.Date).SequenceEqual(records.Select(r => r.Date))),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var result = await controller.SaveAttendance(id, records, new SaveAttendanceHandler(repository.Object), Token);

        AssertNotFoundProblem(result);
    }

    [Fact]
    public async Task GetAttendance_EmptyId_ReturnsValidationProblem()
    {
        var (controller, repository) = MakeController();

        var result = await controller.GetAttendance(Guid.Empty, new GetAttendanceHandler(repository.Object), Token);

        AssertValidationProblem(result.Result);
    }

    [Fact]
    public async Task GetAttendance_NoneYet_ReturnsOkWithEmptyList()
    {
        var (controller, repository) = MakeController();
        var id = Guid.NewGuid();
        repository.Setup(d => d.GetAttendanceAsync(id, It.IsAny<CancellationToken>()))
            .ReturnsAsync([]);

        var result = await controller.GetAttendance(id, new GetAttendanceHandler(repository.Object), Token);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        Assert.Empty((IEnumerable<AttendanceRecord>)ok.Value!);
    }

    [Fact]
    public async Task DeleteAttendance_EmptyId_ReturnsValidationProblem()
    {
        var (controller, repository) = MakeController();

        var result = await controller.DeleteAttendance(Guid.Empty,
            new DeleteAttendanceHandler(repository.Object), Token);

        AssertValidationProblem(result);
    }

    [Fact]
    public async Task DeleteAttendance_NotFound_ReturnsNotFoundProblem()
    {
        var (controller, repository) = MakeController();
        var id = Guid.NewGuid();
        repository.Setup(d => d.DeleteAttendanceAsync(id, It.IsAny<CancellationToken>())).ReturnsAsync(false);

        var result = await controller.DeleteAttendance(id, new DeleteAttendanceHandler(repository.Object), Token);

        AssertNotFoundProblem(result);
    }

    [Fact]
    public async Task DeleteAttendance_Success_ReturnsNoContent()
    {
        var (controller, repository) = MakeController();
        var id = Guid.NewGuid();
        repository.Setup(d => d.DeleteAttendanceAsync(id, It.IsAny<CancellationToken>())).ReturnsAsync(true);

        var result = await controller.DeleteAttendance(id, new DeleteAttendanceHandler(repository.Object), Token);

        Assert.IsType<NoContentResult>(result);
    }

    [Fact]
    public async Task GetAllAttendance_ReturnsOkWithShapedResult()
    {
        var (controller, repository) = MakeController();
        var scholarId = Guid.NewGuid();
        var records = new List<AttendanceRecord> { new() { Date = new DateOnly(2024, 3, 4) } };
        repository.Setup(d => d.GetAllAttendanceAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync([new ScholarAttendance(scholarId, records)]);

        var result = await controller.GetAllAttendance(new GetAllAttendanceHandler(repository.Object), Token);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var item = Assert.Single(Assert.IsAssignableFrom<IEnumerable<ScholarAttendance>>(ok.Value));
        Assert.Equal(scholarId, item.ScholarId);
    }
}

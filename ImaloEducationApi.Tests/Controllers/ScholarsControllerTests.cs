using ImaloEducationApi.Controllers;
using ImaloEducationApi.Data;
using ImaloEducationApi.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Moq;

namespace ImaloEducationApi.Tests.Controllers;

// Exercises ScholarsController against a mocked IScholarDataAccess — the controller's own
// branching (status codes, ModelState-invalid shape, not-found vs. success vs. exception),
// not ScholarDataAccess's SQL. See ai_docs/api.md: no real-DB integration tests exist yet.
public class ScholarsControllerTests
{
    private static Scholar SampleScholar(Guid? id = null) => new()
    {
        Id = id ?? Guid.NewGuid(),
        FirstName = "Ana",
        LastName = "Popescu",
        DateOfBirth = DateTime.UtcNow.AddYears(-8),
    };

    private static (ScholarsController controller, Mock<IScholarDataAccess> dataAccess) MakeController()
    {
        var dataAccess = new Mock<IScholarDataAccess>();
        var logger = new Mock<ILogger<ScholarsController>>();
        var controller = new ScholarsController(dataAccess.Object, logger.Object);
        return (controller, dataAccess);
    }

    // ---------------------------------------
    // CreateScholar
    // ---------------------------------------

    [Fact]
    public async Task CreateScholar_InvalidModelState_ReturnsBadRequestWithFieldErrors()
    {
        var (controller, dataAccess) = MakeController();
        controller.ModelState.AddModelError("FirstName", "The FirstName field is required.");

        var result = await controller.CreateScholar(SampleScholar(), CancellationToken.None);

        var badRequest = Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Equal(400, badRequest.StatusCode);
        dataAccess.Verify(d => d.CreateScholarAsync(It.IsAny<Scholar>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task CreateScholar_Success_ReturnsCreatedAtActionWithScholar()
    {
        var (controller, dataAccess) = MakeController();
        var created = SampleScholar();
        dataAccess.Setup(d => d.CreateScholarAsync(It.IsAny<Scholar>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(created);

        var result = await controller.CreateScholar(SampleScholar(), CancellationToken.None);

        var createdAt = Assert.IsType<CreatedAtActionResult>(result.Result);
        Assert.Equal(nameof(ScholarsController.GetScholarById), createdAt.ActionName);
        Assert.Equal(created.Id, ((Scholar)createdAt.Value!).Id);
    }

    [Fact]
    public async Task CreateScholar_DataAccessThrowsInvalidOperationException_Returns500()
    {
        var (controller, dataAccess) = MakeController();
        dataAccess.Setup(d => d.CreateScholarAsync(It.IsAny<Scholar>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("boom"));

        var result = await controller.CreateScholar(SampleScholar(), CancellationToken.None);

        var statusResult = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(500, statusResult.StatusCode);
    }

    [Fact]
    public async Task CreateScholar_DataAccessThrowsUnexpectedException_Returns500()
    {
        var (controller, dataAccess) = MakeController();
        dataAccess.Setup(d => d.CreateScholarAsync(It.IsAny<Scholar>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new Exception("db is down"));

        var result = await controller.CreateScholar(SampleScholar(), CancellationToken.None);

        var statusResult = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(500, statusResult.StatusCode);
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

        var result = await controller.GetScholars(CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var returned = Assert.IsAssignableFrom<IEnumerable<Scholar>>(ok.Value);
        Assert.Equal(2, returned.Count());
    }

    [Fact]
    public async Task GetScholars_DataAccessThrows_Returns500()
    {
        var (controller, dataAccess) = MakeController();
        dataAccess.Setup(d => d.GetScholarsAsync(It.IsAny<CancellationToken>())).ThrowsAsync(new Exception("boom"));

        var result = await controller.GetScholars(CancellationToken.None);

        Assert.Equal(500, ((ObjectResult)result.Result!).StatusCode);
    }

    [Fact]
    public async Task GetScholarById_Found_ReturnsOk()
    {
        var (controller, dataAccess) = MakeController();
        var scholar = SampleScholar();
        dataAccess.Setup(d => d.GetScholarByIdAsync(scholar.Id, It.IsAny<CancellationToken>())).ReturnsAsync(scholar);

        var result = await controller.GetScholarById(scholar.Id, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        Assert.Equal(scholar.Id, ((Scholar)ok.Value!).Id);
    }

    [Fact]
    public async Task GetScholarById_NotFound_Returns404()
    {
        var (controller, dataAccess) = MakeController();
        var id = Guid.NewGuid();
        dataAccess.Setup(d => d.GetScholarByIdAsync(id, It.IsAny<CancellationToken>())).ReturnsAsync((Scholar?)null);

        var result = await controller.GetScholarById(id, CancellationToken.None);

        Assert.IsType<NotFoundObjectResult>(result.Result);
    }

    // ---------------------------------------
    // UpdateScholar
    // ---------------------------------------

    [Fact]
    public async Task UpdateScholar_UrlIdDoesNotMatchBodyId_ReturnsBadRequest()
    {
        var (controller, dataAccess) = MakeController();
        var scholar = SampleScholar();

        var result = await controller.UpdateScholar(Guid.NewGuid(), scholar, CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result);
        dataAccess.Verify(d => d.UpdateScholarAsync(It.IsAny<Scholar>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task UpdateScholar_InvalidModelState_ReturnsBadRequest()
    {
        var (controller, _) = MakeController();
        var scholar = SampleScholar();
        controller.ModelState.AddModelError("LastName", "The LastName field is required.");

        var result = await controller.UpdateScholar(scholar.Id, scholar, CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task UpdateScholar_NotFound_Returns404()
    {
        var (controller, dataAccess) = MakeController();
        var scholar = SampleScholar();
        dataAccess.Setup(d => d.UpdateScholarAsync(scholar, It.IsAny<CancellationToken>())).ReturnsAsync((Scholar?)null);

        var result = await controller.UpdateScholar(scholar.Id, scholar, CancellationToken.None);

        Assert.IsType<NotFoundObjectResult>(result);
    }

    [Fact]
    public async Task UpdateScholar_Success_ReturnsOk()
    {
        var (controller, dataAccess) = MakeController();
        var scholar = SampleScholar();
        dataAccess.Setup(d => d.UpdateScholarAsync(scholar, It.IsAny<CancellationToken>())).ReturnsAsync(scholar);

        var result = await controller.UpdateScholar(scholar.Id, scholar, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Equal(scholar.Id, ((Scholar)ok.Value!).Id);
    }

    [Fact]
    public async Task UpdateScholar_DataAccessThrows_Returns500()
    {
        var (controller, dataAccess) = MakeController();
        var scholar = SampleScholar();
        dataAccess.Setup(d => d.UpdateScholarAsync(scholar, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new Exception("boom"));

        var result = await controller.UpdateScholar(scholar.Id, scholar, CancellationToken.None);

        Assert.Equal(500, ((ObjectResult)result).StatusCode);
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

        var result = await controller.DeleteScholar(id, CancellationToken.None);

        Assert.IsType<NoContentResult>(result);
    }

    [Fact]
    public async Task DeleteScholar_NotFound_Returns404()
    {
        var (controller, dataAccess) = MakeController();
        var id = Guid.NewGuid();
        dataAccess.Setup(d => d.DeleteScholarAsync(id, It.IsAny<CancellationToken>())).ReturnsAsync(false);

        var result = await controller.DeleteScholar(id, CancellationToken.None);

        Assert.IsType<NotFoundObjectResult>(result);
    }

    [Fact]
    public async Task DeleteScholar_DataAccessThrows_Returns500()
    {
        var (controller, dataAccess) = MakeController();
        var id = Guid.NewGuid();
        dataAccess.Setup(d => d.DeleteScholarAsync(id, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new Exception("boom"));

        var result = await controller.DeleteScholar(id, CancellationToken.None);

        Assert.Equal(500, ((ObjectResult)result).StatusCode);
    }

    // ---------------------------------------
    // Audit log endpoints
    // ---------------------------------------

    [Fact]
    public async Task GetScholarAuditLog_ReturnsOkWithEntries()
    {
        var (controller, dataAccess) = MakeController();
        var id = Guid.NewGuid();
        var entries = new List<AuditLogEntry> { new() { ScholarId = id, Action = "Created" } };
        dataAccess.Setup(d => d.GetAuditLogByScholarIdAsync(id, It.IsAny<CancellationToken>())).ReturnsAsync(entries);

        var result = await controller.GetScholarAuditLog(id, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        Assert.Single((IEnumerable<AuditLogEntry>)ok.Value!);
    }

    [Theory]
    [InlineData(0, 20)] // pageNumber below minimum
    [InlineData(1, 0)] // pageSize below minimum
    [InlineData(1, 101)] // pageSize above maximum
    public async Task GetAllAuditLog_OutOfRangePaging_ReturnsBadRequest(int pageNumber, int pageSize)
    {
        var (controller, dataAccess) = MakeController();

        var result = await controller.GetAllAuditLog(pageNumber, pageSize, CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result.Result);
        dataAccess.Verify(
            d => d.GetAllAuditLogAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task GetAllAuditLog_ValidPaging_ReturnsOkWithPagedResult()
    {
        var (controller, dataAccess) = MakeController();
        var page = new PagedResult<GlobalAuditLogEntry> { PageNumber = 2, PageSize = 20, TotalItems = 45 };
        dataAccess.Setup(d => d.GetAllAuditLogAsync(2, 20, It.IsAny<CancellationToken>())).ReturnsAsync(page);

        var result = await controller.GetAllAuditLog(2, 20, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        Assert.Equal(45, ((PagedResult<GlobalAuditLogEntry>)ok.Value!).TotalItems);
    }

    [Fact]
    public async Task DeleteAllAuditLog_Success_ReturnsNoContent()
    {
        var (controller, dataAccess) = MakeController();
        dataAccess.Setup(d => d.DeleteAllAuditLogAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

        var result = await controller.DeleteAllAuditLog(CancellationToken.None);

        Assert.IsType<NoContentResult>(result);
    }

    // ---------------------------------------
    // Attendance endpoints
    // ---------------------------------------

    [Fact]
    public async Task CreateOrUpdateAttendance_EmptyId_ReturnsBadRequest()
    {
        var (controller, dataAccess) = MakeController();

        var result = await controller.CreateOrUpdateAttendance(Guid.Empty, [], CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result);
        dataAccess.Verify(
            d => d.CreateOrUpdateAttendanceAsync(It.IsAny<Guid>(), It.IsAny<List<AttendanceRecord>>(),
                It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task CreateOrUpdateAttendance_NullAttendance_ReturnsBadRequest()
    {
        var (controller, _) = MakeController();

        var result = await controller.CreateOrUpdateAttendance(Guid.NewGuid(), null!, CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task CreateOrUpdateAttendance_Success_ReturnsOk()
    {
        var (controller, dataAccess) = MakeController();
        var id = Guid.NewGuid();
        var records = new List<AttendanceRecord> { new() { Date = DateTime.UtcNow, LunchCost = 10m } };
        dataAccess
            .Setup(d => d.CreateOrUpdateAttendanceAsync(id, records, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var result = await controller.CreateOrUpdateAttendance(id, records, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Equal(200, ok.StatusCode);
    }

    [Fact]
    public async Task CreateOrUpdateAttendance_DataAccessReturnsFalse_Returns500()
    {
        var (controller, dataAccess) = MakeController();
        var id = Guid.NewGuid();
        var records = new List<AttendanceRecord>();
        dataAccess
            .Setup(d => d.CreateOrUpdateAttendanceAsync(id, records, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var result = await controller.CreateOrUpdateAttendance(id, records, CancellationToken.None);

        Assert.Equal(500, ((ObjectResult)result).StatusCode);
    }

    [Fact]
    public async Task GetAttendance_EmptyId_ReturnsBadRequest()
    {
        var (controller, _) = MakeController();

        var result = await controller.GetAttendance(Guid.Empty, CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public async Task GetAttendance_NoneYet_ReturnsOkWithEmptyList()
    {
        var (controller, dataAccess) = MakeController();
        var id = Guid.NewGuid();
        dataAccess.Setup(d => d.GetAttendanceByScholarIdAsync(id, It.IsAny<CancellationToken>()))
            .ReturnsAsync([]);

        var result = await controller.GetAttendance(id, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        Assert.Empty((IEnumerable<AttendanceRecord>)ok.Value!);
    }

    [Fact]
    public async Task DeleteAttendance_EmptyId_ReturnsBadRequest()
    {
        var (controller, _) = MakeController();

        var result = await controller.DeleteAttendance(Guid.Empty, CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task DeleteAttendance_NotFound_Returns404()
    {
        var (controller, dataAccess) = MakeController();
        var id = Guid.NewGuid();
        dataAccess.Setup(d => d.DeleteAttendanceAsync(id, It.IsAny<CancellationToken>())).ReturnsAsync(false);

        var result = await controller.DeleteAttendance(id, CancellationToken.None);

        Assert.IsType<NotFoundObjectResult>(result);
    }

    [Fact]
    public async Task DeleteAttendance_Success_ReturnsNoContent()
    {
        var (controller, dataAccess) = MakeController();
        var id = Guid.NewGuid();
        dataAccess.Setup(d => d.DeleteAttendanceAsync(id, It.IsAny<CancellationToken>())).ReturnsAsync(true);

        var result = await controller.DeleteAttendance(id, CancellationToken.None);

        Assert.IsType<NoContentResult>(result);
    }

    [Fact]
    public async Task GetAllAttendance_ReturnsOkWithShapedResult()
    {
        var (controller, dataAccess) = MakeController();
        var scholarId = Guid.NewGuid();
        var records = new List<AttendanceRecord> { new() { Date = DateTime.UtcNow } };
        dataAccess.Setup(d => d.GetAllAttendanceAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync([(scholarId, records)]);

        var result = await controller.GetAllAttendance(CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var items = Assert.IsAssignableFrom<IEnumerable<object>>(ok.Value).ToList();
        Assert.Single(items);
    }

    [Fact]
    public async Task GetAllAttendance_DataAccessThrows_Returns500()
    {
        var (controller, dataAccess) = MakeController();
        dataAccess.Setup(d => d.GetAllAttendanceAsync(It.IsAny<CancellationToken>()))
            .ThrowsAsync(new Exception("boom"));

        var result = await controller.GetAllAttendance(CancellationToken.None);

        Assert.Equal(500, ((ObjectResult)result.Result!).StatusCode);
    }
}

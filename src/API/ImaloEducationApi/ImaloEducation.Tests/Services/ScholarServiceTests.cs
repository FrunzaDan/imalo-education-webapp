using ImaloEducation.BusinessLogic.Abstractions;
using ImaloEducation.BusinessLogic.Services.Implementation;
using ImaloEducation.Domain.Models;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Testing;
using Moq;

namespace ImaloEducation.Tests.Services;

// The audit trail and argument guards that sit between the controller and the SQL repository.
public class ScholarServiceTests
{
    private readonly Mock<IScholarRepository> _repository = new();
    private readonly FakeLogger<ScholarService> _logger = new();
    private readonly ScholarService _service;

    public ScholarServiceTests() => _service = new ScholarService(_repository.Object, _logger);

    private static CancellationToken Token => TestContext.Current.CancellationToken;

    private static Scholar Ana(string firstName = "Ana") => new()
    {
        ScholarId = Guid.NewGuid(),
        FirstName = firstName,
        LastName = "Pop",
        BirthDate = new DateOnly(2018, 5, 1),
    };

    private void VerifyAudited(Guid scholarId, AuditAction action, string? details) =>
        _repository.Verify(r => r.AddAuditEntryAsync(scholarId, action, details, CancellationToken.None),
            Times.Once);

    private void VerifyNotAudited() =>
        _repository.Verify(r => r.AddAuditEntryAsync(It.IsAny<Guid>(), It.IsAny<AuditAction>(),
            It.IsAny<string?>(), It.IsAny<CancellationToken>()), Times.Never);

    [Fact]
    public async Task CreateScholar_AuditsTheCreation_WithTheNewId()
    {
        var created = Ana();
        _repository.Setup(r => r.CreateScholarAsync(It.IsAny<Scholar>(), Token)).ReturnsAsync(created);

        var result = await _service.CreateScholarAsync(Ana(), Token);

        Assert.Same(created, result);
        VerifyAudited(created.ScholarId, AuditAction.Created, null);
    }

    [Fact]
    public async Task UpdateScholar_AuditsTheChangedFields()
    {
        var before = Ana();
        var after = Ana(firstName: "Ioana");
        after.ScholarId = before.ScholarId;
        _repository.Setup(r => r.UpdateScholarAsync(after, Token)).ReturnsAsync(before);

        var result = await _service.UpdateScholarAsync(after, Token);

        Assert.Same(after, result);
        VerifyAudited(after.ScholarId, AuditAction.Edited, "Updated: first name");
    }

    [Fact]
    public async Task UpdateScholar_NotFound_ReturnsNullAndDoesNotAudit()
    {
        _repository.Setup(r => r.UpdateScholarAsync(It.IsAny<Scholar>(), Token)).ReturnsAsync((Scholar?)null);

        Assert.Null(await _service.UpdateScholarAsync(Ana(), Token));
        VerifyNotAudited();
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task DeleteScholar_AuditsOnlyWhenARowWasDeleted(bool deleted)
    {
        var scholarId = Guid.NewGuid();
        _repository.Setup(r => r.DeleteScholarAsync(scholarId, Token)).ReturnsAsync(deleted);

        Assert.Equal(deleted, await _service.DeleteScholarAsync(scholarId, Token));

        if (deleted) VerifyAudited(scholarId, AuditAction.Deleted, null);
        else VerifyNotAudited();
    }

    [Fact]
    public async Task AuditWriteFails_IsLoggedAndTheChangeStillSucceeds()
    {
        var scholarId = Guid.NewGuid();
        _repository.Setup(r => r.DeleteScholarAsync(scholarId, Token)).ReturnsAsync(true);
        _repository.Setup(r => r.AddAuditEntryAsync(scholarId, AuditAction.Deleted, null, CancellationToken.None))
            .ThrowsAsync(new InvalidOperationException("audit table locked"));

        Assert.True(await _service.DeleteScholarAsync(scholarId, Token));

        var record = Assert.Single(_logger.Collector.GetSnapshot());
        Assert.Equal(LogLevel.Error, record.Level);
        Assert.Equal(2, record.Id.Id);
        Assert.IsType<InvalidOperationException>(record.Exception);
    }

    [Fact]
    public async Task EmptyScholarId_IsRejectedBeforeReachingTheRepository()
    {
        await Assert.ThrowsAsync<ArgumentException>(() => _service.GetScholarAsync(Guid.Empty, Token));
        await Assert.ThrowsAsync<ArgumentException>(() => _service.DeleteScholarAsync(Guid.Empty, Token));
        await Assert.ThrowsAsync<ArgumentException>(() =>
            _service.UpdateScholarAsync(new Scholar { ScholarId = Guid.Empty }, Token));

        Assert.Empty(_repository.Invocations);
    }
}

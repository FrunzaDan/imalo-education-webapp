using ImaloEducation.BusinessLogic.Abstractions;
using ImaloEducation.BusinessLogic.Contracts;
using ImaloEducation.BusinessLogic.Features.AuditLog;
using ImaloEducation.BusinessLogic.Features.Scholars;
using ImaloEducation.Domain.Models;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Testing;
using Moq;

namespace ImaloEducation.Tests.Features.Scholars;

// The audit trail and argument guards that sit between the controller and the SQL repository.
public class ScholarHandlersTests
{
    private readonly Mock<IScholarRepository> _repository = new();
    private readonly FakeLogger<ScholarAuditLogger> _logger = new();
    private readonly ScholarAuditLogger _auditLogger;

    public ScholarHandlersTests() => _auditLogger = new ScholarAuditLogger(_repository.Object, _logger);

    private CreateScholarHandler CreateHandler => new(_repository.Object, _auditLogger);

    private UpdateScholarHandler UpdateHandler => new(_repository.Object, _auditLogger);

    private DeleteScholarHandler DeleteHandler => new(_repository.Object, _auditLogger);

    private static CancellationToken Token => TestContext.Current.CancellationToken;

    private static ScholarRequest Ana(string firstName = "Ana") => new()
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
        var created = Ana().ToScholar();
        _repository.Setup(r => r.CreateScholarAsync(It.IsAny<Scholar>(), Token)).ReturnsAsync(created);

        var result = await CreateHandler.HandleAsync(Ana(), Token);

        Assert.Same(created, result);
        VerifyAudited(created.ScholarId, AuditAction.Created, null);
    }

    [Fact]
    public async Task UpdateScholar_AuditsTheChangedFields()
    {
        var before = Ana().ToScholar();
        var after = Ana(firstName: "Ioana");
        after.ScholarId = before.ScholarId;
        _repository.Setup(r => r.UpdateScholarAsync(It.Is<Scholar>(s => s.ScholarId == after.ScholarId), Token))
            .ReturnsAsync(before);

        var result = await UpdateHandler.HandleAsync(after, Token);

        Assert.NotNull(result);
        Assert.Equal("Ioana", result.FirstName);
        VerifyAudited(after.ScholarId, AuditAction.Edited, "Updated: first name");
    }

    [Fact]
    public async Task UpdateScholar_NotFound_ReturnsNullAndDoesNotAudit()
    {
        _repository.Setup(r => r.UpdateScholarAsync(It.IsAny<Scholar>(), Token)).ReturnsAsync((Scholar?)null);

        Assert.Null(await UpdateHandler.HandleAsync(Ana(), Token));
        VerifyNotAudited();
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task DeleteScholar_AuditsOnlyWhenARowWasDeleted(bool deleted)
    {
        var scholarId = Guid.NewGuid();
        _repository.Setup(r => r.DeleteScholarAsync(scholarId, Token)).ReturnsAsync(deleted);

        Assert.Equal(deleted, await DeleteHandler.HandleAsync(scholarId, Token));

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

        Assert.True(await DeleteHandler.HandleAsync(scholarId, Token));

        var record = Assert.Single(_logger.Collector.GetSnapshot());
        Assert.Equal(LogLevel.Error, record.Level);
        Assert.Equal(2, record.Id.Id);
        Assert.IsType<InvalidOperationException>(record.Exception);
    }

    [Fact]
    public async Task EmptyScholarId_IsRejectedBeforeReachingTheRepository()
    {
        await Assert.ThrowsAsync<ArgumentException>(() =>
            new GetScholarHandler(_repository.Object).HandleAsync(Guid.Empty, Token));
        await Assert.ThrowsAsync<ArgumentException>(() => DeleteHandler.HandleAsync(Guid.Empty, Token));
        await Assert.ThrowsAsync<ArgumentException>(() =>
            UpdateHandler.HandleAsync(new ScholarRequest { ScholarId = Guid.Empty }, Token));

        Assert.Empty(_repository.Invocations);
    }
}

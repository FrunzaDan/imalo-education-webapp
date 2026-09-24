using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using ImaloEducationApi.Models;

namespace ImaloEducationApi.Tests.Models;

public class WireFormatTests
{
    private static readonly JsonSerializerOptions Web = JsonSerializerOptions.Web;

    [Fact]
    public void PickupSchedule_ReadsHourMinuteTimesAndNulls()
    {
        var schedule = JsonSerializer.Deserialize<PickupSchedule>(
            """{"monday":"08:00","tuesday":null,"wednesday":"13:30","friday":"17:45"}""", Web)!;

        Assert.Equal(new TimeOnly(8, 0), schedule.Monday);
        Assert.Null(schedule.Tuesday);
        Assert.Equal(new TimeOnly(13, 30), schedule.Wednesday);
        Assert.Null(schedule.Thursday);
        Assert.Equal(new TimeOnly(17, 45), schedule.Friday);
    }

    [Fact]
    public void PickupSchedule_WritesHourMinuteNotTimeOnlyDefault()
    {
        var json = JsonSerializer.Serialize(new PickupSchedule { Monday = new TimeOnly(13, 30) }, Web);

        Assert.Equal(
            """{"monday":"13:30","tuesday":null,"wednesday":null,"thursday":null,"friday":null}""", json);
    }

    [Fact]
    public void PickupSchedule_DayNamesAreCaseInsensitive()
    {
        var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };

        Assert.Equal(new TimeOnly(8, 0),
            JsonSerializer.Deserialize<PickupSchedule>("""{"monday":"08:00"}""", options)!.Monday);
        Assert.Equal(new TimeOnly(8, 0),
            JsonSerializer.Deserialize<PickupSchedule>("""{"Monday":"08:00"}""", options)!.Monday);
    }

    [Fact]
    public void PickupSchedule_RejectsUnknownDay()
    {
        Assert.Throws<JsonException>(() =>
            JsonSerializer.Deserialize<PickupSchedule>("""{"saturday":"08:00"}""", Web));
    }

    [Theory]
    [InlineData("12")]
    [InlineData("99:00")]
    [InlineData("08:00 AM")]
    [InlineData("not-a-time")]
    [InlineData("8:00")]
    [InlineData("08:00:00")]
    public void PickupSchedule_RejectsNonStrictTimeFormats(string invalidTime)
    {
        var ex = Assert.Throws<JsonException>(() =>
            JsonSerializer.Deserialize<PickupSchedule>($$"""{"monday":"{{invalidTime}}"}""", Web));

        Assert.Contains("Use 24-hour HH:mm", ex.Message);
    }

    [Fact]
    public void PickupSchedule_ReadsEmptyOrWhitespaceAsNoPickup()
    {
        var schedule = JsonSerializer.Deserialize<PickupSchedule>("""{"monday":"","tuesday":"   "}""", Web)!;

        Assert.Null(schedule.Monday);
        Assert.Null(schedule.Tuesday);
    }

    [Fact]
    public void AttendanceRecord_DateIsDateOnly()
    {
        var json = JsonSerializer.Serialize(new AttendanceRecord { Date = new DateOnly(2026, 9, 1) }, Web);

        Assert.Contains("\"date\":\"2026-09-01\"", json);
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(10000)]
    public void AttendanceRecord_CostOutOfRange_FailsValidation(decimal cost)
    {
        var record = new AttendanceRecord { LunchCost = cost, TransportCost = cost };
        var results = new List<ValidationResult>();

        Assert.False(Validator.TryValidateObject(record, new ValidationContext(record), results, true));
        Assert.Equal(2, results.Count);
    }

    [Fact]
    public void AuditLogEntry_ActionTypeByNameAndOccurredAtAsUtc()
    {
        var entry = new AuditLogEntry
        {
            ScholarAuditLogId = 1,
            ScholarId = Guid.Empty,
            ActionType = AuditAction.Edited,
            OccurredAt = new DateTime(2026, 9, 23, 10, 0, 0, DateTimeKind.Utc),
        };

        var json = JsonSerializer.Serialize(entry, Web);

        Assert.Contains("\"actionType\":\"Edited\"", json);
        Assert.Contains("\"occurredAt\":\"2026-09-23T10:00:00Z\"", json);
    }
}

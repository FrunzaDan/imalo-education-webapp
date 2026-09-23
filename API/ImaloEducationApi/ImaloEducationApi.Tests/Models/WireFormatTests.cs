using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using ImaloEducationApi.Models;

namespace ImaloEducationApi.Tests.Models;

// Pins the JSON shapes the Angular app depends on, using the same options ASP.NET
// Core's input/output formatters use (camelCase, case-insensitive).
public class WireFormatTests
{
    private static readonly JsonSerializerOptions Web = JsonSerializerOptions.Web;

    // ---- PickupSchedule ----

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
        // Schedules stored before the typed class were a Dictionary with lowercase keys;
        // the typed class itself is stored PascalCase. Both must read back.
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
    [InlineData("12")] // bare number — must not be read as a duration
    [InlineData("99:00")] // hour out of range
    [InlineData("08:00 AM")]
    [InlineData("not-a-time")]
    [InlineData("8:00")] // not zero-padded — strict HH:mm only
    [InlineData("08:00:00")] // TimeOnly's default format, still not HH:mm
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

    // ---- AttendanceRecord ----

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

    // ---- Audit log ----

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
        // The trailing "Z" is what makes the browser convert it to local time.
        Assert.Contains("\"occurredAt\":\"2026-09-23T10:00:00Z\"", json);
    }
}

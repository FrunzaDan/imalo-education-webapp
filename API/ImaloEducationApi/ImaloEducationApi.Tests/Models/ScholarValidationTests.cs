using System.ComponentModel.DataAnnotations;
using ImaloEducationApi.Models;

namespace ImaloEducationApi.Tests.Models;

public class ScholarValidationTests
{
    private static ValidationResult? Validate(DateOnly date) =>
        Scholar.ValidateDateOfBirth(date, new ValidationContext(new object()));

    [Fact]
    public void ValidateDateOfBirth_AcceptsPastDate()
    {
        Assert.Equal(ValidationResult.Success, Validate(DateOnly.FromDateTime(DateTime.UtcNow).AddYears(-10)));
    }

    [Fact]
    public void ValidateDateOfBirth_RejectsFutureDate()
    {
        var result = Validate(DateOnly.FromDateTime(DateTime.UtcNow).AddDays(1));

        Assert.NotEqual(ValidationResult.Success, result);
        Assert.Equal("Date of birth cannot be in the future.", result!.ErrorMessage);
    }

    private static ValidationResult? ValidateSchedule(Dictionary<string, string?>? schedule) =>
        Scholar.ValidatePickUpSchedule(schedule, new ValidationContext(new object()));

    [Fact]
    public void ValidatePickUpSchedule_AcceptsNullSchedule()
    {
        Assert.Equal(ValidationResult.Success, ValidateSchedule(null));
    }

    [Fact]
    public void ValidatePickUpSchedule_AcceptsAllWeekdaysWithNullOrValidTimes()
    {
        var schedule = new Dictionary<string, string?>
        {
            ["monday"] = "08:00",
            ["tuesday"] = null,
            ["wednesday"] = "13:30",
            ["thursday"] = null,
            ["friday"] = "17:45",
        };

        Assert.Equal(ValidationResult.Success, ValidateSchedule(schedule));
    }

    [Fact]
    public void ValidatePickUpSchedule_IsCaseInsensitiveForDayNames()
    {
        var schedule = new Dictionary<string, string?> { ["Monday"] = "08:00" };

        Assert.Equal(ValidationResult.Success, ValidateSchedule(schedule));
    }

    [Fact]
    public void ValidatePickUpSchedule_RejectsUnknownDay()
    {
        var schedule = new Dictionary<string, string?> { ["saturday"] = "08:00" };

        var result = ValidateSchedule(schedule);

        Assert.NotEqual(ValidationResult.Success, result);
        Assert.Contains("Invalid day in schedule", result!.ErrorMessage);
    }

    [Theory]
    [InlineData("12")] // bare number — must NOT be accepted as a duration (TimeSpan.TryParse would silently allow it)
    [InlineData("99:00")] // hour out of range
    [InlineData("08:00 AM")]
    [InlineData("not-a-time")]
    [InlineData("8:00")] // not zero-padded — strict HH:mm only
    public void ValidatePickUpSchedule_RejectsNonStrictTimeFormats(string invalidTime)
    {
        var schedule = new Dictionary<string, string?> { ["monday"] = invalidTime };

        var result = ValidateSchedule(schedule);

        Assert.NotEqual(ValidationResult.Success, result);
        Assert.Contains("Invalid time format", result!.ErrorMessage);
    }

    [Fact]
    public void ValidatePickUpSchedule_AcceptsEmptyOrWhitespaceAsNoPickup()
    {
        var schedule = new Dictionary<string, string?> { ["monday"] = "", ["tuesday"] = "   " };

        Assert.Equal(ValidationResult.Success, ValidateSchedule(schedule));
    }

    private static ValidationResult? ValidatePhone(string? phone) =>
        Scholar.ValidatePhoneNumber(phone, new ValidationContext(new object()));

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void ValidatePhoneNumber_AcceptsNullOrBlank(string? phone)
    {
        Assert.Equal(ValidationResult.Success, ValidatePhone(phone));
    }

    [Theory]
    [InlineData("0712345678")]
    [InlineData("+1 (415) 555-0132")]
    [InlineData("123456")] // minimum length (6)
    public void ValidatePhoneNumber_AcceptsWellFormedNumbers(string phone)
    {
        Assert.Equal(ValidationResult.Success, ValidatePhone(phone));
    }

    [Theory]
    [InlineData("12345")] // too short (< 6)
    [InlineData("abc-def-ghij")] // letters
    [InlineData("123456789012345678901")] // too long (> 20)
    public void ValidatePhoneNumber_RejectsMalformedNumbers(string phone)
    {
        var result = ValidatePhone(phone);

        Assert.NotEqual(ValidationResult.Success, result);
        Assert.Contains("Invalid phone number", result!.ErrorMessage);
    }
}

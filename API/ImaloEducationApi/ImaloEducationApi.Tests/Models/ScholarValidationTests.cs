using System.ComponentModel.DataAnnotations;
using ImaloEducationApi.Models;

namespace ImaloEducationApi.Tests.Models;

public class ScholarValidationTests
{
    private static ValidationResult? Validate(DateOnly date) =>
        Scholar.ValidateBirthDate(date, new ValidationContext(new object()));

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
        Assert.Equal("Birth date cannot be in the future.", result!.ErrorMessage);
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
    [InlineData("123456789")] // minimum length (9)
    [InlineData("123456789012")] // maximum length (12)
    public void ValidatePhoneNumber_AcceptsWellFormedNumbers(string phone)
    {
        Assert.Equal(ValidationResult.Success, ValidatePhone(phone));
    }

    [Theory]
    [InlineData("12345678")] // too short (< 9)
    [InlineData("abc-def-ghij")] // letters
    [InlineData("+1 (415) 555-0132")] // formatting characters: digits only, same as the other apps
    [InlineData("1234567890123")] // too long (> 12)
    public void ValidatePhoneNumber_RejectsMalformedNumbers(string phone)
    {
        var result = ValidatePhone(phone);

        Assert.NotEqual(ValidationResult.Success, result);
        Assert.Contains("Invalid phone number", result!.ErrorMessage);
    }
}

using System.ComponentModel.DataAnnotations;
using ImaloEducationApi.Models;

namespace ImaloEducationApi.Tests.Models;

public class ScholarModelValidationTests
{
    private static Scholar ValidScholar() => new()
    {
        FirstName = "Ana",
        LastName = "Popescu",
        BirthDate = DateOnly.FromDateTime(DateTime.UtcNow).AddYears(-8),
        SchoolId = 1,
        Grade = 3,
        PickupSchedule = new PickupSchedule { Monday = new TimeOnly(13, 0) },
    };

    private static bool TryValidate(Scholar scholar, out List<ValidationResult> results)
    {
        results = [];
        var context = new ValidationContext(scholar);
        return Validator.TryValidateObject(scholar, context, results, validateAllProperties: true);
    }

    [Fact]
    public void FullyPopulatedValidScholar_PassesValidation()
    {
        Assert.True(TryValidate(ValidScholar(), out var results));
        Assert.Empty(results);
    }

    [Fact]
    public void MinimalScholar_WithOnlyRequiredFields_PassesValidation()
    {
        var scholar = new Scholar
        {
            FirstName = "Ana",
            LastName = "Popescu",
            BirthDate = DateOnly.FromDateTime(DateTime.UtcNow).AddYears(-8),
        };

        Assert.True(TryValidate(scholar, out var results));
        Assert.Empty(results);
    }

    [Fact]
    public void MissingFirstName_FailsValidation()
    {
        var scholar = ValidScholar();
        scholar.FirstName = string.Empty;

        Assert.False(TryValidate(scholar, out var results));
        Assert.Contains(results, r => r.MemberNames.Contains(nameof(Scholar.FirstName)));
    }

    [Fact]
    public void GradeOutOfRange_FailsValidation()
    {
        var scholar = ValidScholar();
        scholar.Grade = 13;

        Assert.False(TryValidate(scholar, out var results));
        Assert.Contains(results, r => r.MemberNames.Contains(nameof(Scholar.Grade)));
    }

    [Fact]
    public void NegativeSchoolId_FailsValidation()
    {
        var scholar = ValidScholar();
        scholar.SchoolId = -1;

        Assert.False(TryValidate(scholar, out var results));
        Assert.Contains(results, r => r.MemberNames.Contains(nameof(Scholar.SchoolId)));
    }

    [Fact]
    public void FutureBirthDate_FailsValidation()
    {
        var scholar = ValidScholar();
        scholar.BirthDate = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(5);

        Assert.False(TryValidate(scholar, out var results));
        Assert.Contains(results, r => r.ErrorMessage == "Birth date cannot be in the future.");
    }

    [Fact]
    public void InvalidMotherPhoneNumber_FailsValidation()
    {
        var scholar = ValidScholar();
        scholar.MotherPhoneNumber = "abc";

        Assert.False(TryValidate(scholar, out var results));
        Assert.Contains(results, r => r.ErrorMessage != null && r.ErrorMessage.Contains("Invalid phone number"));
    }

    [Fact]
    public void ParentNamesAndPhoneAreOptional_PassesValidationWhenAllNull()
    {
        var scholar = ValidScholar();
        scholar.MotherFirstName = null;
        scholar.MotherLastName = null;
        scholar.MotherPhoneNumber = null;
        scholar.FatherFirstName = null;
        scholar.FatherLastName = null;
        scholar.FatherPhoneNumber = null;

        Assert.True(TryValidate(scholar, out var results));
        Assert.Empty(results);
    }
}

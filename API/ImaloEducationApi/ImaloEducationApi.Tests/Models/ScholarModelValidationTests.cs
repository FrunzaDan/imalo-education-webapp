using System.ComponentModel.DataAnnotations;
using ImaloEducationApi.Models;

namespace ImaloEducationApi.Tests.Models;

// Exercises Scholar through Validator.TryValidateObject — the same mechanism ASP.NET Core's
// ModelState binding uses — so a dropped [Required]/[Range]/[CustomValidation] attribute is
// caught here rather than only surfacing as a 400 the controller silently stops returning.
public class ScholarModelValidationTests
{
    private static Scholar ValidScholar() => new()
    {
        FirstName = "Ana",
        LastName = "Popescu",
        DateOfBirth = DateOnly.FromDateTime(DateTime.UtcNow).AddYears(-8),
        SchoolId = 1,
        Grade = 3,
        PickUpSchedule = new Dictionary<string, string?> { ["monday"] = "13:00" },
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
            DateOfBirth = DateOnly.FromDateTime(DateTime.UtcNow).AddYears(-8),
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
    public void FutureDateOfBirth_FailsValidation()
    {
        var scholar = ValidScholar();
        scholar.DateOfBirth = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(5);

        // CustomValidationAttribute results don't carry MemberNames the way built-in
        // attributes (Required/Range/...) do, so this asserts on message content instead.
        Assert.False(TryValidate(scholar, out var results));
        Assert.Contains(results, r => r.ErrorMessage == "Date of birth cannot be in the future.");
    }

    [Fact]
    public void InvalidPickUpScheduleDay_FailsValidation()
    {
        var scholar = ValidScholar();
        scholar.PickUpSchedule = new Dictionary<string, string?> { ["sunday"] = "13:00" };

        Assert.False(TryValidate(scholar, out var results));
        Assert.Contains(results, r => r.ErrorMessage != null && r.ErrorMessage.Contains("Invalid day in schedule"));
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

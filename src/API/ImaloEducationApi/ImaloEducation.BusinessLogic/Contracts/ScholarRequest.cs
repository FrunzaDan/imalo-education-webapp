using System.ComponentModel.DataAnnotations;
using System.Text.RegularExpressions;
using ImaloEducation.Domain.Models;

namespace ImaloEducation.BusinessLogic.Contracts;

/// <summary>A scholar as the UI sends it, with the input rules the API checks before any handler runs.</summary>
public partial class ScholarRequest
{
    public Guid ScholarId { get; set; }

    [Required]
    [StringLength(100, ErrorMessage = "First name can't exceed 100 characters.")]
    public string FirstName { get; set; } = string.Empty;

    [Required]
    [StringLength(100, ErrorMessage = "Last name can't exceed 100 characters.")]
    public string LastName { get; set; } = string.Empty;

    [EnumDataType(typeof(Gender), ErrorMessage = "Invalid gender value.")]
    public Gender Gender { get; set; }

    [Range(1, int.MaxValue, ErrorMessage = "SchoolId must be a positive number.")]
    public int? SchoolId { get; set; }

    [Range(0, 12, ErrorMessage = "Grade must be between 0 and 12.")]
    public byte? Grade { get; set; }

    [Required]
    [DataType(DataType.Date)]
    [CustomValidation(typeof(ScholarRequest), nameof(ValidateBirthDate))]
    public DateOnly? BirthDate { get; set; }

    public PickupSchedule? PickupSchedule { get; set; }

    [StringLength(100)]
    public string? MotherFirstName { get; set; }

    [StringLength(100)]
    public string? MotherLastName { get; set; }

    [StringLength(15)]
    [CustomValidation(typeof(ScholarRequest), nameof(ValidatePhoneNumber))]
    public string? MotherPhoneNumber { get; set; }

    [StringLength(100)]
    public string? FatherFirstName { get; set; }

    [StringLength(100)]
    public string? FatherLastName { get; set; }

    [StringLength(15)]
    [CustomValidation(typeof(ScholarRequest), nameof(ValidatePhoneNumber))]
    public string? FatherPhoneNumber { get; set; }

    public static ValidationResult? ValidateBirthDate(DateOnly? date, ValidationContext context)
    {
        return date > DateOnly.FromDateTime(DateTime.UtcNow)
            ? new ValidationResult("Birth date cannot be in the future.")
            : ValidationResult.Success;
    }

    public static ValidationResult? ValidatePhoneNumber(string? phoneNumber, ValidationContext context)
    {
        if (string.IsNullOrWhiteSpace(phoneNumber)) return ValidationResult.Success;

        return PhoneNumberRegex().IsMatch(phoneNumber)
            ? ValidationResult.Success
            : new ValidationResult($"Invalid phone number: '{phoneNumber}'.");
    }

    public Scholar ToScholar() => new()
    {
        ScholarId = ScholarId,
        FirstName = FirstName,
        LastName = LastName,
        Gender = Gender,
        SchoolId = SchoolId,
        Grade = Grade,
        BirthDate = BirthDate,
        PickupSchedule = PickupSchedule,
        MotherFirstName = MotherFirstName,
        MotherLastName = MotherLastName,
        MotherPhoneNumber = MotherPhoneNumber,
        FatherFirstName = FatherFirstName,
        FatherLastName = FatherLastName,
        FatherPhoneNumber = FatherPhoneNumber,
    };

    [GeneratedRegex(@"^[0-9]{9,12}\z")]
    private static partial Regex PhoneNumberRegex();
}

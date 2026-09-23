using System.ComponentModel.DataAnnotations;
using System.Text.RegularExpressions;

namespace ImaloEducationApi.Models;

public partial class Scholar
{
    public Guid Id { get; set; }

    [Required]
    [StringLength(100, ErrorMessage = "First name can't exceed 100 characters.")]
    public string FirstName { get; set; } = string.Empty;

    [Required]
    [StringLength(100, ErrorMessage = "Last name can't exceed 100 characters.")]
    public string LastName { get; set; } = string.Empty;

    [Range(1, int.MaxValue, ErrorMessage = "SchoolId must be a positive number.")]
    public int? SchoolId { get; set; }

    [Range(0, 12, ErrorMessage = "Grade must be between 0 and 12.")]
    public byte? Grade { get; set; }

    [Required]
    [DataType(DataType.Date)]
    [CustomValidation(typeof(Scholar), nameof(ValidateDateOfBirth))]
    public DateOnly DateOfBirth { get; set; }

    // Shape (weekdays only, strict HH:mm) is enforced by PickUpSchedule's own
    // deserialization, not by a validator here.
    public PickUpSchedule? PickUpSchedule { get; set; }

    // Optional — a scholar may have a mother, a father, both, or neither, and each
    // of a parent's own fields (name, phone) is independently optional too. Stored
    // as separate rows (Role 'Mother'/'Father') in the ScholarParent table, not as
    // columns on Scholar, so the two roles can be added/edited/removed independently.
    [StringLength(100)]
    public string? MotherFirstName { get; set; }

    [StringLength(100)]
    public string? MotherLastName { get; set; }

    [StringLength(20)]
    [CustomValidation(typeof(Scholar), nameof(ValidatePhoneNumber))]
    public string? MotherPhoneNumber { get; set; }

    [StringLength(100)]
    public string? FatherFirstName { get; set; }

    [StringLength(100)]
    public string? FatherLastName { get; set; }

    [StringLength(20)]
    [CustomValidation(typeof(Scholar), nameof(ValidatePhoneNumber))]
    public string? FatherPhoneNumber { get; set; }

    public static ValidationResult? ValidateDateOfBirth(DateOnly date, ValidationContext context)
    {
        return date > DateOnly.FromDateTime(DateTime.UtcNow)
            ? new ValidationResult("Date of birth cannot be in the future.")
            : ValidationResult.Success;
    }

    public static ValidationResult? ValidatePhoneNumber(string? phoneNumber, ValidationContext context)
    {
        if (string.IsNullOrWhiteSpace(phoneNumber)) return ValidationResult.Success;

        return PhoneNumberRegex().IsMatch(phoneNumber)
            ? ValidationResult.Success
            : new ValidationResult($"Invalid phone number: '{phoneNumber}'.");
    }

    // Source-generated: compiled once at build time instead of on first use.
    [GeneratedRegex(@"^\+?[0-9 ()-]{6,20}$")]
    private static partial Regex PhoneNumberRegex();
}

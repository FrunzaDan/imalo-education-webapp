using System.ComponentModel.DataAnnotations;
using System.Globalization;
using System.Text.RegularExpressions;

namespace ImaloEducationApi.Models;

public class Scholar
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
    public int? Grade { get; set; }

    [Required]
    [DataType(DataType.Date)]
    [CustomValidation(typeof(Scholar), nameof(ValidateDateOfBirth))]
    public DateTime DateOfBirth { get; set; }

    [CustomValidation(typeof(Scholar), nameof(ValidatePickUpSchedule))]
    public Dictionary<string, string?>? PickUpSchedule { get; set; }

    // Optional — a scholar may have a mother, a father, both, or neither, and each
    // of a parent's own fields (name, phone) is independently optional too. Stored
    // as separate rows (Role 'Mother'/'Father') in the Parents table, not as
    // columns on Scholars, so the two roles can be added/edited/removed independently.
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

    public static ValidationResult? ValidateDateOfBirth(DateTime date, ValidationContext context)
    {
        return date > DateTime.UtcNow
            ? new ValidationResult("Date of birth cannot be in the future.")
            : ValidationResult.Success;
    }

    public static ValidationResult? ValidatePickUpSchedule(Dictionary<string, string?>? schedule,
        ValidationContext context)
    {
        if (schedule == null) return ValidationResult.Success;

        var validDays = new HashSet<string> { "monday", "tuesday", "wednesday", "thursday", "friday" };

        foreach (var (scheduleKey, timeValue) in schedule)
        {
            var day = scheduleKey.ToLowerInvariant();

            if (!validDays.Contains(day)) return new ValidationResult($"Invalid day in schedule: {scheduleKey}");

            // Strict 24-hour "HH:mm" (e.g. "12:00"), not TimeSpan.TryParse — that accepts bare
            // numbers like "12" or "99" as a day-count duration, which silently saves but can
            // never match a Gantt-chart time slot (no clock time actually parses to "99:00").
            if (!string.IsNullOrWhiteSpace(timeValue) &&
                !DateTime.TryParseExact(timeValue, "HH:mm", CultureInfo.InvariantCulture,
                    DateTimeStyles.None, out _))
                return new ValidationResult(
                    $"Invalid time format for {scheduleKey}: '{timeValue}'. Use 24-hour HH:mm, e.g. 13:30.");
        }

        return ValidationResult.Success;
    }

    public static ValidationResult? ValidatePhoneNumber(string? phoneNumber, ValidationContext context)
    {
        if (string.IsNullOrWhiteSpace(phoneNumber)) return ValidationResult.Success;

        return Regex.IsMatch(phoneNumber, @"^\+?[0-9 ()-]{6,20}$")
            ? ValidationResult.Success
            : new ValidationResult($"Invalid phone number: '{phoneNumber}'.");
    }
}
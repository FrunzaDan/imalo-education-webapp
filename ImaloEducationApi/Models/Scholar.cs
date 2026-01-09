using System.ComponentModel.DataAnnotations;

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

            if (!string.IsNullOrWhiteSpace(timeValue) && !TimeSpan.TryParse(timeValue, out _))
                return new ValidationResult($"Invalid time format for {scheduleKey}: {timeValue}");
        }

        return ValidationResult.Success;
    }
}
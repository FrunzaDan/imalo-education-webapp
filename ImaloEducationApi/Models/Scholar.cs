using System.ComponentModel.DataAnnotations;

namespace ImaloEducationApi.Models
{
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
            if (date > DateTime.UtcNow)
            {
                return new ValidationResult("Date of birth cannot be in the future.");
            }
            return ValidationResult.Success;
        }

        public static ValidationResult? ValidatePickUpSchedule(Dictionary<string, string?>? schedule, ValidationContext context)
        {
            if (schedule == null) return ValidationResult.Success;

            var validDays = new HashSet<string> { "monday", "tuesday", "wednesday", "thursday", "friday" };

            foreach (var kvp in schedule)
            {
                var day = kvp.Key?.ToLowerInvariant();

                if (!validDays.Contains(day ?? ""))
                {
                    return new ValidationResult($"Invalid day in schedule: {kvp.Key}");
                }

                var time = kvp.Value;
                if (!string.IsNullOrWhiteSpace(time) && !TimeSpan.TryParse(time, out _))
                {
                    return new ValidationResult($"Invalid time format for {kvp.Key}: {time}");
                }
            }

            return ValidationResult.Success;
        }
    }
}

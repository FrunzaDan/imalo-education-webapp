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

        public Dictionary<string, string>? PickUpSchedule { get; set; }

        // Custom validator method
        public static ValidationResult? ValidateDateOfBirth(DateTime date, ValidationContext context)
        {
            if (date > DateTime.UtcNow)
            {
                return new ValidationResult("Date of birth cannot be in the future.");
            }
            return ValidationResult.Success;
        }
    }
}

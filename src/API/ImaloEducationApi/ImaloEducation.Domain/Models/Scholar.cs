namespace ImaloEducation.Domain.Models;

public class Scholar
{
    public Guid ScholarId { get; set; }

    public string FirstName { get; set; } = string.Empty;

    public string LastName { get; set; } = string.Empty;

    public Gender Gender { get; set; }

    public int? SchoolId { get; set; }

    public byte? Grade { get; set; }

    public DateOnly? BirthDate { get; set; }

    public PickupSchedule? PickupSchedule { get; set; }

    public string? MotherFirstName { get; set; }

    public string? MotherLastName { get; set; }

    public string? MotherPhoneNumber { get; set; }

    public string? FatherFirstName { get; set; }

    public string? FatherLastName { get; set; }

    public string? FatherPhoneNumber { get; set; }
}

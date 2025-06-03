using System;

namespace ImaloEducationApi.Models;

public class Scholar
{
    public Guid Id { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public int? SchoolId { get; set; }
    public int? Grade { get; set; }
    public DateTime DateOfBirth { get; set; }
    public Dictionary<string, string>? PickUpSchedule { get; set; }
}

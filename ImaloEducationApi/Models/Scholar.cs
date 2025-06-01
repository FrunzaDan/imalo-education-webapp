using System;

namespace ImaloEducationApi.Models;

public class Scholar
{
    public Guid Id { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string SchoolId { get; set; } = string.Empty;
    public int Grade { get; set; }
    public DateTime BirthDate { get; set; }
}

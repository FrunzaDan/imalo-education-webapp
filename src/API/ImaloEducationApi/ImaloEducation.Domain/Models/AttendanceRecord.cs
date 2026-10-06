namespace ImaloEducation.Domain.Models;

public class AttendanceRecord
{
    public DateOnly Date { get; set; }

    public decimal LunchCost { get; set; }

    public decimal TransportCost { get; set; }

    public bool Present { get; set; } = true;

    public bool LunchSelected { get; set; } = true;
    public bool TransportSelected { get; set; } = true;
}

using System.ComponentModel.DataAnnotations;

namespace ImaloEducationApi.Models;

public class AttendanceRecord
{
    public DateOnly Date { get; set; }

    [Range(typeof(decimal), "0", "9999.99", ParseLimitsInInvariantCulture = true,
        ConvertValueInInvariantCulture = true, ErrorMessage = "Lunch cost must be between 0 and 9999.99.")]
    public decimal LunchCost { get; set; }

    [Range(typeof(decimal), "0", "9999.99", ParseLimitsInInvariantCulture = true,
        ConvertValueInInvariantCulture = true, ErrorMessage = "Transport cost must be between 0 and 9999.99.")]
    public decimal TransportCost { get; set; }

    public bool Present { get; set; } = true;

    public bool LunchSelected { get; set; } = true;
    public bool TransportSelected { get; set; } = true;
}

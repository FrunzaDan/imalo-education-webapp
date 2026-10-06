using System.ComponentModel.DataAnnotations;
using ImaloEducation.Domain.Models;

namespace ImaloEducation.BusinessLogic.Contracts;

/// <summary>One day of an attendance sheet as the UI sends it, with the cost limits the API checks.</summary>
public class AttendanceRecordRequest
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

    public AttendanceRecord ToAttendanceRecord() => new()
    {
        Date = Date,
        LunchCost = LunchCost,
        TransportCost = TransportCost,
        Present = Present,
        LunchSelected = LunchSelected,
        TransportSelected = TransportSelected,
    };
}

using System.ComponentModel.DataAnnotations;

namespace ImaloEducationApi.Models;

public class AttendanceRecord
{
    // A calendar day, never a time — serialized as "YYYY-MM-DD".
    public DateOnly Date { get; set; }

    [Range(typeof(decimal), "0", "9999.99", ParseLimitsInInvariantCulture = true,
        ConvertValueInInvariantCulture = true, ErrorMessage = "Lunch cost must be between 0 and 9999.99.")]
    public decimal LunchCost { get; set; }

    [Range(typeof(decimal), "0", "9999.99", ParseLimitsInInvariantCulture = true,
        ConvertValueInInvariantCulture = true, ErrorMessage = "Transport cost must be between 0 and 9999.99.")]
    public decimal TransportCost { get; set; }

    // Whether the scholar was present that day. Lunch/Transport can only be
    // selected while this is true (enforced in ScholarsController). Defaults to
    // true so records saved before this field existed (missing from their
    // stored JSON) still deserialize as present, matching the Lunch/Transport
    // selections they already carried.
    public bool Present { get; set; } = true;

    // Whether this day's cost currently counts toward the scholar's billed total.
    // Defaults to true so records saved before this field existed (missing from
    // their stored JSON) still count, matching the totals they already showed.
    public bool LunchSelected { get; set; } = true;
    public bool TransportSelected { get; set; } = true;
}

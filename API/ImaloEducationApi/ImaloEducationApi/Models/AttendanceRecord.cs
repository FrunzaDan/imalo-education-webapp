namespace ImaloEducationApi.Models
{
    public class AttendanceRecord
    {
        public DateTime Date { get; set; }
        public decimal LunchCost { get; set; }
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
}

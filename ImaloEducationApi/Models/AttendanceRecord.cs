namespace ImaloEducationApi.Models
{
    public class AttendanceRecord
    {
        public DateTime Date { get; set; }
        public decimal LunchCost { get; set; }
        public decimal TransportCost { get; set; }

        // Whether this day's cost currently counts toward the scholar's billed total.
        // Defaults to true so records saved before this field existed (missing from
        // their stored JSON) still count, matching the totals they already showed.
        public bool LunchSelected { get; set; } = true;
        public bool TransportSelected { get; set; } = true;
    }
}

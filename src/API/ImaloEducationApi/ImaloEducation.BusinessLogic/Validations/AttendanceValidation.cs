using System.Globalization;
using ImaloEducation.Domain.Models;

namespace ImaloEducation.BusinessLogic.Validations;

public static class AttendanceValidation
{
    /// <summary>Returns the rule violations in an attendance sheet; empty when it is valid.</summary>
    public static IReadOnlyList<string> Validate(IReadOnlyCollection<AttendanceRecord> attendance)
    {
        ArgumentNullException.ThrowIfNull(attendance);

        var errors = new List<string>();

        var duplicateDates = attendance
            .GroupBy(r => r.Date)
            .Where(g => g.Count() > 1)
            .Select(g => g.Key)
            .ToList();
        if (duplicateDates.Count > 0)
            errors.Add($"Each date can appear only once. Repeated: {FormatDates(duplicateDates)}.");

        var absentButSelected = attendance
            .Where(r => !r.Present && (r.LunchSelected || r.TransportSelected))
            .Select(r => r.Date)
            .ToList();
        if (absentButSelected.Count > 0)
            errors.Add("Lunch or Transport cannot be selected on a day the scholar was not present: " +
                       $"{FormatDates(absentButSelected)}.");

        return errors;
    }

    private static string FormatDates(IEnumerable<DateOnly> dates) =>
        string.Join(", ", dates.Select(date => date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)));
}

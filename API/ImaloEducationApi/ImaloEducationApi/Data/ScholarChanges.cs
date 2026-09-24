using ImaloEducationApi.Models;

namespace ImaloEducationApi.Data;

public static class ScholarChanges
{
    public static string Describe(Scholar before, Scholar after)
    {
        var changedFields = new List<string>();

        if (before.FirstName != after.FirstName) changedFields.Add("first name");
        if (before.LastName != after.LastName) changedFields.Add("last name");
        if (before.BirthDate != after.BirthDate) changedFields.Add("birth date");
        if (before.Grade != after.Grade) changedFields.Add("grade");
        if (before.SchoolId != after.SchoolId) changedFields.Add("school");
        if (after.PickupSchedule is not null && !SameSchedule(before.PickupSchedule, after.PickupSchedule))
            changedFields.Add("pickup schedule");
        if (!SameParent(
                (before.MotherFirstName, before.MotherLastName, before.MotherPhoneNumber),
                (after.MotherFirstName, after.MotherLastName, after.MotherPhoneNumber)))
            changedFields.Add("mother");
        if (!SameParent(
                (before.FatherFirstName, before.FatherLastName, before.FatherPhoneNumber),
                (after.FatherFirstName, after.FatherLastName, after.FatherPhoneNumber)))
            changedFields.Add("father");

        return changedFields.Count > 0 ? $"Updated: {string.Join(", ", changedFields)}" : "No fields changed";
    }

    private static bool SameSchedule(PickupSchedule? before, PickupSchedule after) =>
        before?.Monday == after.Monday && before?.Tuesday == after.Tuesday &&
        before?.Wednesday == after.Wednesday && before?.Thursday == after.Thursday &&
        before?.Friday == after.Friday;

    private static bool SameParent((string? FirstName, string? LastName, string? PhoneNumber) before,
        (string? FirstName, string? LastName, string? PhoneNumber) after) =>
        Normalize(before.FirstName) == Normalize(after.FirstName) &&
        Normalize(before.LastName) == Normalize(after.LastName) &&
        Normalize(before.PhoneNumber) == Normalize(after.PhoneNumber);

    private static string? Normalize(string? value) => string.IsNullOrWhiteSpace(value) ? null : value;
}

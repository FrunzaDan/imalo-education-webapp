using ImaloEducationApi.Data;
using ImaloEducationApi.Models;

namespace ImaloEducationApi.Tests.Data;

// The "Edited" audit entry's Details: which fields an update changed, in the customer and
// employee apps' "Updated: first name, email" form.
public class ScholarChangesTests
{
    private static Scholar SampleScholar() => new()
    {
        ScholarId = Guid.NewGuid(),
        FirstName = "Ana",
        LastName = "Popescu",
        BirthDate = new DateOnly(2016, 5, 1),
        Grade = 3,
        SchoolId = 1,
        PickupSchedule = new PickupSchedule { Monday = new TimeOnly(13, 30) },
        MotherFirstName = "Maria",
        MotherPhoneNumber = "0712345678",
    };

    private static Scholar Copy(Scholar scholar) => new()
    {
        ScholarId = scholar.ScholarId,
        FirstName = scholar.FirstName,
        LastName = scholar.LastName,
        BirthDate = scholar.BirthDate,
        Grade = scholar.Grade,
        SchoolId = scholar.SchoolId,
        PickupSchedule = scholar.PickupSchedule is { } schedule
            ? new PickupSchedule
            {
                Monday = schedule.Monday, Tuesday = schedule.Tuesday, Wednesday = schedule.Wednesday,
                Thursday = schedule.Thursday, Friday = schedule.Friday,
            }
            : null,
        MotherFirstName = scholar.MotherFirstName,
        MotherLastName = scholar.MotherLastName,
        MotherPhoneNumber = scholar.MotherPhoneNumber,
        FatherFirstName = scholar.FatherFirstName,
        FatherLastName = scholar.FatherLastName,
        FatherPhoneNumber = scholar.FatherPhoneNumber,
    };

    [Fact]
    public void Describe_NothingChanged_SaysSo()
    {
        var before = SampleScholar();

        Assert.Equal("No fields changed", ScholarChanges.Describe(before, Copy(before)));
    }

    [Fact]
    public void Describe_ListsEveryChangedField_InFormOrder()
    {
        var before = SampleScholar();
        var after = Copy(before);
        after.FirstName = "Ioana";
        after.Grade = 4;
        after.PickupSchedule!.Friday = new TimeOnly(12, 0);
        after.FatherFirstName = "Ion";

        Assert.Equal("Updated: first name, grade, pickup schedule, father", ScholarChanges.Describe(before, after));
    }

    [Fact]
    public void Describe_ClearingAParent_CountsAsAChange()
    {
        var before = SampleScholar();
        var after = Copy(before);
        after.MotherFirstName = null;
        after.MotherPhoneNumber = null;

        Assert.Equal("Updated: mother", ScholarChanges.Describe(before, after));
    }

    [Fact]
    public void Describe_BlankParentField_IsTheSameAsNone()
    {
        // A blank field is stored as NULL, so sending "" for a field that's NULL changes nothing.
        var before = SampleScholar();
        var after = Copy(before);
        after.MotherLastName = "  ";

        Assert.Equal("No fields changed", ScholarChanges.Describe(before, after));
    }

    [Fact]
    public void Describe_NoScheduleOnTheUpdate_LeavesTheScheduleUnchanged()
    {
        // UpdateScholarAsync only writes the schedule when one is sent.
        var before = SampleScholar();
        var after = Copy(before);
        after.PickupSchedule = null;

        Assert.Equal("No fields changed", ScholarChanges.Describe(before, after));
    }

    [Fact]
    public void Describe_FirstScheduleForAScholarWithout_CountsOnlyWhenItHasATime()
    {
        var before = SampleScholar();
        before.PickupSchedule = null;

        var emptySchedule = Copy(before);
        emptySchedule.PickupSchedule = new PickupSchedule();
        var withATime = Copy(before);
        withATime.PickupSchedule = new PickupSchedule { Tuesday = new TimeOnly(14, 0) };

        Assert.Equal("No fields changed", ScholarChanges.Describe(before, emptySchedule));
        Assert.Equal("Updated: pickup schedule", ScholarChanges.Describe(before, withATime));
    }
}

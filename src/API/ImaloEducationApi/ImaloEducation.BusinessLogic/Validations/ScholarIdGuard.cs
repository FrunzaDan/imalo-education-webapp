namespace ImaloEducation.BusinessLogic.Validations;

internal static class ScholarIdGuard
{
    public static void Ensure(Guid scholarId)
    {
        if (scholarId == Guid.Empty)
            throw new ArgumentException("Scholar ID must not be empty.", nameof(scholarId));
    }
}

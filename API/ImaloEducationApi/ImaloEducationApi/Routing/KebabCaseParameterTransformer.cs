using System.Text.RegularExpressions;

namespace ImaloEducationApi.Routing;

// Turns route tokens into lowercase kebab-case, the conventional casing for URL paths:
// "[controller]" on ScholarsController becomes "scholars".
public sealed partial class KebabCaseParameterTransformer : IOutboundParameterTransformer
{
    public string? TransformOutbound(object? value) =>
        value is null ? null : WordBoundary().Replace(value.ToString()!, "$1-$2").ToLowerInvariant();

    [GeneratedRegex("([a-z0-9])([A-Z])")]
    private static partial Regex WordBoundary();
}

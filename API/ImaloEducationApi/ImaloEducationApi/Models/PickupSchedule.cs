using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace ImaloEducationApi.Models;

// One optional pickup time per school day. A typed class rather than a free-form
// Dictionary<string, string?>, so deserialization itself enforces the shape: an
// unknown day ("saturday") is rejected outright (Disallow below), and each time
// must be a strict 24-hour "HH:mm" (HourMinuteTimeOnlyConverter). Either failure
// surfaces as a 400 from model binding, before the controller ever runs.
[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public class PickupSchedule
{
    [JsonConverter(typeof(HourMinuteTimeOnlyConverter))]
    public TimeOnly? Monday { get; set; }

    [JsonConverter(typeof(HourMinuteTimeOnlyConverter))]
    public TimeOnly? Tuesday { get; set; }

    [JsonConverter(typeof(HourMinuteTimeOnlyConverter))]
    public TimeOnly? Wednesday { get; set; }

    [JsonConverter(typeof(HourMinuteTimeOnlyConverter))]
    public TimeOnly? Thursday { get; set; }

    [JsonConverter(typeof(HourMinuteTimeOnlyConverter))]
    public TimeOnly? Friday { get; set; }
}

// TimeOnly's built-in JSON format is "HH:mm:ss"; the UI (and every schedule
// already stored in the DB) uses "HH:mm", so read and write exactly that.
// ParseExact, not TimeOnly.TryParse — the latter would also accept looser forms
// that can never match a Gantt-chart time slot. A blank string reads as "no
// pickup" (null), same as JSON null: older saves stored blanks that way.
public sealed class HourMinuteTimeOnlyConverter : JsonConverter<TimeOnly?>
{
    private const string Format = "HH:mm";

    public override bool HandleNull => true;

    public override TimeOnly? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType == JsonTokenType.Null) return null;

        var value = reader.GetString();
        if (string.IsNullOrWhiteSpace(value)) return null;

        return TimeOnly.TryParseExact(value, Format, CultureInfo.InvariantCulture, DateTimeStyles.None, out var time)
            ? time
            : throw new JsonException($"Invalid time '{value}'. Use 24-hour HH:mm, e.g. 13:30.");
    }

    public override void Write(Utf8JsonWriter writer, TimeOnly? value, JsonSerializerOptions options)
    {
        if (value is { } time)
            writer.WriteStringValue(time.ToString(Format, CultureInfo.InvariantCulture));
        else
            writer.WriteNullValue();
    }
}

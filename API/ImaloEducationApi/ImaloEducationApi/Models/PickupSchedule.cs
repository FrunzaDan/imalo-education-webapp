using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace ImaloEducationApi.Models;

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

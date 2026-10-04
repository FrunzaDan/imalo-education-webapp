using System.Text.Json.Serialization;

namespace ImaloEducationApi.Models;

[JsonConverter(typeof(JsonStringEnumConverter<AuditAction>))]
public enum AuditAction
{
    Created,
    Edited,
    Deleted,
}

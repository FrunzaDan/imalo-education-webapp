using System.Text.Json.Serialization;

namespace ImaloEducation.Domain.Models;

[JsonConverter(typeof(JsonStringEnumConverter<AuditAction>))]
public enum AuditAction
{
    Created,
    Edited,
    Deleted,
}

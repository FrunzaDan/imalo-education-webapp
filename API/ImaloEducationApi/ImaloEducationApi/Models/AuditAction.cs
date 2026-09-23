using System.Text.Json.Serialization;

namespace ImaloEducationApi.Models;

// Stored (ScholarAuditLog.ActionType, CHECK-constrained to these names) and sent over
// the wire by name, not by number.
[JsonConverter(typeof(JsonStringEnumConverter<AuditAction>))]
public enum AuditAction
{
    Created,
    Edited,
    Deleted,
}

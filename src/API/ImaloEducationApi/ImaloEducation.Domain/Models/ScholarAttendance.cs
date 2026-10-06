namespace ImaloEducation.Domain.Models;

public record ScholarAttendance(Guid ScholarId, List<AttendanceRecord> Attendance);

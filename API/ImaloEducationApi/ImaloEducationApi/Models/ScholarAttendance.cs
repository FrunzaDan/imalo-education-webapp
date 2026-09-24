namespace ImaloEducationApi.Models;

public record ScholarAttendance(Guid ScholarId, List<AttendanceRecord> Attendance);

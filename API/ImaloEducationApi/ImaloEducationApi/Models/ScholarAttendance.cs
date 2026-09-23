namespace ImaloEducationApi.Models;

// One scholar's full attendance list, as returned by GET api/scholars/attendance.
public record ScholarAttendance(Guid ScholarId, List<AttendanceRecord> Attendance);

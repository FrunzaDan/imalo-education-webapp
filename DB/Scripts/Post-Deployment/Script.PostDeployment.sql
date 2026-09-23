-- Runs after every deploy, so everything here must be idempotent.

-- AttendanceRecord.Date is a DateOnly in the API ("2026-09-01"). It used to be a
-- DateTime, which System.Text.Json wrote as "2026-09-01T00:00:00" (or with a
-- trailing "Z"), and the DateOnly converter rejects that format — so strip the
-- midnight time part from any record still stored the old way. Dates were always
-- whole days, so midnight is the only time part that can occur.
UPDATE [dbo].[Attendance]
SET [AttendanceJson] = REPLACE(REPLACE([AttendanceJson], 'T00:00:00Z"', '"'), 'T00:00:00"', '"')
WHERE [AttendanceJson] LIKE '%T00:00:00%';
GO

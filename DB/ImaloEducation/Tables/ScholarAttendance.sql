-- A scholar's attendance records, stored as JSON (one row per scholar).
CREATE TABLE [dbo].[ScholarAttendance]
(
    -- ScholarId is both the primary key and the foreign key to Scholar.
    [ScholarId] UNIQUEIDENTIFIER NOT NULL,
    -- The JSON representation of the attendance records.
    [AttendanceJson] NVARCHAR (MAX) NOT NULL,
    CONSTRAINT [PK_ScholarAttendance] PRIMARY KEY CLUSTERED ([ScholarId]),
    -- The DB can't check the records' shape (the API's AttendanceRecord does),
    -- but it can at least refuse anything that isn't JSON.
    CONSTRAINT [CK_ScholarAttendance_AttendanceJson] CHECK (ISJSON([AttendanceJson]) = 1),
    -- An attendance record can only exist for a valid scholar, and is deleted with it.
    CONSTRAINT [FK_ScholarAttendance_Scholar]
        FOREIGN KEY ([ScholarId]) REFERENCES [dbo].[Scholar] ([ScholarId])
        ON DELETE CASCADE
);

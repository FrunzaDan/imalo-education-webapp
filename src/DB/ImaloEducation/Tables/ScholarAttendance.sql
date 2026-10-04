CREATE TABLE [dbo].[ScholarAttendance]
(
    [ScholarId] UNIQUEIDENTIFIER NOT NULL,
    [AttendanceJson] NVARCHAR (MAX) NOT NULL,
    CONSTRAINT [PK_ScholarAttendance] PRIMARY KEY CLUSTERED ([ScholarId]),
    CONSTRAINT [CK_ScholarAttendance_AttendanceJson] CHECK (ISJSON([AttendanceJson]) = 1),
    CONSTRAINT [FK_ScholarAttendance_Scholar]
        FOREIGN KEY ([ScholarId]) REFERENCES [dbo].[Scholar] ([ScholarId])
        ON DELETE CASCADE
);

-- Attendance.sql

-- Create the Attendance table to store scholar attendance records as JSON
CREATE TABLE [dbo].[Attendance]
(
    -- ScholarId as the primary key and foreign key to the Scholars table
    [ScholarId] UNIQUEIDENTIFIER NOT NULL,
    -- AttendanceJson to store the JSON representation of the attendance record
    [AttendanceJson] NVARCHAR(MAX) NOT NULL,

    -- Define ScholarId as the primary key for this table
    CONSTRAINT [PK_Attendance] PRIMARY KEY CLUSTERED ([ScholarId] ASC),

    -- Define foreign key constraint to Scholars table
    -- This ensures that an attendance record can only exist for a valid scholar
    CONSTRAINT [FK_Attendance_Scholars] FOREIGN KEY ([ScholarId])
    REFERENCES [dbo].[Scholars] ([Id])
    ON DELETE CASCADE -- If a scholar is deleted, their attendance is also deleted
);
GO
-- PickUpSchedule.sql

-- Create the PickUpSchedule table to store scholar pickup schedules as JSON
CREATE TABLE [dbo].[PickUpSchedule]
(
    -- ScholarId as the primary key and foreign key to the Scholars table
    [ScholarId] UNIQUEIDENTIFIER NOT NULL,
    -- ScheduleJson to store the JSON representation of the pickup schedule
    [ScheduleJson] NVARCHAR(MAX) NOT NULL,

    -- Define ScholarId as the primary key for this table
    CONSTRAINT [PK_PickUpSchedule] PRIMARY KEY CLUSTERED ([ScholarId] ASC),

    -- Define foreign key constraint to Scholars table
    -- This ensures that a schedule can only exist for a valid scholar
    CONSTRAINT [FK_PickUpSchedule_Scholars] FOREIGN KEY ([ScholarId])
    REFERENCES [dbo].[Scholars] ([Id])
    ON DELETE CASCADE -- If a scholar is deleted, their schedule is also deleted
);
GO
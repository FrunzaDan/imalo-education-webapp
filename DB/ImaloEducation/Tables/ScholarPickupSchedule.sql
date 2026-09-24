-- A scholar's pickup schedule, stored as JSON (one row per scholar).
CREATE TABLE [dbo].[ScholarPickupSchedule]
(
    -- ScholarId is both the primary key and the foreign key to Scholar.
    [ScholarId] UNIQUEIDENTIFIER NOT NULL,
    -- The JSON representation of the pickup schedule.
    [ScheduleJson] NVARCHAR (MAX) NOT NULL,
    CONSTRAINT [PK_ScholarPickupSchedule] PRIMARY KEY CLUSTERED ([ScholarId]),
    -- The DB can't check the schedule's shape (that's Scholar.PickupSchedule's
    -- job in the API), but it can at least refuse anything that isn't JSON.
    CONSTRAINT [CK_ScholarPickupSchedule_ScheduleJson] CHECK (ISJSON([ScheduleJson]) = 1),
    -- A schedule can only exist for a valid scholar, and is deleted with it.
    CONSTRAINT [FK_ScholarPickupSchedule_Scholar]
        FOREIGN KEY ([ScholarId]) REFERENCES [dbo].[Scholar] ([ScholarId])
        ON DELETE CASCADE
);

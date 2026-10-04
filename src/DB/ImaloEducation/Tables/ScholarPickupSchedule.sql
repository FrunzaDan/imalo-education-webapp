CREATE TABLE [dbo].[ScholarPickupSchedule]
(
    [ScholarId] UNIQUEIDENTIFIER NOT NULL,
    [ScheduleJson] NVARCHAR (MAX) NOT NULL,
    CONSTRAINT [PK_ScholarPickupSchedule] PRIMARY KEY CLUSTERED ([ScholarId]),
    CONSTRAINT [CK_ScholarPickupSchedule_ScheduleJson] CHECK (ISJSON([ScheduleJson]) = 1),
    CONSTRAINT [FK_ScholarPickupSchedule_Scholar]
        FOREIGN KEY ([ScholarId]) REFERENCES [dbo].[Scholar] ([ScholarId])
        ON DELETE CASCADE
);

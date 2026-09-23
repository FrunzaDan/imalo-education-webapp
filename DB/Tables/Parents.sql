-- Parents.sql

-- Create the Parents table: up to one Mother row and one Father row per
-- scholar, each optional. Own table (not a JSON blob like PickUpSchedule/
-- Attendance) since it's a genuinely relational one-to-few, not a
-- day-keyed or weekday-keyed collection.
CREATE TABLE [dbo].[Parents]
(
    [ScholarId] UNIQUEIDENTIFIER NOT NULL,
    [Role] VARCHAR(6) NOT NULL, -- 'Mother' or 'Father' (ASCII, CHECK below)
    [FirstName] NVARCHAR(100) NULL,
    [LastName] NVARCHAR(100) NULL,
    [PhoneNumber] VARCHAR(20) NULL, -- ASCII only: the API accepts ^\+?[0-9 ()-]{6,20}$

    -- Natural key, no surrogate Id: every query addresses a parent by
    -- (ScholarId, Role), and the key doubles as "at most one Mother row and one
    -- Father row per scholar". Clustered on it, so a scholar's parents sit
    -- together and the FK below needs no separate index.
    CONSTRAINT [PK_Parents] PRIMARY KEY CLUSTERED ([ScholarId] ASC, [Role] ASC),

    CONSTRAINT [CK_Parents_Role] CHECK ([Role] IN ('Mother', 'Father')),

    -- Every field is individually optional (a parent might be known by name
    -- only, phone only, or both), but a row shouldn't exist with nothing in
    -- it at all — the app only inserts a row once at least one field is set.
    CONSTRAINT [CK_Parents_NotEmpty] CHECK (
        [FirstName] IS NOT NULL OR [LastName] IS NOT NULL OR [PhoneNumber] IS NOT NULL
    ),

    -- A parent record can only exist for a valid scholar, and is removed
    -- automatically if that scholar is deleted.
    CONSTRAINT [FK_Parents_Scholars] FOREIGN KEY ([ScholarId])
    REFERENCES [dbo].[Scholars] ([Id])
    ON DELETE CASCADE
);
GO

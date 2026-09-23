-- Up to one Mother row and one Father row per scholar, each optional. Own table
-- (not a JSON blob like ScholarPickupSchedule/ScholarAttendance) since it's a
-- genuinely relational one-to-few, not a day-keyed or weekday-keyed collection.
CREATE TABLE [dbo].[ScholarParent]
(
    [ScholarId] UNIQUEIDENTIFIER NOT NULL,
    [Role] VARCHAR(6) NOT NULL, -- 'Mother' or 'Father' (ASCII, CHECK below)
    [FirstName] NVARCHAR(100) NULL,
    [LastName] NVARCHAR(100) NULL,
    [PhoneNumber] VARCHAR(20) NULL, -- ASCII only: the API accepts ^\+?[0-9 ()-]{6,20}$

    -- Natural key, no surrogate ScholarParentId: every query addresses a parent by
    -- (ScholarId, Role), and the key doubles as "at most one Mother row and one
    -- Father row per scholar". Clustered on it, so a scholar's parents sit
    -- together and the FK below needs no separate index.
    CONSTRAINT [PK_ScholarParent] PRIMARY KEY CLUSTERED ([ScholarId] ASC, [Role] ASC),

    CONSTRAINT [CK_ScholarParent_Role] CHECK ([Role] IN ('Mother', 'Father')),

    -- Every field is individually optional (a parent might be known by name
    -- only, phone only, or both), but a row shouldn't exist with nothing in
    -- it at all — the app only inserts a row once at least one field is set.
    CONSTRAINT [CK_ScholarParent_NotEmpty] CHECK (
        [FirstName] IS NOT NULL OR [LastName] IS NOT NULL OR [PhoneNumber] IS NOT NULL
    ),

    -- A parent record can only exist for a valid scholar, and is removed
    -- automatically if that scholar is deleted.
    CONSTRAINT [FK_ScholarParent_Scholar] FOREIGN KEY ([ScholarId])
    REFERENCES [dbo].[Scholar] ([ScholarId])
    ON DELETE CASCADE
);
GO

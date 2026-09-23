-- ScholarAuditLog.sql

-- Records lifecycle actions (Created/Edited/Deleted) taken on a Scholar.
-- No FK to Scholars: audit history must survive a scholar being hard-deleted
-- (DeleteScholarAsync removes the Scholars row outright), so ScholarId is a
-- plain UNIQUEIDENTIFIER column, indexed for the per-scholar lookup.
CREATE TABLE [dbo].[ScholarAuditLog]
(
    [AuditId] INT IDENTITY (1, 1) NOT NULL,
    [ScholarId] UNIQUEIDENTIFIER NOT NULL,
    [Action] VARCHAR (10) NOT NULL, -- API: AuditAction enum, stored by name
    [Details] NVARCHAR (500) NULL,
    -- DATETIMEOFFSET, not DATETIME2: the value carries its own UTC offset, so it
    -- reaches the browser as "...+00:00" and is displayed in local time. A bare
    -- DATETIME2 went out with no offset and the browser read UTC as local time.
    [ActionDate] DATETIMEOFFSET (3) NOT NULL
        CONSTRAINT [DF_ScholarAuditLog_ActionDate] DEFAULT SYSUTCDATETIME(),

    CONSTRAINT [PK_ScholarAuditLog] PRIMARY KEY CLUSTERED ([AuditId] ASC),

    CONSTRAINT [CK_ScholarAuditLog_Action] CHECK ([Action] IN ('Created', 'Edited', 'Deleted'))
);
GO

CREATE INDEX [IX_ScholarAuditLog_ScholarId]
    ON [dbo].[ScholarAuditLog] ([ScholarId]);
GO

-- Supports the global, unfiltered "newest first" scan across every scholar —
-- the index above only helps once a ScholarId is known, which the global
-- audit log view doesn't have.
CREATE INDEX [IX_ScholarAuditLog_ActionDate]
    ON [dbo].[ScholarAuditLog] ([ActionDate] DESC, [AuditId] DESC);
GO

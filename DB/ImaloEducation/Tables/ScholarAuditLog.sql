-- Records lifecycle actions (Created/Edited/Deleted) taken on a Scholar — the same
-- audit table as CustomerAuditLog/EmployeeAuditLog, minus PerformedBy (Imalo has no users).
-- No FK to Scholar: audit history must survive a scholar being hard-deleted
-- (DeleteScholarAsync removes the Scholar row outright), so ScholarId is a
-- plain UNIQUEIDENTIFIER column, indexed for the per-scholar lookup.
CREATE TABLE [dbo].[ScholarAuditLog]
(
    [ScholarAuditLogId] INT IDENTITY (1, 1) NOT NULL,
    [ScholarId] UNIQUEIDENTIFIER NOT NULL,
    -- A fixed set of values (the API's AuditAction enum), so a short VARCHAR with a CHECK
    -- rather than free text.
    [ActionType] VARCHAR (20) NOT NULL,
    [Details] NVARCHAR (500) NULL,
    -- UTC (SYSUTCDATETIME), in DATETIME2(3) like every timestamp in the three apps. It carries
    -- no offset, so the API marks the value it reads as UTC — that's what makes it reach the
    -- browser with a trailing "Z" and be shown in the viewer's local time.
    [OccurredAt] DATETIME2 (3) NOT NULL
        CONSTRAINT [DF_ScholarAuditLog_OccurredAt] DEFAULT SYSUTCDATETIME(),

    CONSTRAINT [PK_ScholarAuditLog] PRIMARY KEY CLUSTERED ([ScholarAuditLogId] ASC),

    CONSTRAINT [CK_ScholarAuditLog_ActionType] CHECK ([ActionType] IN ('Created', 'Edited', 'Deleted'))
);
GO

-- Keyed in the per-scholar query's ORDER BY order, so the "newest first" listing is
-- read straight off the index with no sort.
CREATE INDEX [IX_ScholarAuditLog_ScholarId_OccurredAt_ScholarAuditLogId]
    ON [dbo].[ScholarAuditLog] ([ScholarId], [OccurredAt] DESC, [ScholarAuditLogId] DESC);
GO

-- Supports the global, unfiltered "newest first" scan across every scholar —
-- the index above only helps once a ScholarId is known, which the global
-- audit log view doesn't have.
CREATE INDEX [IX_ScholarAuditLog_OccurredAt_ScholarAuditLogId]
    ON [dbo].[ScholarAuditLog] ([OccurredAt] DESC, [ScholarAuditLogId] DESC);
GO

-- ScholarAuditLog.sql

-- Records lifecycle actions (Created/Edited/Deleted) taken on a Scholar.
-- No FK to Scholars: audit history must survive a scholar being hard-deleted
-- (DeleteScholarAsync removes the Scholars row outright), so ScholarId is a
-- plain UNIQUEIDENTIFIER column, indexed for the per-scholar lookup.
CREATE TABLE [dbo].[ScholarAuditLog]
(
    [AuditId] INT IDENTITY (1, 1) NOT NULL,
    [ScholarId] UNIQUEIDENTIFIER NOT NULL,
    [Action] NVARCHAR (50) NOT NULL,
    [Details] NVARCHAR (500) NULL,
    [ActionDate] DATETIME2 NOT NULL,

    CONSTRAINT [PK_ScholarAuditLog] PRIMARY KEY CLUSTERED ([AuditId] ASC)
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

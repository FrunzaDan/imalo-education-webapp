CREATE TABLE [dbo].[ScholarAuditLog]
(
    [ScholarAuditLogId] INT IDENTITY (1, 1) NOT NULL,
    [ScholarId] UNIQUEIDENTIFIER NOT NULL,
    [ActionType] VARCHAR (20) NOT NULL,
    [Details] NVARCHAR (500) NULL,
    [OccurredAt] DATETIME2 (3) NOT NULL
        CONSTRAINT [DF_ScholarAuditLog_OccurredAt] DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_ScholarAuditLog] PRIMARY KEY CLUSTERED ([ScholarAuditLogId]),
    CONSTRAINT [CK_ScholarAuditLog_ActionType] CHECK ([ActionType] IN ('Created', 'Edited', 'Deleted'))
);
GO

CREATE INDEX [IX_ScholarAuditLog_ScholarId_OccurredAt_ScholarAuditLogId]
    ON [dbo].[ScholarAuditLog] ([ScholarId], [OccurredAt] DESC, [ScholarAuditLogId] DESC);
GO

CREATE INDEX [IX_ScholarAuditLog_OccurredAt_ScholarAuditLogId]
    ON [dbo].[ScholarAuditLog] ([OccurredAt] DESC, [ScholarAuditLogId] DESC);

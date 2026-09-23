-- The SQL Database Project build process handles schema creation (dbo)
-- and conditional table creation during deployment.
CREATE TABLE [dbo].[Scholar]
(
    -- Sequential, not NEWID(): ScholarId is the clustered key, and random GUIDs insert
    -- at random points in the index (page splits, fragmentation).
    [ScholarId] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_Scholar_ScholarId] DEFAULT NEWSEQUENTIALID(),
    [FirstName] NVARCHAR(100) NOT NULL,
    [LastName] NVARCHAR(100) NOT NULL,
    [BirthDate] DATE NOT NULL, -- date-only, never a time component (API: Scholar.DateOfBirth is DateOnly)
    [Grade] TINYINT NULL, -- 0-12 range enforced app-side, fits a single byte
    [SchoolId] INT NULL,

    CONSTRAINT [PK_Scholar] PRIMARY KEY CLUSTERED ([ScholarId] ASC)
);
GO

-- The SQL Database Project build process handles schema creation (dbo)
-- and conditional table creation during deployment.
CREATE TABLE [dbo].[Scholar]
(
    -- Sequential, not NEWID(): ScholarId is the clustered key, and random GUIDs insert
    -- at random points in the index (page splits, fragmentation).
    [ScholarId] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_Scholar_ScholarId] DEFAULT NEWSEQUENTIALID(),
    [FirstName] NVARCHAR(100) NOT NULL,
    [LastName] NVARCHAR(100) NOT NULL,
    [BirthDate] DATE NOT NULL, -- date-only, never a time component (API: Scholar.BirthDate is DateOnly)
    [Grade] TINYINT NULL, -- 0-12 (kindergarten to 12th grade), fits a single byte
    -- The UI's school list (assets/schools.json) — there's no School table to reference.
    [SchoolId] INT NULL,

    CONSTRAINT [PK_Scholar] PRIMARY KEY CLUSTERED ([ScholarId] ASC),

    -- The API validates both ([Range]); these make them hold for every path into the table.
    CONSTRAINT [CK_Scholar_Grade] CHECK ([Grade] BETWEEN 0 AND 12),
    CONSTRAINT [CK_Scholar_SchoolId] CHECK ([SchoolId] > 0)
);
GO

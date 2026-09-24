CREATE TABLE [dbo].[Scholar]
(
    -- Sequential, not NEWID(): ScholarId is the clustered key, and random GUIDs insert
    -- at random points in the index (page splits, fragmentation).
    [ScholarId] UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT [DF_Scholar_ScholarId] DEFAULT NEWSEQUENTIALID(),
    [FirstName] NVARCHAR (100) NOT NULL,
    [LastName] NVARCHAR (100) NOT NULL,
    -- Date-only, never a time component (API: Scholar.BirthDate is DateOnly).
    [BirthDate] DATE NOT NULL,
    -- 0-12 (kindergarten to 12th grade), fits a single byte.
    [Grade] TINYINT NULL,
    -- The UI's school list (assets/schools.json) — there's no School table to reference.
    [SchoolId] INT NULL,
    CONSTRAINT [PK_Scholar] PRIMARY KEY CLUSTERED ([ScholarId]),
    -- The API validates both ([Range]); these make them hold for every path into the table.
    CONSTRAINT [CK_Scholar_Grade] CHECK ([Grade] BETWEEN 0 AND 12),
    CONSTRAINT [CK_Scholar_SchoolId] CHECK ([SchoolId] > 0)
);

-- Scholars.sql

-- Create the Scholars table
-- The SQL Database Project build process will handle schema creation (dbo)
-- and conditional table creation during deployment.
CREATE TABLE [dbo].[Scholars]
(
    -- Sequential, not NEWID(): Id is the clustered key, and random GUIDs insert
    -- at random points in the index (page splits, fragmentation).
    [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_Scholars_Id] DEFAULT NEWSEQUENTIALID(),
    [FirstName] NVARCHAR(100) NOT NULL,
    [LastName] NVARCHAR(100) NOT NULL,
    [DateOfBirth] DATE NOT NULL, -- date-only, never a time component (API: Scholar.DateOfBirth is DateOnly)
    [Grade] TINYINT NULL, -- 0-12 range enforced app-side, fits a single byte
    [SchoolId] INT NULL,

    -- Define the Primary Key constraint
    CONSTRAINT [PK_Scholars] PRIMARY KEY CLUSTERED ([Id] ASC)
);
GO
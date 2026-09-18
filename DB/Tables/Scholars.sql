-- Scholars.sql

-- Create the Scholars table
-- The SQL Database Project build process will handle schema creation (dbo)
-- and conditional table creation during deployment.
CREATE TABLE [dbo].[Scholars]
(
    [Id] UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(), -- Primary key, automatically generated GUID
    [FirstName] NVARCHAR(100) NOT NULL,
    [LastName] NVARCHAR(100) NOT NULL,
    [DateOfBirth] DATETIME2 NOT NULL,
    [Grade] INT NULL,
    [SchoolId] INT NULL,

    -- Define the Primary Key constraint
    CONSTRAINT [PK_Scholars] PRIMARY KEY CLUSTERED ([Id] ASC)
);
GO
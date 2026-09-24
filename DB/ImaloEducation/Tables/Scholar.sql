CREATE TABLE [dbo].[Scholar]
(
    [ScholarId] UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT [DF_Scholar_ScholarId] DEFAULT NEWSEQUENTIALID(),
    [FirstName] NVARCHAR (100) NOT NULL,
    [LastName] NVARCHAR (100) NOT NULL,
    [BirthDate] DATE NOT NULL,
    [Grade] TINYINT NULL,
    [SchoolId] INT NULL,
    CONSTRAINT [PK_Scholar] PRIMARY KEY CLUSTERED ([ScholarId]),
    CONSTRAINT [CK_Scholar_Grade] CHECK ([Grade] BETWEEN 0 AND 12),
    CONSTRAINT [CK_Scholar_SchoolId] CHECK ([SchoolId] > 0)
);

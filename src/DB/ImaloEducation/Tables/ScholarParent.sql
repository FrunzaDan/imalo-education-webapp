CREATE TABLE [dbo].[ScholarParent]
(
    [ScholarId] UNIQUEIDENTIFIER NOT NULL,
    [Role] VARCHAR (20) NOT NULL,
    [FirstName] NVARCHAR (100) NULL,
    [LastName] NVARCHAR (100) NULL,
    [PhoneNumber] VARCHAR (15) NULL,
    CONSTRAINT [PK_ScholarParent] PRIMARY KEY CLUSTERED ([ScholarId], [Role]),
    CONSTRAINT [CK_ScholarParent_Role] CHECK ([Role] IN ('Mother', 'Father')),
    CONSTRAINT [CK_ScholarParent_NotEmpty] CHECK (
        [FirstName] IS NOT NULL OR [LastName] IS NOT NULL OR [PhoneNumber] IS NOT NULL
    ),
    CONSTRAINT [FK_ScholarParent_Scholar]
        FOREIGN KEY ([ScholarId]) REFERENCES [dbo].[Scholar] ([ScholarId])
        ON DELETE CASCADE
);

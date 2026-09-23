-- Create database if it doesn't exist
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'ImaloEducation')
BEGIN
    CREATE DATABASE [ImaloEducation]
    PRINT 'Database ImaloEducation created successfully'
END
ELSE
BEGIN
    PRINT 'Database ImaloEducation already exists'
END
GO

USE [ImaloEducation]
GO
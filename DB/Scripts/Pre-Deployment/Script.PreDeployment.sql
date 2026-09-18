-- Create database if it doesn't exist
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'ImaloEducationDB')
BEGIN
    CREATE DATABASE [ImaloEducationDB]
    PRINT 'Database ImaloEducationDB created successfully'
END
ELSE
BEGIN
    PRINT 'Database ImaloEducationDB already exists'
END
GO

USE [ImaloEducationDB]
GO
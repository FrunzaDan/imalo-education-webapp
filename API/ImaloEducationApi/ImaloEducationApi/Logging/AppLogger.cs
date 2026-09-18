using System.Runtime.InteropServices;
using Microsoft.Data.SqlClient;

namespace ImaloEducationApi.Logging;

public class AppLogger(ILoggerFactory loggerFactory, IHostEnvironment env, IConfiguration config)
{
    private readonly ILogger _logger = loggerFactory.CreateLogger("AppDiagnostics");

    // -----------------------
    // General-purpose methods
    // -----------------------
    public void LogInfo(string message, params object[] args)
    {
        _logger.LogInformation(message, args);
    }

    public void LogWarning(string message, params object[] args)
    {
        _logger.LogWarning(message, args);
    }

    public void LogError(Exception ex, string message, params object[] args)
    {
        _logger.LogError(ex, message, args);
    }

    public void LogError(string message, params object[] args)
    {
        _logger.LogError(message, args);
    }

    // -----------------------
    // Startup / Ramp-up logging
    // -----------------------
    public void LogRampUp()
    {
        _logger.LogInformation("--------------------------------------------------");
        _logger.LogInformation("📦 Application Starting Up...");
        _logger.LogInformation("Environment: {Environment}", env.EnvironmentName);
        _logger.LogInformation("Machine: {MachineName}", Environment.MachineName);
        _logger.LogInformation("OS: {OSDescription} ({Architecture})",
            RuntimeInformation.OSDescription, RuntimeInformation.OSArchitecture);
        _logger.LogInformation(".NET Runtime: {FrameworkDescription}",
            RuntimeInformation.FrameworkDescription);
        _logger.LogInformation("Process Architecture: {ProcessArch}", RuntimeInformation.ProcessArchitecture);
        _logger.LogInformation("Content Root: {ContentRoot}", env.ContentRootPath);
        _logger.LogInformation("Timestamp (UTC): {Timestamp}", DateTime.UtcNow);
        _logger.LogInformation("--------------------------------------------------");

        LogConnectionStrings();
        CheckDatabaseConnection();
        LogMemoryUsage();
    }

    private void LogConnectionStrings()
    {
        _logger.LogInformation("🔗 Checking configured connection strings...");
        foreach (var conn in config.GetSection("ConnectionStrings").GetChildren())
            _logger.LogInformation("ConnectionString[{Key}] = {Value}", conn.Key,
                MaskPassword(conn.Value ?? string.Empty));
    }

    private void CheckDatabaseConnection()
    {
        var connStr = config.GetConnectionString("DefaultConnection");

        if (string.IsNullOrWhiteSpace(connStr))
        {
            _logger.LogWarning("⚠️ No connection string named 'DefaultConnection' found in configuration.");
            return;
        }

        try
        {
            using var conn = new SqlConnection(connStr);
            conn.Open();

            using var cmd = new SqlCommand("SELECT SUSER_SNAME()", conn);
            var user = cmd.ExecuteScalar()?.ToString();

            _logger.LogInformation("✅ Database connection successful!");
            _logger.LogInformation("   - Database: {Database}", conn.Database);
            _logger.LogInformation("   - Server: {Server}", conn.DataSource);
            _logger.LogInformation("   - Authenticated User: {User}", user);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "❌ Failed to connect to database using 'DefaultConnection'.");
        }
    }

    private void LogMemoryUsage()
    {
        var memory = GC.GetTotalMemory(false);
        _logger.LogInformation("🧠 Current managed memory usage: {MemoryMB} MB", memory / 1024 / 1024);
    }

    private static string MaskPassword(string connStr)
    {
        if (string.IsNullOrWhiteSpace(connStr)) return connStr;

        try
        {
            var builder = new SqlConnectionStringBuilder(connStr);
            if (!string.IsNullOrEmpty(builder.Password)) builder.Password = "******"; // hide actual password
            return builder.ConnectionString;
        }
        catch
        {
            return connStr; // fallback if parsing fails
        }
    }
}
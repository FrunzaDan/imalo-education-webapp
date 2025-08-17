using System.Runtime.InteropServices;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace ImaloEducationApi.Logging
{
    public class AppLogger
    {
        private readonly ILogger _logger;
        private readonly IHostEnvironment _env;
        private readonly IConfiguration _config;

        public AppLogger(ILoggerFactory loggerFactory, IHostEnvironment env, IConfiguration config)
        {
            _logger = loggerFactory.CreateLogger("AppDiagnostics");
            _env = env;
            _config = config;
        }

        // -----------------------
        // General-purpose methods
        // -----------------------
        public void LogInfo(string message, params object[] args) =>
            _logger.LogInformation(message, args);

        public void LogWarning(string message, params object[] args) =>
            _logger.LogWarning(message, args);

        public void LogError(Exception ex, string message, params object[] args) =>
            _logger.LogError(ex, message, args);

        public void LogError(string message, params object[] args) =>
            _logger.LogError(message, args);

        // -----------------------
        // Startup / Ramp-up logging
        // -----------------------
        public void LogRampUp()
        {
            _logger.LogInformation("--------------------------------------------------");
            _logger.LogInformation("📦 Application Starting Up...");
            _logger.LogInformation("Environment: {Environment}", _env.EnvironmentName);
            _logger.LogInformation("Machine: {MachineName}", Environment.MachineName);
            _logger.LogInformation("OS: {OSDescription} ({Architecture})",
                RuntimeInformation.OSDescription, RuntimeInformation.OSArchitecture);
            _logger.LogInformation(".NET Runtime: {FrameworkDescription}",
                RuntimeInformation.FrameworkDescription);
            _logger.LogInformation("Process Architecture: {ProcessArch}", RuntimeInformation.ProcessArchitecture);
            _logger.LogInformation("Content Root: {ContentRoot}", _env.ContentRootPath);
            _logger.LogInformation("Timestamp (UTC): {Timestamp}", DateTime.UtcNow);
            _logger.LogInformation("--------------------------------------------------");

            LogConnectionStrings();
            CheckDatabaseConnection();
            LogMemoryUsage();
        }

        private void LogConnectionStrings()
        {
            _logger.LogInformation("🔗 Checking configured connection strings...");
            foreach (var conn in _config.GetSection("ConnectionStrings").GetChildren())
            {
                _logger.LogInformation("ConnectionString[{Key}] = {Value}", conn.Key, MaskPassword(conn.Value ?? string.Empty));
            }
        }

        private void CheckDatabaseConnection()
        {
            string? connStr = _config.GetConnectionString("DefaultConnection");

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
                string? user = cmd.ExecuteScalar()?.ToString();

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
            long memory = GC.GetTotalMemory(forceFullCollection: false);
            _logger.LogInformation("🧠 Current managed memory usage: {MemoryMB} MB", memory / 1024 / 1024);
        }

        private string MaskPassword(string connStr)
        {
            if (string.IsNullOrWhiteSpace(connStr)) return connStr;

            try
            {
                var builder = new SqlConnectionStringBuilder(connStr);
                if (!string.IsNullOrEmpty(builder.Password))
                {
                    builder.Password = "******"; // hide actual password
                }
                return builder.ConnectionString;
            }
            catch
            {
                return connStr; // fallback if parsing fails
            }
        }
    }
}

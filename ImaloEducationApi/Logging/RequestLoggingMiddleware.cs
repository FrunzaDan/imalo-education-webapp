using System.Diagnostics;

namespace ImaloEducationApi.Logging;

public class RequestLoggingMiddleware
{
    private readonly ILogger<RequestLoggingMiddleware> _logger;
    private readonly RequestDelegate _next;

    public RequestLoggingMiddleware(RequestDelegate next, ILogger<RequestLoggingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var stopwatch = Stopwatch.StartNew();

        var method = context.Request.Method;
        var path = context.Request.Path;

        // Determine the user
        var user = context.User.Identity?.IsAuthenticated == true
            ? context.User.Identity.Name
            : "Anonymous";

        // Get client IP
        var ip = context.Connection.RemoteIpAddress?.ToString() ?? "Unknown IP";

        // Get origin header (useful for frontend like Angular)
        var origin = context.Request.Headers.Origin.FirstOrDefault() ?? "Unknown Origin";

        _logger.LogInformation("➡ Incoming request: {Method} {Path} from {User} (IP: {IP}, Origin: {Origin})",
            method, path, user, ip, origin);

        await _next(context); // Call the next middleware

        stopwatch.Stop();

        var statusCode = context.Response.StatusCode;

        _logger.LogInformation(
            "⬅ Response: {Method} {Path} from {User} (IP: {IP}, Origin: {Origin}) completed with {StatusCode} in {ElapsedMilliseconds} ms",
            method, path, user, ip, origin, statusCode, stopwatch.ElapsedMilliseconds);
    }
}
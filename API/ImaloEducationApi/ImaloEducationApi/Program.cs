using ImaloEducationApi.Data;
using ImaloEducationApi.Logging;
using ImaloEducationApi.Routing;
using Microsoft.AspNetCore.Mvc.ApplicationModels;

var builder = WebApplication.CreateBuilder(args);

// Routes are declared as "api/[controller]"; the transformer turns the PascalCase class name
// into the lowercase, kebab-case URL segment (ScholarsController -> /api/scholars).
builder.Services.AddControllers(options =>
    options.Conventions.Add(new RouteTokenTransformerConvention(new KebabCaseParameterTransformer())));

// Swagger for development & documentation
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Custom Services
builder.Services.AddScoped<IScholarDataAccess, ScholarDataAccess>();
builder.Services.AddSingleton<AppLogger>();

// Health checks (liveness only — no DB probe)
builder.Services.AddHealthChecks();

// CORS Configuration
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowSpecificOrigin", policy =>
    {
        policy
            .AllowAnyOrigin() // TODO: Restrict to specific origins in production
            .AllowAnyMethod()
            .AllowAnyHeader();
    });
});

// Logging Configuration (optional fine-tuning)
builder.Logging.ClearProviders();
builder.Logging.AddConsole();

var app = builder.Build();

// Run ramp-up logging once on startup
using (var scope = app.Services.CreateScope())
{
    var logger = scope.ServiceProvider.GetRequiredService<AppLogger>();
    logger.LogRampUp();
}

// --------------------------------------------------
// Configure Middleware
// --------------------------------------------------

// Enable Swagger in development only
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(options =>
    {
        options.SwaggerEndpoint("/swagger/v1/swagger.json", "ImaloEducation API v1");
        options.RoutePrefix = "swagger";
    });
}

// Optional: Swagger in production with auth
// app.UseSwagger();
// app.UseSwaggerUI();
// Enforce HTTPS redirection
app.UseHttpsRedirection();

// Use routing
app.UseRouting();

// Enable CORS (should come *before* authorization)
app.UseCors("AllowSpecificOrigin");

app.UseMiddleware<RequestLoggingMiddleware>();

// Authentication/Authorization middleware (if needed)
app.UseAuthorization();

// Every response here is live, frequently-mutated data (scholars/attendance),
// never a fixed resource — without this, browsers apply heuristic caching to
// a bare 200 OK with no Cache-Control/ETag/Last-Modified, which is exactly
// what was making the Angular app (using HttpClient's withFetch() backend)
// show stale data after a create/update/delete until a hard refresh.
app.Use(async (context, next) =>
{
    context.Response.Headers.CacheControl = "no-store";
    await next();
});

app.MapHealthChecks("/health");

// Map attribute-based controllers
app.MapControllers();

app.Run();
using ImaloEducationApi.Data;
using ImaloEducationApi.ErrorHandling;
using ImaloEducationApi.Routing;
using Microsoft.AspNetCore.Mvc.ApplicationModels;

var builder = WebApplication.CreateBuilder(args);

// Routes are declared as "api/[controller]"; the transformer turns the PascalCase class name
// into the lowercase, kebab-case URL segment (ScholarsController -> /api/scholars).
builder.Services.AddControllers(options =>
    options.Conventions.Add(new RouteTokenTransformerConvention(new KebabCaseParameterTransformer())));

// OpenAPI document from ASP.NET Core's built-in generator (/openapi/v1.json), shown by Swagger UI.
builder.Services.AddOpenApi();

// Custom Services
builder.Services.AddScoped<IScholarDataAccess, ScholarDataAccess>();

// Health checks (liveness only — no DB probe)
builder.Services.AddHealthChecks();

// Every error response is RFC 9457 Problem Details (application/problem+json): validation
// failures from [ApiController], Problem()/NotFound results, bare status codes (UseStatusCodePages)
// and unhandled exceptions (GlobalExceptionHandler, which logs them once and answers 500).
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();

// Only the Angular app's own origins may call the API from a browser.
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy => policy
        .WithOrigins(allowedOrigins)
        .WithMethods("GET", "POST", "PUT", "DELETE")
        .WithHeaders("Content-Type"));
});

var app = builder.Build();

// --------------------------------------------------
// Configure Middleware
// --------------------------------------------------

// First, so it catches exceptions from everything after it.
app.UseExceptionHandler();
// Gives an empty 4xx/5xx (unknown route, wrong method, unsupported media type) a Problem Details body.
app.UseStatusCodePages();

// Enable Swagger in development only
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.UseSwaggerUI(options => options.SwaggerEndpoint("/openapi/v1.json", "v1"));
}

app.UseCors();

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
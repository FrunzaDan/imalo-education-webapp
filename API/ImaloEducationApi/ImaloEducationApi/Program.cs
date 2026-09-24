using ImaloEducationApi.Configuration;
using ImaloEducationApi.Data;
using ImaloEducationApi.ErrorHandling;
using ImaloEducationApi.Routing;
using Microsoft.AspNetCore.HttpLogging;
using Microsoft.AspNetCore.Mvc.ApplicationModels;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOptions<DatabaseOptions>()
    .BindConfiguration(DatabaseOptions.SectionName)
    .ValidateDataAnnotations()
    .ValidateOnStart();

builder.Services.AddControllers(options =>
    options.Conventions.Add(new RouteTokenTransformerConvention(new KebabCaseParameterTransformer())));

builder.Services.AddOpenApi();

builder.Services.AddSingleton<ISqlConnectionFactory, SqlConnectionFactory>();
builder.Services.AddScoped<IScholarDataAccess, ScholarDataAccess>();

builder.Services.AddHealthChecks();

builder.Services.AddHttpLogging(options =>
{
    options.LoggingFields = HttpLoggingFields.RequestMethod | HttpLoggingFields.RequestPath |
                            HttpLoggingFields.ResponseStatusCode | HttpLoggingFields.Duration;
    options.CombineLogs = true;
});

builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();

var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy => policy
        .WithOrigins(allowedOrigins)
        .WithMethods("GET", "POST", "PUT", "DELETE")
        .WithHeaders("Content-Type"));
});

var app = builder.Build();

app.UseHttpLogging();
app.UseExceptionHandler();
app.UseStatusCodePages();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.UseSwaggerUI(options => options.SwaggerEndpoint("/openapi/v1.json", "v1"));
}

app.UseCors();

app.Use(async (context, next) =>
{
    context.Response.Headers.CacheControl = "no-store";
    await next();
});

app.MapHealthChecks("/health")
    .WithHttpLogging(HttpLoggingFields.None);

app.MapControllers();

app.Run();
using ImaloEducationApi.Data;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();

// Swagger for development & documentation
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Custom Services
builder.Services.AddScoped<ScholarDataAccess>();

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
        options.RoutePrefix = string.Empty; // Serve at root: https://localhost:5001/
    });
}
else
{
    // Optional: Swagger in production with auth
    // app.UseSwagger();
    // app.UseSwaggerUI();
}

// Enforce HTTPS redirection
app.UseHttpsRedirection();

// Use routing
app.UseRouting();

// Enable CORS (should come *before* authorization)
app.UseCors("AllowSpecificOrigin");

// Authentication/Authorization middleware (if needed)
app.UseAuthorization();

// Map attribute-based controllers
app.MapControllers();

app.Run();

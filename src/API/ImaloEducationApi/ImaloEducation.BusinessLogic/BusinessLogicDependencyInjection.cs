using ImaloEducation.BusinessLogic.Features.Attendance;
using ImaloEducation.BusinessLogic.Features.AuditLog;
using ImaloEducation.BusinessLogic.Features.Scholars;
using Microsoft.Extensions.DependencyInjection;

namespace ImaloEducation.BusinessLogic;

public static class BusinessLogicDependencyInjection
{
    public static void AddBusinessLogic(this IServiceCollection services)
    {
        services.AddScoped<CreateScholarHandler>();
        services.AddScoped<GetScholarsHandler>();
        services.AddScoped<GetScholarHandler>();
        services.AddScoped<UpdateScholarHandler>();
        services.AddScoped<DeleteScholarHandler>();

        services.AddScoped<SaveAttendanceHandler>();
        services.AddScoped<GetAttendanceHandler>();
        services.AddScoped<GetAllAttendanceHandler>();
        services.AddScoped<DeleteAttendanceHandler>();

        services.AddScoped<IScholarAuditLogger, ScholarAuditLogger>();
        services.AddScoped<GetScholarAuditLogHandler>();
        services.AddScoped<GetAllScholarAuditLogHandler>();
        services.AddScoped<DeleteAllScholarAuditLogHandler>();
    }
}

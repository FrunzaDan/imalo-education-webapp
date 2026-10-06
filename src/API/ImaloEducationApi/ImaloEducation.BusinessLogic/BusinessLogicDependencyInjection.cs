using ImaloEducation.BusinessLogic.Services;
using ImaloEducation.BusinessLogic.Services.Implementation;
using Microsoft.Extensions.DependencyInjection;

namespace ImaloEducation.BusinessLogic;

public static class BusinessLogicDependencyInjection
{
    public static void AddBusinessLogic(this IServiceCollection services)
    {
        services.AddScoped<IScholarService, ScholarService>();
    }
}

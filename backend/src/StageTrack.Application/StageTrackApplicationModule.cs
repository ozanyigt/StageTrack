using Microsoft.Extensions.DependencyInjection;
using StageTrack.Account;
using StageTrack.Authorization;
using StageTrack.Customers;
using StageTrack.Dashboard;
using StageTrack.Identity;
using StageTrack.Inventory;
using StageTrack.Projects;
using StageTrack.Quotes;
using StageTrack.Warehouse;

namespace StageTrack;

public static class StageTrackApplicationModule
{
    public static IServiceCollection AddStageTrackApplication(this IServiceCollection services)
    {
        services.AddStageTrackDomain();

        services.AddScoped<IPermissionChecker, PermissionChecker>();
        services.AddScoped<IAccountAppService, AccountAppService>();
        services.AddScoped<IRoleAppService, RoleAppService>();
        services.AddScoped<IUserAppService, UserAppService>();
        services.AddScoped<IDashboardAppService, DashboardAppService>();
        services.AddScoped<IEquipmentFolderAppService, EquipmentFolderAppService>();
        services.AddScoped<IEquipmentAppService, EquipmentAppService>();
        services.AddScoped<IEquipmentUnitAppService, EquipmentUnitAppService>();
        services.AddScoped<ILabelAppService, LabelAppService>();
        services.AddScoped<IStockLocationAppService, StockLocationAppService>();
        services.AddScoped<ICustomerAppService, CustomerAppService>();
        services.AddScoped<IProjectAppService, ProjectAppService>();
        services.AddScoped<IWarehouseAppService, WarehouseAppService>();
        services.AddScoped<IRentalFactorProfileAppService, RentalFactorProfileAppService>();
        services.AddScoped<IQuoteAppService, QuoteAppService>();
        return services;
    }
}

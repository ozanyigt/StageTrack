using Microsoft.Extensions.DependencyInjection;
using StageTrack.Account;
using StageTrack.Authorization;
using StageTrack.Collaboration;
using StageTrack.Common;
using StageTrack.Customers;
using StageTrack.Dashboard;
using StageTrack.Identity;
using StageTrack.Inventory;
using StageTrack.Maintenance;
using StageTrack.Projects;
using StageTrack.Quotes;
using StageTrack.Suppliers;
using StageTrack.Warehouse;

namespace StageTrack;

public static class StageTrackApplicationModule
{
    public static IServiceCollection AddStageTrackApplication(this IServiceCollection services)
    {
        services.AddStageTrackDomain();

        services.AddScoped<IPermissionChecker, PermissionChecker>();
        services.AddScoped<PriceVisibility>();
        services.AddScoped<ImportRunner>();
        services.AddScoped<ProjectAccess>();
        services.AddScoped<CurrentTenant>();
        services.AddScoped<IFirmAppService, FirmAppService>();
        services.AddScoped<Auditing.IAuditLogAppService, Auditing.AuditLogAppService>();
        services.AddScoped<TenantAccessChecker>();
        services.AddScoped<Host.ITenantAppService, Host.TenantAppService>();
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
        services.AddScoped<ILabelTemplateAppService, LabelTemplateAppService>();
        services.AddScoped<ICrewAppService, CrewAppService>();
        services.AddScoped<ISupplierAppService, SupplierAppService>();
        services.AddScoped<IRepairAppService, RepairAppService>();
        services.AddScoped<IInspectionAppService, InspectionAppService>();
        services.AddScoped<ICollaborationAppService, CollaborationAppService>();
        return services;
    }
}

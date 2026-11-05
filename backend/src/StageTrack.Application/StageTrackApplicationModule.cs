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

        services.AddScoped<IModuleAccess, ModuleAccess>();
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

        // Design module (Panelyze was its ancestor): the calculation constants are fixed configuration, the rest is per request.
        services.AddSingleton(Design.Calculation.CalcSettings.Default);
        services.AddScoped<Design.LedCatalogLoader>();
        services.AddScoped<Design.ILedCalculationAppService, Design.LedCalculationAppService>();
        services.AddScoped<Design.ILedInventoryAppService, Design.LedInventoryAppService>();
        services.AddScoped<Design.ITransportAppService, Design.TransportAppService>();
        services.AddScoped<Design.IStageAppService, Design.StageAppService>();
        services.AddScoped<Design.ILedStockStatusAppService, Design.LedStockStatusAppService>();
        services.AddScoped<Design.IDraftToJobAppService, Design.DraftToJobAppService>();

        // The job's venue: the room the design stands in, and the venue's own drawing on its floor.
        services.AddScoped<Venues.IProjectVenueAppService, Venues.ProjectVenueAppService>();
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

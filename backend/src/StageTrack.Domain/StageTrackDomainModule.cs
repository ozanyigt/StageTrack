using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using StageTrack.Collaboration;
using StageTrack.Customers;
using StageTrack.Maintenance;
using StageTrack.Suppliers;
using StageTrack.Data;
using StageTrack.Identity;
using StageTrack.Inventory;
using StageTrack.Pricing;
using StageTrack.Projects;
using StageTrack.Quotes;
using StageTrack.Warehouse;

namespace StageTrack;

public static class StageTrackDomainModule
{
    public static IServiceCollection AddStageTrackDomain(this IServiceCollection services)
    {
        services.AddScoped<IPasswordHasher<AppUser>, PasswordHasher<AppUser>>();

        services.AddScoped<UserManager>();
        services.AddScoped<RoleManager>();
        services.AddScoped<EquipmentManager>();
        services.AddScoped<EquipmentFolderManager>();
        services.AddScoped<EquipmentUnitManager>();
        services.AddScoped<LabelManager>();
        services.AddScoped<StockLocationManager>();
        services.AddScoped<CustomerManager>();
        services.AddScoped<ProjectManager>();
        services.AddScoped<AvailabilityManager>();
        services.AddScoped<WarehouseManager>();
        services.AddScoped<RentalFactorManager>();
        services.AddScoped<QuoteManager>();
        services.AddScoped<SupplierManager>();
        services.AddScoped<RepairManager>();
        services.AddScoped<InspectionManager>();
        services.AddScoped<LabelTemplateManager>();
        services.AddScoped<AttachmentManager>();
        services.AddScoped<TransferManager>();
        services.AddScoped<Tenants.TenantManager>();
        services.AddScoped<Tenants.TenantProvisioningManager>();
        services.AddScoped<Data.HostDataSeeder>();

        services.AddScoped<DemoDataSeeder>();
        return services;
    }
}

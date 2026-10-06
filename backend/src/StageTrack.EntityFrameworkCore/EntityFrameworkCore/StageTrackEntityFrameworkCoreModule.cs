using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.DependencyInjection;
using StageTrack.Collaboration;
using StageTrack.Companies;
using StageTrack.Customers;
using StageTrack.Identity;
using StageTrack.Inventory;
using StageTrack.Maintenance;
using StageTrack.Pricing;
using StageTrack.Projects;
using StageTrack.Quotes;
using StageTrack.Repositories;
using StageTrack.Session;
using StageTrack.Suppliers;
using StageTrack.Warehouse;

namespace StageTrack.EntityFrameworkCore;

public static class StageTrackEntityFrameworkCoreModule
{
    public static IServiceCollection AddStageTrackEntityFrameworkCore(this IServiceCollection services, string connectionString)
    {
        services.AddDbContext<StageTrackDbContext>(options => options.UseSqlServer(connectionString));

        services.AddScoped<IUnitOfWork, EfUnitOfWork>();
        services.AddScoped<ICompanyRepository, CompanyRepository>();
        services.AddScoped<Tenants.ITenantRepository, TenantRepository>();
        services.AddScoped<Auditing.IAuditLogRepository, AuditLogRepository>();
        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IRoleRepository, RoleRepository>();
        services.AddScoped<IStockLocationRepository, StockLocationRepository>();
        services.AddScoped<IEquipmentFolderRepository, EquipmentFolderRepository>();
        services.AddScoped<IEquipmentRepository, EquipmentRepository>();
        services.AddScoped<IEquipmentUnitRepository, EquipmentUnitRepository>();
        services.AddScoped<IEquipmentLabelRepository, EquipmentLabelRepository>();
        services.AddScoped<ICustomerRepository, CustomerRepository>();
        services.AddScoped<IProjectRepository, ProjectRepository>();
        services.AddScoped<IWarehouseMovementRepository, WarehouseMovementRepository>();
        services.AddScoped<IRentalFactorProfileRepository, RentalFactorProfileRepository>();
        services.AddScoped<IQuoteRepository, QuoteRepository>();
        services.AddScoped<ISupplierRepository, SupplierRepository>();
        services.AddScoped<IRepairRepository, RepairRepository>();
        services.AddScoped<IUnitInspectionRepository, UnitInspectionRepository>();
        services.AddScoped<ILabelTemplateRepository, LabelTemplateRepository>();
        services.AddScoped<IAttachmentRepository, AttachmentRepository>();
        services.AddScoped<INoteRepository, NoteRepository>();
        services.AddScoped<ITaskItemRepository, TaskItemRepository>();
        return services;
    }
}

/// <summary>Used only by "dotnet ef" to build migrations without starting the web host.</summary>
public class StageTrackDbContextFactory : IDesignTimeDbContextFactory<StageTrackDbContext>
{
    public StageTrackDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<StageTrackDbContext>()
            .UseSqlServer("Server=(localdb)\\MSSQLLocalDB;Database=StageTrack;Trusted_Connection=True;TrustServerCertificate=True")
            .Options;

        return new StageTrackDbContext(options, new DesignTimeCompany(), new DesignTimeUser());
    }

    private sealed class DesignTimeCompany : ICurrentCompany
    {
        public Guid? Id => null;
        public IDisposable Change(Guid? companyId) => CompanyScope.Begin(companyId);
    }

    private sealed class DesignTimeUser : ICurrentUser
    {
        public bool IsAuthenticated => false;
        public Guid? Id => null;
        public string? UserName => null;
        public Guid? ImpersonatorId => null;
    }
}

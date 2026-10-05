using System.Linq.Expressions;
using System.Reflection;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Query;
using StageTrack.Collaboration;
using StageTrack.Companies;
using StageTrack.Customers;
using StageTrack.Entities;
using StageTrack.Identity;
using StageTrack.Inventory;
using StageTrack.Maintenance;
using StageTrack.Pricing;
using StageTrack.Projects;
using StageTrack.Quotes;
using StageTrack.Session;
using StageTrack.Suppliers;
using StageTrack.Warehouse;

namespace StageTrack.EntityFrameworkCore;

public class StageTrackDbContext(
    DbContextOptions<StageTrackDbContext> options,
    ICurrentCompany currentCompany,
    ICurrentUser currentUser) : DbContext(options)
{
    public DbSet<Company> Companies => Set<Company>();
    public DbSet<AppUser> Users => Set<AppUser>();
    public DbSet<AppRole> Roles => Set<AppRole>();
    public DbSet<StockLocation> StockLocations => Set<StockLocation>();
    public DbSet<EquipmentFolder> EquipmentFolders => Set<EquipmentFolder>();
    public DbSet<Equipment> Equipment => Set<Equipment>();
    public DbSet<EquipmentUnit> EquipmentUnits => Set<EquipmentUnit>();
    public DbSet<EquipmentLabel> EquipmentLabels => Set<EquipmentLabel>();
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<Project> Projects => Set<Project>();
    public DbSet<ProjectEquipment> ProjectEquipment => Set<ProjectEquipment>();
    public DbSet<WarehouseMovement> WarehouseMovements => Set<WarehouseMovement>();
    public DbSet<RentalFactorProfile> RentalFactorProfiles => Set<RentalFactorProfile>();
    public DbSet<Quote> Quotes => Set<Quote>();
    public DbSet<Supplier> Suppliers => Set<Supplier>();
    public DbSet<Repair> Repairs => Set<Repair>();
    public DbSet<UnitInspection> UnitInspections => Set<UnitInspection>();
    public DbSet<LabelTemplate> LabelTemplates => Set<LabelTemplate>();
    public DbSet<Attachment> Attachments => Set<Attachment>();
    public DbSet<Note> Notes => Set<Note>();
    public DbSet<TaskItem> Tasks => Set<TaskItem>();

    /// <summary>Read by the global query filter on every query, so switching company needs no new context.</summary>
    protected Guid? CurrentCompanyId => currentCompany.Id;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(StageTrackDbContext).Assembly);

        var configureFilters = typeof(StageTrackDbContext).GetMethod(nameof(ConfigureGlobalFilters), BindingFlags.Instance | BindingFlags.NonPublic)!;
        foreach (var entityType in modelBuilder.Model.GetEntityTypes().Where(t => t.BaseType is null))
        {
            configureFilters.MakeGenericMethod(entityType.ClrType).Invoke(this, [modelBuilder]);

            // Ids are created in the domain (Guid v7). Without this, a new child added to a loaded
            // aggregate (e.g. a quote line) would be treated as an existing row and updated instead of inserted.
            if (typeof(Entity).IsAssignableFrom(entityType.ClrType))
            {
                modelBuilder.Entity(entityType.ClrType).Property(nameof(Entity.Id)).ValueGeneratedNever();
            }
        }
    }

    protected void ConfigureGlobalFilters<TEntity>(ModelBuilder modelBuilder) where TEntity : class
    {
        Expression<Func<TEntity, bool>>? filter = null;

        if (typeof(ISoftDelete).IsAssignableFrom(typeof(TEntity)))
        {
            filter = e => !EF.Property<bool>(e, nameof(ISoftDelete.IsDeleted));
        }

        if (typeof(IMultiCompany).IsAssignableFrom(typeof(TEntity)))
        {
            Expression<Func<TEntity, bool>> companyFilter = e => EF.Property<Guid>(e, nameof(IMultiCompany.CompanyId)) == CurrentCompanyId;
            filter = filter is null ? companyFilter : Combine(filter, companyFilter);
        }

        if (filter is not null)
        {
            modelBuilder.Entity<TEntity>().HasQueryFilter(filter);
        }
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        ApplyConventions();
        return base.SaveChangesAsync(cancellationToken);
    }

    public override int SaveChanges()
    {
        ApplyConventions();
        return base.SaveChanges();
    }

    /// <summary>Fills audit fields and the company id, and turns deletes of soft-delete entities into updates.</summary>
    private void ApplyConventions()
    {
        var now = DateTime.UtcNow;
        var userId = currentUser.Id;

        foreach (var entry in ChangeTracker.Entries())
        {
            switch (entry.State)
            {
                case EntityState.Added:
                    if (entry.Entity is IMultiCompany multiCompany && multiCompany.CompanyId == Guid.Empty && currentCompany.Id.HasValue)
                    {
                        multiCompany.CompanyId = currentCompany.Id.Value;
                    }

                    if (entry.Entity is IHasCreationTime created && created.CreationTime == default)
                    {
                        created.CreationTime = now;
                    }

                    if (entry.Entity is IAuditedObject audited)
                    {
                        audited.CreatorId ??= userId;
                    }

                    break;

                case EntityState.Modified:
                    if (entry.Entity is IAuditedObject modified)
                    {
                        modified.LastModificationTime = now;
                        modified.LastModifierId = userId;
                    }

                    break;

                case EntityState.Deleted when entry.Entity is ISoftDelete softDelete:
                    entry.State = EntityState.Modified;
                    softDelete.IsDeleted = true;
                    softDelete.DeletionTime = now;
                    break;
            }
        }
    }

    private static Expression<Func<T, bool>> Combine<T>(Expression<Func<T, bool>> left, Expression<Func<T, bool>> right)
    {
        var parameter = left.Parameters[0];
        var rightBody = ReplacingExpressionVisitor.Replace(right.Parameters[0], parameter, right.Body);
        return Expression.Lambda<Func<T, bool>>(Expression.AndAlso(left.Body, rightBody), parameter);
    }
}

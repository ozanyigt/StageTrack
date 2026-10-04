using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StageTrack.Companies;
using StageTrack.Customers;
using StageTrack.Identity;
using StageTrack.Inventory;
using StageTrack.Pricing;
using StageTrack.Projects;
using StageTrack.Quotes;
using StageTrack.Warehouse;

namespace StageTrack.EntityFrameworkCore;

internal static class ColumnTypes
{
    public const string Money = "decimal(18,2)";
    public const string Factor = "decimal(9,4)";
    public const string Percent = "decimal(5,2)";
    public const string Quantity = "decimal(18,2)";
    public const string Measure = "decimal(12,3)";
}

public class CompanyConfiguration : IEntityTypeConfiguration<Company>
{
    public void Configure(EntityTypeBuilder<Company> b)
    {
        b.Property(x => x.Name).HasMaxLength(256).IsRequired();
        b.Property(x => x.Code).HasMaxLength(16).IsRequired();
        b.Property(x => x.DefaultCurrency).HasMaxLength(QuoteConsts.MaxCurrencyLength).IsRequired();
        b.Property(x => x.DefaultVatRate).HasColumnType(ColumnTypes.Percent);
        b.Property(x => x.CountryCode).HasMaxLength(2).IsRequired();
        b.HasIndex(x => x.Code).IsUnique();
        b.HasIndex(x => x.RentmanWorkspaceId);
    }
}

public class AppUserConfiguration : IEntityTypeConfiguration<AppUser>
{
    public void Configure(EntityTypeBuilder<AppUser> b)
    {
        b.ToTable("Users");
        b.Property(x => x.UserName).HasMaxLength(64).IsRequired();
        b.Property(x => x.NormalizedUserName).HasMaxLength(64).IsRequired();
        b.Property(x => x.FullName).HasMaxLength(128).IsRequired();
        b.Property(x => x.Email).HasMaxLength(256);
        b.Property(x => x.PasswordHash).HasMaxLength(512).IsRequired();
        b.Property(x => x.Language).HasMaxLength(8).IsRequired();
        b.HasIndex(x => x.NormalizedUserName).IsUnique();

        b.HasMany(x => x.Roles).WithOne().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        b.HasMany(x => x.Companies).WithOne().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class UserRoleConfiguration : IEntityTypeConfiguration<UserRole>
{
    public void Configure(EntityTypeBuilder<UserRole> b)
    {
        b.ToTable("UserRoles");
        b.HasKey(x => new { x.UserId, x.RoleId });
        b.HasOne<AppRole>().WithMany().HasForeignKey(x => x.RoleId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class UserCompanyConfiguration : IEntityTypeConfiguration<UserCompany>
{
    public void Configure(EntityTypeBuilder<UserCompany> b)
    {
        b.ToTable("UserCompanies");
        b.HasKey(x => new { x.UserId, x.CompanyId });
        b.HasOne<Company>().WithMany().HasForeignKey(x => x.CompanyId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class AppRoleConfiguration : IEntityTypeConfiguration<AppRole>
{
    public void Configure(EntityTypeBuilder<AppRole> b)
    {
        b.ToTable("Roles");
        b.Property(x => x.Name).HasMaxLength(64).IsRequired();
        b.HasIndex(x => x.Name).IsUnique();
        b.HasMany(x => x.Permissions).WithOne().HasForeignKey(x => x.RoleId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class RolePermissionConfiguration : IEntityTypeConfiguration<RolePermission>
{
    public void Configure(EntityTypeBuilder<RolePermission> b)
    {
        b.ToTable("RolePermissions");
        b.HasKey(x => new { x.RoleId, x.Name });
        b.Property(x => x.Name).HasMaxLength(128);
    }
}

public class StockLocationConfiguration : IEntityTypeConfiguration<StockLocation>
{
    public void Configure(EntityTypeBuilder<StockLocation> b)
    {
        b.Property(x => x.Name).HasMaxLength(StockLocationConsts.MaxNameLength).IsRequired();
        b.Property(x => x.Address).HasMaxLength(StockLocationConsts.MaxAddressLength);
        b.Property(x => x.City).HasMaxLength(StockLocationConsts.MaxCityLength);
        b.HasIndex(x => x.CompanyId);
    }
}

public class EquipmentFolderConfiguration : IEntityTypeConfiguration<EquipmentFolder>
{
    public void Configure(EntityTypeBuilder<EquipmentFolder> b)
    {
        b.Property(x => x.Name).HasMaxLength(EquipmentFolderConsts.MaxNameLength).IsRequired();
        b.HasIndex(x => new { x.CompanyId, x.ParentId });
    }
}

public class EquipmentConfiguration : IEntityTypeConfiguration<Equipment>
{
    public void Configure(EntityTypeBuilder<Equipment> b)
    {
        b.ToTable("Equipment");
        b.Property(x => x.Code).HasMaxLength(EquipmentConsts.MaxCodeLength).IsRequired();
        b.Property(x => x.Name).HasMaxLength(EquipmentConsts.MaxNameLength).IsRequired();
        b.Property(x => x.Brand).HasMaxLength(EquipmentConsts.MaxBrandLength);
        b.Property(x => x.Model).HasMaxLength(EquipmentConsts.MaxModelLength);
        b.Property(x => x.Notes).HasMaxLength(EquipmentConsts.MaxNotesLength);
        b.Property(x => x.RentalPrice).HasColumnType(ColumnTypes.Money);
        b.Property(x => x.WeightKg).HasColumnType(ColumnTypes.Measure);
        b.Property(x => x.VolumeM3).HasColumnType(ColumnTypes.Measure);
        b.HasIndex(x => new { x.CompanyId, x.Code }).IsUnique().HasFilter("[IsDeleted] = 0");
        b.HasIndex(x => new { x.CompanyId, x.FolderId });
        b.HasOne<EquipmentFolder>().WithMany().HasForeignKey(x => x.FolderId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class EquipmentUnitConfiguration : IEntityTypeConfiguration<EquipmentUnit>
{
    public void Configure(EntityTypeBuilder<EquipmentUnit> b)
    {
        b.Property(x => x.SerialNumber).HasMaxLength(EquipmentUnitConsts.MaxSerialNumberLength);
        b.Property(x => x.InternalRef).HasMaxLength(EquipmentUnitConsts.MaxInternalRefLength).IsRequired();
        b.Property(x => x.Notes).HasMaxLength(EquipmentUnitConsts.MaxNotesLength);
        b.HasIndex(x => new { x.CompanyId, x.InternalRef }).IsUnique().HasFilter("[IsDeleted] = 0");
        b.HasIndex(x => new { x.EquipmentId, x.Status });
        b.HasIndex(x => x.CurrentProjectId);
        b.HasOne<Equipment>().WithMany().HasForeignKey(x => x.EquipmentId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<StockLocation>().WithMany().HasForeignKey(x => x.StockLocationId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<Project>().WithMany().HasForeignKey(x => x.CurrentProjectId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class EquipmentLabelConfiguration : IEntityTypeConfiguration<EquipmentLabel>
{
    public void Configure(EntityTypeBuilder<EquipmentLabel> b)
    {
        b.Property(x => x.Code).HasMaxLength(EquipmentLabelConsts.MaxCodeLength).IsRequired();
        b.Property(x => x.RawValue).HasMaxLength(EquipmentLabelConsts.MaxCodeLength).IsRequired();
        b.HasIndex(x => new { x.CompanyId, x.Code }).IsUnique().HasFilter("[IsDeleted] = 0");
        b.HasIndex(x => x.UnitId);
        b.HasIndex(x => x.EquipmentId);
        b.HasOne<Equipment>().WithMany().HasForeignKey(x => x.EquipmentId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<EquipmentUnit>().WithMany().HasForeignKey(x => x.UnitId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class CustomerConfiguration : IEntityTypeConfiguration<Customer>
{
    public void Configure(EntityTypeBuilder<Customer> b)
    {
        b.Property(x => x.Name).HasMaxLength(256).IsRequired();
        b.Property(x => x.TaxNumber).HasMaxLength(32);
        b.Property(x => x.TaxOffice).HasMaxLength(128);
        b.Property(x => x.ContactPerson).HasMaxLength(128);
        b.Property(x => x.Email).HasMaxLength(256);
        b.Property(x => x.Phone).HasMaxLength(32);
        b.Property(x => x.Address).HasMaxLength(512);
        b.Property(x => x.City).HasMaxLength(128);
        b.Property(x => x.Country).HasMaxLength(128);
        b.Property(x => x.Notes).HasMaxLength(2000);
        b.HasIndex(x => new { x.CompanyId, x.TaxNumber });
        b.HasIndex(x => new { x.CompanyId, x.Name });
    }
}

public class ProjectConfiguration : IEntityTypeConfiguration<Project>
{
    public void Configure(EntityTypeBuilder<Project> b)
    {
        b.Property(x => x.Name).HasMaxLength(ProjectConsts.MaxNameLength).IsRequired();
        b.Property(x => x.Venue).HasMaxLength(ProjectConsts.MaxVenueLength);
        b.Property(x => x.Color).HasMaxLength(ProjectConsts.MaxColorLength).IsRequired();
        b.Property(x => x.ProjectType).HasMaxLength(ProjectConsts.MaxProjectTypeLength);
        b.Property(x => x.Notes).HasMaxLength(ProjectConsts.MaxNotesLength);
        b.HasIndex(x => new { x.CompanyId, x.Number }).IsUnique().HasFilter("[IsDeleted] = 0");
        b.HasIndex(x => new { x.CompanyId, x.PlanStart, x.PlanEnd });
        b.HasOne<Customer>().WithMany().HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<StockLocation>().WithMany().HasForeignKey(x => x.StockLocationId).OnDelete(DeleteBehavior.Restrict);
        b.HasMany(x => x.Equipment).WithOne().HasForeignKey(x => x.ProjectId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class ProjectEquipmentConfiguration : IEntityTypeConfiguration<ProjectEquipment>
{
    public void Configure(EntityTypeBuilder<ProjectEquipment> b)
    {
        b.ToTable("ProjectEquipment");
        b.Property(x => x.Notes).HasMaxLength(1000);
        b.HasIndex(x => x.EquipmentId);
        b.HasOne<Equipment>().WithMany().HasForeignKey(x => x.EquipmentId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class WarehouseMovementConfiguration : IEntityTypeConfiguration<WarehouseMovement>
{
    public void Configure(EntityTypeBuilder<WarehouseMovement> b)
    {
        b.Property(x => x.LabelCode).HasMaxLength(EquipmentLabelConsts.MaxCodeLength);
        b.HasIndex(x => new { x.CompanyId, x.CreationTime });
        b.HasIndex(x => new { x.ProjectId, x.EquipmentId });
        b.HasIndex(x => x.UnitId);
        b.HasOne<Equipment>().WithMany().HasForeignKey(x => x.EquipmentId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<EquipmentUnit>().WithMany().HasForeignKey(x => x.UnitId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<Project>().WithMany().HasForeignKey(x => x.ProjectId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<AppUser>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class RentalFactorProfileConfiguration : IEntityTypeConfiguration<RentalFactorProfile>
{
    public void Configure(EntityTypeBuilder<RentalFactorProfile> b)
    {
        b.Property(x => x.Name).HasMaxLength(RentalFactorConsts.MaxNameLength).IsRequired();
        b.Property(x => x.ExtraDayFactor).HasColumnType(ColumnTypes.Factor);
        b.HasMany(x => x.Steps).WithOne().HasForeignKey(x => x.ProfileId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class RentalFactorStepConfiguration : IEntityTypeConfiguration<RentalFactorStep>
{
    public void Configure(EntityTypeBuilder<RentalFactorStep> b)
    {
        b.ToTable("RentalFactorSteps");
        b.Property(x => x.Factor).HasColumnType(ColumnTypes.Factor);
    }
}

public class QuoteConfiguration : IEntityTypeConfiguration<Quote>
{
    public void Configure(EntityTypeBuilder<Quote> b)
    {
        b.Property(x => x.Number).HasMaxLength(QuoteConsts.MaxNumberLength).IsRequired();
        b.Property(x => x.Currency).HasMaxLength(QuoteConsts.MaxCurrencyLength).IsRequired();
        b.Property(x => x.Notes).HasMaxLength(QuoteConsts.MaxNotesLength);
        b.Property(x => x.Factor).HasColumnType(ColumnTypes.Factor);
        b.Property(x => x.DiscountPercent).HasColumnType(ColumnTypes.Percent);
        b.Property(x => x.VatRate).HasColumnType(ColumnTypes.Percent);
        b.Property(x => x.Subtotal).HasColumnType(ColumnTypes.Money);
        b.Property(x => x.DiscountAmount).HasColumnType(ColumnTypes.Money);
        b.Property(x => x.NetTotal).HasColumnType(ColumnTypes.Money);
        b.Property(x => x.VatAmount).HasColumnType(ColumnTypes.Money);
        b.Property(x => x.GrandTotal).HasColumnType(ColumnTypes.Money);
        b.HasIndex(x => new { x.CompanyId, x.Number, x.Revision }).IsUnique().HasFilter("[IsDeleted] = 0");
        b.HasIndex(x => x.ProjectId);
        b.HasOne<Project>().WithMany().HasForeignKey(x => x.ProjectId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<RentalFactorProfile>().WithMany().HasForeignKey(x => x.RentalFactorProfileId).OnDelete(DeleteBehavior.Restrict);
        b.HasMany(x => x.Lines).WithOne().HasForeignKey(x => x.QuoteId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class QuoteLineConfiguration : IEntityTypeConfiguration<QuoteLine>
{
    public void Configure(EntityTypeBuilder<QuoteLine> b)
    {
        b.ToTable("QuoteLines");
        b.Property(x => x.Description).HasMaxLength(QuoteConsts.MaxDescriptionLength).IsRequired();
        b.Property(x => x.Quantity).HasColumnType(ColumnTypes.Quantity);
        b.Property(x => x.UnitPrice).HasColumnType(ColumnTypes.Money);
        b.Property(x => x.DiscountPercent).HasColumnType(ColumnTypes.Percent);
        b.Property(x => x.Total).HasColumnType(ColumnTypes.Money);
        b.HasOne<Equipment>().WithMany().HasForeignKey(x => x.EquipmentId).OnDelete(DeleteBehavior.Restrict);
    }
}

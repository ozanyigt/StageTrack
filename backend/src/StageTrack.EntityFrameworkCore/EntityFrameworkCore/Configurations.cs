using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StageTrack.Collaboration;
using StageTrack.Companies;
using StageTrack.Customers;
using StageTrack.Identity;
using StageTrack.Inventory;
using StageTrack.Maintenance;
using StageTrack.Pricing;
using StageTrack.Projects;
using StageTrack.Quotes;
using StageTrack.Suppliers;
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
        b.HasIndex(x => new { x.TenantId, x.Code }).IsUnique();
        b.HasIndex(x => x.RentmanWorkspaceId);
        b.HasOne<Tenants.Tenant>().WithMany().HasForeignKey(x => x.TenantId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class TenantConfiguration : IEntityTypeConfiguration<Tenants.Tenant>
{
    public void Configure(EntityTypeBuilder<Tenants.Tenant> b)
    {
        b.Property(x => x.Name).HasMaxLength(Tenants.TenantConsts.MaxNameLength).IsRequired();
        b.Property(x => x.Code).HasMaxLength(Tenants.TenantConsts.MaxCodeLength).IsRequired();
        b.Property(x => x.ContactName).HasMaxLength(Tenants.TenantConsts.MaxContactLength);
        b.Property(x => x.Email).HasMaxLength(Tenants.TenantConsts.MaxEmailLength);
        b.Property(x => x.Phone).HasMaxLength(Tenants.TenantConsts.MaxPhoneLength);
        b.Property(x => x.Notes).HasMaxLength(Tenants.TenantConsts.MaxNotesLength);
        b.Property(x => x.PlanName).HasMaxLength(Tenants.TenantConsts.MaxPlanLength).IsRequired();
        b.HasIndex(x => x.Code).IsUnique();
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
        b.Property(x => x.Phone).HasMaxLength(32);
        b.Property(x => x.JobTitle).HasMaxLength(128);
        b.Property(x => x.PasswordHash).HasMaxLength(512).IsRequired();
        b.Property(x => x.Language).HasMaxLength(8).IsRequired();
        b.HasIndex(x => x.NormalizedUserName).IsUnique();
        b.HasIndex(x => x.TenantId);
        b.HasOne<Tenants.Tenant>().WithMany().HasForeignKey(x => x.TenantId).OnDelete(DeleteBehavior.Restrict);

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
        b.HasIndex(x => new { x.TenantId, x.Name }).IsUnique();
        b.HasOne<Tenants.Tenant>().WithMany().HasForeignKey(x => x.TenantId).OnDelete(DeleteBehavior.Restrict);
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
        b.Property(x => x.LengthCm).HasColumnType(ColumnTypes.Measure);
        b.Property(x => x.WidthCm).HasColumnType(ColumnTypes.Measure);
        b.Property(x => x.HeightCm).HasColumnType(ColumnTypes.Measure);
        b.Property(x => x.PowerW).HasColumnType(ColumnTypes.Measure);
        b.Property(x => x.CurrentA).HasColumnType(ColumnTypes.Measure);
        b.Property(x => x.CountryOfOrigin).HasMaxLength(EquipmentDetailConsts.MaxCountryLength);
        b.Property(x => x.InspectionDescription).HasMaxLength(EquipmentDetailConsts.MaxInspectionDescriptionLength);
        b.HasIndex(x => new { x.CompanyId, x.Code }).IsUnique().HasFilter("[IsDeleted] = 0");
        b.HasIndex(x => new { x.CompanyId, x.FolderId });
        b.HasOne<EquipmentFolder>().WithMany().HasForeignKey(x => x.FolderId).OnDelete(DeleteBehavior.Restrict);
        b.HasMany(x => x.Relations).WithOne().HasForeignKey(x => x.EquipmentId).OnDelete(DeleteBehavior.Cascade);
        b.HasMany(x => x.Suppliers).WithOne().HasForeignKey(x => x.EquipmentId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class EquipmentRelationConfiguration : IEntityTypeConfiguration<EquipmentRelation>
{
    public void Configure(EntityTypeBuilder<EquipmentRelation> b)
    {
        b.ToTable("EquipmentRelations");
        b.HasIndex(x => new { x.EquipmentId, x.Kind, x.RelatedEquipmentId }).IsUnique();
        b.HasIndex(x => x.RelatedEquipmentId);
        b.HasOne<Equipment>().WithMany().HasForeignKey(x => x.RelatedEquipmentId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class EquipmentSupplierConfiguration : IEntityTypeConfiguration<EquipmentSupplier>
{
    public void Configure(EntityTypeBuilder<EquipmentSupplier> b)
    {
        b.ToTable("EquipmentSuppliers");
        b.Property(x => x.SupplierCode).HasMaxLength(EquipmentDetailConsts.MaxSupplierCodeLength);
        b.Property(x => x.PurchasePrice).HasColumnType(ColumnTypes.Money);
        b.HasIndex(x => new { x.EquipmentId, x.SupplierId }).IsUnique();
        b.HasOne<Supplier>().WithMany().HasForeignKey(x => x.SupplierId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class SupplierConfiguration : IEntityTypeConfiguration<Supplier>
{
    public void Configure(EntityTypeBuilder<Supplier> b)
    {
        b.Property(x => x.Name).HasMaxLength(256).IsRequired();
        b.Property(x => x.ContactPerson).HasMaxLength(128);
        b.Property(x => x.Email).HasMaxLength(256);
        b.Property(x => x.Phone).HasMaxLength(32);
        b.Property(x => x.TaxNumber).HasMaxLength(32);
        b.Property(x => x.TaxOffice).HasMaxLength(128);
        b.Property(x => x.Address).HasMaxLength(512);
        b.Property(x => x.City).HasMaxLength(128);
        b.Property(x => x.Country).HasMaxLength(128);
        b.Property(x => x.Website).HasMaxLength(256);
        b.Property(x => x.Notes).HasMaxLength(2000);
        b.HasIndex(x => new { x.CompanyId, x.Name });
    }
}

public class RepairConfiguration : IEntityTypeConfiguration<Repair>
{
    public void Configure(EntityTypeBuilder<Repair> b)
    {
        b.Property(x => x.Title).HasMaxLength(MaintenanceConsts.MaxTitleLength).IsRequired();
        b.Property(x => x.Description).HasMaxLength(MaintenanceConsts.MaxDescriptionLength);
        b.Property(x => x.Cost).HasColumnType(ColumnTypes.Money);
        b.HasIndex(x => new { x.CompanyId, x.Number }).IsUnique().HasFilter("[IsDeleted] = 0");
        b.HasIndex(x => x.UnitId);
        b.HasOne<Equipment>().WithMany().HasForeignKey(x => x.EquipmentId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<EquipmentUnit>().WithMany().HasForeignKey(x => x.UnitId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<Supplier>().WithMany().HasForeignKey(x => x.SupplierId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class UnitInspectionConfiguration : IEntityTypeConfiguration<UnitInspection>
{
    public void Configure(EntityTypeBuilder<UnitInspection> b)
    {
        b.Property(x => x.Notes).HasMaxLength(MaintenanceConsts.MaxNotesLength);
        b.HasIndex(x => new { x.UnitId, x.Date });
        b.HasIndex(x => x.EquipmentId);
        b.HasOne<EquipmentUnit>().WithMany().HasForeignKey(x => x.UnitId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class LabelTemplateConfiguration : IEntityTypeConfiguration<LabelTemplate>
{
    public void Configure(EntityTypeBuilder<LabelTemplate> b)
    {
        b.Property(x => x.Name).HasMaxLength(LabelTemplateConsts.MaxNameLength).IsRequired();
        b.Property(x => x.FontSizePt).HasColumnType(ColumnTypes.Percent);
    }
}

public class AttachmentConfiguration : IEntityTypeConfiguration<Attachment>
{
    public void Configure(EntityTypeBuilder<Attachment> b)
    {
        b.Property(x => x.FileName).HasMaxLength(CollaborationConsts.MaxFileNameLength).IsRequired();
        b.Property(x => x.ContentType).HasMaxLength(CollaborationConsts.MaxContentTypeLength).IsRequired();
        b.Property(x => x.Content).IsRequired();
        b.HasIndex(x => new { x.OwnerType, x.OwnerId });
    }
}

public class NoteConfiguration : IEntityTypeConfiguration<Note>
{
    public void Configure(EntityTypeBuilder<Note> b)
    {
        b.Property(x => x.Text).HasMaxLength(CollaborationConsts.MaxNoteLength).IsRequired();
        b.HasIndex(x => new { x.OwnerType, x.OwnerId });
    }
}

public class TaskItemConfiguration : IEntityTypeConfiguration<TaskItem>
{
    public void Configure(EntityTypeBuilder<TaskItem> b)
    {
        b.ToTable("Tasks");
        b.Property(x => x.Title).HasMaxLength(CollaborationConsts.MaxTaskTitleLength).IsRequired();
        b.Property(x => x.Description).HasMaxLength(CollaborationConsts.MaxTaskDescriptionLength);
        b.HasIndex(x => new { x.OwnerType, x.OwnerId });
        b.HasOne<AppUser>().WithMany().HasForeignKey(x => x.AssignedUserId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class EquipmentUnitConfiguration : IEntityTypeConfiguration<EquipmentUnit>
{
    public void Configure(EntityTypeBuilder<EquipmentUnit> b)
    {
        b.Property(x => x.SerialNumber).HasMaxLength(EquipmentUnitConsts.MaxSerialNumberLength);
        b.Property(x => x.InternalRef).HasMaxLength(EquipmentUnitConsts.MaxInternalRefLength).IsRequired();
        b.Property(x => x.Notes).HasMaxLength(EquipmentDetailConsts.MaxRemarkLength);
        b.HasIndex(x => new { x.CompanyId, x.InternalRef }).IsUnique().HasFilter("[IsDeleted] = 0");
        b.HasOne<Supplier>().WithMany().HasForeignKey(x => x.SupplierId).OnDelete(DeleteBehavior.Restrict);
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
        b.Property(x => x.PaymentTerms).HasMaxLength(256);
        b.HasMany(x => x.Equipment).WithOne().HasForeignKey(x => x.ProjectId).OnDelete(DeleteBehavior.Cascade);
        b.HasMany(x => x.Sections).WithOne().HasForeignKey(x => x.ProjectId).OnDelete(DeleteBehavior.Cascade);
        b.HasMany(x => x.Crew).WithOne().HasForeignKey(x => x.ProjectId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne<AppUser>().WithMany().HasForeignKey(x => x.AccountManagerId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class ProjectSectionConfiguration : IEntityTypeConfiguration<ProjectSection>
{
    public void Configure(EntityTypeBuilder<ProjectSection> b)
    {
        b.ToTable("ProjectSections");
        b.Property(x => x.Name).HasMaxLength(128).IsRequired();
    }
}

public class ProjectCrewMemberConfiguration : IEntityTypeConfiguration<ProjectCrewMember>
{
    public void Configure(EntityTypeBuilder<ProjectCrewMember> b)
    {
        b.ToTable("ProjectCrew");
        b.Property(x => x.Function).HasMaxLength(128);
        b.HasIndex(x => new { x.ProjectId, x.UserId }).IsUnique();
        b.HasIndex(x => x.UserId);
        b.HasOne<AppUser>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
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
        b.Property(x => x.Note).HasMaxLength(256);
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
        b.Property(x => x.RejectionReason).HasMaxLength(QuoteConsts.MaxRejectionReasonLength);
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
        b.Property(x => x.Section).HasMaxLength(260);
        b.Property(x => x.Notes).HasMaxLength(1000);
        b.Property(x => x.Quantity).HasColumnType(ColumnTypes.Quantity);
        b.Property(x => x.UnitPrice).HasColumnType(ColumnTypes.Money);
        b.Property(x => x.DiscountPercent).HasColumnType(ColumnTypes.Percent);
        b.Property(x => x.Total).HasColumnType(ColumnTypes.Money);
        b.HasOne<Equipment>().WithMany().HasForeignKey(x => x.EquipmentId).OnDelete(DeleteBehavior.Restrict);
    }
}

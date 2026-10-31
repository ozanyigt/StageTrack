using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StageTrack.Inventory;
using StageTrack.Projects;
using StageTrack.Sites;

namespace StageTrack.EntityFrameworkCore;

public class SitePlanConfiguration : IEntityTypeConfiguration<SitePlan>
{
    public void Configure(EntityTypeBuilder<SitePlan> b)
    {
        b.Property(x => x.Name).HasMaxLength(SiteConsts.MaxNameLength).IsRequired();

        // One plan per job, like its quote: the different views are layers of the same plan.
        b.HasIndex(x => new { x.CompanyId, x.ProjectId }).IsUnique().HasFilter("[IsDeleted] = 0");
        b.HasOne<Project>().WithMany().HasForeignKey(x => x.ProjectId).OnDelete(DeleteBehavior.Cascade);

        b.HasMany(x => x.Items).WithOne().HasForeignKey(i => i.SitePlanId).OnDelete(DeleteBehavior.Cascade);
        b.HasMany(x => x.Zones).WithOne().HasForeignKey(z => z.SitePlanId).OnDelete(DeleteBehavior.Cascade);
        b.Navigation(x => x.Items).AutoInclude();
        b.Navigation(x => x.Zones).AutoInclude();
    }
}

public class SitePlanItemConfiguration : IEntityTypeConfiguration<SitePlanItem>
{
    public void Configure(EntityTypeBuilder<SitePlanItem> b)
    {
        b.Property(x => x.Label).HasMaxLength(SiteConsts.MaxLabelLength);
        b.Property(x => x.Layer).HasMaxLength(SiteConsts.MaxLayerLength);
        b.Property(x => x.Notes).HasMaxLength(SiteConsts.MaxNotesLength);
        b.Property(x => x.LightHeightM).HasColumnType(ColumnTypes.Measure);
        b.Property(x => x.LightRadiusM).HasColumnType(ColumnTypes.Measure);
        b.HasIndex(x => x.SitePlanId);

        // Restrict, not cascade: deleting equipment that is standing on a plan should be refused, not silently
        // erase the plan - the same rule the rest of the inventory follows.
        b.HasOne<Equipment>().WithMany().HasForeignKey(x => x.EquipmentId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class SitePlanZoneConfiguration : IEntityTypeConfiguration<SitePlanZone>
{
    public void Configure(EntityTypeBuilder<SitePlanZone> b)
    {
        b.Property(x => x.Name).HasMaxLength(SiteConsts.MaxNameLength).IsRequired();
        b.Property(x => x.Color).HasMaxLength(SiteConsts.MaxColorLength).IsRequired();
        b.Property(x => x.Layer).HasMaxLength(SiteConsts.MaxLayerLength);
        // A shape is read and written whole; its corners never need to be queried one by one.
        b.Property(x => x.Points).HasMaxLength(16_000).IsRequired();
        b.HasIndex(x => x.SitePlanId);
    }
}

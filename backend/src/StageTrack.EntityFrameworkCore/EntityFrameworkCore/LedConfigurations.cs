using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StageTrack.Inventory;
using StageTrack.Led;

namespace StageTrack.EntityFrameworkCore;

/// <summary>
/// The three LED spec shapes share one table: a panel carries twenty columns, a processor four, so separate tables
/// would be three joins for one answer. The role column is the discriminator, which is also why "is this equipment
/// part of the LED module?" is a single left join.
/// </summary>
public class EquipmentLedSpecConfiguration : IEntityTypeConfiguration<EquipmentLedSpec>
{
    public void Configure(EntityTypeBuilder<EquipmentLedSpec> b)
    {
        b.ToTable("EquipmentLedSpecs");
        b.HasDiscriminator(x => x.Role)
            .HasValue<LedPanelSpec>(LedRole.Panel)
            .HasValue<LedProcessorSpec>(LedRole.Processor)
            .HasValue<LedExtenderSpec>(LedRole.Extender);

        b.HasIndex(x => new { x.CompanyId, x.EquipmentId }).IsUnique().HasFilter("[IsDeleted] = 0");
        b.HasIndex(x => new { x.CompanyId, x.Role });
        b.HasOne<Equipment>().WithMany().HasForeignKey(x => x.EquipmentId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class LedPanelSpecConfiguration : IEntityTypeConfiguration<LedPanelSpec>
{
    public void Configure(EntityTypeBuilder<LedPanelSpec> b)
    {
        b.Property(x => x.PitchMm).HasColumnType(ColumnTypes.Measure);
        b.Property(x => x.WattMax).HasColumnType(ColumnTypes.Measure);
        b.Property(x => x.WattAvg).HasColumnType(ColumnTypes.Measure);
        b.Property(x => x.AngleMin).HasColumnType(ColumnTypes.Measure);
        b.Property(x => x.AngleMax).HasColumnType(ColumnTypes.Measure);
        b.Property(x => x.AngleStep).HasColumnType(ColumnTypes.Measure);
        b.Property(x => x.CaseWeightKg).HasColumnType(ColumnTypes.Measure);
        b.Property(x => x.CaseDimensionsCm).HasMaxLength(LedConsts.MaxCaseDimensionsLength);
        b.Property(x => x.ReceivingCard).HasMaxLength(LedConsts.MaxReceivingCardLength);
    }
}

// Processors and extenders both count ethernet ports; in one table they need a column each, named rather than
// left to EF's "LedProcessorSpec_EthernetPorts".
public class LedProcessorSpecConfiguration : IEntityTypeConfiguration<LedProcessorSpec>
{
    public void Configure(EntityTypeBuilder<LedProcessorSpec> b) =>
        b.Property(x => x.EthernetPorts).HasColumnName("ProcessorEthernetPorts");
}

public class LedExtenderSpecConfiguration : IEntityTypeConfiguration<LedExtenderSpec>
{
    public void Configure(EntityTypeBuilder<LedExtenderSpec> b) =>
        b.Property(x => x.EthernetPorts).HasColumnName("ExtenderEthernetPorts");
}

public class LedStageSettingsConfiguration : IEntityTypeConfiguration<LedStageSettings>
{
    public void Configure(EntityTypeBuilder<LedStageSettings> b)
    {
        foreach (var metres in new[]
                 {
                     nameof(LedStageSettings.StageWidthM), nameof(LedStageSettings.StageDepthM), nameof(LedStageSettings.StageHeightM),
                     nameof(LedStageSettings.FrontGapM), nameof(LedStageSettings.LegDepthM), nameof(LedStageSettings.BottomM),
                     nameof(LedStageSettings.GroundSupportHeightM), nameof(LedStageSettings.TrussHeightM), nameof(LedStageSettings.HangAllowanceM)
                 })
        {
            b.Property<decimal>(metres).HasColumnType(ColumnTypes.Measure);
        }

        // One row per firm location; the unique index is what keeps a second save from making a second row.
        b.HasIndex(x => x.CompanyId).IsUnique().HasFilter("[IsDeleted] = 0");
    }
}

public class LedTransportSettingsConfiguration : IEntityTypeConfiguration<LedTransportSettings>
{
    public void Configure(EntityTypeBuilder<LedTransportSettings> b) =>
        b.HasIndex(x => x.CompanyId).IsUnique().HasFilter("[IsDeleted] = 0");
}

public class LedTransportVehicleConfiguration : IEntityTypeConfiguration<LedTransportVehicle>
{
    public void Configure(EntityTypeBuilder<LedTransportVehicle> b)
    {
        b.Property(x => x.Name).HasMaxLength(LedConsts.MaxVehicleNameLength).IsRequired();
        b.HasIndex(x => new { x.CompanyId, x.SortOrder });
    }
}

public class LedPanelFavoriteConfiguration : IEntityTypeConfiguration<LedPanelFavorite>
{
    public void Configure(EntityTypeBuilder<LedPanelFavorite> b)
    {
        b.HasIndex(x => new { x.CompanyId, x.UserId, x.EquipmentId }).IsUnique().HasFilter("[IsDeleted] = 0");
        b.HasOne<Equipment>().WithMany().HasForeignKey(x => x.EquipmentId).OnDelete(DeleteBehavior.Cascade);
    }
}

using StageTrack.Inventory;
using StageTrack.Led;
using StageTrack.Led.Transport;
using Xunit;

namespace StageTrack.Domain.Tests;

public class LedSpecTests
{
    private static Equipment Panel(decimal? weightKg = 13.5m)
    {
        var equipment = new Equipment(Guid.CreateVersion7(), "LED-045", "INFICOLOR P3.9", EquipmentType.Physical, isSerialized: true);
        equipment.UpdatePhysical(null, null, null, weightKg, null, null, null, 1);
        return equipment;
    }

    private static LedPanelSpec Spec(Guid equipmentId)
    {
        var spec = new LedPanelSpec(Guid.CreateVersion7(), equipmentId);
        spec.SetGeometry(3.9m, 500, 1000, 128, 256);
        spec.SetPower(300, 160, 12, 16);
        spec.SetShape(LedPanelType.Flat, LedPanelGroup.Indoor);
        return spec;
    }

    [Fact]
    public void A_panel_becomes_the_spec_the_maths_asks_for_keyed_by_its_equipment()
    {
        var equipment = Panel();
        var spec = Spec(equipment.Id);

        var panel = LedSpecMapper.ToPanelSpec(equipment, spec, null);

        Assert.Equal(equipment.Id, panel.Id);
        Assert.Equal(500, panel.WidthMm);
        Assert.Equal(13.5, panel.WeightKg);
        Assert.Equal(300, panel.WattMax);
        Assert.False(panel.IsCorner);
        Assert.Null(panel.Angles);
    }

    [Fact]
    public void Weight_comes_from_the_equipment_record_and_a_missing_one_counts_as_zero()
    {
        var equipment = Panel(weightKg: null);

        Assert.Equal(0, LedSpecMapper.ToPanelSpec(equipment, Spec(equipment.Id), null).WeightKg);
    }

    [Theory]
    [InlineData(LedPanelType.Corner, true)]
    [InlineData(LedPanelType.CurveCorner, true)]
    [InlineData(LedPanelType.Curve, false)]
    [InlineData(LedPanelType.Flat, false)]
    public void Only_corner_shapes_may_stand_in_a_screens_corner_column(LedPanelType type, bool isCorner)
    {
        var equipment = Panel();
        var spec = Spec(equipment.Id);
        spec.SetShape(type, LedPanelGroup.Indoor);

        Assert.Equal(isCorner, LedSpecMapper.ToPanelSpec(equipment, spec, null).IsCorner);
    }

    [Fact]
    public void An_angle_range_reaches_the_maths_only_when_both_ends_are_set()
    {
        var equipment = Panel();
        var spec = Spec(equipment.Id);
        spec.SetAngles(-10, 10, 2.5m);

        var angles = LedSpecMapper.ToPanelSpec(equipment, spec, null).Angles;

        Assert.NotNull(angles);
        Assert.Equal(-10, angles.Min);
        Assert.Equal(10, angles.Max);
        Assert.Equal(2.5, angles.Step);
    }

    [Theory]
    [InlineData(10, null)]
    [InlineData(null, 10)]
    [InlineData(20, 10)]
    public void Half_an_angle_range_or_a_reversed_one_is_refused(int? min, int? max)
    {
        var spec = Spec(Guid.CreateVersion7());

        Assert.Throws<BusinessException>(() => spec.SetAngles((decimal?)min, (decimal?)max, null));
    }

    [Fact]
    public void An_angle_step_without_a_range_is_refused()
    {
        var spec = Spec(Guid.CreateVersion7());

        Assert.Throws<BusinessException>(() => spec.SetAngles(null, null, 2));
    }

    [Fact]
    public void Average_power_above_the_maximum_is_refused()
    {
        var spec = Spec(Guid.CreateVersion7());

        var error = Assert.Throws<BusinessException>(() => spec.SetPower(100, 200, null, null));
        Assert.Equal(StageTrackErrorCodes.LedAverageOverMaxWatt, error.Code);
    }

    [Fact]
    public void A_case_size_that_is_not_HxWxD_is_refused()
    {
        var spec = Spec(Guid.CreateVersion7());

        var error = Assert.Throws<BusinessException>(() => spec.SetTransport(TransportKind.Case, 6, "72-60-100", null, null));
        Assert.Equal(StageTrackErrorCodes.LedInvalidCaseDimensions, error.Code);
    }

    [Fact]
    public void A_stack_higher_than_the_limit_is_refused()
    {
        var spec = Spec(Guid.CreateVersion7());

        var error = Assert.Throws<BusinessException>(() =>
            spec.SetTransport(TransportKind.Case, 6, "72x60x100", 45, LedConsts.MaxStackLimit + 1));
        Assert.Equal(StageTrackErrorCodes.LedStackTooHigh, error.Code);
    }

    [Fact]
    public void An_exclusive_panel_needs_at_least_one_processor()
    {
        var spec = Spec(Guid.CreateVersion7());

        Assert.Throws<BusinessException>(() => spec.SetExclusiveProcessors(exclusive: true, linkedProcessors: 0));
        spec.SetExclusiveProcessors(exclusive: true, linkedProcessors: 2);
        Assert.True(spec.HasExclusiveProcessors);
    }

    [Fact]
    public void Compatible_processors_reach_the_maths_only_for_an_exclusive_panel()
    {
        var equipment = Panel();
        var spec = Spec(equipment.Id);
        var processors = new[] { Guid.CreateVersion7() };

        // Not exclusive: null means "any processor will do" — an empty list would mean "none fits".
        Assert.Null(LedSpecMapper.ToPanelSpec(equipment, spec, processors).CompatibleProcessorIds);

        spec.SetExclusiveProcessors(exclusive: true, linkedProcessors: 1);
        Assert.Equal(processors, LedSpecMapper.ToPanelSpec(equipment, spec, processors).CompatibleProcessorIds);
    }

    [Fact]
    public void Panels_are_split_into_cases_of_the_size_the_model_gives()
    {
        var equipment = Panel();
        var spec = Spec(equipment.Id);
        spec.SetTransport(TransportKind.Case, 6, "72x60x100", 45, 3);

        var group = LedSpecMapper.ToCaseGroup(equipment, spec, panels: 14);

        Assert.NotNull(group);
        Assert.Equal(3, group.Cases);
        Assert.Equal([6, 6, 2], group.PanelsPerCase);
        Assert.Equal(3, group.MaxStack);
        Assert.Equal(72, group.Size.HeightCm);
    }

    [Fact]
    public void A_model_without_a_case_size_cannot_be_loaded_onto_a_vehicle()
    {
        var equipment = Panel();

        Assert.Null(LedSpecMapper.ToCaseGroup(equipment, Spec(equipment.Id), panels: 10));
    }

    [Fact]
    public void A_vehicle_is_kept_in_millimetres_and_handed_to_the_maths_in_centimetres()
    {
        var vehicle = new LedTransportVehicle(Guid.CreateVersion7(), "Kamyonet", 4200, 2000, 2100, 1500, 1);

        var spec = LedSpecMapper.ToVehicleSpec(vehicle);

        Assert.Equal(420, spec.LengthCm);
        Assert.Equal(200, spec.WidthCm);
        Assert.Equal(210, spec.HeightCm);
        Assert.Equal(1500, spec.CapacityKg);
    }

    [Fact]
    public void Stage_settings_start_from_the_shared_defaults_and_never_go_negative()
    {
        var settings = new LedStageSettings(Guid.CreateVersion7());
        Assert.Equal(LedStageSettings.Defaults, settings.Values);

        settings.Apply(LedStageSettings.Defaults with { StageWidthM = -5, TrussHeightM = 10 });

        Assert.Equal(0, settings.StageWidthM);
        Assert.Equal(10, settings.TrussHeightM);
    }
}

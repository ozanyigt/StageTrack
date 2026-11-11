using StageTrack.Data;
using StageTrack.Design;
using Xunit;

namespace StageTrack.Domain.Tests;

/// <summary>
/// The demo LED catalogue. Two things have to hold: the seeding may run as often as the application starts, and
/// the figures have to be physically possible - a panel whose pixel count disagrees with its pitch would make
/// every screen, power and case number of the demo wrong in a way nobody would notice.
/// </summary>
public class DesignDemoDataTests
{
    [Fact]
    public void An_empty_database_needs_every_code_of_the_set()
    {
        foreach (var set in DesignDemoData.All)
        {
            Assert.Equal(set.Codes, DesignDemoData.MissingSpecs(set, []));
        }
    }

    [Fact]
    public void A_second_run_has_nothing_left_to_write()
    {
        foreach (var set in DesignDemoData.All)
        {
            // First start: everything is missing and gets written.
            var first = DesignDemoData.MissingSpecs(set, []);
            Assert.NotEmpty(first);

            // Second start: those rows are now there, so the set asks for nothing - the seeding is idempotent.
            Assert.Empty(DesignDemoData.MissingSpecs(set, first));
        }
    }

    [Fact]
    public void Equipment_outside_the_set_does_not_make_a_code_look_done()
    {
        var set = DesignDemoData.ForCompany("TR")!;

        Assert.Equal(set.Codes, DesignDemoData.MissingSpecs(set, ["AUD-001", "Light-101"]));
    }

    [Fact]
    public void A_panel_has_as_many_pixels_as_its_size_divided_by_its_pitch()
    {
        foreach (var panel in DesignDemoData.All.SelectMany(s => s.Panels))
        {
            // Half a pitch of tolerance: a cabinet's pixel count is whole, its pitch is rounded to two decimals.
            Assert.True(Math.Abs(panel.PixelWidth * panel.PitchMm - panel.WidthMm) <= panel.PitchMm / 2,
                $"{panel.Code}: {panel.PixelWidth} px x {panel.PitchMm} mm != {panel.WidthMm} mm");
            Assert.True(Math.Abs(panel.PixelHeight * panel.PitchMm - panel.HeightMm) <= panel.PitchMm / 2,
                $"{panel.Code}: {panel.PixelHeight} px x {panel.PitchMm} mm != {panel.HeightMm} mm");
        }
    }

    [Fact]
    public void A_panel_links_further_at_average_power_than_at_maximum()
    {
        foreach (var panel in DesignDemoData.All.SelectMany(s => s.Panels))
        {
            // Both are panels on one 16 A circuit: less power per panel means more panels on the circuit.
            Assert.True(panel.MaxLinkPanels > 0 && panel.AvgLinkPanels >= panel.MaxLinkPanels, panel.Code);
        }
    }

    [Fact]
    public void A_panel_never_averages_more_power_than_its_maximum()
    {
        foreach (var panel in DesignDemoData.All.SelectMany(s => s.Panels))
        {
            Assert.True(panel.PowerAvgW > 0 && panel.PowerAvgW <= panel.PowerMaxW, panel.Code);
        }
    }

    [Fact]
    public void A_curve_range_is_either_whole_or_absent()
    {
        foreach (var panel in DesignDemoData.All.SelectMany(s => s.Panels))
        {
            // The entity refuses a half-entered range; a floor panel has none at all.
            Assert.Equal(panel.AngleMinDeg.HasValue, panel.AngleMaxDeg.HasValue);
            Assert.True(panel.AngleMinDeg is null || panel.AngleMinDeg <= panel.AngleMaxDeg);
            Assert.True(panel.AngleStepDeg is null or > 0);
            Assert.True(panel.AngleStepDeg is null || panel.AngleMinDeg.HasValue);
        }
    }

    [Fact]
    public void A_case_carries_panels_and_says_how_high_it_stacks()
    {
        foreach (var panel in DesignDemoData.All.SelectMany(s => s.Panels))
        {
            Assert.True(panel.CasePanelCount > 0, panel.Code);
            Assert.True(panel.CaseWeightKg > 0, panel.Code);
            Assert.True(panel.MaxStack > 0 && panel.MaxStack <= DesignConsts.MaxStackLimit, panel.Code);
            Assert.Matches(@"^\d+(\.\d+)?x\d+(\.\d+)?x\d+(\.\d+)?$", panel.CaseDimensionsCm);
        }
    }

    [Fact]
    public void A_panel_knows_what_it_weighs_and_its_case_weighs_more_than_its_panels()
    {
        foreach (var panel in DesignDemoData.All.SelectMany(s => s.Panels))
        {
            // A missing panel weight is a zero in every rigging and vehicle total, so the demo always states one.
            Assert.True(panel.WeightKgPerPanel > 0, panel.Code);

            // The case carries the panels and its own frame, so it cannot weigh less than what is inside it.
            Assert.True(panel.CaseWeightKg >= panel.WeightKgPerPanel * panel.CasePanelCount, panel.Code);

            // A weight being replaced is the old value, never the new one - otherwise the second start would
            // keep rewriting it and the correction would not be idempotent.
            Assert.NotEqual(panel.WeightKgPerPanel, panel.WeightKgToCorrect);
        }
    }

    [Fact]
    public void The_floor_panel_replaces_the_dolly_weight_its_row_used_to_carry()
    {
        var floor = DesignDemoData.ForCompany("TR")!.Panels.Single(p => p.Code == "Led-047");

        Assert.Equal(10.5m, floor.WeightKgPerPanel);
        Assert.Equal(160m, floor.WeightKgToCorrect);
        Assert.Equal(175m, floor.CaseWeightKg);
    }

    [Fact]
    public void A_processor_port_count_agrees_with_the_pixels_it_drives()
    {
        foreach (var processor in DesignDemoData.All.SelectMany(s => s.Processors))
        {
            Assert.True(processor.EthernetPorts > 0, processor.Code);
            Assert.Equal(processor.TotalPixels, processor.EthernetPorts * processor.PixelsPerPort);
        }
    }

    [Fact]
    public void A_converter_is_only_reachable_when_a_processor_has_a_fibre_output()
    {
        foreach (var set in DesignDemoData.All.Where(s => s.Extenders.Count > 0))
        {
            Assert.Contains(set.Processors, p => p.OptPorts > 0);
            Assert.All(set.Extenders, e => Assert.True(e.FiberPorts > 0 && e.EthernetPorts > 0, e.Code));
        }
    }

    [Fact]
    public void Gear_the_demo_creates_carries_a_code_the_set_also_describes()
    {
        foreach (var set in DesignDemoData.All)
        {
            Assert.All(set.NewEquipment, item => Assert.Contains(item.Code, set.Codes));
            Assert.All(set.NewEquipment, item => Assert.True(item.Units > 0 && item.PriceTry > 0, item.Code));
        }
    }
}

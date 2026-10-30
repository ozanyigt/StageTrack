using StageTrack.Led.Calculation;

namespace StageTrack.Led.Tests.Calculation;

/// <summary>The power rules of docs/HESAPLAMA.md (scenarios carried over from the former TypeScript engine).</summary>
public sealed class PowerCalculatorTests
{
    private static readonly CalcSettings Settings = CalcSettings.Default;

    private static PanelSpec Panel(
        double? wattMax = 230, double? wattAvg = 115, int? maxLink = null, int? avgLink = null,
        double width = 500, double height = 500, int px = 128, int py = 128, double weight = 7.5) =>
        new(Guid.NewGuid(), width, height, px, py, weight, wattMax, wattAvg, maxLink, avgLink, []);

    [Fact]
    public void Defaults_AreTheAgreedConstants()
    {
        Assert.Equal((1.0, 16.0, 100.0, 6), (Settings.PowerFactor, Settings.FuseAmpere, Settings.DeratingPercent, Settings.CircuitsPerSocapex));
        Assert.Equal(
            ["32a:32:4", "63a:63:6", "125a:125:12", "powerlock:400:24"],
            Settings.DistributionOptions.Select(o => $"{o.Id}:{o.AmpsPerPhase}:{o.SocapexOutputs}"));
    }

    [Fact]
    public void WattAndCurrent_FollowThePowerMode()
    {
        var panel = Panel(wattMax: 230, wattAvg: 115, maxLink: 16, avgLink: 20);
        Assert.Equal(230, PowerCalculator.PanelWatt(panel, PowerMode.Max));
        Assert.Equal(115, PowerCalculator.PanelWatt(panel, PowerMode.Average));
        Assert.Equal(1.0, PowerCalculator.PanelCurrent(panel, PowerMode.Max, 230, 1)!.Value, 5);
        Assert.Equal(16, PowerCalculator.FixedLink(panel, PowerMode.Max));
        Assert.Equal(20, PowerCalculator.FixedLink(panel, PowerMode.Average));
        Assert.Null(PowerCalculator.PanelCurrent(Panel(wattAvg: null), PowerMode.Average, 230, 1));
        Assert.Null(PowerCalculator.FixedLink(Panel(maxLink: null), PowerMode.Max));
    }

    [Theory]
    [InlineData(230, 1.0, 12)] // 230 W at 230 V: 1 A, 16 A × 80 % → 12 panels
    [InlineData(110, 2.0909, 6)] // the same panel at 110 V: ~2.09 A → 6 panels
    public void PanelsPerCircuit_FloorsTheUsableCurrent(double voltage, double expectedCurrent, int expectedPanels)
    {
        var current = PowerCalculator.WattToCurrent(230, voltage, 1.0);
        Assert.Equal(expectedCurrent, current, 3);
        Assert.Equal(expectedPanels, PowerCalculator.PanelsPerCircuit(current, 16, 80));
        Assert.Equal(0, PowerCalculator.PanelsPerCircuit(0, 16, 80));
    }

    [Fact]
    public void CircuitAndSocapexCounts_AreCeilings()
    {
        Assert.Equal(9, PowerCalculator.RequiredCircuits(100, 12));
        Assert.Equal(8, PowerCalculator.RequiredCircuits(96, 12));
        Assert.Equal(2, PowerCalculator.RequiredSocapex(8, 6));
        Assert.Equal(1, PowerCalculator.RequiredSocapex(6, 6));
    }

    [Fact]
    public void Circuits_101PanelsAt16_AreSixFullAndOneOfFive()
    {
        var circuits = PowerCalculator.BuildCircuits(101, 0.5, 16, "s1");
        Assert.Equal(7, circuits.Count);
        Assert.All(circuits.Take(6), c => Assert.Equal(16, c.PanelCount));
        Assert.Equal(5, circuits[6].PanelCount);

        // Phase currents use the real (partial) last circuit.
        var phases = PowerCalculator.DistributePhases(circuits);
        Assert.Equal(101 * 0.5, phases.Sum(p => p.TotalCurrentA), 9);
        Assert.Equal([16.0, 16.0, 18.5], phases.Select(p => p.TotalCurrentA).Order());
    }

    [Theory]
    [InlineData(8, 12.8, 4, 2, 1, 0)] // ~100 A per phase
    [InlineData(3, 10, 1, 0, 0, 0)] // 30 A per phase
    [InlineData(36, 12.5, 18, 8, 4, 2)] // ~450 A per phase
    public void Distribution_CountsUpToTheSmallestBoxThatSufficesAlone(int circuitsPerPhase, double circuitA, int a32, int a63, int a125, int powerlock)
    {
        var units = PowerCalculator.RecommendDistribution(circuitsPerPhase, circuitA, Settings.DistributionOptions);
        Assert.Equal([a32, a63, a125, powerlock], units.Select(u => u.UnitsNeeded));
    }

    [Fact]
    public void Distribution_LeavesOutBoxesBelowOneCircuit_AndIsZeroWithoutLoad()
    {
        Assert.Equal(["63a", "125a", "powerlock"], PowerCalculator.RecommendDistribution(2, 40, Settings.DistributionOptions).Select(u => u.OptionId));
        Assert.All(PowerCalculator.RecommendDistribution(0, 0, Settings.DistributionOptions), u => Assert.Equal(0, u.UnitsNeeded));
    }

    [Fact]
    public void Screen_At230VMax_HasSizeResolutionWeightPowerAndCircuits()
    {
        var panel = Panel(wattMax: 230, maxLink: 16, width: 500, height: 500, px: 192, py: 192, weight: 7.5);
        var screen = PowerCalculator.CalcScreen("s1", panel, 6, 4, 230, PowerMode.Max, Settings);

        Assert.Equal(24, screen.PanelCount);
        Assert.Equal((3000.0, 2000.0), (screen.WidthMm, screen.HeightMm));
        Assert.Equal((1152L, 768L), (screen.ResolutionX, screen.ResolutionY));
        Assert.Equal(180, screen.TotalWeightKg);
        Assert.Equal(5520, screen.TotalWattMax);
        Assert.Equal(1.0, screen.PanelCurrentA, 5);
        Assert.Equal((16, LinkSource.Fixed, 2, 1), (screen.PanelsPerCircuit, screen.PanelsPerCircuitSource, screen.CircuitsNeeded, screen.SocapexNeeded));
    }

    [Fact]
    public void Screen_FixedLinkByMode_120Panels()
    {
        var panel = Panel(wattMax: 352, wattAvg: 120, maxLink: 16, avgLink: 20);
        var max = PowerCalculator.CalcScreen("s", panel, 12, 10, 230, PowerMode.Max, Settings);
        var avg = PowerCalculator.CalcScreen("s", panel, 12, 10, 230, PowerMode.Average, Settings);

        Assert.Equal((16, LinkSource.Fixed, 8, 2), (max.PanelsPerCircuit, max.PanelsPerCircuitSource, max.CircuitsNeeded, max.SocapexNeeded));
        Assert.Equal((20, LinkSource.Fixed, 6, 1), (avg.PanelsPerCircuit, avg.PanelsPerCircuitSource, avg.CircuitsNeeded, avg.SocapexNeeded));
        Assert.Equal(120 * 352, max.TotalWattMax);
        Assert.Equal(120 * 120, avg.TotalWattAvg);
        // A fixed atlama never depends on the voltage.
        Assert.Equal(8, PowerCalculator.CalcScreen("s", panel, 12, 10, 110, PowerMode.Max, Settings).CircuitsNeeded);
        // ...and a 1-panel screen still shows it.
        Assert.Equal(16, PowerCalculator.CalcScreen("s", panel, 1, 1, 230, PowerMode.Max, Settings).PanelsPerCircuit);
    }

    [Fact]
    public void Screen_BlankLink_IsComputedFromTheCurrent()
    {
        var screen = PowerCalculator.CalcScreen("s", Panel(wattMax: 352, maxLink: null), 12, 10, 230, PowerMode.Max, Settings);
        Assert.Equal(LinkSource.Current, screen.PanelsPerCircuitSource);
        Assert.Equal((int)Math.Floor(16 / (352 / 230.0)), screen.PanelsPerCircuit); // 10
    }

    [Fact]
    public void Screen_BlankWatt_IsFlaggedAndCountsAsZero()
    {
        var screen = PowerCalculator.CalcScreen("s", Panel(wattMax: null), 10, 10, 230, PowerMode.Max, Settings);
        Assert.True(screen.WattMissing);
        Assert.Equal(0, screen.TotalWattMax);
        Assert.Equal(0, screen.PanelsPerCircuit);
    }

    [Fact]
    public void Screen_WithoutPanel_IsEmpty()
    {
        var screen = PowerCalculator.CalcScreen("s", null, 10, 10, 230, PowerMode.Max, Settings);
        Assert.Equal((0, 0), (screen.PanelCount, screen.CircuitsNeeded));
        Assert.Empty(screen.Circuits);
    }
}

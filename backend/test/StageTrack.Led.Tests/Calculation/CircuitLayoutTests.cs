using StageTrack.Led.Calculation;

namespace StageTrack.Led.Tests.Calculation;

/// <summary>Power wiring (Simülasyon S3): which panel is on which circuit, and that the default changes no count.</summary>
public sealed class CircuitLayoutTests
{
    private static readonly CalcSettings Settings = CalcSettings.Default;

    // 500 × 500 mm, 140 W max, Max_Atlama 20.
    private static readonly PanelSpec Main = new(Guid.NewGuid(), 500, 500, 192, 192, 7.8, 140, 45, 20, 30, []);
    // No atlama: computed from the current (230 V, 140 W → 0.6087 A → 26 per 16 A circuit).
    private static readonly PanelSpec Computed = Main with { Id = Guid.NewGuid(), MaxLink = null, AvgLink = null };
    private static readonly PanelSpec Corner = new(Guid.NewGuid(), 250, 500, 96, 192, 5, 80, 30, null, null, [], IsCorner: true);

    private static readonly CircuitLayoutOptions Default = CircuitLayoutOptions.Default;

    private static IReadOnlyList<CircuitRun> Map(int columns, int rows, ScreenShape shape, CircuitLayoutOptions layout, PanelSpec? main = null) =>
        PowerCalculator.MapCircuits(main ?? Main, columns, rows, shape, layout, 230, PowerMode.Max, Settings);

    private static ScreenPower Power(int columns, int rows, ScreenShape shape, CircuitLayoutOptions? layout = null, PanelSpec? main = null) =>
        PowerCalculator.CalcShapedScreen("s", main ?? Main, columns, rows, shape, 230, PowerMode.Max, Settings, layout).Power;

    private static (int Column, int Row) Cell(int cell, int rows) => (cell / rows, cell % rows);

    public static TheoryData<int, int, ScreenShape, bool> Screens => new()
    {
        { 73, 11, ScreenShape.Plain, false },
        { 73, 11, new ScreenShape([new Cutout(50, 9, 11, 0)], []), false },
        { 10, 6, new ScreenShape([new Cutout(4, 4, 0, 0), new Cutout(4, 4, 2, 0)], []), true },
        { 12, 5, new ScreenShape([], [new CornerColumn(6, Corner)]), false },
        { 12, 5, new ScreenShape([new Cutout(2, 2, 0, 0)], [new CornerColumn(3, Corner), new CornerColumn(9, Corner)]), true },
        { 1, 1, ScreenShape.Plain, true },
    };

    [Theory]
    [MemberData(nameof(Screens))]
    public void DefaultLayout_HasExactlyTheCircuitsOfTheCeeCount(int columns, int rows, ScreenShape shape, bool computed)
    {
        var main = computed ? Computed : Main;
        var power = Power(columns, rows, shape, main: main);
        var map = Map(columns, rows, shape, Default, main);

        Assert.Equal(power.Circuits.Select(c => (c.Index, c.PanelCount, c.CurrentA)), map.Select(r => (r.Index, r.Cells.Count, r.CurrentA)));
    }

    [Theory]
    [MemberData(nameof(Screens))]
    public void EveryUsedPanel_IsOnExactlyOneCircuit_NoCutPanelIs(int columns, int rows, ScreenShape shape, bool computed)
    {
        var used = ScreenGeometry.UsedCells(columns, rows, shape.Cutouts);
        foreach (var layout in AllLayouts())
        {
            var cells = Map(columns, rows, shape, layout, computed ? Computed : Main).SelectMany(r => r.Cells).ToList();
            Assert.Equal(cells.Count, cells.Distinct().Count());
            Assert.All(cells, cell => Assert.True(used[cell / rows, cell % rows]));
            Assert.Equal(used.Cast<bool>().Count(u => u), cells.Count);
        }
    }

    [Fact]
    public void DefaultLayout_SnakesUpTheFirstColumn_ThenDownTheNext()
    {
        var run = Map(3, 4, ScreenShape.Plain, Default).Single();
        Assert.Equal(
            [(0, 0), (0, 1), (0, 2), (0, 3), (1, 3), (1, 2), (1, 1), (1, 0), (2, 0), (2, 1), (2, 2), (2, 3)],
            run.Cells.Select(c => Cell(c, 4)));
    }

    [Fact]
    public void RowsFromTheTopRight_SnakeAlongTheRows()
    {
        var run = Map(3, 2, ScreenShape.Plain, new CircuitLayoutOptions(WiringDirection.Rows, WiringStart.TopRight, false)).Single();
        Assert.Equal([(2, 1), (1, 1), (0, 1), (0, 0), (1, 0), (2, 0)], run.Cells.Select(c => Cell(c, 2)));
    }

    [Fact]
    public void NotSerpentine_EveryLineRunsFromTheStartingSide()
    {
        var run = Map(3, 2, ScreenShape.Plain, new CircuitLayoutOptions(WiringDirection.Columns, WiringStart.TopLeft, false, Serpentine: false)).Single();
        Assert.Equal([(0, 1), (0, 0), (1, 1), (1, 0), (2, 1), (2, 0)], run.Cells.Select(c => Cell(c, 2)));
    }

    [Fact]
    public void Serpentine_IsTheDefault_AndOnlyItsOwnChoiceChangesTheOrder()
    {
        Assert.True(Default.Serpentine);
        Assert.True(new CircuitLayoutOptions(WiringDirection.Columns, WiringStart.BottomLeft, false).IsDefault);
        Assert.False(new CircuitLayoutOptions(WiringDirection.Columns, WiringStart.BottomLeft, false, false).IsDefault);
    }

    [Fact]
    public void CutCells_AreSkipped_TheChainGoesOn()
    {
        // 2 × 3 with the middle of the first column cut.
        var run = Map(2, 3, new ScreenShape([new Cutout(1, 1, 0, 1)], []), Default).Single();
        Assert.Equal([(0, 0), (0, 2), (1, 2), (1, 1), (1, 0)], run.Cells.Select(c => Cell(c, 3)));
    }

    [Fact]
    public void Circuits_NeverExceedTheAtlama_AndTheFirstPanelIsWhereTheChainStarts()
    {
        // 73 × 11 = 803 panels at 20 per circuit: 40 full circuits and one of 3.
        var map = Map(73, 11, ScreenShape.Plain, Default);
        Assert.Equal(41, map.Count);
        Assert.All(map, r => Assert.InRange(r.Cells.Count, 1, 20));
        Assert.Equal(3, map[^1].Cells.Count);
        Assert.Equal((0, 0), Cell(map[0].Cells[0], 11));
        Assert.Equal((1, 1), Cell(map[1].Cells[0], 11)); // 11 up column 0 and 9 down column 1 (rows 10 … 2) fill the first
    }

    [Fact]
    public void KeepLinesWhole_StartsEachColumnOnANewCircuit_WhenItNoLongerFits()
    {
        // 11 rows, 20 per circuit: a second column does not fit next to the first (22 > 20) → one circuit per column.
        var whole = new CircuitLayoutOptions(WiringDirection.Columns, WiringStart.BottomLeft, true);
        var map = Map(73, 11, ScreenShape.Plain, whole);
        Assert.Equal(73, map.Count);
        Assert.All(map, r => Assert.Equal(11, r.Cells.Count));
        Assert.All(map, r => Assert.Single(r.Cells.Select(c => c / 11).Distinct()));

        // …and the CEE count follows the map.
        var power = Power(73, 11, ScreenShape.Plain, whole);
        Assert.Equal(73, power.CircuitsNeeded);
        Assert.Equal(13, power.SocapexNeeded);
        Assert.Equal(803, power.Circuits.Sum(c => c.PanelCount));
    }

    [Fact]
    public void KeepLinesWhole_PutsShortLinesTogether_WhileTheyFit()
    {
        // 4 rows, 20 per circuit: 5 columns on each circuit, never a column split.
        var map = Map(12, 4, ScreenShape.Plain, new CircuitLayoutOptions(WiringDirection.Columns, WiringStart.BottomLeft, true));
        Assert.Equal([20, 20, 8], map.Select(r => r.Cells.Count));
    }

    [Fact]
    public void KeepLinesWhole_StillSplitsALineLongerThanACircuit()
    {
        // Rows of 30 panels, 20 per circuit.
        var map = Map(30, 2, ScreenShape.Plain, new CircuitLayoutOptions(WiringDirection.Rows, WiringStart.BottomLeft, true));
        Assert.Equal([20, 10, 20, 10], map.Select(r => r.Cells.Count));
    }

    [Fact]
    public void AnotherLayout_KeepsEverythingButTheCircuits()
    {
        var plain = Power(73, 11, ScreenShape.Plain);
        var rows = Power(73, 11, ScreenShape.Plain, new CircuitLayoutOptions(WiringDirection.Rows, WiringStart.TopRight, false));
        Assert.Equal(plain with { Circuits = [] }, rows with { Circuits = [] });
        Assert.Equal(plain.Circuits.Select(c => c.PanelCount), rows.Circuits.Select(c => c.PanelCount));
    }

    [Fact]
    public void WithCorners_AComputedAtlama_FillsByEachPanelsCurrent_InChainOrder()
    {
        var shape = new ScreenShape([], [new CornerColumn(1, Corner)]);
        var map = Map(4, 10, shape, new CircuitLayoutOptions(WiringDirection.Rows, WiringStart.BottomLeft, false), Computed);
        var usable = Settings.FuseAmpere;
        foreach (var run in map)
        {
            var amps = run.Cells.Sum(c => (c / 10 == 1 ? 80 : 140) / 230.0);
            Assert.True(amps <= usable + 1e-9, $"circuit {run.Index}: {amps} A");
        }
        Assert.Equal(40, map.Sum(r => r.Cells.Count));
    }

    [Fact]
    public void NoAtlamaAndNoWatt_NoCircuits()
    {
        var dark = Computed with { WattMax = null };
        Assert.Empty(Map(4, 4, ScreenShape.Plain, Default, dark));
    }

    private static IEnumerable<CircuitLayoutOptions> AllLayouts() =>
        from direction in Enum.GetValues<WiringDirection>()
        from start in Enum.GetValues<WiringStart>()
        from whole in new[] { false, true }
        from serpentine in new[] { true, false }
        select new CircuitLayoutOptions(direction, start, whole, serpentine);
}

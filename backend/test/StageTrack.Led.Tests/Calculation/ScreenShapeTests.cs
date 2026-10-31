using StageTrack.Led.Calculation;

namespace StageTrack.Led.Tests.Calculation;

/// <summary>Cut-outs and corner columns (Simülasyon S2): what they change, and that plain changes nothing.</summary>
public sealed class ScreenShapeTests
{
    private static readonly CalcSettings Settings = CalcSettings.Default;

    // 500 × 500 mm, 192 × 192 px, 7.8 kg, 140 W max / 45 W avg, Max_Atlama 20.
    private static readonly PanelSpec Main = new(Guid.NewGuid(), 500, 500, 192, 192, 7.8, 140, 45, 20, 30, []);
    // A corner panel: 250 × 500 mm, 96 × 192 px, 5 kg, 80 W.
    private static readonly PanelSpec Corner = new(Guid.NewGuid(), 250, 500, 96, 192, 5, 80, 30, null, null, [], IsCorner: true);

    private static ScreenPower Calc(int columns, int rows, ScreenShape shape, PanelSpec? main = null, PowerMode mode = PowerMode.Max) =>
        PowerCalculator.CalcShapedScreen("s", main ?? Main, columns, rows, shape, 230, mode, Settings).Power;

    private static ScreenShape Cut(params Cutout[] cutouts) => new(cutouts, []);

    [Fact]
    public void PlainShape_IsExactlyThePlainCalculation()
    {
        var plain = PowerCalculator.CalcScreen("s", Main, 73, 11, 230, PowerMode.Max, Settings);
        var shaped = Calc(73, 11, ScreenShape.Plain);
        Assert.Equal(plain with { Circuits = [] }, shaped with { Circuits = [] });
        Assert.Equal(plain.Circuits, shaped.Circuits);
    }

    [Fact]
    public void Cutout_50x9_From73x11_RemovesThosePanelsFromEverything()
    {
        var full = Calc(73, 11, ScreenShape.Plain);
        var cut = Calc(73, 11, Cut(new Cutout(50, 9, 11, 0)));

        Assert.Equal(803, full.PanelCount);
        Assert.Equal(353, cut.PanelCount); // 803 − 450
        Assert.Equal(353 * 140, cut.TotalWattMax);
        Assert.Equal(353 * 7.8, cut.TotalWeightKg, 9);
        Assert.Equal(18, cut.CircuitsNeeded); // ceil(353 / 20)
        Assert.Equal(3, cut.SocapexNeeded);
        Assert.Equal(353L * 192 * 192, cut.TotalPixels);
        // The frame stays: outer size and resolution are the full screen's.
        Assert.Equal((full.WidthMm, full.HeightMm, full.ResolutionX, full.ResolutionY), (cut.WidthMm, cut.HeightMm, cut.ResolutionX, cut.ResolutionY));
        Assert.Equal(353, cut.Circuits.Sum(c => c.PanelCount));
    }

    [Fact]
    public void Area_IsThePanelsUsed_CutoutsOut_CornerPanelsAtTheirSize()
    {
        Assert.Equal(803 * 0.25, Calc(73, 11, ScreenShape.Plain).AreaM2, 9);
        // 10 × 5 of 0,25 m² with a 2 × 2 door out: 46 panels.
        Assert.Equal(46 * 0.25, Calc(10, 5, Cut(new Cutout(2, 2, 4, 0))).AreaM2, 9);
        // A corner column (250 × 500 mm) after column 3, its bottom panel cut out: 45 main + 4 corner panels.
        var corner = Calc(10, 5, new ScreenShape([new Cutout(1, 1, 3, 0)], [new CornerColumn(3, Corner)]));
        Assert.Equal(45 * 0.25 + 4 * 0.125, corner.AreaM2, 9);
    }

    [Fact]
    public void OverlappingCutouts_CountOnce()
    {
        // 4 × 4 and 4 × 4 shifted by 2 columns: 16 + 16 − 8 = 24 cells.
        var cut = Calc(10, 6, Cut(new Cutout(4, 4, 0, 0), new Cutout(4, 4, 2, 0)));
        Assert.Equal(60 - 24, cut.PanelCount);
    }

    [Theory]
    [InlineData(0, 1, 0, 0)] // empty
    [InlineData(3, 1, 8, 0)] // reaches past the right edge (10 columns)
    [InlineData(1, 3, 0, 4)] // reaches above the top (6 rows)
    [InlineData(1, 1, -1, 0)]
    public void CutoutOutsideTheScreen_IsAProblem(int width, int height, int left, int bottom) =>
        Assert.Equal(ShapeProblem.CutoutOutside, ScreenGeometry.Check(10, 6, [new Cutout(width, height, left, bottom)], []));

    [Theory]
    [InlineData(new[] { 0 })]
    [InlineData(new[] { 10 })]
    [InlineData(new[] { 3, 3 })]
    public void CornerOutsideOrTwiceInOnePlace_IsAProblem(int[] afterColumns) =>
        Assert.Equal(ShapeProblem.CornerPosition, ScreenGeometry.Check(10, 6, [], afterColumns));

    [Fact]
    public void Corners_AreCountedInTheColumns_WithTheirOwnSizePowerPixelsAndWeight()
    {
        // 20 columns × 4 rows with 2 corner columns = 18 main + 2 corner columns.
        var shape = new ScreenShape([], [new CornerColumn(5, Corner), new CornerColumn(12, Corner)]);
        var screen = Calc(20, 4, shape);

        Assert.Equal(80, screen.PanelCount);
        Assert.Equal(18 * 500 + 2 * 250, screen.WidthMm);
        Assert.Equal(18L * 192 + 2 * 96, screen.ResolutionX);
        Assert.Equal(72 * 140 + 8 * 80, screen.TotalWattMax);
        Assert.Equal(72 * 7.8 + 8 * 5, screen.TotalWeightKg, 9);
        Assert.Equal(72L * 192 * 192 + 8L * 96 * 192, screen.TotalPixels);
        // Fixed atlama (the main panel's 20): 80 panels → 4 circuits of 20, whatever the model.
        Assert.Equal([20, 20, 20, 20], screen.Circuits.Select(c => c.PanelCount));
    }

    [Fact]
    public void Corners_WithAComputedAtlama_FillCircuitsByEachPanelsCurrent()
    {
        // No atlama: 16 A ÷ (230 W / 230 V = 1 A) = 16 main panels; corner panels draw 2 A.
        var main = Main with { WattMax = 230, MaxLink = null };
        var heavyCorner = Corner with { WattMax = 460 };
        // 2 columns × 8 rows, the 2nd column corners: 8 × 1 A then 8 × 2 A → 8 + 4 (= 16 A), then 4.
        var screen = Calc(2, 8, new ScreenShape([], [new CornerColumn(1, heavyCorner)]), main);
        Assert.Equal([12, 4], screen.Circuits.Select(c => c.PanelCount));
        Assert.Equal([16.0, 8.0], screen.Circuits.Select(c => c.CurrentA));
        Assert.Equal((16, LinkSource.Current), (screen.PanelsPerCircuit, screen.PanelsPerCircuitSource));
    }

    [Fact]
    public void ACornerOfAnotherHeight_IsNoted()
    {
        var tall = Corner with { HeightMm = 1000 };
        var (_, warnings) = PowerCalculator.CalcShapedScreen("s", Main, 4, 2, new ScreenShape([], [new CornerColumn(2, tall)]), 230, PowerMode.Max, Settings);
        Assert.Equal([PowerCalculator.CornerHeightMismatch], warnings);
        Assert.Empty(PowerCalculator.CalcShapedScreen("s", Main, 4, 2, new ScreenShape([], [new CornerColumn(2, Corner)]), 230, PowerMode.Max, Settings).Warnings);
    }

    [Theory]
    [InlineData(PowerMode.Max)]
    [InlineData(PowerMode.Average)]
    public void Power_IsThePanelsOwnWatt_ForTheMode(PowerMode mode)
    {
        // 10 × 6 with a 4 × 2 cut: 52 panels at 140 W max / 45 W avg, each panel's own current.
        var cut = Calc(10, 6, Cut(new Cutout(4, 2, 3, 0)), mode: mode);
        Assert.Equal(52 * 140, cut.TotalWattMax, 9);
        Assert.Equal(52 * 45, cut.TotalWattAvg, 9);
        var panelCurrent = PowerCalculator.PanelCurrent(Main, mode, 230, Settings.PowerFactor)!.Value;
        Assert.Equal(panelCurrent, cut.PanelCurrentA, 9);
        Assert.Equal(52 * panelCurrent, cut.Circuits.Sum(c => c.CurrentA), 9);
    }
}

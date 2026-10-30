using StageTrack.Led.Calculation;

namespace StageTrack.Led.Tests.Calculation;

/// <summary>Data chains (Simülasyon S5): panels on ports within the link limit, ports on devices like the option card.</summary>
public sealed class SignalChainTests
{
    // 192 × 192 = 36.864 px per panel.
    private static readonly PanelSpec Main = new(Guid.NewGuid(), 500, 500, 192, 192, 7.8, 140, 45, 20, 30, []);
    private static readonly PanelSpec Corner = new(Guid.NewGuid(), 250, 500, 96, 192, 5, 80, 30, null, null, [], IsCorner: true);

    // 552.960 px per port = exactly 15 panels; 16 ethernet ports, 2 OPT (8 per OPT), 8.847.360 px.
    private static readonly ProcessorSpec Processor = new(Guid.NewGuid(), "Proc", 8_847_360, 16, 552_960, 2);
    private static readonly ExtenderSpec Cvt = new(Guid.NewGuid(), "CVT", 4);
    // Direct connection, no pixels per port entered (650.000 assumed = 17 panels).
    private static readonly ProcessorSpec Direct = new(Guid.NewGuid(), "Direct", 2_600_000, 4, null, 0);

    private static ProcessorOption Option(ProcessorSpec processor, long pixels) =>
        ProcessorPlanner.IsDirect(processor) ? ProcessorPlanner.DescribeDirect(processor, pixels)! : ProcessorPlanner.DescribeCombo(processor, Cvt, pixels)!;

    private static SignalPlan Plan(int columns, int rows, ScreenShape? shape = null, ProcessorSpec? processor = null, CircuitLayoutOptions? layout = null)
    {
        shape ??= ScreenShape.Plain;
        var pixels = (long)ScreenGeometry.UsedCells(columns, rows, shape.Cutouts).Cast<bool>().Count(u => u) * 36_864;
        return SignalChain.Plan(Main, columns, rows, shape, layout ?? CircuitLayoutOptions.Default, Option(processor ?? Processor, pixels));
    }

    [Fact]
    public void PanelsFillEachPort_UpToItsPixelLimit_AsManyPortsAsTheOptionCard()
    {
        // 10 × 6 = 60 panels at 15 per port → 4 ports, the card's ceil(2.211.840 / 552.960) = 4.
        var plan = Plan(10, 6);
        Assert.Equal(4, plan.PortsNeeded);
        Assert.Equal([15, 15, 15, 15], plan.Ports.Select(p => p.Cells.Count));
        Assert.All(plan.Ports, p => Assert.True(p.Pixels <= 552_960));
        Assert.Empty(plan.Warnings);
        // The chain follows the screen's wiring order: up column 0 from the bottom left, down column 1, …
        Assert.Equal([0, 1, 2, 3, 4, 5, 11, 10, 9], plan.Ports[0].Cells.Take(9));
    }

    [Fact]
    public void EveryUsedPanel_IsOnOnePort_CutPanelsOnNone()
    {
        var shape = new ScreenShape([new Cutout(4, 2, 3, 0)], []);
        var plan = Plan(10, 6, shape);
        var cells = plan.Ports.SelectMany(p => p.Cells).ToList();
        Assert.Equal(52, cells.Count);
        Assert.Equal(cells.Count, cells.Distinct().Count());
        var used = ScreenGeometry.UsedCells(10, 6, shape.Cutouts);
        Assert.All(cells, c => Assert.True(used[c / 6, c % 6]));
    }

    [Fact]
    public void WholePanelsNeedingAPortMore_AreNoted()
    {
        // 52 panels at 650.000 px per port: the card counts ceil(1.916.928 / 650.000) = 3; 17 panels per port → 4.
        var plan = Plan(13, 4, processor: Direct);
        Assert.Equal(3, plan.PortsNeeded);
        Assert.Equal([17, 17, 17, 1], plan.Ports.Select(p => p.Cells.Count));
        Assert.Equal([SignalChain.MorePorts], plan.Warnings);
    }

    [Fact]
    public void PortsGoToDevicesAndCvts_AsTheCardFillsThem()
    {
        // A CVT carries min(16 / 2 OPT, 4) = 4 ports; a device 2 OPT × 4 = 8: ports 0-3 on CVT 0, 4-7 on CVT 1 of device 0,
        // 8-15 on device 1, 16 on device 2 — the card's 3 units.
        var plan = Plan(17, 15); // 255 panels = 17 ports
        Assert.Equal(17, plan.Ports.Count);
        Assert.Equal(3, Option(Processor, 255L * 36_864).Units);
        Assert.Equal((0, 0), (plan.Ports[0].Device, plan.Ports[0].Cvt!.Value));
        Assert.Equal((0, 1), (plan.Ports[4].Device, plan.Ports[4].Cvt!.Value));
        Assert.Equal((1, 1), (plan.Ports[15].Device, plan.Ports[15].Cvt!.Value));
        Assert.Equal((2, 0), (plan.Ports[16].Device, plan.Ports[16].Cvt!.Value));

        var direct = Plan(10, 6, processor: Direct);
        Assert.All(direct.Ports, p => Assert.Null(p.Cvt));
    }

    [Fact]
    public void ACornerPanel_CountsItsOwnPixels()
    {
        var shape = new ScreenShape([], [new CornerColumn(1, Corner)]);
        var plan = SignalChain.Plan(Main, 3, 10, shape, CircuitLayoutOptions.Default, Option(Processor, 25L * 36_864));
        // Column 1 holds half-width panels: 18.432 px each.
        Assert.Equal(20 * 36_864L + 10 * 18_432L, plan.Ports.Sum(p => p.Pixels));
        Assert.All(plan.Ports, p => Assert.True(p.Pixels <= 552_960));
    }

    [Fact]
    public void APanelLargerThanAPort_CannotBeChained()
    {
        var huge = Main with { PixelWidth = 1000, PixelHeight = 1000 };
        var option = Option(Processor, 1_000_000);
        var plan = SignalChain.Plan(huge, 1, 1, ScreenShape.Plain, CircuitLayoutOptions.Default, option);
        Assert.Empty(plan.Ports);
        Assert.Equal([SignalChain.PanelTooLarge], plan.Warnings);
    }

    [Fact]
    public void TheWiringLayout_SetsTheChainOrder()
    {
        var plan = Plan(10, 6, layout: new CircuitLayoutOptions(WiringDirection.Rows, WiringStart.TopLeft, false));
        Assert.Equal([5, 11, 17], plan.Ports[0].Cells.Take(3)); // along the top row from the left
    }
}

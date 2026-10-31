using StageTrack.Led.Calculation;

namespace StageTrack.Led.Tests.Calculation;

/// <summary>The processor &amp; extender rules of docs/HESAPLAMA.md (scenarios carried over from the former TypeScript engine).</summary>
public sealed class ProcessorPlannerTests
{
    // Spec scenarios are pinned to the values they were specified with.
    private static readonly ProcessorSpec Mx2000 = Processor("MX2000 Pro", 35_389_440, 80, 442_368, 8);
    private static readonly ProcessorSpec Vx2000 = Processor("VX2000 Pro", 8_847_360, 20, 442_368, 2);
    private static readonly ProcessorSpec Mctrl4K = Processor("MCTRL4K", 8_847_360, 16, 552_960, 2);
    private static readonly ProcessorSpec[] SpecProcessors = [Mx2000, Vx2000, Mctrl4K];
    private static readonly ExtenderSpec Cvt10 = new(Guid.NewGuid(), "CVT10-S", 10);

    // ROE floor: direct-connection processors (OPT 0) its panel lists as exclusive.
    private static readonly ProcessorSpec Z4 = Processor("Z4", 2_073_600, 4, 518_400, 0);
    private static readonly ProcessorSpec Z6 = Processor("Z6", 8_847_360, 16, 552_960, 0);

    private static ProcessorSpec Processor(string name, long pixels, int ports, long? perPort, int opt) =>
        new(Guid.NewGuid(), name, pixels, ports, perPort, opt);

    /// <summary>No processors = not exclusive (works with any); otherwise exclusive to the ones given.</summary>
    private static PanelSpec Panel(params ProcessorSpec[] exclusive) =>
        new(Guid.NewGuid(), 500, 500, 128, 128, 7, 100, 50, null, null, exclusive.Length == 0 ? null : exclusive.Select(p => p.Id).ToList());

    /// <summary>"1 MCTRL4K + 1 CVT10-S" per option, in card order ("1 Z4" for a direct connection).</summary>
    private static string[] Summarize(IEnumerable<ProcessorOption> options) =>
        options.Select(o => o.Extender is null ? $"{o.Units} {o.Processor.Name}" : $"{o.Units} {o.Processor.Name} + {o.ExtenderUnits} {o.Extender.Name}").ToArray();

    [Theory]
    [InlineData(3_000_000, new[] { "1 MCTRL4K + 1 CVT10-S", "1 VX2000 Pro + 1 CVT10-S" })]
    [InlineData(5_000_000, new[] { "1 MCTRL4K + 2 CVT10-S", "1 VX2000 Pro + 2 CVT10-S" })]
    [InlineData(4096 * 2160, new[] { "1 MCTRL4K + 2 CVT10-S", "1 VX2000 Pro + 2 CVT10-S" })]
    [InlineData(9_000_000, new[] { "1 MX2000 Pro + 3 CVT10-S", "2 MCTRL4K + 3 CVT10-S", "2 VX2000 Pro + 3 CVT10-S" })]
    public void Options_MatchTheSpecTable(long pixels, string[] expected) =>
        Assert.Equal(expected, Summarize(ProcessorPlanner.Recommend(SpecProcessors, [Cvt10], pixels)));

    [Fact]
    public void NeverMoreCvtOnAProcessorThanItsOptPorts()
    {
        for (long pixels = 100_000; pixels <= 120_000_000; pixels += 1_234_567)
        {
            foreach (var option in ProcessorPlanner.Recommend(SpecProcessors, [Cvt10], pixels))
            {
                var devices = ProcessorPlanner.FillDevices(option.Processor, option.Extender!, option.PortsUsed)!;
                Assert.Equal(option.Units, devices.Count);
                Assert.Equal(option.ExtenderUnits, devices.Sum(d => d.Cvt));
                Assert.All(devices, d =>
                {
                    Assert.True(d.Cvt <= option.Processor.OptPorts);
                    Assert.True(d.Ports <= option.Processor.EthernetPorts);
                    Assert.True(d.Ports * ProcessorPlanner.PixelsPerPort(option.Processor) <= option.Processor.TotalPixels);
                });
            }
        }
    }

    [Fact]
    public void NothingAvailable_NoOptions()
    {
        Assert.Empty(ProcessorPlanner.Recommend([], [Cvt10], 3_000_000));
        Assert.Empty(ProcessorPlanner.Recommend([Vx2000], [], 3_000_000));
    }

    [Fact]
    public void Ports_UseTheModelsOwnPixelsPerPort_650000WhenBlank()
    {
        Assert.Equal(7, ProcessorPlanner.RequiredEthernetPorts(3_000_000, Vx2000)); // 3.000.000 / 442.368
        Assert.Equal(5, ProcessorPlanner.RequiredEthernetPorts(3_000_000, Processor("X", 10_000_000, 16, null, 2)));
    }

    [Fact]
    public void CvtCapacity_IsFiberPerPortCappedByTheExtender()
    {
        Assert.Equal(10, ProcessorPlanner.FiberPerPort(Vx2000));
        Assert.Equal(8, ProcessorPlanner.CvtCapacity(Mctrl4K, Cvt10));
        Assert.Equal(10, ProcessorPlanner.CvtCapacity(Mx2000, Cvt10));
        Assert.True(ProcessorPlanner.HasFractionalFiberRatio(Processor("Odd", 1, 16, null, 3)));
        Assert.False(ProcessorPlanner.HasFractionalFiberRatio(Vx2000));
    }

    [Theory]
    [InlineData("VX2000 Pro", 30, new[] { 20, 10 }, new[] { 2, 1 })]
    [InlineData("MCTRL4K", 30, new[] { 16, 14 }, new[] { 2, 2 })]
    [InlineData("MX2000 Pro", 30, new[] { 30 }, new[] { 3 })]
    [InlineData("VX2000 Pro", 21, new[] { 20, 1 }, new[] { 2, 1 })]
    public void Devices_AreFilledOneAfterAnother(string model, int ports, int[] expectedPorts, int[] expectedCvt)
    {
        var devices = ProcessorPlanner.FillDevices(SpecProcessors.Single(p => p.Name == model), Cvt10, ports)!;
        Assert.Equal(expectedPorts, devices.Select(d => d.Ports));
        Assert.Equal(expectedCvt, devices.Select(d => d.Cvt));
    }

    [Fact]
    public void ADevice_IsCappedByPortsOptOutputsAndPixels() =>
        // min(16 ports, 2 OPT × 8, 8.847.360 / 552.960 = 16)
        Assert.Equal(16, ProcessorPlanner.MaxPortsPerDevice(Mctrl4K, Cvt10));

    [Fact]
    public void AModelIsHidden_OnlyWhenTwoSmallerModelsDoTheJobWithNoMoreUnits()
    {
        // 3.000.000 px: MCTRL4K and VX2000 Pro (both smaller) take 1 unit each → MX2000 Pro hidden.
        Assert.DoesNotContain("MX2000 Pro", ProcessorPlanner.Recommend(SpecProcessors, [Cvt10], 3_000_000).Select(o => o.Processor.Name));
        // With only one smaller model it stays.
        Assert.Contains("MX2000 Pro", ProcessorPlanner.Recommend([Mx2000, Vx2000], [Cvt10], 3_000_000).Select(o => o.Processor.Name));
    }

    [Theory]
    [InlineData(1_500_000, new[] { "1 Z4", "1 Z6" })]
    [InlineData(3_000_000, new[] { "1 Z6", "2 Z4" })]
    public void ExclusivePanel_GetsOnlyItsProcessors(long pixels, string[] expected)
    {
        var all = SpecProcessors.Concat([Z4, Z6]).ToList();
        var candidates = ProcessorPlanner.CandidatesFor(Panel(Z4, Z6), all);
        var options = ProcessorPlanner.Recommend(candidates.Processors, [Cvt10], pixels);

        Assert.Equal(expected, Summarize(options));
        Assert.All(options, o =>
        {
            Assert.Null(o.Extender);
            Assert.True(o.PixelsUsed <= o.Units * o.Processor.TotalPixels);
            Assert.True(o.PortsUsed <= o.Units * o.Processor.EthernetPorts);
        });
    }

    [Fact]
    public void ANonExclusivePanel_GetsEveryProcessor()
    {
        var all = SpecProcessors.Concat([Z4, Z6]).ToList();
        var candidates = ProcessorPlanner.CandidatesFor(Panel(), all);
        Assert.Equal(all, candidates.Processors);
        Assert.Empty(candidates.MissingIds);
    }

    [Fact]
    public void NoPanel_GetsEveryProcessor() =>
        Assert.Equal(SpecProcessors, ProcessorPlanner.CandidatesFor(null, SpecProcessors).Processors);

    [Fact]
    public void ExclusivePanelWhoseProcessorsAreAllGone_GetsNone()
    {
        var gone = Processor("Gone", 1, 1, null, 0);
        var candidates = ProcessorPlanner.CandidatesFor(Panel(gone), SpecProcessors);
        Assert.Empty(candidates.Processors);
        Assert.Equal([gone.Id], candidates.MissingIds);
    }

    [Fact]
    public void MissingCompatibleProcessors_AreReported()
    {
        var gone = Processor("Gone", 1, 1, null, 0);
        var candidates = ProcessorPlanner.CandidatesFor(Panel(Z4, gone), [Z4]);
        Assert.Equal([Z4], candidates.Processors);
        Assert.Equal([gone.Id], candidates.MissingIds);
    }

    [Fact]
    public void JobTotal_SumsTheSelectedOptions_DirectOnesAddNoCvt_InfeasibleCountedApart()
    {
        var a = ProcessorPlanner.DescribeCombo(Vx2000, Cvt10, 9_000_000)!;
        var b = ProcessorPlanner.DescribeCombo(Vx2000, Cvt10, 3_000_000)!;
        var c = ProcessorPlanner.DescribeDirect(Z6, 3_000_000)!;
        var job = ProcessorPlanner.JobTotal([(9_000_000, a), (3_000_000, b), (3_000_000, c), (1_000, null)]);

        Assert.Equal(15_001_000, job.TotalPixels);
        Assert.Equal([("VX2000 Pro", a.Units + b.Units), ("Z6", 1)], job.Processors.Select(p => (p.Processor.Name, p.Count)));
        Assert.Equal([("CVT10-S", a.ExtenderUnits + b.ExtenderUnits)], job.Extenders.Select(e => (e.Extender.Name, e.Count)));
        Assert.Equal(a.Units + b.Units + 1, job.TotalProcessors);
        Assert.Equal(1, job.InfeasibleScreenCount);
    }
}

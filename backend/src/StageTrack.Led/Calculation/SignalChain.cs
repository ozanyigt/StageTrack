namespace StageTrack.Led.Calculation;

/// <summary>
/// One ethernet port's data chain: its panels in chain order (the first is where the cable comes in; a cell is
/// <c>column × rows + row</c>), the device it comes out of (0-based processor unit) and, through an extender, the
/// CVT of that device (0-based within it; null on a direct connection).
/// </summary>
public sealed record PortChain(int Index, int Device, int? Cvt, IReadOnlyList<int> Cells, long Pixels);

/// <summary>
/// A screen's suggested data chains. <paramref name="PortsNeeded"/> is the port count of the chosen processor option;
/// the chains may need more when whole panels don't fill the ports exactly (then <see cref="SignalChain.MorePorts"/>).
/// </summary>
public sealed record SignalPlan(IReadOnlyList<PortChain> Ports, int PortsNeeded, long PixelsPerPort, IReadOnlyList<string> Warnings);

/// <summary>
/// The data chains of a screen (an example to cable from, not the only way): the used panels in the screen's wiring
/// order are put on ports one after another, as many as a port's pixel limit (the link limit) takes; a port never
/// carries more. Ports go to devices the way the option card counts them: each device takes as many ports as it can,
/// each CVT as many as its capacity.
/// </summary>
public static class SignalChain
{
    /// <summary>Whole panels need more ports than the option card counted from the pixels.</summary>
    public const string MorePorts = "signal_more_ports";
    /// <summary>A single panel has more pixels than one port carries: it can't be chained.</summary>
    public const string PanelTooLarge = "signal_panel_too_large";

    public static SignalPlan Plan(
        PanelSpec main, int columns, int rows, ScreenShape shape, CircuitLayoutOptions layout, ProcessorOption option)
    {
        var perPort = ProcessorPlanner.PixelsPerPort(option.Processor);
        var used = ScreenGeometry.UsedCells(columns, rows, shape.Cutouts);
        var models = ScreenGeometry.ColumnPanels(main, columns, shape.Corners);
        long PixelsOf(int cell)
        {
            var model = models[cell / rows];
            return (long)model.PixelWidth * model.PixelHeight;
        }

        var chains = new List<(List<int> Cells, long Pixels)>();
        var cells = new List<int>();
        long load = 0;
        foreach (var line in CircuitLayout.Lines(columns, rows, used, layout))
            foreach (var cell in line)
            {
                var pixels = PixelsOf(cell);
                if (pixels > perPort) return new SignalPlan([], option.PortsUsed, perPort, new[] { PanelTooLarge });
                if (cells.Count > 0 && load + pixels > perPort)
                {
                    chains.Add((cells, load));
                    (cells, load) = ([], 0);
                }
                cells.Add(cell);
                load += pixels;
            }
        if (cells.Count > 0) chains.Add((cells, load));

        var (portsPerDevice, portsPerCvt) = Split(option, chains.Count);
        var ports = chains.Select((chain, i) =>
        {
            var device = i / portsPerDevice;
            int? cvt = option.Extender is null ? null : (int)Math.Floor((i % portsPerDevice) / portsPerCvt + 1e-9);
            return new PortChain(i, device, cvt, chain.Cells, chain.Pixels);
        }).ToList();
        var warnings = ports.Count > option.PortsUsed ? new[] { MorePorts } : [];
        return new SignalPlan(ports, option.PortsUsed, perPort, warnings);
    }

    /// <summary>Ports per device and per CVT as the option card fills them (direct: the ports spread over its units).</summary>
    private static (int PerDevice, double PerCvt) Split(ProcessorOption option, int ports)
    {
        if (option.Extender is not { } extender)
            return (Math.Max(1, (int)Math.Ceiling(Math.Max(ports, option.PortsUsed) / (double)Math.Max(1, option.Units))), 1);
        var perDevice = Math.Max(1, ProcessorPlanner.MaxPortsPerDevice(option.Processor, extender));
        var perCvt = ProcessorPlanner.CvtCapacity(option.Processor, extender);
        return (perDevice, perCvt > 0 ? perCvt : perDevice);
    }
}

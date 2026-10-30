namespace StageTrack.Led.Calculation;

/// <summary>One option card: a processor model (with its count) and the extender model it needs.</summary>
/// <param name="Extender">null = direct connection (OPT_Port 0), no CVT / extender.</param>
/// <param name="PortsUsed">Internal only — never shown in the UI or reports.</param>
public sealed record ProcessorOption(
    ProcessorSpec Processor,
    int Units,
    ExtenderSpec? Extender,
    int ExtenderUnits,
    int PortsUsed,
    long PixelsUsed,
    long PixelsCapacity,
    double UtilizationPercent);

/// <summary>Processors that may be offered for a panel; <see cref="MissingIds"/> = compatible ids not in the list.</summary>
public sealed record ProcessorCandidates(IReadOnlyList<ProcessorSpec> Processors, IReadOnlyList<Guid> MissingIds);

/// <summary>The job total: every screen's selected option summed per processor and per extender model.</summary>
public sealed record JobDevices(
    long TotalPixels,
    IReadOnlyList<(ProcessorSpec Processor, int Count)> Processors,
    IReadOnlyList<(ExtenderSpec Extender, int Count)> Extenders,
    int TotalProcessors,
    int TotalExtenders,
    int InfeasibleScreenCount);

/// <summary>
/// Processor &amp; extender options (docs/HESAPLAMA.md "Processor &amp; Extender"). Pure functions; same
/// arithmetic (including the 1e-9 tolerance) as the original TypeScript engine.
/// </summary>
public static class ProcessorPlanner
{
    /// <summary>Pixels per ethernet port when a processor leaves it blank.</summary>
    public const long DefaultPixelsPerPort = 650_000;

    /// <summary>Tolerance so e.g. 16 / (16/3) = 3.0000000000000004 still ceils to 3.</summary>
    private const double Eps = 1e-9;

    private static int Ceil(double x) => (int)Math.Ceiling(x - Eps);

    public static long PixelsPerPort(ProcessorSpec processor) =>
        processor.PixelsPerPort is > 0 and var value ? value : DefaultPixelsPerPort;

    /// <summary>ceil(pixels / the processor's own pixels per port).</summary>
    public static int RequiredEthernetPorts(long screenPixels, ProcessorSpec processor) =>
        screenPixels > 0 ? Ceil(screenPixels / (double)PixelsPerPort(processor)) : 0;

    public static double UtilizationPercent(long used, long capacity) => capacity <= 0 ? 0 : used / (double)capacity * 100;

    /// <summary>
    /// An exclusive panel gets exactly its processors (in its order); any other panel — or no panel — gets every
    /// processor.
    /// </summary>
    public static ProcessorCandidates CandidatesFor(PanelSpec? panel, IReadOnlyList<ProcessorSpec> processors)
    {
        if (panel?.CompatibleProcessorIds is not { } wanted) return new ProcessorCandidates(processors.ToList(), []);
        var found = new List<ProcessorSpec>();
        var missing = new List<Guid>();
        foreach (var id in wanted)
        {
            var processor = processors.FirstOrDefault(p => p.Id == id);
            if (processor is null) missing.Add(id);
            else if (!found.Contains(processor)) found.Add(processor);
        }
        return new ProcessorCandidates(found, missing);
    }

    public static bool IsDirect(ProcessorSpec processor) => processor.OptPorts <= 0;

    /// <summary>Ethernet ports behind one OPT output: Ethernet_Port / OPT_Port (not floored).</summary>
    public static double FiberPerPort(ProcessorSpec processor) =>
        processor.OptPorts <= 0 ? 0 : processor.EthernetPorts / (double)processor.OptPorts;

    /// <summary>Ethernet_Port / OPT_Port isn't a whole number — the processor record is likely wrong.</summary>
    public static bool HasFractionalFiberRatio(ProcessorSpec processor) =>
        processor.OptPorts > 0 && processor.EthernetPorts % processor.OptPorts != 0;

    /// <summary>Ports one extender carries: min(fiber per port, the extender's own ethernet ports).</summary>
    public static double CvtCapacity(ProcessorSpec processor, ExtenderSpec extender) =>
        Math.Min(FiberPerPort(processor), extender.EthernetPorts);

    public static int CvtNeeded(ProcessorSpec processor, ExtenderSpec extender, int ports)
    {
        var capacity = CvtCapacity(processor, extender);
        return capacity > 0 && ports > 0 ? Ceil(ports / capacity) : 0;
    }

    /// <summary>Most ports one device takes: its ethernet ports, what its OPT outputs carry through CVTs, and the pixel limit.</summary>
    public static int MaxPortsPerDevice(ProcessorSpec processor, ExtenderSpec extender) =>
        (int)Math.Min(
            processor.EthernetPorts,
            Math.Min(
                Math.Floor(processor.OptPorts * CvtCapacity(processor, extender) + Eps),
                Math.Floor(processor.TotalPixels / (double)PixelsPerPort(processor) + Eps)));

    /// <summary>
    /// Fills devices one after another, each with as many ports as it takes; each device's CVT =
    /// ceil(its ports / CVT capacity). null when a device can't take any port.
    /// </summary>
    public static IReadOnlyList<(int Ports, int Cvt)>? FillDevices(ProcessorSpec processor, ExtenderSpec extender, int ports)
    {
        var perDevice = MaxPortsPerDevice(processor, extender);
        if (perDevice <= 0 || CvtCapacity(processor, extender) <= 0) return null;
        if (ports <= 0) return new[] { (0, 0) };
        var devices = new List<(int, int)>();
        for (var left = ports; left > 0; left -= perDevice)
        {
            var p = Math.Min(perDevice, left);
            devices.Add((p, CvtNeeded(processor, extender, p)));
        }
        return devices;
    }

    /// <summary>One screen on a processor model + extender; null when the model can't be used.</summary>
    public static ProcessorOption? DescribeCombo(ProcessorSpec processor, ExtenderSpec extender, long screenPixels)
    {
        var ports = RequiredEthernetPorts(screenPixels, processor);
        var devices = FillDevices(processor, extender, ports);
        return devices is null ? null : Option(processor, extender, devices.Count, devices.Sum(d => d.Cvt), ports, screenPixels);
    }

    /// <summary>
    /// Direct connection (OPT_Port 0): the smallest N with pixels ≤ N × Toplam_Piksel and ports ≤ N × Ethernet_Port.
    /// null when the record can't carry anything.
    /// </summary>
    public static ProcessorOption? DescribeDirect(ProcessorSpec processor, long screenPixels)
    {
        if (processor.TotalPixels <= 0 || processor.EthernetPorts <= 0) return null;
        var ports = RequiredEthernetPorts(screenPixels, processor);
        var units = Math.Max(1, Math.Max(Ceil(screenPixels / (double)processor.TotalPixels), Ceil(ports / (double)processor.EthernetPorts)));
        return Option(processor, null, units, 0, ports, screenPixels);
    }

    private static ProcessorOption Option(ProcessorSpec processor, ExtenderSpec? extender, int units, int extenderUnits, int ports, long pixels)
    {
        var capacity = units * processor.TotalPixels;
        return new ProcessorOption(processor, units, extender, extenderUnits, ports, pixels, capacity, UtilizationPercent(pixels, capacity));
    }

    /// <summary>
    /// The option cards of one screen: each processor model's cheapest combo (fewest units, then fewest CVTs,
    /// over all extenders). A model is hidden only when AT LEAST TWO smaller models (by Toplam_Piksel) do the job
    /// with the same or fewer units. Sorted by units, Toplam_Piksel, CVTs, then ethernet ports. Stock is ignored.
    /// </summary>
    public static IReadOnlyList<ProcessorOption> Recommend(IReadOnlyList<ProcessorSpec> processors, IReadOnlyList<ExtenderSpec> extenders, long screenPixels)
    {
        var best = new List<ProcessorOption>();
        foreach (var processor in processors)
        {
            var combos = IsDirect(processor)
                ? new[] { DescribeDirect(processor, screenPixels) }
                : extenders.Select(e => DescribeCombo(processor, e, screenPixels));
            ProcessorOption? bestForModel = null;
            foreach (var combo in combos)
            {
                if (combo is null) continue;
                if (bestForModel is null || combo.Units < bestForModel.Units ||
                    (combo.Units == bestForModel.Units && combo.ExtenderUnits < bestForModel.ExtenderUnits))
                    bestForModel = combo;
            }
            if (bestForModel is not null) best.Add(bestForModel);
        }

        return best
            .Where(o => best.Count(other => other.Processor.TotalPixels < o.Processor.TotalPixels && other.Units <= o.Units) < 2)
            .OrderBy(o => o.Units)
            .ThenBy(o => o.Processor.TotalPixels)
            .ThenBy(o => o.ExtenderUnits)
            .ThenBy(o => o.Processor.EthernetPorts)
            .ToList();
    }

    /// <summary>
    /// The job total from every screen's selected option (null = no feasible option: counted apart, left out
    /// of the totals). Models are listed in order of first appearance.
    /// </summary>
    public static JobDevices JobTotal(IReadOnlyList<(long TotalPixels, ProcessorOption? Selected)> screens)
    {
        var selected = screens.Where(s => s.Selected is not null).Select(s => s.Selected!).ToList();
        var processors = new List<(ProcessorSpec Processor, int Count)>();
        var extenders = new List<(ExtenderSpec Extender, int Count)>();
        foreach (var option in selected)
        {
            Add(processors, option.Processor, option.Units);
            // Direct-connection processors add no extenders.
            if (option.Extender is not null) Add(extenders, option.Extender, option.ExtenderUnits);
        }
        return new JobDevices(
            screens.Sum(s => s.TotalPixels),
            processors,
            extenders,
            selected.Sum(o => o.Units),
            selected.Sum(o => o.ExtenderUnits),
            screens.Count - selected.Count);
    }

    private static void Add<T>(List<(T Model, int Count)> totals, T model, int count) where T : class
    {
        var index = totals.FindIndex(t => ReferenceEquals(t.Model, model) || t.Model.Equals(model));
        if (index < 0) totals.Add((model, count));
        else totals[index] = (model, totals[index].Count + count);
    }
}

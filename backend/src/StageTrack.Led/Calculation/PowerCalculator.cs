namespace StageTrack.Led.Calculation;

/// <summary>One CEE circuit of a screen (numbered from 0 within the screen).</summary>
public sealed record Circuit(string ScreenId, int Index, int PanelCount, double CurrentA);

/// <summary>Where "panels per circuit" comes from: the panel's atlama for the mode, or the panel current (atlama blank).</summary>
public enum LinkSource
{
    Fixed,
    Current,
}

public sealed record PhaseLoad(string Phase, IReadOnlyList<Circuit> Circuits, double TotalCurrentA);

public sealed record DistributionUnits(string OptionId, int UnitsNeeded);

/// <summary>A screen's size, power and CEE circuits.</summary>
/// <param name="WattMissing">The panel has no watt value for the selected power mode.</param>
/// <param name="AreaM2">The LED area: the panels used (cut-outs left out, corner panels at their own size), m².</param>
public sealed record ScreenPower(
    int PanelCount,
    double WidthMm,
    double HeightMm,
    long ResolutionX,
    long ResolutionY,
    double TotalWeightKg,
    double TotalWattMax,
    double TotalWattAvg,
    long TotalPixels,
    double PanelCurrentA,
    int PanelsPerCircuit,
    LinkSource PanelsPerCircuitSource,
    int CircuitsNeeded,
    int SocapexNeeded,
    IReadOnlyList<Circuit> Circuits,
    bool WattMissing,
    double AreaM2);

/// <summary>Phase split and distribution boxes of a set of circuits (one screen, or the whole job).</summary>
public sealed record PowerDistribution(IReadOnlyList<PhaseLoad> Phases, double PerPhaseMaxA, IReadOnlyList<DistributionUnits> Distribution);

/// <summary>
/// Power and CEE / socapex counts (docs/HESAPLAMA.md "Güç"). Pure functions; floating point is done in the
/// same order as the original TypeScript engine so results match it exactly.
/// </summary>
public static class PowerCalculator
{
    private static readonly string[] PhaseNames = ["L1", "L2", "L3"];

    public static double? PanelWatt(PanelSpec panel, PowerMode mode) => mode == PowerMode.Max ? panel.WattMax : panel.WattAvg;

    /// <summary>I = P / (V × power factor).</summary>
    public static double WattToCurrent(double watts, double voltage, double powerFactor)
    {
        if (voltage <= 0) throw new ArgumentOutOfRangeException(nameof(voltage), "Voltaj sıfırdan büyük olmalı.");
        if (powerFactor <= 0) throw new ArgumentOutOfRangeException(nameof(powerFactor), "Güç faktörü sıfırdan büyük olmalı.");
        return watts / (voltage * powerFactor);
    }

    /// <summary>Current per panel for the mode; null when the watt value is blank.</summary>
    public static double? PanelCurrent(PanelSpec panel, PowerMode mode, double voltage, double powerFactor) =>
        PanelWatt(panel, mode) is { } watt ? WattToCurrent(watt, voltage, powerFactor) : null;

    /// <summary>floor(fuse × derating / panel current); 0 without a current.</summary>
    public static int PanelsPerCircuit(double panelCurrentA, double fuseAmpere, double deratingPercent)
    {
        if (panelCurrentA <= 0) return 0;
        var usable = fuseAmpere * (deratingPercent / 100);
        return (int)Math.Floor(usable / panelCurrentA);
    }

    /// <summary>The panel's atlama for the mode as a whole number ≥ 1; null when blank.</summary>
    public static int? FixedLink(PanelSpec panel, PowerMode mode) =>
        (mode == PowerMode.Max ? panel.MaxLink : panel.AvgLink) is >= 1 and var link ? link : null;

    /// <summary>Max_Atlama / Ort_Atlama when set (then the counts never depend on the voltage), else from the current.</summary>
    public static (int Count, LinkSource Source) ResolvePanelsPerCircuit(PanelSpec panel, PowerMode mode, double panelCurrentA, CalcSettings settings) =>
        FixedLink(panel, mode) is { } link
            ? (link, LinkSource.Fixed)
            : (PanelsPerCircuit(panelCurrentA, settings.FuseAmpere, settings.DeratingPercent), LinkSource.Current);

    public static int RequiredCircuits(int panels, int panelsPerCircuit) =>
        panelsPerCircuit <= 0 ? 0 : (int)Math.Ceiling(panels / (double)panelsPerCircuit);

    public static int RequiredSocapex(int circuits, int circuitsPerSocapex) =>
        circuitsPerSocapex <= 0 ? 0 : (int)Math.Ceiling(circuits / (double)circuitsPerSocapex);

    /// <summary>Full circuits of <paramref name="maxPanelsPerCircuit"/> panels, the remainder on the last one.</summary>
    public static IReadOnlyList<Circuit> BuildCircuits(int panelCount, double panelCurrentA, int maxPanelsPerCircuit, string screenId)
    {
        if (panelCount <= 0 || maxPanelsPerCircuit <= 0) return [];
        var circuits = new List<Circuit>();
        for (int remaining = panelCount, index = 0; remaining > 0; index++)
        {
            var count = Math.Min(maxPanelsPerCircuit, remaining);
            circuits.Add(new Circuit(screenId, index, count, count * panelCurrentA));
            remaining -= count;
        }
        return circuits;
    }

    /// <summary>A screen of identical panels (columns × rows). No panel → all zero.</summary>
    public static ScreenPower CalcScreen(string screenId, PanelSpec? panel, int columns, int rows, double voltage, PowerMode mode, CalcSettings settings)
    {
        if (panel is null)
            return new ScreenPower(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, LinkSource.Current, 0, 0, [], false, 0);

        var panelCount = Math.Max(0, columns) * Math.Max(0, rows);
        var resolutionX = (long)panel.PixelWidth * columns;
        var resolutionY = (long)panel.PixelHeight * rows;
        var panelCurrentA = PanelCurrent(panel, mode, voltage, settings.PowerFactor) ?? 0;
        var (perCircuit, source) = ResolvePanelsPerCircuit(panel, mode, panelCurrentA, settings);
        var circuitsNeeded = RequiredCircuits(panelCount, perCircuit);

        return new ScreenPower(
            PanelCount: panelCount,
            WidthMm: panel.WidthMm * columns,
            HeightMm: panel.HeightMm * rows,
            ResolutionX: resolutionX,
            ResolutionY: resolutionY,
            TotalWeightKg: panelCount * panel.WeightKg,
            // A blank watt counts as 0 (and is flagged).
            TotalWattMax: panelCount * (panel.WattMax ?? 0),
            TotalWattAvg: panelCount * (panel.WattAvg ?? 0),
            TotalPixels: resolutionX * resolutionY,
            PanelCurrentA: panelCurrentA,
            PanelsPerCircuit: perCircuit,
            PanelsPerCircuitSource: source,
            CircuitsNeeded: circuitsNeeded,
            SocapexNeeded: RequiredSocapex(circuitsNeeded, settings.CircuitsPerSocapex),
            Circuits: BuildCircuits(panelCount, panelCurrentA, perCircuit, screenId),
            WattMissing: PanelWatt(panel, mode) is null,
            AreaM2: panelCount * panel.WidthMm * panel.HeightMm / 1_000_000);
    }

    /// <summary>Notes about a shaped screen the user should see (codes; the client words them).</summary>
    public const string CornerHeightMismatch = "corner_height_mismatch";

    /// <summary>
    /// A screen with a shape (cut-outs, corner columns). Only used cells count: panels, power, weight and pixels
    /// (the outer size stays the frame); power and current are the panels' own watt values (Max / Ort). Circuits take
    /// the used panels column by column (left to right, bottom up). With corner panels a circuit is filled by
    /// count (fixed atlama) or by each panel's own current (computed atlama). A plain shape gives exactly
    /// <see cref="CalcScreen"/>'s result. A <paramref name="layout"/> other than the default replaces the circuits
    /// with the ones it wires (<see cref="MapCircuits"/>): the CEE / socapex count follows the map.
    /// </summary>
    public static (ScreenPower Power, IReadOnlyList<string> Warnings) CalcShapedScreen(
        string screenId, PanelSpec main, int columns, int rows, ScreenShape shape, double voltage, PowerMode mode, CalcSettings settings,
        CircuitLayoutOptions? layout = null)
    {
        var (power, warnings) = shape.IsPlain
            ? (CalcScreen(screenId, main, columns, rows, voltage, mode, settings), [])
            : CalcShape(screenId, main, columns, rows, shape, voltage, mode, settings);
        if (layout is null || layout.IsDefault) return (power, warnings);

        var circuits = MapCircuits(main, columns, rows, shape, layout, voltage, mode, settings)
            .Select(run => new Circuit(screenId, run.Index, run.Cells.Count, run.CurrentA))
            .ToList();
        return (power with
        {
            Circuits = circuits,
            CircuitsNeeded = circuits.Count,
            SocapexNeeded = RequiredSocapex(circuits.Count, settings.CircuitsPerSocapex),
        }, warnings);
    }

    /// <summary>
    /// The circuits panel by panel, chained along the layout (<see cref="CircuitLayout.Lines"/>). They are filled the
    /// way the CEE count fills them: with the screen's own panels only by count, with corner panels by count (fixed
    /// atlama) or by each panel's 100 % current (computed atlama). The default layout therefore gives exactly the
    /// circuits of <see cref="CalcShapedScreen"/> (same panel counts and currents), now with their panels.
    /// </summary>
    public static IReadOnlyList<CircuitRun> MapCircuits(
        PanelSpec main, int columns, int rows, ScreenShape shape, CircuitLayoutOptions layout, double voltage, PowerMode mode, CalcSettings settings)
    {
        var mainCurrent = PanelCurrent(main, mode, voltage, settings.PowerFactor) ?? 0;
        var (perCircuit, source) = ResolvePanelsPerCircuit(main, mode, mainCurrent, settings);
        if (perCircuit <= 0 || columns <= 0 || rows <= 0) return [];

        var used = ScreenGeometry.UsedCells(columns, rows, shape.Cutouts);
        var models = ScreenGeometry.ColumnPanels(main, columns, shape.Corners);
        var uniform = shape.Corners.Count == 0;
        var byCount = uniform || source == LinkSource.Fixed;
        var usable = settings.FuseAmpere * (settings.DeratingPercent / 100);
        double Amps(int cell) => PanelCurrent(models[cell / rows], mode, voltage, settings.PowerFactor) ?? 0;

        var runs = new List<CircuitRun>();
        var cells = new List<int>();
        var (load, current) = (0.0, 0.0);
        bool Fits(int panels, double amps) => cells.Count == 0 || (byCount ? cells.Count + panels <= perCircuit : load + amps <= usable);
        void Close()
        {
            // Same arithmetic as BuildCircuits / BuildMixedCircuits, so the currents match to the last bit.
            runs.Add(new CircuitRun(runs.Count, cells, uniform ? cells.Count * mainCurrent : current));
            cells = [];
            (load, current) = (0.0, 0.0);
        }

        foreach (var line in CircuitLayout.Lines(columns, rows, used, layout))
        {
            if (layout.KeepLinesWhole && line.Count > 0 && !Fits(line.Count, line.Sum(Amps))) Close();
            foreach (var cell in line)
            {
                var amps = Amps(cell);
                if (!Fits(1, amps)) Close();
                cells.Add(cell);
                load += amps;
                current += amps;
            }
        }
        if (cells.Count > 0) Close();
        return runs;
    }

    private static (ScreenPower Power, IReadOnlyList<string> Warnings) CalcShape(
        string screenId, PanelSpec main, int columns, int rows, ScreenShape shape, double voltage, PowerMode mode, CalcSettings settings)
    {

        var used = ScreenGeometry.UsedCells(columns, rows, shape.Cutouts);
        var models = ScreenGeometry.ColumnPanels(main, columns, shape.Corners);

        // Used panels in circuit order, and how many of each model.
        var sequence = new List<PanelSpec>();
        var counts = new Dictionary<PanelSpec, int>(ReferenceEqualityComparer.Instance);
        long totalPixels = 0;
        for (var c = 0; c < columns; c++)
            for (var r = 0; r < rows; r++)
            {
                if (!used[c, r]) continue;
                var model = models[c];
                sequence.Add(model);
                counts[model] = counts.GetValueOrDefault(model) + 1;
                totalPixels += (long)model.PixelWidth * model.PixelHeight;
            }

        double Sum(Func<PanelSpec, double> perPanel)
        {
            var sum = 0.0;
            foreach (var (model, count) in counts) sum += count * perPanel(model);
            return sum;
        }

        var mainCurrent = PanelCurrent(main, mode, voltage, settings.PowerFactor) ?? 0;
        var (perCircuit, source) = ResolvePanelsPerCircuit(main, mode, mainCurrent, settings);
        var circuits = shape.Corners.Count == 0
            ? BuildCircuits(sequence.Count, mainCurrent, perCircuit, screenId)
            : BuildMixedCircuits(sequence, perCircuit, source, voltage, mode, settings, screenId);

        var power = new ScreenPower(
            PanelCount: sequence.Count,
            WidthMm: models.Sum(m => m.WidthMm),
            HeightMm: main.HeightMm * rows,
            ResolutionX: models.Sum(m => (long)m.PixelWidth),
            ResolutionY: (long)main.PixelHeight * rows,
            TotalWeightKg: Sum(m => m.WeightKg),
            TotalWattMax: Sum(m => m.WattMax ?? 0),
            TotalWattAvg: Sum(m => m.WattAvg ?? 0),
            TotalPixels: totalPixels,
            PanelCurrentA: mainCurrent,
            PanelsPerCircuit: perCircuit,
            PanelsPerCircuitSource: source,
            CircuitsNeeded: circuits.Count,
            SocapexNeeded: RequiredSocapex(circuits.Count, settings.CircuitsPerSocapex),
            Circuits: circuits,
            WattMissing: counts.Keys.Any(m => PanelWatt(m, mode) is null),
            AreaM2: Sum(m => m.WidthMm * m.HeightMm) / 1_000_000);
        var warnings = shape.Corners.Any(c => c.Panel.HeightMm != main.HeightMm) ? new[] { CornerHeightMismatch } : [];
        return (power, warnings);
    }

    /// <summary>
    /// Circuits of a screen with corner panels: a fixed atlama fills each circuit with that many panels; a computed
    /// one adds panels while their currents fit the usable fuse current (at least one panel per circuit).
    /// A circuit's current is the sum of its panels' currents.
    /// </summary>
    private static IReadOnlyList<Circuit> BuildMixedCircuits(
        IReadOnlyList<PanelSpec> panels, int perCircuit, LinkSource source, double voltage, PowerMode mode, CalcSettings settings, string screenId)
    {
        if (panels.Count == 0 || perCircuit <= 0) return [];
        var usable = settings.FuseAmpere * (settings.DeratingPercent / 100);
        var circuits = new List<Circuit>();
        var (count, load, current) = (0, 0.0, 0.0);
        foreach (var panel in panels)
        {
            var amps = PanelCurrent(panel, mode, voltage, settings.PowerFactor) ?? 0;
            var full = source == LinkSource.Fixed ? count >= perCircuit : count > 0 && load + amps > usable;
            if (full)
            {
                circuits.Add(new Circuit(screenId, circuits.Count, count, current));
                (count, load, current) = (0, 0.0, 0.0);
            }
            count++;
            load += amps;
            current += amps;
        }
        circuits.Add(new Circuit(screenId, circuits.Count, count, current));
        return circuits;
    }

    /// <summary>Greedy balancing: the heaviest circuit first, each onto the phase carrying the least current.</summary>
    public static IReadOnlyList<PhaseLoad> DistributePhases(IEnumerable<Circuit> circuits)
    {
        var lists = PhaseNames.Select(_ => new List<Circuit>()).ToArray();
        var totals = new double[PhaseNames.Length];
        // OrderByDescending is stable, like Array.prototype.sort.
        foreach (var circuit in circuits.OrderByDescending(c => c.CurrentA))
        {
            var target = 0;
            for (var i = 1; i < totals.Length; i++)
                if (totals[i] < totals[target]) target = i;
            lists[target].Add(circuit);
            totals[target] += circuit.CurrentA;
        }
        return PhaseNames.Select((name, i) => new PhaseLoad(name, lists[i], totals[i])).ToList();
    }

    /// <summary>
    /// Distribution boxes, each with its own count. Circuits can't be split across boxes: one box carries
    /// floor(box A / circuit A) circuits per phase and ceil(circuits on the busiest phase / that) boxes are needed.
    /// Boxes below one circuit are left out; boxes larger than the smallest one that suffices alone show 0.
    /// </summary>
    public static IReadOnlyList<DistributionUnits> RecommendDistribution(int circuitsPerPhase, double circuitCurrentA, IReadOnlyList<DistributionOption> options)
    {
        var usable = options
            .Select(o => (Option: o, PerBox: circuitCurrentA > 0 ? (int)Math.Floor(o.AmpsPerPhase / circuitCurrentA) : 0))
            .Where(o => circuitCurrentA <= 0 || o.PerBox > 0)
            .ToList();
        if (circuitsPerPhase <= 0 || circuitCurrentA <= 0)
            return usable.Select(o => new DistributionUnits(o.Option.Id, 0)).ToList();

        var units = usable.Select(o => (int)Math.Ceiling(circuitsPerPhase / (double)o.PerBox)).ToList();
        var singleBoxAmps = usable.Where((_, i) => units[i] == 1).Select(o => o.Option.AmpsPerPhase).DefaultIfEmpty(double.PositiveInfinity).Min();
        return usable.Select((o, i) => new DistributionUnits(o.Option.Id, o.Option.AmpsPerPhase > singleBoxAmps ? 0 : units[i])).ToList();
    }

    /// <summary>Phase split of the circuits, the busiest phase's current and the distribution boxes.</summary>
    public static PowerDistribution Distribute(IEnumerable<Circuit> circuits, CalcSettings settings)
    {
        var phases = DistributePhases(circuits);
        var circuitsPerPhase = phases.Max(p => p.Circuits.Count);
        var circuitCurrentA = phases.SelectMany(p => p.Circuits).Select(c => c.CurrentA).DefaultIfEmpty(0).Max();
        return new PowerDistribution(
            phases,
            Math.Max(0, phases.Max(p => p.TotalCurrentA)),
            RecommendDistribution(circuitsPerPhase, Math.Max(0, circuitCurrentA), settings.DistributionOptions));
    }
}

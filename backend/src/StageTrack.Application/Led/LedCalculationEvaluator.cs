using StageTrack.Led.Calculation;

namespace StageTrack.Led;

/// <summary>The models a job may use (the caller's inventory), in the order the option cards break ties in.</summary>
public sealed record LedCalculationCatalog(
    IReadOnlyList<PanelSpec> Panels,
    IReadOnlyList<ProcessorSpec> Processors,
    IReadOnlyList<ExtenderSpec> Extenders);

/// <summary>
/// The whole job calculation as one pure function (no I/O): per screen power, phases and distribution,
/// processor option cards; the job totals. <see cref="LedCalculationAppService"/> loads the catalog and calls this.
/// </summary>
public static class LedCalculationEvaluator
{
    /// <summary>A circuit map is drawn for screens up to this many panels (a far larger one comes back TooLarge).</summary>
    public const int MaxWiringPanels = 20_000;

    /// <param name="allowWiring">The plan has maps (feature Maps); otherwise a requested map comes back locked.</param>
    public static EvaluateResponse Evaluate(EvaluateRequest request, LedCalculationCatalog catalog, CalcSettings settings, bool allowWiring = true)
    {
        var panels = catalog.Panels.ToDictionary(p => p.Id);
        var screens = new List<ScreenEvaluationDto>();
        var powered = new List<ScreenPower>();
        var processorScreens = new List<(long TotalPixels, ProcessorOption? Selected)>();

        foreach (var screen in request.Screens)
        {
            PanelSpec? panel = screen.PanelModelId is { } id ? panels.GetValueOrDefault(id) : null;
            var panelFound = screen.PanelModelId is null || panel is not null;
            if (panel is null)
            {
                screens.Add(new ScreenEvaluationDto(screen.Id, panelFound, null, null));
                continue;
            }

            var shape = ShapeOf(screen, panels);
            var layout = screen.Layout?.ToOptions() ?? CircuitLayoutOptions.Default;
            var (power, warnings) = PowerCalculator.CalcShapedScreen(screen.Id, panel, screen.Columns, screen.Rows, shape, request.Voltage, request.Mode, settings, layout);
            powered.Add(power);
            var distribution = PowerCalculator.Distribute(power.Circuits, settings);

            ScreenProcessorDto? processor = null;
            ProcessorOption? selectedOption = null;
            if (power.TotalPixels > 0)
            {
                var candidates = ProcessorPlanner.CandidatesFor(panel, catalog.Processors);
                var options = ProcessorPlanner.Recommend(candidates.Processors, catalog.Extenders, power.TotalPixels);
                var selectedIndex = options.Count > 0 ? Math.Clamp(screen.SelectedOption, 0, options.Count - 1) : 0;
                selectedOption = options.Count > 0 ? options[selectedIndex] : null;
                processorScreens.Add((power.TotalPixels, selectedOption));
                processor = new ScreenProcessorDto(options.Select(ToDto).ToList(), selectedIndex);
            }

            var wiring = !request.Wiring ? null
                : !allowWiring ? ScreenWiringDto.LockedMap
                : Wiring(power, distribution, () => PowerCalculator.MapCircuits(panel, screen.Columns, screen.Rows, shape, layout, request.Voltage, request.Mode, settings), settings);
            ScreenCurveDto? curve = null;
            if (screen.Curve is { } asked)
            {
                var solved = CurveSolver.Solve(panel, screen.Columns, shape.Corners.Select(c => c.AfterColumn).ToList(), new CurveRequest(asked.Mode, asked.Value, asked.Direction));
                curve = new ScreenCurveDto(solved.JointAnglesDeg, solved.TargetJointDeg, solved.AppliedJointDeg, solved.AchievedArcDeg, solved.AchievedRadiusM);
                warnings = [.. warnings, .. solved.Warnings];
            }
            ScreenSignalDto? signal = null;
            if (request.Wiring && selectedOption is not null)
            {
                if (!allowWiring) signal = ScreenSignalDto.LockedChains;
                else if (power.PanelCount > MaxWiringPanels) signal = new ScreenSignalDto(false, true, null, null, selectedOption.PortsUsed, 0, []);
                else
                {
                    var plan = SignalChain.Plan(panel, screen.Columns, screen.Rows, shape, screen.SignalLayout?.ToOptions() ?? layout, selectedOption);
                    signal = new ScreenSignalDto(
                        false, false, selectedOption.Processor.Id, selectedOption.Extender?.Id, plan.PortsNeeded, plan.PixelsPerPort,
                        plan.Ports.Select(p => new PortChainDto(p.Index, p.Device, p.Cvt, p.Cells, p.Pixels)).ToList());
                    warnings = [.. warnings, .. plan.Warnings];
                }
            }
            screens.Add(new ScreenEvaluationDto(screen.Id, true, ToDto(power, distribution, settings), processor, warnings, wiring, curve, signal));
        }

        return new EvaluateResponse(screens, new JobEvaluationDto(JobPower(powered, settings), JobProcessor(processorScreens)));
    }

    /// <summary>
    /// The screen's shape, checked: cut-outs inside the screen and not covering all of it, corner columns between two
    /// columns with a corner panel model of the inventory. A problem is the request's fault (400).
    /// </summary>
    private static ScreenShape ShapeOf(EvaluateScreenRequest screen, IReadOnlyDictionary<Guid, PanelSpec> panels)
    {
        var cutouts = (screen.Cutouts ?? []).Select(c => new Cutout(c.Width, c.Height, c.Left, c.Bottom)).ToList();
        var cornerRequests = screen.Corners ?? [];
        var problem = ScreenGeometry.Check(screen.Columns, screen.Rows, cutouts, cornerRequests.Select(c => c.AfterColumn));
        if (problem == ShapeProblem.CutoutOutside)
            throw new BusinessException(StageTrackErrorCodes.LedCutoutOutside);
        if (problem == ShapeProblem.CornerPosition)
            throw new BusinessException(StageTrackErrorCodes.LedCornerPosition);
        if (cutouts.Count > 0 && ScreenGeometry.UsedCells(screen.Columns, screen.Rows, cutouts).Cast<bool>().All(used => !used))
            throw new BusinessException(StageTrackErrorCodes.LedScreenFullyCut);

        var corners = cornerRequests.Select(c =>
        {
            var model = panels.GetValueOrDefault(c.PanelModelId);
            if (model is not { IsCorner: true })
                throw new BusinessException(StageTrackErrorCodes.LedCornerPanelInvalid);
            return new CornerColumn(c.AfterColumn, model);
        }).ToList();
        return new ScreenShape(cutouts, corners);
    }

    /// <summary>The screen's circuits panel by panel, with the phase each is on (the screen's own split) and its socapex.</summary>
    private static ScreenWiringDto Wiring(ScreenPower power, PowerDistribution distribution, Func<IReadOnlyList<CircuitRun>> map, CalcSettings settings)
    {
        if (power.PanelCount > MaxWiringPanels) return new ScreenWiringDto(false, true, []);
        var phaseOf = distribution.Phases.SelectMany(p => p.Circuits.Select(c => (c.Index, p.Phase))).ToDictionary(x => x.Index, x => x.Phase);
        var perSocapex = Math.Max(1, settings.CircuitsPerSocapex);
        return new ScreenWiringDto(false, false, map()
            .Select(run => new WiredCircuitDto(run.Index, phaseOf.GetValueOrDefault(run.Index, ""), run.Index / perSocapex, run.Cells))
            .ToList());
    }

    private static JobPowerDto? JobPower(IReadOnlyList<ScreenPower> screens, CalcSettings settings)
    {
        if (screens.Count == 0) return null;
        var circuits = screens.SelectMany(s => s.Circuits).ToList();
        var distribution = PowerCalculator.Distribute(circuits, settings);
        return new JobPowerDto(
            Sum(screens.Select(s => s.TotalWattMax)),
            Sum(screens.Select(s => s.TotalWattAvg)),
            Sum(circuits.Select(c => c.CurrentA)),
            screens.Sum(s => s.CircuitsNeeded),
            screens.Sum(s => s.SocapexNeeded),
            distribution.Phases.Select(ToDto).ToList(),
            distribution.PerPhaseMaxA,
            distribution.Distribution.Select(d => ToDto(d, settings)).ToList());
    }

    private static JobProcessorDto JobProcessor(IReadOnlyList<(long TotalPixels, ProcessorOption? Selected)> screens)
    {
        var job = ProcessorPlanner.JobTotal(screens);
        return new JobProcessorDto(
            job.TotalPixels,
            job.Processors.Select(p => new DeviceCountDto(p.Processor.Id, p.Count)).ToList(),
            job.Extenders.Select(e => new DeviceCountDto(e.Extender.Id, e.Count)).ToList(),
            job.TotalProcessors,
            job.TotalExtenders,
            job.InfeasibleScreenCount);
    }

    /// <summary>Left-to-right sum (the order the original engine added in, so results match to the last bit).</summary>
    private static double Sum(IEnumerable<double> values)
    {
        var sum = 0.0;
        foreach (var value in values) sum += value;
        return sum;
    }

    private static ScreenPowerDto ToDto(ScreenPower p, PowerDistribution d, CalcSettings settings) => new(
        p.PanelCount, p.WidthMm, p.HeightMm, p.ResolutionX, p.ResolutionY, p.TotalWeightKg, p.TotalWattMax, p.TotalWattAvg,
        p.TotalPixels, p.PanelCurrentA, p.PanelsPerCircuit, p.PanelsPerCircuitSource, p.CircuitsNeeded, p.SocapexNeeded,
        p.Circuits.Select(ToDto).ToList(), p.WattMissing,
        d.Phases.Select(ToDto).ToList(), d.PerPhaseMaxA, d.Distribution.Select(u => ToDto(u, settings)).ToList(), p.AreaM2);

    private static CircuitDto ToDto(Circuit c) => new(c.ScreenId, c.Index, c.PanelCount, c.CurrentA);

    private static PhaseDto ToDto(PhaseLoad p) => new(p.Phase, p.Circuits.Select(ToDto).ToList(), p.TotalCurrentA);

    private static DistributionDto ToDto(DistributionUnits d, CalcSettings settings)
    {
        var option = settings.DistributionOptions.First(o => o.Id == d.OptionId);
        return new DistributionDto(d.OptionId, option.AmpsPerPhase, option.SocapexOutputs, d.UnitsNeeded);
    }

    private static ProcessorOptionDto ToDto(ProcessorOption o) => new(
        o.Processor.Id, o.Units, o.Extender?.Id, o.ExtenderUnits, o.PortsUsed, o.PixelsUsed, o.PixelsCapacity, o.UtilizationPercent);
}

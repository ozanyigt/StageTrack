using StageTrack.Led.Calculation;

namespace StageTrack.Led;

// ---------------------------------------------------------------- Request

/// <summary>The job to calculate: voltage, power mode and the screens (a project, or an unsaved quick calculation).</summary>
/// <param name="Wiring">Also return each screen's circuit map (Simülasyon). Plan feature Maps: without it the screens
/// come back with <c>wiring.locked</c> and no map.</param>
public sealed record EvaluateRequest(double Voltage, PowerMode Mode, IReadOnlyList<EvaluateScreenRequest> Screens, bool Wiring = false);

/// <param name="Id">The client's screen id (echoed back; results are matched by it).</param>
/// <param name="PanelModelId">null = no panel picked yet.</param>
/// <param name="SelectedOption">Index of the chosen processor option card (out of range = the nearest one).</param>
/// <param name="Cutouts">Areas cut out of the screen (panels); overlapping ones count once. Plan feature ScreenShape.</param>
/// <param name="Corners">Corner columns, counted in <paramref name="Columns"/>. Plan feature ScreenShape.</param>
/// <param name="Layout">How the panels are chained into circuits; null = the default (column by column from the
/// bottom left). Any other layout sets the CEE count. Plan feature Maps.</param>
/// <param name="Curve">A curved screen: the angle at each joint comes back in the screen's <c>curve</c>. Calculations
/// do not change (power and pixels are the same flat or curved).</param>
/// <param name="SignalLayout">The order the data chains run through the panels; null = the power wiring's order.
/// Changes only the suggested chains, no figure. Plan feature Maps.</param>
public sealed record EvaluateScreenRequest(
    string Id,
    Guid? PanelModelId,
    int Columns,
    int Rows,
    int SelectedOption = 0,
    IReadOnlyList<CutoutDto>? Cutouts = null,
    IReadOnlyList<CornerDto>? Corners = null,
    CircuitLayoutDto? Layout = null,
    CurveDto? Curve = null,
    SignalLayoutDto? SignalLayout = null)
{
    public bool HasShape => Cutouts is { Count: > 0 } || Corners is { Count: > 0 };

    /// <summary>A power layout other than the default (the default one is the same as none), or a signal layout.</summary>
    public bool HasLayout => (Layout is not null && !Layout.ToOptions().IsDefault) || SignalLayout is not null;
}

/// <summary>The data chains' order: along columns or rows, from which corner, zigzag or not.</summary>
public sealed record SignalLayoutDto(WiringDirection Direction, WiringStart Start, bool Serpentine = true)
{
    public CircuitLayoutOptions ToOptions() => new(Direction, Start, false, Serpentine);
}

/// <summary>A curve as asked for: an arc in degrees or a radius in metres, concave or convex.</summary>
public sealed record CurveDto(CurveMode Mode, double Value, CurveDirection Direction);

/// <summary>A screen's power wiring: along columns or rows, from which corner, whether lines are kept whole and zigzag.</summary>
public sealed record CircuitLayoutDto(WiringDirection Direction, WiringStart Start, bool KeepLinesWhole, bool Serpentine = true)
{
    public CircuitLayoutOptions ToOptions() => new(Direction, Start, KeepLinesWhole, Serpentine);
}

/// <summary>A cut-out area in panels: width, height and its distance from the screen's left and bottom edge.</summary>
public sealed record CutoutDto(int Width, int Height, int Left, int Bottom);

/// <summary>A corner column: after how many columns it stands (1 … columns − 1) and its corner panel model.</summary>
public sealed record CornerDto(int AfterColumn, Guid PanelModelId);

// ---------------------------------------------------------------- Response

/// <summary>Every result of the job, per screen (in request order) and in total.</summary>
public sealed record EvaluateResponse(IReadOnlyList<ScreenEvaluationDto> Screens, JobEvaluationDto Job);

/// <param name="PanelFound">false when the requested panel model is not in the caller's inventory (then no results).</param>
/// <param name="Power">null without a panel.</param>
/// <param name="Processor">null without a panel or pixels.</param>
/// <param name="Warnings">Notes for the user, as codes (e.g. "corner_height_mismatch"); empty when none.</param>
/// <param name="Wiring">The circuit map; only when the request asked for it and the screen has power results.</param>
/// <param name="Curve">The curve angles; only for a screen asked to be curved (its notes are in <paramref name="Warnings"/>).</param>
/// <param name="Signal">The suggested data chains of the selected processor option; with the circuit map (same request
/// flag, same plan feature), when the screen has an option.</param>
public sealed record ScreenEvaluationDto(
    string Id, bool PanelFound, ScreenPowerDto? Power, ScreenProcessorDto? Processor, IReadOnlyList<string> Warnings, ScreenWiringDto? Wiring = null,
    ScreenCurveDto? Curve = null, ScreenSignalDto? Signal = null)
{
    public ScreenEvaluationDto(string id, bool panelFound, ScreenPowerDto? power, ScreenProcessorDto? processor)
        : this(id, panelFound, power, processor, []) { }
}

public sealed record CircuitDto(string ScreenId, int Index, int PanelCount, double CurrentA);

/// <summary>
/// A screen's suggested data chains (Simülasyon): the selected option's processor / extender, the ports its card
/// counts, a port's pixel limit and every port's chain. <paramref name="Locked"/> / <paramref name="TooLarge"/> as in
/// <see cref="ScreenWiringDto"/> (then no ports).
/// </summary>
public sealed record ScreenSignalDto(
    bool Locked, bool TooLarge, Guid? ProcessorId, Guid? ExtenderId, int PortsNeeded, long PixelsPerPort, IReadOnlyList<PortChainDto> Ports)
{
    public static readonly ScreenSignalDto LockedChains = new(true, false, null, null, 0, 0, []);
}

/// <summary>
/// One port's chain: the processor unit (0-based) it comes out of, the CVT of that unit (0-based; null on a direct
/// connection), its panels in chain order (cells as in <see cref="WiredCircuitDto"/>) and their pixels.
/// </summary>
public sealed record PortChainDto(int Index, int Device, int? Cvt, IReadOnlyList<int> Cells, long Pixels);

/// <summary>
/// A curved screen's angles in degrees (+ concave, − convex): one per joint between two columns (0 next to a corner
/// column), the angle the request needs per joint and the one the panel locks at, and the arc / radius that gives
/// (radius null when flat).
/// </summary>
public sealed record ScreenCurveDto(
    IReadOnlyList<double> JointAnglesDeg, double TargetJointDeg, double AppliedJointDeg, double AchievedArcDeg, double? AchievedRadiusM);

/// <summary>
/// A screen's circuit map (Simülasyon). <paramref name="Locked"/>: the plan has no maps (no circuits).
/// <paramref name="TooLarge"/>: more panels than a map is drawn for (no circuits).
/// </summary>
public sealed record ScreenWiringDto(bool Locked, bool TooLarge, IReadOnlyList<WiredCircuitDto> Circuits)
{
    public static readonly ScreenWiringDto LockedMap = new(true, false, []);
}

/// <summary>
/// One circuit as wired: the same index as in <see cref="ScreenPowerDto.Circuits"/>, its phase (the screen's own
/// phase split), its socapex cable (0-based, <c>index / circuits per socapex</c>) and its panels in chain order —
/// the first is where the cable comes in. A panel is <c>column × rows + row</c> (column 0 = left, row 0 = bottom).
/// </summary>
public sealed record WiredCircuitDto(int Index, string Phase, int Socapex, IReadOnlyList<int> Cells);

public sealed record PhaseDto(string Phase, IReadOnlyList<CircuitDto> Circuits, double TotalCurrentA);

/// <summary>A distribution box size (as configured) and how many of it the load needs.</summary>
public sealed record DistributionDto(string OptionId, double AmpsPerPhase, int SocapexOutputs, int UnitsNeeded);

public sealed record ScreenPowerDto(
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
    IReadOnlyList<CircuitDto> Circuits,
    bool WattMissing,
    IReadOnlyList<PhaseDto> Phases,
    double PerPhaseMaxA,
    IReadOnlyList<DistributionDto> Distribution,
    double AreaM2);

/// <param name="ExtenderId">null = direct connection (no CVT / extender).</param>
/// <param name="PortsUsed">Internal only — never shown in the UI or reports.</param>
public sealed record ProcessorOptionDto(
    Guid ProcessorId,
    int Units,
    Guid? ExtenderId,
    int ExtenderUnits,
    int PortsUsed,
    long PixelsUsed,
    long PixelsCapacity,
    double UtilizationPercent);

/// <param name="SelectedIndex">The option in effect (the requested one, clamped to the list).</param>
public sealed record ScreenProcessorDto(IReadOnlyList<ProcessorOptionDto> Options, int SelectedIndex);

/// <summary>
/// Job power: socapex is the SUM of the screens' own socapex (screens never share a cable); phases and
/// distribution combine every screen's circuits (one box may feed several screens).
/// </summary>
public sealed record JobPowerDto(
    double TotalWattMax,
    double TotalWattAvg,
    double TotalCurrentA,
    int TotalCircuits,
    int TotalSocapex,
    IReadOnlyList<PhaseDto> Phases,
    double PerPhaseMaxA,
    IReadOnlyList<DistributionDto> Distribution);

public sealed record DeviceCountDto(Guid Id, int Count);

public sealed record JobProcessorDto(
    long TotalPixels,
    IReadOnlyList<DeviceCountDto> Processors,
    IReadOnlyList<DeviceCountDto> Extenders,
    int TotalProcessors,
    int TotalExtenders,
    int InfeasibleScreenCount);

/// <param name="Power">null when no screen has a panel.</param>
public sealed record JobEvaluationDto(JobPowerDto? Power, JobProcessorDto Processor);

/// <summary>The fixed calculation constants, for what the frontend shows itself (e.g. the inventory's current column).</summary>
public sealed record CalcSettingsDto(
    double PowerFactor,
    double FuseAmpere,
    double DeratingPercent,
    int CircuitsPerSocapex,
    IReadOnlyList<DistributionOption> DistributionOptions)
{
    public static CalcSettingsDto From(CalcSettings s) => new(s.PowerFactor, s.FuseAmpere, s.DeratingPercent, s.CircuitsPerSocapex, s.DistributionOptions);
}

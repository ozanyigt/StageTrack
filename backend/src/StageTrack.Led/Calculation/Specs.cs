namespace StageTrack.Led.Calculation;

/// <summary>What the calculations need of a panel model.</summary>
/// <param name="MaxLink">Panels on one 16A connection at max power (Max_Atlama); null = computed from the current.</param>
/// <param name="AvgLink">The same at average power (Ort_Atlama).</param>
/// <param name="CompatibleProcessorIds">An exclusive panel ("Özel işlemcisi var"): exactly the processors it works with; null = any processor.</param>
/// <param name="IsCorner">A corner panel (type Corner / Curve-Corner): may stand in a screen's corner column.</param>
/// <param name="Angles">The angle one joint to the next panel can lock at; null = a flat panel (no curve).</param>
public sealed record PanelSpec(
    Guid Id,
    double WidthMm,
    double HeightMm,
    int PixelWidth,
    int PixelHeight,
    double WeightKg,
    double? WattMax,
    double? WattAvg,
    int? MaxLink,
    int? AvgLink,
    IReadOnlyList<Guid>? CompatibleProcessorIds,
    bool IsCorner = false,
    AngleRange? Angles = null);

/// <summary>
/// The angles a panel's joint locks at, in degrees: + concave (the ends come towards the audience), − convex.
/// <paramref name="Step"/> null = any angle in the range; otherwise min, min + step, … up to max.
/// </summary>
public sealed record AngleRange(double Min, double Max, double? Step);

/// <summary>What the calculations need of a processor model.</summary>
/// <param name="PixelsPerPort">null = not entered (650.000 px per port is assumed).</param>
/// <param name="OptPorts">0 = direct connection: the processor drives the panels itself, no CVT / extender.</param>
public sealed record ProcessorSpec(
    Guid Id,
    string Name,
    long TotalPixels,
    int EthernetPorts,
    long? PixelsPerPort,
    int OptPorts);

/// <summary>What the calculations need of an extender (CVT) model.</summary>
public sealed record ExtenderSpec(Guid Id, string Name, int EthernetPorts);

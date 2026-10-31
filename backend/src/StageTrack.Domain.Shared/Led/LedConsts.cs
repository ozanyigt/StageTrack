namespace StageTrack.Led;

/// <summary>Which LED page an equipment item takes part in; the discriminator of its technical data.</summary>
public enum LedRole
{
    /// <summary>An LED panel: Pixel Map, simulation, 3D stage, power and logistics.</summary>
    Panel = 1,

    /// <summary>A sending card / video processor.</summary>
    Processor = 2,

    /// <summary>A fibre extender / converter (e.g. Novastar CVT10-S).</summary>
    Extender = 3
}

public static class LedConsts
{
    public const int MaxCaseDimensionsLength = 50;
    public const int MaxReceivingCardLength = 100;
    public const int MaxVehicleNameLength = 100;

    /// <summary>A sanity bound for how many cases may stand on top of each other.</summary>
    public const int MaxStackLimit = 10;

    /// <summary>Gap left between cases and to the vehicle's walls until a firm saves its own value.</summary>
    public const int DefaultTransportGapMm = 20;
}

/// <summary>The 3D stage values as one value, so defaults and a save can be handled alike.</summary>
public record LedStageValues(
    decimal StageWidthM,
    decimal StageDepthM,
    decimal StageHeightM,
    decimal FrontGapM,
    LedStageMount Mount,
    LedStageCarrier Carrier,
    decimal LegDepthM,
    decimal BottomM,
    bool GroundSupport,
    decimal GroundSupportHeightM,
    decimal TrussHeightM,
    decimal HangAllowanceM);

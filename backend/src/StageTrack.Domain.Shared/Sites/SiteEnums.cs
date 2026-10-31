namespace StageTrack.Sites;

/// <summary>What the map is drawn on. Satellite shows the real ground; the street map is clearer for routes.</summary>
public enum SiteBaseLayer
{
    Satellite = 1,
    Street = 2
}

/// <summary>What a drawn shape means on the plan; it decides how it is drawn and whether its area is worth showing.</summary>
public enum SiteZoneKind
{
    /// <summary>A filled area with its size: the arena, a camping field, a car park.</summary>
    Area = 1,

    /// <summary>A line people or vehicles follow: a walkway, an emergency route.</summary>
    Route = 2,

    /// <summary>A line that stops them: fencing, barriers.</summary>
    Barrier = 3
}

public static class SiteConsts
{
    public const int MaxNameLength = 128;
    public const int MaxLabelLength = 128;
    public const int MaxLayerLength = 64;
    public const int MaxNotesLength = 1000;
    public const int MaxColorLength = 16;

    /// <summary>A sanity bound on one drawn shape; a real zone needs far fewer corners.</summary>
    public const int MaxZonePoints = 500;

    public const int MaxItemsPerPlan = 2000;

    /// <summary>
    /// How far a light reaches on the ground when nobody says otherwise: roughly three times its height, which is
    /// the rule of thumb for a floodlight on a mast and close enough for spotting dark gaps.
    /// </summary>
    public const decimal LightRadiusPerMetre = 3m;

    /// <summary>The layers a new plan starts with; the user may add any others.</summary>
    public static readonly IReadOnlyList<string> DefaultLayers =
        ["Infrastructure", "Structures", "Public", "Operations", "Emergency", "Lighting"];
}

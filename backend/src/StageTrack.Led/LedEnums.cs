namespace StageTrack.Led;

/// <summary>
/// Panel shape. SuperCurve ("Super Curve"), CurveCorner ("Curve/Corner") and Floor (blank Tip, e.g. Roe Floor)
/// exist in the source inventory alongside the original four.
/// </summary>
public enum LedPanelType
{
    Flat = 1,
    Curve = 2,
    SuperCurve = 3,
    CurveCorner = 4,
    Corner = 5,
    Flexi = 6,
    Floor = 7
}

/// <summary>
/// The group a panel is listed under: Indoor, Outdoor, Poster or Other. A classification for the inventory,
/// stock and exports only — no calculation reads it.
/// </summary>
public enum LedPanelGroup
{
    Indoor = 1,
    Outdoor = 2,
    Poster = 3,
    Other = 4
}

/// <summary>3D stage: how the screens are mounted — standing on the stage or flown from a truss.</summary>
public enum LedStageMount
{
    Ground = 1,
    Flown = 2
}

/// <summary>3D stage, ground mounted: what holds the screens — scaff towers or an LED frame.</summary>
public enum LedStageCarrier
{
    Scaff = 1,
    LedFrame = 2
}

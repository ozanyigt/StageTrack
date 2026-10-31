namespace StageTrack.Led.Calculation;

/// <summary>What the curve is set by: the whole arc (degrees) or the radius (metres).</summary>
public enum CurveMode
{
    Arc,
    Radius,
}

/// <summary>Concave: the ends come towards the audience (+ angles). Convex: they go back (− angles).</summary>
public enum CurveDirection
{
    Concave,
    Convex,
}

/// <summary>A curved screen as asked for: an arc of <paramref name="Value"/> degrees, or a radius of Value metres.</summary>
public sealed record CurveRequest(CurveMode Mode, double Value, CurveDirection Direction);

/// <summary>
/// The curve the panels can make. <paramref name="JointAnglesDeg"/>: the angle at every joint between two columns
/// (columns − 1 of them; + concave, − convex; 0 next to a corner column, which makes its own turn).
/// <paramref name="TargetJointDeg"/> is what the request needs per joint, <paramref name="AppliedJointDeg"/> what the
/// panel locks at; <paramref name="AchievedArcDeg"/> / <paramref name="AchievedRadiusM"/> follow from the applied angle
/// (radius null when flat). <paramref name="Warnings"/> are codes (see the constants of <see cref="CurveSolver"/>).
/// </summary>
public sealed record CurveResult(
    IReadOnlyList<double> JointAnglesDeg,
    double TargetJointDeg,
    double AppliedJointDeg,
    double AchievedArcDeg,
    double? AchievedRadiusM,
    IReadOnlyList<string> Warnings);

/// <summary>
/// Curve angles of a screen: the angle between two neighbouring panels for the asked arc or radius, fitted to the
/// angles the panel locks at (inventory Açı min / max / adım). Every curved joint gets the same angle: an arc of A°
/// over n joints is A / n per joint; a radius R with panels w wide is 2·asin(w / 2R).
/// </summary>
public static class CurveSolver
{
    /// <summary>The panel has no angle range: it can't be curved.</summary>
    public const string NotSupported = "curve_not_supported";
    /// <summary>The angle needed is outside the panel's range: the nearest end of the range is used.</summary>
    public const string OutOfRange = "curve_angle_out_of_range";
    /// <summary>The angle needed is between two lock positions: the nearest one is used.</summary>
    public const string Rounded = "curve_angle_rounded";
    /// <summary>No joint can be curved (one column, or only joints next to corner columns).</summary>
    public const string NoJoints = "curve_no_joints";

    private const double Tolerance = 1e-6;

    public static CurveResult Solve(PanelSpec main, int columns, IReadOnlyCollection<int> cornerColumns, CurveRequest request)
    {
        var jointCount = Math.Max(0, columns - 1);
        // Joint j is between columns j and j + 1; one next to a corner column stays straight.
        var curved = Enumerable.Range(0, jointCount).Select(j => !cornerColumns.Contains(j) && !cornerColumns.Contains(j + 1)).ToArray();
        var curvedCount = curved.Count(c => c);
        var sign = request.Direction == CurveDirection.Concave ? 1 : -1;
        var widthM = main.WidthMm / 1000;

        var target = request.Mode switch
        {
            CurveMode.Arc => curvedCount > 0 ? request.Value / curvedCount : 0,
            // A radius shorter than half a panel can't be reached; the steepest joint (180°) stands for it.
            _ => request.Value > 0 && widthM > 0 ? Degrees(2 * Math.Asin(Math.Min(1, widthM / (2 * request.Value)))) : 0,
        } * sign;

        var warnings = new List<string>();
        double applied;
        if (curvedCount == 0)
        {
            warnings.Add(NoJoints);
            applied = 0;
        }
        else if (main.Angles is not { } range)
        {
            warnings.Add(NotSupported);
            applied = 0;
        }
        else
        {
            applied = Math.Clamp(target, range.Min, range.Max);
            if (Math.Abs(applied - target) > Tolerance) warnings.Add(OutOfRange);
            if (range.Step is > 0 and var step)
            {
                // The lock positions are min, min + step, … ≤ max.
                var steps = Math.Round((applied - range.Min) / step, MidpointRounding.AwayFromZero);
                var snapped = Math.Min(range.Min + steps * step, range.Max - (range.Max - range.Min) % step);
                if (Math.Abs(snapped - applied) > Tolerance && !warnings.Contains(OutOfRange)) warnings.Add(Rounded);
                applied = Math.Round(snapped, 9);
            }
        }

        var joints = curved.Select(c => c ? applied : 0).ToList();
        var radius = Math.Abs(applied) > Tolerance && widthM > 0 ? widthM / (2 * Math.Sin(Radians(Math.Abs(applied)) / 2)) : (double?)null;
        return new CurveResult(joints, target, applied, Math.Abs(applied) * curvedCount, radius, warnings);
    }

    private static double Degrees(double radians) => radians * 180 / Math.PI;

    private static double Radians(double degrees) => degrees * Math.PI / 180;
}

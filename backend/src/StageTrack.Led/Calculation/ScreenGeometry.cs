namespace StageTrack.Led.Calculation;

/// <summary>A rectangle cut out of a screen, in panels: size, and its distance from the left and bottom edge.</summary>
public sealed record Cutout(int Width, int Height, int Left, int Bottom);

/// <summary>A column of corner panels: <paramref name="AfterColumn"/> columns stand to its left (it is grid column AfterColumn, 0-based).</summary>
public sealed record CornerColumn(int AfterColumn, PanelSpec Panel);

/// <summary>
/// What a screen is beyond its panel and size: cut-out areas and corner columns. The column count
/// includes the corner columns (20 columns with 2 corners = 18 main + 2 corner columns).
/// </summary>
public sealed record ScreenShape(IReadOnlyList<Cutout> Cutouts, IReadOnlyList<CornerColumn> Corners)
{
    public static readonly ScreenShape Plain = new([], []);

    /// <summary>Nothing changed: the screen is calculated exactly as before shapes existed.</summary>
    public bool IsPlain => Cutouts.Count == 0 && Corners.Count == 0;
}

/// <summary>Why a shape does not fit its screen (the codes the API returns).</summary>
public enum ShapeProblem
{
    None,
    /// <summary>A cut-out is empty or reaches outside the screen.</summary>
    CutoutOutside,
    /// <summary>The cut-outs leave no panel.</summary>
    FullyCut,
    /// <summary>A corner column is not between two columns, or two share a place.</summary>
    CornerPosition,
}

/// <summary>Cells of a screen (column 0 = left, row 0 = bottom): which are used and which model each column has.</summary>
public static class ScreenGeometry
{
    public static ShapeProblem Check(int columns, int rows, IEnumerable<Cutout> cutouts, IEnumerable<int> cornerColumns)
    {
        foreach (var c in cutouts)
            if (c.Width < 1 || c.Height < 1 || c.Left < 0 || c.Bottom < 0 || c.Left + c.Width > columns || c.Bottom + c.Height > rows)
                return ShapeProblem.CutoutOutside;
        var corners = cornerColumns.ToList();
        if (corners.Any(a => a < 1 || a > columns - 1) || corners.Distinct().Count() != corners.Count) return ShapeProblem.CornerPosition;
        return ShapeProblem.None;
    }

    /// <summary>used[column, row]: false where a cut-out lies (overlapping cut-outs count once).</summary>
    public static bool[,] UsedCells(int columns, int rows, IEnumerable<Cutout> cutouts)
    {
        var used = new bool[Math.Max(0, columns), Math.Max(0, rows)];
        for (var c = 0; c < columns; c++)
            for (var r = 0; r < rows; r++)
                used[c, r] = true;
        foreach (var cut in cutouts)
            for (var c = cut.Left; c < cut.Left + cut.Width && c < columns; c++)
                for (var r = cut.Bottom; r < cut.Bottom + cut.Height && r < rows; r++)
                    used[c, r] = false;
        return used;
    }

    /// <summary>The panel model of each column: the corner model in a corner column, the screen's panel elsewhere.</summary>
    public static PanelSpec[] ColumnPanels(PanelSpec main, int columns, IEnumerable<CornerColumn> corners)
    {
        var models = Enumerable.Repeat(main, Math.Max(0, columns)).ToArray();
        foreach (var corner in corners)
            if (corner.AfterColumn >= 0 && corner.AfterColumn < models.Length)
                models[corner.AfterColumn] = corner.Panel;
        return models;
    }
}

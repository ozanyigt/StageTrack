namespace StageTrack.Led.Calculation;

/// <summary>Along which lines the power cable snakes through a screen: up and down the columns, or along the rows.</summary>
public enum WiringDirection
{
    Columns,
    Rows,
}

/// <summary>The corner panel the first circuit enters (seen from the audience).</summary>
public enum WiringStart
{
    BottomLeft,
    BottomRight,
    TopLeft,
    TopRight,
}

/// <summary>
/// How a screen's panels are chained into circuits. <paramref name="KeepLinesWhole"/>: a column (or row) starts a
/// new circuit unless all of it still fits on the current one — no circuit ends in the middle of a line that could
/// have had its own (a line longer than one circuit is still split). <paramref name="Serpentine"/>: every other line
/// turns back (zigzag, the default); off, every line runs the same way from the starting side.
/// </summary>
public sealed record CircuitLayoutOptions(WiringDirection Direction, WiringStart Start, bool KeepLinesWhole, bool Serpentine = true)
{
    /// <summary>Column by column from the bottom left: the order the CEE count has always assumed.</summary>
    public static readonly CircuitLayoutOptions Default = new(WiringDirection.Columns, WiringStart.BottomLeft, false);

    public bool IsDefault => this == Default;
}

/// <summary>
/// One circuit of a screen as it is wired: its panels in chain order (the first one is where the cable comes in).
/// A cell is <c>column × rows + row</c> (column 0 = left, row 0 = bottom).
/// </summary>
public sealed record CircuitRun(int Index, IReadOnlyList<int> Cells, double CurrentA);

/// <summary>The order the panels of a screen are chained in (cells as in <see cref="CircuitRun"/>).</summary>
public static class CircuitLayout
{
    /// <summary>
    /// The used cells line by line (columns or rows, starting at the chosen corner), each line snaking back the
    /// other way than the one before (serpentine; otherwise all from the starting side); cut-out cells are skipped,
    /// so a line may be empty.
    /// </summary>
    public static IReadOnlyList<IReadOnlyList<int>> Lines(int columns, int rows, bool[,] used, CircuitLayoutOptions options)
    {
        var fromRight = options.Start is WiringStart.BottomRight or WiringStart.TopRight;
        var fromTop = options.Start is WiringStart.TopLeft or WiringStart.TopRight;
        var byColumns = options.Direction == WiringDirection.Columns;
        var lineCount = byColumns ? columns : rows;
        var lineLength = byColumns ? rows : columns;

        var lines = new List<IReadOnlyList<int>>(Math.Max(0, lineCount));
        for (var i = 0; i < lineCount; i++)
        {
            // Which column / row this line is, and which way it runs (every other line turns back).
            var line = byColumns ? (fromRight ? columns - 1 - i : i) : (fromTop ? rows - 1 - i : i);
            var backwards = (byColumns ? fromTop : fromRight) ^ (options.Serpentine && i % 2 == 1);
            var cells = new List<int>(lineLength);
            for (var j = 0; j < lineLength; j++)
            {
                var along = backwards ? lineLength - 1 - j : j;
                var (c, r) = byColumns ? (line, along) : (along, line);
                if (used[c, r]) cells.Add(c * rows + r);
            }
            lines.Add(cells);
        }
        return lines;
    }
}

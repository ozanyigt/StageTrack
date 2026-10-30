namespace StageTrack.Led.Calculation;

/// <summary>A panel model in one location: the key of a stock line.</summary>
public readonly record struct StockKey(Guid PanelModelId, Guid LocationId);

/// <summary>A corner column of a screen and the stock its panels come from.</summary>
public sealed record StockCornerUse(int AfterColumn, StockKey Panel);

/// <summary>A screen of the job as Stok Durumu sees it: its main panel's stock line, its size, cut-outs and corners.</summary>
public sealed record StockScreenUse(StockKey Panel, int Columns, int Rows, IReadOnlyList<Cutout> Cutouts, IReadOnlyList<StockCornerUse> Corners);

/// <summary>
/// Stok Durumu's count: how many panels of every stock line (model × location) the job's screens use. A screen uses
/// its used cells (cut-outs left out); a corner column counts for its corner model and location. Reads only; it
/// changes no calculation.
/// </summary>
public static class StockUsage
{
    public static Dictionary<StockKey, int> Count(IEnumerable<StockScreenUse> screens)
    {
        var used = new Dictionary<StockKey, int>();
        foreach (var screen in screens)
        {
            if (screen.Columns <= 0 || screen.Rows <= 0) continue;
            var cells = ScreenGeometry.UsedCells(screen.Columns, screen.Rows, screen.Cutouts);
            var corners = screen.Corners.GroupBy(c => c.AfterColumn).ToDictionary(g => g.Key, g => g.First().Panel);
            for (var column = 0; column < screen.Columns; column++)
            {
                var key = corners.TryGetValue(column, out var corner) ? corner : screen.Panel;
                var count = 0;
                for (var row = 0; row < screen.Rows; row++)
                    if (cells[column, row]) count++;
                if (count > 0) used[key] = used.GetValueOrDefault(key) + count;
            }
        }
        return used;
    }
}
